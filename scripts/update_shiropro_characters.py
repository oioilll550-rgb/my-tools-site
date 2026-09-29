#!/usr/bin/env python3
"""Build a local Shiropro RE character dataset from scre.swiki.jp.

The full character list provides all character rows and the main list fields.
Basic deployment cost (消費気) is supplemented from each character's wiki page.

Existing deployment costs are reused on normal refreshes, so recurring updates
only need to fetch the list page plus newly-added characters. Set
SHIROPRO_REFRESH_COSTS=1 for a full cost refresh.
"""

from __future__ import annotations

import concurrent.futures
import json
import os
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
LIST_URL = "https://scre.swiki.jp/index.php?%E5%85%A8%E5%9F%8E%E5%A8%98%E4%B8%80%E8%A6%A7"
BASE = "https://scre.swiki.jp/"
REFRESH_COSTS = os.environ.get("SHIROPRO_REFRESH_COSTS", "") == "1"
MAX_WORKERS = 3

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; benrichan-shiropro-list/1.0; "
        "+https://oioilll550-rgb.github.io/my-tools-site/)"
    ),
    "Accept-Language": "ja,en;q=0.6",
}


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


STANDARD_WEAPONS = {
    "刀", "槍", "槌", "盾", "拳", "鎌", "戦棍", "双剣", "ランス",
    "弓", "石弓", "鉄砲", "大砲", "歌舞", "法術", "鈴", "杖", "祓串",
    "本", "投剣", "鞭", "陣貝", "軍船", "茶器", "その他",
    # Non-collaboration special/dual weapon types used by the game.
    "刀/鉄砲", "鞭/双剣", "ランス/大砲", "戦棍/槌", "鎌/槍",
}


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
            response = requests.get(url, headers=HEADERS, timeout=20)
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
    result = {}
    for row in data.get("characters", []):
        if not isinstance(row, dict):
            continue
        key = row.get("id") or row.get("name")
        if key:
            result[str(key)] = row
    return result


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
            upgrade = clean(cells[2].get_text(" ", strip=True))
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

            extra = [
                clean(cells[i].get_text(" ", strip=True)) if i < len(cells) else ""
                for i in range(6, 10)
            ]

            rows.append({
                "id": char_id,
                "no": int(no) if no else None,
                "rarity": int(rarity_text),
                "weapon": weapon,
                "attribute": attribute,
                "name": name,
                "basicCost": None,
                "upgrade": upgrade or None,
                "trait": extra[0] or None,
                "heldOrFormation": extra[1] or None,
                "destroyedOrSpecial": extra[2] or None,
                "strategy": extra[3] or None,
                "wikiUrl": character_url(cells[1], name),
            })

    if len(rows) < 500:
        raise RuntimeError(f"Character list parse looks incomplete: {len(rows)} rows")
    return rows


def parse_basic_cost(row: dict) -> tuple[str, int | None, str | None]:
    char_id = str(row["id"])
    try:
        soup = fetch_soup(row["wikiUrl"])

        for cell in soup.find_all(["th", "td"]):
            if clean(cell.get_text(" ", strip=True)) != "消費気":
                continue
            sibling = cell.find_next_sibling(["th", "td"])
            if sibling is None:
                continue
            match = re.search(r"\d+", clean(sibling.get_text(" ", strip=True)))
            if match:
                return char_id, int(match.group(0)), None

        # Fallback for pages where the label/value are flattened in unusual markup.
        text = clean(soup.get_text(" ", strip=True))
        match = re.search(r"消費気\s+(\d+)", text)
        if match:
            return char_id, int(match.group(1)), None

        return char_id, None, "消費気を確認できませんでした"
    except Exception as exc:
        return char_id, None, str(exc)


def main() -> None:
    existing = load_existing()
    characters = parse_full_list()

    pending: list[dict] = []
    for row in characters:
        old = existing.get(str(row["id"])) or existing.get(row["name"])
        if old and not REFRESH_COSTS and isinstance(old.get("basicCost"), int):
            row["basicCost"] = old["basicCost"]
        else:
            pending.append(row)

    print(f"Characters found: {len(characters)}")
    print(f"Deployment costs to fetch: {len(pending)}")

    errors: list[dict] = []
    if pending:
        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(parse_basic_cost, row): row
                for row in pending
            }
            completed = 0
            for future in concurrent.futures.as_completed(futures):
                char_id, cost, error = future.result()
                completed += 1

                for row in characters:
                    if str(row["id"]) == char_id:
                        row["basicCost"] = cost
                        break

                if error:
                    errors.append({"id": char_id, "error": error})

                if completed % 50 == 0 or completed == len(pending):
                    print(f"  Cost pages: {completed}/{len(pending)}")

    # Preserve prior cost when a transient page fetch failed.
    for row in characters:
        if isinstance(row.get("basicCost"), int):
            continue
        old = existing.get(str(row["id"])) or existing.get(row["name"])
        if old and isinstance(old.get("basicCost"), int):
            row["basicCost"] = old["basicCost"]

    characters.sort(key=lambda row: (
        row["no"] is None,
        row["no"] if row["no"] is not None else 999999,
        row["name"],
    ))

    missing_cost = [
        row["name"] for row in characters
        if not isinstance(row.get("basicCost"), int)
    ]

    # Do not replace a good dataset with a clearly broken scrape.
    if len(characters) < 500:
        raise RuntimeError("Validation failed: too few characters")
    if len(missing_cost) > max(80, int(len(characters) * 0.15)):
        raise RuntimeError(
            f"Validation failed: too many missing deployment costs ({len(missing_cost)})"
        )

    payload = {
        "source": LIST_URL,
        "updatedAtJst": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(timespec="seconds"),
        "count": len(characters),
        "missingBasicCostCount": len(missing_cost),
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
    print(f"Missing deployment costs: {len(missing_cost)}")
    if errors:
        print(f"Page fetch warnings: {len(errors)}")


if __name__ == "__main__":
    main()
