// Content script живёт в изолированном мире и не видит прототипы холста и WebSocket страницы,
// поэтому подкладываем скрипты обычными <script>, они выполнятся в контексте игры.
// Файлы локальные, поэтому грузятся раньше сетевого бандла игры; async = false — строго по порядку.
// Каждый модуль — отдельный <script>: ошибка в одном не мешает остальным.
//   devices.js              таблица значков устройств (общая)
//   labels.js, packets.js   устройства над танками (packets.js отдаёт данные в labels.js)
//   garage.js, panel.js     Fast Garage: протокол и данные, панель
(() => {
    for (const file of ["devices.js", "labels.js", "packets.js", "garage.js", "panel.js"]) {
        const script = document.createElement("script");
        script.src = chrome.runtime.getURL(file);
        script.async = false;
        script.onload = () => script.remove();
        (document.head ?? document.documentElement).appendChild(script);
    }
})();
