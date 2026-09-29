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

EFFECT_SOURCES = {
    "trait_attack": {
        "label": "特技",
        "url": "https://scre.swiki.jp/index.php?%E7%89%B9%E6%8A%80",
        "defaultKind": "buff",
    },
    "trait_defense": {
        "label": "特技/防御系",
        "url": "https://scre.swiki.jp/index.php?%E7%89%B9%E6%8A%80%2F%E9%98%B2%E5%BE%A1%E7%B3%BB",
        "defaultKind": "buff",
    },
    "trait_debuff": {
        "label": "特技/弱体化",
        "url": "https://scre.swiki.jp/index.php?%E7%89%B9%E6%8A%80%2F%E5%BC%B1%E4%BD%93%E5%8C%96",
        "defaultKind": "debuff",
    },
    "special_attack": {
        "label": "特殊攻撃",
        "url": "https://scre.swiki.jp/index.php?%E7%89%B9%E6%AE%8A%E6%94%BB%E6%92%83",
        "defaultKind": None,
    },
    "special_ability": {
        "label": "特殊能力",
        "url": "https://scre.swiki.jp/index.php?%E7%89%B9%E6%AE%8A%E8%83%BD%E5%8A%9B",
        "defaultKind": None,
    },
}

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

KNOWN_KAI2_NAMES = set([
    "霞城",
    "青葉城",
    "仙台城",
    "千代城",
    "月山城",
    "長篠城",
    "飯沼城",
    "鳥羽城",
    "月山富田城",
    "許昌城",
    "ヴァルトブルク城",
    "ウォリック城",
    "マルクスブルク城",
    "淀城",
    "日暮城",
    "原城",
    "志自岐原城",
    "虎臥城",
    "胆沢城",
    "新宮城",
    "島原城",
    "木幡山伏見城",
    "モン・サン＝ミッシェル",
    "立花山城",
    "秋田城",
    "志波城",
    "多賀城",
    "徳丹城",
    "柳川城",
    "大坂城",
    "小峯城",
    "水府城",
    "扇城",
    "置塩城",
    "中津城",
    "山科本願寺",
    "尾山御坊",
    "彦根城",
    "ダノター城",
    "聚楽城",
    "リーズ城",
    "駿府城",
    "小谷城",
    "高崎城",
    "石垣山城",
    "五稜郭",
    "亀田御役所土塁",
    "二本松城",
    "七飯台場",
    "龍岡城",
    "品川台場",
    "四稜郭",
    "久慈城",
    "金ヶ崎城",
    "津留賀城",
    "成都城",
    "吉野ヶ里",
    "伊豆下田城",
    "平遥古城",
    "箕輪城",
    "柳生城",
    "菖蒲城",
    "苗木城",
    "本庄城",
    "烏城",
    "コンシェルジュリー",
    "ブラン城",
    "鶴島城",
    "松本城",
    "徳島城",
    "深志城",
    "与板城",
    "浦添城",
    "今川館",
    "二条亭",
    "鎌倉城",
    "千代田城",
    "松江城",
    "小田原城",
    "二条城",
    "井伊谷城",
    "備中松山城",
    "江戸氏館",
    "七尾城",
    "多聞山城",
    "久留米城",
    "笹原城",
    "脇本城",
    "勝瑞城",
    "シャンボール城",
    "シェーンブルン宮殿",
    "石山御坊",
    "丸亀城",
    "観音寺城",
    "伊勢長島城",
    "錦城",
    "金亀城",
    "エディンバラ城",
    "竹田城",
    "信貴山城",
    "安平古堡",
    "大聖寺城",
    "引田城",
    "江戸城",
    "ウィンザー城",
    "琉球御城",
    "万里の長城",
    "首里城",
    "モーリッツブルク城",
    "洛陽城",
    "甘崎城",
    "山形城",
    "一乗谷城",
    "美作一ノ瀬城",
    "福岡城",
    "滝山城",
    "坂戸城",
    "ペテルゴフ宮殿",
    "安平城",
    "躑躅ヶ崎館",
    "高天神城",
    "ユクエピラチャシ",
    "萩城",
    "三木城",
    "鹿児島城",
    "聚楽第",
    "弘前城",
    "高岡城",
    "鳥取城",
    "福山館",
    "那古野城",
    "柳之丸",
    "亀居城",
    "岩櫃城",
    "大仏城",
    "桑名城",
    "大多喜城",
    "小田喜城",
    "平安京",
    "佐和山城",
    "名胡桃城",
    "鹿野城",
    "日之嶽城",
    "名古屋城",
    "城塞都市アビラ",
    "津山城",
    "フランケンシュタイン城",
    "城塞都市カルカソンヌ",
    "ハーレック城",
    "マルボルク城",
    "コッヘム・ライヒスブルク城",
    "ノイシュヴァンシュタイン城",
    "シノン城",
    "カーナーヴォン城",
    "コンウィ城",
    "金鯱城",
    "宇和島城",
    "板島丸串城",
    "平城京",
    "指月伏見城",
    "新田金山城",
    "延岡城",
    "高島城",
    "プラハ城",
    "ウチヒサル城",
    "ユッセ城",
    "ペーナ宮殿",
    "スフォルツェスコ城",
    "アイリーン・ドナン城",
    "大宰府",
    "大野城",
    "白石城"
])


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


def split_combined_skill(value: str) -> tuple[dict | None, dict | None]:
    text = clean(value)
    if not text:
        return None, None

    formation = None
    held = None

    matches = list(re.finditer(r"\[(編成|所持)\]", text))
    if matches:
        for index, match in enumerate(matches):
            kind = match.group(1)
            start = match.end()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            effect = clean(text[start:end])
            if not effect:
                continue
            skill = {"name": "", "effect": effect, "stage": ""}
            if kind == "編成":
                formation = skill
            else:
                held = skill
    else:
        # A few current-list rows omit the [編成] prefix, but the content is
        # still the formation effect shown in the all-character table.
        formation = {"name": "", "effect": text, "stage": ""}

    return formation, held


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

            combined = clean(cells[7].get_text(" ", strip=True)) if len(cells) > 7 else ""
            baseline_formation, baseline_held = split_combined_skill(combined)

            rows.append({
                "id": char_id,
                "no": int(no) if no else None,
                "rarity": int(rarity_text),
                "weapon": weapon,
                "attribute": attribute,
                "name": name,
                "formationSkill": baseline_formation,
                "heldSkill": baseline_held,
                "buffs": [],
                "debuffs": [],
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
    match = re.match(r"\s*(?:\[|［)?(改[壱弐])(?:\]|］)?", tail)
    if not match:
        return "無印", 0

    stage = match.group(1)
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


def nearest_heading(table) -> str:
    heading = table.find_previous(["h2", "h3", "h4"])
    return clean(heading.get_text(" ", strip=True)) if heading else ""


def effect_cell_index(texts: list[str], char_index: int) -> int | None:
    if char_index <= 0:
        return None

    keywords = (
        "攻撃", "防御", "耐久", "射程", "回復", "速度", "隙", "ダメージ",
        "消費気", "巨大化気", "計略", "敵", "味方", "自身", "城娘", "伏兵",
        "上昇", "低下", "短縮", "延長", "軽減", "増加", "減少", "無効",
        "無視", "倍", "秒", "状態",
    )

    candidates = []
    for index, text in enumerate(texts[:char_index]):
        if not text or text in {"効果", "属性", "城娘"}:
            continue
        score = sum(1 for word in keywords if word in text)
        score += min(len(text), 120) / 120
        if re.fullmatch(r"[★☆]?\d+", text):
            score -= 10
        candidates.append((score, len(text), index))

    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][2]


def ability_name_from_row(texts: list[str], effect_index: int, section: str) -> str:
    for index in range(effect_index - 1, -1, -1):
        text = texts[index]
        if not text or text in {"効果", "属性", "城娘"}:
            continue
        if re.fullmatch(r"[★☆]?\d+", text):
            continue
        if len(text) > 120:
            continue
        return text
    return section


def classify_effect(effect: str, default_kind: str | None) -> list[str]:
    text = clean(effect)
    kinds: set[str] = set()

    buff_patterns = (
        r"(?:自身|味方|城娘|殿|伏兵|部隊|全ての味方|近接|遠隔).*?"
        r"(?:上昇|増加|短縮|軽減|回復|無効|無視|倍)",
        r"(?:攻撃|防御|耐久|射程|回復|攻撃速度|与ダメージ|被回復量).*?"
        r"(?:上昇|増加)",
        r"(?:計略再使用|初回計略|攻撃後の隙).*?短縮",
        r"(?:巨大化気|計略消費気|被ダメージ).*?軽減",
    )
    debuff_patterns = (
        r"(?:敵|全ての敵|射程内の敵|攻撃した敵).*?"
        r"(?:低下|減少|延長|上昇)",
        r"(?:敵の)?(?:攻撃|防御|射程|移動速度|攻撃速度).*?低下",
        r"(?:敵の)?被ダメージ.*?上昇",
        r"(?:敵の)?攻撃後の隙.*?延長",
    )

    if any(re.search(pattern, text) for pattern in buff_patterns):
        kinds.add("buff")
    if any(re.search(pattern, text) for pattern in debuff_patterns):
        kinds.add("debuff")

    if default_kind and not kinds:
        kinds.add(default_kind)
    elif default_kind:
        kinds.add(default_kind)

    return sorted(kinds)


def parse_numeric_modifiers(effect: str) -> list[dict]:
    text = clean(effect)
    modifiers = []
    pattern = re.compile(
        r"(\d+(?:\.\d+)?)(%|秒)?\s*"
        r"(上昇|低下|短縮|延長|軽減|増加|減少)"
    )

    for match in pattern.finditer(text):
        start = max(0, match.start() - 36)
        context = text[start:match.start()]
        context = re.split(r"[。\.、,]", context)[-1].strip()
        modifiers.append({
            "context": context,
            "value": float(match.group(1)) if "." in match.group(1) else int(match.group(1)),
            "unit": match.group(2) or "",
            "change": match.group(3),
        })

    return modifiers


def parse_effect_source(
    source_key: str,
    source: dict,
    character_names: list[str],
) -> dict[str, list[dict]]:
    soup = fetch_soup(source["url"])
    names_by_length = sorted(character_names, key=len, reverse=True)
    result: dict[str, list[dict]] = {}

    for table in soup.find_all("table"):
        section = nearest_heading(table)

        for tr in table.find_all("tr"):
            cells = tr.find_all(["td", "th"], recursive=False)
            if len(cells) < 2:
                continue

            texts = [clean(cell.get_text(" ", strip=True)) for cell in cells]
            char_index = None
            found = []

            for index in range(len(texts) - 1, 0, -1):
                matches = names_in_cell(texts[index], names_by_length)
                if matches:
                    char_index = index
                    found = matches
                    break

            if char_index is None:
                continue

            effect_index = effect_cell_index(texts, char_index)
            if effect_index is None:
                continue

            effect = texts[effect_index]
            if not effect or effect == "効果":
                continue

            ability_name = ability_name_from_row(texts, effect_index, section)
            kinds = classify_effect(effect, source.get("defaultKind"))
            if not kinds:
                continue

            for name, stage, rank in found:
                result.setdefault(name, []).append({
                    "source": source_key,
                    "sourceLabel": source["label"],
                    "section": section,
                    "ability": ability_name,
                    "effect": effect,
                    "stage": stage,
                    "stageRank": rank,
                    "kinds": kinds,
                    "modifiers": parse_numeric_modifiers(effect),
                })

    return result


def keep_max_stage_effects(entries: list[dict]) -> list[dict]:
    # The same reverse-lookup row is often included on multiple wiki pages.
    # Group by ability identity across sources and retain only the highest stage.
    grouped: dict[tuple[str, str], list[dict]] = {}

    for entry in entries:
        key = (
            entry.get("section", ""),
            entry.get("ability", ""),
        )
        grouped.setdefault(key, []).append(entry)

    stage_kept = []
    for group in grouped.values():
        max_rank = max(entry.get("stageRank", 0) for entry in group)
        stage_kept.extend(
            entry for entry in group
            if entry.get("stageRank", 0) == max_rank
        )

    # Merge exact duplicate effects across source pages and union their kind/source
    # metadata. This keeps the client JSON substantially smaller.
    merged: dict[tuple[str, str, str, str], dict] = {}

    for entry in stage_kept:
        key = (
            entry.get("section", ""),
            entry.get("ability", ""),
            entry.get("effect", ""),
            entry.get("stage", ""),
        )
        if key not in merged:
            item = {
                "section": entry.get("section", ""),
                "ability": entry.get("ability", ""),
                "effect": entry.get("effect", ""),
                "stage": entry.get("stage", "無印"),
                "kinds": list(entry.get("kinds", [])),
                "modifiers": entry.get("modifiers", []),
                "sources": [{
                    "key": entry.get("source", ""),
                    "label": entry.get("sourceLabel", ""),
                }],
            }
            merged[key] = item
        else:
            item = merged[key]
            item["kinds"] = sorted(
                set(item.get("kinds", [])) | set(entry.get("kinds", []))
            )
            source_item = {
                "key": entry.get("source", ""),
                "label": entry.get("sourceLabel", ""),
            }
            if source_item not in item["sources"]:
                item["sources"].append(source_item)

    return list(merged.values())


def parse_kai2_names(
    character_names: list[str],
    existing: dict[str, dict],
) -> set[str]:
    valid_names = set(character_names)
    found = set(KNOWN_KAI2_NAMES) & valid_names

    # Preserve every previously confirmed 改弐 character.
    for row in existing.values():
        if row.get("maxUpgrade") == "改弐" and row.get("name") in valid_names:
            found.add(row["name"])

    # The full-character page reliably exposes the latest "改弐追加" block even
    # when the dedicated 改弐 list is not returned to GitHub Actions.
    try:
        soup = fetch_soup(LIST_URL)
        marker = next(
            (
                strong for strong in soup.find_all("strong")
                if clean(strong.get_text(" ", strip=True)) == "改弐追加"
            ),
            None,
        )
        if marker and marker.parent:
            text = clean(marker.parent.get_text(" ", strip=True))
            names_by_length = sorted(character_names, key=len, reverse=True)
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
    except Exception as exc:
        print(f"warning: latest 改弐追加 block unavailable: {exc}")

    return found


def parse_individual_max_skills(
    row: dict,
) -> tuple[str, dict | None, dict | None, list[dict], str | None]:
    try:
        soup = fetch_soup(row["wikiUrl"])
        candidates = []

        for table in soup.find_all("table"):
            text = clean(table.get_text(" ", strip=True))
            if "図鑑No." in text and "合戦" in text:
                candidates.append((len(text), table))

        if not candidates:
            return str(row["id"]), None, None, [], None

        table = min(candidates, key=lambda item: item[0])[1]
        best = {
            "formation": None,
            "held": None,
            "trait": None,
            "special_attack": None,
            "special_ability": None,
        }
        current_section = None

        section_map = {
            "編成特技": "formation",
            "所持特技": "held",
            "特技": "trait",
            "特殊攻撃": "special_attack",
            "特殊能力": "special_ability",
        }
        section_headers = set(section_map) | {
            "大破特技", "計略", "図鑑文章", "武器切替",
        }

        for tr in table.find_all("tr"):
            cells = tr.find_all(["td", "th"], recursive=False)
            if not cells:
                continue

            texts = [clean(cell.get_text(" ", strip=True)) for cell in cells]
            first = texts[0] if texts else ""

            header_match = next((h for h in section_headers if first == h), None)
            if header_match:
                current_section = section_map.get(header_match)
                continue

            if current_section not in best or len(texts) < 2:
                continue

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

            candidate = {
                "name": skill_name,
                "effect": effect,
                "stage": stage,
                "_rank": rank,
            }
            previous = best[current_section]
            previous_rank = previous.get("_rank", -1) if previous else -1
            if rank >= previous_rank:
                best[current_section] = candidate

        def effective_skill(value: dict | None) -> dict | None:
            if not value:
                return None
            original_stage = value.get("stage", "無印")
            result = {
                "name": value.get("name", ""),
                "effect": value.get("effect", ""),
                "stage": "改弐",
            }
            if original_stage != "改弐":
                result["inheritedFrom"] = original_stage
            return result

        max_effects = []
        effect_section_labels = {
            "trait": "特技",
            "special_attack": "特殊攻撃",
            "special_ability": "特殊能力",
        }

        for key, label in effect_section_labels.items():
            value = best.get(key)
            if not value:
                continue

            effect = value.get("effect", "")
            kinds = classify_effect(effect, None)
            if not kinds:
                continue

            entry = {
                "section": label,
                "ability": value.get("name", ""),
                "effect": effect,
                "stage": "改弐",
                "kinds": kinds,
                "modifiers": parse_numeric_modifiers(effect),
                "sources": [{
                    "key": "individual_max",
                    "label": "個別ページ（最大改築確認）",
                }],
            }
            if value.get("stage") != "改弐":
                entry["inheritedFrom"] = value.get("stage", "無印")
            max_effects.append(entry)

        return (
            str(row["id"]),
            effective_skill(best["formation"]),
            effective_skill(best["held"]),
            max_effects,
            None,
        )
    except Exception as exc:
        return str(row["id"]), None, None, [], str(exc)


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

    print("Reading buff/debuff source pages...")
    effects_by_name: dict[str, list[dict]] = {}
    for source_key, source in EFFECT_SOURCES.items():
        parsed = parse_effect_source(source_key, source, names)
        matched = sum(len(entries) for entries in parsed.values())
        print(f"  {source['label']}: {matched} matched entries")
        for name, entries in parsed.items():
            effects_by_name.setdefault(name, []).extend(entries)

    for row in characters:
        if formation.get(row["name"]):
            row["formationSkill"] = formation[row["name"]]
        if held.get(row["name"]):
            row["heldSkill"] = held[row["name"]]
        row["maxUpgrade"] = None

        effect_entries = keep_max_stage_effects(effects_by_name.get(row["name"], []))
        row["buffs"] = [
            entry for entry in effect_entries
            if "buff" in entry.get("kinds", [])
        ]
        row["debuffs"] = [
            entry for entry in effect_entries
            if "debuff" in entry.get("kinds", [])
        ]

    print("Reading 改弐 implementation list...")
    kai2_names = parse_kai2_names(names, existing)
    print(f"改弐 characters matched: {len(kai2_names)}")

    by_id = {str(row["id"]): row for row in characters}
    pending = []

    for row in characters:
        if row["name"] not in kai2_names:
            continue
        row["maxUpgrade"] = "改弐"

        old = existing.get(str(row["id"])) or existing.get(row["name"])
        if old and old.get("maxUpgrade") == "改弐" and old.get("maxEffectsVerified"):
            row["formationSkill"] = old.get("formationSkill")
            row["heldSkill"] = old.get("heldSkill")
            row["buffs"] = old.get("buffs", [])
            row["debuffs"] = old.get("debuffs", [])
            row["maxEffectsVerified"] = True
        else:
            # Lower-stage reverse-lookup rows are not retained for 改弐
            # characters. The effective maximum-state values are rebuilt from
            # the individual page below.
            row["formationSkill"] = None
            row["heldSkill"] = None
            row["buffs"] = []
            row["debuffs"] = []
            row["maxEffectsVerified"] = False
            pending.append(row)

    for row in characters:
        if row["name"] not in kai2_names:
            row["maxEffectsVerified"] = False

    if pending:
        print(f"Checking individual pages for max 改弐 skills: {len(pending)}")
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(parse_individual_max_skills, row) for row in pending]
            done = 0
            for future in concurrent.futures.as_completed(futures):
                char_id, formation_skill, held_skill, max_effects, error = future.result()
                done += 1
                row = by_id.get(char_id)
                if row:
                    row["formationSkill"] = formation_skill
                    row["heldSkill"] = held_skill
                    row["buffs"] = [
                        entry for entry in max_effects
                        if "buff" in entry.get("kinds", [])
                    ]
                    row["debuffs"] = [
                        entry for entry in max_effects
                        if "debuff" in entry.get("kinds", [])
                    ]
                    row["maxEffectsVerified"] = True
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

    formation_count = sum(1 for row in characters if row.get("formationSkill"))
    held_count = sum(1 for row in characters if row.get("heldSkill"))
    buff_count = sum(1 for row in characters if row.get("buffs"))
    debuff_count = sum(1 for row in characters if row.get("debuffs"))

    max_stage_violations = []
    for row in characters:
        if row.get("maxUpgrade") != "改弐":
            continue
        lower_entries = [
            entry
            for entry in [*(row.get("buffs") or []), *(row.get("debuffs") or [])]
            if entry.get("stage") in {"無印", "改壱"}
        ]
        if lower_entries:
            max_stage_violations.append(row["name"])

    if max_stage_violations:
        raise RuntimeError(
            "Validation failed: lower-stage effect data remains for 改弐 characters: "
            + ", ".join(max_stage_violations[:20])
        )

    print(f"Buff characters: {buff_count}")
    print(f"Debuff characters: {debuff_count}")
    print("Max-upgrade effect validation: OK")

    if formation_count < 100:
        raise RuntimeError(f"Validation failed: too few formation skills ({formation_count})")
    if held_count < 50:
        raise RuntimeError(f"Validation failed: too few possession skills ({held_count})")

    payload = {
        "source": LIST_URL,
        "skillSources": {
            "formation": FORMATION_URL,
            "held": HELD_URL,
            "kai2": KAI2_URL,
            "effects": {
                key: source["url"]
                for key, source in EFFECT_SOURCES.items()
            },
        },
        "updatedAtJst": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(timespec="seconds"),
        "count": len(characters),
        "formationSkillCount": formation_count,
        "heldSkillCount": held_count,
        "buffCharacterCount": buff_count,
        "debuffCharacterCount": debuff_count,
        "characters": characters,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    tmp.replace(OUT)

    print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
