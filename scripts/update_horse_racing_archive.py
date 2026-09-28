#!/usr/bin/env python3
"""Refresh the horse-racing archive with the most recent Saturday/Sunday.

Design rules:
- Runs on Monday JST and targets the immediately preceding Saturday/Sunday.
- Uses JRA result-search pages only to discover the official race URLs and
  the weather/going that was public by post time.
- Horse analysis inputs come from JRA entry tables (出馬表) only.
- Target-race finish order, target-race odds and target-race popularity are
  never copied into the analysis JSON.
- Existing archive files are left untouched unless the whole refresh passes
  validation.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import quote
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "assets" / "data"
JRA = "https://www.jra.go.jp"
RESULT_ENDPOINT = "/JRADB/accessS.html"
ENTRY_ENDPOINT = "/JRADB/accessD.html"
RESULT_SEARCH_ROOT = "pw01skl00999999/B3"

VENUES = {
    "01": ("札幌", "sapporo"),
    "02": ("函館", "hakodate"),
    "03": ("福島", "fukushima"),
    "04": ("新潟", "niigata"),
    "05": ("東京", "tokyo"),
    "06": ("中山", "nakayama"),
    "07": ("中京", "chukyo"),
    "08": ("京都", "kyoto"),
    "09": ("阪神", "hanshin"),
    "10": ("小倉", "kokura"),
}
WEEKDAY_JA = "月火水木金土日"

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (compatible; benrichan-archive-updater/1.0; +https://oioilll550-rgb.github.io/my-tools-site/)",
    "Accept-Language": "ja,en;q=0.7",
})


def log(msg: str) -> None:
    print(msg, flush=True)


def jra_post(path: str, cname: str, *, attempts: int = 3) -> BeautifulSoup:
    last_error = None
    for n in range(attempts):
        try:
            r = SESSION.post(
                JRA + path,
                data={"cname": cname},
                timeout=30,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            r.raise_for_status()
            # JRA database responses have historically used Shift-JIS/CP932.
            r.encoding = "cp932"
            soup = BeautifulSoup(r.text, "html.parser")
            title = soup.title.get_text(" ", strip=True) if soup.title else ""
            if "パラメータエラー" in title:
                raise RuntimeError(f"JRA parameter error: {cname}")
            return soup
        except Exception as exc:
            last_error = exc
            if n + 1 < attempts:
                time.sleep(1.5 * (n + 1))
    raise RuntimeError(f"JRA request failed for {cname}: {last_error}")


def jra_get(url: str, *, attempts: int = 3) -> BeautifulSoup:
    last_error = None
    for n in range(attempts):
        try:
            r = SESSION.get(url, timeout=30)
            r.raise_for_status()
            if not r.encoding or r.encoding.lower() == "iso-8859-1":
                r.encoding = r.apparent_encoding or "utf-8"
            return BeautifulSoup(r.text, "html.parser")
        except Exception as exc:
            last_error = exc
            if n + 1 < attempts:
                time.sleep(1.5 * (n + 1))
    raise RuntimeError(f"JRA GET failed for {url}: {last_error}")


def extract_cnames(html: str, prefix: str) -> list[str]:
    # CNAMEs appear in hrefs and JavaScript doAction(...) calls.
    pat = re.compile(rf"({re.escape(prefix)}[A-Za-z0-9]+/[0-9A-Fa-f]{{2}})")
    out = []
    seen = set()
    for value in pat.findall(html):
        if value not in seen:
            seen.add(value)
            out.append(value)
    return out


def most_recent_weekend(as_of: date) -> tuple[date, date]:
    # "Archive switches on Monday": on Monday use the weekend that just ended.
    # Manual runs on other weekdays also use the last completed Sunday.
    days_since_sunday = (as_of.weekday() - 6) % 7
    if days_since_sunday == 0:
        # If manually run on Sunday, do not treat the still-running day as complete.
        days_since_sunday = 7
    sunday = as_of - timedelta(days=days_since_sunday)
    saturday = sunday - timedelta(days=1)
    return saturday, sunday


def target_as_of() -> date:
    forced = os.environ.get("HORSE_RACING_AS_OF", "").strip()
    if forced:
        return date.fromisoformat(forced)
    return datetime.now(ZoneInfo("Asia/Tokyo")).date()


def month_check_digit(year: int, month: int) -> str:
    root = jra_post(RESULT_ENDPOINT, RESULT_SEARCH_ROOT)
    # JRA includes multiple objParam arrays for different navigation widgets.
    # The past-result month selector is the first script block containing objParam.
    script_text = ""
    for script in root.find_all("script"):
        raw = str(script)
        if "objParam" in raw:
            script_text = raw
            break
    if not script_text:
        raise RuntimeError("JRA result-search month parameter script not found")

    pairs = dict(
        re.findall(
            r'objParam\["(\d{4})"\]\s*=\s*"([0-9A-Fa-f]{2})"',
            script_text,
        )
    )
    key = f"{year % 100:02d}{month:02d}"
    if key not in pairs:
        raise RuntimeError(
            f"JRA result-search month key not found: {key}; "
            f"available tail={list(pairs.keys())[-6:]}"
        )
    return pairs[key].upper()


def result_meetings_for_month(year: int, month: int) -> list[str]:
    cd = month_check_digit(year, month)
    candidates = [
        f"pw01skl10{year:04d}{month:02d}/{cd}",
        f"pw01skl00{year:04d}{month:02d}/{cd}",
    ]
    errors = []
    for cname in candidates:
        try:
            soup = jra_post(RESULT_ENDPOINT, cname, attempts=1)
            meetings = extract_cnames(str(soup), "pw01srl")
            if meetings:
                return meetings
            errors.append(f"{cname}: no meeting links")
        except Exception as exc:
            errors.append(f"{cname}: {exc}")
    raise RuntimeError("JRA monthly result search failed: " + " | ".join(errors))


def parse_meeting_cname(cname: str) -> dict | None:
    # Example: pw01srl10092023020420230402/F2
    # "10" / "00" is the JRA navigation variant, followed by the 2-digit venue.
    m = re.search(
        r"pw01srl(?:10|00)(?P<venue>\d{2})(?P<year>\d{4})(?P<meeting>\d{2})(?P<day>\d{2})(?P<date>\d{8})/[0-9A-Fa-f]{2}$",
        cname,
    )
    if not m:
        return None
    return m.groupdict()


def parse_result_cname(cname: str) -> dict | None:
    # Both 010 and 100 variants exist.
    m = re.search(
        r"pw01sde(?P<variant>01|10)(?P<venue>\d{2})(?P<year>\d{4})(?P<meeting>\d{2})(?P<day>\d{2})(?P<race>\d{2})(?P<date>\d{8})/(?P<cd>[0-9A-Fa-f]{2})$",
        cname,
    )
    if not m:
        return None
    return m.groupdict()


def result_races_for_day(target: date) -> list[dict]:
    meetings = result_meetings_for_month(target.year, target.month)
    date_key = target.strftime("%Y%m%d")
    selected = []
    for meeting_cname in meetings:
        info = parse_meeting_cname(meeting_cname)
        if not info or info["date"] != date_key:
            continue
        venue_code = info["venue"]
        if venue_code not in VENUES:
            continue
        venue, slug = VENUES[venue_code]
        soup = jra_post(RESULT_ENDPOINT, meeting_cname)
        race_cnames = extract_cnames(str(soup), "pw01sde")
        by_race: dict[int, str] = {}
        for cname in race_cnames:
            ri = parse_result_cname(cname)
            if not ri or ri["date"] != date_key or ri["venue"] != venue_code:
                continue
            race_no = int(ri["race"])
            # Prefer the "10" detail variant if both are present.
            if race_no not in by_race or "sde10" in cname:
                by_race[race_no] = cname
        if not by_race:
            raise RuntimeError(
                f"No result races found for {target} {venue}; "
                f"raw candidates={race_cnames[:8]}"
            )
        selected.append({
            "date": target.isoformat(),
            "venue_code": venue_code,
            "venue": venue,
            "slug": slug,
            "meeting_cname": meeting_cname,
            "races": [
                {"raceNo": no, "resultCname": cname}
                for no, cname in sorted(by_race.items())
            ],
        })
    if not selected:
        raise RuntimeError(f"No JRA meetings found for {target.isoformat()}")
    return selected


def related_entry_cname(result_soup: BeautifulSoup, result_cname: str) -> str:
    result_info = parse_result_cname(result_cname)
    if not result_info:
        raise RuntimeError(f"Invalid result CNAME: {result_cname}")
    wanted = (
        result_info["venue"],
        result_info["year"],
        result_info["meeting"],
        result_info["day"],
        result_info["race"],
        result_info["date"],
    )

    entry_pat = re.compile(
        r"(pw01dde(?:01|10)(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})(\d{8})/[0-9A-Fa-f]{2})"
    )
    for match in entry_pat.findall(str(result_soup)):
        full, venue, year, meeting, day, race, date8 = match
        if (venue, year, meeting, day, race, date8) == wanted:
            return full

    # Stable JRA relation observed between result and entry detail CNAME check digits.
    body, cd = result_cname.rsplit("/", 1)
    body = body.replace("pw01sde", "pw01dde", 1)
    entry_cd = (int(cd, 16) + 0x44) & 0xFF
    return f"{body}/{entry_cd:02X}"


def parse_target_conditions(result_soup: BeautifulSoup) -> tuple[str | None, str | None]:
    text = result_soup.get_text(" ", strip=True)
    weather = None
    going = None
    wm = re.search(r"天候\s*(晴|曇|雨|雪)", text)
    if wm:
        weather = wm.group(1)
    gm = re.search(r"(?:芝|ダート|障害)\s*(良|稍重|重|不良)", text)
    if gm:
        going = gm.group(1)
    return weather, going


def normalize_jockey(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[☆▲△◇★]", "", value or "")).strip()


def parse_previous_run(text: str) -> dict | None:
    text = re.sub(r"\s+", " ", text or "").strip()
    if not re.search(r"\d{4}年\d+月\d+日", text):
        return None

    # Keep only facts from this previous run. Popularity is present in JRA text but
    # intentionally not retained.
    m = re.search(
        r"(\d{4})年(\d+)月(\d+)日\s+"
        r"(\S+)\s+"
        r"(.+?)\s+"
        r"(\d+)着\s+"
        r"(\d+)頭\d+番\d+番人気\s+"
        r"(.+?)\s+"
        r"\d+(?:\.\d+)?kg\s+"
        r"(\d+)(芝|ダ|障)\s+"
        r"[\d:.]+\s+"
        r"(良|稍重|重|不良)"
        r"(?:\s+(\d+))?\s+"
        r"\d+kg",
        text,
    )
    if not m:
        return None

    grade = m.group(5).strip()
    surface = m.group(10)
    if "障害" in grade or "ジャンプ" in grade:
        surface = "障"

    return {
        "date": f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}",
        "venue": m.group(4),
        "grade": grade,
        "finish": int(m.group(6)),
        "field": int(m.group(7)),
        "jockey": normalize_jockey(m.group(8)),
        "distance": int(m.group(9)),
        "surface": surface,
        "going": m.group(11),
        "rating": int(m.group(12)) if m.group(12) else None,
    }


def find_race_table(soup: BeautifulSoup):
    for table in soup.find_all("table"):
        header = table.get_text(" ", strip=True)
        if "馬番" in header and "前走" in header and "騎手" in header:
            return table
    raise RuntimeError("JRA entry horse table not found")


def race_title(soup: BeautifulSoup) -> str:
    for selector in [".race_name", ".race-name", "h2"]:
        for node in soup.select(selector):
            text = node.get_text(" ", strip=True)
            if text and text not in {"出馬表"} and not text.startswith("検索"):
                if any(token in text for token in ["歳", "ステークス", "特別", "賞", "カップ", "未勝利", "新馬", "クラス"]):
                    return text
    text = soup.get_text("\n", strip=True)
    m = re.search(r"発走時刻[:：][^\n]*\n+([^\n]+)", text)
    return m.group(1).strip() if m else "レース"


def race_course(soup: BeautifulSoup, title: str) -> dict:
    text = soup.get_text(" ", strip=True)
    m = re.search(r"コース[:：]\s*([\d,]+)メートル（([^）]+)）", text)
    if not m:
        raise RuntimeError(f"Course not found: {title}")
    distance = int(m.group(1).replace(",", ""))
    course_text = m.group(2)
    surface = "ダ" if "ダート" in course_text else "芝" if "芝" in course_text else ""
    context = text[: text.find("コース") + 100] if "コース" in text else text[:2000]
    if "障害" in context or "ジャンプ" in title:
        surface = "障"
    direction = "左" if "左" in course_text else "右" if "右" in course_text else ""
    course_detail = "外" if "外" in course_text else ""
    return {
        "distance": distance,
        "surface": surface,
        "direction": direction,
        "courseDetail": course_detail,
    }


def race_post_time(soup: BeautifulSoup) -> str:
    text = soup.get_text(" ", strip=True)
    m = re.search(r"発走時刻[:：]\s*(\d+)時(\d+)分", text)
    if not m:
        return ""
    return f"{int(m.group(1)):02d}:{int(m.group(2)):02d}"


def race_grade(soup: BeautifulSoup, title: str) -> str:
    # Current-race class only. Previous-run grade icons elsewhere in the page are ignored.
    text = soup.get_text(" ", strip=True)
    start = text.find(title)
    context = text[start : start + 600] if start >= 0 else text[:1200]

    title_grade = re.search(r"(GⅠ|GⅡ|GⅢ|JpnⅠ|JpnⅡ|JpnⅢ|\bL\b)", title)
    if title_grade:
        return title_grade.group(1)

    # Grade icons can be adjacent to the current title; inspect the title node's local parent.
    title_node = None
    for node in soup.find_all(string=True):
        if node.strip() == title:
            title_node = node.parent
            break
    if title_node:
        container = title_node.parent
        for img in container.find_all("img", alt=True):
            alt = img.get("alt", "").strip()
            if alt in {"GⅠ", "GⅡ", "GⅢ", "JpnⅠ", "JpnⅡ", "JpnⅢ"}:
                return alt
            if "リステッド" in alt:
                return "L"

    for label, code in [
        ("3勝クラス", "3勝"),
        ("2勝クラス", "2勝"),
        ("1勝クラス", "1勝"),
        ("オープン", "OP"),
        ("未勝利", "未勝利"),
        ("新馬", "新馬"),
    ]:
        if label in context:
            return code
    return ""


def horse_name_from_cell(cell) -> str:
    # The horse-profile anchor is the safest way to avoid retaining odds/popularity.
    for a in cell.find_all("a"):
        href = a.get("href", "")
        text = a.get_text(" ", strip=True)
        if "accessU.html" in href and text:
            return text
    text = re.sub(r"\s+", " ", cell.get_text(" ", strip=True))
    # Fallback: text before the first odds/weight token.
    return re.split(r"\s+(?:\d+\.\d+\s*\(|取消|除外|\d+kg)", text, maxsplit=1)[0].strip()


def parse_horses(
    entry_soup: BeautifulSoup,
    venue: str,
    target_surface: str,
    target_distance: int,
    target_going: str | None,
) -> list[dict]:
    table = find_race_table(entry_soup)
    horses = []

    for tr in table.find_all("tr"):
        cells = tr.find_all(["th", "td"], recursive=False)
        if len(cells) < 5:
            continue
        texts = [re.sub(r"\s+", " ", c.get_text(" ", strip=True)).strip() for c in cells]

        # Find the horse-info cell by pedigree labels.
        horse_idx = next((i for i, t in enumerate(texts) if "父：" in t and "母" in t), None)
        if horse_idx is None or horse_idx == 0:
            continue

        number = None
        for t in reversed(texts[:horse_idx]):
            if re.fullmatch(r"\d{1,2}", t):
                number = int(t)
                break
        if number is None:
            # Cancelled/excluded rows can have a non-numeric horse number.
            continue

        horse_cell = cells[horse_idx]
        info = texts[horse_idx]
        if "取消" in info or "除外" in info:
            continue

        name = horse_name_from_cell(horse_cell)
        if not name:
            continue

        sire_m = re.search(r"父[:：]\s*(.+?)\s+母[:：]", info)
        damsire_m = re.search(r"母の父[:：]\s*(.+?)(?:\)|$)", info)
        sire = sire_m.group(1).strip() if sire_m else ""
        damsire = damsire_m.group(1).strip() if damsire_m else ""

        jockey_idx = None
        for i in range(horse_idx + 1, len(texts)):
            if "kg" in texts[i]:
                jockey_idx = i
                break
        if jockey_idx is None:
            continue

        rider_text = texts[jockey_idx]
        sex_m = re.search(r"((?:牡|牝|せん)\d+)", rider_text)
        sex_age = sex_m.group(1) if sex_m else ""

        # Rating is printed after the jockey for some graded/open races.
        pre_rating = None
        rating_match = re.search(r"kg\s+(.+?)\s+(\d{2,3})\s+[A-Z]\s*$", rider_text)
        if rating_match:
            jockey = normalize_jockey(rating_match.group(1))
            pre_rating = int(rating_match.group(2))
        else:
            jm = re.search(r"kg\s+(.+)$", rider_text)
            jockey = normalize_jockey(jm.group(1) if jm else "")

        run_cells = cells[jockey_idx + 1 : jockey_idx + 5]
        runs = []
        for run_cell in run_cells:
            run = parse_previous_run(run_cell.get_text(" ", strip=True))
            if run:
                runs.append(run)

        same_jockey_indexes = [
            i for i, run in enumerate(runs)
            if run.get("jockey") == jockey
        ]
        course_evidence = [
            {"finish": run["finish"], "field": run["field"]}
            for run in runs
            if run.get("venue") == venue
            and run.get("surface") == target_surface
            and run.get("distance") == target_distance
        ]
        going_evidence = [
            {"finish": run["finish"], "field": run["field"]}
            for run in runs
            if target_going and run.get("going") == target_going
        ]

        horses.append({
            "number": number,
            "name": name,
            "sexAge": sex_age,
            "jockey": jockey,
            "preRating": pre_rating,
            "runs": runs,
            "pedigree": {"sire": sire, "damsire": damsire},
            "sameJockeyRunIndexes": same_jockey_indexes,
            "courseEvidence": course_evidence,
            "goingEvidence": going_evidence,
        })

    if not horses:
        raise RuntimeError("No horses parsed from JRA entry table")
    return horses


def build_race_analysis(day_info: dict, race_item: dict) -> dict:
    result_cname = race_item["resultCname"]
    result_soup = jra_post(RESULT_ENDPOINT, result_cname)
    entry_cname = related_entry_cname(result_soup, result_cname)
    entry_soup = jra_post(ENTRY_ENDPOINT, entry_cname)

    title = race_title(entry_soup)
    course = race_course(entry_soup, title)
    weather, going = parse_target_conditions(result_soup)
    grade = race_grade(entry_soup, title)
    race_no = race_item["raceNo"]
    key = f"{day_info['date']}-{day_info['slug']}-{race_no}"

    horses = parse_horses(
        entry_soup,
        day_info["venue"],
        course["surface"],
        course["distance"],
        going,
    )

    source_url = f"{JRA}{ENTRY_ENDPOINT}?CNAME={quote(entry_cname, safe='')}"
    # Keep slash readable in the URL after CNAME.
    source_url = source_url.replace("%2F", "/")

    return {
        "race": {
            "key": key,
            "title": title,
            "date": day_info["date"],
            "venue": day_info["venue"],
            "raceNo": race_no,
            "grade": grade,
            "surface": course["surface"],
            "distance": course["distance"],
            "direction": course["direction"],
            "courseDetail": course["courseDetail"],
            "postTime": race_post_time(entry_soup),
            "going": going,
            "weather": weather,
            "status": "archive",
            "kicker": "過去レース",
            "sourceUrl": source_url,
            "sourceLabel": "JRA公式 出馬表",
            "statusMessage": "",
        },
        "horses": horses,
    }


def date_label(d: date) -> str:
    return f"{d.year}年{d.month}月{d.day}日（{WEEKDAY_JA[d.weekday()]}）"


def write_json_atomic(path: Path, data: dict) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def main() -> int:
    as_of = target_as_of()
    saturday, sunday = most_recent_weekend(as_of)
    log(f"As of JST: {as_of}; target weekend: {saturday} / {sunday}")

    target_days = [sunday, saturday]  # newest first in the archive UI
    all_analyses: dict[str, dict] = {}
    schedule_days = []

    for target in target_days:
        log(f"Discovering JRA races for {target}...")
        meetings = result_races_for_day(target)
        venue_blocks = []

        for meeting in meetings:
            log(f"  {meeting['venue']}: {len(meeting['races'])} races")
            race_summaries = []
            for item in meeting["races"]:
                analysis = build_race_analysis(meeting, item)
                key = analysis["race"]["key"]
                all_analyses[key] = analysis
                race_summaries.append(dict(analysis["race"]))
                log(
                    f"    {meeting['venue']}{item['raceNo']}R "
                    f"{analysis['race']['title']} - {len(analysis['horses'])} horses"
                )
                time.sleep(0.12)

            venue_blocks.append({
                "name": meeting["venue"],
                "slug": meeting["slug"],
                "races": race_summaries,
            })

        schedule_days.append({
            "date": target.isoformat(),
            "label": date_label(target),
            "sourceUrl": (
                venue_blocks[0]["races"][0]["sourceUrl"]
                if venue_blocks and venue_blocks[0]["races"]
                else ""
            ),
            "venues": venue_blocks,
        })

    # Validation before touching currently published archive files.
    race_count = len(all_analyses)
    horse_count = sum(len(v["horses"]) for v in all_analyses.values())
    empty = [k for k, v in all_analyses.items() if not v["horses"]]
    if race_count < 20:
        raise RuntimeError(f"Validation failed: only {race_count} races discovered")
    if horse_count < 100:
        raise RuntimeError(f"Validation failed: only {horse_count} horses parsed")
    if empty:
        raise RuntimeError(f"Validation failed: empty races: {empty}")

    target_date_strings = {d.isoformat() for d in target_days}
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Prepare date files first.
    for target in target_days:
        subset = {
            k: v for k, v in all_analyses.items()
            if v["race"]["date"] == target.isoformat()
        }
        if not subset:
            raise RuntimeError(f"No analyses generated for {target}")
        write_json_atomic(
            DATA_DIR / f"horse-racing-past-analysis-{target.isoformat()}.json",
            {"analyses": subset},
        )

    # The archive pointer switches only after every target file is safely written.
    write_json_atomic(
        DATA_DIR / "horse-racing-past-schedule.json",
        {
            "updatedAtJst": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(timespec="seconds"),
            "days": schedule_days,
        },
    )

    # Keep only the current two archive-analysis files.
    for old in DATA_DIR.glob("horse-racing-past-analysis-*.json"):
        match = re.search(r"(\d{4}-\d{2}-\d{2})\.json$", old.name)
        if match and match.group(1) not in target_date_strings:
            old.unlink()

    log(f"Archive ready: {race_count} races / {horse_count} horses")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
