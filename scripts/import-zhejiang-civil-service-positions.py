import json
import re
from collections import Counter
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DESKTOP = Path(r"C:\Users\dell\Desktop")


C = {
    "unit": "\u62db\u5f55\u5355\u4f4d\u540d\u79f0",
    "position_code": "\u804c\u4f4d\u4ee3\u7801",
    "position_name": "\u804c\u4f4d\u540d\u79f0",
    "position_attr": "\u804c\u4f4d\u5c5e\u6027",
    "position_category": "\u804c\u4f4d\u5927\u7c7b",
    "sub_category": "\u804c\u4f4d\u5c0f\u7c7b",
    "plan_count": "\u62db\u5f55\u4eba\u6570",
    "description": "\u804c\u4f4d\u7b80\u4ecb",
    "education": "\u5b66\u5386\u8981\u6c42",
    "degree": "\u5b66\u4f4d\u8981\u6c42",
    "identity": "\u73b0\u6709\u8eab\u4efd\u8981\u6c42",
    "political": "\u653f\u6cbb\u9762\u8c8c\u8981\u6c42",
    "major_requirement": "\u4e13\u4e1a\u8981\u6c42",
    "remark": "\u5907\u6ce8",
    "unlimited": "\u4e0d\u9650",
    "class_suffix": "\u7c7b",
    "very_high": "\u5f88\u9ad8",
    "high": "\u8f83\u9ad8",
    "medium": "\u4e2d\u7b49",
    "low": "\u504f\u4f4e",
    "very_low": "\u5f88\u5c11",
}


def read_json(name):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def clean(value):
    if pd.isna(value):
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def normalize_code(code):
    return re.sub(r"[^0-9]", "", clean(code))


def normalize_major_name(name):
    return re.sub(r"[\uff08(].*?[\uff09)]", "", name).strip()


def get_value(row, names):
    for name in names:
        if name in row and clean(row[name]):
            return clean(row[name])
    return ""


def infer_level(count):
    if count >= 80:
        return C["very_high"]
    if count >= 35:
        return C["high"]
    if count >= 12:
        return C["medium"]
    if count >= 3:
        return C["low"]
    return C["very_low"]


def is_broad_unlimited(text):
    value = clean(text).replace(" ", "")
    return value in {C["unlimited"], f"\u4e13\u4e1a{C['unlimited']}", f"{C['unlimited']}\u4e13\u4e1a"}


def build_major_lookup(majors):
    lookup = []
    for major in majors:
        name = major.get("name", "")
        code = normalize_code(major.get("code", ""))
        category = clean(major.get("category", ""))
        discipline = clean(major.get("discipline", ""))
        candidates = {name, normalize_major_name(name)}
        lookup.append({
            "id": major["id"],
            "slug": major.get("slug"),
            "name": name,
            "code": code,
            "code4": code[:4] if len(code) >= 4 else "",
            "code2": code[:2] if len(code) >= 2 else "",
            "category": category,
            "discipline": discipline,
            "candidates": sorted([item for item in candidates if item], key=len, reverse=True),
        })
    return lookup


def read_positions():
    positions = []
    for path in sorted(DESKTOP.glob("*浙江省各级机关单位公务员招考计划一览表.xlsx")):
        year_match = re.search(r"(20\d{2})", path.name)
        year = int(year_match.group(1)) if year_match else None
        excel = pd.ExcelFile(path)
        for sheet in excel.sheet_names:
            df = pd.read_excel(path, sheet_name=sheet, dtype=str)
            df = df.dropna(how="all")
            df.columns = [clean(col) for col in df.columns]
            for _, row in df.iterrows():
                major_requirement = get_value(row, [C["major_requirement"]])
                if not major_requirement:
                    continue
                try:
                    plan_count = int(float(get_value(row, [C["plan_count"]]) or 0))
                except Exception:
                    plan_count = None
                positions.append({
                    "id": len(positions) + 1,
                    "year": year,
                    "province": "\u6d59\u6c5f",
                    "sheet_name": sheet,
                    "unit": get_value(row, [C["unit"]]),
                    "position_code": get_value(row, [C["position_code"]]),
                    "position_name": get_value(row, [C["position_name"]]),
                    "position_attr": get_value(row, [C["position_attr"]]),
                    "position_category": get_value(row, [C["position_category"]]),
                    "sub_category": get_value(row, [C["sub_category"]]),
                    "plan_count": plan_count,
                    "description": get_value(row, [C["description"]]),
                    "education": get_value(row, [C["education"]]),
                    "degree": get_value(row, [C["degree"]]),
                    "identity": get_value(row, [C["identity"]]),
                    "political_status": get_value(row, [C["political"]]),
                    "specialty": major_requirement,
                    "remark": get_value(row, [C["remark"]]),
                    "source_file": str(path)
                })
    return positions


def match_positions(positions, majors, lookup):
    stats = {
        major["id"]: {
            "major_id": major["id"],
            "major_slug": major.get("slug"),
            "major_name": major.get("name"),
            "matched_position_count": 0,
            "matched_plan_count": 0,
            "year_counts": {},
            "sample_positions": [],
            "matched_keywords": Counter(),
        }
        for major in majors
    }
    unmatched = Counter()
    for position in positions:
        text = position["specialty"]
        matched = set()
        if is_broad_unlimited(text):
            for item in lookup:
                matched.add(item["id"])
                stats[item["id"]]["matched_keywords"][C["unlimited"]] += 1
        else:
            codes = set(re.findall(r"\d{2,6}", text))
            for item in lookup:
                code_match = item["code"] and item["code"] in codes
                prefix4_match = item["code4"] and item["code4"] in codes
                prefix2_match = item["code2"] and item["code2"] in codes and item["discipline"] in text
                name_match = any(candidate in text for candidate in item["candidates"])
                category_match = item["category"] and item["category"] in text
                discipline_match = item["discipline"] and f"{item['discipline']}{C['class_suffix']}" in text
                if code_match or prefix4_match or prefix2_match or name_match or category_match or discipline_match:
                    matched.add(item["id"])
                    keyword = item["code"] if code_match else item["code4"] if prefix4_match else item["category"] if category_match else item["name"]
                    stats[item["id"]]["matched_keywords"][keyword] += 1
        if not matched:
            unmatched[text[:80]] += 1
        for major_id in matched:
            stat = stats[major_id]
            stat["matched_position_count"] += 1
            stat["matched_plan_count"] += position["plan_count"] or 0
            year_key = str(position["year"])
            stat["year_counts"][year_key] = stat["year_counts"].get(year_key, 0) + 1
            if len(stat["sample_positions"]) < 8:
                stat["sample_positions"].append({
                    "year": position["year"],
                    "unit": position["unit"],
                    "position_name": position["position_name"],
                    "position_category": position["position_category"],
                    "plan_count": position["plan_count"],
                    "education": position["education"],
                    "specialty": position["specialty"],
                })
    result = []
    total = len(positions)
    for stat in stats.values():
        count = stat["matched_position_count"]
        if not count:
            continue
        stat["position_share"] = round(count / total, 6) if total else 0
        stat["feasibility_level"] = infer_level(count)
        stat["matched_keywords"] = [
            {"keyword": key, "count": value}
            for key, value in stat["matched_keywords"].most_common(10)
        ]
        result.append(stat)
    return sorted(result, key=lambda item: (-item["matched_position_count"], item["major_name"])), unmatched


def main():
    majors = read_json("majors.json")
    positions = read_positions()
    stats, unmatched = match_positions(positions, majors, build_major_lookup(majors))
    payload = {
        "province": "\u6d59\u6c5f",
        "years": [2023, 2024, 2025],
        "source_name": "\u6d59\u6c5f\u77012023-2025\u5404\u7ea7\u673a\u5173\u5355\u4f4d\u516c\u52a1\u5458\u62db\u8003\u8ba1\u5212\u4e00\u89c8\u8868",
        "source_note": "\u7531\u7528\u6237\u63d0\u4f9b\u7684\u6d59\u6c5f\u7701\u516c\u52a1\u5458\u62db\u8003\u8ba1\u5212\u8868\u5bfc\u5165\u3002\u4e13\u4e1a\u5339\u914d\u4e3a\u7c97\u5339\u914d\uff0c\u4e0d\u4ee3\u8868\u62a5\u540d\u8d44\u683c\u5ba1\u67e5\u4e00\u5b9a\u901a\u8fc7\u3002",
        "total_positions": len(positions),
        "total_plan_count": sum(item["plan_count"] or 0 for item in positions),
        "positions": positions,
        "major_stats": stats,
        "unmatched_requirements": [
            {"requirement": key, "count": value}
            for key, value in unmatched.most_common(200)
        ],
    }
    (DATA_DIR / "civil_service_positions_zhejiang_2023_2025.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Imported {payload['total_positions']} Zhejiang positions; matched {len(stats)} majors.")


if __name__ == "__main__":
    main()
