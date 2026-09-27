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

EXCLUDE_EDUCATION = [
    "保育園","保育所","保育室","幼稚園","こども園","認定こども園",
    "小学校","中学校","高等学校","高校","大学","短期大学","専門学校",
    "特別支援学校","支援学校","学校給食","給食室","給食センター",
    "学童","放課後児童","児童クラブ"
]

EXCLUDE_MEDICAL = [
    "病院","診療所","クリニック","医院","医療センター","メディカルセンター",
    "リハビリテーション病院","健診センター","産婦人科","歯科医院"
]

EXCLUDE_CARE_WELFARE = [
    "介護","老人ホーム","有料老人ホーム","養護老人ホーム","特別養護老人ホーム","特別養護",
    "特養","老健","介護老人保健施設","ケアハウス","ナーシングホーム",
    "サービス付き高齢者向け住宅","高齢者住宅","シニアホーム",
    "デイサービス","デイケア","デイセンター","ショートステイ",
    "グループホーム","小規模多機能","看護小規模多機能",
    "福祉施設","福祉センター","障害者","障がい者","療育",
    "生活介護","就労継続支援","就労移行支援","就労支援"
]

EXCLUDE_INTERNAL_FOODSERVICE = [
    "社員食堂","職員食堂","従業員食堂","事業所内食堂","社内食堂",
    "工場内","工場食堂","事業所内","寮内","寄宿舎",
    "社員食堂厨房","職員食堂厨房","従業員食堂厨房","給食厨房","食堂厨房","施設内厨房","校内厨房",
    "調理室","試食室","作業場","催事場",
    "食品売場","寿司売場","惣菜売場","水産売場","鮮魚売場",
    "配食センター","セントラルキッチン"
]

EXCLUDE_RETAIL = [
    "ローソン","セブンイレブン","セブン－イレブン","セブン-イレブン","ファミリーマート",
    "ミニストップ","デイリーヤマザキ","ニューデイズ"
]

PUBLIC_CUES = [
    "店","カフェ","cafe","coffee","珈琲","喫茶","レストラン","restaurant","ダイニング","dining",
    "食堂","ラーメン","らーめん","らぁ麺","らー麺","拉麺","麺","寿司","すし","鮨","焼肉","ホルモン","居酒屋","酒場",
    "うどん","そば","蕎麦","カレー","curry","パスタ","pasta","ピザ","pizza","ステーキ","とんかつ",
    "丼","餃子","中華","韓国","ベトナム","インド","ネパール","タイ料理","キッチン","kitchen","フード","food",
    "バーガー","burger","マクドナルド","ケンタッキー","吉野家","すき家","松屋","サイゼリヤ",
    "ガスト","ココス","ジョイフル","ドーナツ","アイス","クレープ","スイーツ","茶房","茶屋",
    "焼鳥","焼き鳥","たこ焼","お好み焼","しゃぶ","串","ビストロ","bistro","バル","bar","スナック",
    "パブ","パン","ベーカリー","bakery","ケーキ","菓子","デザート","タピオカ","ジュース"
]

CATEGORY_RULES = {
    "ramen": ["ラーメン","らーめん","らぁ麺","らー麺","拉麺","中華そば","つけ麺","油そば","まぜそば"],
    "sushi": ["寿司","すし","鮨","回転寿司","海鮮","刺身","魚河岸"],
    "yakiniku": ["焼肉","やきにく","ホルモン","牛角","焼肉食堂"],
    "japanese": [
        "和食","日本料理","割烹","懐石","定食","食堂","そば","蕎麦","うどん","天ぷら","天丼",
        "とんかつ","かつ丼","親子丼","牛丼","丼","うなぎ","鰻","釜めし","焼鳥","焼き鳥","串","しゃぶ","おでん"
    ],
    "curry": ["カレー","curry","インド","ネパール","スパイス","ナン"],
    "italian": ["イタリア","イタリアーナ","トラットリア","ピッツェリア","パスタ","pasta","ピザ","pizza","ビストロ","bistro"],
    "cafe": [
        "カフェ","cafe","coffee","珈琲","喫茶","スイーツ","ケーキ","ドーナツ","アイス","クレープ",
        "茶房","茶屋","タピオカ","ジュース","パフェ","デザート","ベーカリー","bakery"
    ],
}

def normalize(value):
    s = unicodedata.normalize("NFKC", str(value or "")).lower()
    return re.sub(r"[\s　・･()（）\-－ー_/／]+", "", s)

def contains_any(text, words):
    n = normalize(text)
    return any(normalize(word) in n for word in words)

def exclusion_reason(name, address):
    joined = f"{name} {address}"
    if contains_any(joined, EXCLUDE_EDUCATION):
        return "education"
    if contains_any(joined, EXCLUDE_MEDICAL):
        return "medical"
    if contains_any(joined, EXCLUDE_CARE_WELFARE):
        return "care-welfare"
    if contains_any(joined, EXCLUDE_INTERNAL_FOODSERVICE):
        return "internal-foodservice"
    if contains_any(name, EXCLUDE_RETAIL):
        return "convenience"
    return None

def confidence_for(name, address):
    reason = exclusion_reason(name, address)
    if reason:
        return "exclude", reason
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
        if curated_row and (conf != "exclude" or curated_row.get("forceRestaurant") is True):
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
    excluded_by_reason = {}
    for x in excluded:
        reason = x.get("classificationReason", "other")
        excluded_by_reason[reason] = excluded_by_reason.get(reason, 0) + 1

    output = {
        "area": "越谷市",
        "generatedAt": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(timespec="seconds"),
        "officialPermitCount": official.get("count", len(official.get("restaurants", []))),
        "count": len(public),
        "countsByConfidence": counts,
        "excludedByReason": excluded_by_reason,
        "basis": "越谷市公式の飲食店営業許可データから、保育・学校・病院・福祉施設・社員食堂・厨房等の明らかな非一般利用施設とコンビニを除外し、一般利用可能性のある飲食店・飲食提供施設を自動分類。手動確認済み店舗はconfirmedとして優先。",
        "caution": "自動分類のため一般客向けでない施設が残る場合、また営業中の店舗を除外する場合があります。営業許可情報は現在営業中であることを保証しません。来店前に最新情報をご確認ください。",
        "restaurants": public,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Public-facing candidates: {len(public)} / official {output['officialPermitCount']}; excluded {len(excluded)}")
    print(json.dumps({"counts": counts, "excludedByReason": excluded_by_reason}, ensure_ascii=False))

if __name__ == "__main__":
    main()
