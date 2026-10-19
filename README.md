# Silly Tanks

English · [Русский](README.ru.md)

A QoL extension for Tanki Online. One extension with several modules inside:

| Module | What it does |
|---|---|
| [**Fast Garage**](#fast-garage) | A loadout panel on the `` ` `` key, no trip to the garage |
| [**Augments above tanks**](#augments-above-tanks) | Turret and hull augments above every tank's nickname in battle |

## Installation

Any Chromium-based browser that can load an extension from a folder will do: Chrome, Edge, Yandex Browser,
Opera and others.

1. Download the zip from the [Releases](../../releases) page and unpack it. You'll get a `silly-tanks` folder
   with `manifest.json` inside.
2. Open the extensions page (`chrome://extensions`, in Edge — `edge://extensions`) and turn on
   **Developer mode**.
3. Click **Load unpacked** and select that folder.
4. Open or reload the game.

Updating: replace the folder contents with the new version, click ⟳ on the extension on the extensions page and reload
the game. Your settings and combos are kept.

## Settings

The game settings get their own **SILLY TANKS** tab (at the end of the list, after "Support"): there you turn modules
on and off and assign keys. To assign a key, click it and press a new one;
`Backspace` leaves it unbound.

The language is Russian or English, picked automatically from the game language.

---

## Fast Garage

<!-- panel screenshot -->

Press `` ` `` and a panel with all your equipment opens in the middle of the screen: turrets and hulls
with augments, grenades, drones, protection modules and your combos. Works both in the lobby and right in battle.

**How to use**

- Clicks don't change anything right away, they queue changes: what you picked is highlighted orange,
  what's equipped now is green.
- Pressing `` ` `` again or the **Apply** button equips everything in the queue and closes the panel.
  `Esc` closes without changes. Both keys can be changed on the SILLY TANKS tab.
- **Protection modules** can be dragged between the list and the slots. You can also hover over a module and press `1`–`4`
  to put it in that slot.
- **Favourites** ★ — marked items and augments are shown first. There are augment filters:
  favourites only, legendary only.
- **⚙ Customise** — hide what you don't use: single items, augments or whole sections.

**Combos**

- **+ Save** remembers what's on screen now, including the queue. Clicking a combo queues it.
- Drag to reorder. You can rename ✎ and delete (deleting can be undone).
- **Import / Export** are compatible with TankiComboManager by Isra: move your combos either way.
- The "protection" checkbox controls whether combos equip protection modules.

**Good to know**

- **In battle** the game self-destructs your tank after a loadout change, same as changing through the regular garage.
- **The in-battle change timer** ("Changes available in …"): while it runs, the server won't accept a change. So
  the panel sends nothing and keeps the queue, and the button shows a countdown.
- On the first run the panel is empty: open the regular garage once and it will remember your equipment.
  After that the panel updates itself every time you open the garage.
- The regular garage UI doesn't see changes made from the panel until you reload the game. Your tank isn't affected:
  it has whatever you chose in the panel.

---

## Augments above tanks

<!-- screenshot of labels above tanks -->

Two icons appear above every player's nickname in battle: the turret augment and the hull augment.
If there's no augment, "–" is shown. No need to open TAB, the icons update when a player changes loadout.

On the SILLY TANKS tab you can choose when to show them: always, while a key is held (`Alt` by default)
or toggled with a key.

---

## Coming soon

- **Protection advisor** for the enemy team, right in battle.
- **Favourites fix** in Fast Garage.

## Credits

The combo idea and the in-battle protection advisor algorithm come from Isra.

## Building from source

```sh
python3 tools/build.py   # dist/silly-tanks-<version>.zip
```

Only the files listed in `manifest.json` go into the archive.

## Disclaimer

This extension is unofficial and not affiliated with the Tanki Online developers. Fast Garage sends the server the same
commands the game sends when you click in the garage, but you use it at your own risk.
