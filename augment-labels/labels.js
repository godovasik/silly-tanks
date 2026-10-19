// Показывает аугменты пушки и корпуса игрока над его ником в бою.
//
// Данные приходят из packets.js (объекты танков в пакетах боя): packetEquipment(ник, [url пушки, url корпуса]).
// Отображение включается и выключается в настройках игры (переключатель рядом с настройками Tanki Tweaks).
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

    // Над танком пишется «[EB] grogir», а в пакетах ник идёт без тега клана.
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

    const ENABLED_KEY = "augment-labels.enabled";
    let enabled = true;
    try {
        enabled = localStorage.getItem(ENABLED_KEY) !== "false";
    } catch {}

    function setEnabled(value) {
        enabled = value;
        try {
            localStorage.setItem(ENABLED_KEY, String(value));
        } catch {}
        for (const nick of labels.keys()) refresh(nick);
    }

    // Переключатель в настройках игры — в том же виде, что у Tanki Tweaks
    const SETTINGS_BLOCK = ".GameSettingsStyle-gameSettingsBlock";
    const TWEAKS_SETTINGS = ".tt-settings-containter";
    const SETTINGS_CSS = `
.al-settings{display:flex;flex-direction:column;width:100%;margin-bottom:1.5em}
${TWEAKS_SETTINGS}+.al-settings{margin-top:-1.5em}
.al-setting{display:flex;align-items:center;justify-content:flex-start;width:100%;height:2.25em;margin-bottom:1.25em;cursor:pointer}
.al-switch{display:flex;align-items:center;box-sizing:border-box;width:2.75em;height:1.5em;border-radius:6.25rem;
  border:.063em solid hsla(0,0%,100%,.2);background-color:rgba(191,213,255,.25)}
.al-switch::before{content:"";position:relative;left:.25em;width:1rem;height:1rem;border-radius:50%;
  background:#bfd5ff;transition:all .2s ease 0s}
.al-setting label{margin:0 1em;color:hsla(0,0%,100%,.5);font-family:BaseFontRegular,FallbackFontRegular;
  font-size:1em;font-weight:400;line-height:normal;cursor:pointer}
.al-checked .al-switch{background-color:rgba(118,255,51,.25)}
.al-checked .al-switch::before{left:1.5em;background:#76ff33}
.al-checked label{color:#fff}`;

    // Язык как у Tanki Tweaks: язык игры, иначе язык системы
    function language() {
        const supported = ["en", "ru"];
        let game = null;
        try {
            game = localStorage.getItem("language_store_key")?.toLowerCase();
        } catch {}
        if (supported.includes(game)) return game;
        return navigator.languages.map((l) => l.split("-")[0].toLowerCase()).find((l) => supported.includes(l)) ?? "en";
    }

    function createSettings() {
        const container = document.createElement("div");
        container.className = "al-settings";
        const row = document.createElement("div");
        row.className = "al-setting";
        row.classList.toggle("al-checked", enabled);
        const toggle = document.createElement("span");
        toggle.className = "al-switch";
        const label = document.createElement("label");
        label.textContent = `[Augments] ${language() === "ru" ? "Показывать устройства над танками" : "Show augments above tanks"}`;
        row.append(toggle, label);
        row.addEventListener("click", () => {
            setEnabled(!enabled);
            row.classList.toggle("al-checked", enabled);
        });
        container.append(row);
        return container;
    }

    function injectSettings() {
        const block = document.querySelector(SETTINGS_BLOCK);
        if (!block) return;
        if (!document.getElementById("augment-labels-style")) {
            const style = document.createElement("style");
            style.id = "augment-labels-style";
            style.textContent = SETTINGS_CSS;
            document.head.append(style);
        }
        const ours = block.querySelector(":scope > .al-settings") ?? createSettings();
        // Сразу после блока Tanki Tweaks, если он есть (он может появиться и позже нашего)
        const tweaks = block.querySelector(`:scope > ${TWEAKS_SETTINGS}`);
        if (tweaks ? tweaks.nextElementSibling !== ours : !ours.isConnected) {
            if (tweaks) tweaks.after(ours);
            else block.append(ours);
        }
    }

    new MutationObserver(() => {
        try {
            injectSettings();
        } catch (err) {
            console.warn("[augment-labels] settings", err);
        }
    }).observe(document, { childList: true, subtree: true });

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
        const urls = enabled && equipment.get(nick);
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
    globalThis.__augmentLabels = { packetEquipment, packetBattle, setEnabled };
})();
