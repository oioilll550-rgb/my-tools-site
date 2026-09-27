#!/usr/bin/env python3
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "assets/data/restaurants-koshigaya-public.json"
CLASSIFIER = ROOT / "scripts/classify_koshigaya_restaurants.py"

spec = importlib.util.spec_from_file_location("restaurant_classifier", CLASSIFIER)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

data = json.loads(PUBLIC.read_text(encoding="utf-8"))
violations = []

for row in data.get("restaurants", []):
    reason = module.exclusion_reason(row.get("name", ""), row.get("address", ""))
    if reason:
        violations.append({
            "id": row.get("id"),
            "name": row.get("name"),
            "address": row.get("address"),
            "reason": reason,
        })

if violations:
    print("Institutional/non-restaurant records remain in public restaurant data:")
    for row in violations[:100]:
        print(f"- [{row['reason']}] {row['name']} | {row['address']}")
    raise SystemExit(1)

print(f"Restaurant classification audit passed: {data.get('count', 0)} public-facing candidates")
