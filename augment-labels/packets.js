// Аугменты из пакетов игры — источник данных для подписей (labels.js).
//
// Сокеты боя расшифровываются так же, как в packet-logger (своя копия шифра: состояние у каждой
// копии своё, логгеру не мешает). В расшифрованном потоке ищем две вещи (см. docs/protocol-notes.md):
//   - объект танка: [ID игрока, 8 байт][модель 1dd92f87b3f87698]... дальше модель экипировки
//     4ced44c5bf312832 и Long-и [корпус][аугмент корпуса?][…][пушка][аугмент пушки?][…] до модели
//     2d13ec49ae8e77ec. Пустой аугмент не передаётся: 6 Long-ов — оба, 4 — ни одного, 5 — один;
//     объект приходит при входе в бой, при заходе игрока и после переодевания;
//   - ник: строка [длина][ник] прямо перед ID игрока (список игроков). Приходит раньше или вместе с танком.
//     Ищем все такие кандидаты; ложные бывают двух видов: хвост чужого ID, за которым идёт ID
//     («…fb 02 65 67» = [2]"eg") — отсеиваем, и случайные — встречаются по разу, а настоящий ник
//     повторяется в каждом обновлении статистики, поэтому берём самый частый.
// ID аугмента -> иконка — таблица из бандла игры (devices.js, генерирует tools/devices.py).
(() => {
    "use strict";

    if (globalThis.__augmentPackets) return;

    const SPACE_OPENED_ID = 3;
    const SEED_SIZE = 32;
    const KEY_SIZE = 8;
    const MAX_NAMES = 20000; // кандидатов в ник за бой ~1–2 тыс., почти все мусорные

    const hex = (s) => Uint8Array.from(s.match(/../g), (b) => parseInt(b, 16));
    const TANK_FIRST_MODEL = hex("1dd92f87b3f87698");
    const EQUIPMENT_MODEL = hex("4ced44c5bf312832");
    const EQUIPMENT_NEXT_MODEL = hex("2d13ec49ae8e77ec");
    const TANK_SEARCH = 800; // от начала объекта танка до модели экипировки ~120–320 байт

    const devices = globalThis.__augmentDevices?.icons ?? {};

    class Cipher {
        key = new Uint8Array(KEY_SIZE);
        position = 0;

        constructor(seed, spaceID) {
            let x = Number((spaceID >> 32n) & 0xffffffffn) ^ Number(spaceID & 0xffffffffn);
            const view = new DataView(seed.buffer, seed.byteOffset, seed.byteLength);
            for (let i = 0; i < SEED_SIZE / 4; i++) x ^= view.getInt32(4 * i);
            const base = ((x >>> 24) ^ (x >>> 16) ^ (x >>> 8) ^ x) & 0xff;
            for (let i = 0; i < KEY_SIZE; i++) this.key[i] = base ^ (i << 3);
        }

        decrypt(bytes) {
            for (let i = 0; i < bytes.length; i++) {
                this.key[this.position] ^= bytes[i];
                bytes[i] = this.key[this.position];
                this.position ^= 7 & this.key[this.position];
            }
        }
    }

    // --- Разбор ---

    function indexOf(data, needle, from = 0, to = data.length) {
        const last = Math.min(to, data.length - needle.length);
        outer: for (let i = Math.max(0, from); i <= last; i++) {
            for (let j = 0; j < needle.length; j++) if (data[i + j] !== needle[j]) continue outer;
            return i;
        }
        return -1;
    }

    function lastIndexOf(data, needle, from, to) {
        for (let i = Math.min(to, data.length - needle.length); i >= Math.max(0, from); i--) {
            let j = 0;
            while (j < needle.length && data[i + j] === needle[j]) j++;
            if (j === needle.length) return i;
        }
        return -1;
    }

    const toHex = (data, start, length = 8) => {
        let s = "";
        for (let i = start; i < start + length; i++) s += data[i].toString(16).padStart(2, "0");
        return s;
    };

    // Ник в Tanki: латиница, цифры, _ - .
    const isNickByte = (b) => (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || b === 0x5f || b === 0x2d || b === 0x2e;

    // ID игрока (hex) -> Map(ник -> { count, tail }), tail — 8 байт, кончающиеся на нике
    const names = new Map();

    function collectNames(data) {
        for (let a = 0; a + 11 < data.length; a++) {
            const length = data[a];
            if (length < 2 || length > 32 || a + 1 + length + 8 > data.length) continue;
            let ok = true;
            for (let k = a + 1; k <= a + length; k++) if (!isNickByte(data[k])) { ok = false; break; }
            if (!ok) continue;
            const id = toHex(data, a + 1 + length);
            const nick = String.fromCharCode(...data.subarray(a + 1, a + 1 + length));
            // Вытесняем давно не встречавшиеся: настоящие ники приходят с каждым обновлением статистики
            const candidates = names.get(id) ?? new Map();
            names.delete(id);
            names.set(id, candidates);
            if (names.size > MAX_NAMES) names.delete(names.keys().next().value);
            const tail = a + 1 + length >= 8 ? toHex(data, a + 1 + length - 8) : "";
            const entry = candidates.get(nick);
            if (entry) entry.count++;
            else candidates.set(nick, { count: 1, tail });
            a += length;
        }
    }

    // [ID аугмента пушки | null, ID аугмента корпуса | null] или undefined, если раскладка незнакомая
    function readEquipment(data, at) {
        const start = at + EQUIPMENT_MODEL.length;
        const end = indexOf(data, EQUIPMENT_NEXT_MODEL, start, start + 8 * 7);
        if (end === -1 || (end - start) % 8 !== 0) return undefined;
        const values = [];
        for (let i = start; i < end; i += 8) values.push(toHex(data, i));
        if (values.length === 6) return [values[4], values[1]];
        if (values.length === 4) return [null, null];
        if (values.length === 5) return values[1] in devices ? [null, values[1]] : [values[3], null];
        return undefined;
    }

    const tanks = new Map(); // ID игрока -> [ID аугмента пушки, ID аугмента корпуса]

    function parse(data) {
        collectNames(data);
        let at = indexOf(data, EQUIPMENT_MODEL);
        while (at !== -1) {
            const first = lastIndexOf(data, TANK_FIRST_MODEL, at - TANK_SEARCH, at);
            // Объявление класса танка ([ffffffff 8000xxxx][число моделей] перед списком моделей) — не объект
            if (first >= 8 && !(data[first - 8] === 0x80 && data[first - 7] === 0x00)) {
                const equipment = readEquipment(data, at);
                if (equipment) tanks.set(toHex(data, first - 8), equipment);
            }
            at = indexOf(data, EQUIPMENT_MODEL, at + 1);
        }
        publish();
    }

    // Отдаём подписям всё, что можно сопоставить с ником; повторно — только изменения
    const published = new Map(); // ID игрока -> "ник|пушка|корпус"

    function nickOf(id) {
        let best = null;
        for (const [nick, { count, tail }] of names.get(id) ?? []) {
            if (tanks.has(tail) || names.has(tail)) continue;
            if (!best || count > best.count) best = { nick, count };
        }
        return best?.nick;
    }

    function publish() {
        const labels = globalThis.__augmentLabels;
        if (!labels?.packetEquipment) return;
        for (const [id, [turret, hull]] of tanks) {
            const nick = nickOf(id);
            if (!nick) continue;
            const stamp = `${nick}|${turret}|${hull}`;
            if (published.get(id) === stamp) continue;
            published.set(id, stamp);
            labels.packetEquipment(nick, [icon(turret), icon(hull)], [turret, hull]);
        }
    }

    // Пути иконок — относительно сервера статики, с которого загружен бандл игры
    function icon(id) {
        const path = id && devices[id];
        if (!path) return null;
        const script = document.querySelector('script[src*="/static/js/main."]');
        return new URL(path, script ? new URL("../../", script.src) : "https://s.eu.tankionline.com/").href;
    }

    // --- Сокеты ---

    async function inflate(bytes) {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    // Tanki Tweaks придерживает входящее событие и отправляет тот же ArrayBuffer повторно
    const seenBuffers = new WeakSet();

    function attach(socket, url) {
        let hostname;
        try {
            hostname = new URL(url).hostname;
        } catch {
            return;
        }
        if (!hostname.endsWith(".tankionline.com")) return;

        let cipher = null; // появится после хендшейка боевого пространства
        let handshakeDone = false;
        // Распаковка асинхронная, а порядок важен (последний объект танка — актуальный)
        let queue = Promise.resolve();

        const originalSend = socket.send;
        socket.send = function (data) {
            try {
                if (!handshakeDone) {
                    handshakeDone = true;
                    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null;
                    if (bytes && bytes.length >= 4 + SEED_SIZE + 8 && bytes[3] === SPACE_OPENED_ID) {
                        const spaceID = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(4 + SEED_SIZE);
                        // Боевое пространство: spaceID >> 61 == 1 (как kind "battle" в логгере)
                        if (spaceID >> 61n === 1n) {
                            cipher = new Cipher(bytes.slice(4, 4 + SEED_SIZE), spaceID);
                            tanks.clear();
                            published.clear();
                            globalThis.__augmentLabels?.packetBattle?.();
                        }
                    }
                }
            } catch (err) {
                console.warn("[augment-labels] handshake", err);
            }
            return originalSend.call(this, data);
        };

        socket.addEventListener("message", (event) => {
            const data = event.data;
            if (!cipher || !(data instanceof ArrayBuffer) || seenBuffers.has(data)) return;
            seenBuffers.add(data);
            try {
                const bytes = new Uint8Array(data.slice(0));
                cipher.decrypt(bytes);
                const body = bytes.subarray(bytes[0] & 0x80 ? 4 : 2);
                const compressed = !!(bytes[0] & 0x40) && body[0] === 0x78;
                queue = queue
                    .then(() => (compressed ? inflate(body) : body))
                    .then(parse)
                    .catch((err) => console.warn("[augment-labels] packet", err));
            } catch (err) {
                console.warn("[augment-labels] packet", err);
            }
        });
    }

    const NativeWebSocket = globalThis.WebSocket;
    function WebSocket(url, protocols) {
        const socket = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
        try {
            attach(socket, String(url));
        } catch (err) {
            console.warn("[augment-labels] attach", err);
        }
        return socket;
    }
    WebSocket.prototype = NativeWebSocket.prototype;
    Object.setPrototypeOf(WebSocket, NativeWebSocket);
    globalThis.WebSocket = WebSocket;

    globalThis.__augmentPackets = { names, tanks, parse, nickOf };
})();
