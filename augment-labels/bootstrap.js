// Content script живёт в изолированном мире и не видит прототипы холста и WebSocket страницы,
// поэтому подкладываем скрипты обычными <script>, они выполнятся в контексте игры.
// Файлы локальные, поэтому грузятся раньше сетевого бандла игры; async = false — строго по порядку:
// таблица аугментов -> подписи -> пакеты (packets.js отдаёт данные в подписи).
(() => {
    for (const file of ["devices.js", "labels.js", "packets.js"]) {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL(file);
        script.async = false;
        script.onload = () => script.remove();
        (document.head ?? document.documentElement).appendChild(script);
    }
})();
