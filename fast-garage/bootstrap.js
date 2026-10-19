// Скрипты должны работать в контексте страницы (перехват window.WebSocket игры), поэтому подкладываем их <script>.
// async = false — строго по порядку: таблица значков аугментов -> протокол и данные -> панель.
(() => {
    for (const file of ["devices.js", "garage.js", "panel.js"]) {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL(file);
        script.async = false;
        script.onload = () => script.remove();
        (document.head ?? document.documentElement).appendChild(script);
    }
})();
