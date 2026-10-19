// Fast Garage: смена экипировки без интерфейса гаража. Работает в контексте страницы.
//
// Исходящий поток шифруется XOR с состоянием (см. packet-logger/logger.js), поэтому
// свой пакет нельзя просто вставить между пакетами игры. Каждый пакет игры
// расшифровывается копией её шифра и шифруется заново своим: без вставок байты
// совпадают с исходными, со вставками сервер видит согласованный поток.
//
// Команда в пространстве: [2 байта длины] 00 [ID объекта, 8][ID метода, 8][аргументы].
// Методы — docs/protocol-notes.md, раздел «Гараж».
//
// Входящие пакеты только читаем: что надето (пространство танка при входе + установки
// в гараже), а при открытии гаража — каталог, что есть у аккаунта (initDepot) и аугменты.
// См. «Надетые предметы», «Что есть у аккаунта», «Аугменты» в protocol-notes.
(() => {
    "use strict";

    if (globalThis.__fastGarage) return;

    const SPACE_OPENED_ID = 3;
    const SEED_SIZE = 32;
    const KEY_SIZE = 8;

    const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const fromHex = (text) => Uint8Array.from(text.match(/../g) ?? [], (h) => parseInt(h, 16));

    // Команды клиента (исходящие)
    const METHOD = {
        select: "428bfb19dd53066f",
        equip: "0efba8e4237e9e62",
        removeModule: "13bd1f690e8e7645",
        setModule: "7e05ca7d0b4c527e",
        augment: "34cae781db4181b0",
        itemInfo: "6c55682318abc9be",
    };
    // Команды, меняющие экипировку (пишем в журнал, если их шлёт сама игра)
    const CHANGES = new Set([METHOD.equip, METHOD.removeModule, METHOD.setModule, METHOD.augment]);
    // Признак пространства гаража: игра вызывает в нём эти методы
    const GARAGE_MARKERS = new Set(Object.values(METHOD));

    // Пространство лобби (одно и то же на всех серверах): открыть/закрыть экран гаража.
    // В бою пространство гаража живёт, только пока гараж открыт
    const LOBBY_SPACE = 0x5f7b228n;
    // Пространство гаража — тоже одно на всех серверах. Ловим его сразу при открытии: каталог (1,2 МБ)
    // приходит только через 2–3 с
    const GARAGE_SPACE = 0x5f6fe6en;
    const LOBBY = {
        openGarage: "34c5ea291fd022a2",
        closeGarage: "43e18b9407ff987f",
    };

    // Вызовы сервера (входящие)
    const SERVER = {
        loadClasses: fromHex("2ca2091458b7bc93"),  // объявления классов: [ID класса][int N][N моделей]
        loadObjects: fromHex("6a09fce46efe601a"),  // объекты: таблица (ID, класс), затем данные
        initDepot: fromHex("37765779edab9d85"),    // что есть у аккаунта
        initMounted: fromHex("333e60b71ea8e989"),  // что надето
        itemDevices: fromHex("69ae6b936905389a"),  // <предмет>.69ae…(аугменты предмета, надетый)
        tankStats: fromHex("4e1d212f726e8ddc"),    // характеристики танка (пространство 5f6fdcf), приходят после установки
    };

    const MODEL = {
        itemCategory: fromHex("1d57131a927722d4"),       // ItemCategoryCC [category]
        item3D: fromHex("67b1f230feef85f9"),             // Item3DCC [emissionColor, itemId, …]
        mountedResistances: fromHex("4f70cb4458b6f31e"), // MountedResistancesCC [resistances]
        modification: fromHex("229eb3028c438867"),       // ModificationCC [baseItemId, count, index]
        upgradeParams: fromHex("41d4896966965487"),      // UpgradeParamsCC [currentLevel, …]
        temporaryItem: fromHex("3609c166ab70a7ce"),      // TemporaryItemCC [infinityLifetimeItem, …]
        itemModel: fromHex("2fb806413211f807"),          // […, position (int32), ID картинки (ресурс)]
        rarity: fromHex("092484b2b12ba634"),             // ItemRarityCC: 0 особый, 1 легендарный, 2 эпический, 3 редкий
        delayMount: fromHex("62aa7d525acb2de9"),         // DelayMountCategoryCC [delayMountInSec]: в бою — сколько ещё нельзя менять
    };
    // ItemCategoryCC.category -> подпись, в порядке показа на панели
    const CATEGORIES = new Map([[0, "пушка"], [1, "корпус"], [17, "граната"], [14, "дрон"], [2, "краска"]]);
    // Что можно выбрать на панели
    const CHOOSABLE = [[0, "Пушки"], [1, "Корпуса"], [17, "Гранаты"], [14, "Дроны"]];
    const RESISTANCE = 10;
    const BIG_PACKET = 100_000;

    class Cipher {
        key = new Uint8Array(KEY_SIZE);
        position = 0;

        constructor(seed, spaceID, outbound) {
            let x = Number((spaceID >> 32n) & 0xffffffffn) ^ Number(spaceID & 0xffffffffn);
            const view = new DataView(seed.buffer, seed.byteOffset, seed.byteLength);
            for (let i = 0; i < SEED_SIZE / 4; i++) x ^= view.getInt32(4 * i);
            const base = ((x >>> 24) ^ (x >>> 16) ^ (x >>> 8) ^ x) & 0xff;
            for (let i = 0; i < KEY_SIZE; i++) this.key[i] = base ^ (i << 3) ^ (outbound ? 87 : 0);
        }

        decrypt(bytes) {
            for (let i = 0; i < bytes.length; i++) {
                this.key[this.position] ^= bytes[i];
                bytes[i] = this.key[this.position];
                this.position ^= 7 & this.key[this.position];
            }
        }

        encrypt(bytes) {
            for (let i = 0; i < bytes.length; i++) {
                const plain = bytes[i];
                bytes[i] = plain ^ this.key[this.position];
                this.key[this.position] = plain;
                this.position ^= 7 & plain;
            }
        }
    }

    function toBytes(data) {
        if (data instanceof ArrayBuffer) return new Uint8Array(data.slice(0));
        if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
        return null;
    }

    async function inflate(bytes) {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    // --- Разбор входящих данных ---

    function find(bytes, needle, from = 0, to = bytes.length) {
        const last = Math.min(to, bytes.length - needle.length);
        outer: for (let i = Math.max(from, 0); i <= last; i++) {
            for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
            return i;
        }
        return -1;
    }

    const at = (bytes, needle, offset) => find(bytes, needle, offset, offset) === offset;
    const readLong = (bytes, pos) => new DataView(bytes.buffer, bytes.byteOffset + pos, 8).getBigUint64(0);
    const readInt = (bytes, pos) => new DataView(bytes.buffer, bytes.byteOffset + pos, 4).getInt32(0);
    const key = (id) => id.toString(16);
    // ID предметов: 000000d6…, 000000d8…, 000001c1…
    const isItemID = (bytes, pos) => bytes[pos] === 0 && bytes[pos + 1] === 0 &&
        ((bytes[pos + 2] === 0 && (bytes[pos + 3] === 0xd6 || bytes[pos + 3] === 0xd8)) ||
            (bytes[pos + 2] === 1 && bytes[pos + 3] === 0xc1));

    // Начало данных после карты null (только длинные формы — у больших пакетов)
    function dataOffset(bytes) {
        if ((bytes[0] & 0xc0) === 0xc0) return 3 + (((bytes[0] & 0x3f) << 16) | (bytes[1] << 8) | bytes[2]);
        if (bytes[0] & 0x80) return 2 + (((bytes[0] & 0x3f) << 8) | bytes[1]);
        return -1;
    }

    // Длина списка: 1 байт, 2 с флагом 0x80 или 3 с 0xc0
    function readIDs(bytes, pos) {
        let count;
        if ((bytes[pos] & 0xc0) === 0xc0) {
            count = ((bytes[pos] & 0x3f) << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2];
            pos += 3;
        } else if (bytes[pos] & 0x80) {
            count = ((bytes[pos] & 0x3f) << 8) | bytes[pos + 1];
            pos += 2;
        } else {
            count = bytes[pos];
            pos += 1;
        }
        const ids = [];
        for (let k = 0; k < count && pos + 8 <= bytes.length; k++, pos += 8) ids.push(readLong(bytes, pos));
        return { ids, end: pos };
    }

    function callList(bytes, method) {
        const k = find(bytes, method);
        return k < 0 ? null : readIDs(bytes, k + 8).ids;
    }

    // ID моделей из объявлений классов — по ним находится начало данных объекта
    const models = new Set();
    function learnClasses(bytes) {
        const k = find(bytes, SERVER.loadClasses, 0, 64);
        if (k < 0 || k + 16 > bytes.length) return;
        const count = readInt(bytes, k + 12);
        let pos = k + 16;
        for (let n = 0; n < count && pos + 12 <= bytes.length; n++) {
            const size = readInt(bytes, pos + 8);
            if (size < 0 || size > 100) return;
            for (let i = 0; i < size; i++) models.add(hex(bytes.subarray(pos + 12 + 8 * i, pos + 20 + 8 * i)));
            pos += 12 + 8 * size;
        }
    }

    // Пакет объектов -> Map(ID -> данные). [space][6a09…][int N][N × (ID, класс)], затем данные в том же
    // порядке; каждый начинается со своего ID, за которым сразу ID модели (так отличаем от ID внутри данных).
    function splitObjects(bytes) {
        const data = dataOffset(bytes);
        if (data < 0 || !at(bytes, SERVER.loadObjects, data + 8)) return null;
        const count = readInt(bytes, data + 16);
        const table = data + 20;
        const records = new Map();
        let pos = table + 16 * count;
        let prev = null;
        for (let n = 0; n < count; n++) {
            const id = bytes.subarray(table + 16 * n, table + 16 * n + 8);
            let k = find(bytes, id, pos);
            while (k >= 0 && !models.has(hex(bytes.subarray(k + 8, k + 16)))) k = find(bytes, id, k + 1);
            if (k < 0) break;
            if (prev) records.set(prev.id, bytes.subarray(prev.start, k));
            prev = { id: readLong(bytes, table + 16 * n), start: k };
            pos = k + 8;
        }
        if (prev) records.set(prev.id, bytes.subarray(prev.start));
        return records;
    }

    const decoder = new TextDecoder("utf-8", { fatal: true });

    // Название записи каталога: строка [длина][текст] прямо перед ближайшим ItemCategoryCC
    function nameAfter(bytes, pos, limit) {
        const k = find(bytes, MODEL.itemCategory, pos, pos + limit);
        if (k < 0) return null;
        for (let n = 2; n < 80; n++) {
            if (bytes[k - n - 1] !== n) continue;
            try {
                const text = decoder.decode(bytes.subarray(k - n, k));
                if (!/[\x00-\x1f]/.test(text)) return text;
            } catch {
                // не UTF-8 — пробуем другую длину
            }
        }
        return null;
    }

    // Поля записи каталога, которые нужны панели
    function readRecord(id, seg) {
        const field = (model) => {
            const k = find(seg, model);
            return k < 0 ? -1 : k + 8;
        };
        const category = field(MODEL.itemCategory);
        const modification = field(MODEL.modification);
        const level = field(MODEL.upgradeParams);
        const temporary = field(MODEL.temporaryItem);
        const model = field(MODEL.itemModel);
        const rarity = field(MODEL.rarity);
        return {
            id,
            category: category < 0 ? null : readInt(seg, category),
            name: nameAfter(seg, 0, seg.length) ?? key(id),
            base: modification < 0 ? id : readLong(seg, modification), // ID MK1
            mk: modification < 0 ? null : seg[modification + 9] + 1,
            level: level < 0 ? 0 : readInt(seg, level),
            forever: temporary >= 0 && seg[temporary] === 1, // у аугментов: куплен
            position: model < 0 ? null : readInt(seg, model + 8), // порядок в гараже
            image: model < 0 ? null : key(readLong(seg, model + 12)),
            rarity: rarity < 0 ? null : seg[rarity + 3],
        };
    }

    // Объекты предметов: ItemCategoryCC [int32] Item3DCC [emissionColor, itemId]
    function itemObjects(bytes) {
        const out = [];
        for (let pos = find(bytes, MODEL.itemCategory); pos >= 0; pos = find(bytes, MODEL.itemCategory, pos + 1)) {
            if (!at(bytes, MODEL.item3D, pos + 12)) continue;
            const category = readInt(bytes, pos + 8);
            for (let k = pos + 20; k < pos + 60 && k + 8 <= bytes.length; k++) {
                if (isItemID(bytes, k)) {
                    out.push({ category, id: readLong(bytes, k) });
                    break;
                }
            }
        }
        return out;
    }

    // <предмет>.69ae…([ID аугментов], ID надетого или ничего)
    function deviceCalls(bytes) {
        const out = [];
        for (let k = find(bytes, SERVER.itemDevices); k >= 8; k = find(bytes, SERVER.itemDevices, k + 1)) {
            const { ids, end } = readIDs(bytes, k + 8);
            // За списком либо надетый, либо следующий вызов [предмет][69ae…], либо конец
            const mounted = end + 8 <= bytes.length && isItemID(bytes, end) && !at(bytes, SERVER.itemDevices, end + 8)
                ? readLong(bytes, end) : null;
            out.push({ item: readLong(bytes, k - 8), ids, mounted });
        }
        return out;
    }

    // Резисты по слотам из каталога. Объект гаража — первый в пакете, его биты в карте null
    // первые: бит 0 — сам список, затем по биту на слот (1 = пусто, в данных места не занимает).
    function mountedResistances(bytes) {
        if ((bytes[0] & 0xc0) !== 0xc0) return null;
        const map = bytes.subarray(3, 3 + (((bytes[0] & 0x3f) << 16) | (bytes[1] << 8) | bytes[2]));
        const bit = (i) => (map[i >> 3] >> (7 - (i & 7))) & 1;
        const pos = find(bytes, MODEL.mountedResistances);
        if (pos < 0 || bit(0)) return null;
        const slots = [];
        let next = pos + 9;
        for (let slot = 0; slot < bytes[pos + 8]; slot++) {
            if (bit(1 + slot)) {
                slots.push(null);
            } else {
                slots.push(readLong(bytes, next));
                next += 8;
            }
        }
        return slots;
    }

    // Объявления ресурсов (картинок): [ID 8][00 0a][2 байта, второй — тип][версия 8, 00 00 01 …]. Приходят маленькими
    // пакетами в пространствах танка и гаража; URL на сервере статики — ID и версия по частям в восьмеричной записи
    const resources = new Map(); // ID картинки (hex) -> URL
    const STATIC = "https://s.eu.tankionline.com/";
    function readResources(bytes) {
        for (let k = 0; k + 20 <= bytes.length; k++) {
            if (bytes[k + 9] !== 0x0a || bytes[k + 8] !== 0 || bytes[k + 12] !== 0 || bytes[k + 13] !== 0 || bytes[k + 14] !== 1) continue;
            const id = readLong(bytes, k);
            if (!id) continue;
            const hi = Number(id >> 32n), lo = Number(id & 0xffffffffn);
            const path = [hi, (lo >>> 16) & 0xffff, (lo >>> 8) & 0xff, lo & 0xff].map((n) => n.toString(8)).join("/");
            resources.set(key(id), `${STATIC}${path}/${readLong(bytes, k + 12).toString(8)}/image.${bytes[k + 11] === 14 ? "svg" : "webp"}`);
        }
    }
    // Картинка записи: URL запоминается в самой записи и уходит в кэш
    const iconOf = (record) => record ? (record.icon ??= (record.image && resources.get(record.image)) || undefined) ?? null : null;

    // --- Состояние ---

    const NAMES_KEY = "fast-garage.names";
    const state = {
        equipped: new Map(), // категория -> ID предмета (BigInt)
        slots: null,         // резисты по слотам: ID или null
        names: new Map(),    // ID (hex) -> название, запоминается между запусками
        items: new Map(),    // ID (hex) -> запись каталога (readRecord)
        depot: null,         // Set ID (hex) — что есть у аккаунта
        devices: new Map(),  // ID MK1 (hex) -> { ids: [аугменты], mounted }
        deviceInfo: new Map(), // ID аугмента (hex) -> запись (readRecord)
    };
    try {
        for (const [id, name] of Object.entries(JSON.parse(globalThis.localStorage?.getItem(NAMES_KEY) ?? "{}"))) {
            state.names.set(id, name);
        }
    } catch {
        // испорченная запись — начнём заново
    }

    function rememberNames(ids) {
        let changed = false;
        for (const id of ids) {
            const record = id === null ? null : state.items.get(key(id));
            if (record && state.names.get(key(id)) !== record.name) {
                state.names.set(key(id), record.name);
                changed = true;
            }
        }
        if (!changed) return;
        try {
            globalThis.localStorage?.setItem(NAMES_KEY, JSON.stringify(Object.fromEntries(state.names)));
        } catch {
            // нет места — названия просто не сохранятся
        }
    }

    function describe(method, payload) {
        const id = (offset) => readLong(payload, offset);
        if (method === METHOD.equip) return `установка ${nameOf(id(17))}`;
        if (method === METHOD.removeModule) return `снять ${nameOf(id(17))}`;
        if (method === METHOD.setModule) return `слот ${readInt(payload, 17) + 1}: ${nameOf(id(21))}`;
        return `${nameOf(id(1))} ← ${nameOf(id(17))}`;
    }

    // Журнал: когда и откуда обновлялись данные панели (для отладки), хранится вместе с кэшем
    const log = [];
    const LOG_SIZE = 12;
    function journal(text) {
        log.push({ time: Date.now(), text });
        if (log.length > LOG_SIZE) log.splice(0, log.length - LOG_SIZE);
        ui.update();
    }

    // Кэш гаража между запусками: свои предметы, надетое, резисты, купленные аугменты.
    // Панель открывается из него сразу; обновляется при каждом каталоге и своих установках
    const CACHE_KEY = "fast-garage.cache";
    const recordToJSON = (r) => ({ ...r, id: key(r.id), base: key(r.base) });
    const recordFromJSON = (r) => ({ ...r, id: BigInt("0x" + r.id), base: BigInt("0x" + r.base) });

    function saveCache() {
        if (!state.depot) return;
        const items = [...state.depot].map((id) => state.items.get(id)).filter(Boolean);
        const bases = new Set(items.map((r) => key(r.base)));
        const devices = {};
        const deviceInfo = new Map();
        for (const [base, d] of state.devices) {
            if (!bases.has(base)) continue;
            const ids = d.ids.filter((id) => state.deviceInfo.get(key(id))?.forever);
            for (const id of ids) deviceInfo.set(key(id), state.deviceInfo.get(key(id)));
            devices[base] = { ids: ids.map(key), mounted: d.mounted === null ? null : key(d.mounted) };
        }
        items.forEach(iconOf);
        deviceInfo.forEach(iconOf);
        const cache = {
            items: items.map(recordToJSON),
            depot: [...state.depot],
            equipped: Object.fromEntries([...state.equipped].map(([c, id]) => [c, key(id)])),
            slots: state.slots?.map((id) => (id === null ? null : key(id))) ?? null,
            devices,
            deviceInfo: [...deviceInfo.values()].map(recordToJSON),
            savedAt: Date.now(),
            log,
        };
        try {
            globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch {
            // нет места — останемся без кэша
        }
    }

    const clock = (time) => (time ? new Date(time).toLocaleTimeString("ru-RU") : "?");

    function loadCache() {
        try {
            const cache = JSON.parse(globalThis.localStorage?.getItem(CACHE_KEY) ?? "null");
            if (!cache) return;
            const big = (id) => (id === null ? null : BigInt("0x" + id));
            for (const r of cache.items) state.items.set(r.id, recordFromJSON(r));
            state.depot = new Set(cache.depot);
            for (const [c, id] of Object.entries(cache.equipped)) state.equipped.set(Number(c), big(id));
            state.slots = cache.slots?.map(big) ?? null;
            for (const [base, d] of Object.entries(cache.devices)) {
                state.devices.set(base, { ids: d.ids.map(big), mounted: big(d.mounted) });
            }
            for (const r of cache.deviceInfo) state.deviceInfo.set(r.id, recordFromJSON(r));
            // Кэш до 0.5.0: у аугментов нет картинок и редкости, а купленные могли остаться от другого аккаунта —
            // ждём свежий пакет аугментов
            if (cache.deviceInfo.some((r) => !("position" in r))) {
                state.devices.clear();
                state.deviceInfo.clear();
            }
            log.push(...(cache.log ?? []));
            log.push({ time: Date.now(), text: `кэш загружен (сохранён ${clock(cache.savedAt)})` });
        } catch (err) {
            console.warn("[fast-garage] cache", err);
        }
    }
    loadCache();

    const nameOf = (id) => state.items.get(key(id))?.name ?? state.deviceInfo.get(key(id))?.name ??
        state.names.get(key(id)) ?? key(id);

    // Свои предметы категории: по одному на предмет, старшая модификация из депо
    function owned(category) {
        if (!state.depot) return [];
        const best = new Map();
        for (const id of state.depot) {
            const record = state.items.get(id);
            if (!record || record.category !== category) continue;
            const current = best.get(key(record.base));
            if (!current || (record.mk ?? 0) > (current.mk ?? 0)) best.set(key(record.base), record);
        }
        return [...best.values()].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }

    function isEquipped(record) {
        const id = state.equipped.get(record.category);
        if (id === undefined) return false;
        return id === record.id || state.items.get(key(id))?.base === record.base;
    }

    // Купленные аугменты надетого предмета категории
    function equippedDevices(category) {
        const id = state.equipped.get(category);
        const record = id === undefined ? null : state.items.get(key(id));
        const devices = record && state.devices.get(key(record.base));
        if (!devices) return null;
        return {
            item: id,
            mounted: devices.mounted,
            list: devices.ids.filter((d) => state.deviceInfo.get(key(d))?.forever)
                .map((d) => state.deviceInfo.get(key(d))),
        };
    }

    function inventory() {
        const out = {};
        for (const [category, label] of CHOOSABLE) out[label] = owned(category);
        out.Резисты = owned(RESISTANCE);
        out.Аугменты = { пушка: equippedDevices(0), корпус: equippedDevices(1) };
        return out;
    }

    function readCatalog(payload) {
        state.slots = mountedResistances(payload);
        const records = splitObjects(payload);
        if (records) {
            const old = state.items;
            state.items = new Map();
            for (const [id, seg] of records) {
                const record = readRecord(id, seg);
                record.icon = old.get(key(id))?.icon;
                if (record.category !== null) state.items.set(key(id), record);
            }
        }
        const depot = callList(payload, SERVER.initDepot);
        if (depot) {
            const fresh = new Set(depot.map(key));
            // Депо со временем только растёт: пропало больше нескольких предметов — это другой аккаунт. Аугменты
            // хранятся по предмету, а предметы у аккаунтов общие — чужие купленные и надетые сбрасываем
            const lost = state.depot ? [...state.depot].filter((id) => !fresh.has(id)).length : 0;
            if (lost > 5) {
                state.devices.clear();
                journal(`каталог: другой аккаунт (${lost} предметов прежнего нет) — аугменты сброшены`);
            }
            state.depot = fresh;
        }
        for (const id of callList(payload, SERVER.initMounted) ?? []) {
            const record = state.items.get(key(id));
            if (record && CATEGORIES.has(record.category)) state.equipped.set(record.category, id);
        }
        rememberNames([...(depot ?? []), ...(state.slots ?? [])]);
    }

    function readDevicePacket(payload, records) {
        for (const [id, seg] of records) {
            const record = readRecord(id, seg);
            record.icon = state.deviceInfo.get(key(id))?.icon;
            state.deviceInfo.set(key(id), record);
        }
        for (const c of deviceCalls(payload)) state.devices.set(key(c.item), { ids: c.ids, mounted: c.mounted });
    }

    // Ставили по ID MK1 — сервер присылает объект текущей модификации, ID рядом
    const sameItem = (sent, got) => sent === got || (sent >> 8n === got >> 8n && got - sent < 16n && sent - got < 16n);

    let garage = null;          // соединение пространства гаража
    const spaces = new Map();   // ID пространства -> соединение

    class Connection {
        type = null; // null до хендшейка, затем "space" | "other"
        spaceID = null;
        gameCipher = null;    // копия шифра игры — расшифровывает её пакеты
        realCipher = null;    // шифр того, что реально уходит на сервер
        inboundCipher = null; // входящий поток (только читаем)
        incoming = Promise.resolve(); // разбор по порядку, распаковка асинхронная
        pendingEquip = [];    // ID из команд установки, ждём подтверждения
        isGarage = false;
        ready = false;        // гараж: сервер прислал первый пакет; раньше команды он молча игнорирует
        injected = false;     // в этом заходе в гараж мы уже отправляли свои команды

        constructor(socket, send) {
            this.socket = socket;
            this.send = send;
        }

        get isBattle() {
            return this.spaceID >> 61n === 1n;
        }

        // Пакет игры: вернуть байты, которые нужно отправить вместо него
        fromGame(bytes) {
            if (this.type === null) {
                this.handshake(bytes);
                return bytes;
            }
            if (this.type !== "space") return bytes;
            this.gameCipher.decrypt(bytes);
            try {
                this.inspect(bytes);
            } catch (err) {
                console.warn("[fast-garage] inspect", err);
            }
            this.realCipher.encrypt(bytes);
            return bytes;
        }

        handshake(bytes) {
            this.type = "other";
            if (bytes.length < 4 + SEED_SIZE + 8 || bytes[3] !== SPACE_OPENED_ID) return;
            const seed = bytes.slice(4, 4 + SEED_SIZE);
            this.spaceID = new DataView(bytes.buffer, bytes.byteOffset).getBigUint64(4 + SEED_SIZE);
            this.gameCipher = new Cipher(seed, this.spaceID, true);
            this.realCipher = new Cipher(seed, this.spaceID, true);
            this.inboundCipher = new Cipher(seed, this.spaceID, false);
            this.type = "space";
            spaces.set(this.spaceID, this);
            if (this.spaceID === GARAGE_SPACE) this.markGarage();
            if (this.isBattle) resetLock();
        }

        // Одна команда на пакет (так игра шлёт в гараже): [hdr 2] 00 [obj 8][method 8][args]
        inspect(plain) {
            if (plain[0] & 0x80 || plain.length < 2 + 17) return;
            const payload = plain.subarray(2);
            const method = hex(payload.subarray(9, 17));
            if (!GARAGE_MARKERS.has(method)) return;
            this.markGarage();
            this.track(method, payload);
            if (CHANGES.has(method)) {
                journal(`гараж игры: ${describe(method, payload)}`);
                if (inBattle() && !lockLeft()) lock.unknown = true;
            }
        }

        markGarage() {
            this.isGarage = true;
            if (garage !== this) {
                garage = this;
                ui.update();
            }
        }

        // Команды игры и свои меняют надетое одинаково
        track(method, payload) {
            if (method === METHOD.equip && payload.length >= 25) {
                this.pendingEquip.push(readLong(payload, 17));
            } else if (method === METHOD.setModule && payload.length >= 29 && state.slots) {
                const slot = readInt(payload, 17);
                if (slot >= 0 && slot < state.slots.length) state.slots[slot] = readLong(payload, 21);
            } else if (method === METHOD.removeModule && payload.length >= 25 && state.slots) {
                const id = readLong(payload, 17);
                state.slots = state.slots.map((s) => (s === id ? null : s));
            } else if (method === METHOD.augment && payload.length >= 25) {
                const record = state.items.get(key(readLong(payload, 1)));
                const devices = record && state.devices.get(key(record.base));
                if (devices) devices.mounted = readLong(payload, 17);
            } else {
                return;
            }
            ui.update();
        }

        fromServer(data) {
            if (this.type !== "space" || this.isBattle) return;
            const bytes = new Uint8Array(data.slice(0));
            this.inboundCipher.decrypt(bytes);
            const headerSize = bytes[0] & 0x80 ? 4 : 2;
            const body = bytes.subarray(headerSize);
            const compressed = !!(bytes[0] & 0x40) && body[0] === 0x78;
            const ready = compressed ? inflate(body) : Promise.resolve(body);
            this.incoming = this.incoming
                .then(() => ready)
                .then((payload) => this.received(payload))
                .catch((err) => console.warn("[fast-garage] server packet", err));
        }

        received(payload) {
            const started = performance.now();
            try {
                this.read(payload);
            } finally {
                globalThis.__packetLogger?.mark?.("fast-garage: разбор пакета", performance.now() - started);
            }
        }

        read(payload) {
            learnClasses(payload);
            if (payload.length < 200_000) readResources(payload);
            let changed = false;
            if (this.isGarage && !this.ready) {
                this.ready = true;
                changed = true;
            }
            if (payload.length >= BIG_PACKET) {
                if (find(payload, MODEL.mountedResistances) >= 0) {
                    // Каталог гаража: записи, резисты по слотам, initDepot/initMounted
                    this.markGarage();
                    this.keepOwnChanges(() => readCatalog(payload));
                    // Таймер в каталоге — на момент открытия гаража; после своих команд он устарел
                    if (!this.injected) readLock(payload);
                    catalogAt = Date.now();
                    journal(this.injected ? "гараж: каталог (предметы; надетое и резисты — наши, каталог устарел)"
                        : `гараж: каталог — ${state.depot?.size ?? 0} предметов, надетое, резисты`);
                    changed = true;
                } else if (this.isGarage && find(payload, SERVER.itemDevices) >= 0) {
                    // Пакет аугментов: записи + <предмет>.69ae… в конце
                    const records = splitObjects(payload);
                    if (records) {
                        this.keepOwnChanges(() => readDevicePacket(payload, records));
                        journal(this.injected ? "гараж: аугменты (надетые — наши)" : "гараж: аугменты");
                        changed = true;
                    }
                }
            } else if (this.isGarage) {
                // Окно аугментов: <предмет>.69ae…(пустой список, надетый)
                for (const c of deviceCalls(payload)) {
                    const devices = state.devices.get(key(c.item));
                    if (devices) {
                        devices.mounted = c.mounted;
                        if (c.ids.length) devices.ids = c.ids;
                        changed = true;
                    }
                }
                // Объект приходит и на просмотр/выбор — засчитываем только после установки
                for (const o of itemObjects(payload)) {
                    const n = this.pendingEquip.findIndex((id) => sameItem(id, o.id));
                    if (n < 0) continue;
                    state.equipped.set(o.category, o.id);
                    this.pendingEquip.splice(n, 1);
                    journal(`гараж: установка подтверждена — ${nameOf(o.id)}`);
                    changed = true;
                }
            } else {
                // Пространство танка при входе присылает весь комплект
                const objects = itemObjects(payload);
                // Надетого нет в кэше депо — кэш от другого аккаунта
                if (objects.length >= 3 && state.depot && objects.some((o) => o.category !== 2 && !state.depot.has(key(o.id)))) {
                    state.depot = null;
                    state.slots = null;
                    state.devices.clear();
                    journal("вход: надетого нет в кэше — кэш другого аккаунта, сброшен");
                }
                if (objects.length >= 3) state.equipped.clear();
                for (const o of objects) state.equipped.set(o.category, o.id);
                changed = objects.length > 0;
                if (changed) journal(`вход: надетое — ${objects.map((o) => nameOf(o.id)).join(", ")}`);
                // Без интерфейса гаража (в бою) объект предмета после установки не приходит —
                // подтверждение установки: новые характеристики танка
                if (find(payload, SERVER.tankStats) >= 0) {
                    statsAt = Date.now();
                    for (const id of garage?.pendingEquip.splice(0) ?? []) {
                        const record = state.items.get(key(id));
                        if (record?.category == null) continue;
                        state.equipped.set(record.category, id);
                        journal(`сервер: характеристики — установка ${nameOf(id)}`);
                        changed = true;
                    }
                }
            }
            if (changed) {
                rememberNames([...state.equipped.values()]);
                if (!applying) saveCache();
                ui.update();
            }
        }

        // Каталог и аугменты сервер собирает при открытии гаража, а приходят они через 1–2 с — после наших
        // команд, иногда и после закрытия. Тогда надетое, резисты и аугменты в них устаревшие: оставляем свои
        keepOwnChanges(read) {
            if (!this.injected) return read();
            const equipped = new Map(state.equipped);
            const slots = state.slots;
            const mounted = new Map([...state.devices].map(([base, d]) => [base, d.mounted]));
            read();
            state.equipped = equipped;
            if (slots) state.slots = slots;
            for (const [base, id] of mounted) {
                const devices = state.devices.get(base);
                if (devices) devices.mounted = id;
            }
        }

        inject(payload) {
            if (this.socket.readyState !== 1) throw new Error("соединение гаража закрыто");
            if (payload.length > 0x3fff) throw new Error("слишком длинная команда");
            const packet = new Uint8Array(2 + payload.length);
            packet[0] = payload.length >> 8;
            packet[1] = payload.length & 0xff;
            packet.set(payload, 2);
            globalThis.__packetLogger?.note({ fastGarage: "inject", plain: hex(packet) });
            this.injected = true;
            this.track(hex(payload.subarray(9, 17)), payload);
            this.realCipher.encrypt(packet);
            this.send.call(this.socket, packet);
        }
    }

    // Tanki Tweaks повторно отправляет тот же ArrayBuffer входящего пакета — не расшифровываем дважды
    const seenBuffers = new WeakSet();

    function attach(socket, url) {
        try {
            if (!new URL(url).hostname.endsWith(".tankionline.com")) return;
        } catch {
            return;
        }
        const conn = new Connection(socket, socket.send);
        socket.send = function (data) {
            const bytes = toBytes(data);
            if (!bytes) return conn.send.call(this, data);
            return conn.send.call(this, conn.fromGame(bytes));
        };
        socket.addEventListener("message", (event) => {
            const data = event.data;
            if (!(data instanceof ArrayBuffer) || seenBuffers.has(data)) return;
            seenBuffers.add(data);
            try {
                conn.fromServer(data);
            } catch (err) {
                console.warn("[fast-garage] server packet", err);
            }
        });
        socket.addEventListener("close", () => {
            if (conn.type === "space" && spaces.get(conn.spaceID) === conn) spaces.delete(conn.spaceID);
            if (conn.type === "space" && conn.isBattle) resetLock();
            if (garage === conn) {
                garage = null;
                ui.update();
            }
        });
    }

    const NativeWebSocket = globalThis.WebSocket;
    function WebSocket(url, protocols) {
        const socket = protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
        try {
            attach(socket, String(url));
        } catch (err) {
            console.warn("[fast-garage] attach", err);
        }
        return socket;
    }
    WebSocket.prototype = NativeWebSocket.prototype;
    Object.setPrototypeOf(WebSocket, NativeWebSocket);
    globalThis.WebSocket = WebSocket;

    // --- Команды ---

    const long = (id) => {
        const out = new Uint8Array(8);
        new DataView(out.buffer).setBigUint64(0, BigInt.asUintN(64, BigInt(id)));
        return out;
    };
    const int = (value) => {
        const out = new Uint8Array(4);
        new DataView(out.buffer).setInt32(0, value);
        return out;
    };

    function call(object, method, ...args) {
        if (!garage) throw new Error("гараж не открыт");
        if (!garage.ready) throw new Error("гараж ещё загружается");
        callIn(garage, object, method, ...args);
    }

    function callIn(conn, object, method, ...args) {
        const parts = [Uint8Array.of(0), long(object), fromHex(method), ...args];
        const payload = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
        let offset = 0;
        for (const part of parts) {
            payload.set(part, offset);
            offset += part.length;
        }
        conn.inject(payload);
    }

    function lobby(method) {
        const conn = spaces.get(LOBBY_SPACE);
        if (!conn || conn.socket.readyState !== 1) throw new Error("нет пространства лобби");
        callIn(conn, LOBBY_SPACE, method);
    }

    const space = () => garage?.spaceID;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Ждать условие (проверяем по таймеру — события приходят из разных соединений)
    async function waitFor(check, timeout, what) {
        const until = Date.now() + timeout;
        while (!check()) {
            if (Date.now() > until) throw new Error(what);
            await sleep(50);
        }
    }

    // --- Очередь: что выбрано на панели, применяется одним заходом в гараж ---

    const draft = {
        equip: new Map(),    // категория -> запись (старшая модификация из депо)
        slots: null,         // резисты по слотам (копия state.slots) или null — без изменений
        augments: new Map(), // ID MK1 предмета (hex) -> ID аугмента
        clear() {
            this.equip.clear();
            this.slots = null;
            this.augments.clear();
        },
        get empty() {
            return !this.equip.size && !this.slots && !this.augments.size;
        },
    };

    // Предмет категории с учётом очереди: запись своего предмета
    function chosen(category) {
        if (draft.equip.has(category)) return draft.equip.get(category);
        const id = state.equipped.get(category);
        const record = id === undefined ? null : state.items.get(key(id));
        return record ? owned(category).find((r) => r.base === record.base) ?? record : null;
    }

    // Купленные аугменты предмета (запись своего предмета) и надетый (с учётом очереди)
    function devicesOf(record) {
        const devices = record && state.devices.get(key(record.base));
        if (!devices) return null;
        const queued = draft.augments.get(key(record.base));
        return {
            mounted: queued ?? devices.mounted,
            list: devices.ids.filter((d) => state.deviceInfo.get(key(d))?.forever).map((d) => state.deviceInfo.get(key(d))),
        };
    }

    // Команды очереди в порядке отправки
    function plan() {
        const commands = [];
        for (const [category, record] of draft.equip) {
            commands.push({ text: `${record.name}`, send: () => {
                api.equip(record.id);
                state.equipped.set(category, record.id);
            } });
        }
        if (draft.slots && state.slots) {
            const before = state.slots.slice();
            const after = draft.slots.slice();
            // Сначала снимаем всё, что уходит из слота, потом ставим — резист может переехать в другой слот
            before.forEach((id, slot) => {
                if (id !== null && after[slot] !== id) {
                    commands.push({ text: `снять ${nameOf(id)}`, send: () => api.removeModule(id) });
                }
            });
            after.forEach((id, slot) => {
                if (id !== null && before[slot] !== id) {
                    commands.push({ text: `слот ${slot + 1}: ${nameOf(id)}`, send: () => api.setModule(slot, id) });
                }
            });
        }
        for (const [base, device] of draft.augments) {
            const record = owned(state.items.get(base)?.category).find((r) => key(r.base) === base);
            if (!record) continue;
            commands.push({ text: `${record.name} ← ${nameOf(device)}`, send: () => api.augment(record.id, device) });
        }
        return commands;
    }

    let applying = false;
    let statsAt = 0;   // когда пришли последние характеристики танка
    let catalogAt = 0; // когда пришёл последний каталог

    // Таймер смены в бою («Изменения доступны через …»). Сервер присылает остаток в каталоге (DelayMountCategoryCC,
    // секунды); после смены в бою отдельного сообщения нет — до следующего каталога таймер неизвестен.
    // Команды во время таймера сервер молча игнорирует. В лобби таймера нет
    const lock = { until: 0, unknown: false };
    const inBattle = () => [...spaces.values()].some((c) => c.isBattle);
    const lockLeft = () => Math.max(0, Math.ceil((lock.until - Date.now()) / 1000));
    const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    function readLock(payload) {
        const pos = find(payload, MODEL.delayMount);
        if (pos < 0) return;
        const sec = readInt(payload, pos + 8);
        lock.until = sec > 0 ? Date.now() + sec * 1000 : 0;
        lock.unknown = false;
        if (sec > 0) journal(`каталог: изменения доступны через ${mmss(sec)}`);
    }
    function resetLock() {
        if (!lock.until && !lock.unknown) return;
        lock.until = 0;
        lock.unknown = false;
        ui.update();
    }

    // Открыть гараж (если не открыт), отправить очередь, закрыть, если открывали сами
    // Возвращает "locked", если в бою идёт таймер смены — очередь тогда не тронута
    async function apply() {
        const commands = plan();
        if (!commands.length || applying) return;
        const battle = inBattle();
        const locked = () => {
            ui.status(`🔒 изменения доступны через ${mmss(lockLeft())}`, 4000);
            return "locked";
        };
        if (battle && lockLeft()) return locked();
        applying = true;
        let opened = false;
        try {
            ui.status(`⏳ ${commands.map((c) => c.text).join(", ")}`);
            const asked = Date.now();
            if (!garage) {
                api.openGarage();
                opened = true;
            }
            await waitFor(() => garage?.ready, 15000, "гараж не открылся");
            // В бою узнаём таймер из свежего каталога (1–3 с) до отправки
            if (battle && opened) {
                await waitFor(() => catalogAt > asked, 8000, "каталог не пришёл");
                if (lockLeft()) {
                    api.closeGarage();
                    return locked();
                }
            }
            const before = { equipped: new Map(state.equipped), slots: state.slots };
            draft.clear();
            const sent = Date.now();
            for (const command of commands) command.send();
            journal(`панель: ${commands.map((c) => c.text).join(", ")}`);
            // Ответ на установку — новые характеристики танка; закрывать раньше нельзя
            const answered = await waitFor(() => statsAt > sent, 3000, "сервер не ответил").then(() => true, () => false);
            if (opened) {
                await sleep(200);
                api.closeGarage();
            }
            if (battle && !answered) {
                // Сервер не принял — скорее всего, таймер смены (гараж был открыт, каталог старый)
                state.equipped = before.equipped;
                state.slots = before.slots;
                lock.unknown = true;
                ui.status("✗ сервер не принял — в бою действует таймер смены", 6000);
                return;
            }
            if (battle) lock.unknown = true;
            saveCache();
            ui.status(`✓ ${commands.map((c) => c.text).join(", ")}`, 4000);
        } catch (err) {
            console.warn("[fast-garage] apply", err);
            ui.status(`✗ ${err.message}`, 6000);
            if (opened && garage) api.closeGarage();
        } finally {
            applying = false;
            ui.update();
        }
    }

    const api = {
        get garage() { return garage ? garage.spaceID.toString(16) : null; },
        openGarage: () => lobby(LOBBY.openGarage),
        closeGarage: () => lobby(LOBBY.closeGarage),
        equip: (item) => call(space(), METHOD.equip, long(item)),
        removeModule: (module) => call(space(), METHOD.removeModule, long(module)),
        setModule: (slot, module) => call(space(), METHOD.setModule, int(slot), long(module)),
        augment: (item, augment) => call(item, METHOD.augment, long(augment)),
        // Своя команда в любое открытое пространство: payload без заголовка, hex
        send(spaceID, payload) {
            const conn = spaces.get(BigInt(spaceID));
            if (!conn || conn.socket.readyState !== 1) throw new Error("нет такого пространства");
            conn.inject(fromHex(payload));
        },
        apply,
        draft,
        // Таймер смены в бою: left — секунд (0 — можно), unknown — в бою уже меняли, остаток узнаем при открытии гаража
        lock: () => ({ left: inBattle() ? lockLeft() : 0, unknown: inBattle() && !lockLeft() && lock.unknown }),
        clock: mmss,
        inventory,
        journal: log,
        state,
        // для панели
        owned,
        nameOf,
        iconOf,
        key,
        RESISTANCE,
        ui: null,
    };
    globalThis.__fastGarage = api;

    // --- Панель — panel.js (грузится следом и регистрируется в api.ui) ---
    const ui = {
        update: () => api.ui?.update(),
        status: (text, hideAfter = 0) => api.ui?.status(text, hideAfter),
    };
})();
