#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def q(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"

def write_chunk(out_dir, index, statements):
    if not statements:
        return
    path = out_dir / f"{index:04d}.sql"
    path.write_text("\n".join(statements) + "\n", encoding="utf-8")
    print(path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(ROOT / "assets/data/facilities-koshigaya.json"))
    parser.add_argument("--output-dir", default=str(ROOT / ".tmp/d1-seed"))
    parser.add_argument("--chunk-size", type=int, default=150)
    args = parser.parse_args()

    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.sql"):
        old.unlink()

    generated = data.get("generatedAt") or "1970-01-01T00:00:00+00:00"
    header = ["PRAGMA foreign_keys = ON;"]

    for p in data.get("prefectures", []):
        header.append(
            "INSERT INTO prefectures(code,name,name_kana,updated_at) VALUES "
            f"({q(p.get('code'))},{q(p.get('name'))},{q(p.get('nameKana'))},{q(generated)}) "
            "ON CONFLICT(code) DO UPDATE SET name=excluded.name,name_kana=excluded.name_kana,updated_at=excluded.updated_at;"
        )

    for m in data.get("municipalities", []):
        header.append(
            "INSERT INTO municipalities(code,prefecture_code,name,name_kana,municipality_type,updated_at) VALUES "
            f"({q(m.get('code'))},{q(m.get('prefectureCode'))},{q(m.get('name'))},{q(m.get('nameKana'))},"
            f"{q(m.get('municipalityType'))},{q(generated)}) "
            "ON CONFLICT(code) DO UPDATE SET prefecture_code=excluded.prefecture_code,name=excluded.name,"
            "name_kana=excluded.name_kana,municipality_type=excluded.municipality_type,updated_at=excluded.updated_at;"
        )

    for s in data.get("sources", []):
        header.append(
            "INSERT INTO sources(id,provider,title,source_type,url,license,trust_level,update_frequency,retrieved_at,updated_at) VALUES "
            f"({q(s.get('id'))},{q(s.get('provider'))},{q(s.get('title'))},{q(s.get('sourceType'))},{q(s.get('url'))},"
            f"{q(s.get('license'))},{q(s.get('trustLevel','unknown'))},{q(s.get('updateFrequency'))},"
            f"{q(s.get('retrievedAt'))},{q(generated)}) "
            "ON CONFLICT(id) DO UPDATE SET provider=excluded.provider,title=excluded.title,source_type=excluded.source_type,"
            "url=excluded.url,license=excluded.license,trust_level=excluded.trust_level,"
            "update_frequency=excluded.update_frequency,retrieved_at=excluded.retrieved_at,updated_at=excluded.updated_at;"
        )

    for i, c in enumerate(data.get("categories", [])):
        header.append(
            "INSERT INTO categories(id,parent_id,name,slug,facility_type,sort_order) VALUES "
            f"({q(c.get('id'))},{q(c.get('parentId'))},{q(c.get('name'))},{q(c.get('slug'))},{q(c.get('facilityType'))},{i}) "
            "ON CONFLICT(id) DO UPDATE SET parent_id=excluded.parent_id,name=excluded.name,slug=excluded.slug,"
            "facility_type=excluded.facility_type,sort_order=excluded.sort_order;"
        )

    facilities = data.get("facilities", [])
    chunk_index = 1
    for start in range(0, len(facilities), args.chunk_size):
        statements = header[:] if start == 0 else ["PRAGMA foreign_keys = ON;"]
        for f in facilities[start:start + args.chunk_size]:
            fid = f.get("id")
            statements.append(
                "INSERT INTO facilities("
                "id,name,name_kana,facility_type,prefecture_code,municipality_code,postal_code,address,latitude,longitude,"
                "status,opening_date,closing_date,official_url,confidence,last_verified_at,search_text,created_at,updated_at"
                ") VALUES ("
                f"{q(fid)},{q(f.get('name'))},{q(f.get('nameKana'))},{q(f.get('facilityType'))},"
                f"{q(f.get('prefectureCode'))},{q(f.get('municipalityCode'))},{q(f.get('postalCode'))},{q(f.get('address'))},"
                f"{q(f.get('latitude'))},{q(f.get('longitude'))},{q(f.get('status','unknown'))},{q(f.get('openingDate'))},"
                f"{q(f.get('closingDate'))},{q(f.get('officialUrl'))},{q(f.get('confidence','unverified'))},"
                f"{q(f.get('lastVerifiedAt'))},{q(f.get('searchText',''))},{q(generated)},{q(generated)}) "
                "ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_kana=excluded.name_kana,"
                "facility_type=excluded.facility_type,prefecture_code=excluded.prefecture_code,"
                "municipality_code=excluded.municipality_code,postal_code=excluded.postal_code,address=excluded.address,"
                "latitude=excluded.latitude,longitude=excluded.longitude,status=excluded.status,"
                "opening_date=excluded.opening_date,closing_date=excluded.closing_date,official_url=excluded.official_url,"
                "confidence=excluded.confidence,last_verified_at=excluded.last_verified_at,"
                "search_text=excluded.search_text,updated_at=excluded.updated_at;"
            )

            statements.append(f"DELETE FROM facility_categories WHERE facility_id={q(fid)};")
            for cid in f.get("categoryIds", []):
                statements.append(
                    "INSERT OR IGNORE INTO facility_categories(facility_id,category_id,confidence,source) VALUES "
                    f"({q(fid)},{q(cid)},NULL,'auto');"
                )

            statements.append(f"DELETE FROM facility_sources WHERE facility_id={q(fid)};")
            for ref in f.get("sourceRefs", []):
                source_entity_id = ref.get("sourceEntityId") or fid
                statements.append(
                    "INSERT OR REPLACE INTO facility_sources("
                    "facility_id,source_id,source_entity_id,source_url,raw_name,raw_address,permit_date,observed_at,is_primary"
                    ") VALUES ("
                    f"{q(fid)},{q(ref.get('sourceId'))},{q(source_entity_id)},{q(ref.get('sourceUrl'))},"
                    f"{q(ref.get('rawName'))},{q(ref.get('rawAddress'))},{q(ref.get('permitDate'))},"
                    f"{q(ref.get('observedAt'))},{1 if ref.get('primary') else 0});"
                )

        write_chunk(out_dir, chunk_index, statements)
        chunk_index += 1

    # Exact-sync cleanup. Rows that disappeared from the canonical staging dataset
    # must also disappear from D1; otherwise previously misclassified facilities linger.
    source_ids = [s.get("id") for s in data.get("sources", []) if s.get("id")]
    if source_ids:
        cleanup = ["PRAGMA foreign_keys = ON;"]
        for source_id in source_ids:
            cleanup.append(
                "DELETE FROM facility_sources "
                f"WHERE source_id={q(source_id)} "
                f"AND (observed_at IS NULL OR observed_at <> {q(data.get('sources', [{}])[0].get('retrievedAt'))});"
            )
        municipalities = sorted({f.get("municipalityCode") for f in facilities if f.get("municipalityCode")})
        facility_types = sorted({f.get("facilityType") for f in facilities if f.get("facilityType")})
        for municipality in municipalities:
            for facility_type in facility_types:
                cleanup.append(
                    "DELETE FROM facilities "
                    f"WHERE municipality_code={q(municipality)} AND facility_type={q(facility_type)} "
                    "AND NOT EXISTS (SELECT 1 FROM facility_sources fs WHERE fs.facility_id=facilities.id);"
                )
        (out_dir / "9999_cleanup.sql").write_text("\n".join(cleanup) + "\n", encoding="utf-8")
        print(out_dir / "9999_cleanup.sql")

    print(f"Generated {chunk_index - 1} SQL chunks for {len(facilities)} facilities")

if __name__ == "__main__":
    main()
