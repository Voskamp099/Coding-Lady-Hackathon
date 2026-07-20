"""
One-off local transform (NO API calls) to enrich demo data:
  1. Add a single balanced `timeTypes` value to every record (five王潇 time types,
     exactly balanced across categories).
  2. Add a unique `date` (YYYY-MM-DD) to every record.

Run: python scripts/enrich_demo_data.py
"""
import json
import os
from datetime import date, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIFE = os.path.join(ROOT, "frontend", "src", "data", "demo-life.json")
CHILD = os.path.join(ROOT, "frontend", "src", "data", "demo-child.json")

# ---- Balanced type maps (designed by hand for semantic accuracy) ----
# five types: health / play / survival / achievement / flow

LIFE_TYPES = {
    "LM_001": "survival", "LM_002": "achievement", "LM_003": "play",
    "LM_004": "survival", "LM_005": "survival", "LM_006": "health",
    "LM_007": "play", "LM_008": "survival", "LM_009": "health",
    "LM_010": "survival", "LM_011": "health", "LM_012": "play",
    "LM_013": "achievement", "LM_014": "achievement", "LM_015": "survival",
    "LM_016": "survival", "LM_017": "play", "LM_018": "flow",
    "LM_019": "achievement", "LM_020": "flow", "LM_021": "survival",
    "LM_022": "health", "LM_023": "flow", "LM_024": "play",
    "LM_025": "achievement", "LM_026": "achievement", "LM_027": "flow",
    "LM_028": "flow", "LM_029": "achievement", "LM_030": "achievement",
    "LM_031": "play", "LM_032": "health", "LM_033": "play",
    "LM_034": "health", "LM_035": "flow", "LM_036": "health",
    "LM_037": "play", "LM_038": "flow", "LM_039": "health",
    "LM_040": "flow",
}

CHILD_TYPES = {
    "TM_001": "flow", "TM_002": "health", "TM_003": "survival",
    "TM_004": "health", "TM_005": "health", "TM_006": "play",
    "TM_007": "flow", "TM_008": "survival", "TM_009": "achievement",
    "TM_010": "play", "TM_011": "achievement", "TM_012": "play",
    "TM_013": "achievement", "TM_014": "flow", "TM_015": "play",
    "TM_016": "survival", "TM_017": "survival", "TM_018": "play",
    "TM_019": "survival", "TM_020": "health", "TM_021": "flow",
    "TM_022": "flow", "TM_023": "health", "TM_024": "survival",
    "TM_025": "achievement", "TM_026": "achievement", "TM_027": "flow",
    "TM_028": "health", "TM_029": "play", "TM_030": "achievement",
}


def check_balance(name, mapping, expected):
    from collections import Counter
    c = Counter(mapping.values())
    print(f"[{name}] distribution: {dict(c)}")
    for k, v in c.items():
        assert v == expected, f"{name}: type {k} has {v}, expected {expected}"
    assert len(mapping) == expected * 5, f"{name}: total {len(mapping)} != {expected*5}"


def enrich_life():
    with open(LIFE, encoding="utf-8") as f:
        data = json.load(f)

    # unique dates: group by year, spread evenly across that year
    from collections import defaultdict
    by_year = defaultdict(list)
    for i, r in enumerate(data):
        by_year[r["year"]].append(i)

    dates = {}
    for year, idxs in by_year.items():
        n = len(idxs)
        y = int(year)
        for k, idx in enumerate(idxs):
            # spread across ~350 days so days are distinct
            offset = round(350 * k / max(n, 1)) + 5
            dates[idx] = (date(y, 1, 1) + timedelta(days=offset)).isoformat()

    for i, r in enumerate(data):
        r["timeTypes"] = [LIFE_TYPES[r["id"]]]
        r["date"] = dates[i]

    with open(LIFE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # verify uniqueness
    all_dates = [r["date"] for r in data]
    assert len(all_dates) == len(set(all_dates)), "life dates not unique!"
    print(f"[life] {len(data)} records, {len(set(all_dates))} unique dates")


def parse_age(age_str):
    """'7.10' -> (7 years, 10 months); '0.3' -> (0, 3)"""
    parts = str(age_str).split(".")
    years = int(parts[0])
    months = int(parts[1]) if len(parts) > 1 else 0
    return years, months


def enrich_child():
    with open(CHILD, encoding="utf-8") as f:
        data = json.load(f)

    birth = date(2018, 1, 10)
    for r in data:
        y, m = parse_age(r["age"])
        d = birth + timedelta(days=y * 365 + m * 30)
        r["timeTypes"] = [CHILD_TYPES[r["id"]]]
        r["date"] = d.isoformat()

    with open(CHILD, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    all_dates = [r["date"] for r in data]
    assert len(all_dates) == len(set(all_dates)), "child dates not unique!"
    print(f"[child] {len(data)} records, {len(set(all_dates))} unique dates")


if __name__ == "__main__":
    check_balance("life", LIFE_TYPES, 8)
    check_balance("child", CHILD_TYPES, 6)
    enrich_life()
    enrich_child()
    print("done.")
