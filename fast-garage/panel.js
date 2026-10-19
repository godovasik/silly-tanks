// Fast Garage — панель (вариант F из docs/ui/variants.html). Данные и команды — garage.js (globalThis.__fastGarage).
// Панель живёт в shadow DOM: стили игры её не трогают, а её стили — игру.
(() => {
    "use strict";
    const fg = globalThis.__fastGarage;
    if (!fg || fg.ui) return;

    const CSS = String.raw`
    .panel { position: absolute; background: rgba(14,18,22,.94); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,.6); user-select: none; }
    .head { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,.07); }
    .E .head { box-sizing: border-box; height: 42px; } /* в режиме настройки кнопки другие — высота шапки та же */
    .head b { font-size: 14px; letter-spacing: .3px; }
    .head .keys { margin-left: auto; color: #8a96a0; font-size: 12px; }
    kbd { font: 11px monospace; padding: 0 4px; border: 1px solid #556; border-radius: 3px; background: #222831; color: #ccd; }
    .icon { flex: none; width: 34px; height: 34px; border-radius: 6px; display: grid; place-items: center; font-weight: 700; font-size: 13px; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,.6); }
    .icon.sm { width: 24px; height: 24px; font-size: 10px; border-radius: 4px; }
    .icon { overflow: hidden; }
    .icon img { display: block; width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: contain; }
    .icon.wide { width: 62px; height: 40px; background: none; }
    .icon.wide.sm { width: 40px; height: 26px; }
    .icon.sq { background: none; }
    .icon.supply { background: rgba(70,74,80,.85); padding: 6px; }
    .icon.sm.supply { padding: 3px; }
    .icon.std { background: #3a4450; color: #aab; font-size: 18px; clip-path: polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%); }
    .icon.sm.std { font-size: 13px; }
    /* редкость аугмента: цвет рамки и подложки */
    [style*="--rar"] { background: linear-gradient(160deg, color-mix(in srgb, var(--rar) 26%, transparent), rgba(255,255,255,.03) 70%) !important; border-color: color-mix(in srgb, var(--rar) 55%, transparent) !important; }
    [style*="--rar"].q, [style*="--rar"].cur { border-color: var(--rar) !important; box-shadow: 0 0 0 1px var(--rar), 0 0 12px color-mix(in srgb, var(--rar) 45%, transparent); }
    .mk { font: 11px monospace; color: #9aa6b0; }
    .tag-cur { color: #6fdc6f; }
    .tag-q { color: #f0b428; }
    .btn { all: unset; cursor: pointer; padding: 5px 12px; border-radius: 5px; background: rgba(255,255,255,.1); }
    .btn:hover { background: rgba(255,255,255,.18); }
    .btn.go { background: #3e9a3e; }
    .btn.go:hover { background: #4bb34b; }
    .btn[disabled] { opacity: .4; pointer-events: none; }
    .btn.apply { min-width: 128px; text-align: center; }
    .btn.apply.locked { background: #c84a4a; opacity: 1; font-variant-numeric: tabular-nums; }
    .diff { display: flex; flex-wrap: wrap; gap: 4px 10px; color: #c9d1d8; }
    .diff .old { color: #8a96a0; text-decoration: line-through; }
    .diff .new { color: #f0b428; }
    .muted { color: #7d8891; }
    input.search { all: unset; flex: 1; padding: 6px 10px; border-radius: 6px; background: rgba(255,255,255,.07); }
    input.search::placeholder { color: #6c7780; }

    /* E: квадраты, ряды по группам, аугменты в полосе фиксированной высоты под колонкой */
    .E { left: 50%; top: 50%; transform: translate(-50%,-50%); width: max-content; display: flex; flex-direction: column; max-height: 96vh; }
    .E .main { padding: 4px 12px 10px; overflow: auto; }
    .E .cols { display: flex; gap: 18px; }
    .E .col { display: flex; flex-direction: column; }
    .E h4 { margin: 8px 0 4px; font-size: 11px; font-weight: 600; color: #7fb4e6; text-transform: uppercase; letter-spacing: .6px; }
    .E .grp, .E .augstrip { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
    .E .sqs { display: flex; gap: 4px; }
    .E .sep { width: 10px; }
    .E .sqs.wrap { flex-wrap: wrap; align-content: flex-start; }
    .E .augstrip { align-items: flex-start; }
    .E .bottom .sqs { flex-wrap: wrap; }
    .E .sqt { width: 66px; height: 60px; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border-radius: 7px; background: rgba(255,255,255,.05); border: 1px solid transparent; cursor: pointer; font-size: 11px; text-align: center; line-height: 1.05; overflow: hidden; }
    .E .sqt:hover { background: rgba(255,255,255,.11); }
    .E .sqt .icon.wide { width: 58px; height: 36px; }
    .E .sqt .icon.sq { width: 32px; height: 32px; }
    .E .sqt .icon.emb { width: 36px; height: 36px; }
    .E .sqt .icon.emb-hull { padding: 6px; opacity: .9; }
    .E .sqt .icon.emb-weapon { padding: 7px; }
    .E .sqt.cur { background: rgba(80,200,80,.2); border-color: rgba(80,200,80,.7); }
    .E .sqt.q { background: rgba(240,180,40,.22); border-color: #f0b428; }
    /* Резисты: гнёзда — утопленные, с номером; список — обычные плитки, надетые с номером гнезда в углу */
    .E .resbox { display: flex; gap: 14px; align-items: flex-start; }
    .E .wells { display: grid; grid-template-columns: repeat(2, 70px); gap: 6px; padding: 6px; border-radius: 10px; background: rgba(0,0,0,.3); box-shadow: inset 0 1px 4px rgba(0,0,0,.6); }
    .E .well { position: relative; height: 82px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer;
        background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02)); border: 1px solid rgba(255,255,255,.12); font-size: 11px; }
    .E .well .icon { width: 36px; height: 36px; }
    .E .well .num { position: absolute; left: 5px; top: 3px; font-size: 10px; font-weight: 700; color: #7d8891; }
    .E .well.empty { background: none; border: 1px dashed #4a5560; }
    .E .well.locked { background: repeating-linear-gradient(135deg, rgba(255,255,255,.03) 0 6px, transparent 6px 12px); border: 1px solid rgba(255,255,255,.04); cursor: default; }
    .E .well.locked .lbl { color: #4f5a63; font-size: 11px; }
    .E .well.empty .lbl { color: #6f7b85; }
    .E .well.q { border-color: #f0b428; background: rgba(240,180,40,.14); }
    .E .well.sel { border: 2px solid #64aaff; box-shadow: 0 0 10px rgba(100,170,255,.45); }
    .E .well.sel .num { color: #64aaff; }
    .E .resbox.dragging .well { border-color: #64aaff; border-style: dashed; }
    .E .resbox .well.over { background: rgba(100,170,255,.22); border: 2px solid #64aaff; }
    .E .resbox .resgrid.over { background: rgba(255,106,90,.10); outline: 1px dashed #ff6a5a; outline-offset: 2px; border-radius: 6px; }
    .E .well[draggable], .E .resgrid .sqt[draggable] { cursor: grab; }
    .E .well.sel::after { content: "▲"; position: absolute; bottom: -12px; font-size: 9px; color: #64aaff; }
    .E .resgrid { display: grid; grid-template-columns: repeat(7, 66px); gap: 4px; }
    .E .resgrid .sqt { position: relative; }
    .E .resgrid .slotno { position: absolute; right: 3px; top: 2px; min-width: 14px; height: 14px; border-radius: 7px; font-size: 10px; font-weight: 700; line-height: 14px; color: #0e1216; background: #6fdc6f; }
    .E .resgrid .sqt.q .slotno { background: #f0b428; }
    /* процент защиты вместо названия (название — в подсказке); неполная прокачка — оранжевым */
    .E .pct { font-size: 12px; font-weight: 600; color: #c9d1d8; }
    .E .pct.low { color: #ff8a5c; }
    .E .octs { display: flex; flex-direction: column; gap: 6px; }
    .E .octrow { gap: 6px; }
    .E .oct { width: 52px; height: 52px; cursor: pointer; display: grid; place-items: center; }
    .E .oct .icon { width: 52px; height: 52px; transition: transform .08s; }
    .E .oct:hover .icon { transform: scale(1.08); }
    .E .oct .icon.std { width: 46px; height: 46px; font-size: 22px; }
    .E .oct.cur { filter: drop-shadow(0 0 1px #6fdc6f) drop-shadow(0 0 1px #6fdc6f) drop-shadow(0 0 1px #6fdc6f) drop-shadow(0 0 5px rgba(80,220,80,.8)); }
    .E .oct.q { filter: drop-shadow(0 0 1px #f0b428) drop-shadow(0 0 1px #f0b428) drop-shadow(0 0 1px #f0b428) drop-shadow(0 0 5px rgba(240,180,40,.9)); }
    /* надетый, но в очереди другой (.cur.was) выглядит так же, как просто надетый */
    .E .oct:not(.cur):not(.q) .icon { opacity: .8; }
    .E .oct:not(.cur):not(.q):hover .icon { opacity: 1; }
    /* Варианты выделения выбранного аугмента (переключатель «Выделение») */
    /* обводка: белое кольцо 1px + цветное 2px, резкие, без размытия — видно на любом цвете иконки */
    .hl-ring .E .oct.cur { filter: drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff) drop-shadow(0 1px 0 #fff) drop-shadow(0 -1px 0 #fff)
        drop-shadow(1.5px 0 0 #3fd23f) drop-shadow(-1.5px 0 0 #3fd23f) drop-shadow(0 1.5px 0 #3fd23f) drop-shadow(0 -1.5px 0 #3fd23f); }
    .hl-ring .E .oct.q { filter: drop-shadow(1px 0 0 #fff) drop-shadow(-1px 0 0 #fff) drop-shadow(0 1px 0 #fff) drop-shadow(0 -1px 0 #fff)
        drop-shadow(1.5px 0 0 #ff9a00) drop-shadow(-1.5px 0 0 #ff9a00) drop-shadow(0 1.5px 0 #ff9a00) drop-shadow(0 -1.5px 0 #ff9a00); }
    /* приглушить остальные: невыбранные тусклые и обесцвеченные, выбранный — яркий, со свечением */
    .hl-dim .E .oct:not(.cur):not(.q):not(.was) .icon { opacity: .55; filter: grayscale(.5); }
    .hl-dim .E .oct:not(.cur):not(.q):hover .icon { opacity: .9; filter: none; }
    /* значок: кружок с галочкой в верхнем правом углу, свечения нет */
    .hl-mark .E .oct { position: relative; }
    .hl-mark .E .oct.cur, .hl-mark .E .oct.q { filter: none; }
    .hl-mark .E .oct.cur::after, .hl-mark .E .oct.q::after { content: "✓"; position: absolute; top: -3px; right: -3px; width: 18px; height: 18px; border-radius: 50%;
        display: grid; place-items: center; font: bold 12px sans-serif; color: #fff; background: #2fa52f; box-shadow: 0 0 0 2px #0e1216; }
    .hl-mark .E .oct.q::after { background: #e08a00; }
    .E .augstrip { margin-top: 8px; padding: 6px 0; height: 76px; border-top: 1px solid rgba(255,255,255,.07); border-radius: 6px; }
    .E .none { color: #6f7b85; font-size: 12px; }
    .E .bottom > div { flex: none; }
    .E .cols-grenade { display: grid; grid-template-columns: repeat(2, 66px); }
    .E .cols-drone { display: grid; grid-template-columns: repeat(3, 66px); }
    .E .bottom { display: flex; gap: 22px; border-top: 1px solid rgba(255,255,255,.07); margin-top: 4px; }
    .E .foot { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid rgba(255,255,255,.07); background: rgba(0,0,0,.25); border-radius: 0 0 10px 10px; }
    /* Сводка всегда в одну строку: высота подвала (и всей панели) не меняется; не влезшее уходит под затухание, полный список — в подсказке */
    .E .foot { height: 46px; }
    /* рекомендации */
    .E .advisor { display: flex; align-items: center; gap: 8px; height: 34px; margin-bottom: 6px; padding: 0 8px; border-radius: 8px; background: rgba(47,208,255,.06); border: 1px solid rgba(47,208,255,.18); font-size: 12px; white-space: nowrap; }
    .E .advisor .threats { display: flex; gap: 4px; overflow: hidden; }
    .E .advisor .threat { display: flex; align-items: center; gap: 2px; padding: 1px 4px 1px 1px; border-radius: 4px; opacity: .55; }
    .E .advisor .threat.top { opacity: 1; background: rgba(255,255,255,.07); }
    .E .advisor .threat .icon.sm { width: 20px; height: 20px; }
    .E .advisor .threat b { font-size: 11px; }
    .E .advisor .arrow { color: #2fd0ff; }
    .E .advisor .recset { display: flex; gap: 3px; }
    .E .advisor .recset .icon.sm { width: 22px; height: 22px; }
    .E .advisor .recbtn { margin-left: auto; padding: 3px 12px; }
    .E .advisor .recdone { margin-left: auto; }
    .E .advisor > .sectoggle { flex: none; }
    .E .resgrid .sqt.rec::after { content: ""; position: absolute; left: 8px; right: 8px; bottom: 2px; height: 2px; border-radius: 1px; background: #2fd0ff; box-shadow: 0 0 4px #2fd0ff; }
    /* избранное */
    .E .sqt { position: relative; }
    .E .star { position: absolute; right: 2px; top: 0; font-size: 13px; line-height: 1; color: #8a96a0; opacity: 0; cursor: pointer; padding: 2px; }
    .E .sqt:hover .star { opacity: .8; }
    .E .star:hover { color: #ffd21a; opacity: 1 !important; transform: scale(1.2); }
    .E .star.on { opacity: 1; color: #ffd21a; text-shadow: 0 0 4px rgba(255,210,26,.6); }
    .E .oct { position: relative; }
    .E .oct .star { right: -4px; top: -4px; }
    .E .oct:hover .star { opacity: .8; }
    .head .augfilter { display: inline-flex; align-items: center; gap: 4px; color: #8a96a0; font-size: 12px; }
    /* комбо */
    .E .body { display: flex; min-height: 0; }
    .E .combos { flex: none; width: 262px; contain: size; display: flex; flex-direction: column; padding: 4px 0 10px 12px; }
    .E .combos .chead { display: flex; align-items: center; justify-content: space-between; height: 28px; }
    .E .combos .chead h4 { margin: 0; }
    .E .combos .csave { padding: 2px 8px; font-size: 12px; }
    .E .combos .clist { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 4px; padding-right: 2px; }
    .E .combo { flex: none; padding: 4px 6px 5px; border-radius: 7px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); cursor: pointer; position: relative; }
    .E .combo:hover { background: rgba(255,255,255,.08); }
    .E .combo.cur { border-color: #3fd23f; background: rgba(63,210,63,.08); }
    .E .combo.q { border-color: #ff9a00; background: rgba(255,154,0,.08); }
    .E .combo.dragging { opacity: .4; }
    .E .combo.dropabove { box-shadow: 0 -2px 0 #64aaff; }
    .E .combo.dropbelow { box-shadow: 0 2px 0 #64aaff; }
    .E .combo .ctop { display: flex; align-items: center; gap: 4px; height: 17px; }
    .E .combo .cname { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; font-weight: 600; }
    .E .combo input.cname { font: inherit; font-size: 12px; font-weight: 600; color: #fff; background: #0e1216; border: 1px solid #64aaff; border-radius: 3px; padding: 0 3px; height: 16px; }
    .E .combo .cwarn { color: #ff6a5a; font-weight: 700; font-size: 12px; }
    .E .combo .cdel { opacity: 0; color: #8a96a0; font-size: 15px; line-height: 1; padding: 0 2px; }
    .E .combo:hover .cdel { opacity: .8; }
    .E .combo .cdel:hover { color: #ff6a5a; opacity: 1; }
    .E .combo .cicons { display: flex; align-items: center; gap: 1px; margin-top: 3px; overflow: hidden; }
    .E .ci { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; flex: none; }
    .E .ci img { width: 100%; height: 100%; object-fit: contain; }
    .E .ci.ci-wide { width: 23px; }
    /* у превью дронов вокруг много пустого места — увеличиваем сам рисунок, рамка та же */
    .E .ci.ci-drone { width: 25px; overflow: visible; }
    .E .ci.ci-drone img { transform: scale(1.6); }
    .E .ci.ci-aug { margin-right: 3px; }
    .E .ci.ci-empty { opacity: .25; }
    .E .ci.ci-res.ci-empty::after, .E .ci.ci-aug.ci-empty::after { content: ""; width: 12px; height: 12px; border: 1px dashed #8a96a0; border-radius: 3px; }
    .E .ci.miss { outline: 1px solid #ff6a5a; outline-offset: -1px; border-radius: 3px; opacity: 1; }
    .E .ci.miss img { filter: grayscale(1) opacity(.5); }
    .E .ci-glyph .g { display: block; width: 20px; height: 20px; background: #fff; -webkit-mask: center / contain no-repeat; mask: center / contain no-repeat; }
    /* --gc, а не --rar: на [style*="--rar"] висит градиентный фон плиток */
    .E .ci-glyph.g-fill .g { background: var(--gc); }
    .E .ci-glyph.g-ring { box-sizing: border-box; border: 1.5px solid var(--gc); border-radius: 50%; }
    .E .ci-glyph.g-ring .g { width: 13px; height: 13px; }
    .E .ci-glyph.g-plain .g { background: #dfe6ec; }
    .E .csep { flex: none; width: 1px; height: 18px; margin: 0 3px 0 0; background: rgba(255,255,255,.14); }
    .E .cres { display: flex; gap: 1px; margin-left: auto; padding-left: 3px; border-left: 1px solid rgba(255,255,255,.08); }
    .E .cres .ci { width: 19px; height: 19px; }
    .E .cres.skip { opacity: .35; }
    .E .combos .cfoot { display: flex; align-items: center; gap: 6px; height: 30px; margin-top: 6px; font-size: 12px; }
    .E .combos .cfoot .btn { padding: 2px 8px; font-size: 12px; }
    .E .combos .cresopt { display: flex; align-items: center; gap: 3px; margin-right: auto; color: #aab4c0; cursor: pointer; }
    .E .combos .ctoast { color: #cfe; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .E .combos .ctoast a { color: #64aaff; cursor: pointer; }
    .E .combos .cempty { font-size: 12px; padding: 8px 2px; }
    .E .favrow { padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,.07); }
    .E .favrow .sqs { flex-wrap: wrap; }
    /* режим настройки */
    .head .gear { padding: 3px 9px; font-size: 14px; }
    .head .gear.on { background: #64aaff; color: #000; font-size: 12px; }
    .head .edithint { color: #64aaff; font-size: 12px; }
    .E.edit .main { background: repeating-linear-gradient(135deg, rgba(100,170,255,.025) 0 12px, transparent 12px 24px); }
    .E .editing { position: relative; }
    .E .editing .chk, .E .sectoggle .chk { position: absolute; left: 3px; top: 3px; width: 14px; height: 14px; border-radius: 3px; border: 1.5px solid #64aaff; background: #64aaff; }
    .E .editing .chk::after, .E .sectoggle .chk::after { content: "✓"; position: absolute; inset: 0; display: grid; place-items: center; font: bold 10px sans-serif; color: #0e1216; }
    .E .editing.hid { opacity: .35; filter: grayscale(.8); }
    .E .editing.hid .chk { background: #0e1216; }
    .E .editing.hid .chk::after { content: ""; }
    .E .editing.locked { cursor: not-allowed; }
    .E .oct.editing .chk { left: 0; top: 0; }
    .E .sectoggle { cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .E .sectoggle .chk { position: relative; left: auto; top: auto; flex: none; }
    .E .sectoggle.off .chk { background: #0e1216; }
    .E .sectoggle.off .chk::after { content: ""; }
    .E .off > :not(h4) { opacity: .3; filter: grayscale(.8); }
    .E .augstrip.off .octs { opacity: .3; filter: grayscale(.8); }
    .E .augstrip { position: relative; }
    .E .sectoggle.mini { position: absolute; right: 0; top: -9px; padding: 0 0 0 6px; background: rgb(14,18,22); font-size: 11px; color: #7fb4e6; text-transform: uppercase; letter-spacing: .6px; font-weight: 600; }
    .E .foot .diff { flex: 1; width: 0; contain: inline-size; flex-wrap: nowrap; white-space: nowrap; overflow: hidden; -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 40px), transparent); }
    @keyframes drop { from { opacity: 0; transform: translateY(-4px); } }
`;

    // ---------- данные из garage.js: пересобираются перед каждой отрисовкой (sync) ----------
    const S = "https://s.eu.tankionline.com/static/images/";
    const CAT_ID = { weapon: 0, hull: 1, grenade: 17, drone: 14 };
    // [категория, одна, много, названия своих предметов в порядке гаража]
    const CATS = [["weapon", "Пушка", "Пушки", []], ["hull", "Корпус", "Корпуса", []], ["grenade", "Граната", "Гранаты", []], ["drone", "Дрон", "Дроны", []]];
    let RESISTS = [], SLOTS = [], SLOT_COUNT = 4;
    const RES_LVL = {}, MOUNTED = {}, AUG = {}, AUG_MOUNTED = {}, AUGI = {}, AUGR = {}, AUGP = {}, ICONS = {}, RARITY = {}, AUG_GLYPH = {};
    const IDS = { item: {}, aug: {} };   // для комбо isra: "cat|название" -> [id, baseItemId], "предмет|аугмент" -> id
    const REC = { item: {}, aug: {} };   // те же ключи -> записи garage.js (для команд)
    const BY_BASE = {}, AUG_BY_ID = {};  // обратные: "cat|baseItemId" -> название, "предмет|id аугмента" -> название (комбо)
    const resPct = (r) => (RES_LVL[base(r)] ?? 45) + 5;
    const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name, "ru");
    const nameOfId = (id) => (id === null || id === undefined ? null : fg.state.items.get(fg.key(id))?.name ?? fg.nameOf(id));
    // Значки аугментов (как в augment-labels): ID аугмента (16 hex) -> static/images/….svg
    const glyphPath = (id) => globalThis.__augmentDevices?.icons?.[fg.key(id).padStart(16, "0")] ?? null;
    let dataVersion = 0;
    function sync() {
        const st = fg.state;
        const clear = (o) => { for (const k of Object.keys(o)) delete o[k]; };
        [MOUNTED, AUG, AUG_MOUNTED, AUGI, AUGR, AUGP, AUG_GLYPH, IDS.item, IDS.aug, REC.item, REC.aug, RES_LVL, BY_BASE, AUG_BY_ID].forEach(clear);
        const put = (cat, r) => {
            const k = cat + "|" + r.name;
            REC.item[k] = r;
            IDS.item[k] = [r.id.toString(), r.base.toString()];
        BY_BASE[cat + "|" + r.base] = r.name;
            ICONS[r.name] = fg.iconOf(r) ?? ICONS[r.name];
        };
        for (const c of CATS) {
            const list = fg.owned(CAT_ID[c[0]]).sort(byPosition);
            c[3] = list.map((r) => r.name);
            list.forEach((r) => put(c[0], r));
            const id = st.equipped.get(CAT_ID[c[0]]);
            if (id !== undefined) MOUNTED[c[0]] = nameOfId(id);
        }
        const res = fg.owned(fg.RESISTANCE).sort(byPosition);
        RESISTS = res.map((r) => r.name);
        res.forEach((r) => { put("resist", r); RES_LVL[r.name] = r.level ?? 0; });
        SLOTS = (st.slots ?? []).map(nameOfId);
        SLOT_COUNT = SLOTS.length;
        // Аугменты своих пушек и корпусов: купленные + надетый
        for (const cat of ["weapon", "hull"]) {
            for (const item of CATS.find((c) => c[0] === cat)[3]) {
                const owner = REC.item[cat + "|" + item], d = st.devices.get(fg.key(owner.base));
                if (!d) continue;
                const list = d.ids.map((id) => st.deviceInfo.get(fg.key(id)))
                    .filter((x) => x && x.name !== fg.key(x.id) && (x.forever || x.id === d.mounted));
                AUG[item] = list.map((x) => x.name);
                for (const x of list) {
                    const k = item + "|" + x.name;
                    REC.aug[k] = x;
                    IDS.aug[k] = x.id.toString();
                    AUG_BY_ID[item + "|" + x.id] = x.name;
                    AUGI[k] = fg.iconOf(x);
                    AUGR[k] = x.rarity;
                    AUGP[k] = x.position ?? 0;
                    RARITY[x.name] = x.rarity;
                    const glyph = glyphPath(x.id);
                    if (glyph) AUG_GLYPH[k] = glyph.replace(/^static\/images\//, "");
                    if (x.id === d.mounted) AUG_MOUNTED[item] = x.name;
                }
            }
        }
        dataVersion++;
    }

    // ---------- рекомендованные резисты (как советчик isra, features/advisor/model/recommend.js) ----------
    // Резист -> пушка, от которой он защищает (таблица вики, CLAUDE.mds/advisor.md у isra). Броненосец — крит, Паук — мины.
    const RESIST_FOR = { "Лис": "Огнемёт", "Барсук": "Фриз", "Оцелот": "Изида", "Ласка": "Тесла", "Волк": "Молот", "Пантера": "Твинс", "Лев": "Рикошет",
        "Акула": "Вулкан", "Дельфин": "Смоки", "Касатка": "Страйкер", "Гризли": "Гром", "Ворон": "Цунами", "Гриф": "Скорпион", "Грифон": "Магнум",
        "Сокол": "Рельса", "Сова": "Гаусс", "Орёл": "Шафт" };
    // baseItemId пушек (resistance_map.js у isra)
    const TURRET_ID = { "Огнемёт": 920009630983, "Фриз": 920009631074, "Изида": 920009630913, "Тесла": 921009714084, "Молот": 920009631046, "Твинс": 920009630997,
        "Рикошет": 920009631088, "Вулкан": 920009631144, "Смоки": 920009630969, "Страйкер": 920009630990, "Гром": 920009631123, "Цунами": 1931009780251,
        "Скорпион": 931009771122, "Магнум": 920009630976, "Рельса": 920009631011, "Гаусс": 920009631151, "Шафт": 920009631158 };
    const ARMADILLO = "Броненосец", MIN_PERCENT = 30;
    // Пушки врагов: очки по типу пушки, а не по игрокам — сумма убийств онлайн-врагов; при равенстве — очки, носители, сумма gearScore, id
    function rankTurrets(enemies) {
        const by = new Map();
        for (const e of enemies) {
            if (!e.online || !e.turret) continue;
            const t = by.get(e.turret) ?? { base: e.turret, kills: 0, score: 0, carriers: 0, gs: 0 };
            t.kills += e.kills || 0; t.score += e.score || 0; t.carriers++; t.gs += e.gs || 0;
            by.set(e.turret, t);
        }
        // последний ключ — baseItemId пушки строкой, как у isra (report.js), чтобы порядок совпадал один в один
        const id = (t) => String(TURRET_ID[t.base] ?? t.base);
        return [...by.values()].sort((a, b) => b.kills - a.kills || b.score - a.score || b.carriers - a.carriers || b.gs - a.gs || (id(a) < id(b) ? -1 : 1));
    }
    // Чистая функция, как recommend() у isra: ранжирование + свои модули -> {ordered, equip, equipped}
    function recommendResists(turrets, owned, mounted) {
        const ok = (r) => owned.includes(r) && resPct(r) >= MIN_PERCENT;
        const armadillo = ok(ARMADILLO) ? ARMADILLO : null;
        const ordered = [];
        for (const t of turrets) {
            const r = Object.keys(RESIST_FOR).find((x) => RESIST_FOR[x] === t.base);
            if (!r || !ok(r) || ordered.some((o) => o.resist === r)) continue; // нет годного модуля — идём дальше по списку
            ordered.push({ resist: r, turret: t.base, kills: t.kills, carriers: t.carriers });
        }
        const equip = ordered.slice(0, armadillo ? SLOT_COUNT - 1 : SLOT_COUNT).map((o) => o.resist);
        if (armadillo) equip.unshift(armadillo);
        const have = new Set(mounted.filter(Boolean));
        const equipped = equip.length > 0 && have.size === equip.length && equip.every((r) => have.has(r));
        return { ordered, equip, armadillo: !!armadillo, equipped };
    }
    // Применить набор: уже надетые из набора остаются в своих гнёздах, остальные гнёзда заполняются по порядку
    function applyRecommended(equip) {
        const cur = slots();
        const keep = cur.map((r) => (equip.includes(r) ? r : null));
        const rest = equip.filter((r) => !keep.includes(r));
        const next = keep.map((r) => r ?? rest.shift() ?? null);
        draft.slots = next.every((x, i) => x === SLOTS[i]) ? null : next;
    }
    // Бой для макета. ДЕМО: наш протокол пока не разбирает убийства и команды (у isra это состояние игры BattleUsers)
    let battle = null; // бой пока не разбираем — строки рекомендаций нет
    const SEED_COMBOS = []; // новые пользователи начинают с пустого списка
    const glyphCache = new Map(); // файл -> blob-URL | null (грузится)
    let glyphRender = 0;
    function glyphUrl(file) {
        if (glyphCache.has(file)) return glyphCache.get(file);
        glyphCache.set(file, null);
        fetch(S + file).then((r) => r.text()).then((t) => {
            t = t.replace(/<rect[^>]*fill="url\(#[^"]*\)"[^>]*\/>/g, "").replace(/\s(?:fill-|stroke-)?opacity="[^"]*"/g, "");
            // data:, а не blob: — CSP игры (img-src) разрешает только data:
            glyphCache.set(file, "data:image/svg+xml;charset=utf-8," + encodeURIComponent(t));
        }).catch(() => glyphCache.set(file, S + file)).finally(() => {
            // одна перерисовка на пачку; во время переименования не трогаем — поле ввода потеряло бы текст
            cancelAnimationFrame(glyphRender);
            glyphRender = requestAnimationFrame(() => { if (!open) renderLater(); else if (renaming === null) render(); });
        });
        return null;
    }
    // Значки аугментов как в оверлее augment-labels (devices.js: ID аугмента -> static/images/*.svg) — для карточек комбо
    const RARITY_COLOR = { 1: "#ffd21a", 2: "#c48cff", 3: "#2fd0ff" };
    // Для значков аугментов в комбо ещё и особые (0: Хадукен, Экстремальное облегчение) — своим цветом
    const GLYPH_COLOR = { 0: "#ff6b9a", ...RARITY_COLOR };
    // Строки полосы аугментов: по убыванию редкости; особые (Хадукен, Феникс) — в строке легендарных, первыми; «Стандарт» — в последней строке
    // (ItemRarityCC: 0 SPECIAL, 1 LEGENDARY, 2 EPIC, 3 RARE)
    const RARITY_ROWS = [[0, 1], [2], [3]];
    // Последняя строка: «Стандарт», за ним эти особые
    const AUG_LAST = ["Экстремальное облегчение корпуса"];
    // ---------- очередь ----------
    const draft = { equip: {}, slots: null, aug: {} };
    const base = (s) => s.replace(/ MK.*$/, "").replace(/-\d+$/, "");
    const equipped = (cat) => draft.equip[cat] ?? MOUNTED[cat];
    const slots = () => draft.slots ?? SLOTS;
    const augList = (cat) => AUG[base(equipped(cat))] || [];
    // null в очереди = «без аугмента», поэтому проверяем наличие ключа, а не ??
    const augNow = (cat) => { const b = base(equipped(cat)); return b in draft.aug ? draft.aug[b] : AUG_MOUNTED[b] ?? null; };
    const augNowOf = (b) => b in draft.aug ? draft.aug[b] : AUG_MOUNTED[b] ?? null;
    function equip(cat, item) { if (item === MOUNTED[cat]) delete draft.equip[cat]; else draft.equip[cat] = item; }
    function setSlot(n, id) {
        const s = slots().slice();
        const other = id === null ? -1 : s.indexOf(id);
        if (other >= 0) s[other] = s[n];
        s[n] = id;
        draft.slots = s.every((x, i) => x === SLOTS[i]) ? null : s;
    }
    function setAug(cat, a) { const b = base(equipped(cat)); if (a === (AUG_MOUNTED[b] ?? null)) delete draft.aug[b]; else draft.aug[b] = a; }
    function clearDraft() { draft.equip = {}; draft.slots = null; draft.aug = {}; }
    function changes() {
        const out = [];
        for (const [cat, one] of CATS) if (draft.equip[cat]) out.push([one, MOUNTED[cat], draft.equip[cat]]);
        if (draft.slots) draft.slots.forEach((id, n) => { if (id !== SLOTS[n]) out.push([`Резист ${n + 1}`, SLOTS[n] ?? "—", id ?? "—"]); });
        for (const [b, a] of Object.entries(draft.aug)) out.push([`Аугмент ${b}`, AUG_MOUNTED[b] ?? "стандарт", a ?? "стандарт"]);
        return out;
    }

    // ---------- мелочи ----------
    // Обработчики — в e.__on, слушатель общий: при обновлении на месте (morph) старый элемент получает новые обработчики
    function dispatch(ev) { return this.__on?.[ev.type]?.call(this, ev); }
    const on = (e, type, fn) => { if (!(e.__on ??= {})[type]) e.addEventListener(type, dispatch); e.__on[type] = fn; };
    // Обновить DOM a до вида b, трогая только отличия: стили пересчитываются только у изменившихся элементов,
    // прокрутка списков и фокус сохраняются
    function morph(a, b) {
        if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName || (a.nodeType !== 1 && a.nodeType !== 3)) return a.replaceWith(b);
        if (a.nodeType === 3) { if (a.data !== b.data) a.data = b.data; return; }
        for (const { name } of [...a.attributes]) if (!b.hasAttribute(name) && name !== "src") a.removeAttribute(name);
        for (const { name, value } of b.attributes) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
        if (b.__on) for (const [type, fn] of Object.entries(b.__on)) on(a, type, fn);
        if (a.__on) for (const type of Object.keys(a.__on)) if (!b.__on?.[type]) delete a.__on[type];
        if (a.tagName === "IMG" && a.hasAttribute("src") && a.getAttribute("src") !== a.dataset.src) a.src = a.dataset.src;
        if (a.tagName === "INPUT") { a.checked = b.checked; if (a.value !== b.value && a !== shadow.activeElement) a.value = b.value; }
        const ac = [...a.childNodes], bc = [...b.childNodes];
        bc.forEach((n, i) => (i < ac.length ? morph(ac[i], n) : a.append(n)));
        for (let i = bc.length; i < ac.length; i++) ac[i].remove();
    }
    const h = (tag, attrs = {}, ...kids) => {
        const e = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k.startsWith("on")) on(e, k.slice(2), v);
            else if (k === "class") e.className = v;
            // Картинка: адрес — в data-src, src ставит hydrate() только тем, что попали на экран (morph выкидывает
            // остальные): src у каждого нового <img> — запрос в кэш картинок, это половина времени отрисовки
            else if (k === "src" && tag === "img") e.setAttribute("data-src", v);
            else if (v !== false && v != null) e.setAttribute(k, v);
        }
        for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
        return e;
    };
    const HUE = { weapon: 20, hull: 205, grenade: 0, drone: 270, resist: 160, aug: 45 };
    // Иконка: пушки/корпуса/гранаты/дроны — превью игры (164×106), резисты и аугменты — квадратные
    function icon(cat, name, sm) {
        const b = base(name);
        const box = (cls, kids, style = "") => h("div", { class: `icon ${cls}${sm ? " sm" : ""}`, style }, kids);
        if (emblems && EMBLEM[b]) return box(`sq emb emb-${cat}`, h("img", { src: EMBLEM[b], decoding: "sync" }));
        const url = (cat === "aug" && AUGI[augCtx + "|" + name]) || ICONS[b];
        if (url) return box(cat === "resist" || cat === "aug" ? "sq" : "wide", h("img", { src: url, decoding: "sync" }));
        if (cat === "aug") return box("sq std", GEAR());
        let x = 0; for (const c of name) x = (x * 31 + c.charCodeAt(0)) % 360;
        const hue = (HUE[cat] + (x % 40) - 20 + 360) % 360;
        if (name === "—") return box("sq", "", "border:1px dashed #556");
        return box("sq", name === "—" ? "—" : b.slice(0, 2), `background:linear-gradient(135deg,hsl(${hue} 45% 42%),hsl(${hue} 40% 24%))`);
    }
    // Значки пушек и корпусов из бандла игры (static/images) — для варианта F; у пушек — *_resistance.svg (чистые, без подложки-свечения, как у Tesla.svg)
    const EMBLEM = Object.fromEntries(Object.entries({"Огнемёт": "firebird_resistance.785a9d6b", "Фриз": "freeze_resistance.33bdf642", "Изида": "isis_resistance.30a69ffc", "Тесла": "tesla_resistance.3e686c8e", "Молот": "hammer_resistance.6c549d29", "Твинс": "twins_resistance.ad189f61", "Рикошет": "ricochet_resistance.8247beaa", "Вулкан": "vulcan_resistance.824f6f0e", "Смоки": "smoky_resistance.845afc14", "Страйкер": "rocket_launcher_resistance.b7dfd64f", "Гром": "thunder_resistance.6d7f4531", "Цунами": "tsunami_resistance.6200aad9", "Скорпион": "scorpio_resistance.e8f1787f", "Магнум": "artillery_resistance.9b4cbc34", "Рельса": "railgun_resistance.636a554f", "Гаусс": "gauss_resistance.bb8f409c", "Шафт": "shaft_resistance.0778fd3e", "Васп": "Wasp.63098bb6", "Хоппер": "Hopper.17d5fd98", "Хорнет": "Hornet.aa9c33f2", "Викинг": "Viking.45549e00", "Крусейдер": "Crusader.f14927dc", "Хантер": "Hunter.82b7d58f", "Паладин": "Paladin.7b656d82", "Диктатор": "Dictator.770a5277", "Титан": "Titan.d2bf1806", "Арес": "Ares.e0b4f363", "Мамонт": "Mammoth.1c266702"}).map(([k, v]) => [k, S + v + ".svg"]));
    let emblems = false;
    // Шестерёнка «Стандарта» — SVG, чтобы стояла ровно по центру (у символа ⚙ своя базовая линия)
    const GEAR = () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "-12 -12 24 24");
        svg.innerHTML = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="-1.7" y="-9.5" width="3.4" height="4" rx=".6" transform="rotate(${a})" fill="#aab4c0"/>`).join("") +
            '<circle r="6.6" fill="#aab4c0"/><circle r="2.8" fill="#3a4450"/>';
        svg.style.cssText = "width:55%;height:55%";
        return svg;
    };
    let augCtx = null; // предмет, чьи аугменты сейчас рисуются
    const rarityOf = (cat, name) => cat === "aug" ? (AUGR[augCtx + "|" + name] ?? RARITY[name]) : undefined;
    const rarityStyle = (cat, name) => { const c = RARITY_COLOR[rarityOf(cat, name)]; return c ? `--rar:${c}` : null; };
    function diffView() {
        const c = changes();
        if (!c.length) return h("div", { class: "diff muted" }, "Нет изменений");
        return h("div", { class: "diff", title: c.map(([k, a, b]) => `${k}: ${base(a)} → ${b}`).join("\n") }, c.map(([k, a, b]) => h("span", {}, h("span", { class: "muted" }, k + ": "), h("span", { class: "old" }, base(a)), " → ", h("span", { class: "new" }, b))));
    }
    // В бою — таймер смены: сервер не примет, кнопка показывает остаток, очередь остаётся
    function applyBtn(label = "Применить") {
        const { left, unknown } = fg.lock();
        if (left) return h("button", { class: "btn apply locked", disabled: true, title: "В бою: сервер не примет смену, пока идёт таймер. Очередь останется" }, "🔒 ", fg.clock(left));
        return h("button", { class: "btn go apply", disabled: !changes().length || null, onclick: applyAndClose,
            title: unknown ? "В бою уже меняли — перед отправкой проверю таймер смены" : null }, label, unknown ? " ⏱" : "", " ", h("kbd", {}, "`"));
    }
    const cancelBtn = () => h("button", { class: "btn", onclick: close }, "Отмена ", h("kbd", {}, "Esc"));

    // Группы — по разрывам в ItemModelCC.position (порядок гаража); в данных игры названий групп нет
    const WEAPON_ORDER = ["Огнемёт", "Фриз", "Изида", "Тесла", "Молот", "Твинс", "Рикошет", "Вулкан", "Смоки", "Страйкер", "Гром", "Цунами", "Скорпион", "Магнум", "Рельса", "Гаусс", "Шафт"];
    const WEAPON_GROUPS = [["Ближние", ["Огнемёт", "Фриз", "Изида", "Тесла", "Молот"]], ["Средние", ["Твинс", "Рикошет", "Вулкан", "Смоки", "Страйкер", "Гром"]],
        ["Дальние", ["Цунами", "Скорпион", "Магнум", "Рельса", "Гаусс", "Шафт"]]];
    const HULL_GROUPS = [["Лёгкие", ["Васп", "Хоппер", "Хорнет"]], ["Средние", ["Викинг", "Крусейдер", "Хантер", "Паладин", "Диктатор"]],
        ["Тяжёлые", ["Титан", "Арес", "Мамонт"]]];
    let eSlot = Math.max(0, SLOTS.indexOf(null));
    let dragRes = null; // {from: гнездо или -1 (из списка), id}
    let hoverRes = null; // резист под мышью: 1–4 — надеть в это гнездо
    // Строка рекомендаций над резистами. Высота постоянная (в бою и вне боя), чтобы ничего не прыгало.
    function advisorRow(rec, s) {
        if (!sectionOn("advisor")) return null;
        const off = prefs.off.has("advisor");
        const toggle = editMode ? h("span", { class: `sectoggle${off ? " off" : ""}`, onclick: () => toggleSection("advisor") }, h("span", { class: "chk" })) : null;
        if (!battle) return null;
        const ranked = rankTurrets(battle.enemies);
        const used = new Set(rec.ordered.slice(0, rec.equip.length - (rec.armadillo ? 1 : 0)).map((o) => o.turret));
        return h("div", { class: `advisor${off ? " off" : ""}`, title: `${battle.map}, ${battle.mode} (демо-бой)` }, toggle,
            h("span", { class: "muted" }, "Враги"),
            h("div", { class: "threats" }, ranked.map((t) => h("span", { class: `threat${used.has(t.base) ? " top" : ""}`, title: `${t.base}: ${t.kills} убийств, ${t.carriers} ${t.carriers === 1 ? "игрок" : "игрока"}` },
                icon("weapon", t.base, true), h("b", {}, t.kills)))),
            h("span", { class: "arrow" }, "→"),
            h("div", { class: "recset" }, rec.equip.map((r) => h("span", { title: `${base(r)} ${resPct(r)}%` + (r === ARMADILLO ? " — крит, всегда первым" : ` — от ${RESIST_FOR[r]}`) }, icon("resist", r, true)))),
            rec.equip.length === 0 ? h("span", { class: "muted" }, "нет годных модулей (≥30%)")
                : rec.equipped ? (draft.slots ? h("span", { class: "tag-q recdone" }, "✓ в очереди") : h("span", { class: "tag-cur recdone" }, "✓ надето"))
                : h("button", { class: "btn go recbtn", title: "Поставить рекомендованные резисты в очередь (надетые из набора останутся в своих гнёздах)", onclick: () => { applyRecommended(rec.equip); render(); } }, "Надеть"));
    }
    // ---------- настройки: что скрыть ----------
    // Хранятся в localStorage макета (в расширении — chrome.storage). Ключи предметов: "cat|название", аугментов: "aug|предмет|название"
    const PREFS_KEY = "fast-garage.prefs";
    const prefs = (() => {
        const d = { comboAug: "fill", comboRes: true, favMode: "row", augFav: false, augLeg: false, augMix: "or", augCycle: 0 };
        try { const p = JSON.parse(localStorage.getItem(PREFS_KEY)); return { ...d, ...p, hidden: new Set(p.hidden), off: new Set(p.off), fav: new Set(p.fav) }; }
        catch { return { ...d, hidden: new Set(), off: new Set(), fav: new Set() }; }
    })();
    const savePrefs = () => localStorage.setItem(PREFS_KEY, JSON.stringify({ ...prefs, hidden: [...prefs.hidden], off: [...prefs.off], fav: [...prefs.fav] }));
    // Секции, которые можно выключить целиком
    const SECTIONS = { "aug-weapon": "Аугменты пушки", "aug-hull": "Аугменты корпуса", grenade: "Гранаты", drone: "Дроны", resist: "Резисты", combos: "Комбо" };
    let editMode = false;
    const keyOf = (cat, name) => cat + "|" + base(name);
    // Надетое и выбранное не прячем никогда — иначе не видно, что сейчас на танке
    const pinned = (cat, name) => cat === "resist" ? slots().includes(name) || SLOTS.includes(name) : name === equipped(cat) || name === MOUNTED[cat];
    // Избранное: пушки, корпуса, гранаты, дроны. Режимы: mark — только звезда, row — строка сверху, only — показывать только избранное (кнопка «Все» — на время)
    const FAV_CATS = ["weapon", "hull", "grenade", "drone"];
    let showAll = false;
    const isFav = (cat, name) => prefs.fav.has(keyOf(cat, name));
    // В режиме only категория без избранного показывается целиком
    const favFilter = (cat, name) => prefs.favMode !== "only" || showAll || editMode || !FAV_CATS.includes(cat) || isFav(cat, name) || pinned(cat, name)
        || !CATS.find((c) => c[0] === cat)[3].some((it) => isFav(cat, it));
    const shown = (cat, name) => editMode || ((!prefs.hidden.has(keyOf(cat, name)) || pinned(cat, name)) && favFilter(cat, name));
    function toggleFav(cat, name) { const k = keyOf(cat, name); prefs.fav.has(k) ? prefs.fav.delete(k) : prefs.fav.add(k); savePrefs(); render(); }
    // Звезда в углу плитки: у избранного видна всегда, у остальных — при наведении; клик не надевает
    const star = (cat, name) => !editMode && FAV_CATS.includes(cat)
        ? h("span", { class: `star${isFav(cat, name) ? " on" : ""}`, title: isFav(cat, name) ? "Убрать из избранного" : "В избранное", onclick: (e) => { e.stopPropagation(); toggleFav(cat, name); } }, isFav(cat, name) ? "★" : "☆")
        : null;
    // Избранное идёт первым в своей группе (порядок внутри — как в гараже)
    const favFirst = (cat, list) => [...list.filter((it) => isFav(cat, it)), ...list.filter((it) => !isFav(cat, it))];
    // Аугменты: своя звезда (ключ "aug|предмет|название") и фильтры в шапке — «★» (только избранные) и «Лег.» (легендарные и особые).
    // Как сочетать два фильтра — переключатель макета prefs.augMix: or — объединение, and — пересечение, cycle — одна кнопка Все → Лег.+★ → ★
    const augKey = (item, a) => "aug|" + item + "|" + a;
    const isFavAug = (item, a) => a !== null && prefs.fav.has(augKey(item, a));
    const isLeg = (item, a) => [0, 1].includes(AUGR[item + "|" + a]);
    const augFilterOn = () => prefs.augMix === "cycle" ? [prefs.augCycle === 1, prefs.augCycle >= 1] : [prefs.augLeg, prefs.augFav];
    // «Стандарт», надетый и выбранный видны всегда; у предмета без избранных аугментов фильтр ★ не действует (иначе пусто)
    function augPass(item, a) {
        if (editMode || a === null || a === augNowOf(item) || a === AUG_MOUNTED[item]) return true;
        const [wantLeg, wantFavRaw] = augFilterOn();
        const wantFav = wantFavRaw && (AUG[item] || []).some((x) => isFavAug(item, x));
        if (!wantLeg && !wantFav) return true;
        const fav = isFavAug(item, a), leg = isLeg(item, a);
        if (wantLeg && wantFav) return prefs.augMix === "and" ? fav && leg : fav || leg;
        return wantFav ? fav : leg;
    }
    function toggleFavAug(item, a) { const k = augKey(item, a); prefs.fav.has(k) ? prefs.fav.delete(k) : prefs.fav.add(k); savePrefs(); render(); }
    const augStar = (item, a) => !editMode && a !== null
        ? h("span", { class: `star${isFavAug(item, a) ? " on" : ""}`, title: isFavAug(item, a) ? "Убрать из избранного" : "В избранное", onclick: (e) => { e.stopPropagation(); toggleFavAug(item, a); } }, isFavAug(item, a) ? "★" : "☆")
        : null;
    const sectionOn = (id) => editMode || !prefs.off.has(id);
    function toggleHidden(key) { prefs.hidden.has(key) ? prefs.hidden.delete(key) : prefs.hidden.add(key); savePrefs(); render(); }
    function toggleSection(id) { prefs.off.has(id) ? prefs.off.delete(id) : prefs.off.add(id); savePrefs(); render(); }
    // Заголовок секции: в режиме настройки — с галочкой «показывать»
    const sectionTitle = (id, text) => editMode && SECTIONS[id]
        ? h("h4", { class: `sectoggle${prefs.off.has(id) ? " off" : ""}`, onclick: () => toggleSection(id) }, h("span", { class: "chk" }), text)
        : h("h4", {}, text);
    // Обёртка плитки: в режиме настройки клик прячет/показывает, в углу — галочка
    function editable(el, key, canHide = true) {
        if (!editMode) return el;
        const hid = prefs.hidden.has(key);
        el.classList.add("editing");
        if (hid) el.classList.add("hid");
        const fresh = el.cloneNode(true); // без обработчиков надевания
        if (!canHide) { fresh.classList.add("locked"); fresh.title = "Надето — не скрывается"; return fresh; }
        on(fresh, "click", () => toggleHidden(key));
        fresh.title = hid ? "Скрыто — показать" : "Скрыть";
        fresh.append(h("span", { class: "chk" }));
        return fresh;
    }
    // Кнопки фильтра аугментов в шапке; ширина постоянная, чтобы шапка не прыгала
    function augFilterButtons() {
        const set = (k, v) => { prefs[k] = v; savePrefs(); render(); };
        if (prefs.augMix === "cycle") {
            const labels = ["Все аугм.", "Лег. + ★", "★ аугм."];
            return h("span", { class: "augfilter" }, h("button", { class: `btn gear${prefs.augCycle ? " on" : ""}`, style: "min-width:82px", title: "Аугменты: все → легендарные и избранные → только избранные",
                onclick: () => set("augCycle", (prefs.augCycle + 1) % 3) }, labels[prefs.augCycle]));
        }
        return h("span", { class: "augfilter", title: prefs.augMix === "and" ? "Оба фильтра — только избранные легендарные" : "Оба фильтра — легендарные и избранные вместе" }, "Аугменты:",
            h("button", { class: `btn gear${prefs.augFav ? " on" : ""}`, title: "Только избранные аугменты", onclick: () => set("augFav", !prefs.augFav) }, "★"),
            h("button", { class: `btn gear${prefs.augLeg ? " on" : ""}`, title: "Только легендарные и особые", onclick: () => set("augLeg", !prefs.augLeg) }, "Лег."));
    }
    function renderE(emb = false) {
        emblems = emb;
        const p = h("div", { class: `panel E${emb ? " F" : ""}` });
        p.append(h("div", { class: "head" }, h("b", {}, "Fast Garage"), dataStamp(),
            editMode ? h("span", { class: "edithint" }, "Настройка: клик прячет/показывает, галочка у заголовка — вся секция. Надетое не прячется.") : null,
            h("span", { class: "keys" }, h("kbd", {}, "`"), " применить · ", h("kbd", {}, "Esc"), " отмена"),
            editMode ? null : augFilterButtons(),
            !editMode && prefs.favMode === "only" && prefs.fav.size ? h("button", { class: `btn gear${showAll ? " on" : ""}`, title: "Показать всё, не только избранное (до закрытия панели)", onclick: () => { showAll = !showAll; render(); } }, showAll ? "★ Избранное" : "Все") : null,
            editMode && (prefs.hidden.size || prefs.off.size) ? h("button", { class: "btn gear", title: "Сбросить все скрытия", onclick: () => { prefs.hidden.clear(); prefs.off.clear(); savePrefs(); render(); } }, "Показать всё") : null,
            h("button", { class: `btn gear${editMode ? " on" : ""}`, title: "Настроить: что скрыть", onclick: () => { editMode = !editMode; render(); } }, editMode ? "Готово" : "⚙")));
        if (editMode) p.classList.add("edit");
        const sq = (cat, name, label, state, onclick, extra = "") => editable(h("div", { class: `sqt ${state} ${extra}`, style: rarityStyle(cat, name), onclick }, icon(cat, name), label, star(cat, name)), keyOf(cat, name), !pinned(cat, name));
        // "cur was" — надето на танке, но в очереди другое: выглядит как надетое, чтобы было видно, что стоит сейчас
        const stateOf = (cat, it) => it === equipped(cat) ? (draft.equip[cat] ? "q" : "cur") : it === MOUNTED[cat] ? "cur was" : "";
        // Колонка: группы предметов + под ними полоса аугментов фиксированной высоты (клик по предмету меняет только её)
        const column = (cat, title, list) => {
            const items = CATS.find((c) => c[0] === cat)[3].filter((it) => shown(cat, it));
            const col = h("div", { class: "col" }, h("h4", {}, title));
            for (const [, names] of list) {
                const own = favFirst(cat, names.map((n) => items.find((it) => base(it) === n)).filter(Boolean));
                if (!own.length) continue;
                col.append(h("div", { class: "grp" },
                    h("div", { class: "sqs" }, own.map((it) => sq(cat, it, base(it), stateOf(cat, it), () => { equip(cat, it); render(); })))));
            }
            const b = base(equipped(cat)), now = augNow(cat), orig = AUG_MOUNTED[b] ?? null;
            augCtx = b;
            // Высота полосы — под самый длинный список аугментов в колонке, ширина — под самую длинную группу
            const perRow = Math.max(...list.map(([, names]) => names.filter((n) => items.some((it) => base(it) === n)).length));
            // Не уже 6 аугментов в ряд: при скрытых/только избранных предметах колонка узкая, а полоса не должна вытягиваться в высоту
            const AUG_SIZE = 52, AUG_GAP = 6, width = Math.max(perRow * 70 - 4, 6 * (AUG_SIZE + AUG_GAP) - AUG_GAP);
            const augPerRow = Math.floor((width + AUG_GAP) / (AUG_SIZE + AUG_GAP));
            // Группы по редкости, каждая с новой строки; последняя — «Стандарт» и AUG_LAST
            // Первая строка — избранные аугменты; filtered=false — для расчёта высоты: фильтры ★/Лег. полосу не сжимают
            const groupsOf = (item, filtered = true) => {
                const all = (AUG[item] || []).filter((a) => editMode || !prefs.hidden.has("aug|" + item + "|" + a) || a === augNowOf(item) || a === AUG_MOUNTED[item]);
                const list = filtered ? all.filter((a) => augPass(item, a)) : all;
                const key = (a) => item + "|" + a;
                const favs = list.filter((a) => isFavAug(item, a));
                const main = list.filter((a) => !AUG_LAST.includes(a) && !isFavAug(item, a));
                const out = RARITY_ROWS.map((row) => row.flatMap((r) => main.filter((a) => AUGR[key(a)] === r).sort((x, y) => AUGP[key(x)] - AUGP[key(y)]))).filter((g) => g.length);
                const rest = main.filter((a) => !RARITY_ROWS.flat().includes(AUGR[key(a)]));
                if (rest.length) out.push(rest);
                out.push([null, ...list.filter((a) => AUG_LAST.includes(a) && !isFavAug(item, a))]);
                if (favs.length) out.unshift(favs);
                return out;
            };
            const rowsOf = (item) => groupsOf(item, false).reduce((n, g) => n + Math.ceil(g.length / augPerRow), 0);
            const rows = Math.max(...items.map((it) => rowsOf(base(it))));
            if (!sectionOn("aug-" + cat)) return col;
            const strip = h("div", { class: `augstrip${prefs.off.has("aug-" + cat) ? " off" : ""}`, style: `height:${rows * (AUG_SIZE + AUG_GAP) + 12}px` },
                editMode ? h("span", { class: `sectoggle mini${prefs.off.has("aug-" + cat) ? " off" : ""}`, title: SECTIONS["aug-" + cat], onclick: () => toggleSection("aug-" + cat) }, h("span", { class: "chk" }), "аугменты") : null);
            // Без купленных аугментов — только «Стандарт» (надет), полоса не пустая
            // Аугмент — только восьмиугольник, название во всплывающей подсказке; состояние — контур по форме иконки
            strip.append(h("div", { class: "octs", style: `width:${width}px` }, groupsOf(b).map((g) => h("div", { class: "sqs wrap octrow" }, g.map((a) => editable(h("div", {
                class: `oct ${a === now ? (a === orig ? "cur" : "q") : a === orig ? "cur was" : ""}`, title: a ?? "Стандартные настройки",
                // «Стандарт» — только показывает, что аугмента нет: команду «снять аугмент» мы пока не знаем
                onclick: () => { if (a === null && orig !== null) return; setAug(cat, a); render(); },
            }, icon("aug", a ?? "без аугмента"), augStar(b, a)), "aug|" + b + "|" + a, a !== null && a !== now && a !== orig))))));
            col.append(strip);
            return col;
        };
        const top = h("div", { class: "cols" }, column("weapon", "Пушки", WEAPON_GROUPS), column("hull", "Корпуса", HULL_GROUPS));
        // Строка избранного: один клик — надеть; порядок — пушки, корпуса, гранаты, дроны (внутри — как в гараже)
        const favs = FAV_CATS.flatMap((cat) => CATS.find((c) => c[0] === cat)[3].filter((it) => isFav(cat, it) && !prefs.hidden.has(keyOf(cat, it))).map((it) => [cat, it]));
        const favRow = !editMode && prefs.favMode === "row" && favs.length
            ? h("div", { class: "favrow" }, h("h4", {}, "★ Избранное"), h("div", { class: "sqs" }, favs.map(([cat, it]) => sq(cat, it, base(it), stateOf(cat, it), () => { equip(cat, it); render(); }))))
            : null;
        const bottom = h("div", { class: "bottom" });
        for (const cat of ["grenade", "drone"]) {
            const [, , many, all] = CATS.find((c) => c[0] === cat);
            if (!sectionOn(cat)) continue;
            const items = favFirst(cat, all.filter((it) => shown(cat, it)));
            bottom.append(h("div", { class: prefs.off.has(cat) ? "off" : "" }, sectionTitle(cat, many), h("div", { class: `sqs cols-${cat}` }, items.map((it) => sq(cat, it, base(it), stateOf(cat, it), () => { equip(cat, it); render(); })))));
        }
        // Резисты: слева гнёзда (что надето), справа все резисты — статичный список, ничего не исчезает и не переставляется.
        // Клик по надетому — снять (его гнездо становится активным); по свободному — в активное гнездо (синее).
        const s = slots();
        // Перетаскивание: резист из списка — в гнездо, гнездо — в гнездо (обмен), гнездо — в список (снять). Клики работают как раньше.
        const dropZone = (onDrop, ok = () => true) => editMode ? {} : {
            ondragover: (e) => { if (!dragRes || !ok()) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; e.currentTarget.classList.add("over"); },
            ondragleave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.classList.remove("over"); },
            ondrop: (e) => { e.preventDefault(); e.stopPropagation(); const d = dragRes; dragRes = null; onDrop(d); render(); },
        };
        const dragSrc = (from, id) => editMode || !id ? {} : {
            draggable: "true",
            ondragstart: (e) => { dragRes = { from, id }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", base(id)); e.currentTarget.closest(".resbox").classList.add("dragging"); },
            ondragend: () => { if (dragRes) { dragRes = null; render(); } },
        };
        const wells = h("div", { class: "wells" }, s.map((id, n) => h("div", {
            class: `well${eSlot === n ? " sel" : ""}${draft.slots && id !== SLOTS[n] ? " q" : ""}${id ? "" : " empty"}`,
            title: (id ? base(id) + " — " : "") + (eSlot === n ? "сюда встанет следующий выбранный резист" : "выбрать гнездо") + (id ? "; перетащить — в другое гнездо или в список (снять)" : "; можно перетащить сюда резист"),
            onclick: () => { eSlot = n; render(); },
            ...dragSrc(n, id),
            ...dropZone((d) => { setSlot(n, d.id); if (d.from >= 0 && d.from !== n && !slots()[d.from]) eSlot = d.from; else if (firstEmpty() >= 0 && eSlot === n) eSlot = firstEmpty(); }),
        }, h("span", { class: "num" }, n + 1), id ? icon("resist", id) : null, id ? h("span", { class: `pct${resPct(id) < 50 ? " low" : ""}` }, resPct(id) + "%") : h("span", { class: "lbl" }, "пусто"))),
            // Закрытые гнёзда (на аккаунте открыто меньше 4) — заглушки, чтобы сетка не менялась
            Array.from({ length: 4 - s.length }, () => h("div", { class: "well locked", title: "Гнездо не открыто на этом аккаунте" }, h("span", { class: "lbl" }, "закрыто"))));
        const rec = battle ? recommendResists(rankTurrets(battle.enemies), RESISTS, s) : null;
        const all = h("div", { class: "resgrid", ...dropZone((d) => { setSlot(d.from, null); eSlot = d.from; }, () => dragRes.from >= 0) }, RESISTS.filter((r) => shown("resist", r)).map((r) => {
            const n = s.indexOf(r);
            const state = (n < 0 ? (SLOTS.includes(r) ? "cur was" : "") : draft.slots && SLOTS[n] !== r ? "q" : "cur") + (rec && sectionOn("advisor") && rec.equip.includes(r) ? " rec" : "");
            return editable(h("div", {
                class: `sqt ${state}`, title: `${base(r)} — ` + (n < 0 ? `надеть в гнездо ${eSlot + 1}` : `снять (гнездо ${n + 1})`) + "; перетащить в гнездо или навести и нажать 1–4",
                ...dragSrc(n, r), onmouseenter: () => (hoverRes = r), onmouseleave: () => { if (hoverRes === r) hoverRes = null; },
                onclick: () => {
                    if (n >= 0) { setSlot(n, null); eSlot = n; }
                    else { setSlot(eSlot, r); if (firstEmpty() >= 0) eSlot = firstEmpty(); }
                    render();
                },
            }, n >= 0 ? h("span", { class: "slotno" }, n + 1) : null, icon("resist", r), h("span", { class: `pct${resPct(r) < 50 ? " low" : ""}` }, resPct(r) + "%")), keyOf("resist", r), !pinned("resist", r));
        }));
        if (sectionOn("resist")) bottom.append(h("div", { class: prefs.off.has("resist") ? "off" : "" }, sectionTitle("resist", "Резисты"), advisorRow(rec, s), h("div", { class: "resbox" }, wells, all)));
        p.append(h("div", { class: "body" }, comboColumn(), h("div", { class: "main" }, favRow, top, bottom)));
        p.append(h("div", { class: "foot" }, diffView(), cancelBtn(), applyBtn()));
        return p;
    }
    // ---------- комбо: формат isra (TankiComboManager 5.0, CLAUDE.mds/combos.md) ----------
    // В расширении — chrome.storage.local.savedCombos, тот же ключ и та же запись, что у isra: [{id, name, date, order, language, data, removedItems?}].
    // Общим хранилище двух расширений не сделать (chrome.storage у каждого своё), поэтому совместимость — через одинаковый формат и импорт/экспорт.
    // Сохраняем gen-2: {turret, turretAugment, turretSkin, hull, hullAugment, hullSkin, grenade, drone, paint, protection[4 по гнёздам]},
    // элемент — {id, baseItemId, name, image}. Читаем и gen-1 (только name + image, резисты без пустых гнёзд) — сопоставляем по названию.
    // В макете — localStorage; при пустом — 8 настоящих комбо silly из клиента Tweaks (июнь, gen-1). ?resetcombos — вернуть их.
    const COMBOS_KEY = "fast-garage.combos";
    const LANG = "ru";
    let combos = (() => { try { return JSON.parse(localStorage.getItem(COMBOS_KEY)) ?? structuredClone(SEED_COMBOS); } catch { return structuredClone(SEED_COMBOS); } })();
    const saveCombos = () => localStorage.setItem(COMBOS_KEY, JSON.stringify(combos));
    const myCombos = () => combos.filter((c) => (c.language || "en") === LANG).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const normName = (s) => String(s ?? "").trim().toUpperCase().replace(/Ё/g, "Е");
    const SLOT_CAT = { turret: "weapon", hull: "hull", grenade: "grenade", drone: "drone" };
    const AUG_SLOT = { turretAugment: "turret", hullAugment: "hull" };
    const removed = (c, slot) => (c.removedItems || {})[slot] === true;
    // Предмет комбо -> название в гараже; undefined — слот не записан (не трогаем), null — такого предмета нет в гараже
    function resolveItem(cat, e) {
        if (!e) return undefined;
        if (e.baseItemId != null) { const hit = BY_BASE[cat + "|" + e.baseItemId]; if (hit) return hit; }
        const all = cat === "resist" ? RESISTS : CATS.find((c) => c[0] === cat)[3];
        return all.find((n) => normName(n) === normName(e.name)) ?? null;
    }
    // Аугмент: ключ — id (baseItemId у аугмента — это его пушка/корпус, не уникален), иначе название внутри своего предмета
    function resolveAug(item, e) {
        if (!e) return undefined;
        if (!item) return null;
        if (e.id != null) { const hit = AUG_BY_ID[item + "|" + e.id]; if (hit) return hit; }
        return (AUG[item] || []).map((a) => a.n ?? a).find((a) => normName(a) === normName(e.name)) ?? null;
    }
    // Что комбо наденет: {weapon, hull, grenade, drone, aug: {weapon, hull}, protection: [4] | undefined, missing: [названия]}
    function resolveCombo(c) {
        const d = c.data || {}, out = { aug: {}, missing: [] };
        for (const [slot, cat] of Object.entries(SLOT_CAT)) {
            if (removed(c, slot)) continue;
            const r = resolveItem(cat, d[slot]);
            if (r === null) out.missing.push(d[slot].name);
            if (r) out[cat] = r;
        }
        for (const [slot, owner] of Object.entries(AUG_SLOT)) {
            if (removed(c, slot)) continue;
            const cat = SLOT_CAT[owner], item = out[cat] ?? (d[owner] ? null : equipped(cat));
            const r = resolveAug(item && base(item), d[slot]);
            if (r === null) out.missing.push(d[slot].name);
            if (r) out.aug[cat] = r;
        }
        if (Array.isArray(d.protection) && !removed(c, "protection")) {
            const skip = (c.removedItems || {}).protection || [];
            // gen-2 — по гнёздам (null = пустое), gen-1 — подряд
            const list = d.protection.map((p, i) => (skip.includes(i) ? null : p)).slice(0, SLOT_COUNT);
            out.protection = [...list, null, null, null, null].slice(0, SLOT_COUNT).map((p) => {
                const r = p ? resolveItem("resist", p) : null;
                if (p && !r) out.missing.push(p.name);
                return r || null;
            });
        }
        return out;
    }
    // Совпадает ли комбо с состоянием: mounted=true — с надетым, иначе — с тем, что на экране (с очередью)
    function comboMatches(r, mounted) {
        const eq = (cat) => mounted ? MOUNTED[cat] : equipped(cat);
        for (const cat of Object.values(SLOT_CAT)) if (r[cat] && base(eq(cat)) !== r[cat]) return false;
        for (const [cat, a] of Object.entries(r.aug)) { const b = r[cat] ?? base(eq(cat)); if ((mounted ? AUG_MOUNTED[b] ?? null : augNowOf(b)) !== a) return false; }
        if (prefs.comboRes && r.protection) {
            const want = r.protection.filter(Boolean), have = (mounted ? SLOTS : slots()).filter(Boolean);
            if (want.length !== have.length || want.some((x) => !have.includes(x))) return false;
        }
        return true;
    }
    // Надеть = поставить в очередь (как ручные изменения); двойной клик — сразу применить
    function loadCombo(c) {
        const r = resolveCombo(c);
        clearDraft();
        for (const cat of Object.values(SLOT_CAT)) if (r[cat]) equip(cat, r[cat]);
        for (const [cat, a] of Object.entries(r.aug)) setAug(cat, a);
        if (prefs.comboRes && r.protection) {
            // Резисты — как набор: уже надетые остаются в своих гнёздах, остальные — в свободные (как «Надеть» у советника)
            const want = r.protection.filter(Boolean), s = SLOTS.map((x) => (want.includes(x) ? x : null));
            for (const x of want) if (!s.includes(x) && s.includes(null)) s[s.indexOf(null)] = x;
            draft.slots = s.every((x, i) => x === SLOTS[i]) ? null : s;
        }
    }
    // Запись предмета как у isra InstantSaver (pickItem / pickPlain)
    const itemEntry = (cat, name) => { const [id, b] = IDS.item[cat + "|" + name] || []; return { id: id ?? null, baseItemId: b ?? null, name, image: ICONS[name] ?? null }; };
    const augEntry = (cat, item, a) => a == null ? null : { id: IDS.aug[item + "|" + a] ?? null, name: a, image: AUGI[item + "|" + a] ?? null, baseItemId: (IDS.item[cat + "|" + item] || [])[1] ?? null };
    function currentComboData() {
        const w = base(equipped("weapon")), hl = base(equipped("hull")), s = slots();
        return {
            turret: itemEntry("weapon", w), turretAugment: augEntry("weapon", w, augNowOf(w)), turretSkin: null,
            hull: itemEntry("hull", hl), hullAugment: augEntry("hull", hl, augNowOf(hl)), hullSkin: null,
            grenade: itemEntry("grenade", base(equipped("grenade"))), drone: itemEntry("drone", base(equipped("drone"))), paint: null,
            protection: s.some(Boolean) ? s.map((r) => (r ? itemEntry("resist", r) : null)) : null,
        };
    }
    // isra ComboIdentity.isSameCombo: семейство (baseItemId, иначе id, иначе название) для предметов, точный id для аугментов, резисты — набор
    function sameCombo(a, b) {
        const fam = (x, y) => (!x || !y ? !x && !y : x.baseItemId != null && y.baseItemId != null ? String(x.baseItemId) === String(y.baseItemId) : x.id != null && y.id != null ? String(x.id) === String(y.id) : normName(x.name) !== "" && normName(x.name) === normName(y.name));
        const exact = (x, y) => (!x || !y ? !x && !y : x.id != null && y.id != null ? String(x.id) === String(y.id) : normName(x.name) !== "" && normName(x.name) === normName(y.name));
        const ent = (c, k) => (removed(c, k) ? null : (c.data || {})[k] || null);
        for (const k of ["turret", "hull", "grenade", "drone"]) if (!fam(ent(a, k), ent(b, k))) return false;
        for (const k of ["turretAugment", "hullAugment"]) if (!exact(ent(a, k), ent(b, k))) return false;
        const prot = (c) => (removed(c, "protection") ? [] : ((c.data || {}).protection || []).filter((p, i) => p && !((c.removedItems || {}).protection || []).includes(i)));
        const x = prot(a), y = prot(b);
        if (x.length !== y.length) return false;
        const used = y.map(() => false);
        return x.every((p) => { const i = y.findIndex((q, k) => !used[k] && fam(p, q)); if (i < 0) return false; used[i] = true; return true; });
    }
    let comboToast = null; // {text, undo}
    function flash(text, undo) {
        comboToast = { text, undo };
        clearTimeout(flash.t); flash.t = setTimeout(() => { comboToast = null; render(); }, undo ? 10000 : 3000);
    }
    // Сохранить то, что на экране (с очередью). Как у isra: новое — первым, такое же старое удаляется, имя переходит к новому
    function saveCurrentCombo() {
        const data = currentComboData(), fresh = { data, removedItems: {} };
        const dup = combos.find((c) => (c.language || "en") === LANG && sameCombo(c, fresh));
        combos = combos.filter((c) => c !== dup);
        combos.forEach((c) => { if (c.order !== undefined && (c.language || "en") === LANG) c.order += 1; });
        const name = dup ? dup.name : `Комбо ${myCombos().length + 1}`;
        combos.push({ id: Date.now(), name, date: new Date().toLocaleDateString(), order: 0, language: LANG, data });
        renaming = dup ? null : combos.at(-1).id; // новое — сразу с полем для имени
        saveCombos();
        flash(dup ? `«${name}» обновлено и поднято наверх` : "Сохранено");
    }
    function deleteCombo(c) {
        const at = combos.indexOf(c);
        combos.splice(at, 1); saveCombos();
        flash(`Удалено «${c.name}»`, () => { combos.splice(at, 0, c); saveCombos(); });
    }
    function renameCombo(c, name) { name = name.trim(); if (name && name !== c.name) { c.name = name; saveCombos(); } renaming = null; render(); }
    // Перетаскивание карточек меняет order (как у isra)
    function moveCombo(from, to) {
        const list = myCombos(), [c] = list.splice(from, 1);
        list.splice(to, 0, c);
        list.forEach((x, i) => (x.order = i));
        saveCombos();
    }
    // Экспорт/импорт — файл как у isra: JSON-массив комбо текущего языка; isra его импортирует, а мы — его файлы
    function exportCombos() {
        const blob = new Blob([JSON.stringify(myCombos(), null, 2)], { type: "application/json" });
        const a = h("a", { href: URL.createObjectURL(blob), download: `tanki-combos-${new Date().toISOString().slice(0, 10)}.json` });
        a.click(); URL.revokeObjectURL(a.href);
    }
    function importCombos(text) {
        let list;
        try { list = JSON.parse(text); } catch { return flash("Не JSON — это не файл комбо"); }
        if (!Array.isArray(list) || !list.length || !list.every((c) => c && c.data && typeof c.data === "object")) return flash("Не файл комбо (нужен экспорт isra или Fast Garage)");
        if (!list.every((c) => (c.language || "en") === LANG)) return flash("Комбо сохранены на другом языке игры — названия не совпадут");
        // Добавляем в конец; такие же, как уже есть, пропускаем (isra спрашивает «заменить/добавить» — здесь без вопроса: дублей не будет, удалить лишнее — один клик)
        let order = Math.max(-1, ...myCombos().map((c) => c.order ?? 0)) + 1, added = 0;
        list.forEach((c, i) => {
            if (myCombos().some((x) => sameCombo(x, c))) return;
            combos.push({ ...c, id: Date.now() + i, order: order++ });
            added++;
        });
        saveCombos();
        flash(`Импортировано: ${added}` + (list.length > added ? `, уже были: ${list.length - added}` : ""));
    }
    function pickImport() {
        const input = h("input", { type: "file", accept: ".json,application/json" });
        input.onchange = () => input.files[0]?.text().then((t) => { importCombos(t); render(); });
        input.click();
    }
    let renaming = null, dragFrom = null;
    // Колонка комбо: фиксированная ширина, высота — как у основной части (список прокручивается), поэтому панель не прыгает
    function comboColumn() {
        if (!sectionOn("combos")) return null;
        const off = prefs.off.has("combos");
        const mini = (cls, url, title, miss) => h("span", { class: `ci ${cls}${miss ? " miss" : ""}`, title }, url ? h("img", { src: url, decoding: "sync" }) : null);
        const card = (c, i) => {
            const r = resolveCombo(c), d = c.data || {};
            const state = comboMatches(r, true) ? "cur" : comboMatches(r, false) ? "q" : "";
            const pic = (cat, slot) => {
                const name = r[cat], e = d[slot];
                if (removed(c, slot) || (!name && !e)) return mini("ci-empty", null, "не записано");
                return mini(cat === "weapon" || cat === "hull" ? "ci-emb" : `ci-wide ci-${cat}`, name ? (emblems && EMBLEM[name]) || ICONS[name] : e.image, name ?? `нет в гараже: ${e.name}`, !name);
            };
            const augPic = (cat, slot) => {
                const a = r.aug[cat], e = d[slot], item = r[cat];
                if (removed(c, slot) || !e) return mini("ci-aug ci-empty", null, "аугмент не записан");
                const glyph = a && AUG_GLYPH[item + "|" + a];
                if (!glyph) return mini("ci-aug", a ? AUGI[item + "|" + a] : e.image, a ?? `нет в гараже: ${e.name}`, !a);
                // Значок из оверлея; цвет — редкость (переключатель «Аугм. в комбо»: заливка / кольцо / белые)
                const clean = glyphUrl(glyph), url = clean ? `url("${clean}")` : "none"; // пока не загружен — пустое место того же размера
                return h("span", { class: `ci ci-aug ci-glyph g-${prefs.comboAug}`, title: a, style: `--gc:${GLYPH_COLOR[AUGR[item + "|" + a]] ?? "#fff"}` },
                    h("span", { class: "g", style: `-webkit-mask-image:${url};mask-image:${url}` }));
            };
            const res = r.protection ?? [];
            if (renaming === c.id) requestAnimationFrame(() => { const el = shadow.querySelector(".combo input.cname"); if (el && document.activeElement !== el) { el.focus(); el.select(); } });
            const nameEl = renaming === c.id
                ? h("input", { class: "cname", value: c.name, onclick: (e) => e.stopPropagation(), ondblclick: (e) => e.stopPropagation(),
                    onkeydown: (e) => { e.stopPropagation(); if (e.key === "Enter") renameCombo(c, e.target.value); if (e.key === "Escape") { renaming = null; render(); } },
                    onblur: (e) => { if (e.target.isConnected && renaming === c.id) renameCombo(c, e.target.value); } })
                : h("span", { class: "cname" }, c.name);
            return h("div", {
                class: `combo ${state}`, draggable: renaming === c.id || editMode ? null : "true",
                title: (state === "cur" ? "Надето. " : state === "q" ? "В очереди — ` применить. " : "") + "Клик — в очередь, двойной клик — надеть сразу, перетащить — порядок" + (r.missing.length ? `\nНет в гараже: ${r.missing.join(", ")}` : ""),
                onclick: () => { if (!editMode) { loadCombo(c); render(); } },
                ondblclick: () => { if (editMode) return; loadCombo(c); applyAndClose(); },
                ondragstart: (e) => { dragFrom = i; e.dataTransfer.effectAllowed = "move"; e.currentTarget.classList.add("dragging"); },
                ondragend: () => { dragFrom = null; render(); },
                ondragover: (e) => { if (dragFrom === null) return; e.preventDefault(); e.currentTarget.classList.toggle("dropabove", dragFrom > i); e.currentTarget.classList.toggle("dropbelow", dragFrom < i); },
                ondragleave: (e) => e.currentTarget.classList.remove("dropabove", "dropbelow"),
                ondrop: (e) => { e.preventDefault(); if (dragFrom !== null && dragFrom !== i) moveCombo(dragFrom, i); dragFrom = null; render(); },
            },
                h("div", { class: "ctop" }, nameEl, r.missing.length ? h("span", { class: "cwarn", title: `Нет в гараже: ${r.missing.join(", ")}` }, "!") : null,
                    renaming === c.id ? null : h("span", { class: "cdel", title: "Переименовать", onclick: (e) => { e.stopPropagation(); renaming = c.id; render(); }, ondblclick: (e) => e.stopPropagation() }, "✎"),
                    h("span", { class: "cdel", title: "Удалить (можно вернуть)", ondblclick: (e) => e.stopPropagation(), onclick: (e) => { e.stopPropagation(); deleteCombo(c); render(); } }, "×")),
                h("div", { class: "cicons" }, pic("weapon", "turret"), augPic("weapon", "turretAugment"), h("span", { class: "csep" }), pic("hull", "hull"), augPic("hull", "hullAugment"),
                    pic("grenade", "grenade"), pic("drone", "drone"),
                    h("span", { class: `cres${prefs.comboRes ? "" : " skip"}` }, [0, 1, 2, 3].map((n) => res[n] ? mini("ci-res", ICONS[res[n]], res[n]) : mini("ci-res ci-empty", null, Array.isArray(d.protection) && d.protection[n] && !res[n] ? `нет в гараже: ${d.protection[n].name}` : "пусто", Array.isArray(d.protection) && !!d.protection[n] && !res[n])))));
        };
        const list = myCombos();
        const t = comboToast;
        return h("div", { class: `combos${off ? " off" : ""}` },
            h("div", { class: "chead" }, sectionTitle("combos", "Комбо"),
                h("button", { class: "btn csave", title: "Сохранить то, что сейчас на экране (с очередью). Такое же комбо поднимется наверх", onclick: () => { saveCurrentCombo(); render(); } }, "+ Сохранить")),
            h("div", { class: "clist" }, list.length ? list.map(card) : h("div", { class: "muted cempty" }, "Пока пусто. «+ Сохранить» — запомнить то, что надето, или «Импорт» — файл из isra")),
            h("div", { class: "cfoot" },
                t ? h("span", { class: "ctoast" }, t.text, t.undo ? h("a", { onclick: () => { t.undo(); comboToast = null; render(); } }, " Вернуть") : null)
                  : [h("label", { class: "cresopt", title: "Надевать резисты из комбо (у isra — «equip protections on load»)" }, h("input", { type: "checkbox", checked: prefs.comboRes || null, onchange: (e) => { prefs.comboRes = e.target.checked; savePrefs(); render(); } }), "резисты"),
                     h("button", { class: "btn", title: "Загрузить файл экспорта isra или Fast Garage", onclick: pickImport }, "Импорт"),
                     h("button", { class: "btn", title: "Скачать комбо файлом — его импортирует isra", onclick: exportCombos, disabled: list.length ? null : "" }, "Экспорт")]));
    }
    // ---------- в игре: shadow DOM, клавиши, применение ----------
    const TOGGLE_KEY = "Backquote"; // ` / ё: открыть панель; повторно — применить и закрыть
    let host = null, shadow = null, stage = null, toastEl = null, open = false, dirty = true, idleRender = 0;
    let stale = true; // данные garage.js изменились — пересобрать (sync) перед отрисовкой
    const firstEmpty = () => slots().indexOf(null);

    // Очередь панели (по названиям) -> очередь garage.js (записи и ID) -> fg.apply: открыть гараж, отправить, закрыть
    function commit() {
        const d = fg.draft, st = fg.state;
        d.clear();
        for (const [cat, name] of Object.entries(draft.equip)) { const r = REC.item[cat + "|" + name]; if (r) d.equip.set(CAT_ID[cat], r); }
        if (draft.slots && st.slots) {
            // Надетый резист — его же ID (модификация на танке), новый — из своих
            const ids = draft.slots.map((n) => n === null ? null : SLOTS.includes(n) ? st.slots[SLOTS.indexOf(n)] : REC.item["resist|" + n]?.id ?? null);
            d.slots = ids.every((x, i) => x === st.slots[i]) ? null : ids;
        }
        for (const [item, a] of Object.entries(draft.aug)) {
            const owner = REC.item["weapon|" + item] ?? REC.item["hull|" + item], dev = a === null ? null : REC.aug[item + "|" + a];
            if (owner && dev) d.augments.set(fg.key(owner.base), dev.id);
        }
        const saved = structuredClone(draft);
        clearDraft();
        // Таймер смены выяснился только из каталога — возвращаем очередь, если новую ещё не набрали
        Promise.resolve(fg.apply()).then((result) => {
            if (result !== "locked" || changes().length) return;
            Object.assign(draft, saved);
            open ? render() : renderLater();
        });
    }
    function applyAndClose() {
        if (!changes().length) return close();
        const { left } = fg.lock();
        if (left) return status(`🔒 изменения доступны через ${fg.clock(left)}`, 3000);
        commit();
        close();
    }
    // Скорость: панель рисуется заранее, пока скрыта (в свободное время), открытие — только видимость.
    // Новый DOM панели — ~50 мс (построение + стили), переключение видимости — доли миллисекунды
    function close() {
        open = false;
        host.style.visibility = "hidden";
        // Ничего не меняли — готовая панель годится и для следующего открытия
        const slot = Math.max(0, firstEmpty());
        if (!changes().length && !editMode && !showAll && renaming === null && eSlot === slot) return;
        clearDraft(); editMode = false; showAll = false; renaming = null;
        eSlot = slot;
        renderLater();
    }
    // Пока открыта и идёт таймер смены — обновляем остаток на кнопке
    const lockKey = () => { const l = fg.lock(); return l.left + "|" + l.unknown; };
    let lockShown = "", lockTimer = 0;
    function show() {
        open = true;
        document.exitPointerLock?.();
        if (dirty || lockKey() !== lockShown) render();
        clearInterval(lockTimer);
        lockTimer = setInterval(() => { if (!open) clearInterval(lockTimer); else if (lockKey() !== lockShown) render(); }, 1000);
        host.style.visibility = "visible";
        fit();
    }
    function renderLater() {
        dirty = true;
        if (idleRender) return;
        const run = () => { idleRender = 0; if (dirty && !open) render(); };
        idleRender = globalThis.requestIdleCallback ? requestIdleCallback(run, { timeout: 2000 }) : setTimeout(run, 200);
    }

    // Время данных и журнал обновлений — в шапке (подсказка)
    function dataStamp() {
        const log = fg.journal, last = log.at(-1);
        const time = last ? new Date(last.time).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
        return h("span", { class: "muted", title: log.slice().reverse().map((e) => `${new Date(e.time).toLocaleTimeString("ru-RU")}  ${e.text}`).join("\n") },
            (fg.garage ? "гараж открыт" : "из кэша") + (time ? " · " + time : ""));
    }

    function render() {
        if (!stage) return; // ещё не смонтирована: данные пришли раньше DOMContentLoaded
        const started = performance.now();
        try { draw(); } finally { globalThis.__packetLogger?.mark?.("fast-garage: панель" + (open ? "" : " (фон)"), performance.now() - started); }
    }
    function draw() {
        dirty = false;
        lockShown = lockKey();
        if (stale) { sync(); stale = false; }
        if (!fg.state.depot) {
            stage.replaceChildren(h("div", { class: "panel E F" }, h("div", { class: "head" }, h("b", {}, "Fast Garage"), h("span", { class: "keys" }, h("kbd", {}, "Esc"), " закрыть")),
                h("div", { class: "main", style: "padding:16px 14px" }, "Нет данных о гараже: открой гараж игры один раз — дальше панель работает из кэша.")));
            fit();
            return;
        }
        const el = renderE(true), old = stage.firstChild;
        if (old?.classList.contains("E") && old.querySelector(".body")) morph(old, el);
        else stage.replaceChildren(el);
        for (const img of stage.querySelectorAll("img:not([src])")) img.src = img.dataset.src;
        fit();
    }
    // Панель целиком на экране: при маленьком окне — уменьшаем
    function fit() {
        const p = stage.firstChild;
        if (!p) return;
        const k = Math.min(1, (innerWidth - 16) / p.offsetWidth, (innerHeight - 16) / p.offsetHeight);
        p.style.transform = `translate(-50%,-50%)` + (k < 1 ? ` scale(${k})` : "");
    }

    function status(text, hideAfter = 0) {
        if (!toastEl) return;
        clearTimeout(status.timer);
        toastEl.textContent = text;
        toastEl.style.display = "block";
        if (hideAfter) status.timer = setTimeout(() => { toastEl.style.display = "none"; }, hideAfter);
    }

    // Картинки — заранее: загружены и декодированы до открытия панели, ничего не мигает
    const preloaded = new Map();
    function preload() {
        if (stale) { sync(); stale = false; }
        const urls = [...Object.values(ICONS), ...Object.values(AUGI), ...Object.values(EMBLEM)].filter(Boolean);
        for (const src of urls) {
            if (preloaded.has(src)) continue;
            const img = new Image();
            img.src = src;
            img.decode().catch(() => {});
            preloaded.set(src, img);
        }
        Object.values(AUG_GLYPH).forEach(glyphUrl);
    }

    function mount() {
        host = document.createElement("div");
        host.style.cssText = "position:fixed;inset:0;z-index:2147483647;visibility:hidden;pointer-events:none";
        shadow = host.attachShadow({ mode: "open" });
        shadow.append(h("style", {}, CSS + `
            :host { all: initial; }
        * { box-sizing: border-box; }
            .root { position: fixed; inset: 0; font: 13px "Segoe UI", Rubik, sans-serif; color: #e8ecef; }
            .root .panel { pointer-events: auto; }
        .root .E { max-height: none; } /* не прокрутка, а масштаб под окно (fit) */
            .fg-toast { position: fixed; right: 10px; bottom: 40px; display: none; padding: 6px 10px; border-radius: 6px; background: rgba(0,0,0,.85);
                color: #fff; font: 12px "Segoe UI", sans-serif; max-width: 480px; pointer-events: none; }`));
        stage = h("div", { class: "root hl-dim" });
        shadow.append(stage);
        // Мышь и клавиши внутри панели — не игре
        for (const type of ["mousedown", "mouseup", "click", "dblclick", "wheel", "contextmenu", "pointerdown", "pointerup", "keydown", "keyup", "keypress"]) {
            host.addEventListener(type, (e) => e.stopPropagation());
        }
        toastEl = h("div", { class: "fg-toast" });
        const toastHost = document.createElement("div");
        toastHost.attachShadow({ mode: "open" }).append(h("style", {}, ".fg-toast{position:fixed;right:10px;bottom:40px;z-index:2147483647;display:none;padding:6px 10px;border-radius:6px;background:rgba(0,0,0,.85);color:#fff;font:12px 'Segoe UI',sans-serif;max-width:480px;pointer-events:none}"), toastEl);
        document.body.append(host, toastHost);
        addEventListener("resize", () => { if (open) fit(); });
        addEventListener("keydown", (e) => {
            const target = e.composedPath()[0];
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
            const eat = () => { e.preventDefault(); e.stopPropagation(); };
            if (e.code === TOGGLE_KEY && !e.ctrlKey && !e.altKey && !e.metaKey) {
                eat();
                if (open) applyAndClose(); else show();
            } else if (!open) {
                return;
            } else if (e.code === "Escape") {
                eat();
                close();
            } else if (hoverRes && !editMode && /^Digit[1-4]$/.test(e.code) && +e.code.slice(5) <= SLOT_COUNT) {
                // Цифры в бою — расходники: перехватываем только при открытой панели и резисте под мышью
                eat();
                const n = +e.code.slice(5) - 1;
                setSlot(n, slots()[n] === hoverRes ? null : hoverRes);
                if (firstEmpty() >= 0) eSlot = firstEmpty();
                render();
            }
        }, true);
        preload();
        render();
    }

    fg.ui = {
        // Данные изменились (каталог, установка, кэш): перерисовать, если открыта; картинки — подгрузить заранее
        update() {
            stale = true;
            if (open) render(); else renderLater();
            clearTimeout(this.idle);
            this.idle = setTimeout(preload, 300);
        },
        status,
        get open() { return open; },
    };
    if (document.body) mount();
    else addEventListener("DOMContentLoaded", mount, { once: true });

})();
