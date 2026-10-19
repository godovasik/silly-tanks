#!/usr/bin/env python3
"""Сборка расширения в готовый вид: только файлы из манифеста, без тестов и инструментов.

    python3 tools/build.py [расширение]            # dist/<расширение>-<версия>.zip
    python3 tools/build.py [расширение] --install  # и сразу в папку extensions клиента

По умолчанию — silly-tanks. После --install клиент нужно перезапустить.
"""
import getpass
import json
import os
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Папка extensions клиента: TANKI_EXTENSIONS, иначе %APPDATA% (Windows), иначе тот же путь из WSL
APPDATA = os.environ.get("APPDATA") or f"/mnt/c/Users/{getpass.getuser()}/AppData/Roaming"
EXTENSIONS = Path(os.environ.get("TANKI_EXTENSIONS") or Path(APPDATA) / "Tanki Online with Tweaks" / "extensions")


def files_of(source: Path) -> list[str]:
    manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
    files = {"manifest.json"}
    for script in manifest.get("content_scripts", []):
        files.update(script.get("js", []))
        files.update(script.get("css", []))
    for entry in manifest.get("web_accessible_resources", []):
        files.update(entry.get("resources", []))
    missing = [f for f in files if not (source / f).is_file()]
    if missing:
        sys.exit(f"нет файлов из манифеста: {', '.join(missing)}")
    return sorted(files)


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    name = args[0] if args else "silly-tanks"
    source = ROOT / name
    files = files_of(source)
    version = json.loads((source / "manifest.json").read_text(encoding="utf-8"))["version"]

    target = ROOT / "dist" / f"{name}-{version}.zip"
    target.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for f in files:
            archive.write(source / f, f"{name}/{f}")
    print(f"{target.relative_to(ROOT)}: {', '.join(files)}")

    if "--install" in sys.argv:
        installed = EXTENSIONS / name
        if installed.exists():
            shutil.rmtree(installed)
        installed.mkdir(parents=True)
        for f in files:
            shutil.copy2(source / f, installed / f)
        print(f"установлено в {installed} — перезапусти клиент")


if __name__ == "__main__":
    main()
