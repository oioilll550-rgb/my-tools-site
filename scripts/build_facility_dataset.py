#!/usr/bin/env python3
import hashlib
import json
import re
import unicodedata
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "assets/data/restaurants-koshigaya-public.json"
OUTPUT = ROOT / "assets/data/facilities-koshigaya.json"

PREFECTURE_CODE = "11"
PREFECTURE_NAME = "埼玉県"
MUNICIPALITY_CODE = "112224"
MUNICIPALITY_NAME = "越谷市"
SOURCE_ID = "koshigaya-foodservice-permits"

CATEGORY_MAP = {
    "ramen": ("restaurant.ramen", "ラーメン"),
    "sushi": ("restaurant.sushi", "寿司・海鮮"),
    "yakiniku": ("restaurant.yakiniku", "焼肉"),
    "japanese": ("restaurant.japanese", "和食・定食"),
    "curry": ("restaurant.curry", "カレー"),
    "italian": ("restaurant.italian", "イタリアン"),
    "cafe": ("restaurant.cafe", "カフェ・スイーツ"),
    "family": ("restaurant.family", "家族向け"),
    "solo": ("restaurant.solo", "一人利用"),
    "cheap": ("restaurant.cheap", "低価格"),
    "lunch": ("restaurant.lunch", "ランチ"),
    "late-night": ("restaurant.late-night", "夜営業"),
}

def normalize(value):
    return re.sub(
        r"[\s　・･,，.。()（）\-－ー_/／]+",
        "",
        unicodedata.normalize("NFKC", str(value or "")).lower(),
    )

def stable_id(row):
    # The generated ID is assigned once in the staging dataset.
    # When D1 becomes authoritative it must be persisted and never recomputed
    # after a rename/address change; source aliases will then resolve identity.
    seed = row.get("id") or (normalize(row.get("name")) + "|" + normalize(row.get("address")))
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:20]
    return f"jp-{MUNICIPALITY_CODE}-{digest}"

def iso_date_from_permit(value):
    value = str(value or "").strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return value
    return None

def main():
    src = json.loads(INPUT.read_text(encoding="utf-8"))
    now = datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(timespec="seconds")

    facilities = []
    categories = {}

    for row in src.get("restaurants", []):
        facility_id = stable_id(row)
        tags = row.get("tags") or []

        category_ids = []
        for tag in tags:
            if tag in CATEGORY_MAP:
                cid, cname = CATEGORY_MAP[tag]
                categories[cid] = {
                    "id": cid,
                    "name": cname,
                    "slug": cid.split(".", 1)[1],
                    "facilityType": "restaurant",
                }
                category_ids.append(cid)

        confidence = row.get("confidence", "unverified")
        if confidence == "confirmed":
            mapped_confidence = "confirmed"
        elif confidence in ("high", "medium", "low"):
            mapped_confidence = confidence
        else:
            mapped_confidence = "unverified"

        name = str(row.get("name") or "").strip()
        address = str(row.get("address") or "").strip()
        source_url = row.get("sourceUrl") or row.get("curatedSourceUrl") or ""

        facilities.append({
            "id": facility_id,
            "name": name,
            "facilityType": "restaurant",
            "prefectureCode": PREFECTURE_CODE,
            "municipalityCode": MUNICIPALITY_CODE,
            "address": address,
            "status": "unknown",
            "openingDate": row.get("openingDate") or iso_date_from_permit(row.get("permitDate")),
            "closingDate": None,
            "officialUrl": None,
            "confidence": mapped_confidence,
            "lastVerifiedAt": src.get("generatedAt"),
            "searchText": " ".join([name, address, MUNICIPALITY_NAME, PREFECTURE_NAME] + tags),
            "categoryIds": category_ids,
            "sourceRefs": [{
                "sourceId": SOURCE_ID,
                "sourceEntityId": row.get("id"),
                "sourceUrl": source_url,
                "rawName": name,
                "rawAddress": address,
                "observedAt": src.get("generatedAt"),
                "primary": True,
            }],
        })

    output = {
        "schemaVersion": 1,
        "generatedAt": now,
        "prefectures": [{
            "code": PREFECTURE_CODE,
            "name": PREFECTURE_NAME,
        }],
        "municipalities": [{
            "code": MUNICIPALITY_CODE,
            "prefectureCode": PREFECTURE_CODE,
            "name": MUNICIPALITY_NAME,
            "municipalityType": "city",
        }],
        "sources": [{
            "id": SOURCE_ID,
            "provider": "越谷市",
            "title": "食品関係営業施設一覧（飲食店営業）",
            "sourceType": "official_permit",
            "url": "https://www.city.koshigaya.saitama.jp/kurashi_shisei/fukushi/hokenjo/shokuhin/20160401.html",
            "trustLevel": "official",
            "updateFrequency": "monthly",
            "retrievedAt": src.get("generatedAt"),
        }],
        "categories": sorted(categories.values(), key=lambda x: x["id"]),
        "facilityCount": len(facilities),
        "facilities": facilities,
    }

    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {len(facilities)} facilities")

if __name__ == "__main__":
    main()
