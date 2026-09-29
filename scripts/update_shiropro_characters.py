#!/usr/bin/env python3
"""Build the local Shiropro RE character dataset from scre.swiki.jp.

Sources:
- 全城娘一覧: character number, rarity, weapon, attribute, name, wiki URL
- 編成特技: latest/max implemented formation skill
- 所持特技: latest/max implemented possession skill

When multiple upgrade-stage rows exist for the same character, 改弐 is preferred
over 改壱, and 改壱 is preferred over the base form.
"""

from __future__ import annotations

import json
import re
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, urljoin
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "data" / "shiropro-characters.json"

BASE = "https://scre.swiki.jp/"
LIST_URL = "https://scre.swiki.jp/index.php?%E5%85%A8%E5%9F%8E%E5%A8%98%E4%B8%80%E8%A6%A7"
FORMATION_URL = "https://scre.swiki.jp/index.php?%E7%B7%A8%E6%88%90%E7%89%B9%E6%8A%80"
HELD_URL = "https://scre.swiki.jp/index.php?%E6%89%80%E6%8C%81%E7%89%B9%E6%8A%80"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; benrichan-shiropro-list/2.0; "
        "+https://oioilll550-rgb.github.io/my-tools-site/)"
    ),
    "Accept-Language": "ja,en;q=0.6",
}

STANDARD_WEAPONS = {
    "刀", "槍", "槌", "盾", "拳", "鎌", "戦棍", "双剣", "ランス",
    "弓", "石弓", "鉄砲", "大砲", "歌舞", "法術", "鈴", "杖", "祓串",
    "本", "投剣", "鞭", "陣貝", "軍船", "茶器", "その他",
    # Game-native dual/special types retained as distinct categories.
    "刀/鉄砲", "鞭/双剣", "ランス/大砲", "戦棍/槌", "鎌/槍",
}

STAGE_RANK = {"無印": 0, "改壱": 1, "改弐": 2}


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def normalize_weapon(value: str) -> str:
    weapon = clean(value)
    if not weapon:
        return ""
    return weapon if weapon in STANDARD_WEAPONS else "その他"


def normalize_attribute(value: str) -> str:
    parts = [clean(part) for part in (value or "").split("/") if clean(part)]
    parts = ["地獄" if part == "地" else part for part in parts]
    return "/".join(parts)


def fetch_soup(url: str, attempts: int = 4) -> BeautifulSoup:
    last_error = None
    for attempt in range(attempts):
        try:
            response = requests.get(url, headers=HEADERS, timeout=30)
            response.raise_for_status()
            response.encoding = response.apparent_encoding or response.encoding or "utf-8"
            return BeautifulSoup(response.text, "html.parser")
        except Exception as exc:
            last_error = exc
            if attempt + 1 < attempts:
                time.sleep(1.2 * (attempt + 1))
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def character_url(cell, name: str) -> str:
    for link in cell.find_all("a", href=True):
        href = link.get("href", "")
        if not href or "cmd=" in href:
            continue
        return urljoin(BASE, href)
    return "https://scre.swiki.jp/index.php?" + quote(name, safe="")


def parse_full_list() -> list[dict]:
    soup = fetch_soup(LIST_URL)
    rows: list[dict] = []
    seen: set[str] = set()

    for table in soup.find_all("table"):
        table_text = clean(table.get_text(" ", strip=True))
        if not all(token in table_text for token in ("城娘", "レア", "城属性", "武器")):
            continue

        tbody = table.find("tbody") or table
        for tr in tbody.find_all("tr", recursive=False):
            cells = tr.find_all(["td", "th"], recursive=False)
            if len(cells) < 6:
                continue

            no_text = clean(cells[0].get_text(" ", strip=True))
            name = clean(cells[1].get_text(" ", strip=True))
            rarity_text = clean(cells[3].get_text(" ", strip=True))
            attribute = normalize_attribute(cells[4].get_text(" ", strip=True))
            weapon = normalize_weapon(cells[5].get_text(" ", strip=True))

            if not name or name in {"城娘", "名前"}:
                continue
            if not re.fullmatch(r"[1-9]\d*", rarity_text):
                continue
            if not weapon or weapon == "武器":
                continue

            no = no_text if re.fullmatch(r"\d+", no_text) else ""
            char_id = no or name
            if char_id in seen:
                continue
            seen.add(char_id)

            rows.append({
                "id": char_id,
                "no": int(no) if no else None,
                "rarity": int(rarity_text),
                "weapon": weapon,
                "attribute": attribute,
                "name": name,
                "formationSkill": None,
                "heldSkill": None,
                "wikiUrl": character_url(cells[1], name),
            })

    if len(rows) < 500:
        raise RuntimeError(f"Character list parse looks incomplete: {len(rows)} rows")
    return rows


def stage_from_text(text: str, name: str) -> tuple[str, int]:
    start = text.find(name)
    if start < 0:
        return "無印", 0
    tail = text[start + len(name):]
    match = re.match(r"\s*\[改(壱|弐)\]", tail)
    if not match:
        return "無印", 0
    stage = "改" + match.group(1)
    return stage, STAGE_RANK[stage]


def names_in_cell(text: str, names_by_length: list[str]) -> list[tuple[str, str, int]]:
    matches: list[tuple[int, int, str, str, int]] = []

    # Longest names are checked first so seasonal/variant names win over a shorter
    # base name contained inside them.
    for name in names_by_length:
        start = text.find(name)
        while start >= 0:
            end = start + len(name)
            overlaps = any(not (end <= s or start >= e) for s, e, *_ in matches)
            if not overlaps:
                stage, rank = stage_from_text(text[start:], name)
                matches.append((start, end, name, stage, rank))
                break
            start = text.find(name, start + 1)

    matches.sort(key=lambda item: item[0])
    return [(name, stage, rank) for _, _, name, stage, rank in matches]


def parse_skill_page(url: str, character_names: list[str]) -> dict[str, dict]:
    soup = fetch_soup(url)
    names_by_length = sorted(character_names, key=len, reverse=True)
    result: dict[str, dict] = {}

    for table in soup.find_all("table"):
        for tr in table.find_all("tr"):
            cells = tr.find_all(["td", "th"], recursive=False)
            if len(cells) < 3:
                continue

            texts = [clean(cell.get_text(" ", strip=True)) for cell in cells]
            character_text = texts[-1]
            effect = texts[-2]
            skill_name = texts[-3]

            if not effect or effect == "効果" or not character_text:
                continue
            if skill_name in {"", "効果", "城娘"}:
                continue

            found = names_in_cell(character_text, names_by_length)
            if not found:
                continue

            for name, stage, rank in found:
                candidate = {
                    "name": skill_name,
                    "effect": effect,
                    "stage": stage,
                }
                current = result.get(name)
                current_rank = STAGE_RANK.get(current.get("stage", "無印"), 0) if current else -1
                if rank >= current_rank:
                    result[name] = candidate

    return result


def main() -> None:
    characters = parse_full_list()
    names = [row["name"] for row in characters]

    print(f"Characters found: {len(characters)}")
    print("Reading maximum implemented formation skills...")
    formation = parse_skill_page(FORMATION_URL, names)
    print(f"Formation skills matched: {len(formation)}")

    print("Reading maximum implemented possession skills...")
    held = parse_skill_page(HELD_URL, names)
    print(f"Possession skills matched: {len(held)}")

    for row in characters:
        row["formationSkill"] = formation.get(row["name"])
        row["heldSkill"] = held.get(row["name"])

    characters.sort(key=lambda row: (
        row["no"] is None,
        row["no"] if row["no"] is not None else 999999,
        row["name"],
    ))

    if len(characters) < 500:
        raise RuntimeError("Validation failed: too few characters")
    if len(formation) < 100:
        raise RuntimeError(f"Validation failed: too few formation skills ({len(formation)})")
    if len(held) < 50:
        raise RuntimeError(f"Validation failed: too few possession skills ({len(held)})")

    payload = {
        "source": LIST_URL,
        "skillSources": {
            "formation": FORMATION_URL,
            "held": HELD_URL,
        },
        "updatedAtJst": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(timespec="seconds"),
        "count": len(characters),
        "formationSkillCount": len(formation),
        "heldSkillCount": len(held),
        "characters": characters,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp.replace(OUT)

    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
