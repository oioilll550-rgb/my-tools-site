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

import concurrent.futures
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
KAI2_URL = "https://scre.swiki.jp/index.php?%E5%9F%8E%E5%A8%98%E4%B8%80%E8%A6%A7%2F%E6%94%B9%E5%BC%90"

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


def load_existing() -> dict[str, dict]:
    if not OUT.exists():
        return {}
    try:
        data = json.loads(OUT.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}
    return {
        str(row.get("id") or row.get("name")): row
        for row in data.get("characters", [])
        if isinstance(row, dict) and (row.get("id") or row.get("name"))
    }


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

            char_index = None
            found = []
            for index in range(len(texts) - 1, 1, -1):
                candidate = names_in_cell(texts[index], names_by_length)
                if candidate:
                    char_index = index
                    found = candidate
                    break

            if char_index is None or char_index < 2:
                continue

            character_text = texts[char_index]
            effect = texts[char_index - 1]
            skill_name = texts[char_index - 2]

            if not effect or effect == "効果" or not character_text:
                continue
            if skill_name in {"", "効果", "城娘"}:
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


def parse_kai2_names(character_names: list[str]) -> set[str]:
    soup = fetch_soup(KAI2_URL)
    names_by_length = sorted(character_names, key=len, reverse=True)
    found: set[str] = set()

    for table in soup.find_all("table"):
        table_text = clean(table.get_text(" ", strip=True))
        if "改弐" not in table_text:
            continue
        for cell in table.find_all("td"):
            text = clean(cell.get_text(" ", strip=True))
            if not text:
                continue
            occupied: list[tuple[int, int]] = []
            for name in names_by_length:
                start = text.find(name)
                if start < 0:
                    continue
                end = start + len(name)
                if any(not (end <= s or start >= e) for s, e in occupied):
                    continue
                occupied.append((start, end))
                found.add(name)

    return found


def parse_individual_max_skills(row: dict) -> tuple[str, dict | None, dict | None, str | None]:
    try:
        soup = fetch_soup(row["wikiUrl"])
        candidates = []
        for table in soup.find_all("table"):
            text = clean(table.get_text(" ", strip=True))
            if "図鑑No." in text and "合戦" in text:
                candidates.append((len(text), table))

        if not candidates:
            return str(row["id"]), None, None, None

        table = min(candidates, key=lambda item: item[0])[1]
        best = {"formation": None, "held": None}
        current_section = None

        section_headers = {
            "特技", "編成特技", "所持特技", "大破特技", "特殊攻撃",
            "特殊能力", "計略", "図鑑文章", "武器切替",
        }

        for tr in table.find_all("tr"):
            cells = tr.find_all(["td", "th"], recursive=False)
            if not cells:
                continue
            texts = [clean(cell.get_text(" ", strip=True)) for cell in cells]
            first = texts[0] if texts else ""

            header_match = next((h for h in section_headers if first == h), None)
            if header_match:
                if header_match == "編成特技":
                    current_section = "formation"
                elif header_match == "所持特技":
                    current_section = "held"
                else:
                    current_section = None
                continue

            if current_section not in {"formation", "held"} or len(texts) < 2:
                continue

            stage = "無印"
            rank = 0
            if "改弐" in first:
                stage, rank = "改弐", 2
            elif "改壱" in first:
                stage, rank = "改壱", 1
            elif "無印" in first:
                stage, rank = "無印", 0
            else:
                continue

            effect = texts[1]
            if not effect or effect == "なし":
                continue

            skill_name = first.split("/", 1)[1].strip() if "/" in first else ""
            skill_name = re.sub(r"^\s*\[?改[壱弐]\]?\s*", "", skill_name).strip()
            skill_name = skill_name or current_section

            candidate = {"name": skill_name, "effect": effect, "stage": stage}
            previous = best[current_section]
            previous_rank = STAGE_RANK.get(previous.get("stage", "無印"), -1) if previous else -1
            if rank >= previous_rank:
                best[current_section] = candidate

        return str(row["id"]), best["formation"], best["held"], None
    except Exception as exc:
        return str(row["id"]), None, None, str(exc)


def main() -> None:
    existing = load_existing()
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
        row["maxUpgrade"] = None

    print("Reading 改弐 implementation list...")
    kai2_names = parse_kai2_names(names)
    print(f"改弐 characters matched: {len(kai2_names)}")

    by_id = {str(row["id"]): row for row in characters}
    pending = []

    for row in characters:
        if row["name"] not in kai2_names:
            continue
        row["maxUpgrade"] = "改弐"

        old = existing.get(str(row["id"])) or existing.get(row["name"])
        if old and old.get("maxUpgrade") == "改弐":
            old_formation = old.get("formationSkill")
            old_held = old.get("heldSkill")

            # Prefer an aggregate-page 改弐 entry when available; otherwise keep
            # the previously verified individual-page result.
            if not row["formationSkill"] or row["formationSkill"].get("stage") != "改弐":
                row["formationSkill"] = old_formation
            if not row["heldSkill"] or row["heldSkill"].get("stage") != "改弐":
                row["heldSkill"] = old_held
        else:
            pending.append(row)

    if pending:
        print(f"Checking individual pages for max 改弐 skills: {len(pending)}")
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(parse_individual_max_skills, row) for row in pending]
            done = 0
            for future in concurrent.futures.as_completed(futures):
                char_id, formation_skill, held_skill, error = future.result()
                done += 1
                row = by_id.get(char_id)
                if row:
                    if formation_skill:
                        row["formationSkill"] = formation_skill
                    if held_skill:
                        row["heldSkill"] = held_skill
                if done % 25 == 0 or done == len(pending):
                    print(f"  改弐 pages: {done}/{len(pending)}")
                if error:
                    print(f"  warning {char_id}: {error}")

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
            "kai2": KAI2_URL,
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
