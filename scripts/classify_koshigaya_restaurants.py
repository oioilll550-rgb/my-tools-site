#!/usr/bin/env python3
import json
import re
import unicodedata
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
OFFICIAL = ROOT / "assets/data/restaurants-koshigaya-official.json"
CURATED = ROOT / "assets/data/restaurants-koshigaya.json"
OUT = ROOT / "assets/data/restaurants-koshigaya-public.json"

EXCLUDE_INSTITUTION = [
    "保育園","保育所","保育室","幼稚園","こども園","小学校","中学校","高等学校","高校","大学","専門学校",
    "学校給食","給食室","給食センター","社員食堂","職員食堂","従業員食堂","事業所内食堂",
    "病院","診療所","クリニック","医院","介護","老人ホーム","特別養護","特養","デイサービス",
    "グループホーム","福祉施設","障害者","障がい者","療育","寮内","寄宿舎",
    "工場内","工場食堂","事業所内","社内食堂","厨房","調理室","試食室","作業場","催事場",
    "食品売場","寿司売場","惣菜売場","水産売場","配食センター","セントラルキッチン"
]

EXCLUDE_RETAIL = [
    "ローソン","セブンイレブン","セブン－イレブン","セブン-イレブン","ファミリーマート",
    "ミニストップ","デイリーヤマザキ","ニューデイズ"
]

PUBLIC_CUES = [
    "店","カフェ","cafe","coffee","珈琲","喫茶","レストラン","restaurant","ダイニング","dining",
    "食堂","ラーメン","らーめん","麺","寿司","すし","鮨","焼肉","ホルモン","居酒屋","酒場",
    "うどん","そば","蕎麦","カレー","curry","パスタ","pasta","ピザ","pizza","ステーキ","とんかつ",
    "丼","餃子","中華","韓国","ベトナム","インド","タイ料理","キッチン","kitchen","フード","food",
    "バーガー","burger","マクドナルド","ケンタッキー","吉野家","すき家","松屋","サイゼリヤ",
    "ガスト","ココス","ジョイフル","ドーナツ","アイス","クレープ","スイーツ","茶房","茶屋",
    "焼鳥","焼き鳥","たこ焼","お好み焼","しゃぶ","串","ビストロ","bistro","バル","bar","スナック",
    "パブ","パン","ベーカリー","bakery","ケーキ","菓子","デザート","タピオカ","ジュース"
]

CATEGORY_RULES = {
    "ramen": ["ラーメン","らーめん","中華そば","つけ麺","油そば","まぜそば"],
    "sushi": ["寿司","すし","鮨","海鮮","刺身","魚河岸"],
    "yakiniku": ["焼肉","ホルモン","牛角","焼肉食堂"],
    "japanese": ["和食","定食","食堂","そば","蕎麦","うどん","天ぷら","とんかつ","丼","焼鳥","焼き鳥","串"],
    "curry": ["カレー","curry","インド","スパイス","ナン"],
    "italian": ["イタリア","パスタ","pasta","ピザ","pizza","ビストロ","bistro"],
    "cafe": ["カフェ","cafe","coffee","珈琲","喫茶","スイーツ","ケーキ","ドーナツ","アイス","クレープ","茶房","茶屋","タピオカ","ジュース"],
}

def normalize(value):
    s = unicodedata.normalize("NFKC", str(value or "")).lower()
    return re.sub(r"[\s　・･()（）\-－ー_/／]+", "", s)

def contains_any(text, words):
    n = normalize(text)
    return any(normalize(word) in n for word in words)

def confidence_for(name, address):
    joined = f"{name} {address}"
    if contains_any(joined, EXCLUDE_INSTITUTION):
        return "exclude", "institution"
    if contains_any(name, EXCLUDE_RETAIL):
        return "exclude", "convenience"
    if contains_any(name, PUBLIC_CUES):
        return "high", "name-cue"
    if contains_any(address, ["イオン","レイクタウン","ヴァリエ","フードコート","レストラン街","駅前","商店街"]):
        return "high", "location-cue"
    return "medium", "permit-only"

def infer_categories(name):
    tags = []
    for tag, words in CATEGORY_RULES.items():
        if contains_any(name, words):
            tags.append(tag)
    return tags

def match_key(name, address):
    return normalize(name) + "|" + normalize(address)

def main():
    official = json.loads(OFFICIAL.read_text(encoding="utf-8"))
    curated = json.loads(CURATED.read_text(encoding="utf-8"))

    curated_by_key = {
        match_key(r.get("name"), r.get("address")): r
        for r in curated.get("restaurants", [])
    }
    curated_by_name = {
        normalize(r.get("name")): r
        for r in curated.get("restaurants", [])
    }

    public = []
    excluded = []
    seen = set()

    for r in official.get("restaurants", []):
        name = r.get("name", "").strip()
        address = r.get("address", "").strip()
        conf, reason = confidence_for(name, address)

        item = {
            "id": r.get("id"),
            "name": name,
            "address": address,
            "permitDate": r.get("permitDate", ""),
            "sourceUrl": r.get("sourceUrl", ""),
            "confidence": conf,
            "classificationReason": reason,
            "tags": infer_categories(name),
            "curated": False,
        }

        curated_row = curated_by_key.get(match_key(name, address)) or curated_by_name.get(normalize(name))
        if curated_row:
            item["curated"] = True
            item["confidence"] = "confirmed"
            item["classificationReason"] = "curated"
            item["tags"] = sorted(set(item["tags"]) | set(curated_row.get("tags", [])))
            if curated_row.get("openingDate"):
                item["openingDate"] = curated_row["openingDate"]
            if curated_row.get("sourceUrl"):
                item["curatedSourceUrl"] = curated_row["sourceUrl"]

        if conf == "exclude" and not item["curated"]:
            excluded.append(item)
            continue

        key = match_key(name, address)
        if key in seen:
            continue
        seen.add(key)
        public.append(item)

    # Preserve manually curated shops even if their permit-record wording did not match.
    for r in curated.get("restaurants", []):
        key = match_key(r.get("name"), r.get("address"))
        if key in seen:
            continue
        seen.add(key)
        public.append({
            "id": r.get("id"),
            "name": r.get("name", ""),
            "address": r.get("address", ""),
            "permitDate": "",
            "sourceUrl": r.get("sourceUrl", ""),
            "confidence": "confirmed",
            "classificationReason": "curated-only",
            "tags": r.get("tags", []),
            "curated": True,
            "openingDate": r.get("openingDate", ""),
        })

    rank = {"confirmed": 0, "high": 1, "medium": 2}
    public.sort(key=lambda x: (rank.get(x["confidence"], 9), normalize(x["address"]), normalize(x["name"])))

    counts = {
        "confirmed": sum(1 for x in public if x["confidence"] == "confirmed"),
        "high": sum(1 for x in public if x["confidence"] == "high"),
        "medium": sum(1 for x in public if x["confidence"] == "medium"),
        "excluded": len(excluded),
    }

    output = {
        "area": "越谷市",
        "generatedAt": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(timespec="seconds"),
        "officialPermitCount": official.get("count", len(official.get("restaurants", []))),
        "count": len(public),
        "countsByConfidence": counts,
        "basis": "越谷市公式の飲食店営業許可データから、保育・学校・病院・福祉施設・社員食堂・厨房等の明らかな非一般利用施設とコンビニを除外し、一般利用可能性のある飲食店・飲食提供施設を自動分類。手動確認済み店舗はconfirmedとして優先。",
        "caution": "自動分類のため一般客向けでない施設が残る場合、また営業中の店舗を除外する場合があります。営業許可情報は現在営業中であることを保証しません。来店前に最新情報をご確認ください。",
        "restaurants": public,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Public-facing candidates: {len(public)} / official {output['officialPermitCount']}; excluded {len(excluded)}")
    print(json.dumps(counts, ensure_ascii=False))

if __name__ == "__main__":
    main()
