// Настройки Silly Tanks: хранение и вкладка «SILLY TANKS» в меню настроек игры.
//
// Хранятся одним объектом в localStorage["silly-tanks.settings"]; модули читают их через
// globalThis.__sillySettings: get() — текущие, set(раздел, изменения), on(fn) — подписка на изменения.
//
// Вкладка: меню настроек игры — React-компоненты (классы SettingsMenuComponentStyle-*, в бандле
// main.289a5d50.js: menuItemOptions, activeItemOptions, yellowLineMenuOptions, slideMenuOptions).
// Свой пункт — копия неактивного пункта игры (без её обработчиков) в конце списка, перед <li> жёлтой полоски. Пока он выбран,
// содержимое вкладки игры прячется классом на его контейнере, а рядом стоит наша панель; классы
// элементов игры не меняем (React перезаписал бы их) — подсветку её активного пункта гасим CSS.
// Клик по любому пункту игры возвращает её вкладку.
(() => {
    "use strict";

    if (globalThis.__sillySettings) return;

    const STORAGE_KEY = "silly-tanks.settings";
    const DEFAULTS = {
        // mode: always — всегда; hold — пока зажата клавиша; toggle — клавиша включает и выключает
        labels: { enabled: true, mode: "always", key: "AltLeft" },
        // key: открыть панель / применить и закрыть; closeKey: закрыть без применения (null — без клавиши)
        garage: { enabled: true, key: "Backquote", closeKey: "Escape" },
    };

    function load() {
        const settings = structuredClone(DEFAULTS);
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
            if (saved) {
                // До 0.7.4 по умолчанию был Tab — сохранился и у тех, кто его не выбирал
                if (!saved.version && saved.labels?.key === "Tab") delete saved.labels.key;
                for (const section of Object.keys(settings)) Object.assign(settings[section], saved[section]);
            } else if (localStorage.getItem("augment-labels.enabled") === "false") {
                // Переключатель augment-labels до 0.7.0
                settings.labels.enabled = false;
            }
        } catch {}
        return settings;
    }

    const settings = load();
    const listeners = new Set();
    let capturing = null; // { section, field } — на вкладке ждём клавишу

    function set(section, changes) {
        Object.assign(settings[section], changes);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...settings }));
        } catch {}
        for (const fn of listeners) {
            try {
                fn(settings);
            } catch (err) {
                console.warn("[silly-tanks] settings listener", err);
            }
        }
    }

    // Язык как у Tanki Tweaks: язык игры, иначе язык системы. Интерфейс модулей — ru или en (остальные языки — en)
    const LANGUAGES = ["en", "ru"];
    function gameLanguage() {
        try {
            return localStorage.getItem("language_store_key")?.toLowerCase() || null;
        } catch {
            return null;
        }
    }
    function language() {
        const game = gameLanguage();
        if (LANGUAGES.includes(game)) return game;
        return (globalThis.navigator?.languages ?? []).map((l) => l.split("-")[0].toLowerCase()).find((l) => LANGUAGES.includes(l)) ?? "en";
    }

    const KEY_NAMES = {
        Backquote: "`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Backslash: "\\",
        Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Space: "Space",
        ShiftLeft: "L Shift", ShiftRight: "R Shift", ControlLeft: "L Ctrl", ControlRight: "R Ctrl",
        AltLeft: "Alt", AltRight: "R Alt", Escape: "Esc", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
        CapsLock: "Caps Lock",
    };
    function keyName(code) {
        if (!code) return "—";
        if (KEY_NAMES[code]) return KEY_NAMES[code];
        return code.replace(/^Key|^Digit/, "").replace(/^Numpad/, "Num ");
    }

    // Для обработчиков клавиш: нажатие в поле ввода — не нам
    function typing(e) {
        const target = e.composedPath?.()[0] ?? e.target;
        return !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
    }

    globalThis.__sillySettings = {
        get: () => settings,
        set,
        on: (fn) => listeners.add(fn),
        keyName,
        typing,
        // Язык интерфейса: "ru" | "en"; tr({ ru, en }) — строка на нём
        get lang() { return language(); },
        tr: (texts) => texts[language()] ?? texts.en,
        // Язык игры как есть (у комбо isra — поле language; названия предметов приходят на нём)
        get gameLang() { return gameLanguage() ?? language(); },
        // Идёт назначение клавиши на вкладке — горячие клавиши модулей молчат
        get capturing() { return capturing !== null; },
    };

    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;

    // ---------- вкладка ----------

    const ITEM = "SettingsMenuComponentStyle-menuItemOptions";
    const ACTIVE = "SettingsMenuComponentStyle-activeItemOptions";
    const YELLOW = "SettingsMenuComponentStyle-yellowLineMenuOptions";
    const SLIDE = "SettingsMenuComponentStyle-slideMenuOptions";
    // Правая часть (рядом с <ul> меню, вместе внутри SettingsComponentStyle-blockContentOptions)
    const CONTENT = "SettingsComponentStyle-containerBlock";

    const CSS = `
.st-tab{cursor:pointer}
.st-tab.st-on,.st-tab.st-on *{color:#fff!important}
.st-menu>.${SLIDE}{translate:0 calc((var(--st-shift,0) - 1) * var(--st-pitch,0px))}
.st-was-active>span{color:var(--st-off-color,hsla(0,0%,100%,.6))!important}
.st-content-hidden>:not(.st-pane){display:none!important}
.st-pane{box-sizing:border-box;width:100%;padding:0 1em 2em;color:#fff;font-family:BaseFontRegular,FallbackFontRegular,sans-serif;font-size:1em}
.st-pane h2{margin:0 0 1em;font-family:RubikBold,BaseFontBold,sans-serif;font-size:1.25em;font-weight:700;letter-spacing:.02em;color:#fff}
.st-pane h2:not(:first-child){margin-top:1.5em}
.st-row{display:flex;align-items:center;min-height:2.25em;margin-bottom:1em}
.st-label{flex:0 0 13em;color:hsla(0,0%,100%,.5)}
.st-toggle{cursor:pointer}
.st-switch{display:flex;align-items:center;flex:none;box-sizing:border-box;width:2.75em;height:1.5em;border-radius:6.25rem;
  border:.063em solid hsla(0,0%,100%,.2);background-color:rgba(191,213,255,.25)}
.st-switch::before{content:"";position:relative;left:.25em;width:1rem;height:1rem;border-radius:50%;background:#bfd5ff;transition:all .2s ease 0s}
.st-toggle .st-text{margin:0 1em;color:hsla(0,0%,100%,.5)}
.st-checked .st-switch{background-color:rgba(118,255,51,.25)}
.st-checked .st-switch::before{left:1.5em;background:#76ff33}
.st-checked .st-text{color:#fff}
.st-choices{display:flex;gap:.5em}
.st-choice,.st-key{box-sizing:border-box;height:2.25em;white-space:nowrap;padding:0 1em;border:.063em solid hsla(0,0%,100%,.2);border-radius:.25em;
  background:rgba(191,213,255,.08);color:hsla(0,0%,100%,.6);font:inherit;cursor:pointer}
.st-choice:hover,.st-key:hover{border-color:hsla(0,0%,100%,.45);color:#fff}
.st-choice.st-sel{border-color:#76ff33;background:rgba(118,255,51,.15);color:#fff}
.st-key{min-width:7em;color:#fff;font-family:RubikBold,BaseFontBold,sans-serif}
.st-key.st-wait{border-color:#ffbc09;color:#ffbc09}
.st-clear{margin-left:.5em;padding:0 .6em;background:none;border:none;color:hsla(0,0%,100%,.4);font:inherit;cursor:pointer}
.st-clear:hover{color:#fff}
.st-hint{margin:-.5em 0 1em 13em;color:hsla(0,0%,100%,.4);font-size:.85em}
.st-warn{color:#ffbc09}
.st-off{opacity:.4;pointer-events:none}`;

    const TEXT = {
        ru: {
            tab: "SILLY TANKS",
            labels: "Устройства над танками",
            labelsOn: "Показывать устройства над танками",
            mode: "Когда показывать",
            always: "Всегда",
            hold: "Пока зажата клавиша",
            toggle: "Переключать клавишей",
            key: "Клавиша",
            garage: "Быстрый гараж",
            garageOn: "Быстрый гараж включён",
            garageKey: "Открыть / применить",
            garageClose: "Закрыть без применения",
            press: "Нажмите клавишу…",
            pressHint: "Backspace — без клавиши, клик по кнопке — отмена",
            clear: "Убрать клавишу",
            conflict: (what) => `Эта клавиша уже назначена: ${what}`,
            labelsHint: "Клавиша не блокируется для игры: она сработает и там, если назначена",
        },
        en: {
            tab: "SILLY TANKS",
            labels: "Augments above tanks",
            labelsOn: "Show augments above tanks",
            mode: "When to show",
            always: "Always",
            hold: "While key is held",
            toggle: "Toggle with key",
            key: "Key",
            garage: "Fast garage",
            garageOn: "Fast garage enabled",
            garageKey: "Open / apply",
            garageClose: "Close without applying",
            press: "Press a key…",
            pressHint: "Backspace — no key, click the button — cancel",
            clear: "Remove key",
            conflict: (what) => `This key is already used: ${what}`,
            labelsHint: "The key still reaches the game and works there too if bound",
        },
    };

    let text = TEXT.en;
    let tab = null; // наш пункт меню
    let pane = null; // наша панель
    let active = false;
    let dumped = false;

    function el(tag, attrs = {}, ...children) {
        const node = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
            else node.setAttribute(k, v);
        }
        node.append(...children.flat().filter((c) => c !== null && c !== undefined));
        return node;
    }

    function toggleRow(on, label, onClick) {
        const row = el("div", { class: `st-row st-toggle${on ? " st-checked" : ""}`, onclick: onClick },
            el("span", { class: "st-switch" }), el("span", { class: "st-text" }, label));
        return row;
    }

    // Кому ещё назначена клавиша (среди наших функций)
    function usedBy(section, field, code) {
        if (!code) return null;
        const bindings = [
            ["labels", "key", text.labels, settings.labels.enabled && settings.labels.mode !== "always"],
            ["garage", "key", text.garage, settings.garage.enabled],
            ["garage", "closeKey", text.garage, settings.garage.enabled],
        ];
        const other = bindings.find(([s, f, , on]) => on && !(s === section && f === field) && settings[s][f] === code);
        return other?.[2] ?? null;
    }

    function keyRow(label, section, field, disabled) {
        const code = settings[section][field];
        const waiting = capturing?.section === section && capturing?.field === field;
        const conflict = usedBy(section, field, code);
        return [
            el("div", { class: `st-row${disabled ? " st-off" : ""}` },
                el("span", { class: "st-label" }, label),
                el("button", { class: `st-key${waiting ? " st-wait" : ""}`, onclick: () => { capturing = waiting ? null : { section, field }; render(); } },
                    waiting ? text.press : keyName(code)),
                code && !waiting ? el("button", { class: "st-clear", title: text.clear, onclick: () => { set(section, { [field]: null }); render(); } }, "✕") : null),
            waiting ? el("div", { class: "st-hint" }, text.pressHint)
                : conflict && !disabled ? el("div", { class: "st-hint st-warn" }, text.conflict(conflict)) : null,
        ];
    }

    function render() {
        if (!pane) return;
        const { labels, garage } = settings;
        const choice = (mode) => el("button", {
            class: `st-choice${labels.mode === mode ? " st-sel" : ""}`,
            onclick: () => { set("labels", { mode }); render(); },
        }, text[mode]);
        pane.replaceChildren(...[
            el("h2", {}, text.labels),
            toggleRow(labels.enabled, text.labelsOn, () => { set("labels", { enabled: !labels.enabled }); render(); }),
            el("div", { class: `st-row${labels.enabled ? "" : " st-off"}` },
                el("span", { class: "st-label" }, text.mode),
                el("div", { class: "st-choices" }, choice("always"), choice("hold"), choice("toggle"))),
            keyRow(text.key, "labels", "key", !labels.enabled || labels.mode === "always"),
            labels.enabled && labels.mode !== "always" ? el("div", { class: "st-hint" }, text.labelsHint) : null,
            el("h2", {}, text.garage),
            toggleRow(garage.enabled, text.garageOn, () => { set("garage", { enabled: !garage.enabled }); render(); }),
            keyRow(text.garageKey, "garage", "key", !garage.enabled),
            keyRow(text.garageClose, "garage", "closeKey", !garage.enabled),
        ].flat().filter(Boolean));
    }

    // Назначение клавиши: перехватываем нажатие раньше игры и модулей
    addEventListener("keydown", (e) => {
        if (!capturing) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        const { section, field } = capturing;
        capturing = null;
        if (e.code === "Backspace" || e.code === "Delete") set(section, { [field]: null });
        else set(section, { [field]: e.code });
        render();
    }, true);
    addEventListener("keyup", (e) => {
        if (capturing) e.stopImmediatePropagation();
    }, true);

    function activate() {
        const menu = tab.parentElement;
        const content = document.querySelector(`.${CONTENT}`);
        if (!menu || !content) return;
        active = true;
        // Цвет текста неактивного пункта — для гашения активного пункта игры
        const idle = [...menu.children].find((c) => c !== tab && c.classList.contains(ITEM) && !c.classList.contains(ACTIVE));
        const idleText = idle?.querySelector("span") ?? idle;
        if (idleText) menu.style.setProperty("--st-off-color", getComputedStyle(idleText).color);
        for (const c of menu.children) if (c !== tab && c.classList.contains(ACTIVE)) c.classList.add("st-was-active");
        tab.classList.add("st-on");
        // Подсветка игры (полоска) — на наш пункт: сдвиг в строках от активного пункта игры
        const rows = [...menu.children].filter((c) => c.classList.contains(ITEM));
        const gameActive = rows.findIndex((c) => c !== tab && c.classList.contains(ACTIVE));
        if (gameActive >= 0) menu.style.setProperty("--st-shift", rows.indexOf(tab) - gameActive);
        pane ??= el("div", { class: "st-pane" });
        content.classList.add("st-content-hidden");
        content.append(pane);
        content.scrollTop = 0;
        render();
    }

    function deactivate() {
        active = false;
        capturing = null;
        tab?.classList.remove("st-on");
        tab?.parentElement?.style.removeProperty("--st-shift");
        for (const c of document.querySelectorAll(".st-was-active")) c.classList.remove("st-was-active");
        for (const c of document.querySelectorAll(".st-content-hidden")) c.classList.remove("st-content-hidden");
        pane?.remove();
    }

    // Для отладки вёрстки: структура меню и вкладки — в дамп логгера (один раз за сессию)
    function dump(menu) {
        if (dumped || !globalThis.__packetLogger?.note) return;
        dumped = true;
        let root = menu;
        while (root.parentElement && !root.querySelector(`.${CONTENT}`)) root = root.parentElement;
        const html = root.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, "<svg/>");
        globalThis.__packetLogger.note({ sillySettingsDom: html.slice(0, 30000), length: html.length });
    }

    // Шаг строк меню (между нашим пунктом и предыдущим) — размеры в em, меняются с окном
    function measure() {
        const prev = tab?.previousElementSibling;
        if (!prev || !tab.parentElement) return;
        tab.parentElement.style.setProperty("--st-pitch", `${tab.offsetTop - prev.offsetTop}px`);
    }
    addEventListener("resize", measure);

    // Свой сдвиг полоски (CSS translate) — с той же анимацией, что у игры (у неё — transform/top)
    function animateTranslate(slide) {
        const style = getComputedStyle(slide);
        const props = style.transitionProperty.split(",").map((p) => p.trim());
        if (props.includes("all") || props.includes("translate")) return;
        const i = Math.max(0, props.findIndex((p) => p === "transform" || p === "top"));
        const pick = (list) => list.split(/,(?![^(]*\))/)[i]?.trim() ?? list;
        const duration = pick(style.transitionDuration);
        if (!parseFloat(duration)) return;
        slide.style.transition = `${style.transition}, translate ${duration} ${pick(style.transitionTimingFunction)}`;
    }

    function inject() {
        const items = document.querySelectorAll(`.${ITEM}, .${ACTIVE}`);
        if (!items.length) {
            if (active) deactivate();
            tab = null;
            return;
        }
        const menu = items[0].parentElement;
        if (tab?.parentElement === menu) {
            // Вкладку игры могли перерисовать (смена вкладки) — наша панель должна остаться
            if (active && !pane?.isConnected) activate();
            return;
        }
        if (active) deactivate();
        dump(menu);
        if (!document.getElementById("silly-tanks-settings-style")) {
            document.head.append(el("style", { id: "silly-tanks-settings-style" }, CSS));
        }
        text = TEXT[language()];
        const source = [...items].find((c) => !c.classList.contains(ACTIVE) && c !== tab) ?? items[0];
        tab = source.cloneNode(true);
        tab.classList.remove(ACTIVE);
        tab.classList.add("st-tab");
        // Текст пункта — в самом глубоком текстовом узле копии
        const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT);
        let label = null;
        while (walker.nextNode()) if (walker.currentNode.textContent.trim()) label = walker.currentNode;
        if (label) label.textContent = text.tab;
        else tab.textContent = text.tab;
        tab.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!active) activate();
        });
        // Клик по пункту игры — её вкладка
        menu.addEventListener("click", (e) => {
            if (active && !tab.contains(e.target)) deactivate();
        }, true);
        // Последний <li> меню — жёлтая полоска (slideMenuOptions), наш пункт — перед ней (после неё он
        // налезает на пункты игры). Полоска ставится к активному пункту от своего места в списке, поэтому
        // наш пункт сдвигает её на строку вниз — возвращаем на строку вверх (--st-pitch).
        const slide = menu.querySelector(`:scope > .${SLIDE}`);
        if (slide) slide.before(tab);
        else menu.append(tab);
        menu.classList.add("st-menu");
        if (slide) animateTranslate(slide);
        measure();
        requestAnimationFrame(measure); // меню могло ещё не разложиться
        setTimeout(measure, 500);
    }

    new MutationObserver(() => {
        try {
            inject();
        } catch (err) {
            console.warn("[silly-tanks] settings tab", err);
        }
    }).observe(document, { childList: true, subtree: true });
})();
