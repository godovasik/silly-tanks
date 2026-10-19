// Показывает аугменты пушки и корпуса игрока над его ником в бою.
//
// Данные приходят из packets.js (объекты танков в пакетах боя): packetEquipment(ник, [url пушки, url корпуса]).
// Отображение настраивается на вкладке «SILLY TANKS» в настройках игры (settings.js).
//
// Отрисовка: подпись над танком игра рисует на отдельном 2D-холсте (bold 22px RubikRegular,
// высота 37): measureText(ник) -> размеры холста -> fillText(ник) трижды (тень) -> пары «иконка + число».
// Потом холст один раз заливается в WebGL-текстуру и живёт весь бой (переживает респауны).
//
// Поэтому:
//   1. каждой подписи ника сразу даём холст выше на полосу сверху и такую же пустую снизу
//      (игра крепит подпись по центру — ник остаётся на месте), рисунок игры сдвигаем вниз;
//   2. перехватываем texImage2D и запоминаем, в какую текстуру залит холст подписи;
//   3. когда приходят новые данные (или догружается иконка, или меняется настройка), перерисовываем
//      верхнюю полосу и перезаливаем холст в ту же текстуру — размер не меняется, игра не замечает.
(() => {
    "use strict";

    if (globalThis.__augmentLabels) return;

    const ICON_SIZE = 24;
    const ICON_GAP = 4;
    const ICON_ROW = ICON_SIZE + 2;
    const LABEL_HEIGHT = 37;
    const TALL_HEIGHT = LABEL_HEIGHT + 2 * ICON_ROW;
    // SVG иконок игры полупрозрачные (opacity 0.6); каждый повтор поверх добавляет плотности:
    // 1 проход = 0.6, 2 = 0.84, 3 = 0.94
    const ICON_PASSES = 2;
    // «–» на месте отсутствующего аугмента: цвет примерно как у иконок после ICON_PASSES
    const DASH_FONT = "bold 20px RubikRegular, sans-serif";
    const DASH_COLOR = "rgba(255, 255, 255, 0.84)";

    // Над танком пишется «[TAG] nick», а в пакетах ник идёт без тега клана.
    // В никах нет пробелов и скобок — сравниваем без них и без тега.
    const normalize = (nick) => nick.replace(/\s+/g, "").replace(/^\[[^\]]*\]/, "");
    const isLabelFont = (font) => font.includes("22px") && font.includes("RubikRegular");
    // Числа рядом с иконками в той же подписи рисуются тем же шрифтом — их не трогаем
    const isNickname = (text) => typeof text === "string" && !/^\d+$/.test(text);

    // --- Иконки: одна загрузка на URL ---

    const images = new Map(); // url -> HTMLImageElement

    function image(url) {
        let img = images.get(url);
        if (!img) {
            img = new Image();
            // Сервер иконок отдаёт CORS *, так что холст подписи не «пачкается»
            // и игра сможет загрузить его в WebGL как текстуру.
            img.crossOrigin = "anonymous";
            img.onload = () => {
                for (const [nick, urls] of equipment) if (urls.includes(url)) refresh(nick);
            };
            img.onerror = () => console.warn("[augment-labels] icon failed to load", url);
            img.src = url;
            images.set(url, img);
        }
        return img;
    }

    const isLoaded = (img) => img.complete && img.naturalWidth > 0;

    // --- Данные ---

    // ник -> [url аугмента пушки | null, url аугмента корпуса | null]
    const equipment = new Map();

    const sameUrls = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

    // Вызывается из packets.js при входе в бой, заходе игрока и переодевании
    function packetEquipment(rawNick, urls) {
        const nick = normalize(rawNick);
        if (sameUrls(equipment.get(nick), urls)) return;
        equipment.set(nick, urls);
        for (const url of urls) if (url) image(url);
        refresh(nick);
    }

    // Новое боевое пространство: данные прошлого боя больше не нужны
    function packetBattle() {
        const nicks = [...equipment.keys()];
        equipment.clear();
        for (const nick of nicks) refresh(nick);
    }

    // --- Настройка ---
    // Вкладка «SILLY TANKS» в настройках игры (settings.js): вкл/выкл и режим —
    // всегда, пока зажата клавиша или переключение клавишей.

    const settings = globalThis.__sillySettings;
    const config = () => settings?.get().labels ?? { enabled: true, mode: "always", key: null };
    let held = false; // клавиша зажата (hold)
    let toggled = false; // показ включён клавишей (toggle)

    function visible() {
        const { enabled, mode } = config();
        if (!enabled) return false;
        if (mode === "hold") return held;
        if (mode === "toggle") return toggled;
        return true;
    }

    let shown = visible();
    function update() {
        if (visible() === shown) return;
        shown = !shown;
        for (const nick of labels.keys()) refresh(nick);
    }

    settings?.on(update);
    // Клавиша не перехватывается: игра получает её как обычно (Tab — таблица боя)
    if (typeof addEventListener === "function") {
        addEventListener("keydown", (e) => {
            const { mode, key } = config();
            if (e.code !== key || settings.capturing || settings.typing(e)) return;
            if (mode === "hold") held = true;
            else if (mode === "toggle" && !e.repeat) toggled = !toggled;
            update();
        }, true);
        addEventListener("keyup", (e) => {
            if (e.code !== config().key) return;
            held = false;
            update();
        }, true);
        // Отпустили клавишу вне окна — keyup не придёт
        addEventListener("blur", () => {
            held = false;
            update();
        });
    }

    // --- Подписи ---

    // Холст подписи -> { canvas, nick, x, uploads: [...] }. Заводится при измерении ника,
    // x — при первой отрисовке, uploads — при заливке в текстуру.
    const labelOf = new WeakMap();
    // ник -> Set подписей, которые залиты в живые текстуры (нужны для перезаливки)
    const labels = new Map();

    // Слоты над ником: для известного игрока всегда два (аугмент пушки, аугмент корпуса).
    // Значение слота: картинка, DASH (аугмента нет) или null (иконка ещё грузится).
    const DASH = "dash";

    function slotsFor(nick) {
        const urls = shown && equipment.get(nick);
        if (!urls) return [];
        return urls.map((url) => {
            if (!url) return DASH;
            const img = image(url);
            return isLoaded(img) ? img : null;
        });
    }

    // Перерисовывает верхнюю полосу холста: стирает старое и кладёт актуальные слоты
    // по центру всей подписи (вместе со значком звания и защитой), а не только ника
    function paint(canvas, label) {
        if (label.x === null) return;
        const ctx = canvas.getContext("2d");
        const slots = slotsFor(label.nick);
        const rowWidth = slots.length * ICON_SIZE + Math.max(0, slots.length - 1) * ICON_GAP;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, ICON_ROW);
        ctx.shadowBlur = 0;
        let slotX = (canvas.width - rowWidth) / 2;
        for (const slot of slots) {
            if (slot === DASH) {
                ctx.font = DASH_FONT;
                ctx.fillStyle = DASH_COLOR;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                nativeFillText.call(ctx, "–", slotX + ICON_SIZE / 2, 1 + ICON_SIZE / 2);
            } else if (slot) {
                for (let pass = 0; pass < ICON_PASSES; pass++) ctx.drawImage(slot, slotX, 1, ICON_SIZE, ICON_SIZE);
            }
            slotX += ICON_SIZE + ICON_GAP;
        }
        ctx.restore();
    }

    function refresh(nick) {
        for (const label of labels.get(nick) ?? []) {
            try {
                paint(label.canvas, label);
                for (const upload of label.uploads) reupload(upload, label.canvas);
            } catch (err) {
                console.warn("[augment-labels] refresh", err);
            }
        }
    }

    const proto = CanvasRenderingContext2D.prototype;
    const nativeMeasureText = proto.measureText;
    const nativeFillText = proto.fillText;

    proto.measureText = function (text) {
        try {
            const canvas = this.canvas;
            if (canvas && !labelOf.has(canvas) && isLabelFont(this.font) && isNickname(text)) {
                labelOf.set(canvas, { canvas, nick: normalize(text), x: null, uploads: [] });
            }
        } catch (err) {
            console.warn("[augment-labels] measureText", err);
        }
        return nativeMeasureText.call(this, text);
    };

    // Игра ставит высоту после измерений; установка размера сбрасывает состояние контекста,
    // поэтому сдвиг вниз применяем сразу после неё — дальше игра трансформацию не трогает.
    const heightDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "height");
    Object.defineProperty(HTMLCanvasElement.prototype, "height", {
        ...heightDescriptor,
        set(value) {
            if (value === LABEL_HEIGHT && labelOf.has(this)) {
                heightDescriptor.set.call(this, TALL_HEIGHT);
                this.getContext("2d").translate(0, ICON_ROW);
                return;
            }
            heightDescriptor.set.call(this, value);
        },
    });

    proto.fillText = function (text, x, y, ...rest) {
        const result = nativeFillText.call(this, text, x, y, ...rest);
        try {
            const label = this.canvas && labelOf.get(this.canvas);
            // Ник рисуется трижды (тень) — геометрию берём с первого раза
            if (label && label.x === null && this.canvas.height === TALL_HEIGHT && isNickname(text)) {
                label.x = x;
                paint(this.canvas, label);
            }
        } catch (err) {
            console.warn("[augment-labels] fillText", err);
        }
        return result;
    };

    // --- WebGL: какая текстура у подписи ---

    let reuploading = false;
    const uploadOfTexture = new WeakMap(); // WebGLTexture -> { label, upload }

    function reupload(upload, canvas) {
        const { gl, texture, target, level, internalFormat, format, type, flipY, premultiply } = upload;
        if (gl.isContextLost() || !gl.isTexture(texture)) return;
        const binding = target === gl.TEXTURE_2D ? gl.TEXTURE_BINDING_2D : null;
        if (binding === null) return;
        // Сохраняем и восстанавливаем всё, что трогаем, чтобы не сломать рендер игры
        const previousTexture = gl.getParameter(binding);
        const previousFlipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
        const previousPremultiply = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL);
        reuploading = true;
        try {
            gl.bindTexture(target, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
            gl.texImage2D(target, level, internalFormat, format, type, canvas);
            const minFilter = gl.getTexParameter(target, gl.TEXTURE_MIN_FILTER);
            const mipmapped = minFilter !== gl.NEAREST && minFilter !== gl.LINEAR;
            if (mipmapped && level === 0) gl.generateMipmap(target);
        } finally {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, previousFlipY);
            gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, previousPremultiply);
            gl.bindTexture(target, previousTexture);
            reuploading = false;
        }
    }

    function forget(texture) {
        const entry = uploadOfTexture.get(texture);
        if (!entry) return;
        uploadOfTexture.delete(texture);
        const { label, upload } = entry;
        label.uploads = label.uploads.filter((u) => u !== upload);
        if (label.uploads.length === 0) labels.get(label.nick)?.delete(label);
    }

    function hookWebGL(Context) {
        if (!Context) return;
        const nativeTexImage2D = Context.prototype.texImage2D;
        const nativeDeleteTexture = Context.prototype.deleteTexture;

        Context.prototype.texImage2D = function (...args) {
            // Форма с источником-картинкой: (target, level, internalFormat, format, type, source)
            const label = !reuploading && args.length === 6 && args[5] ? labelOf.get(args[5]) : undefined;
            // Игра заливает подпись в текстуру не сразу, а когда танк впервые попадает в кадр —
            // к этому моменту данные могли появиться или поменяться. Дорисовываем актуальное.
            try {
                if (label) paint(args[5], label);
            } catch (err) {
                console.warn("[augment-labels] texImage2D paint", err);
            }
            const result = nativeTexImage2D.apply(this, args);
            try {
                if (!reuploading && args[0] === this.TEXTURE_2D) {
                    const texture = this.getParameter(this.TEXTURE_BINDING_2D);
                    // Игра могла залить в ту же текстуру что-то другое — старая связь больше не верна,
                    // иначе при перезаливке мы вернём в текстуру прежнюю подпись
                    const known = texture && uploadOfTexture.get(texture);
                    if (known && known.label !== label) forget(texture);
                    if (label && texture && !uploadOfTexture.has(texture)) {
                        const upload = {
                            gl: this, texture, target: args[0], level: args[1], internalFormat: args[2],
                            format: args[3], type: args[4],
                            flipY: this.getParameter(this.UNPACK_FLIP_Y_WEBGL),
                            premultiply: this.getParameter(this.UNPACK_PREMULTIPLY_ALPHA_WEBGL),
                        };
                        label.uploads.push(upload);
                        uploadOfTexture.set(texture, { label, upload });
                        if (!labels.has(label.nick)) labels.set(label.nick, new Set());
                        labels.get(label.nick).add(label);
                    }
                }
            } catch (err) {
                console.warn("[augment-labels] texImage2D", err);
            }
            return result;
        };

        Context.prototype.deleteTexture = function (texture) {
            try {
                forget(texture);
            } catch (err) {
                console.warn("[augment-labels] deleteTexture", err);
            }
            return nativeDeleteTexture.call(this, texture);
        };
    }
    hookWebGL(globalThis.WebGLRenderingContext);
    hookWebGL(globalThis.WebGL2RenderingContext);

    // Мост для packets.js
    globalThis.__augmentLabels = { packetEquipment, packetBattle };
})();
