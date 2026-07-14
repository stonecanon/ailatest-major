import json
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"

C = {
    "major": "\u4e13\u4e1a",
    "undergraduate_major": "\u672c\u79d1\u4e13\u4e1a",
    "graduate_major": "\u7814\u7a76\u751f\u4e13\u4e1a",
    "department_code": "\u90e8\u95e8\u4ee3\u7801",
    "position": "\u804c\u4f4d",
    "plan_count": "\u62db\u8003\u4eba\u6570",
    "planned_count": "\u8ba1\u5212\u4eba\u6570",
    "hired_count": "\u5f55\u7528\u4eba\u6570",
    "department": "\u90e8\u95e8\u540d\u79f0",
    "recruiting_agency": "\u62db\u5f55\u673a\u5173",
    "recruiting_unit": "\u62db\u5f55\u5355\u4f4d",
    "bureau": "\u7528\u4eba\u53f8\u5c40",
    "using_unit": "\u7528\u4eba\u5355\u4f4d",
    "agency_nature": "\u673a\u6784\u6027\u8d28",
    "position_name": "\u62db\u8003\u804c\u4f4d",
    "position_title": "\u804c\u4f4d\u540d\u79f0",
    "position_code": "\u804c\u4f4d\u4ee3\u7801",
    "exam_category": "\u8003\u8bd5\u7c7b\u522b",
    "education": "\u5b66\u5386",
    "degree": "\u5b66\u4f4d",
    "political_status": "\u653f\u6cbb\u9762\u8c8c",
    "grassroots_years": "\u57fa\u5c42\u5de5\u4f5c\u6700\u4f4e\u5e74\u9650",
    "service_grassroots": "\u670d\u52a1\u57fa\u5c42\u9879\u76ee\u5de5\u4f5c\u7ecf\u5386",
    "work_location": "\u5de5\u4f5c\u5730\u70b9",
    "hukou_location": "\u843d\u6237\u5730\u70b9",
    "remark": "\u5907\u6ce8",
    "unlimited": "\u4e0d\u9650",
    "related_major": "\u76f8\u5173\u4e13\u4e1a",
    "major_related_suffix": "\u53ca\u76f8\u5173\u4e13\u4e1a",
    "class_suffix": "\u7c7b",
    "very_high": "\u5f88\u9ad8",
    "high": "\u8f83\u9ad8",
    "medium": "\u4e2d\u7b49",
    "low": "\u504f\u4f4e",
    "very_low": "\u5f88\u5c11",
    "main_source_name": "\u4e2d\u592e\u673a\u5173\u53ca\u5176\u76f4\u5c5e\u673a\u67842026\u5e74\u5ea6\u8003\u8bd5\u5f55\u7528\u516c\u52a1\u5458\u804c\u4f4d\u8868\u4e0e\u8865\u5145\u5f55\u7528\u804c\u4f4d\u8868",
    "source_note": "\u7531\u7528\u6237\u63d0\u4f9b\u7684\u56fd\u5bb6\u516c\u52a1\u5458\u5c40\u516c\u5f00\u804c\u4f4d\u8868\u6587\u4ef6\u5bfc\u5165\u3002\u4e13\u4e1a\u5339\u914d\u91c7\u7528\u672c\u79d1\u4e13\u4e1a\u540d\u79f0\u3001\u4e13\u4e1a\u4ee3\u7801\u548c\u4e13\u4e1a\u7c7b\u5173\u952e\u8bcd\u7c97\u5339\u914d\uff0c\u53ea\u8868\u793a\u62a5\u540d\u4e13\u4e1a\u8981\u6c42\u4e2d\u51fa\u73b0\u8fc7\u8be5\u4e13\u4e1a\u6216\u4e0d\u9650\uff0c\u4e0d\u4ee3\u8868\u8d44\u683c\u5ba1\u67e5\u4e00\u5b9a\u901a\u8fc7\u3002"
}


def read_json(name):
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def clean(value):
    if pd.isna(value):
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def load_sheet(path, sheet_name=0):
    raw = pd.read_excel(path, sheet_name=sheet_name, header=None, dtype=str)
    header_idx = None
    for idx in range(min(20, len(raw))):
        row = [clean(v) for v in raw.iloc[idx].tolist()]
        joined = "|".join(row)
        if C["department_code"] in joined and C["major"] in joined and (
            C["position"] in joined or C["plan_count"] in joined or C["bureau"] in joined
        ):
            header_idx = idx
            break
    if header_idx is None:
        raise ValueError(f"Cannot find header row in {path} / {sheet_name}")
    df = pd.read_excel(path, sheet_name=sheet_name, header=header_idx, dtype=str)
    df = df.dropna(how="all")
    df.columns = [clean(c) for c in df.columns]
    return df


def get_value(row, candidates):
    for key in candidates:
        if key in row and clean(row[key]):
            return clean(row[key])
    for col in row.index:
        for key in candidates:
            if key in col and clean(row[col]):
                return clean(row[col])
    return ""


def normalize_major_name(name):
    return re.sub(r"[\uff08(].*?[\uff09)]", "", name).strip()


def normalize_code(code):
    return re.sub(r"[^0-9]", "", clean(code))


def split_specialty(text):
    text = clean(text)
    if not text:
        return []
    if C["unlimited"] in text:
        return [C["unlimited"]]
    text = text.replace(C["major_related_suffix"], "").replace(C["related_major"], "")
    text = text.replace("\u3001", ",").replace("\uff0c", ",").replace("\uff1b", ",").replace(";", ",")
    text = text.replace("\u6216", ",")
    parts = [p.strip() for p in text.split(",") if p.strip()]
    return parts or [text]


def is_broad_unlimited(text):
    value = clean(text).replace(" ", "")
    return value in {C["unlimited"], f"{C['major']}{C['unlimited']}", f"{C['unlimited']}{C['major']}"}


def infer_level(count):
    if count >= 300:
        return C["very_high"]
    if count >= 120:
        return C["high"]
    if count >= 40:
        return C["medium"]
    if count >= 10:
        return C["low"]
    return C["very_low"]


def build_major_lookup(majors):
    lookup = []
    for major in majors:
        name = major.get("name", "")
        if not name:
            continue
        candidates = {name, normalize_major_name(name)}
        code = normalize_code(major.get("code", ""))
        category = clean(major.get("category", ""))
        discipline = clean(major.get("discipline", ""))
        lookup.append({
            "id": major["id"],
            "slug": major.get("slug"),
            "name": name,
            "code": code,
            "code4": code[:4] if len(code) >= 4 else "",
            "code2": code[:2] if len(code) >= 2 else "",
            "category": category,
            "discipline": discipline,
            "candidates": sorted(candidates, key=len, reverse=True)
        })
    return lookup


def read_positions(paths):
    positions = []
    for source_path in paths:
        path = Path(source_path)
        excel = pd.ExcelFile(path)
        source_kind = "supplemental" if "\u8865\u5145" in path.name else "main"
        for sheet_name in excel.sheet_names:
            df = load_sheet(path, sheet_name=sheet_name)
            for _, row in df.iterrows():
                specialty = get_value(row, [C["major"], C["undergraduate_major"], C["graduate_major"]])
                department_code = get_value(row, [C["department_code"]])
                if not specialty or specialty == C["major"] or department_code == C["department_code"]:
                    continue
                plan_count_text = get_value(row, [C["plan_count"], C["planned_count"], C["hired_count"]])
                try:
                    plan_count = int(float(plan_count_text))
                except Exception:
                    plan_count = None
                positions.append({
                    "id": len(positions) + 1,
                    "year": 2026,
                    "source_kind": source_kind,
                    "department_code": department_code,
                    "department": get_value(row, [C["department"], C["recruiting_agency"], C["recruiting_unit"]]),
                    "bureau": get_value(row, [C["bureau"], C["using_unit"]]),
                    "agency_nature": get_value(row, [C["agency_nature"]]),
                    "position_name": get_value(row, [C["position_name"], C["position_title"]]),
                    "position_code": get_value(row, [C["position_code"]]),
                    "exam_category": get_value(row, [C["exam_category"]]),
                    "plan_count": plan_count,
                    "education": get_value(row, [C["education"]]),
                    "degree": get_value(row, [C["degree"]]),
                    "specialty": specialty,
                    "political_status": get_value(row, [C["political_status"]]),
                    "grassroots_years": get_value(row, [C["grassroots_years"]]),
                    "service_grassroots": get_value(row, [C["service_grassroots"]]),
                    "work_location": get_value(row, [C["work_location"], C["hukou_location"]]),
                    "remark": get_value(row, [C["remark"]]),
                    "sheet_name": str(sheet_name),
                    "source_file": str(path)
                })
    return positions


def match_positions_to_majors(positions, majors, major_lookup):
    major_stats = {
        major["id"]: {
            "major_id": major["id"],
            "major_slug": major.get("slug"),
            "major_name": major.get("name"),
            "matched_position_count": 0,
            "matched_plan_count": 0,
            "main_position_count": 0,
            "supplemental_position_count": 0,
            "sample_positions": [],
            "matched_keywords": Counter()
        }
        for major in majors
    }

    unmatched_requirements = Counter()
    for position in positions:
        specialty = position["specialty"]
        matched_major_ids = set()
        if is_broad_unlimited(specialty):
            for item in major_lookup:
                matched_major_ids.add(item["id"])
                major_stats[item["id"]]["matched_keywords"][C["unlimited"]] += 1
        else:
            specialty_codes = set(re.findall(r"\d{2,6}", specialty))
            for item in major_lookup:
                code_match = item["code"] and item["code"] in specialty_codes
                prefix4_match = item["code4"] and item["code4"] in specialty_codes
                prefix2_match = item["code2"] and item["code2"] in specialty_codes and item["discipline"] in specialty
                name_match = any(candidate and candidate in specialty for candidate in item["candidates"])
                category_match = item["category"] and item["category"] in specialty
                discipline_match = item["discipline"] and f"{item['discipline']}{C['class_suffix']}" in specialty
                if code_match or prefix4_match or prefix2_match or name_match or category_match or discipline_match:
                    matched_major_ids.add(item["id"])
                    keyword = item["code"] if code_match else item["code4"] if prefix4_match else item["category"] if category_match else item["name"]
                    major_stats[item["id"]]["matched_keywords"][keyword] += 1
        if not matched_major_ids:
            for part in split_specialty(specialty):
                unmatched_requirements[part] += 1
        for major_id in matched_major_ids:
            stat = major_stats[major_id]
            stat["matched_position_count"] += 1
            stat["matched_plan_count"] += position["plan_count"] or 0
            if position["source_kind"] == "main":
                stat["main_position_count"] += 1
            else:
                stat["supplemental_position_count"] += 1
            if len(stat["sample_positions"]) < 8:
                stat["sample_positions"].append({
                    "department": position["department"],
                    "bureau": position["bureau"],
                    "position_name": position["position_name"],
                    "plan_count": position["plan_count"],
                    "education": position["education"],
                    "specialty": position["specialty"],
                    "work_location": position["work_location"],
                    "source_kind": position["source_kind"]
                })

    total_positions = len(positions)
    stats = []
    for stat in major_stats.values():
        count = stat["matched_position_count"]
        stat["position_share"] = round(count / total_positions, 6) if total_positions else 0
        stat["feasibility_level"] = infer_level(count)
        stat["matched_keywords"] = [
            {"keyword": key, "count": value}
            for key, value in stat["matched_keywords"].most_common(10)
        ]
        if count:
            stats.append(stat)

    return sorted(stats, key=lambda item: (-item["matched_position_count"], item["major_name"])), unmatched_requirements


def main(paths):
    majors = read_json("majors.json")
    major_lookup = build_major_lookup(majors)
    positions = read_positions(paths)
    stats, unmatched_requirements = match_positions_to_majors(positions, majors, major_lookup)
    payload = {
        "year": 2026,
        "source_name": C["main_source_name"],
        "source_note": C["source_note"],
        "total_positions": len(positions),
        "main_positions": sum(1 for item in positions if item["source_kind"] == "main"),
        "supplemental_positions": sum(1 for item in positions if item["source_kind"] == "supplemental"),
        "total_plan_count": sum(item["plan_count"] or 0 for item in positions),
        "positions": positions,
        "major_stats": stats,
        "unmatched_requirements": [
            {"requirement": key, "count": value}
            for key, value in unmatched_requirements.most_common(200)
        ]
    }

    out_path = DATA_DIR / "civil_service_positions_2026.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Imported {payload['total_positions']} positions "
        f"({payload['main_positions']} main, {payload['supplemental_positions']} supplemental), "
        f"matched {len(payload['major_stats'])} majors."
    )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python scripts/import-civil-service-positions.py <main.xls> [supplemental.xlsx]")
    main(sys.argv[1:])
