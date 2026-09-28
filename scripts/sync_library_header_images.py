#!/usr/bin/env python3
"""Archive site header/hero images into the public library.

A header image is detected when:
- an HTML <img> has a class containing "header" or "hero" and its src points
  into assets/images/, or
- a CSS rule whose selector contains "header" or "hero" references an image
  in assets/images/, or
- its filename contains "header" or "hero" (fallback for newly staged assets).

Each distinct image content is copied once using a SHA-256 suffix, so replacing
a file under the same source filename preserves the previous version.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE_ROOT = ROOT / "assets" / "images"
ARCHIVE_ROOT = ROOT / "library" / "assets" / "header-images"
MANIFEST = ARCHIVE_ROOT / "manifest.json"

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"}


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def git_date(path: Path) -> str:
    try:
        value = subprocess.check_output(
            ["git", "log", "-1", "--format=%cs", "--", rel(path)],
            cwd=ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        if value:
            return value
    except Exception:
        pass
    return datetime.now().date().isoformat()


def html_usage() -> dict[str, set[str]]:
    used: dict[str, set[str]] = {}
    img_tag = re.compile(r"<img\b[^>]*>", re.I)
    class_re = re.compile(r'class=["\']([^"\']+)["\']', re.I)
    src_re = re.compile(r'src=["\']([^"\']+)["\']', re.I)

    for page in ROOT.rglob("*.html"):
        # Do not detect the library's own archived copies as source images.
        if "library/assets" in rel(page):
            continue
        try:
            text = page.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        for tag in img_tag.findall(text):
            cm = class_re.search(tag)
            sm = src_re.search(tag)
            if not cm or not sm:
                continue
            classes = cm.group(1).lower()
            if "hero" not in classes and "header" not in classes:
                continue

            src = sm.group(1).split("?", 1)[0].split("#", 1)[0]
            if "assets/images/" not in src:
                continue
            source_name = src.split("assets/images/", 1)[1]
            source = f"assets/images/{source_name}".replace("//", "/")
            used.setdefault(source, set()).add(rel(page))

    return used


def css_usage() -> dict[str, set[str]]:
    used: dict[str, set[str]] = {}
    css_files = list((ROOT / "assets" / "css").glob("*.css"))
    rule_re = re.compile(r"([^{}]+)\{([^{}]*)\}", re.S)
    url_re = re.compile(r'url\(["\']?([^)"\']+)["\']?\)', re.I)

    for css in css_files:
        text = css.read_text(encoding="utf-8")
        for selector, body in rule_re.findall(text):
            low = selector.lower()
            if "hero" not in low and "header" not in low:
                continue
            for raw in url_re.findall(body):
                src = raw.split("?", 1)[0].split("#", 1)[0]
                if "../images/" not in src:
                    continue
                source_name = src.split("../images/", 1)[1]
                source = f"assets/images/{source_name}".replace("//", "/")
                used.setdefault(source, set()).add(rel(css))

    return used


def detected_sources() -> dict[str, set[str]]:
    used = html_usage()
    for source, pages in css_usage().items():
        used.setdefault(source, set()).update(pages)

    # Fallback: filenames intentionally named as header/hero assets.
    if IMAGE_ROOT.exists():
        for path in IMAGE_ROOT.iterdir():
            if not path.is_file() or path.suffix.lower() not in IMAGE_EXTS:
                continue
            low = path.stem.lower()
            if "header" in low or "hero" in low:
                used.setdefault(rel(path), set())

    return used


def friendly_title(source: str, used_on: list[str]) -> str:
    name = Path(source).stem.lower()
    pages = " ".join(used_on)

    if source.endswith("header-maid.png") or "index.html" in used_on:
        return "TOP ヘッダー画像"
    if "horse-racing-detail" in name or (
        "horse-racing/analysis.html" in pages and "detail" in name
    ):
        return "競馬・個別レース ヘッダー画像"
    if "horse-racing" in name:
        return "競馬 ヘッダー画像"

    stem = Path(source).stem.replace("-", " ").replace("_", " ").strip()
    return f"{stem} ヘッダー画像"


def load_manifest() -> dict:
    if not MANIFEST.exists():
        return {"version": 1, "items": []}
    try:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {"version": 1, "items": []}
    if not isinstance(data.get("items"), list):
        data["items"] = []
    data["version"] = 1
    return data


def main() -> None:
    ARCHIVE_ROOT.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()
    items = manifest["items"]
    known = {item.get("sha256"): item for item in items if item.get("sha256")}

    sources = detected_sources()
    current_hashes: set[str] = set()

    for source, usage in sorted(sources.items()):
        source_path = ROOT / source
        if not source_path.is_file() or source_path.suffix.lower() not in IMAGE_EXTS:
            continue

        digest = sha256(source_path)
        current_hashes.add(digest)
        used_on = sorted(usage)

        if digest in known:
            item = known[digest]
            item["current"] = True
            item["usedOn"] = sorted(set(item.get("usedOn", [])) | set(used_on))
            continue

        suffix = source_path.suffix.lower()
        archive_name = f"{source_path.stem}--{digest[:12]}{suffix}"
        archive_path = ARCHIVE_ROOT / archive_name
        shutil.copy2(source_path, archive_path)

        item = {
            "sha256": digest,
            "source": source,
            "archive": rel(archive_path),
            "title": friendly_title(source, used_on),
            "savedDate": git_date(source_path),
            "usedOn": used_on,
            "current": True,
        }
        items.append(item)
        known[digest] = item
        print(f"Archived: {source} -> {rel(archive_path)}")

    # Older versions stay in the archive but are marked non-current.
    for item in items:
        if item.get("sha256") not in current_hashes:
            item["current"] = False

    # Newest first. Stable secondary key avoids needless manifest churn.
    items.sort(
        key=lambda item: (
            item.get("savedDate", ""),
            item.get("archive", ""),
        ),
        reverse=True,
    )

    manifest = {"version": 1, "items": items}
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Header archive contains {len(items)} version(s).")


if __name__ == "__main__":
    main()
