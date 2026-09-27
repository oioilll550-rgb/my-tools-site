#!/usr/bin/env python3
import hashlib
import io
import json
import math
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import pandas as pd
import requests
from bs4 import BeautifulSoup

SOURCE_PAGE = "https://www.city.koshigaya.saitama.jp/kurashi_shisei/fukushi/hokenjo/shokuhin/20160401.html"
OUT = Path("assets/data/restaurants-koshigaya-official.json")

NAME_KEYS = ("施設の名称", "施設名称", "営業所の名称", "営業所名称", "屋号", "店舗名")
ADDR_KEYS = ("施設所在地", "営業所所在地", "所在地", "住所")
TYPE_KEYS = ("営業の種類", "営業種類", "主業種", "業種")
DATE_KEYS = ("許可年月日", "許可日", "届出年月日", "届出日")

def clean(v):
    if v is None:
        return ""
    if isinstance(v, float) and math.isnan(v):
        return ""
    s = str(v).replace("\u3000", " ").strip()
    s = re.sub(r"\s+", " ", s)
    return s

def keynorm(v):
    return re.sub(r"[\s　・･\-－ー()（）]+", "", clean(v)).lower()

def find_col(headers, keys):
    for i, h in enumerate(headers):
        h2 = clean(h)
        if any(k in h2 for k in keys):
            return i
    return None

def parse_date(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return ""
    if isinstance(v, pd.Timestamp):
        return v.date().isoformat()
    if isinstance(v, datetime):
        return v.date().isoformat()

    s = unicodedata.normalize("NFKC", clean(v))

    # Gregorian forms: 2026-04-21, 2026/4/21, 2026年4月21日, etc.
    m = re.search(
        r"(?<!\\d)(\\d{4})\\s*[./年\\-]\\s*(\\d{1,2})\\s*[./月\\-]\\s*(\\d{1,2})\\s*日?",
        s,
    )
    if m:
        y, mo, d = map(int, m.groups())
        try:
            return datetime(y, mo, d).date().isoformat()
        except ValueError:
            return ""

    # Japanese era forms, including whitespace such as "R5. 1.24".
    m = re.search(
        r"(令和|平成|昭和|R|H|S)\\s*(元|\\d{1,2})\\s*[./年\\-]\\s*"
        r"(\\d{1,2})\\s*[./月\\-]\\s*(\\d{1,2})\\s*日?",
        s,
        re.I,
    )
    if m:
        era, era_year, mo, d = m.groups()
        era_key = era.upper() if len(era) == 1 else era
        offsets = {"令和": 2018, "平成": 1988, "昭和": 1925, "R": 2018, "H": 1988, "S": 1925}
        y = 1 if era_year == "元" else int(era_year)
        year = offsets[era_key] + y
        try:
            return datetime(year, int(mo), int(d)).date().isoformat()
        except ValueError:
            return ""

    return ""

def detect_header(df):
def detect_header(df):
    limit = min(len(df), 30)
    for r in range(limit):
        headers = [clean(v) for v in df.iloc[r].tolist()]
        n = find_col(headers, NAME_KEYS)
        a = find_col(headers, ADDR_KEYS)
        if n is not None and a is not None:
            return r, headers, n, a, find_col(headers, TYPE_KEYS), find_col(headers, DATE_KEYS)
    return None

def parse_workbook(content, source_url):
    found = []
    try:
        book = pd.read_excel(io.BytesIO(content), sheet_name=None, header=None, engine="xlrd")
    except Exception as e:
        print(f"read_excel failed: {source_url}: {e}", file=sys.stderr)
        return found

    for sheet_name, df in book.items():
        if df.empty:
            continue
        detected = detect_header(df)
        if not detected:
            continue
        header_row, headers, name_col, addr_col, type_col, date_col = detected
        sheet_is_foodservice = "飲食店" in clean(sheet_name)

        for r in range(header_row + 1, len(df)):
            row = df.iloc[r].tolist()
            name = clean(row[name_col]) if name_col < len(row) else ""
            addr = clean(row[addr_col]) if addr_col < len(row) else ""
            typ = clean(row[type_col]) if type_col is not None and type_col < len(row) else ""
            if not name or not addr:
                continue
            if not sheet_is_foodservice and "飲食店営業" not in typ:
                continue
            if any(x in name for x in ("合計", "計　", "計 ")):
                continue

            permit_date = parse_date(row[date_col]) if date_col is not None and date_col < len(row) else ""
            stable = hashlib.sha1((keynorm(name) + "|" + keynorm(addr)).encode("utf-8")).hexdigest()[:14]
            found.append({
                "id": "official-" + stable,
                "name": name,
                "address": addr,
                "permitType": typ or "飲食店営業",
                "permitDate": permit_date,
                "sourceUrl": source_url,
            })
    return found

def main():
    session = requests.Session()
    session.headers.update({"User-Agent": "Mozilla/5.0 (compatible; benri-chan-site-updater/1.0)"})
    page = session.get(SOURCE_PAGE, timeout=30)
    page.raise_for_status()
    soup = BeautifulSoup(page.text, "html.parser")

    urls = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if re.search(r"\.xlsx?$", href, re.I):
            u = urljoin(SOURCE_PAGE, href)
            if u not in urls:
                urls.append(u)

    if not urls:
        raise RuntimeError("No Excel links found on official source page")

    all_rows = []
    sources = []
    for i, url in enumerate(urls):
        r = session.get(url, timeout=60)
        r.raise_for_status()
        rows = parse_workbook(r.content, url)
        sources.append({"id": i, "url": url, "rows": len(rows)})
        all_rows.extend(rows)
        print(f"{url}: {len(rows)} foodservice rows")

    # Same shop/address can appear in annual snapshot and monthly additions.
    # Keep the record with the newest permit date where possible.
    dedup = {}
    for row in all_rows:
        k = keynorm(row["name"]) + "|" + keynorm(row["address"])
        prev = dedup.get(k)
        if prev is None or row.get("permitDate", "") >= prev.get("permitDate", ""):
            dedup[k] = row

    restaurants = sorted(dedup.values(), key=lambda x: (x["address"], x["name"]))
    payload = {
        "area": "越谷市",
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourcePage": SOURCE_PAGE,
        "basis": "越谷市が公開する食品関係営業施設一覧から「飲食店営業」を抽出。年度基準日時点の営業許可（届出）施設に、その後公開された月次分を加えたもの。",
        "caution": "営業許可（届出）ベースのため、一般客向け飲食店以外の給食施設・事業所内食堂等を含む場合があります。また、基準日以降の廃業が月次資料に反映されない場合があります。",
        "count": len(restaurants),
        "sources": sources,
        "restaurants": restaurants,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}: {len(restaurants)} establishments")

if __name__ == "__main__":
    main()
