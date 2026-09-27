#!/usr/bin/env python3
"""Lightweight daily discovery of Koshigaya new-opening candidates.

Design goals:
- Free: standard-library only; no paid search/API.
- Low load: one request per configured source, sequential, short timeout.
- Low GitHub load: output changes only when a new candidate is found.
- Safe publishing: this file discovers candidates only. Confirmed stores are
  promoted separately to assets/data/restaurants-koshigaya.json.
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCES_FILE = ROOT / "scripts" / "restaurant_opening_sources.json"
OUT_FILE = ROOT / "assets" / "data" / "restaurant-opening-candidates.json"

USER_AGENT = "benri-chan-opening-watcher/1.0 (+GitHub Pages)"
MAX_BYTES = 2_000_000
REQUEST_TIMEOUT = 20
PAUSE_SECONDS = 1.0
MAX_CANDIDATES = 160

OPEN_CUES = ("オープン", "OPEN", "開店", "新店")
RENEWAL_CUES = ("リニューアル", "RENEWAL")
CLOSE_ONLY_CUES = ("閉店", "CLOSE", "閉鎖")
NOISE_LINES = (
    "店舗からのお知らせ", "ショップ", "Image", "フロア", "営業時間",
    "お問合せ", "お問い合わせ", "カテゴリ", "ホーム"
)


def now_jst_date() -> str:
    return datetime.now(ZoneInfo("Asia/Tokyo")).date().isoformat()


def clean_text(value: str) -> str:
    value = html.unescape(value or "")
    value = value.replace("\u3000", " ")
    value = re.sub(r"\s+", " ", value).strip()
    return value


def looks_like_opening(text: str) -> bool:
    upper = text.upper()
    has_open = any(cue.upper() in upper for cue in OPEN_CUES)
    if not has_open:
        return False
    if any(cue.upper() in upper for cue in RENEWAL_CUES):
        return False
    if any(cue.upper() in upper for cue in CLOSE_ONLY_CUES) and not any(
        cue.upper() in upper for cue in ("オープン", "OPEN", "開店", "新店")
    ):
        return False
    return True


def extract_opening_date(text: str) -> str:
    # Prefer explicit four-digit year.
    m = re.search(r"(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})日?", text)
    if m:
        y, mo, d = map(int, m.groups())
        try:
            return f"{y:04d}-{mo:02d}-{d:02d}"
        except ValueError:
            return ""

    # Headlines often omit the year (e.g. 10/8 OPEN). Treat it as the current
    # JST year; verification step can correct it before publication.
    m = re.search(r"(?<!\d)(\d{1,2})[月/](\d{1,2})日?", text)
    if m:
        y = datetime.now(ZoneInfo("Asia/Tokyo")).year
        mo, d = map(int, m.groups())
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{mo:02d}-{d:02d}"
    return ""


def extract_name(text: str) -> str:
    # Quoted shop names are common in local-news and mall headlines.
    quoted = re.findall(r"[「『](.*?)[」』]", text)
    if quoted:
        candidates = [clean_text(x) for x in quoted if clean_text(x)]
        if candidates:
            # Prefer the shortest quoted phrase; explanatory quotes tend to be long.
            return min(candidates, key=len)[:100]

    s = clean_text(text)
    # Remove common area/site prefixes and opening clauses.
    s = re.sub(r"^【?越谷市】?", "", s).strip()
    s = re.sub(r"^[^。！？!]{0,45}[。！？!]", "", s).strip()
    s = re.sub(r"(が|は)?\s*(?:\d{1,2}[月/]\d{1,2}日?\s*)?(?:NEW\s*)?OPEN.*$", "", s, flags=re.I)
    s = re.sub(r"(が|は)?\s*\d{1,2}月\d{1,2}日(?:に|から)?\s*オープン.*$", "", s)
    return s[:100] or clean_text(text)[:100]


def candidate_id(source_id: str, url: str, name: str) -> str:
    raw = f"{source_id}|{url}|{name}".encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:16]


def fetch(url: str) -> tuple[bytes, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.1",
            "Accept-Language": "ja,en;q=0.6",
        },
    )
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as response:
        body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise RuntimeError(f"response too large: {url}")
        content_type = response.headers.get_content_charset() or "utf-8"
        return body, content_type


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.current_href: str | None = None
        self.current_text: list[str] = []
        self.links: list[tuple[str, str]] = []
        self.text_lines: list[str] = []
        self._line_parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href")
            self.current_href = href
            self.current_text = []
        if tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "section", "article", "br"}:
            self._flush_line()

    def handle_endtag(self, tag):
        if tag == "a" and self.current_href is not None:
            text = clean_text(" ".join(self.current_text))
            if text:
                self.links.append((self.current_href, text))
            self.current_href = None
            self.current_text = []
        if tag in {"p", "div", "li", "h1", "h2", "h3", "h4", "section", "article"}:
            self._flush_line()

    def handle_data(self, data):
        text = clean_text(data)
        if not text:
            return
        self._line_parts.append(text)
        if self.current_href is not None:
            self.current_text.append(text)

    def close(self):
        super().close()
        self._flush_line()

    def _flush_line(self):
        if self._line_parts:
            line = clean_text(" ".join(self._line_parts))
            if line:
                self.text_lines.append(line)
            self._line_parts = []


def build_candidate(source: dict, headline: str, article_url: str, opening_date: str = "") -> dict:
    name = extract_name(headline)
    return {
        "id": candidate_id(source["id"], article_url, name),
        "name": name,
        "headline": clean_text(headline)[:240],
        "openingDateHint": opening_date or extract_opening_date(headline),
        "sourceId": source["id"],
        "sourceName": source["name"],
        "sourceUrl": article_url,
        "discoveredAt": now_jst_date(),
        "status": "candidate",
    }


def discover_rss(source: dict, body: bytes) -> list[dict]:
    root = ET.fromstring(body)
    found = []
    for item in root.findall(".//item"):
        title = clean_text(item.findtext("title") or "")
        link = clean_text(item.findtext("link") or source["url"])
        if title and looks_like_opening(title):
            found.append(build_candidate(source, title, link))
    return found


def discover_html_links(source: dict, body: bytes, charset: str) -> list[dict]:
    parser = LinkCollector()
    parser.feed(body.decode(charset, errors="replace"))
    parser.close()

    found = []
    for href, text in parser.links:
        if not href or not looks_like_opening(text):
            continue
        url = urljoin(source["url"], href)
        found.append(build_candidate(source, text, url))
    return found


def discover_html_open_blocks(source: dict, body: bytes, charset: str) -> list[dict]:
    parser = LinkCollector()
    parser.feed(body.decode(charset, errors="replace"))
    parser.close()

    found = []
    lines = parser.text_lines
    for i, line in enumerate(lines):
        if not looks_like_opening(line):
            continue

        name = ""
        for nxt in lines[i + 1 : i + 6]:
            if len(nxt) > 120:
                continue
            if any(noise.lower() in nxt.lower() for noise in NOISE_LINES):
                continue
            if looks_like_opening(nxt):
                continue
            name = clean_text(nxt)
            if name:
                break

        headline = line if not name else f"{line} {name}"
        # AEON's special page is itself the authoritative source; no extra crawl.
        found.append(build_candidate(source, headline, source["url"], extract_opening_date(line)))

    return found


def load_existing() -> dict:
    if not OUT_FILE.exists():
        return {
            "area": "越谷市",
            "updatedAt": None,
            "purpose": "新規OPEN候補の軽量自動探索。候補は確認前のため、そのまま本番店舗一覧には掲載しない。",
            "candidates": [],
        }
    return json.loads(OUT_FILE.read_text(encoding="utf-8"))


def main() -> int:
    sources = json.loads(SOURCES_FILE.read_text(encoding="utf-8"))
    existing = load_existing()
    by_id = {item["id"]: item for item in existing.get("candidates", []) if item.get("id")}

    discovered: list[dict] = []
    for idx, source in enumerate(sources):
        try:
            body, charset = fetch(source["url"])
            if source["type"] == "rss":
                items = discover_rss(source, body)
            elif source["type"] == "html-links":
                items = discover_html_links(source, body, charset)
            elif source["type"] == "html-open-blocks":
                items = discover_html_open_blocks(source, body, charset)
            else:
                print(f"Skip unknown source type: {source['type']}")
                items = []
            print(f"{source['name']}: {len(items)} candidate(s)")
            discovered.extend(items)
        except Exception as exc:
            # One broken source must not stop the other low-cost checks.
            print(f"WARN {source['name']}: {exc}")
        if idx + 1 < len(sources):
            time.sleep(PAUSE_SECONDS)

    new_count = 0
    for item in discovered:
        if item["id"] not in by_id:
            by_id[item["id"]] = item
            new_count += 1

    if new_count == 0:
        print("No new candidates; output left unchanged.")
        return 0

    candidates = list(by_id.values())
    candidates.sort(
        key=lambda x: (
            x.get("openingDateHint") or "",
            x.get("discoveredAt") or "",
            x.get("name") or "",
        ),
        reverse=True,
    )
    candidates = candidates[:MAX_CANDIDATES]

    output = {
        "area": "越谷市",
        "updatedAt": now_jst_date(),
        "purpose": "新規OPEN候補の軽量自動探索。候補は確認前のため、そのまま本番店舗一覧には掲載しない。",
        "candidateCount": len(candidates),
        "sourceCount": len(sources),
        "candidates": candidates,
    }
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Added {new_count} new candidate(s); total {len(candidates)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
