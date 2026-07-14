import hashlib
import json
import re
from pathlib import Path

import pandas as pd
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = ROOT / "raw" / "official-attachments"

MAJOR_PDF = RAW / "moe-2026" / "undergraduate-major-catalog-2026.pdf"
UNIVERSITY_XLS = RAW / "moe-2025" / "national-regular-universities-2025.xls"

ZHEJIANG_SCORE_FILES = [
    {
        "year": 2025,
        "batch": "普通类第一段",
        "published_at": "2025-07-21",
        "source_url": "https://www.zjzs.net/art/2025/7/21/art_45_11467.html",
        "file": RAW / "zhejiang-2025" / "zhejiang-2025-common-first-section.xls",
    },
    {
        "year": 2025,
        "batch": "普通类第二段",
        "published_at": "2025-07-30",
        "source_url": "https://www.zjzs.net/art/2025/7/30/art_45_11488.html",
        "file": RAW / "zhejiang-2025" / "zhejiang-2025-common-second-section.xls",
    },
    {
        "year": 2024,
        "batch": "普通类第一段",
        "published_at": "2024-07-21",
        "source_url": "https://www.zjzs.net/art/2024/7/21/art_45_9899.html",
        "file": RAW / "zhejiang-2024" / "zhejiang-2024-common-first-section.xls",
    },
    {
        "year": 2024,
        "batch": "普通类第二段",
        "published_at": "2024-07-30",
        "source_url": "https://www.zjzs.net/art/2024/7/30/art_45_10143.html",
        "file": RAW / "zhejiang-2024" / "zhejiang-2024-common-second-section.xls",
    },
]

MAJOR_CATALOG_URL = "https://www.zjzs.net/art/2026/4/28/art_320_12225.html"
UNIVERSITY_LIST_URL = "http://www.moe.gov.cn/jyb_xxgk/s5743/s5744/A03/202506/W020250627301230138068.xls"
PROJECT_985_SOURCE_URL = "https://gaokao.chsi.com.cn/gkxx/gxmd/200803/20080317/4057967.html"
PROJECT_211_SOURCE_URL = "https://www.edu.cn/edu/gao_deng/tong_ji/200603/t20060323_53190.shtml"

DISCIPLINE_DEGREE = {
    "哲学": "哲学学士",
    "经济学": "经济学学士",
    "法学": "法学学士",
    "教育学": "教育学学士",
    "文学": "文学学士",
    "历史学": "历史学学士",
    "理学": "理学学士",
    "工学": "工学学士",
    "农学": "农学学士",
    "医学": "医学学士",
    "管理学": "管理学学士",
    "艺术学": "艺术学学士",
    "交叉学科": "以学校设置为准",
}

PROJECT_985 = {
    "北京大学", "中国人民大学", "清华大学", "北京航空航天大学", "北京理工大学", "中国农业大学", "北京师范大学", "中央民族大学",
    "南开大学", "天津大学", "大连理工大学", "东北大学", "吉林大学", "哈尔滨工业大学", "复旦大学", "同济大学", "上海交通大学",
    "华东师范大学", "南京大学", "东南大学", "浙江大学", "中国科学技术大学", "厦门大学", "山东大学", "中国海洋大学",
    "武汉大学", "华中科技大学", "湖南大学", "中南大学", "中山大学", "华南理工大学", "四川大学", "重庆大学", "电子科技大学",
    "西安交通大学", "西北工业大学", "西北农林科技大学", "兰州大学", "国防科技大学", "中国人民解放军国防科技大学"
}

PROJECT_211 = PROJECT_985 | {
    "北京交通大学", "北京工业大学", "北京科技大学", "北京化工大学", "北京邮电大学", "北京林业大学", "北京中医药大学",
    "北京外国语大学", "中国传媒大学", "中央财经大学", "对外经济贸易大学", "北京体育大学", "中央音乐学院", "中国政法大学",
    "华北电力大学", "中国矿业大学（北京）", "中国石油大学（北京）", "中国地质大学（北京）", "天津医科大学", "河北工业大学",
    "太原理工大学", "内蒙古大学", "辽宁大学", "大连海事大学", "延边大学", "东北师范大学", "哈尔滨工程大学", "东北农业大学",
    "东北林业大学", "华东理工大学", "东华大学", "上海外国语大学", "上海财经大学", "上海大学", "苏州大学", "南京航空航天大学",
    "南京理工大学", "中国矿业大学", "河海大学", "江南大学", "南京农业大学", "中国药科大学", "南京师范大学", "安徽大学",
    "合肥工业大学", "福州大学", "南昌大学", "中国石油大学（华东）", "郑州大学", "中国地质大学（武汉）", "武汉理工大学",
    "华中农业大学", "华中师范大学", "中南财经政法大学", "湖南师范大学", "暨南大学", "华南师范大学", "广西大学", "海南大学",
    "西南大学", "西南交通大学", "四川农业大学", "西南财经大学", "贵州大学", "云南大学", "西藏大学", "西北大学",
    "西安电子科技大学", "长安大学", "陕西师范大学", "青海大学", "宁夏大学", "新疆大学", "石河子大学", "海军军医大学",
    "空军军医大学"
}


def project_tags(name, prior_tags=None):
    tags = list(prior_tags or [])
    if name in PROJECT_985 and "985" not in tags:
        tags.append("985")
    if name in PROJECT_211 and "211" not in tags:
        tags.append("211")
    return tags


def project_note(tags):
    if "985" not in tags and "211" not in tags:
        return ""
    return "；985、211为历史工程标签，仅作家长常用称呼备注，现行重点建设口径请同时查看“双一流”等公开名单。"


def read_json(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def write_json(name, value):
    (DATA / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def clean_text(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return str(value).strip()


def clean_name(value):
    return re.sub(r"（注：.*?）|\(注：.*?\)|\s+", "", clean_text(value))


def strip_region_suffix(value):
    return re.sub(r"(省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$", "", clean_text(value))


def default_major_summary(name, discipline, category):
    return f"{name}是{discipline}{category}下的本科专业。当前页面先展示教育部专业目录字段；课程、就业、考研和FAQ等待阳光高考、学校培养方案等公开来源复核后补充。"


def major_degree(name, discipline):
    note = re.search(r"（注：(.+?)）", name)
    if note:
        text = note.group(1).replace("授予", "").replace("学士学位", "学士")
        return text
    return DISCIPLINE_DEGREE.get(discipline, f"{discipline}学士")


def parse_major_catalog():
    reader = PdfReader(str(MAJOR_PDF))
    discipline = ""
    category = ""
    pending_codes = []
    pending_names = []
    rows = []
    unhandled = []
    major_line = re.compile(r"^([0-9]{6,7}[A-Z]*)[ \t]+(.+)$")
    code_line = re.compile(r"^([0-9]{6,7}[A-Z]*)$")
    discipline_line = re.compile(r"^([0-9]{2})[ \t]*学科门类：(.+)$")
    category_line = re.compile(r"^([0-9]{4})[ \t]+(.+类)$")

    def flush_pending():
        nonlocal pending_codes, pending_names
        while pending_codes and pending_names:
            rows.append((pending_codes.pop(0), pending_names.pop(0), discipline, category))
        if not pending_codes and not pending_names:
            return

    def add_pending_name(name):
        if pending_names and (name.startswith("学位）") or name.startswith("士学位）")):
            pending_names[-1] += name
        else:
            pending_names.append(name)

    for page in reader.pages[2:]:
        text = page.extract_text() or ""
        for raw in text.splitlines():
            line = raw.strip().replace("—", " ").strip()
            if not line or (re.fullmatch(r"[0-9 ]+", line) and len(line.replace(" ", "")) <= 3):
                continue
            match = discipline_line.match(line)
            if match:
                flush_pending()
                discipline = match.group(2).strip()
                category = "交叉学科类" if discipline == "交叉学科" else category
                pending_codes.clear()
                pending_names.clear()
                continue
            match = category_line.match(line)
            if match:
                flush_pending()
                category = match.group(2).strip()
                pending_codes.clear()
                pending_names.clear()
                continue
            match = major_line.match(line)
            if match:
                rows.append((match.group(1), match.group(2).strip(), discipline, category))
                continue
            match = code_line.match(line)
            if match:
                pending_codes.append(match.group(1))
                continue
            if pending_codes and not re.match(r"^[0-9]", line):
                add_pending_name(line)
                continue
            unhandled.append((line, discipline, category, list(pending_codes)))

    flush_pending()
    if len(rows) != 883:
        all_text = "\n".join(page.extract_text() or "" for page in reader.pages)
        all_codes = set(re.findall(r"(?<![0-9])([0-9]{6,7}[A-Z]*)(?![0-9])", all_text))
        parsed_codes = {row[0] for row in rows}
        old_codes_in_notes = {code for _, name, _, _ in rows for code in re.findall(r"原专业代码为([0-9]{6,7}[A-Z]*)", name)}
        print("Missing candidate codes:", sorted(all_codes - parsed_codes - old_codes_in_notes))
        print("0711 rows:", [row for row in rows if row[0].startswith("0711")])
        print("1205 rows:", [row for row in rows if row[0].startswith("1205")])
        print("Unhandled major catalog lines:")
        for item in unhandled[:120]:
            print(item)
        print("Pending codes:", pending_codes)
        print("Last parsed rows:", rows[-20:])
        raise RuntimeError(f"Expected 883 majors from 2026 catalog, parsed {len(rows)}")
    return rows


def import_majors():
    prior = read_json("majors.json") + read_json("major_expansion.json")
    by_code = {item["code"]: item for item in prior}
    by_name = {item["name"]: item for item in prior}
    used_ids = {int(item["id"]) for item in prior if str(item.get("id", "")).isdigit()}
    next_id = max(used_ids or {0}) + 1
    majors = []
    seen = set()
    catalog_hash = sha256(MAJOR_PDF)

    for code, raw_name, discipline, category in parse_major_catalog():
        name = clean_name(raw_name)
        if code in seen:
            raise RuntimeError(f"Duplicate major code {code}")
        seen.add(code)
        prior_item = by_code.get(code) or by_name.get(name) or {}
        if prior_item.get("id"):
            item_id = prior_item["id"]
        else:
            item_id = next_id
            next_id += 1
        slug = prior_item.get("slug") or f"major-{re.sub(r'[^0-9A-Za-z]+', '', code).lower()}"
        summary = prior_item.get("ai_summary") or default_major_summary(name, discipline, category)
        majors.append({
            "id": item_id,
            "code": code,
            "slug": slug,
            "name": name,
            "category": category,
            "discipline": discipline,
            "degree": prior_item.get("degree") or major_degree(raw_name, discipline),
            "duration": prior_item.get("duration") or "四至五年（以学校设置和招生章程为准）",
            "is_special": "T" in code,
            "is_controlled": "K" in code,
            "description": prior_item.get("description") or summary,
            "core_courses": prior_item.get("core_courses") or [],
            "career_directions": prior_item.get("career_directions") or [],
            "postgraduate_directions": prior_item.get("postgraduate_directions") or [],
            "suitable_personality": prior_item.get("suitable_personality") or [],
            "unsuitable_personality": prior_item.get("unsuitable_personality") or [],
            "skill_requirements": prior_item.get("skill_requirements") or [],
            "fit_tags": prior_item.get("fit_tags") or [],
            "civil_service_fit": prior_item.get("civil_service_fit") or "待补充：需结合公务员职位表和岗位专业目录判断。",
            "ai_risk": prior_item.get("ai_risk") or "待补充：需结合典型岗位任务和AI工具发展趋势判断。",
            "future_trend": prior_item.get("future_trend") or "待补充：需结合产业政策、学校培养方案和就业质量报告判断。",
            "ai_summary": summary,
            "faq_json": prior_item.get("faq_json") or [],
            "source_note": prior_item.get("source_note") or f"教育部《普通高等学校本科专业目录（2026年）》公开目录字段；原始PDF SHA256={catalog_hash}；解释性内容待公开来源复核。",
            "source_urls": prior_item.get("source_urls") or [MAJOR_CATALOG_URL],
        })

    majors.sort(key=lambda item: item["code"])
    write_json("majors.json", majors)
    write_json("major_expansion.json", [])
    return len(majors)


def import_universities():
    existing = read_json("universities.json")
    by_code = {clean_text(item.get("moe_code")): item for item in existing if item.get("moe_code")}
    by_name = {item["name"]: item for item in existing}
    used_ids = {int(item["id"]) for item in existing if str(item.get("id", "")).isdigit()}
    next_id = max(used_ids or {0}) + 1
    rows = pd.read_excel(UNIVERSITY_XLS, header=None, dtype=str).fillna("")
    universities = []
    current_province = ""
    list_hash = sha256(UNIVERSITY_XLS)

    for _, row in rows.iterrows():
        first = clean_text(row.iloc[0])
        if re.search(r"（[0-9]+所）", first):
            current_province = strip_region_suffix(first.split("（", 1)[0])
            continue
        if not first.isdigit():
            continue
        name = clean_text(row.iloc[1])
        moe_code = clean_text(row.iloc[2])
        if not name or not moe_code:
            continue
        prior = by_code.get(moe_code) or by_name.get(name) or {}
        if prior.get("id"):
            item_id = prior["id"]
        else:
            item_id = next_id
            next_id += 1
        raw_city = clean_text(row.iloc[4])
        province = prior.get("province") or current_province or strip_region_suffix(raw_city)
        city = prior.get("city") or strip_region_suffix(raw_city) or province
        remark = clean_text(row.iloc[6])
        ownership = prior.get("ownership") or ("中外合作办学" if "中外" in remark else "民办" if "民办" in remark else "公办")
        tags = project_tags(name, prior.get("tags") or [])
        source_urls = list(prior.get("source_urls") or [UNIVERSITY_LIST_URL, "https://hudong.moe.gov.cn/qggxmd/"])
        for url in [PROJECT_985_SOURCE_URL, PROJECT_211_SOURCE_URL]:
            if url not in source_urls:
                source_urls.append(url)
        source_note = prior.get("source_note") or f"教育部全国普通高等学校名单（截至2025年6月20日）公开字段；原始XLS SHA256={list_hash}。"
        if project_note(tags) and "985、211为历史工程标签" not in source_note:
            source_note = source_note.rstrip("。") + project_note(tags) + "。"
        universities.append({
            "id": item_id,
            "moe_code": moe_code,
            "slug": prior.get("slug") or f"u-{moe_code}",
            "name": name,
            "province": province,
            "city": city,
            "level": prior.get("level") or clean_text(row.iloc[5]),
            "type": prior.get("type") or "普通高校",
            "ownership": ownership,
            "authority": prior.get("authority") or clean_text(row.iloc[3]),
            "tags": tags,
            "website": prior.get("website") or "",
            "admission_site": prior.get("admission_site") or "",
            "admission_charter_url": prior.get("admission_charter_url") or "",
            "source_urls": source_urls,
            "description": prior.get("description") or f"{name}位于{province}{city if city != province else ''}，办学层次为{clean_text(row.iloc[5]) or '以教育部名单为准'}。学校官网、招生官网、招生章程和专业设置需继续回到学校及阳光高考公开入口核验。",
            "source_note": source_note
        })

    if len(universities) != 2919:
        raise RuntimeError(f"Expected 2919 regular universities from 2025 list, parsed {len(universities)}")
    universities.sort(key=lambda item: (item["province"], item["moe_code"]))
    write_json("universities.json", universities)
    return len(universities)


def to_int(value):
    text = re.sub(r"[^0-9.-]", "", clean_text(value))
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def match_major(major_by_name, raw_name):
    name = clean_name(raw_name)
    if name in major_by_name:
        return major_by_name[name]
    short = re.sub(r"[（(].*?[）)]", "", name)
    return major_by_name.get(short)


def ensure_score_university(universities, by_name, row, next_id):
    name = clean_text(row["学校名称"])
    if name in by_name:
        return by_name[name], next_id
    code = clean_text(row["学校代号"])
    stable_key = hashlib.sha1(name.encode("utf-8")).hexdigest()[:8]
    item = {
        "id": next_id,
        "moe_code": f"ZJTD-{code}-{stable_key}",
        "slug": f"zjtd-{code}-{stable_key}",
        "name": name,
        "province": "浙江省外/招生单位",
        "city": "待核验",
        "level": "以教育部名单和招生章程为准",
        "type": "浙江投档招生单位",
        "ownership": "待核验",
        "authority": "待核验",
        "tags": [],
        "website": "",
        "admission_site": "",
        "admission_charter_url": "",
        "source_urls": [],
        "description": f"{name}出现在浙江省普通类平行投档分数线表中。学校基础信息需继续回到教育部名单、阳光高考院校库和学校官网核验。",
        "source_note": "由浙江省教育考试院普通类平行投档分数线表补充的招生单位名称；不等同于已完成教育部学校标识码核验。"
    }
    universities.append(item)
    by_name[name] = item
    return item, next_id + 1


def import_zhejiang_scores():
    universities = read_json("universities.json")
    by_university_name = {item["name"]: item for item in universities}
    next_university_id = max(int(item["id"]) for item in universities) + 1
    majors = read_json("majors.json")
    major_by_name = {item["name"]: item for item in majors}
    existing_non_zhejiang = [item for item in read_json("admission_scores.json") if item.get("province") != "浙江"]
    imported = []
    source_counts = []

    for source in ZHEJIANG_SCORE_FILES:
        file_hash = sha256(source["file"])
        df = pd.read_excel(source["file"], dtype=str).fillna("")
        local_count = 0
        for _, row in df.iterrows():
            school_name = clean_text(row.get("学校名称"))
            major_name = clean_text(row.get("专业名称"))
            if not school_name or not major_name or clean_text(row.get("学校代号")) == "学校代号":
                continue
            university, next_university_id = ensure_score_university(universities, by_university_name, row, next_university_id)
            major = match_major(major_by_name, major_name)
            data_grain = "major" if major else "major_group"
            imported.append({
                "id": 0,
                "year": source["year"],
                "province": "浙江",
                "university_id": university["id"],
                "major_id": major["id"] if major else None,
                "data_grain": data_grain,
                "major_group_code": clean_text(row.get("专业代号")),
                "major_group_name": major_name,
                "batch": source["batch"],
                "subject_group": "浙江普通类",
                "min_score": to_int(row.get("分数线")),
                "min_rank": to_int(row.get("位次")),
                "avg_score": None,
                "max_score": None,
                "plan_count": to_int(row.get("计划数")),
                "source_url": source["source_url"],
                "published_at": source["published_at"],
                "source_note": f"浙江省教育考试院{source['year']}年{source['batch']}平行投档分数线表；招生名称为“{major_name}”；原始XLS SHA256={file_hash}；仅作历史参考，不承诺录取概率。"
            })
            local_count += 1
        source_counts.append({**source, "count": local_count, "sha256": file_hash})

    all_scores = existing_non_zhejiang + imported
    for index, item in enumerate(all_scores, start=1):
        item["id"] = index
    write_json("admission_scores.json", all_scores)
    write_json("universities.json", sorted(universities, key=lambda item: (item["province"], str(item["id"]))))
    return source_counts, len(imported), len(universities)


def update_province_sources(source_counts):
    sources = read_json("province_admission_sources.json")
    total_2025 = sum(item["count"] for item in source_counts if item["year"] == 2025)
    total_2024 = sum(item["count"] for item in source_counts if item["year"] == 2024)
    for source in sources:
        if source.get("province") == "浙江":
            source.update({
                "latest_year": 2025,
                "publisher": "浙江省教育考试院",
                "source_name": "浙江省2025、2024年普通高校招生普通类第一段/第二段平行投档分数线表",
                "source_url": "https://www.zjzs.net/art/2025/7/21/art_45_11467.html",
                "published_at": "2025-07-21 / 2025-07-30 / 2024-07-21 / 2024-07-30",
                "data_grain": "专业平行志愿招生名称级；可匹配单一教育部专业时标记为专业级",
                "rank_field": "有位次",
                "status": "已接入2025、2024普通类一段和二段",
                "imported_rows": total_2025 + total_2024,
                "usage_note": "浙江按专业平行志愿投档，适合做“院校 + 招生专业名称”的历史位次参考；大类、试验班、中外合作等不强行映射为单一专业。",
                "next_action": "继续接入招生计划、选科要求、学费、校区，并把招生名称与专业目录做人工复核映射。"
            })
            break
    write_json("province_admission_sources.json", sources)


def update_manifest(major_count, university_count, source_counts, score_count):
    manifest = {
        "generated_at": pd.Timestamp.utcnow().isoformat(),
        "applied": True,
        "inputs": {
            "major_catalog_2026": {
                "path": str(MAJOR_PDF.relative_to(ROOT)),
                "sha256": sha256(MAJOR_PDF),
                "source_url": MAJOR_CATALOG_URL,
            },
            "university_list_2025": {
                "path": str(UNIVERSITY_XLS.relative_to(ROOT)),
                "sha256": sha256(UNIVERSITY_XLS),
                "source_url": UNIVERSITY_LIST_URL,
            },
            "zhejiang_admission_scores": [
                {
                    "year": item["year"],
                    "batch": item["batch"],
                    "path": str(item["file"].relative_to(ROOT)),
                    "sha256": item["sha256"],
                    "source_url": item["source_url"],
                    "rows": item["count"],
                }
                for item in source_counts
            ],
        },
        "outputs": [
            {"type": "majors", "count": major_count, "path": "data/majors.json"},
            {"type": "universities", "count": university_count, "path": "data/universities.json"},
            {"type": "admission_scores", "count": score_count, "path": "data/admission_scores.json"},
        ],
    }
    write_json("import_manifest.json", manifest)


major_count = import_majors()
university_count = import_universities()
source_counts, score_count, university_count_after_scores = import_zhejiang_scores()
update_province_sources(source_counts)
update_manifest(major_count, university_count_after_scores, source_counts, score_count)
print(f"Imported {major_count} majors, {university_count_after_scores} universities/admission units, {score_count} Zhejiang score rows.")
for item in source_counts:
    print(f"- {item['year']} {item['batch']}: {item['count']} rows")
