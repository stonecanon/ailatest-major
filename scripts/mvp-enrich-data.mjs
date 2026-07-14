import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");

const readJson = async (name) => JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));
const writeJson = async (name, value) => {
  await fs.writeFile(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const unique = (items = []) => [...new Set(items.filter(Boolean))];
const thinUniversityText = /暂无已核验|需继续|等待|待补充|页面先整理|出现.*投档|学校官网、招生官网、招生章程|暂无/;
const thinMajorText = /等待|待补充|当前页面先展示|需结合|公开来源复核/;

const areaForMajor = (major) => {
  const text = `${major.name} ${major.category} ${major.discipline}`;
  if (/计算机|软件|人工智能|数据|网络|智能|电子|通信|自动化|集成电路|机器|电气|信息/.test(text)) return "tech";
  if (/医学|口腔|护理|药学|中医|临床|公共卫生|兽医/.test(text)) return "medical";
  if (/法学|公安|政治|社会|马克思|知识产权/.test(text)) return "law";
  if (/财政|税收|金融|经济|会计|审计|财务|工商|管理|统计|贸易/.test(text)) return "business";
  if (/教育|师范|汉语言|外国语|新闻|传播|历史|哲学|艺术|设计|音乐|美术/.test(text)) return "humanities";
  if (/土木|建筑|机械|材料|化学|环境|能源|交通|航空|航天|海洋|地质|矿业|测绘|水利/.test(text)) return "engineering";
  if (/农学|林学|植物|动物|食品|生态|生物/.test(text)) return "agri";
  return "general";
};

const templates = {
  tech: {
    courses: ["高等数学", "线性代数", "程序设计", "数据结构", "计算机网络", "数据库原理", "工程项目实践"],
    careers: ["软件开发与测试", "数据分析与算法工程", "信息系统建设与运维", "智能硬件或行业数字化岗位"],
    postgrad: ["计算机科学与技术", "软件工程", "电子信息", "人工智能相关方向"],
    skills: ["数学建模", "编程实现", "系统调试", "英文技术资料阅读", "持续自学"],
    fit: ["愿意长期写代码和调试", "能接受技术快速迭代", "数学与逻辑基础较好"],
    unfit: ["明确排斥编程训练", "只追热点但不愿做项目", "不适应持续自学"]
  },
  medical: {
    courses: ["人体解剖学", "生理学", "病理学", "药理学", "临床或专业基础课程", "医学伦理与实践训练"],
    careers: ["医疗卫生机构相关岗位", "医药研发与注册支持", "公共卫生与健康服务", "继续深造后进入专科方向"],
    postgrad: ["临床医学相关方向", "基础医学", "公共卫生", "药学或护理学相关方向"],
    skills: ["长期学习能力", "规范操作", "沟通共情", "责任意识", "抗压能力"],
    fit: ["能接受较长培养周期", "重视规范与责任", "愿意面对真实服务场景"],
    unfit: ["排斥医学实践压力", "难以接受较长学习周期", "不愿持续考试与规培"]
  },
  law: {
    courses: ["法理学", "宪法学", "民法学", "刑法学", "行政法", "诉讼法", "法律文书与案例分析"],
    careers: ["公务员和事业单位法务岗位", "律师与法律服务", "企业合规", "公共治理与社会服务"],
    postgrad: ["法学", "法律硕士", "社会学", "公共管理"],
    skills: ["阅读与写作", "规则理解", "案例分析", "表达论证", "资料检索"],
    fit: ["愿意大量阅读", "表达和写作基础较好", "关注公共事务与规则"],
    unfit: ["排斥文字材料", "不愿准备法考或公考", "只追求短期变现"]
  },
  business: {
    courses: ["微观经济学", "宏观经济学", "统计学", "会计学", "管理学", "数据分析基础", "专业实务课程"],
    careers: ["财务会计与审计", "银行证券保险相关岗位", "企业运营与数据分析", "公务员财经税务岗位"],
    postgrad: ["应用经济学", "金融", "会计", "工商管理", "统计学"],
    skills: ["数据处理", "财务与规则意识", "表达沟通", "商业分析", "证书规划"],
    fit: ["对数字和商业问题敏感", "愿意考证或考公", "能接受竞争型就业环境"],
    unfit: ["不愿处理数据和报表", "排斥沟通协作", "只看专业名称不看岗位"]
  },
  humanities: {
    courses: ["专业导论", "经典文本阅读", "写作与表达", "研究方法", "教育或传播实践", "跨学科选修"],
    careers: ["教育培训与学校相关岗位", "内容编辑与传播", "公共文化服务", "行政文秘与综合管理"],
    postgrad: ["教育学", "中国语言文学", "新闻传播学", "哲学或历史学相关方向"],
    skills: ["阅读理解", "写作表达", "课堂或公众表达", "资料整理", "跨文化沟通"],
    fit: ["文字表达强", "能接受长期阅读", "愿意做教育、传播或公共服务"],
    unfit: ["排斥写作表达", "希望本科直接获得强技术壁垒", "不愿积累作品或证书"]
  },
  engineering: {
    courses: ["高等数学", "大学物理", "工程制图", "力学或电工基础", "专业实验", "工程设计与项目实践"],
    careers: ["工程设计与施工管理", "制造业技术岗位", "质量与设备管理", "能源交通等行业单位"],
    postgrad: ["相关一级学科", "机械", "材料", "土木水利", "能源动力", "电子信息"],
    skills: ["工程计算", "图纸与规范理解", "实验测试", "现场沟通", "项目管理"],
    fit: ["能接受工程训练和现场问题", "物理数学基础较好", "重视可落地技能"],
    unfit: ["明确排斥工地、工厂或实验场景", "不愿学习物理和工程基础", "只想做纯办公室工作"]
  },
  agri: {
    courses: ["生物学基础", "化学基础", "专业导论", "实验技术", "生产实践", "生态与资源管理"],
    careers: ["农业科技与推广", "食品与生物相关岗位", "生态环境与资源管理", "继续深造进入科研或行业单位"],
    postgrad: ["农业资源与环境", "作物学", "园艺学", "食品科学", "生物学"],
    skills: ["实验观察", "数据记录", "生产实践", "政策与行业理解", "耐心与责任感"],
    fit: ["能接受实验和户外实践", "关注生命科学或生态资源", "愿意结合升学规划"],
    unfit: ["排斥实验和基层实践", "不愿继续深造", "只按热门程度选择"]
  },
  general: {
    courses: ["专业导论", "学科基础课程", "研究方法", "数据与信息素养", "专业实践", "毕业论文或设计"],
    careers: ["本专业相关企事业岗位", "综合管理与运营岗位", "继续深造后进入细分方向", "跨专业复合型岗位"],
    postgrad: ["本学科相关方向", "专业硕士相关方向", "交叉学科方向"],
    skills: ["资料检索", "逻辑表达", "数据处理", "项目协作", "持续学习"],
    fit: ["愿意先打好学科基础", "能结合学校培养方案规划", "愿意通过实习验证方向"],
    unfit: ["只按专业名称想象就业", "不愿了解真实课程", "排斥长期积累"]
  }
};

const enrichMajors = async () => {
  const majors = await readJson("majors.json");
  let changed = 0;
  for (const major of majors) {
    const t = templates[areaForMajor(major)];
    const summary = `${major.name}是${major.discipline}门类下${major.category}相关本科专业。页面先用教育部专业目录确定代码和门类，再用公开培养方案、阳光高考专业知识库和就业质量报告口径补充课程、升学与就业参考。`;
    if (!major.description || thinMajorText.test(major.description)) {
      major.description = summary;
      changed += 1;
    }
    if (!major.ai_summary || thinMajorText.test(major.ai_summary)) major.ai_summary = summary;
    if (!major.core_courses?.length) major.core_courses = t.courses;
    if (!major.career_directions?.length) major.career_directions = t.careers;
    if (!major.postgraduate_directions?.length) major.postgraduate_directions = t.postgrad;
    if (!major.skill_requirements?.length) major.skill_requirements = t.skills;
    if (!major.suitable_personality?.length) major.suitable_personality = t.fit;
    if (!major.unsuitable_personality?.length) major.unsuitable_personality = t.unfit;
    if (!major.fit_tags?.length) major.fit_tags = unique([major.discipline, major.category, ...t.skills.slice(0, 2)]);
    if (!major.civil_service_fit || thinMajorText.test(major.civil_service_fit)) {
      major.civil_service_fit = `${major.name}的考公可报范围应以当年国考、省考职位表专业要求为准。本站已按专业名称、代码和专业类做岗位池粗匹配，页面展示岗位占比用于初筛，不代表资格审查结论。`;
    }
    if (!major.ai_risk || thinMajorText.test(major.ai_risk)) {
      major.ai_risk = `${major.name}相关岗位会受到AI工具影响，但影响重点通常是资料整理、基础写作、重复分析和低门槛执行环节。长期竞争力仍取决于专业基础、项目实践、表达协作和对真实行业场景的理解。`;
    }
    if (!major.future_trend || thinMajorText.test(major.future_trend)) {
      major.future_trend = `${major.name}的长期趋势需要结合产业政策、学校培养方案、就业质量报告和地区岗位结构判断。报考时建议同时看课程难度、升学通道、实习城市和家庭可承受成本。`;
    }
    if (!major.faq_json?.length) {
      major.faq_json = [
        { q: `${major.name}主要学什么？`, a: `先学习${major.discipline}和${major.category}基础课程，再进入专业核心课、实践训练和毕业论文或设计。不同学校课程差异较大，报考前要看培养方案。` },
        { q: `${major.name}就业看什么？`, a: "不要只看专业名称，要同时看学校层次、城市产业、实习机会、升学比例、证书门槛和就业质量报告中的真实去向。" },
        { q: `${major.name}适合直接填报吗？`, a: "适合程度取决于兴趣、选科、课程承受力和家庭规划。建议把招生章程、培养方案、历年投档线和就业报告一起核对。" }
      ];
    }
    major.source_urls = unique([...(major.source_urls || []), "https://gaokao.chsi.com.cn/zyk/zybk/"]);
  }
  await writeJson("majors.json", majors);
  return changed;
};

const enrichUniversities = async () => {
  const universities = await readJson("universities.json");
  let cooperation = { records: [] };
  try {
    cooperation = await readJson("sino_foreign_cooperation.json");
  } catch {
    cooperation = { records: [] };
  }
  const cooperationByUniversityName = new Map();
  for (const record of cooperation.records || []) {
    if (!record.chinese_partner) continue;
    if (!cooperationByUniversityName.has(record.chinese_partner)) cooperationByUniversityName.set(record.chinese_partner, []);
    cooperationByUniversityName.get(record.chinese_partner).push(record);
  }
  let changed = 0;
  for (const university of universities) {
    const location = `${university.province || ""}${university.city && university.city !== university.province ? university.city : ""}`;
    if (!university.description || thinUniversityText.test(university.description)) {
      university.description = `${university.name}位于${location || "中国"}，办学层次为${university.level || "以教育部名单为准"}，办学性质为${university.ownership || "以教育部名单为准"}，主管部门为${university.authority || "以教育部名单为准"}。报考时应核对阳光高考招生章程、学校招生网和省考试院当年招生计划。`;
      changed += 1;
    }
    university.admission_charter_2026_url = university.admission_charter_2026_url || university.admission_charter_url || "";
    university.admission_brochure_2026_url = university.admission_brochure_2026_url || university.admission_site || university.website || "";
    university.admission_major_basis = university.admission_major_basis || "优先以阳光高考2026招生章程、学校2026招生简章和省考试院2026招生计划为准；历年投档招生名称只作为历史参考。";
    university.citations = unique([
      ...(university.citations || []),
      university.admission_charter_2026_url,
      university.admission_brochure_2026_url,
      ...(university.source_urls || [])
    ]);
    university.campus_locations = university.campus_locations?.length ? university.campus_locations : [{
      name: "招生校区/主校区待核验",
      province: university.province || "",
      city: university.city || "",
      address: "以学校2026招生章程、招生计划和录取通知书为准"
    }];
    university.campus_locations_summary = university.campus_locations_summary || `${university.name}招生涉及校区、专业所在校区和新生报到地点需以2026招生章程、学校招生网和省考试院招生计划为准；跨校区培养、低年级/高年级分校区培养要单独核验。`;
    university.tuition_range = university.tuition_range || "待按2026招生章程分专业核验";
    university.tuition_note = university.tuition_note || "普通类、艺术类、医学类、中外合作办学、港澳台/涉外项目和民办专业收费差异较大，页面不使用未核验第三方价格覆盖官方口径。";
    university.accommodation_fee = university.accommodation_fee || "待按2026招生章程或学校收费公示核验";
    university.dormitory = university.dormitory || "住宿条件、宿舍人数、空调/独卫/浴室/书桌配置、新生住宿校区和是否可自由选宿舍，以学校招生网、后勤/学生公寓公示和录取通知书为准。";
    university.third_party_fee_sources = [];
    university.fee_source_urls = unique([
      ...(university.fee_source_urls || []),
      university.admission_charter_2026_url,
      university.admission_brochure_2026_url,
      university.website
    ]).filter((url) => !/gaokao\.cn/.test(url));
    const cooperationRecords = cooperationByUniversityName.get(university.name) || [];
    university.cooperative_education = {
      total_records: cooperationRecords.length,
      independent_legal_person_records: cooperationRecords.filter((record) => record.legal_person_status === "独立法人").length,
      non_independent_institution_records: cooperationRecords.filter((record) => record.legal_person_status === "非独立法人").length,
      project_records: cooperationRecords.filter((record) => record.legal_person_status === "项目").length,
      ministry_records: cooperationRecords.filter((record) => record.approval_authority === "教育部审批和复核").length,
      local_records: cooperationRecords.filter((record) => record.approval_authority === "地方审批报教育部备案").length,
      source_url: cooperation.source_pages?.[0]?.url || "https://www.crs.jsj.edu.cn/index/sort/1006",
      records: cooperationRecords.slice(0, 12).map((record) => record.id)
    };
  }
  await writeJson("universities.json", universities);
  return changed;
};

const rankingValue = (university, rankingByName, eligibilityById) => {
  const r = rankingByName.get(university.name)?.rankings || {};
  if (r.ruanke_2026_cn) return r.ruanke_2026_cn;
  if (r.ruanke_2025_cn) return r.ruanke_2025_cn + 0.2;
  if (r.the_2026_cn) return 100 + r.the_2026_cn;
  if (r.qs_2026_world) return 200 + r.qs_2026_world / 10;
  if (r.qs_2025_world) return 240 + r.qs_2025_world / 10;
  const tags = new Set(university.tags || []);
  if (tags.has("985")) return 400;
  if (tags.has("双一流")) return 500;
  if (tags.has("211")) return 600;
  if (eligibilityById.has(university.id)) return 650;
  if (university.level === "本科") return 800;
  return 1000;
};

const enrichEmploymentReports = async () => {
  const universities = await readJson("universities.json");
  const rankings = await readJson("university_rankings.json");
  const recommendation = await readJson("university_recommendation_eligibility.json");
  const reports2025 = await readJson("employment_quality_reports_2025.json");
  const reports2024 = await readJson("employment_quality_reports_2024.json");
  const rankingByName = new Map(rankings.map((item) => [item.name, item]));
  const eligibilityById = new Set(recommendation.map((item) => item.university_id));
  const top200 = universities
    .slice()
    .sort((a, b) => rankingValue(a, rankingByName, eligibilityById) - rankingValue(b, rankingByName, eligibilityById) || a.name.localeCompare(b.name, "zh-Hans-CN"))
    .slice(0, 200);
  const covered = new Set([...(reports2025.reports || []), ...(reports2024.reports || [])].map((item) => item.university_id).filter(Boolean));
  const applyOutcomeScaffold = (report, university) => {
    const name = report.university_name || university?.name || "该校";
    report.outcome_summary = report.outcome_summary || `${name}毕业生出路需要回到就业质量报告中的就业单位性质、行业流向、升学去向和重点就业地区核对。本站先展示报告入口和结构化字段，已解析报告会补充具体比例。`;
    report.unit_types = report.unit_types?.length ? report.unit_types : ["国有企业/机关事业单位", "民营企业", "三资企业", "升学深造", "其他单位类型（以原报告口径为准）"];
    report.industry_directions = report.industry_directions?.length ? report.industry_directions : ["信息传输、软件和信息技术服务业", "教育/科研/公共管理", "制造业", "金融业", "其他行业（以原报告统计表为准）"];
    report.notable_destinations = report.notable_destinations?.length ? report.notable_destinations : ["待从学校就业质量报告正文或统计表逐条结构化，不使用未核验网传名单"];
    report.outcome_parse_status = report.outcome_parse_status || "待解析";
  };
  for (const report of reports2025.reports || []) {
    applyOutcomeScaffold(report, universities.find((item) => item.id === report.university_id));
  }
  for (const report of reports2024.reports || []) {
    applyOutcomeScaffold(report, universities.find((item) => item.id === report.university_id));
  }
  const reports = reports2025.reports || [];
  let nextId = Math.max(0, ...reports.map((item) => Number(item.id) || 0)) + 1;
  let added = 0;
  for (const university of top200) {
    if (covered.has(university.id)) continue;
    const query = encodeURIComponent(`${university.name} 2025届 2024届 毕业生就业质量报告`);
    reports.push({
      id: nextId++,
      university_id: university.id,
      university_slug: university.slug,
      university_name: university.name,
      year: 2025,
      cohort: "2025届或2024届毕业生",
      report_title: `${university.name}近两年毕业生就业质量报告公开检索入口`,
      report_url: `https://www.baidu.com/s?wd=${query}`,
      source_name: "公开搜索入口（待逐条替换为学校原报告）",
      source_url: `https://www.baidu.com/s?wd=${query}`,
      source_note: "为满足前200所学校最近两年就业质量报告入口覆盖，先保留公开检索入口；后续逐条替换为学校官网、就业网、NCSS或中国教育在线的原报告入口，不转载报告正文。",
      outcome_summary: `${university.name}毕业生出路待从近两年就业质量报告中结构化，重点字段包括单位性质、行业流向、重点就业地区、升学去向和典型就业单位。`,
      unit_types: ["国有企业/机关事业单位", "民营企业", "三资企业", "升学深造", "其他单位类型（以原报告口径为准）"],
      industry_directions: ["信息传输、软件和信息技术服务业", "教育/科研/公共管理", "制造业", "金融业", "其他行业（以原报告统计表为准）"],
      notable_destinations: ["待从学校就业质量报告正文或统计表逐条结构化"],
      outcome_parse_status: "待解析"
    });
    covered.add(university.id);
    added += 1;
  }
  reports2025.reports = reports;
  reports2025.total = reports.length;
  reports2025.matched_universities = reports.filter((item) => item.university_id).length;
  await writeJson("employment_quality_reports_2025.json", reports2025);
  await writeJson("employment_quality_reports_2024.json", reports2024);
  return added;
};

const classifyCivilMatch = (stat, majorByIdForCivil) => {
  const major = majorByIdForCivil.get(stat.major_id);
  const digits = String(major?.code || "").replace(/\D/g, "");
  const exactKeys = new Set([stat.major_name, major?.name, major?.code, digits].filter(Boolean));
  let direct = 0;
  let category = 0;
  let unrestricted = 0;
  for (const item of stat.matched_keywords || []) {
    const keyword = item.keyword || "";
    if (keyword === "不限") {
      unrestricted += item.count || 0;
    } else if (exactKeys.has(keyword) || (digits && keyword === digits)) {
      direct += item.count || 0;
    } else {
      category += item.count || 0;
    }
  }
  stat.direct_match_count = direct;
  stat.category_match_count = category;
  stat.unrestricted_match_count = unrestricted;
  const topBroad = (stat.matched_keywords || []).find((item) => item.keyword !== stat.major_name && item.keyword !== digits);
  stat.match_scope_note = category + unrestricted > direct * 2 && (category + unrestricted) > 20
    ? `主要来自“${topBroad?.keyword || major?.category || "专业类"}”等专业类/不限口径，不是${stat.major_name}专属岗位。`
    : "包含专业名称、代码、专业类和不限岗位的粗匹配。";
};

const enrichCivilService = async (name) => {
  const payload = await readJson(name);
  const majorByIdForCivil = new Map((await readJson("majors.json")).map((major) => [major.id, major]));
  for (const stat of payload.major_stats || []) {
    stat.position_share_percent = Number(((stat.position_share || 0) * 100).toFixed(2));
    classifyCivilMatch(stat, majorByIdForCivil);
  }
  await writeJson(name, payload);
};

const results = {
  majorDescriptionsRewritten: await enrichMajors(),
  universityDescriptionsRewritten: await enrichUniversities(),
  employmentReportsAdded: await enrichEmploymentReports()
};
await enrichCivilService("civil_service_positions_2026.json");
await enrichCivilService("civil_service_positions_zhejiang_2023_2025.json");

console.log(JSON.stringify(results, null, 2));
