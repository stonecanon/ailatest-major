import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = process.env.BUILD_DIST ? path.resolve(process.env.BUILD_DIST) : path.join(root, "dist");
const dataDir = path.join(root, "data");
const srcDir = path.join(root, "src");
const siteUrl = "https://major.ailatest.org";
const assetVersion = "20260714-central-api";

const readJson = async (name) => JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));
const asArray = (value) => Array.isArray(value) ? value : [];
const html = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const list = (items = []) => items.length ? items.map((item) => `<li>${html(item)}</li>`).join("") : "<li>请结合学校培养方案和公开来源继续核对。</li>";
const tagClass = (item = "") => {
  const text = String(item);
  if (/HOT|热门|热点/.test(text)) return "tag-hot";
  if (/985|C9|Top100|强基/.test(text)) return "tag-elite";
  if (/211|双一流/.test(text)) return "tag-key";
  if (/推免|保研/.test(text)) return "tag-strong";
  if (/软科|QS|THE|US|ARWU|排名/.test(text)) return "tag-rank";
  if (/民办|中外|高收费|风险|谨慎|限制/.test(text)) return "tag-warn";
  if (/公办|本科|普通高校|职业/.test(text)) return "tag-neutral";
  if (/^\d{4,6}[A-Z]*$/i.test(text) || /^\d{4,6}[A-Z]{0,3}$/i.test(text)) return "tag-code";
  if (/学士|硕士|博士/.test(text)) return "tag-degree";
  if (/^三年|^四年|^五年|学制/.test(text)) return "tag-duration";
  if (/类$|工学|理学|医学|法学|文学|经济学|管理学|教育学|艺术学|农学|历史学|哲学/.test(text)) return "tag-area";
  if (/智能|互联网|硬件|软件|芯片|集成电路|数据|AI|工业|金融|医学|建筑|能源|材料|制造|硬科技/.test(text)) return "tag-industry";
  if (/动手|实践|写作|阅读|逻辑|数学|数理|表达|沟通|项目|实验|编程|规则|长期主义/.test(text)) return "tag-skill";
  return "";
};
const tagList = (items = []) => items.filter(Boolean).map((item) => `<span class="tag ${tagClass(item)}">${html(item)}</span>`).join("");
const canonical = (pathname) => `${siteUrl}${pathname}`;
const pageContextLabel = (pathname = "") => {
  if (pathname === "/universities/") return "大学库 · 查大学";
  if (pathname === "/majors/") return "专业库 · 查专业";
  if (pathname === "/admissions/rank-lines/") return "投档线查询";
  if (pathname === "/planner/") return "志愿优化";
  if (pathname === "/civil-service/") return "考公岗位库";
  if (pathname === "/universities/cooperation/") return "中外合作办学库";
  return "";
};
const universityDecisionTags = (university) => {
  const eligibility = recommendationEligibilityByUniversityId.get(university.id);
  return uniqueItems([
    ...(university.tags || []).filter((tag) => ["985", "211", "双一流"].includes(tag) || /^首轮[AB]类$/.test(tag)),
    eligibility?.eligibility
  ]);
};
const universityDecisionTagList = (university) => universityDecisionTags(university)
  .map((tag) => `<span class="tag ${tag === "有推免资格" ? "tag-strong" : "tag-key"}">${html(tag)}</span>`)
  .join("");

const hydrateMajor = (major) => {
  const summary = major.ai_summary || `${major.name}是${major.discipline}${major.category}下的本科专业。当前页面先展示教育部专业目录字段，课程、就业、考研和FAQ等待公开来源复核后补充。`;
  return {
    ...major,
    description: major.description || summary,
    core_courses: asArray(major.core_courses),
    career_directions: asArray(major.career_directions),
    postgraduate_directions: asArray(major.postgraduate_directions),
    suitable_personality: asArray(major.suitable_personality),
    unsuitable_personality: asArray(major.unsuitable_personality),
    skill_requirements: asArray(major.skill_requirements),
    fit_tags: asArray(major.fit_tags),
    faq_json: asArray(major.faq_json),
    civil_service_fit: major.civil_service_fit || "待补充：需结合公务员职位表和公开岗位专业目录判断。",
    ai_risk: major.ai_risk || "待补充：需结合职业任务、行业报告和AI工具发展趋势判断。",
    future_trend: major.future_trend || "待补充：需结合公开产业政策、就业质量报告和高校培养方案判断。",
    ai_summary: summary,
    source_note: major.source_note || "教育部专业目录字段；解释性内容待公开来源复核。"
  };
};

let doubleFirstClassByName = new Map();
let universityRankingByName = new Map();
const uniqueItems = (items) => [...new Set(items.filter(Boolean))];
const doubleFirstClassTags = (record) => record ? ["双一流"] : [];
const rankingLabels = (record) => {
  if (!record?.rankings) return [];
  const r = record.rankings;
  return [
    r.ruanke_2026_cn ? `软科${r.ruanke_2026_cn}` : r.ruanke_2025_cn ? `软科${r.ruanke_2025_cn}` : "",
    r.qs_2026_world ? `QS${r.qs_2026_world}` : r.qs_2025_world ? `QS${r.qs_2025_world}` : "",
    r.the_2026_cn ? `THE中国${r.the_2026_cn}` : "",
    r.the_2026_world ? `THE${r.the_2026_world}` : r.the_2026_world_range ? `THE${r.the_2026_world_range}` : "",
    r.qs_2026_asia ? `QS亚洲${r.qs_2026_asia}` : "",
    r.usnews_2025_2026_world ? `US${r.usnews_2025_2026_world}` : "",
    r.arwu_2025_world ? `ARWU${r.arwu_2025_world}` : r.arwu_2025_world_range ? `ARWU${r.arwu_2025_world_range}` : ""
  ].filter(Boolean);
};
const hydrateUniversity = (university) => {
  const doubleFirstClass = doubleFirstClassByName.get(university.name);
  const ranking = universityRankingByName.get(university.name);
  return {
    ...university,
    tags: uniqueItems([...asArray(university.tags), ...doubleFirstClassTags(doubleFirstClass)]),
    source_urls: uniqueItems([
      ...asArray(university.source_urls),
      ...(doubleFirstClass ? [doubleFirstClass.source_page, doubleFirstClass.source_url] : []),
      ...(ranking ? asArray(ranking.source_urls) : [])
    ]),
    description: university.description || "",
    source_note: university.source_note || "教育部全国高等学校名单字段；院校标签、官网和招生入口待复核。",
    double_first_class: doubleFirstClass || null,
    ranking: ranking || null
  };
};
const isThinUniversityDescription = (university) => !university.description
  || /页面先整理|等待官网复核|学校官网、招生官网、招生章程和专业设置需继续|出现在浙江省普通类平行投档分数线表中/.test(university.description);
const conciseUniversityIntro = (university) => isThinUniversityDescription(university)
  ? "暂无已核验学校简介。"
  : university.description;
const hasVerifiedTransferPolicy = (policy) => policy && policy.difficulty_level !== "待复核";

const majors = [
  ...(await readJson("majors.json")),
  ...(await readJson("major_expansion.json"))
].map(hydrateMajor);
const doubleFirstClass = await readJson("double_first_class.json");
doubleFirstClassByName = new Map();
for (const item of doubleFirstClass) {
  doubleFirstClassByName.set(item.name, item);
  for (const alias of item.aliases || []) doubleFirstClassByName.set(alias, item);
}
const universityRankings = await readJson("university_rankings.json");
universityRankingByName = new Map(universityRankings.map((item) => [item.name, item]));
const universities = (await readJson("universities.json")).map(hydrateUniversity);
const universityMajors = await readJson("university_majors.json");
const careerProfiles = await readJson("career_profiles.json");
const topics = await readJson("topics.json");
const sharePages = await readJson("share_pages.json");
const promoPages = await readJson("promo_pages.json");
const comparisons = await readJson("comparisons.json");
const sources = await readJson("sources.json");
const provinceAdmissionSources = await readJson("province_admission_sources.json");
const indexNow = await readJson("indexnow.json");
const admissionPlans = await readJson("admission_plans.json");
const admissionScores = await readJson("admission_scores.json");
const transferPolicies = await readJson("transfer_policies.json");
const adviceProfiles = await readJson("advice_profiles.json");
const universityProgression = await readJson("university_progression.json");
const majorDecisionTags = await readJson("major_decision_tags.json");
const universityRecommendationEligibility = await readJson("university_recommendation_eligibility.json");
const subjectEvaluations = await readJson("subject_evaluations.json");
const employmentReports2024 = await readJson("employment_quality_reports_2024.json");
const employmentReports2025 = await readJson("employment_quality_reports_2025.json");
const civilServicePositions2026 = await readJson("civil_service_positions_2026.json");
const zhejiangCivilServicePositions = await readJson("civil_service_positions_zhejiang_2023_2025.json");
const sinoForeignCooperation = await readJson("sino_foreign_cooperation.json");

const majorById = new Map(majors.map((major) => [major.id, major]));
const majorBySlug = new Map(majors.map((major) => [major.slug, major]));
const universityById = new Map(universities.map((university) => [university.id, university]));
const majorsByCategory = new Map();
for (const major of majors) {
  if (!majorsByCategory.has(major.category)) majorsByCategory.set(major.category, []);
  majorsByCategory.get(major.category).push(major);
}
const transferPolicyByUniversityId = new Map(transferPolicies.map((policy) => [policy.university_id, policy]));
const progressionByUniversityId = new Map(universityProgression.map((item) => [item.university_id, item]));
const recommendationEligibilityByUniversityId = new Map(universityRecommendationEligibility.map((item) => [item.university_id, item]));
const employmentReportsByUniversityId = new Map();
for (const report of [...(employmentReports2025.reports || []), ...(employmentReports2024.reports || [])]) {
  if (!report.university_id) continue;
  if (!employmentReportsByUniversityId.has(report.university_id)) employmentReportsByUniversityId.set(report.university_id, []);
  employmentReportsByUniversityId.get(report.university_id).push(report);
}
const civilServiceByMajorId = new Map((civilServicePositions2026.major_stats || []).map((item) => [item.major_id, item]));
const zhejiangCivilServiceByMajorId = new Map((zhejiangCivilServicePositions.major_stats || []).map((item) => [item.major_id, item]));
const cooperationByChinesePartner = new Map();
for (const record of sinoForeignCooperation.records || []) {
  if (!record.chinese_partner) continue;
  if (!cooperationByChinesePartner.has(record.chinese_partner)) cooperationByChinesePartner.set(record.chinese_partner, []);
  cooperationByChinesePartner.get(record.chinese_partner).push(record);
}
const subjectEvaluationsByMajorSlug = new Map();
for (const item of subjectEvaluations) {
  for (const slug of item.related_major_slugs || []) {
    if (!subjectEvaluationsByMajorSlug.has(slug)) subjectEvaluationsByMajorSlug.set(slug, []);
    subjectEvaluationsByMajorSlug.get(slug).push(item);
  }
}
const subjectEvaluationsByUniversityName = new Map();
for (const item of subjectEvaluations) {
  for (const result of item.results || []) {
    for (const name of result.universities || []) {
      if (!subjectEvaluationsByUniversityName.has(name)) subjectEvaluationsByUniversityName.set(name, []);
      subjectEvaluationsByUniversityName.get(name).push({
        subject_code: item.subject_code,
        subject_name: item.subject_name,
        round: item.round,
        grade: result.grade,
        source_url: item.source_url,
        source_note: item.source_note
      });
    }
  }
}
const allSharePages = [...sharePages, ...promoPages];
const knownUniversityMajorKeys = new Set(universityMajors.map((link) => `${link.university_id}:${link.major_id}:${link.province || ""}:${link.year || ""}`));
const scoreDerivedUniversityMajors = [];
for (const score of admissionScores) {
  if (!score.university_id || !score.major_id || (score.data_grain && score.data_grain !== "major")) continue;
  const key = `${score.university_id}:${score.major_id}:${score.province || ""}:${score.year || ""}`;
  if (knownUniversityMajorKeys.has(key)) continue;
  knownUniversityMajorKeys.add(key);
  const major = majorById.get(score.major_id);
  scoreDerivedUniversityMajors.push({
    id: `score-${score.id}`,
    university_id: score.university_id,
    major_id: score.major_id,
    province: score.province,
    year: score.year,
    degree: major?.degree || "以学校招生章程为准",
    duration: major?.duration || "以学校招生章程为准",
    tuition: null,
    campus: "以当年招生章程为准",
    subject_requirements: score.subject_group || "以省教育考试院和学校招生计划为准",
    notes: score.major_group_name ? `由公开投档数据生成入口：${score.major_group_name}` : "由公开投档数据生成入口。",
    source_note: score.source_note || "由省教育考试院公开投档数据生成入口；招生计划、校区、学费仍需以招生章程复核。"
  });
}
const allUniversityMajors = [...universityMajors, ...scoreDerivedUniversityMajors];
const universityMajorsByUniversityId = new Map();
const universityMajorsByMajorId = new Map();
for (const link of allUniversityMajors) {
  if (!universityMajorsByUniversityId.has(link.university_id)) universityMajorsByUniversityId.set(link.university_id, []);
  universityMajorsByUniversityId.get(link.university_id).push(link);
  if (!universityMajorsByMajorId.has(link.major_id)) universityMajorsByMajorId.set(link.major_id, []);
  universityMajorsByMajorId.get(link.major_id).push(link);
}
const admissionScoresByUniversityId = new Map();
const admissionScoresByUniversityMajor = new Map();
for (const score of admissionScores) {
  if (!admissionScoresByUniversityId.has(score.university_id)) admissionScoresByUniversityId.set(score.university_id, []);
  admissionScoresByUniversityId.get(score.university_id).push(score);
  const key = `${score.university_id}:${score.major_id}`;
  if (!admissionScoresByUniversityMajor.has(key)) admissionScoresByUniversityMajor.set(key, []);
  admissionScoresByUniversityMajor.get(key).push(score);
}
const admissionPlansByUniversityMajor = new Map();
for (const plan of admissionPlans) {
  const key = `${plan.university_id}:${plan.major_id}`;
  if (!admissionPlansByUniversityMajor.has(key)) admissionPlansByUniversityMajor.set(key, []);
  admissionPlansByUniversityMajor.get(key).push(plan);
}
const browserAdmissionScores = admissionScores.map((score) => ({
  id: score.id,
  year: score.year,
  province: score.province,
  university_id: score.university_id,
  major_id: score.major_id,
  data_grain: score.data_grain,
  major_group_code: score.major_group_code,
  major_group_name: score.major_group_name,
  batch: score.batch,
  subject_group: score.subject_group,
  min_score: score.min_score,
  min_rank: score.min_rank,
  plan_count: score.plan_count,
  source_url: score.source_url
}));
const browserUniversityMajors = allUniversityMajors.map((link) => ({
  id: link.id,
  university_id: link.university_id,
  major_id: link.major_id,
  province: link.province,
  year: link.year,
  subject_requirements: link.subject_requirements
}));
const browserUniversities = universities.map((university) => {
  const {
    source_note,
    admission_major_basis,
    ranking,
    ...rest
  } = university;
  return {
    ...rest,
    ranking: ranking ? {
      ...ranking,
      source_note: undefined
    } : null
  };
});
const subjectRequirementLooksSpecific = (value = "") => /不限|不提科目|无选考|物理|化学|生物|政治|历史|地理|技术/.test(String(value));
const subjectRequirementIndex = new Map();
const rememberSubjectRequirement = (key, item) => {
  if (!key || !item?.text) return;
  const current = subjectRequirementIndex.get(key);
  const nextScore = subjectRequirementLooksSpecific(item.text) ? 100 : 1;
  const currentScore = subjectRequirementLooksSpecific(current?.text) ? 100 : current?.text ? 1 : 0;
  if (!current || nextScore > currentScore || (nextScore === currentScore && Number(item.year || 0) > Number(current.year || 0))) {
    subjectRequirementIndex.set(key, item);
  }
};
for (const link of browserUniversityMajors) {
  const item = { text: link.subject_requirements, year: link.year };
  rememberSubjectRequirement(`${link.university_id}:${link.major_id}:${link.province || ""}`, item);
  rememberSubjectRequirement(`${link.university_id}:${link.major_id}:`, item);
}
const scoreSubjectRequirement = (score) => {
  const matched = subjectRequirementIndex.get(`${score.university_id}:${score.major_id}:${score.province || ""}`)
    || subjectRequirementIndex.get(`${score.university_id}:${score.major_id}:`);
  if (matched?.text && subjectRequirementLooksSpecific(matched.text)) return matched.text;
  if (subjectRequirementLooksSpecific(score.major_group_name)) return score.major_group_name;
  if (subjectRequirementLooksSpecific(score.subject_group)) return score.subject_group;
  return "需查招生计划";
};

const prepareDist = async () => {
  const trash = path.join(root, `.dist-trash-${Date.now()}`);
  try {
    await fs.rename(dist, trash);
    fs.rm(trash, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 }).catch(() => {});
  } catch (error) {
    if (error.code !== "ENOENT") {
      await fs.rm(dist, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
    }
  }
  await fs.mkdir(path.join(dist, "assets"), { recursive: true });
};

const careerByMajor = new Map();

for (const profile of careerProfiles) {
  if (!careerByMajor.has(profile.major_id)) careerByMajor.set(profile.major_id, []);
  careerByMajor.get(profile.major_id).push(profile);
}

const adviceByMajorSlug = new Map();
const adviceByUniversitySlug = new Map();
for (const advice of adviceProfiles) {
  const targetMap = advice.target_type === "university" ? adviceByUniversitySlug : adviceByMajorSlug;
  for (const slug of advice.target_slugs || []) {
    if (!targetMap.has(slug)) targetMap.set(slug, []);
    targetMap.get(slug).push(advice);
  }
}
const decisionByMajorSlug = new Map(majorDecisionTags.map((item) => [item.slug, item]));

const pagePaths = [];
const pagePathSet = new Set();
const write = async (pathname, content) => {
  const clean = pathname === "/" ? "index.html" : path.join(pathname.replace(/^\/|\/$/g, ""), "index.html");
  const file = path.join(dist, clean);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
  if (!pagePathSet.has(pathname)) {
    pagePathSet.add(pathname);
    pagePaths.push(pathname);
  }
};

const breadcrumbJson = (items) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: canonical(item.path)
  }))
});

const layout = ({ title, description, pathname, body, jsonLd = [] }) => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${html(title)}</title>
  <meta name="description" content="${html(description)}">
  <link rel="canonical" href="${canonical(pathname)}">
  <link rel="stylesheet" href="/assets/app.css?v=${assetVersion}">
  <meta property="og:title" content="${html(title)}">
  <meta property="og:description" content="${html(description)}">
  <meta property="og:url" content="${canonical(pathname)}">
  <meta property="og:type" content="website">
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "知途",
    url: siteUrl
  })}</script>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "知途 大学专业与志愿优化",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  })}</script>
  ${jsonLd.filter(Boolean).map((item) => `<script type="application/ld+json">${JSON.stringify(item)}</script>`).join("\n  ")}
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/" aria-label="知途首页">
      <span class="brand-mark">知</span>
      <span><strong>知途</strong><small>major.ailatest.org</small></span>
    </a>
    <nav class="nav" aria-label="主导航">
      <a href="/universities/">大学库</a>
      <a href="/majors/">专业库</a>
      <a href="/planner/">志愿优化</a>
      <a href="/favorites/">收藏夹</a>
      <a href="/login/">登录</a>
    </nav>
  </header>
  <main>${body}</main>
  <footer class="site-footer">
    <p>知途 · 大学专业搜索与志愿排序工具</p>
    <p>历史数据和模型仅作决策参考，不承诺录取概率；正式填报请以考试院和高校官方信息为准。</p>
    <p>
      <a href="/about/">关于</a> ·
      <a href="/universities/">大学库</a> ·
      <a href="/majors/">专业库</a> ·
      <a href="/planner/">志愿优化</a> ·
      <a href="/favorites/">收藏夹</a> ·
      <a href="/login/">登录</a> ·
      <a href="/feedback/">反馈</a> ·
      <a href="/data-sources/">数据来源</a> ·
      <a href="/methodology/">方法说明</a> ·
      <a href="/editorial-policy/">编辑政策</a> ·
      <a href="/privacy/">隐私</a> ·
      <a href="/terms/">条款</a> ·
      <a href="/contact/">联系</a> ·
      <a href="mailto:contact@ailatest.org">contact@ailatest.org</a> ·
      <a href="/sitemap.xml">Sitemap</a>
    </p>
  </footer>
  <script src="/assets/app.js?v=${assetVersion}" defer></script>
  <script src="/assets/analytics.js?v=${assetVersion}" defer></script>
</body>
</html>`;

const sourceBadge = () => "";
const sourceLinks = (urls = []) => {
  const cleanUrls = [...new Set((urls || []).filter(Boolean))];
  if (!cleanUrls.length) return "";
  return `<div class="panel"><h2>可核验来源</h2><ul>${cleanUrls.map((url) => `<li><a href="${html(url)}" rel="noopener noreferrer">${html(url)}</a></li>`).join("")}</ul></div>`;
};
const citationTitle = (url = "", fallback = "公开来源") => {
  if (/gaokao\.chsi\.com\.cn\/zsgs\/zhangcheng/.test(url)) return "阳光高考招生章程";
  if (/gaokao\.chsi\.com\.cn\/sch/.test(url)) return "阳光高考院校信息";
  if (/gaokao\.chsi\.com\.cn\/zyk/.test(url)) return "阳光高考专业知识库";
  if (/shanghairanking|topuniversities|timeshighereducation|usnews|time\.com/.test(url)) return "公开排名参考";
  if (/ncss\.cn|就业|jiuye|eol\.cn/.test(url)) return "就业质量报告入口";
  if (/moe\.gov\.cn|dxs\.moe\.gov\.cn|hudong\.moe/.test(url)) return "教育部公开来源";
  if (/zjzs\.net|sdzk\.cn/.test(url)) return "省考试院公开数据";
  return fallback;
};
const renderCitations = (items = []) => {
  const seen = new Set();
  const cleanItems = [];
  const maxItems = 6;
  const groupKey = (title = "", url = "") => {
    if (/招生章程|招生官网|学校官网/.test(title)) return title;
    if (/排名/.test(title)) return "排名数据";
    if (/推免/.test(title)) return "推免资格";
    if (/就业质量报告/.test(title)) return "就业质量报告";
    if (/升学|保研/.test(title)) return "升学与保研";
    if (/双一流/.test(title)) return "双一流";
    if (/中外合作|地方审批|教育部审批/.test(title)) return "中外合作办学";
    if (/校区|住宿|费用/.test(title)) return "校区住宿费用";
    if (/公开观点框架/.test(title)) return "skip";
    if (/教育部公开来源|公开来源/.test(title)) return "教育部高校名单";
    return title || citationTitle(url);
  };
  for (const item of items) {
    const url = typeof item === "string" ? item : item?.url;
    if (!url || seen.has(url)) continue;
    const title = typeof item === "string" ? citationTitle(url) : (item.title || citationTitle(url));
    const key = groupKey(title, url);
    if (key === "skip" || seen.has(key)) continue;
    seen.add(url);
    seen.add(key);
    cleanItems.push({
      url,
      title: key,
      note: ""
    });
    if (cleanItems.length >= maxItems) break;
  }
  if (!cleanItems.length) return "";
  return `<section class="citation-panel">
    <h2>引用与来源</h2>
    <ol>${cleanItems.map((item) => `<li><a href="${html(item.url)}" rel="noopener noreferrer">${html(item.title)}</a>${item.note ? `<small>${html(item.note)}</small>` : ""}</li>`).join("")}</ol>
  </section>`;
};
const renderAdvicePanel = (advice) => {
  if (!advice) return "";
  const sourceUrls = (advice.source_urls || []).filter((url) => !isNoisyOpinionUrl(url));
  return `<div class="panel advice-panel">
    <h2>${html(adviceTitle(advice.title || "家长常问提醒"))}</h2>
    <p>${html(advice.summary || "")}</p>
    ${advice.checkpoints?.length ? `<ul>${advice.checkpoints.map((item) => `<li>${html(item)}</li>`).join("")}</ul>` : ""}
    ${sourceUrls.length ? `<p>${sourceUrls.map((url) => `<a href="${html(url)}" rel="noopener noreferrer">公开来源</a>`).join(" · ")}</p>` : ""}
  </div>`;
};
const renderAdvicePanels = (items = []) => items.map(renderAdvicePanel).join("");

const sharpReviewSourceUrls = [
  "https://mp.weixin.qq.com/s/eqn4BLI4CSlwn53KstDeUQ",
  "https://mp.weixin.qq.com/s/vVOGJnFcVNSmJnNDKvgDfQ",
  "https://mp.weixin.qq.com/s/pkA7TFC_jowcvVVfzxlrDw",
  "https://mp.weixin.qq.com/s/wDNzBlQFc3SLxeQFltRuDg"
];

const sharpSourceLinks = () => sharpReviewSourceUrls
  .map((url, index) => `<a href="${html(url)}" rel="noopener noreferrer">参考${index + 1}</a>`)
  .join(" · ");

const isNoisyOpinionUrl = (url = "") => /ZhangXueFeng-skill|a18515373115-droid|eqn4BLI4CSlwn53KstDeUQ|vVOGJnFcVNSmJnNDKvgDfQ|pkA7TFC_jowcvVVfzxlrDw|wDNzBlQFc3SLxeQFltRuDg/.test(String(url));
const adviceTitle = (title = "") => /公开观点框架|公开人物观点/.test(title) ? "选择检查清单" : title;

const hasAny = (text, words) => words.some((word) => text.includes(word));

const renderSharpReviewPanel = ({ title = "报考提醒", summary, points = [] }) => `
  <div class="panel advice-panel sharp-review-panel">
    <div class="panel-head"><h2>${html(title)}</h2></div>
    <p>${html(summary)}</p>
    ${points.length ? `<ul>${points.map((item) => `<li>${html(item)}</li>`).join("")}</ul>` : ""}
  </div>`;

const renderMajorSharpReview = (major) => {
  const text = `${major.name} ${major.category} ${major.discipline} ${major.code}`;
  if (hasAny(text, ["计算机", "软件", "人工智能", "数据科学", "网络工程", "信息安全", "网络空间安全"])) {
    return renderSharpReviewPanel({
      summary: `${major.name}属于高热度技术赛道，优点是就业面宽、产业迭代快，缺点是竞争也硬。别把“热门”理解成自动高薪，真正要看数学、编程、项目、城市实习和学校平台。`,
      points: [
        "适合能长期自学、愿意写代码调试、能扛住算法和工程训练的学生。",
        "重点核对课程有没有数据结构、操作系统、计算机网络、机器学习、工程项目，而不是只看专业名里有没有AI。",
        "城市平台很关键，互联网和AI实习机会集中在杭州、上海、深圳、北京、南京、广州、成都等产业更密的城市。",
        "如果只是追风口、不愿意持续刷题和做项目，这类专业会从“热门”变成压力源。"
      ]
    });
  }
  if (hasAny(text, ["电子", "通信", "微电子", "集成电路", "电气", "自动化", "智能制造", "机器人工程", "测控"])) {
    return renderSharpReviewPanel({
      summary: `${major.name}偏硬科技，壁垒通常比纯管理类更清楚，但学习门槛也高。报考时要看“电学、控制、芯片、工程项目”这些真本事，而不是单纯追一个听起来先进的名称。`,
      points: [
        "物理、数学、电路、信号、控制基础弱的学生要谨慎，大学阶段会比较硬。",
        "电子信息、自动化、集成电路更适合愿意做实验、看硬件、写底层或工程代码的人。",
        "电气方向要看未来是否想进电网、制造业、新能源和电力系统，也要看目标城市和单位门槛。",
        "学校实验平台、竞赛训练、产业合作和研究生通道，比宣传词更重要。"
      ]
    });
  }
  if (hasAny(text, ["临床医学", "口腔医学", "医学", "药学", "护理"])) {
    return renderSharpReviewPanel({
      summary: `${major.name}不是“稳就完了”。医学相关方向稳定性强，但周期长、规训重、责任高，回报往往偏后置。能不能接受长期学习和临床/实践压力，比一时热度更重要。`,
      points: [
        "临床医学地域属性强，常常在哪里读、在哪里规培和就业更现实。",
        "口腔医学相对更强调精细操作和患者沟通，但分数、资质和培养周期都不低。",
        "护理、药学和临床不是同一条职业路径，报考前要把未来岗位场景想清楚。",
        "体检限制、选科要求、学制、规培和执业资格必须回到招生章程核对。"
      ]
    });
  }
  if (hasAny(text, ["法学", "汉语言文学", "会计", "财务管理", "财政", "税收", "思想政治", "马克思主义"])) {
    return renderSharpReviewPanel({
      summary: `${major.name}更适合把考公、考编、法考、教师、财会证书和文职岗位一起规划。重点不是一句“稳”，而是岗位池、证书门槛、表达能力和学校城市机会。`,
      points: [
        "想考公要看当年职位表专业目录，岗位多不等于容易上岸。",
        "法学要考虑法考、实习、院校层次和长期阅读写作能力。",
        "汉语言、思政、财会类对文字、材料、规则和耐心要求高，不适合只图轻松。",
        "文科类如果不走体制内，城市和学校平台的重要性会明显上升。"
      ]
    });
  }
  if (hasAny(text, ["金融", "经济", "工商管理", "市场营销", "人力资源", "旅游管理", "公共事业管理", "行政管理"])) {
    return renderSharpReviewPanel({
      summary: `${major.name}听起来体面，但壁垒不一定天然存在。要先看家庭资源、城市实习、学校层次、证书和表达销售能力；普通家庭不要只被名字吸引。`,
      points: [
        "金融经济类很吃学校、城市、实习和资源，普通院校普通履历要谨慎评估。",
        "管理类专业要看是否有明确行业方向，否则容易变成“什么都学一点”。",
        "如果目标是直接就业，要提前看本专业本科毕业生真实岗位，而不是只看行业高薪故事。",
        "若家里无相关资源，更要优先考虑可验证技能和岗位池。"
      ]
    });
  }
  if (hasAny(text, ["土木", "建筑", "城乡规划", "力学", "机械", "材料", "化学", "环境", "生物", "农学", "林学", "矿业", "地质", "海洋"])) {
    return renderSharpReviewPanel({
      summary: `${major.name}要先把工作场景想透：实验室、工地、工厂、野外、设计院、读研还是转行。不要简单贴“坑”标签，但普通家庭也别低估环境、周期和转行成本。`,
      points: [
        "生化环材、农林地矿等方向常常更依赖深造和平台，本科直接就业要看具体行业和地区。",
        "土木、建筑、机械等工科要接受现场、项目、加班或制造业场景，不能只看专业名字。",
        "名校、强学科、读研通道和行业周期会显著改变结果，不能用一句话概括所有学校。",
        "如果学生明确排斥工地、工厂、野外或长期实验，就要把这类志愿往后放或删掉。"
      ]
    });
  }
  return renderSharpReviewPanel({
    summary: `${major.name}先别急着判断好坏。可以按“能不能就业、要不要深造、岗位在哪里、家庭能不能承受试错、孩子能不能接受日常工作场景”来倒推。`,
    points: [
      "先看普通毕业生的中位去向，再看少数高光案例。",
      "先排除孩子明确不能接受的行业、城市和工作环境，再谈冲稳保。",
      "对普通家庭，专业壁垒、城市机会、学费成本和保底安全性要一起算。",
      "所有结论都要回到招生章程、培养方案、就业质量报告和公开投档线复核。"
    ]
  });
};

const renderUniversitySharpReview = (university) => {
  const tags = new Set(university.tags || []);
  const city = university.city || university.province || "";
  const isTopPlatform = tags.has("985") || tags.has("211") || tags.has("双一流") || university.ranking;
  const isPrivate = /民办|私立|独立/.test(`${university.ownership} ${university.type}`);
  const isHongKongMacao = /香港|澳门|港澳/.test(`${university.province} ${university.type} ${(university.tags || []).join(" ")}`);
  const strongCity = /北京|上海|深圳|广州|杭州|南京|苏州|成都|武汉|西安|天津|重庆|宁波|青岛|厦门/.test(city);
  if (isHongKongMacao) {
    return renderSharpReviewPanel({
      summary: `${university.name}的锐评重点不是按内地985/211逻辑硬套，而是看申请方式、学费奖学金、英语要求、面试、专业认可度和毕业去向。`,
      points: [
        "港澳高校面向内地招生常有独立申请或特殊批次安排，时间线必须逐校核对。",
        "家庭预算、住宿生活成本、英语授课适应度和是否计划境外升学，要放在前面算。",
        "排名可以参考，但不能替代目标专业、课程和就业地区判断。"
      ]
    });
  }
  if (isTopPlatform) {
    return renderSharpReviewPanel({
      summary: `${university.name}学校层次不错，但不能只看校名。报志愿还要看目标专业、所在城市、专业组里会不会被调剂到不想读的方向，以及转专业名额是否真实可行。`,
      points: [
        "这类学校在保研、选调、校招和继续深造上通常更有优势，但冷门专业也可能让满意度下降。",
        "冲学校时必须把同组专业全部看完，不接受的专业不要靠侥幸。",
        "如果目标是医学、法学、计算机、电气等强路径，必要时可以用部分学校层次换专业确定性。",
        strongCity ? `${city}实习和校招机会较多，是加分项。` : "如果城市产业机会弱，学校层次和专业出口要更仔细核对。"
      ]
    });
  }
  if (isPrivate) {
    return renderSharpReviewPanel({
      summary: `${university.name}要先算清楚成本和结果。学费、住宿、家庭预算、专业壁垒、升学通道和就业城市，要放在学校名字前面。`,
      points: [
        "民办或高收费项目不是不能选，但必须确认家庭能否承受四年总成本。",
        "优先选择有明确技能、证书或就业场景的专业，慎选过于空泛的管理类名称。",
        "保底志愿要保证专业能接受，不要为了“有本科读”牺牲四年满意度。"
      ]
    });
  }
  return renderSharpReviewPanel({
    summary: `${university.name}更适合按“城市 + 专业 + 成本 + 升学/就业出口”综合看。不要只按排名排序，要看它能不能支撑你的目标专业和未来路径。`,
    points: [
      strongCity ? `${city}对实习和就业有帮助，可以给学校加分。` : "如果城市产业弱，专业实力和本省就业网络就更关键。",
      "普通公办院校尤其要看优势专业、硕士点、就业质量报告和本省认可度。",
      "志愿排序时，别让重复学校、重复专业或过多冲刺挤掉保底安全。",
      "报考前要核对招生章程、转专业政策、投档线、选科要求和学费校区。"
    ]
  });
};

const gradeRank = (grade) => ({ "A+": 0, "A": 1, "A-": 2, "B+": 3, "B": 4, "B-": 5, "C+": 6, "C": 7, "C-": 8 }[grade] ?? 9);
const subjectUniversityLink = (name) => {
  const university = universities.find((item) => item.name === name);
  return university ? `<a href="/university/${university.slug}/">${html(name)}</a>` : html(name);
};
const renderSubjectEvaluationPanel = (evaluations = []) => {
  if (!evaluations.length) return "";
  return `<div class="panel subject-evaluation-panel">
    <div class="panel-head"><h2>学科评估参考</h2><span class="status-pill">教育部第四轮</span></div>
    ${evaluations.map((evaluation) => `
      <div class="subject-eval-item">
        <h3>${html(evaluation.subject_name)} <small>${html(evaluation.subject_code)}</small></h3>
        ${(evaluation.results || []).slice().sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade)).slice(0, 3).map((result) => `
          <p><strong>${html(result.grade)}</strong>：${(result.universities || []).map(subjectUniversityLink).join("、")}</p>
        `).join("")}
        <p class="source-note">${html(evaluation.source_note)}</p>
        <p><a href="${html(evaluation.source_url)}" rel="noopener noreferrer">查看学科评估来源</a></p>
      </div>
    `).join("")}
  </div>`;
};
const renderUniversitySubjectEvaluationPanel = (items = []) => {
  if (!items.length) return "";
  const sorted = items.slice().sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || a.subject_name.localeCompare(b.subject_name, "zh-Hans-CN"));
  return `<div class="panel subject-evaluation-panel">
    <div class="panel-head"><h2>学科评估A类</h2><span class="status-pill">已接入${sorted.length}项</span></div>
    <div class="tags">${tagList(sorted.map((item) => `${item.subject_name}${item.grade}`))}</div>
    ${sorted[0]?.source_url ? `<p><a href="${html(sorted[0].source_url)}" rel="noopener noreferrer">查看学科评估来源</a></p>` : ""}
  </div>`;
};
const renderTopicSections = (sections = []) => {
  if (!sections.length) return "";
  return `<div class="grid cards topic-section-grid">${sections.map((section) => `
    <article class="card topic-section-card">
      <div class="card-kicker">${html(section.kicker || "规划提醒")}</div>
      <h3>${html(section.title)}</h3>
      ${section.summary ? `<p>${html(section.summary)}</p>` : ""}
      ${section.items?.length ? `<ul>${section.items.map((item) => `<li>${html(item)}</li>`).join("")}</ul>` : ""}
    </article>`).join("")}</div>`;
};
const renderTopicSourceLinks = (urls = []) => {
  const cleanUrls = [...new Set((urls || []).filter(Boolean))];
  if (!cleanUrls.length) return "";
  return `<div class="panel topic-sources"><h2>专题参考来源</h2><ul>${cleanUrls.map((url) => `<li><a href="${html(url)}" rel="noopener noreferrer">${html(url)}</a></li>`).join("")}</ul></div>`;
};
const inferCivilServiceLevel = (major) => {
  const text = major.civil_service_fit || "";
  if (text.includes("较高")) return "较高";
  if (text.includes("中等偏高")) return "中等偏高";
  if (text.includes("中等")) return "中等";
  if (text.includes("偏低")) return "偏低到中等";
  return "需看职位表";
};
const renderMajorDecisionPanel = (major, decision) => {
  const civilLevel = decision?.civil_service_level || inferCivilServiceLevel(major);
  const civilNote = decision?.civil_service_note || major.civil_service_fit;
  const workScene = decision?.work_scene || "先看课程、实习和典型岗位，再判断自己能否接受对应工作节奏。不同学校培养方向差异较大，不能只看专业名称。";
  const genderNote = decision?.gender_note || "不建议按“男生/女生适合”一刀切。更可靠的判断是兴趣、能力、工作场景、城市机会和家庭预期是否匹配。";
  const familyDecision = decision?.family_decision || "如果把这个专业放进志愿表，建议同时核对招生章程、培养方案、转专业规则、升学去向和公开就业质量报告。";
  const sourceUrls = decision?.source_urls || [];
  return `<div class="panel decision-panel">
    <div class="panel-head"><h2>选专业决策标签</h2><span class="status-pill">考公${html(civilLevel)}</span></div>
    <dl class="decision-list">
      <dt>考公/事业编</dt><dd>${html(civilNote)}</dd>
      <dt>工作场景</dt><dd>${html(workScene)}</dd>
      <dt>男生女生常问</dt><dd>${html(genderNote)}</dd>
      <dt>家庭决策提醒</dt><dd>${html(familyDecision)}</dd>
    </dl>
    ${sourceUrls.length ? `<p>${sourceUrls.map((url) => `<a href="${html(url)}" rel="noopener noreferrer">参考来源</a>`).join(" · ")}</p>` : ""}
  </div>`;
};
const transferPolicyLink = (policy) => {
  if (!policy) return "";
  return policy.source_url
    ? `<p><a href="${html(policy.source_url)}" rel="noopener noreferrer">查看原政策：${html(policy.source_name)}</a></p>`
    : `<p class="source-note">原政策链接待补充：${html(policy.source_name || "")}</p>`;
};
const valueOrPending = (value) => html(value ?? "待核验");
const progressionSourceLinks = (progression) => progression ? [progression.source_url, ...(progression.extra_source_urls || [])].filter(Boolean) : [];
const reportLinks = (reports = []) => reports.filter((report) => report?.report_url);
const reportConfidenceRank = { high: 3, medium: 2, low: 1, none: 0, pending: 0 };
const reportStatusLabel = (report = {}) => report.parse_status || report.outcome_parse_status || report.download_status || "待下载";
const visibleEmploymentFacts = (report = {}) => {
  const metricOrder = [
    "overall_destination_rate",
    "employment_rate",
    "further_study_rate",
    "domestic_study_rate",
    "overseas_study_rate",
    "contract_employment_rate",
    "flexible_employment_rate",
    "unemployed_rate"
  ];
  const metrics = report.structured_outcomes?.metrics || {};
  const structured = metricOrder
    .map((key) => metrics[key])
    .filter((fact) => fact && reportConfidenceRank[fact.confidence || "medium"] >= 2);
  const legacy = (report.employment_facts || [])
    .filter((fact) => fact.metric_key && reportConfidenceRank[fact.confidence || "medium"] >= 2)
    .filter((fact) => !structured.some((item) => (item.metric_key || item.label) === (fact.metric_key || fact.label)));
  return [...structured, ...legacy].slice(0, 8);
};
const reportDistributionTags = (report = {}) => {
  const pick = (items = [], limit = 4) => items
    .map((item) => typeof item === "string" ? item : item.label)
    .filter(Boolean)
    .filter((item) => !/满意度|用人单位需求|能力|知识|评价|反馈/.test(item))
    .filter((item) => String(item).length <= 18 && !/[，。；;]|比例|分别|总体/.test(item))
    .slice(0, limit);
  return {
    unit: pick(report.unit_type_distribution || report.structured_outcomes?.unit_type_distribution || []),
    industry: pick(report.industry_distribution || report.structured_outcomes?.industry_distribution || []),
    region: pick(report.region_distribution || report.structured_outcomes?.region_distribution || []),
    study: pick(report.study_destination_distribution || report.structured_outcomes?.study_destination_distribution || []),
    employers: (report.notable_employers || report.structured_outcomes?.notable_employers || []).slice(0, 6)
  };
};
const reportOutcomeBlock = (report) => {
  const facts = visibleEmploymentFacts(report);
  const distributions = reportDistributionTags(report);
  const hasTags = Object.values(distributions).some((items) => items.length);
  if (!facts.length && !hasTags) {
    return `<p class="hint">解析状态：${html(reportStatusLabel(report))}。保留报告入口，等待进一步复核。</p>`;
  }
  return `<div class="employment-summary">
      ${facts.length ? `<div class="metric-grid report-outcomes">
        ${facts.map((fact) => `<div class="metric-card">
          <span>${html(fact.label || "关键数据")}</span>
          <strong>${html(fact.value || "")}</strong>
          <small>${html(fact.text_excerpt || fact.text || "")}</small>
        </div>`).join("")}
      </div>` : ""}
      ${hasTags ? `<dl class="report-distributions">
        ${distributions.study.length ? `<dt>升学去向</dt><dd>${tagList(distributions.study)}</dd>` : ""}
        ${distributions.unit.length ? `<dt>单位性质</dt><dd>${tagList(distributions.unit)}</dd>` : ""}
        ${distributions.industry.length ? `<dt>行业流向</dt><dd>${tagList(distributions.industry)}</dd>` : ""}
        ${distributions.region.length ? `<dt>就业地区</dt><dd>${tagList(distributions.region)}</dd>` : ""}
        ${distributions.employers.length ? `<dt>重点单位</dt><dd>${tagList(distributions.employers)}</dd>` : ""}
      </dl>` : ""}
    </div>`;
};
const renderEmploymentReportPanel = (reports = []) => {
  const usable = reportLinks(reports);
  if (!usable.length) {
    return `<div class="panel">
      <h2>就业报告</h2>
      <p>暂无入口。</p>
    </div>`;
  }
  const latest = usable[0];
  return `<div class="panel employment-report-panel">
    <div class="panel-head"><h2>就业报告</h2><span class="status-pill">${html(reportStatusLabel(latest))}</span></div>
    <p>${html(latest.report_title || `${latest.university_name || "学校"}就业质量报告`)}</p>
    <p class="report-meta">${html(latest.year || "")}届 · ${html(latest.artifact_type || "入口")} · 可信度：${html(latest.confidence || "待评估")}</p>
    ${reportOutcomeBlock(latest)}
    <p><a href="${html(latest.report_url)}" rel="noopener noreferrer">查看报告入口</a></p>
    ${usable.slice(1, 3).length ? `<p class="hint">${usable.slice(1, 3).map((report) => `<a href="${html(report.report_url)}" rel="noopener noreferrer">${html(`${report.year || ""}届`)}</a>`).join(" · ")}</p>` : ""}
  </div>`;
};
const renderEmploymentReportSummary = (reports = []) => {
  const usable = reportLinks(reports);
  if (!usable.length) return "<p>暂无就业报告入口。</p>";
  const latest = usable[0];
  return `<p><a href="${html(latest.report_url)}" rel="noopener noreferrer">${html(latest.year || "")}届就业质量报告</a> <span class="status-pill">${html(reportStatusLabel(latest))}</span></p>${reportOutcomeBlock(latest)}`;
};

const renderCampusCostPanel = (university) => {
  const isPending = (value = "") => !value || /待|以学校|以.*为准|核验|录取通知书/.test(String(value));
  const campuses = (university.campus_locations || []).filter((campus) => !isPending(campus.name) || !isPending(campus.address));
  const hasConcrete = campuses.length || !isPending(university.tuition_range) || !isPending(university.accommodation_fee) || !isPending(university.dormitory);
  if (!hasConcrete) return "";
  return `<div class="panel campus-cost-panel">
    <h2>校区、住宿与费用</h2>
    <dl class="inline-dl">
      ${campuses.length ? `<dt>校区所在地</dt><dd>${campuses.map((campus) => `${html(campus.name || "校区")}：${html([campus.province, campus.city, campus.address].filter(Boolean).join(" "))}`).join("<br>")}</dd>` : ""}
      ${!isPending(university.tuition_range) ? `<dt>学费</dt><dd>${html(university.tuition_range)}</dd>` : ""}
      ${!isPending(university.accommodation_fee) ? `<dt>住宿费</dt><dd>${html(university.accommodation_fee)}</dd>` : ""}
      ${!isPending(university.dormitory) ? `<dt>住宿条件</dt><dd>${html(university.dormitory)}</dd>` : ""}
    </dl>
  </div>`;
};

const stars = (score = 0) => `<span class="stars" aria-label="${html(score)}星">${"★".repeat(score)}${"☆".repeat(Math.max(0, 5 - score))}</span>`;
const civilScore = (stat, zhejiangStat) => {
  const direct = (stat?.direct_match_count || 0) + (zhejiangStat?.direct_match_count || 0);
  const broad = (stat?.category_match_count || 0) + (zhejiangStat?.category_match_count || 0) + (stat?.unrestricted_match_count || 0) + (zhejiangStat?.unrestricted_match_count || 0);
  if (direct >= 120) return 5;
  if (direct >= 50) return 4;
  if (direct >= 15) return 3;
  if (direct >= 5 || broad >= 200) return 2;
  return 1;
};
const aiRiskScore = (major, careers = []) => {
  const text = `${major.ai_risk || ""} ${careers.map((career) => career.ai_risk || "").join(" ")}`;
  if (/较低|低/.test(text)) return 2;
  if (/较高|高/.test(text)) return 4;
  if (/资料整理|基础写作|重复分析|行政|文秘|营销|内容/.test(text)) return 4;
  if (/中等/.test(text)) return 3;
  if (/硬件|芯片|临床|实验|工程现场|设备/.test(`${major.name} ${major.category} ${major.discipline}`)) return 2;
  return 3;
};
const dependencyScore = (major) => /医学|法学|芯片|微电子|集成电路|基础医学|临床|建筑学/.test(`${major.name} ${major.category}`) ? 4 : /计算机|人工智能|电子|通信|自动化|数学/.test(`${major.name} ${major.category}`) ? 3 : 2;
const renderMajorJudgement = (major, civilStat, zhejiangStat, careers) => {
  const civil = civilScore(civilStat, zhejiangStat);
  const ai = aiRiskScore(major, careers);
  const dependency = dependencyScore(major);
  const direct = (civilStat?.direct_match_count || 0) + (zhejiangStat?.direct_match_count || 0);
  const broad = (civilStat?.category_match_count || 0) + (zhejiangStat?.category_match_count || 0) + (civilStat?.unrestricted_match_count || 0) + (zhejiangStat?.unrestricted_match_count || 0);
  return `<div class="judgement-grid">
    <div class="judge-card">
      <span>公务员/事业编</span>
      <strong>${stars(civil)}</strong>
      <small>直接匹配 ${html(direct)}；类目/不限 ${html(broad)}</small>
    </div>
    <div class="judge-card">
      <span>AI替代风险</span>
      <strong>${stars(ai)}</strong>
      <small>${html(careers[0]?.ai_risk || "按职业任务粗分级")}</small>
    </div>
    <div class="judge-card">
      <span>深造/平台依赖</span>
      <strong>${stars(dependency)}</strong>
      <small>看培养方案、就业质量报告和岗位门槛</small>
    </div>
  </div>
  <p class="source-note compact-note">星级是页面分级，不是官方“替代率”或录取承诺；考公来自国考/浙江省考职位表专业字段，AI风险来自职业画像的任务可自动化程度，正式判断仍要核对原始职位表、培养方案和就业质量报告。</p>`;
};

const renderCooperationSummaryPanel = (records = []) => {
  if (!records.length) return "";
  const ministry = records.filter((record) => record.approval_authority === "教育部审批和复核").length;
  const local = records.filter((record) => record.approval_authority === "地方审批报教育部备案").length;
  const independent = records.filter((record) => record.legal_person_status === "独立法人").length;
  const nonIndependent = records.filter((record) => record.legal_person_status === "非独立法人").length;
  const projects = records.filter((record) => record.legal_person_status === "项目").length;
  return `<div class="panel cooperation-panel">
    <h2>中外合作办学</h2>
    <div class="metric-row">
      <span><strong>${html(records.length)}</strong><small>关联记录</small></span>
      <span><strong>${html(ministry)}</strong><small>教育部审批/复核</small></span>
      <span><strong>${html(local)}</strong><small>地方备案</small></span>
    </div>
    <div class="tags">${tagList([
      independent ? `独立法人${independent}` : "",
      nonIndependent ? `非独立法人${nonIndependent}` : "",
      projects ? `项目${projects}` : ""
    ])}</div>
    <ul>${records.slice(0, 6).map((record) => `<li><a href="/universities/cooperation/?q=${encodeURIComponent(record.name)}">${html(record.name)}</a><br><small>${html(record.approval_authority)} · ${html(record.legal_person_status)} · ${html(record.education_level)}</small></li>`).join("")}</ul>
    <p><a href="/universities/cooperation/?q=${encodeURIComponent(records[0]?.chinese_partner || "")}">查看中外合作办学库</a></p>
  </div>`;
};
const renderCivilServicePanel = (stat, zhejiangStat) => {
  if (!stat && !zhejiangStat) {
    return `<div class="panel civil-service-panel">
      <h2>考公岗位匹配</h2>
      <p>暂无已导入职位表匹配结果。</p>
    </div>`;
  }
  const samples = (stat?.sample_positions || zhejiangStat?.sample_positions || []).slice(0, 4);
  const matchBreakdown = (item) => item
    ? `<dt>直接/类目/不限</dt><dd>${html(item.direct_match_count || 0)} / ${html(item.category_match_count || 0)} / ${html(item.unrestricted_match_count || 0)}</dd>`
    : "";
  const scopeNotes = [stat?.match_scope_note, zhejiangStat?.match_scope_note].filter(Boolean);
  return `<div class="panel civil-service-panel">
    <div class="panel-head"><h2>考公岗位匹配</h2><span class="status-pill">${html(stat?.feasibility_level || zhejiangStat?.feasibility_level || "")}</span></div>
    ${stat ? `<h3>2026国考</h3><dl class="inline-dl">
      <dt>匹配职位</dt><dd>${html(stat.matched_position_count)}</dd>
      <dt>岗位占比</dt><dd>${html(stat.position_share_percent ?? ((stat.position_share || 0) * 100).toFixed(2))}%</dd>
      <dt>计划人数</dt><dd>${html(stat.matched_plan_count)}</dd>
      <dt>主招/补录</dt><dd>${html(stat.main_position_count)} / ${html(stat.supplemental_position_count)}</dd>
      ${matchBreakdown(stat)}
    </dl>` : ""}
    ${zhejiangStat ? `<h3>浙江省考 2023-2025</h3><dl class="inline-dl">
      <dt>匹配职位</dt><dd>${html(zhejiangStat.matched_position_count)}</dd>
      <dt>岗位占比</dt><dd>${html(zhejiangStat.position_share_percent ?? ((zhejiangStat.position_share || 0) * 100).toFixed(2))}%</dd>
      <dt>计划人数</dt><dd>${html(zhejiangStat.matched_plan_count)}</dd>
      <dt>三年分布</dt><dd>${html(Object.entries(zhejiangStat.year_counts || {}).map(([year, count]) => `${year}:${count}`).join(" / "))}</dd>
      ${matchBreakdown(zhejiangStat)}
    </dl>` : ""}
    ${samples.length ? `<ul>${samples.map((item) => `<li>${html(item.department || "")}${item.position_name ? `：${html(item.position_name)}` : ""}${item.plan_count ? `（${html(item.plan_count)}人）` : ""}</li>`).join("")}</ul>` : ""}
    <p><a href="/civil-service/">查看考公岗位库</a></p>
    ${scopeNotes.length ? `<p class="source-note">${html(scopeNotes[0])}</p>` : ""}
    <p class="source-note">按职位表“专业”字段与本科专业名称、代码、专业类做粗匹配；只能表示报名可参考岗位池，不代表资格审查一定通过。</p>
  </div>`;
};
const renderProgressionPanel = (progression) => {
  if (!progression) {
    return `<div class="panel">
      <h2>升学与保研参考</h2>
      <p>暂无已核验数据。</p>
    </div>`;
  }
  return `<div class="panel progression-panel">
    <div class="panel-head"><h2>升学与保研参考</h2><span class="status-pill">${html(progression.status)}</span></div>
    <dl class="inline-dl">
      <dt>届别</dt><dd>${html(progression.cohort || "")}</dd>
      ${progression.undergraduate_count ? `<dt>本科人数</dt><dd>${html(progression.undergraduate_count)}</dd>` : ""}
      ${progression.domestic_study_rate ? `<dt>国内升学</dt><dd>${html(progression.domestic_study_rate)}</dd>` : ""}
      ${progression.overseas_study_rate ? `<dt>出国出境</dt><dd>${html(progression.overseas_study_rate)}</dd>` : ""}
      ${progression.further_study_rate ? `<dt>总体深造</dt><dd>${html(progression.further_study_rate)}</dd>` : ""}
      ${progression.recommendation_rate ? `<dt>保研率</dt><dd>${html(progression.recommendation_rate)}</dd>` : ""}
    </dl>
  </div>`;
};
const recommendationEligibilityLinks = (eligibility) => [eligibility?.source_url, ...(eligibility?.extra_source_urls || [])].filter(Boolean);
const renderRecommendationEligibilityPanel = (eligibility) => {
  if (!eligibility) {
    return `<div class="panel">
      <h2>推免资格</h2>
      <p>暂无已核验信息。</p>
      <p class="source-note">学校有无推免资格、学生个人能否获得推免资格，是两件不同的事。</p>
    </div>`;
  }
  return `<div class="panel recommendation-panel">
    <div class="panel-head"><h2>推免资格</h2><span class="status-pill">${html(eligibility.status)}</span></div>
    <p><strong>${html(eligibility.eligibility)}</strong></p>
  </div>`;
};

const doubleFirstClassDisciplineText = (record) => {
  if (!record) return "";
  if (record.disciplines?.length) return record.disciplines.join("、");
  return record.discipline_note || "自主确定建设学科并自行公布";
};

const doubleFirstClassLink = (record) => record?.source_page
  ? `<a href="${html(record.source_page)}" rel="noopener noreferrer">查看教育部名单来源</a>`
  : "";

const renderDoubleFirstClassBlock = (record) => record ? `
  <h2>双一流备注</h2>
  <div class="fact-block">
    <p><strong>大学层面：</strong>${html(record.second_round_category || "第二轮双一流建设高校")}</p>
    <p><strong>学科层面：</strong>${html(doubleFirstClassDisciplineText(record))}</p>
    ${record.first_round_class ? `<p><strong>历史分类：</strong>${html(record.first_round_note || `首轮一流大学建设高校${record.first_round_class}`)}。第二轮名单已不再区分A类/B类。</p>` : `<p><strong>历史分类：</strong>非首轮一流大学建设高校A类/B类；第二轮按建设高校和建设学科展示。</p>`}
  </div>
` : "";

const renderDoubleFirstClassPanel = (record) => record ? `
  <div class="panel double-first-class-panel">
    <h2>双一流</h2>
    <p><span class="status-pill">第二轮建设高校</span>${record.first_round_class ? ` <span class="status-pill">首轮${html(record.first_round_class)}</span>` : ""}</p>
    <p>${html(doubleFirstClassDisciplineText(record))}</p>
  </div>
` : "";

const renderRankingPanel = (record) => {
  if (!record) return "";
  const labels = rankingLabels(record);
  return `<div class="panel ranking-panel">
    <div class="panel-head"><h2>公开排名</h2></div>
    <div class="tags">${tagList(labels)}</div>
  </div>`;
};

const admissionCharterChecklist = (university) => {
  const links = [
    university.admission_charter_url ? `<a href="${html(university.admission_charter_url)}" rel="noopener noreferrer">阳光高考招生章程</a>` : "",
    university.admission_site ? `<a href="${html(university.admission_site)}" rel="noopener noreferrer">学校招生官网/招生简章</a>` : ""
  ].filter(Boolean);
  return `<div class="panel">
    <h2>招生章程</h2>
    <div class="tags">${tagList(["专业备注", "校区学费", "体检/单科", "录取规则"])}</div>
    ${links.length ? `<p>${links.join(" · ")}</p>` : `<p class="source-note">最新招生章程/招生简章入口待补充，请先到学校招生官网和阳光高考核对。</p>`}
  </div>`;
};
const latestAdmissionNotice = (university) => {
  const links = [
    university.admission_charter_url ? `<a href="${html(university.admission_charter_url)}" rel="noopener noreferrer">查看阳光高考招生章程</a>` : "",
    university.admission_site ? `<a href="${html(university.admission_site)}" rel="noopener noreferrer">打开学校招生官网/简章</a>` : ""
  ].filter(Boolean);
  return `<div class="notice-box">
    <strong>招生信息以当年章程和省考试院计划为准</strong>
    ${links.length ? `<p>${links.join(" · ")}</p>` : `<p class="source-note">本站暂未补齐该校最新章程入口，正式填报前请到学校招生官网、阳光高考和省考试院计划表核对。</p>`}
  </div>`;
};
const dataGrainLabel = (grain) => ({
  major: "专业级",
  major_group: "专业类/专业组级",
  university_major_group: "院校专业组级",
  university: "院校级"
}[grain] || "");
const renderSourceMeta = (source) => `
  ${source.data_grain ? `<p class="hint">数据颗粒度：${html(dataGrainLabel(source.data_grain) || source.data_grain)}</p>` : ""}
  ${source.fields && source.fields.length ? `<div class="tags">${tagList(source.fields.slice(0, 8))}</div>` : ""}
`;
const isNoisyOpinionSource = (source = {}) => /ZhangXueFeng|张雪峰|公开观点|观点框架|skill/.test(`${source.name || ""} ${source.publisher || ""} ${source.url || ""}`)
  || isNoisyOpinionUrl(source.url || "");
const renderSourceCardBody = (source) => isNoisyOpinionSource(source)
  ? `${renderSourceMeta(source)}`
  : `<p>${html(source.ingestion_policy)}</p>
        ${renderSourceMeta(source)}`;
const renderScoreTable = (scores = [], major) => {
  if (!scores.length) {
    return "<p>这里还没有导入可核验的历史分数和位次。你可以先查看专业介绍和官方招生入口；等对应省份公开数据补齐后，再用于判断大致冲稳保位置。</p>";
  }
  const rows = scores
    .slice()
    .sort((left, right) => Number(right.year) - Number(left.year) || Number(left.min_rank || 0) - Number(right.min_rank || 0))
    .slice(0, 100)
    .map((score) => {
      const originalName = score.major_group_name && score.major_group_name !== major.name ? score.major_group_name : "";
      const source = score.source_url ? `<a href="${html(score.source_url)}" rel="noopener noreferrer">官方来源</a>` : "来源见说明";
      const subjectRequirement = scoreSubjectRequirement(score);
      return `<tr>
        <td>${html(score.year)}</td>
        <td>${html(score.batch || "")}</td>
        <td>${html(originalName || major.name)}</td>
        <td>${html(score.subject_group || "")}</td>
        <td>${html(subjectRequirement)}</td>
        <td>${html(score.min_score ?? "")}</td>
        <td>${html(score.min_rank ?? "")}</td>
        <td>${html(score.plan_count ?? "")}</td>
        <td>${source}</td>
      </tr>`;
    }).join("");
  return `
    <div class="table-wrap"><table>
      <thead><tr><th>年份</th><th>批次</th><th>招生名称</th><th>科类</th><th>选科要求</th><th>最低分</th><th>最低位次</th><th>计划数</th><th>来源</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  `;
};

const admissionScoreComparator = (left, right) =>
  Number(right.year || 0) - Number(left.year || 0)
  || String(left.province || "").localeCompare(String(right.province || ""), "zh-Hans-CN")
  || Number(left.min_rank || 999999999) - Number(right.min_rank || 999999999);

const admissionScoreDisplayName = (score) => {
  const major = score.major_id ? majorById.get(score.major_id) : null;
  return score.major_group_name || major?.name || score.major_group_code || "未匹配专业";
};

const renderAdmissionScoreRows = (scores = [], limit = 80) => scores
  .slice()
  .sort(admissionScoreComparator)
  .slice(0, Number.isFinite(limit) ? limit : undefined)
  .map((score) => {
    const university = universityById.get(score.university_id);
    const major = score.major_id ? majorById.get(score.major_id) : null;
    const detailHref = university && major ? `/university/${university.slug}/major/${major.slug}/` : "";
    const source = score.source_url ? `<a href="${html(score.source_url)}" rel="noopener noreferrer">官方来源</a>` : "来源见说明";
    const subjectRequirement = scoreSubjectRequirement(score);
    return `<tr>
      <td>${html(score.year)}</td>
      <td>${html(score.province)}</td>
      <td>${university ? `<a href="/university/${university.slug}/">${html(university.name)}</a>` : "未匹配院校"}</td>
      <td>${detailHref ? `<a href="${detailHref}">${html(admissionScoreDisplayName(score))}</a>` : html(admissionScoreDisplayName(score))}</td>
      <td>${html(score.batch || "")}</td>
      <td>${html(score.subject_group || "")}</td>
      <td>${html(subjectRequirement)}</td>
      <td>${html(score.min_score ?? "")}</td>
      <td>${html(score.min_rank ?? "")}</td>
      <td>${html(score.plan_count ?? "")}</td>
      <td>${source}</td>
    </tr>`;
  }).join("");

const renderAdmissionScorePreview = (scores = [], limit = Infinity) => {
  if (!scores.length) return "<p>暂无已接入的公开历史投档线。</p>";
  return `<div class="table-wrap rank-line-table"><table>
    <thead><tr><th>年份</th><th>省份</th><th>学校</th><th>招生名称</th><th>批次</th><th>科类</th><th>选科要求</th><th>最低分</th><th>最低位次</th><th>计划数</th><th>来源</th></tr></thead>
    <tbody>${renderAdmissionScoreRows(scores, limit)}</tbody>
  </table></div>`;
};

const scoreFilterOptions = (scores = []) => {
  const provinces = uniqueItems(scores.map((score) => score.province)).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  const years = uniqueItems(scores.map((score) => String(score.year))).sort((a, b) => Number(b) - Number(a));
  return { provinces, years };
};

const renderUniversityScoreExplorer = (university, scores = []) => {
  if (!scores.length) return "<p>暂无已接入历史投档线。</p>";
  const options = scoreFilterOptions(scores);
  const initial = scores;
  return `<div class="score-explorer" data-university-score-filter data-university-id="${html(university.id)}" data-total="${html(scores.length)}">
    <form class="score-filter-form">
      <label>省份
        <select name="province">
          <option value="">全部</option>
          ${options.provinces.map((province) => `<option value="${html(province)}">${html(province)}</option>`).join("")}
        </select>
      </label>
      <label>年份
        <select name="year">
          <option value="">全部</option>
          ${options.years.map((year) => `<option value="${html(year)}">${html(year)}</option>`).join("")}
        </select>
      </label>
      <label>数据粒度
        <select name="grain">
          <option value="">全部</option>
          <option value="major">单专业</option>
          <option value="major_group">专业类/大类</option>
          <option value="university_major_group">院校专业组</option>
          <option value="university">院校级</option>
        </select>
      </label>
      <label>关键词
        <input name="keyword" type="search" placeholder="招生名称、批次、选科">
      </label>
    </form>
    <p class="hint" data-score-filter-summary>共 ${html(initial.length)} 条历史投档线</p>
    <div data-score-filter-results>${renderAdmissionScorePreview(initial)}</div>
  </div>`;
};

const rankingSortValue = (university) => {
  const r = university.ranking?.rankings || {};
  if (r.ruanke_2026_cn) return r.ruanke_2026_cn;
  if (r.ruanke_2025_cn) return r.ruanke_2025_cn + 0.2;
  if (r.the_2026_cn) return 100 + r.the_2026_cn;
  if (r.qs_2026_world) return 200 + r.qs_2026_world / 10;
  if (r.qs_2025_world) return 240 + r.qs_2025_world / 10;
  if (r.the_2026_world) return 250 + r.the_2026_world / 10;
  if (r.usnews_2025_2026_world) return 260 + r.usnews_2025_2026_world / 10;
  if (r.arwu_2025_world) return 280 + r.arwu_2025_world / 10;
  const tags = new Set(university.tags || []);
  if (tags.has("985")) return 400;
  if (tags.has("双一流")) return 500;
  if (tags.has("211")) return 600;
  if (recommendationEligibilityByUniversityId.has(university.id)) return 650;
  if (university.level === "本科") return 800;
  return 1000;
};
const sortUniversitiesByRank = (items) => items.slice().sort((a, b) =>
  rankingSortValue(a) - rankingSortValue(b)
  || a.province.localeCompare(b.province, "zh-Hans-CN")
  || a.name.localeCompare(b.name, "zh-Hans-CN")
);
const rankingSummary = (university) => rankingLabels(university.ranking).slice(0, 4).join(" · ");
const c9Names = new Set(["北京大学", "清华大学", "复旦大学", "上海交通大学", "浙江大学", "南京大学", "中国科学技术大学", "哈尔滨工业大学", "西安交通大学"]);
const isTop100University = (university) => {
  const r = university.ranking?.rankings || {};
  return [
    r.ruanke_2026_cn,
    r.ruanke_2025_cn,
    r.qs_2026_world,
    r.qs_2025_world,
    r.the_2026_cn,
    r.the_2026_world,
    r.qs_2026_asia,
    r.usnews_2025_2026_world,
    r.arwu_2025_world
  ].some((value) => Number(value) > 0 && Number(value) <= 100);
};

const cardMark = (text = "") => html(String(text).replace(/[（(].*$/, "").slice(0, 2) || "知");
const domainFromUrl = (url = "") => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};
const universityLogoUrl = (university) => {
  if (university.logo_url || university.logo) return university.logo_url || university.logo;
  const site = university.website || university.admission_site || "";
  const domain = domainFromUrl(site);
  return domain ? `https://www.google.com/s2/favicons?sz=96&domain_url=${encodeURIComponent(site)}` : "";
};
const renderUniversityMark = (university) => {
  const logo = universityLogoUrl(university);
  return `<a class="info-mark university-logo-mark" href="/university/${university.slug}/">${logo
    ? `<img src="${html(logo)}" alt="${html(university.name)}校徽或官网图标" loading="lazy" referrerpolicy="no-referrer">`
    : cardMark(university.name)}</a>`;
};
const renderMajorCards = (items, options = {}) => items.map((major) => `
  <article class="info-card major-info-card">
    <div class="info-main">
      <h3><a href="/major/${major.slug}/">${html(major.name)}</a></h3>
      <div class="info-badges">${tagList([options.hot ? "HOT" : "", major.discipline, major.category])}</div>
      <div class="info-tags">${tagList([major.code, major.duration, major.degree, ...(major.fit_tags || []).slice(0, 3)])}</div>
    </div>
  </article>
`).join("");

const renderUniversityCards = (items) => items.map((university) => `
  <article class="info-card university-info-card">
    ${renderUniversityMark(university)}
    <div class="info-main">
      <h3><a href="/university/${university.slug}/">${html(university.name)}</a></h3>
      <div class="info-badges">${tagList([university.admission_site ? "招生官网" : "", university.admission_charter_url ? "招生章程" : ""])}</div>
      <div class="info-tags">${tagList([
        `${university.province}${university.city && university.city !== university.province ? `·${university.city}` : ""}`,
        university.ownership,
        university.level,
        ...rankingLabels(university.ranking).slice(0, 5),
        c9Names.has(university.name) ? "C9" : "",
        isTop100University(university) ? "Top100" : "",
        ...(university.tags || []).filter((tag) => ["985", "211", "双一流"].includes(tag)),
        cooperationByChinesePartner.has(university.name) ? "中外合作" : ""
      ])}</div>
      <p class="info-desc">${html((university.description || "").replace(/报考时应核对.*$/, "").slice(0, 86))}</p>
    </div>
  </article>
`).join("");

const featuredMajorSlugs = [
  "artificial-intelligence",
  "embodied-intelligence",
  "brain-computer-science-and-technology",
  "data-science-and-big-data-technology",
  "robotics-engineering",
  "cyberspace-security",
  "information-security",
  "computer-science-and-technology",
  "software-engineering",
  "industrial-software",
  "electronic-information-engineering",
  "communication-engineering",
  "microelectronics-science-and-engineering",
  "automation",
  "internet-of-things-engineering",
  "artificial-intelligence-education",
  "intelligent-manufacturing-engineering",
  "intelligent-science-and-technology",
  "mathematics-and-applied-mathematics",
  "statistics",
  "digital-economy"
];
const featuredMajors = featuredMajorSlugs.map((slug) => majorBySlug.get(slug)).filter(Boolean);
const homeMajors = featuredMajors.length ? featuredMajors : majors.slice(0, 24);
const rankedUniversities = sortUniversitiesByRank(universities);
const homeUniversities = rankedUniversities.filter((university) => university.ranking || university.tags.length || university.website || university.admission_site).slice(0, 18);

const homeBody = `
  <section class="hero">
    <div class="hero-inner">
      <div class="hero-compact-title">
        <h1>查大学、专业、投档线</h1>
      </div>
      <form class="search-panel" role="search" id="search">
        <label for="search-input">搜索专业、院校、职业方向</label>
        <div class="search-row">
          <input id="search-input" name="q" type="search" placeholder="例如：人工智能、具身智能、数据科学、浙江大学">
          <button type="submit">搜索</button>
        </div>
      </form>
      <div id="search-results" class="search-results" aria-live="polite"></div>
      <div class="task-switch" aria-label="常用入口">
        <a class="task-major" href="/majors/"><strong>查专业</strong><span>课程、就业、考研</span></a>
        <a class="task-university" href="/universities/"><strong>查大学</strong><span>章程、专业、报告</span></a>
        <a class="task-rank" href="/admissions/rank-lines/"><strong>查投档线</strong><span>分数、位次、计划</span></a>
        <a class="task-civil" href="/civil-service/"><strong>考公匹配</strong><span>国考、省考、岗位池</span></a>
        <a class="task-planner" href="/planner/"><strong>志愿优化</strong><span>冲稳保与偏好</span></a>
      </div>
    </div>
  </section>
  <section class="band">
    <div class="section-head">
      <p class="eyebrow">热门方向</p>
      <h2>AI 与智能类热门专业</h2>
    </div>
    <div class="grid cards">${renderMajorCards(homeMajors, { hot: true })}</div>
  </section>
  <section class="band muted" id="assistant">
    <div class="section-head">
      <p class="eyebrow">专业匹配小测</p>
      <h2>选专业小问卷</h2>
    </div>
    <div class="tool-grid">
      <form class="panel" id="quiz-form">
        <label><input type="checkbox" name="tag" value="AI热点"> 关注AI、大模型、机器人等热点</label>
        <label><input type="checkbox" name="tag" value="数学逻辑"> 喜欢数学、逻辑或抽象问题</label>
        <label><input type="checkbox" name="tag" value="技术工程"> 想做技术研发或工程落地</label>
        <label><input type="checkbox" name="tag" value="动手实践"> 愿意做项目、实验、模型或设备调试</label>
        <label><input type="checkbox" name="tag" value="稳定行业"> 偏好相对稳定的职业路径</label>
        <label><input type="checkbox" name="tag" value="沟通表达"> 能接受汇报、协调和表达</label>
      </form>
      <div class="panel">
        <h3>匹配结果</h3>
        <div id="quiz-results" class="stack"></div>
        <p class="hint">结果只反映兴趣标签匹配，不代表录取概率、就业保证或专业优劣。</p>
      </div>
    </div>
  </section>
  <section class="band" id="universities">
    <div class="section-head">
      <p class="eyebrow">Universities</p>
      <h2>院校基础库</h2>
    </div>
    <div class="grid cards">${renderUniversityCards(homeUniversities.length ? homeUniversities : universities)}</div>
  </section>
  <section class="band muted">
    <div class="section-head">
      <p class="eyebrow">Topics</p>
      <h2>选专业专题</h2>
    </div>
    <div class="link-grid">
      <a class="topic-link" href="/universities/cooperation/"><span>中外合作办学库</span><small>教育部审批、地方备案、独立法人、非独立法人和项目分层检索。</small></a>
      ${topics.map((topic) => `<a class="topic-link" href="/${topic.type}/${topic.slug}/"><span>${html(topic.title)}</span><small>${html(topic.description)}</small></a>`).join("")}
      ${allSharePages.map((page) => `<a class="topic-link" href="/share/${page.slug}/"><span>${html(page.title)}</span><small>${html(page.description)}</small></a>`).join("")}
    </div>
  </section>
`;

await prepareDist();
await fs.cp(srcDir, path.join(dist, "assets"), { recursive: true });
await fs.mkdir(path.join(dist, "data"), { recursive: true });
await fs.writeFile(path.join(dist, "data", "site-data.json"), JSON.stringify({
  majors,
  universities: browserUniversities,
  universityMajors: browserUniversityMajors,
  admissionScores: [],
  universityRecommendationEligibility
}), "utf8");
await fs.writeFile(path.join(dist, "data", "admission-scores.json"), JSON.stringify(browserAdmissionScores), "utf8");

await write("/", layout({
  title: "知途 大学专业搜索与志愿优化助手",
  description: "搜索大学专业和院校，查看公开来源、专业介绍、招生章程，并用位次和偏好检查平行志愿排序。",
  pathname: "/",
  body: homeBody
}));

const groupBy = (items, keyFn) => {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item) || "其他";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.entries()];
};

const majorsIndexBody = `
  <section class="detail-hero">
    <div>
      <p class="eyebrow">专业库</p>
      <h1>查专业</h1>
    </div>
  </section>
  <section class="band">
    <form class="library-search panel" role="search" data-library-search="major">
      <label for="major-library-search">搜索专业名称、代码、课程、就业方向</label>
      <div class="search-row">
        <input id="major-library-search" name="q" type="search" placeholder="例如：人工智能、会计学、考公、数据分析、工地">
        <button type="submit">搜索专业</button>
      </div>
      <div class="search-results" data-library-results aria-live="polite"></div>
    </form>
    <article class="article narrow">
      <p class="source-note">已接入 ${majors.length} 个本科专业。目录字段优先参考教育部普通高等学校本科专业目录；解释性内容为AI结构化辅助，正式填报前请结合阳光高考和高校招生章程复核。</p>
    </article>
    <div class="link-grid section-actions">
      <a class="topic-link" href="/topics/ai-majors-2026/"><span>AI热门专业</span><small>人工智能、智能科学、数据科学、机器人工程等方向集中查看。</small></a>
      <a class="topic-link" href="/topics/majors-for-civil-service/"><span>考公友好专业</span><small>按岗位适配、专业限制和长期稳定性做参考。</small></a>
      <a class="topic-link" href="/topics/majors-suitable-for-girls/"><span>男生女生常问专业</span><small>不按性别下结论，重点看工作场景、岗位环境和长期收益。</small></a>
      <a class="topic-link" href="/comparison/artificial-intelligence-vs-computer-science/"><span>AI与计算机怎么选</span><small>对比学习内容、就业方向、考研路径和适合人群。</small></a>
    </div>
    ${groupBy(majors.slice().sort((a, b) => a.discipline.localeCompare(b.discipline, "zh-Hans-CN") || a.category.localeCompare(b.category, "zh-Hans-CN") || a.code.localeCompare(b.code)), (major) => major.discipline).map(([discipline, items]) => `
      <section class="index-section">
        <div class="section-head"><p class="eyebrow">${html(discipline)}</p><h2>${html(discipline)}相关专业</h2></div>
        <div class="grid cards">${renderMajorCards(items)}</div>
      </section>
    `).join("")}
  </section>
`;

await write("/majors/", layout({
  title: "大学本科专业库：专业代码、课程、就业与适合人群 | 知途",
  description: "知途大学本科专业库，整理专业代码、专业类、学制学位、核心课程、就业方向、AI风险和考研方向。",
  pathname: "/majors/",
  body: majorsIndexBody,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "专业库", path: "/majors/" }]), {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "知途大学本科专业库",
    numberOfItems: majors.length,
    itemListElement: majors.map((major, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: major.name,
      url: canonical(`/major/${major.slug}/`)
    }))
  }]
}));

const universityIndexBody = `
  <section class="detail-hero compact-hero">
    <div>
    </div>
  </section>
  <section class="band">
    <form class="library-search panel" role="search" data-library-search="university">
      <label class="visually-hidden" for="university-library-search">搜索大学名称、省份、城市、标签</label>
      <div class="search-row">
        <input id="university-library-search" name="q" type="search" placeholder="例如：浙江大学、杭州、双一流、民办、招生章程">
        <button type="submit">搜索大学</button>
      </div>
      <div class="search-results" data-library-results aria-live="polite"></div>
    </form>
    <article class="article narrow">
      <p class="source-note">已接入 ${universities.length} 所普通高校及浙江投档表中的招生单位。排名和标签只用于浏览筛选，不代表专业实力、录取难度或报考建议。</p>
    </article>
    <div class="link-grid section-actions">
      <a class="topic-link" href="/progression/"><span>升学保研榜单</span><small>按大学查看深造率、保研率口径、来源链接和核验状态。</small></a>
      <a class="topic-link" href="/admissions/charters/"><span>招生章程入口</span><small>查看高校招生章程、学费学制、体检限制、外语要求等官方入口。</small></a>
      <a class="topic-link" href="/universities/cooperation/"><span>中外合作办学库</span><small>区分教育部审批、地方备案、独立法人、非独立法人和合作办学项目。</small></a>
    </div>
    <section class="index-section">
      <div class="section-head"><p class="eyebrow">院校信息流</p><h2>大学卡片</h2></div>
      <div class="grid cards">${renderUniversityCards(rankedUniversities.slice(0, 36))}</div>
    </section>
    ${groupBy(rankedUniversities, (university) => university.province).map(([province, items]) => `
      <section class="index-section">
        <div class="section-head"><p class="eyebrow">${html(province)}</p><h2>${html(province)}院校</h2></div>
        <div class="grid cards">${renderUniversityCards(items)}</div>
      </section>
    `).join("")}
  </section>
`;

await write("/universities/", layout({
  title: "大学库：搜索大学、城市、标签和招生入口 | 知途",
  description: "知途大学库，支持按大学名称、省份、城市、985、211、双一流、公办民办等信息搜索。",
  pathname: "/universities/",
  body: universityIndexBody,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "院校库", path: "/universities/" }]), {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "知途高校院校库",
    numberOfItems: universities.length,
    itemListElement: rankedUniversities.map((university, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: university.name,
      url: canonical(`/university/${university.slug}/`)
    }))
  }]
}));

const cooperationRecords = sinoForeignCooperation.records || [];
const cooperationSummary = {
  total: cooperationRecords.length,
  ministry: cooperationRecords.filter((record) => record.approval_authority === "教育部审批和复核").length,
  local: cooperationRecords.filter((record) => record.approval_authority === "地方审批报教育部备案").length,
  independent: cooperationRecords.filter((record) => record.legal_person_status === "独立法人").length,
  nonIndependent: cooperationRecords.filter((record) => record.legal_person_status === "非独立法人").length,
  projects: cooperationRecords.filter((record) => record.legal_person_status === "项目").length
};
const cooperationRows = cooperationRecords.map((record) => `
  <tr data-cooperation-row data-search="${html([
    record.name,
    record.province,
    record.chinese_partner,
    record.foreign_partner,
    record.approval_authority,
    record.legal_person_status,
    record.category,
    record.education_level
  ].filter(Boolean).join(" "))}">
    <td><strong>${html(record.name)}</strong>${record.status_note ? `<br><small>${html(record.status_note)}</small>` : ""}</td>
    <td>${html(record.province || "")}</td>
    <td>${html(record.chinese_partner || "待核验")}</td>
    <td>${html(record.foreign_partner || "见原名单")}</td>
    <td>${html(record.approval_authority)}<br><small>${html(record.education_level)} · ${html(record.approval_type)}</small></td>
    <td><span class="status-pill">${html(record.legal_person_status)}</span><br><small>${html(record.category)}</small></td>
    <td><a href="${html(record.source_url)}" rel="noopener noreferrer">教育部公示</a></td>
  </tr>`).join("");

await write("/universities/cooperation/", layout({
  title: "中外合作办学库：独立法人、非独立法人与项目 | 知途",
  description: "知途整理教育部中外合作办学监管工作信息平台公开名单，区分教育部审批和复核、地方审批报教育部备案、独立法人、非独立法人和项目。",
  pathname: "/universities/cooperation/",
  body: `
    <section class="detail-hero">
      <div>
        <p class="eyebrow">涉外高校 · 中外合作办学 · 教育部公示</p>
        <h1>中外合作办学库</h1>
        <p>按教育部中外合作办学监管工作信息平台公开名单整理，区分教育部审批和复核、地方审批报教育部备案、独立法人、非独立法人和合作办学项目。</p>
      </div>
    </section>
    <section class="band" data-civil-section="national">
      <div class="metric-row">
        <span><strong>${html(cooperationSummary.total)}</strong><small>总记录</small></span>
        <span><strong>${html(cooperationSummary.ministry)}</strong><small>教育部审批/复核</small></span>
        <span><strong>${html(cooperationSummary.local)}</strong><small>地方备案</small></span>
        <span><strong>${html(cooperationSummary.independent)}</strong><small>独立法人记录</small></span>
        <span><strong>${html(cooperationSummary.nonIndependent)}</strong><small>非独立法人机构</small></span>
        <span><strong>${html(cooperationSummary.projects)}</strong><small>项目</small></span>
      </div>
      <form class="library-search panel" data-cooperation-filter>
        <label for="cooperation-search">搜索中方学校、项目/机构、省份、外方学校、审批类型</label>
        <div class="search-row">
          <input id="cooperation-search" name="q" type="search" placeholder="例如：宁波诺丁汉、浙江大学、独立法人、地方备案、英国">
          <button type="submit">筛选</button>
        </div>
        <p class="source-note" data-cooperation-count>当前显示 ${html(cooperationSummary.total)} 条</p>
      </form>
      <div class="table-wrap rank-source-table">
        <table>
          <thead><tr><th>机构/项目名称</th><th>省份</th><th>中方学校</th><th>外方学校</th><th>审批层级</th><th>法人/项目类型</th><th>来源</th></tr></thead>
          <tbody>${cooperationRows}</tbody>
        </table>
      </div>
      ${renderCitations(sinoForeignCooperation.source_pages || [])}
    </section>
  `,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "大学库", path: "/universities/" }, { name: "中外合作办学库", path: "/universities/cooperation/" }])]
}));

const progressionRows = universityProgression
  .slice()
  .sort((left, right) => {
    const statusRank = (status) => ({ "已核验": 0, "部分核验": 1, "需复核": 2, "待补充": 3 }[status] ?? 4);
    const leftStatus = statusRank(left.status);
    const rightStatus = statusRank(right.status);
    return leftStatus - rightStatus || (universityById.get(left.university_id)?.name || "").localeCompare(universityById.get(right.university_id)?.name || "", "zh-Hans-CN");
  })
  .map((item) => {
    const university = universityById.get(item.university_id);
    const urls = progressionSourceLinks(item);
    const eligibility = recommendationEligibilityByUniversityId.get(item.university_id);
    return `<tr>
      <td><strong>${university ? `<a href="/university/${university.slug}/">${html(university.name)}</a>` : "未知院校"}</strong><br><small>${university ? `${html(university.province)} ${html(university.city)}` : ""}</small></td>
      <td>${html(item.cohort || "")}<br><span class="status-pill">${html(item.status)}</span></td>
      <td>${eligibility ? `${html(eligibility.eligibility)}<br><small>${html(eligibility.status)}</small>` : "待核验"}</td>
      <td>${valueOrPending(item.further_study_rate)}</td>
      <td>${valueOrPending(item.domestic_study_rate)}</td>
      <td>${valueOrPending(item.overseas_study_rate)}</td>
      <td>${valueOrPending(item.recommendation_rate)}<br><small>${html(item.recommendation_basis || "")}</small></td>
      <td>${urls.length ? urls.map((url, index) => `<a href="${html(url)}" rel="noopener noreferrer">${index === 0 ? "来源" : "补充"}</a>`).join(" · ") : "待补充"}<br><small>${html(item.source_note || "")}</small></td>
    </tr>`;
  }).join("");

const progressionBody = `
  <section class="detail-hero">
    <div>
      <p class="eyebrow">升学率 · 保研率 · 数据口径</p>
      <h1>大学升学与保研数据</h1>
      <p>看学校时，不只看录取位次，也要看本科毕业后往哪里走。这里把学校是否有推免资格、国内升学、出国出境、总体深造和保研率分开列出，并标明是否已经回到官方报告或公示核验。</p>
    </div>
  </section>
  <section class="band">
    <div class="table-wrap rank-source-table">
      <table>
        <thead><tr><th>大学</th><th>届别</th><th>推免资格</th><th>总体深造</th><th>国内升学</th><th>出国出境</th><th>保研率</th><th>来源</th></tr></thead>
        <tbody>${progressionRows}</tbody>
      </table>
    </div>
    <p class="source-note">口径：优先学校就业质量报告、本科教学质量报告、推免名单和官方公示；推免资格不等于个人保研资格。</p>
  </section>
`;

await write("/progression/", layout({
  title: "大学升学率、保研率与深造数据来源 | 知途",
  description: "知途整理大学本科毕业生升学率、出国出境深造率、保研率口径和官方来源，帮助考生判断学校长期发展路径。",
  pathname: "/progression/",
  body: progressionBody,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "升学保研", path: "/progression/" }])]
}));


const civilServiceRows = (civilServicePositions2026.major_stats || [])
  .map((item) => `<tr data-civil-row data-scope="national" data-search="${html([
    item.major_name,
    item.major_slug,
    "国考",
    ...(item.sample_positions || []).slice(0, 8).flatMap((sample) => [sample.department, sample.bureau, sample.position_name, sample.work_location, sample.specialty])
  ].filter(Boolean).join(" "))}">
    <td><strong><a href="/major/${html(item.major_slug)}/">${html(item.major_name)}</a></strong><br><span class="status-pill">${html(item.feasibility_level)}</span></td>
    <td>${html(item.matched_position_count)}</td>
    <td>${html(item.position_share_percent ?? ((item.position_share || 0) * 100).toFixed(2))}%</td>
    <td>${html(item.direct_match_count || 0)} / ${html(item.category_match_count || 0)} / ${html(item.unrestricted_match_count || 0)}<br><small>${html(item.match_scope_note || "")}</small></td>
    <td>${html(item.matched_plan_count)}</td>
    <td>${html(item.main_position_count)} / ${html(item.supplemental_position_count)}</td>
    <td>${(item.sample_positions || []).slice(0, 3).map((sample) => `${html(sample.department || "")}${sample.position_name ? `：${html(sample.position_name)}` : ""}`).join("<br>")}</td>
  </tr>`).join("");

const zhejiangCivilServiceRows = (zhejiangCivilServicePositions.major_stats || [])
  .map((item) => `<tr data-civil-row data-scope="zhejiang" data-search="${html([
    item.major_name,
    item.major_slug,
    "浙江",
    "浙江省考",
    ...(item.sample_positions || []).slice(0, 8).flatMap((sample) => [sample.year, sample.unit, sample.position_name, sample.position_category, sample.specialty])
  ].filter(Boolean).join(" "))}">
    <td><strong><a href="/major/${html(item.major_slug)}/">${html(item.major_name)}</a></strong><br><span class="status-pill">${html(item.feasibility_level)}</span></td>
    <td>${html(item.matched_position_count)}</td>
    <td>${html(item.position_share_percent ?? ((item.position_share || 0) * 100).toFixed(2))}%</td>
    <td>${html(item.direct_match_count || 0)} / ${html(item.category_match_count || 0)} / ${html(item.unrestricted_match_count || 0)}<br><small>${html(item.match_scope_note || "")}</small></td>
    <td>${html(item.matched_plan_count)}</td>
    <td>${html(Object.entries(item.year_counts || {}).map(([year, count]) => `${year}:${count}`).join(" / "))}</td>
    <td>${(item.sample_positions || []).slice(0, 3).map((sample) => `${html(sample.year || "")} ${html(sample.unit || "")}${sample.position_name ? `：${html(sample.position_name)}` : ""}`).join("<br>")}</td>
  </tr>`).join("");

await write("/civil-service/", layout({
  title: "2026国考与浙江省考岗位专业匹配库 | 知途",
  description: "知途整理2026国考职位表和浙江省2023-2025省考职位表，按本科专业名称、专业代码和专业类粗匹配岗位池，辅助判断专业考公报名可行性。",
  pathname: "/civil-service/",
  body: `
    <section class="detail-hero">
      <div>
        <p class="eyebrow">国考 · 浙江省考 · 专业粗匹配</p>
        <h1>考公岗位专业匹配库</h1>
        <p>已导入2026国考职位 ${html(civilServicePositions2026.total_positions)} 个、浙江省考2023-2025职位 ${html(zhejiangCivilServicePositions.total_positions)} 个。这里按专业名称、专业代码、专业类做粗匹配，用来观察岗位池大小，不代表资格审查一定通过。</p>
      </div>
    </section>
    <section class="band">
      <form class="library-search panel" data-civil-service-filter>
        <label for="civil-service-search">搜索专业、岗位、单位、地区</label>
        <div class="search-row">
          <select name="scope" aria-label="地区/考试范围">
            <option value="">全部地区/范围</option>
            <option value="national">国考</option>
            <option value="zhejiang">浙江省考</option>
          </select>
          <input id="civil-service-search" name="q" type="search" placeholder="例如：法学、审计、杭州、北京、税务、公安">
          <button type="submit">筛选</button>
        </div>
        <p class="source-note" data-civil-service-count>当前显示全部专业匹配结果</p>
      </form>
    </section>
    <section class="band" data-civil-section="national">
      <article class="article narrow">
        <h2>2026国考</h2>
        <p>主招和补录合计计划人数 ${html(civilServicePositions2026.total_plan_count)} 人。职位表还会限制学历、学位、政治面貌、基层年限、服务基层项目、工作地点和备注条件。</p>
        <p class="source-note">${html(civilServicePositions2026.source_note)}</p>
      </article>
      <div class="table-wrap rank-source-table">
        <table>
          <thead><tr><th>专业</th><th>匹配职位</th><th>岗位占比</th><th>直接/类目/不限</th><th>计划人数</th><th>主招/补录</th><th>样例岗位</th></tr></thead>
          <tbody>${civilServiceRows}</tbody>
        </table>
      </div>
    </section>
    <section class="band" data-civil-section="zhejiang">
      <article class="article narrow">
        <h2>浙江省考 2023-2025</h2>
        <p>三年合计计划人数 ${html(zhejiangCivilServicePositions.total_plan_count)} 人。浙江考生可以重点看本省岗位池，同时逐条核对学历、学位、身份、政治面貌、年龄、专业备注和人民警察体测等限制。</p>
        <p class="source-note">${html(zhejiangCivilServicePositions.source_note)}</p>
      </article>
      <div class="table-wrap rank-source-table">
        <table>
          <thead><tr><th>专业</th><th>三年匹配职位</th><th>岗位占比</th><th>直接/类目/不限</th><th>计划人数</th><th>年度分布</th><th>样例岗位</th></tr></thead>
          <tbody>${zhejiangCivilServiceRows}</tbody>
        </table>
      </div>
    </section>
  `,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "考公岗位库", path: "/civil-service/" }])]
}));

const allEmploymentReports = [...(employmentReports2025.reports || []), ...(employmentReports2024.reports || [])];
const employmentMetricValue = (report, key) => report.structured_outcomes?.metrics?.[key]?.value
  || (report.employment_facts || []).find((fact) => fact.metric_key === key)?.value
  || "";
const compactReportTags = (report) => {
  const tags = reportDistributionTags(report);
  return [...tags.study, ...tags.industry, ...tags.region].slice(0, 5);
};
const employmentStatusCounts = allEmploymentReports.reduce((acc, report) => {
  const status = reportStatusLabel(report);
  acc[status] = (acc[status] || 0) + 1;
  return acc;
}, {});
const employmentReportRows = allEmploymentReports
  .filter((report) => report.report_url)
  .sort((left, right) => Number(right.year || 0) - Number(left.year || 0) || String(left.province || "").localeCompare(String(right.province || ""), "zh-Hans-CN"))
  .map((report) => `<tr>
    <td>${report.university_slug ? `<a href="/university/${html(report.university_slug)}/">${html(report.university_name)}</a>` : html(report.university_name)}<br><small>${html(report.province || "")}</small></td>
    <td>${html(report.year || "")}届<br><span class="status-pill">${html(reportStatusLabel(report))}</span></td>
    <td>${html(employmentMetricValue(report, "overall_destination_rate") || "待复核")}</td>
    <td>${html(employmentMetricValue(report, "domestic_study_rate") || employmentMetricValue(report, "further_study_rate") || "待复核")}</td>
    <td>${html(employmentMetricValue(report, "overseas_study_rate") || "待复核")}</td>
    <td>${compactReportTags(report).length ? tagList(compactReportTags(report)) : `<span class="hint">${html(report.artifact_type || "入口待解析")}</span>`}</td>
    <td><a href="${html(report.report_url)}" rel="noopener noreferrer">查看来源</a><br><small>${html(report.source_name || "")}</small></td>
  </tr>`).join("");

await write("/employment-reports/", layout({
  title: "大学就业质量报告摘要 | 知途",
  description: "知途整理高校毕业生就业质量报告入口和结构化摘要，辅助查看毕业去向落实率、升学、就业地区、行业和单位性质。",
  pathname: "/employment-reports/",
  body: `
    <section class="detail-hero">
      <div>
        <p class="eyebrow">就业质量报告 · 升学去向 · 结构化摘要</p>
        <h1>大学就业质量报告摘要</h1>
        <p>优先把公开就业质量报告转成可扫的指标摘要。本站不转载报告正文或PDF，只展示结构化事实、解析状态和来源入口。</p>
      </div>
    </section>
    <section class="band">
      <article class="article narrow">
        <h2>采集状态</h2>
        <div class="employment-status-grid">
          ${Object.entries(employmentStatusCounts).map(([status, count]) => `<span><strong>${html(count)}</strong>${html(status)}</span>`).join("")}
        </div>
        <p class="source-note">2024 届首轮来自 NCSS 专题页；微信或外部平台受限时只记录状态，不伪造摘要。低可信结果保留在数据中供复核，前台优先展示中高可信字段。</p>
      </article>
      <div class="table-wrap rank-source-table">
        <table>
          <thead><tr><th>大学</th><th>届别/状态</th><th>去向落实率</th><th>升学</th><th>出国/境</th><th>主要去向</th><th>来源</th></tr></thead>
          <tbody>${employmentReportRows}</tbody>
        </table>
      </div>
    </section>
  `,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "就业质量报告", path: "/employment-reports/" }])]
}));

const charterRows = universities
  .slice()
  .sort((left, right) => left.province.localeCompare(right.province, "zh-Hans-CN") || left.name.localeCompare(right.name, "zh-Hans-CN"))
  .map((university) => `
    <tr>
      <td><strong><a href="/university/${university.slug}/">${html(university.name)}</a></strong><br><small>${html(university.province)} ${html(university.city)} · ${html(university.authority)}</small></td>
      <td>${university.admission_charter_url ? `<a href="${html(university.admission_charter_url)}" rel="noopener noreferrer">阳光高考招生章程</a>` : "等待补充阳光高考入口"}<br><small>${university.admission_charter_url?.includes("listVerifedZszc--infoId") ? "已定位到年度章程详情页" : university.admission_charter_url ? "学校级章程列表或省级筛选入口" : "未接入"}</small></td>
      <td>${university.admission_site ? `<a href="${html(university.admission_site)}" rel="noopener noreferrer">学校招生官网</a>` : "等待补充"}${university.website ? `<br><small><a href="${html(university.website)}" rel="noopener noreferrer">学校官网</a></small>` : ""}</td>
      <td>${tagList([university.level, university.type, university.ownership, ...(university.tags || []).slice(0, 3)])}</td>
    </tr>
  `).join("");

const chartersBody = `
  <section class="detail-hero">
    <div>
      <p class="eyebrow">官方招生章程</p>
      <h1>大学招生章程和招生官网入口</h1>
      <p>填志愿前，先把学校招生章程看一遍。这里集中整理阳光高考审核通过的招生章程入口、学校招生官网和学校官网，方便核对专业备注、学费、校区、外语要求、体检限制和录取规则。</p>
    </div>
  </section>
  <section class="band">
    <article class="article narrow">
      <h2>章程里最该看什么</h2>
      <ul>
        <li>专业名称、招生专业类、大类分流规则、专业备注和是否中外合作办学。</li>
        <li>校区、学费、学制、外语语种要求、单科成绩要求和体检限制。</li>
        <li>专业录取规则、同分排序规则、是否有专业级差，以及特殊类型招生规则。</li>
        <li>转专业、分流、保研和培养方案不一定都写在招生章程里，还要继续看学校教务处、本科生院和学院通知。</li>
      </ul>
      <p class="source-note">阳光高考页面可能对程序访问设置挑战。这里保留官方入口和字段提醒。</p>
    </article>
    <div class="table-wrap">
      <table>
        <thead><tr><th>学校</th><th>阳光高考章程</th><th>学校入口</th><th>标签</th></tr></thead>
        <tbody>${charterRows}</tbody>
      </table>
    </div>
  </section>
`;

await write("/admissions/charters/", layout({
  title: "大学招生章程入口：阳光高考与学校招生官网 | 知途",
  description: "集中整理大学阳光高考招生章程、学校招生官网和章程核对清单，帮助考生核对专业备注、学费、校区、外语要求、体检限制和录取规则。",
  pathname: "/admissions/charters/",
  body: chartersBody,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "招生章程", path: "/admissions/charters/" }]), {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "大学招生章程入口",
    numberOfItems: universities.length,
    itemListElement: universities.map((university, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: university.name,
      url: canonical(`/university/${university.slug}/`)
    }))
  }]
}));

const loginBody = `
  <section class="detail-hero">
    <div>
      <p class="eyebrow">我的 知途</p>
      <h1>邮箱验证码登录</h1>
      <p>登录后可以继续整理专业、大学和志愿清单。验证码只用于本次登录，不需要设置密码。</p>
    </div>
  </section>
  <section class="band">
    <div class="tool-grid">
      <div class="panel login-card">
        <h2>邮箱登录</h2>
        <form id="email-login-form">
          <label>邮箱<input name="email" type="email" autocomplete="email" placeholder="name@example.com" required></label>
          <button type="submit">发送验证码</button>
        </form>
        <form id="email-verify-form" hidden>
          <label>验证码<input name="code" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="6 位数字" required></label>
          <button type="submit">登录</button>
        </form>
        <div id="email-login-status" class="stack"></div>
        <p class="source-note">验证码 10 分钟内有效。知途 不要求填写身份证号、准考证号等敏感信息。</p>
      </div>
      <div class="panel">
        <h2>登录后可以做什么</h2>
        <p>继续整理收藏的专业和大学，后续会接入志愿清单、排序报告和多设备同步。</p>
        <p><a class="button secondary" href="/favorites/">查看我的收藏</a></p>
      </div>
    </div>
    <div class="panel auth-panel">
      <div id="auth-profile" class="stack">
        <p class="empty">还没有登录。收藏仍会先保存在当前浏览器，登录后可继续接入账号同步。</p>
      </div>
      <div class="button-row">
        <button type="button" class="secondary" id="logout-button">退出登录</button>
      </div>
    </div>
  </section>
`;

await write("/login/", layout({
  title: "邮箱验证码登录 | 知途",
  description: "知途邮箱验证码登录入口，用于保存和同步专业、大学、志愿清单等个人内容。",
  pathname: "/login/",
  body: loginBody,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "登录", path: "/login/" }])]
}));

const favoritesBody = `
  <section class="detail-hero">
    <div>
      <p class="eyebrow">我的收藏</p>
      <h1>收藏的专业和大学</h1>
      <p>把想继续比较的专业和大学先收进来，再和志愿排序、位次参考、招生章程一起看。</p>
    </div>
    <a class="button" href="/login/">邮箱登录</a>
  </section>
  <section class="band">
    <div class="tool-grid">
      <div class="panel">
        <div class="panel-head"><h2>收藏的专业</h2><button type="button" data-clear-favorites="major">清空专业</button></div>
        <div id="favorite-majors" class="stack"></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>收藏的大学</h2><button type="button" data-clear-favorites="university">清空大学</button></div>
        <div id="favorite-universities" class="stack"></div>
      </div>
    </div>
  </section>
`;

await write("/favorites/", layout({
  title: "我的收藏：专业和大学收藏夹 | 知途",
  description: "查看在知途收藏的专业和大学，用于后续志愿排序、专业比较和招生章程核对。",
  pathname: "/favorites/",
  body: favoritesBody,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "我的收藏", path: "/favorites/" }])]
}));

const plannerBody = `
  <section class="detail-hero">
    <div>
      <p class="eyebrow">志愿排序助手</p>
      <h1>80个志愿智能排序优化器</h1>
      <p>输入位次、选考科目、城市偏好、想学和不想学的专业，再贴上你的志愿清单。系统会帮你重排顺序，标出选科限制、冲稳保结构、重复浪费、漏选机会和每个志愿放前放后的理由。</p>
    </div>
  </section>
  <section class="band">
    <div class="decision-actions">
      <a class="decision-card match-card" href="/admissions/match/"><span>先做位次匹配</span><strong>看相近位次能参考哪些专业和院校</strong><small>基于已导入公开历史投档数据，先确定可比较的选择范围。</small></a>
      <a class="decision-card planner-card" href="/planner/"><span>再做志愿优化</span><strong>检查80个志愿怎么排序</strong><small>把选科、城市、偏好、重复项和冲稳保结构放在一起看。</small></a>
      <a class="decision-card rank-line-card" href="/admissions/rank-lines/"><span>直接查投档线</span><strong>看学校和专业的最低分、最低位次</strong><small>浙江已接入2024、2025普通类平行投档线，山东先放少量样例。</small></a>
    </div>
    <div class="tool-grid planner-grid">
      <form class="panel planner-form" id="planner-form">
        <label>省份
          <select name="province">
            <option value="浙江">浙江</option>
            <option value="山东">山东</option>
            <option value="江苏">江苏</option>
            <option value="广东">广东</option>
            <option value="河南">河南</option>
            <option value="四川">四川</option>
          </select>
        </label>
        <label>位次
          <input name="rank" type="number" min="1" placeholder="例如：18000">
        </label>
        <fieldset class="subject-options">
          <legend>选考科目</legend>
          <label><input type="checkbox" name="subjects" value="物理"> 物理</label>
          <label><input type="checkbox" name="subjects" value="化学"> 化学</label>
          <label><input type="checkbox" name="subjects" value="生物"> 生物</label>
          <label><input type="checkbox" name="subjects" value="政治"> 政治</label>
          <label><input type="checkbox" name="subjects" value="历史"> 历史</label>
          <label><input type="checkbox" name="subjects" value="地理"> 地理</label>
          <label><input type="checkbox" name="subjects" value="技术"> 技术</label>
        </fieldset>
        <label>喜欢的专业/方向
          <input name="likes" type="text" placeholder="例如：计算机、AI、电子、杭州">
        </label>
        <label>不喜欢/排除项
          <input name="dislikes" type="text" placeholder="专业/备注排除：医学、师范、中外合作；排除学校请写 学校:某某">
        </label>
        <label>城市偏好
          <input name="cities" type="text" placeholder="例如：杭州、上海、深圳">
        </label>
        <label>志愿清单（每行一个：学校 专业 城市；如果知道选科要求，也可写在行尾）
          <textarea name="choices" rows="12" placeholder="浙江工业大学 软件工程 杭州 物理+化学&#10;杭州电子科技大学 人工智能 杭州 物理+化学&#10;宁波大学 法学 宁波 不限"></textarea>
        </label>
        <div class="button-row">
          <button type="button" id="planner-sample">填入浙江样例</button>
          <button type="submit">生成排序诊断</button>
        </div>
      </form>
      <div class="panel planner-results">
        <div class="panel-head">
          <h2>排序结果</h2>
          <button type="button" id="planner-print">导出报告</button>
        </div>
        <div id="planner-results" class="stack"></div>
        <p class="source-note">排序建议用于和家长、老师一起讨论。正式填报前，请再核对省考试院投档规则、学校招生章程和当年招生计划。</p>
      </div>
    </div>
    <div class="source-strip">
      <strong>数据来源</strong>
      <span>位次和投档线只接入省教育考试院、高校招生网等公开来源；不同省份的数据粒度不同。</span>
      <a href="/admissions/rank-sources/">查看投档位次来源和接入进度</a>
    </div>
  </section>
`;

await write("/planner/", layout({
  title: "80个志愿智能排序优化器 | 知途",
  description: "输入位次、选考科目、城市和专业偏好，粘贴志愿清单，生成志愿排序建议、选科限制、冲稳保结构、风险检测和专业满意度评分。",
  pathname: "/planner/",
  body: plannerBody,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "志愿排序", path: "/planner/" }])]
}));

const matchBody = `
  <section class="detail-hero">
    <div>
      <p class="eyebrow">历史位次参考</p>
      <h1>分数 / 位次能看哪些专业</h1>
      <p>输入省份、年份和位次后，系统只基于已导入的公开历史数据给出参考区间。浙江、山东优先按专业级投档位次处理；广东、上海等院校专业组省份只显示专业组参考，不伪装成单专业位次。这里不提供录取概率，也不替代省考试院和高校招生章程。</p>
    </div>
  </section>
  <section class="band">
    <div class="tool-grid">
      <form class="panel matcher-form" id="rank-match-form">
        <label>省份
          <select name="province">
            <option value="浙江">浙江</option>
            <option value="江苏">江苏</option>
            <option value="山东">山东</option>
            <option value="广东">广东</option>
            <option value="河南">河南</option>
            <option value="四川">四川</option>
          </select>
        </label>
        <label>年份<input name="year" type="number" min="2020" max="2026" value="2025"></label>
        <label>位次<input name="rank" type="number" min="1" placeholder="例如：35000"></label>
        <label>科类 / 选科组合<input name="subject_group" type="text" placeholder="例如：物理类、物理+化学"></label>
        <div class="button-row rank-action-row">
          <button type="button" data-rank-sample="zhejiang">浙江1500位次样例</button>
          <button type="button" data-rank-sample="shandong">山东800位次样例</button>
          <button type="submit">生成历史参考</button>
        </div>
      </form>
      <div class="panel">
        <h2>参考结果</h2>
        <div id="rank-match-results" class="stack"></div>
        <p class="source-note">结果只代表已导入公开历史数据的相对位置参考，可用于观察冲、稳、保区间；浙江/山东可逐步做专业级参考，广东/上海等专业组数据只能做专业组参考，不能承诺录取概率。<a href="/admissions/rank-sources/">查看各省位次数据进度</a></p>
      </div>
    </div>
  </section>
`;

await write("/admissions/match/", layout({
  title: "分数/位次能看哪些专业：历史数据参考 | 知途",
  description: "输入省份、年份和位次，基于公开历史录取数据查看专业和院校参考区间，不承诺录取概率。",
  pathname: "/admissions/match/",
  body: matchBody,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "位次匹配", path: "/admissions/match/" }])]
}));

const admissionScoreStats = [...admissionScores.reduce((map, score) => {
  const key = `${score.province}-${score.year}`;
  const current = map.get(key) || { province: score.province, year: score.year, count: 0 };
  current.count += 1;
  map.set(key, current);
  return map;
}, new Map()).values()]
  .sort((left, right) => String(left.province).localeCompare(String(right.province), "zh-Hans-CN") || Number(right.year) - Number(left.year));

const rankLinesBody = `
  <section class="detail-hero">
    <div>
      <p class="eyebrow">官方历史投档线</p>
      <h1>高考投档线 / 最低位次查询</h1>
      <p>这里直接展示已接入的省教育考试院公开投档线。先看学校、招生名称、最低分、最低位次和计划数，再进入位次匹配或志愿排序。</p>
    </div>
  </section>
  <section class="band">
    <div class="tool-grid">
      <form class="panel matcher-form" id="rank-lines-form">
        <label>省份
          <select name="province">
            <option value="浙江">浙江</option>
            <option value="山东">山东</option>
          </select>
        </label>
        <label>年份
          <select name="year">
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        </label>
        <label>学校 / 专业关键词<input name="keyword" type="search" placeholder="例如：浙江大学 人工智能"></label>
        <label>最低位次上限<input name="max_rank" type="number" min="1" placeholder="例如：20000"></label>
        <div class="button-row rank-action-row">
          <button type="submit">查询投档线</button>
          <a class="button secondary" href="/admissions/match/">按位次匹配</a>
        </div>
      </form>
      <div class="panel">
        <h2>已接入范围</h2>
        <div class="tags">${tagList(admissionScoreStats.map((item) => `${item.province}${item.year}：${item.count}条`))}</div>
        <p class="source-note">浙江为2024、2025普通类第一段/第二段平行投档线；山东目前只放少量公开样例。江苏、广东、上海、河南、四川等会继续按官方公开文件接入。</p>
      </div>
    </div>
    <article class="panel">
      <div class="panel-head">
        <h2>投档线结果</h2>
        <span id="rank-lines-count" class="status-pill">默认显示最近记录</span>
      </div>
      <div id="rank-lines-results">
        ${renderAdmissionScorePreview(admissionScores.filter((score) => score.province === "浙江" && Number(score.year) === 2025), 60)}
      </div>
      <p class="source-note">字段来自公开文件中的投档分、位次、计划数等信息。若招生名称是试验班、大类、中外合作或校区名称，不强行改写成单一专业。</p>
    </article>
  </section>
`;

await write("/admissions/rank-lines/", layout({
  title: "高考投档线和最低位次查询 | 知途",
  description: "查看已接入的浙江、山东公开历史投档线，包含学校、招生名称、最低分、最低位次、计划数和官方来源。",
  pathname: "/admissions/rank-lines/",
  body: rankLinesBody,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "高考投档线", path: "/admissions/rank-lines/" }])]
}));

const rankSourceRows = provinceAdmissionSources.map((source) => `
  <tr>
    <td><strong>${html(source.province)}</strong><br><small>${html(source.latest_year)}年</small></td>
    <td>${source.source_url ? `<a href="${html(source.source_url)}" rel="noopener noreferrer">${html(source.source_name)}</a>` : html(source.source_name)}<br><small>${html(source.publisher)} · ${html(source.published_at || "")}</small></td>
    <td>${html(source.data_grain)}</td>
    <td>${html(source.rank_field)}</td>
    <td><span class="status-pill">${html(source.status)}</span>${source.imported_rows ? `<br><small>已接入 ${html(source.imported_rows)} 条记录</small>` : ""}</td>
    <td>${html(source.usage_note)}<br><small>${html(source.next_action)}</small></td>
  </tr>
`).join("");

const rankSourcesBody = `
  <section class="detail-hero">
    <div>
      <p class="eyebrow">位次数据进度</p>
      <h1>各省最新投档位次找到哪里了</h1>
      <p>这里记录 知途 已确认的官方公开来源、数据粒度和当前接入状态。能精确到“院校 + 专业”的省份会用于专业级历史参考；只有院校专业组的省份，只按专业组展示，不伪装成单个专业的录取位次。</p>
    </div>
  </section>
  <section class="band">
    <article class="article narrow">
      <p class="source-note">2026年投档结果尚未发布。页面先用各省考试院/招办已经公开的2025年数据做往年参考，正式填报仍要以当年省考试院和高校招生章程为准。</p>
    </article>
    <div class="table-wrap rank-source-table">
      <table>
        <thead>
          <tr><th>省份</th><th>官方来源</th><th>粒度</th><th>位次字段</th><th>接入状态</th><th>怎么使用</th></tr>
        </thead>
        <tbody>${rankSourceRows}</tbody>
      </table>
    </div>
  </section>
`;

await write("/admissions/rank-sources/", layout({
  title: "各省投档位次数据进度 | 知途",
  description: "查看浙江、山东、广东、上海、江苏、四川、河南等省份2025年官方投档位次来源、数据粒度和接入状态。",
  pathname: "/admissions/rank-sources/",
  body: rankSourcesBody,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "位次数据进度", path: "/admissions/rank-sources/" }])]
}));

const feedbackBody = `
  <section class="detail-hero">
    <div>
      <p class="eyebrow">反馈与纠错</p>
      <h1>帮助我们修正专业和招生信息</h1>
      <p>如果你发现专业介绍不准确、来源缺失、招生计划或位次数据需要补充，可以在这里提交。我们会优先处理带公开来源链接的反馈。</p>
    </div>
  </section>
  <section class="band">
    <div class="tool-grid">
      <form class="panel feedback-form" id="feedback-form">
        <label>反馈类型
          <select name="feedback_type">
            <option value="data_correction">数据纠错</option>
            <option value="source_addition">补充公开来源</option>
            <option value="ai_content">AI内容不准确</option>
            <option value="admissions">招生计划/位次数据</option>
            <option value="feature">功能建议</option>
          </select>
        </label>
        <label>页面地址<input name="page_url" type="text" placeholder="例如：https://major.ailatest.org/major/artificial-intelligence/"></label>
        <label>标题<input name="subject" type="text" maxlength="120" placeholder="简短说明问题"></label>
        <label>反馈内容<textarea name="message" rows="7" required placeholder="请写明需要修正的内容；如果有公开来源，请贴来源链接、发布日期或文件名。"></textarea></label>
        <label>联系方式（可选）<input name="contact" type="text" maxlength="120" placeholder="邮箱或微信，便于追问来源细节"></label>
        <button type="submit">提交反馈</button>
      </form>
      <div class="panel">
        <h2>处理原则</h2>
        <ul>
          <li>重要事实优先核验教育部、阳光高考、省考试院和高校招生网。</li>
          <li>AI结构化内容可以被反馈修正，但不会被当作事实来源。</li>
          <li>分数和位次只用于历史参考区间，不生成录取概率承诺。</li>
          <li>商业志愿填报数据库、付费报告原文和未授权数据不会被接收。</li>
        </ul>
        <div id="feedback-status" class="stack" aria-live="polite"></div>
      </div>
    </div>
  </section>
`;

await write("/feedback/", layout({
  title: "反馈与数据纠错 | 知途",
  description: "提交专业百科、公开来源、招生计划、历史位次和AI内容纠错反馈。",
  pathname: "/feedback/",
  body: feedbackBody,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "反馈", path: "/feedback/" }])]
}));

const infoPages = [
  {
    pathname: "/about/",
    title: "关于 知途 | AILATEST STUDIO",
    description: "知途 是 AILATEST STUDIO 开发的高考志愿排序决策与大学专业百科网站。",
    heading: "关于 知途",
    eyebrow: "About",
    content: [
      "知途 是 AILATEST STUDIO 开发的高考志愿排序决策系统，域名为 major.ailatest.org。",
      "知途 关注的是志愿顺序本身：同样一批学校和专业，哪些应该放前面，哪些太冒险，哪些重复浪费，哪些需要补一个更稳的选择。"
    ]
  },
  {
    pathname: "/data-sources/",
    title: "数据来源 | 知途",
    description: "知途 使用教育部、阳光高考、省考试院、高校招生网等公开权威来源。",
    heading: "数据来源",
    eyebrow: "Data Sources",
    content: [
      "知途 按优先级使用公开权威来源：教育部本科专业目录、教育部全国高校名单/查询入口、阳光高考专业知识库、阳光高考院校库、省教育考试院、高校招生网、国家统计局、人社部职业分类和高校就业质量报告。",
      "我们不抓取或复用未授权的商业志愿填报数据库，不使用灰色爬取数据，不把AI生成内容当作事实来源。",
      "如果教育部原附件临时不可访问，会优先使用教育部查询入口、阳光高考院校库或标明教育部来源的公开备选页面交叉核验。"
    ],
    extra: `<div class="grid cards">${sources.filter((source) => !isNoisyOpinionSource(source)).map((source) => `
      <article class="card">
        <div class="card-kicker">优先级 ${source.priority} · ${html(source.publisher)}</div>
        <h3>${source.url ? `<a href="${html(source.url)}" rel="noopener noreferrer">${html(source.name)}</a>` : html(source.name)}</h3>
        ${renderSourceCardBody(source)}
      </article>`).join("")}</div>`
  },
  {
    pathname: "/methodology/",
    title: "方法说明 | 知途",
    description: "知途 如何进行志愿排序、冲稳保结构分析、风险检测和专业满意度评分。",
    heading: "方法说明",
    eyebrow: "Methodology",
    content: [
      "知途 的核心方法是把志愿排序拆成几个维度：历史位次参考、专业兴趣匹配、城市偏好、学校和专业重复度、排除项、就业与深造标签、AI替代风险、保底安全性。",
      "排序优化器会先根据你的偏好、城市、专业关键词和风险规则生成结构健康评分。接入浙江等省份公开历史位次数据后，会继续叠加历史位次区间和招生计划进行校准。",
      "我们不会直接承诺录取概率，只使用“历史参考区间”“冲稳保结构”“匹配度”“风险提示”等表述。"
    ]
  },
  {
    pathname: "/contact/",
    title: "联系 AILATEST STUDIO | 知途",
    description: "联系 AILATEST STUDIO，提交数据纠错、公开来源补充和合作建议。",
    heading: "联系 AILATEST STUDIO",
    eyebrow: "Contact",
    content: [
      "开发与维护团队：AILATEST STUDIO。",
      "数据纠错、公开来源补充、合作建议和产品反馈，请优先使用站内反馈页提交。带有公开来源链接、发布日期、文件名或截图说明的反馈会优先处理。",
      "反馈入口：/feedback/。统一联系邮箱：contact@ailatest.org。请勿发送密码、验证码、身份证号或准考证号等敏感信息。"
    ]
  },
  {
    pathname: "/privacy/",
    title: "隐私政策 | 知途",
    description: "知途 隐私政策，说明反馈、收藏和志愿排序输入如何处理。",
    heading: "隐私政策",
    eyebrow: "Privacy",
    content: [
      "知途 当前不会要求用户注册。收藏专业、反馈草稿等数据优先存储在用户本机浏览器中。",
      "当用户主动提交反馈时，我们可能接收页面地址、反馈类型、反馈内容、可选联系方式、浏览器User-Agent和Referer，用于定位问题和处理数据纠错。",
      "请不要在反馈中提交身份证号、准考证号、手机号、家庭住址等敏感个人信息。志愿排序输入仅用于当前页面计算；正式上线数据库存储前会继续减少不必要的个人数据收集。"
    ]
  },
  {
    pathname: "/terms/",
    title: "使用条款 | 知途",
    description: "知途 使用条款，说明网站内容边界和风险提示。",
    heading: "使用条款",
    eyebrow: "Terms",
    content: [
      "知途 提供公开数据整理、AI结构化解释、志愿排序辅助和历史参考分析，不构成录取承诺、升学服务合同或任何保证性建议。",
      "考生和家长在正式填报前，应以省教育考试院、高校招生章程、高校招生网和官方志愿填报系统为准。",
      "禁止将本站内容用于误导性宣传、冒充官方机构、倒卖数据或构建未授权商业数据库。"
    ]
  },
  {
    pathname: "/editorial-policy/",
    title: "编辑政策 | 知途",
    description: "知途 编辑政策，说明AI内容、公开来源、纠错和商业数据边界。",
    heading: "编辑政策",
    eyebrow: "Editorial Policy",
    content: [
      "事实字段优先来自公开权威来源，包括教育部、阳光高考、省考试院、高校招生网、国家统计局和高校就业质量报告。",
      "AI生成内容只用于结构化解释、FAQ草稿和决策辅助，不作为事实来源。重要事实必须有source_note或来源链接。",
      "我们接受用户纠错。涉及专业代码、学校标识码、招生计划、位次和政策限制的纠错，必须回到公开来源核验后再更新。商业报告可以作为人工参考，但不直接抓取或复用原文和表格。"
    ]
  }
];

for (const page of infoPages) {
  const body = `
    <section class="detail-hero">
      <div>
        <p class="eyebrow">${html(page.eyebrow)}</p>
        <h1>${html(page.heading)}</h1>
        <p>${html(page.description)}</p>
      </div>
    </section>
    <section class="band">
      <article class="article narrow">
        ${page.content.map((paragraph) => `<p>${html(paragraph)}</p>`).join("")}
      </article>
      ${page.extra || ""}
    </section>
  `;
  await write(page.pathname, layout({
    title: page.title,
    description: page.description,
    pathname: page.pathname,
    body,
    jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: page.heading, path: page.pathname }])]
  }));
}

for (const major of majors) {
  const careers = careerByMajor.get(major.id) || [];
  const advice = adviceByMajorSlug.get(major.slug);
  const decision = decisionByMajorSlug.get(major.slug);
  const civilServiceStat = civilServiceByMajorId.get(major.id);
  const zhejiangCivilServiceStat = zhejiangCivilServiceByMajorId.get(major.id);
  const subjectEvaluationsForMajor = subjectEvaluationsByMajorSlug.get(major.slug) || [];
  const openUniversities = (universityMajorsByMajorId.get(major.id) || [])
    .map((link) => universityById.get(link.university_id))
    .filter(Boolean);
  const majorCitations = [
    ...(major.source_urls || []).map((url) => ({ title: citationTitle(url, "专业信息来源"), url })),
    ...subjectEvaluationsForMajor.map((item) => ({ title: `${item.subject_name}学科评估来源`, url: item.source_url })),
    { title: "2026国考职位表匹配库来源", url: civilServicePositions2026.source_url },
    { title: "浙江省考职位表匹配库来源", url: zhejiangCivilServicePositions.source_url }
  ];
  const body = `
    <section class="detail-hero">
      <div>
        <p class="eyebrow">${html(major.discipline)} · ${html(major.category)} · ${html(major.code)}</p>
        <h1>${html(major.name)}</h1>
        <p>${html(major.ai_summary)}</p>
        <div class="tags">${tagList([major.discipline, major.category, major.code, major.duration, major.degree, major.is_special ? "特设专业T" : "", major.is_controlled ? "国家控制布点K" : "", ...(major.fit_tags || []).slice(0, 3)])}</div>
      </div>
      <div class="hero-actions">
        <button class="favorite-button" data-favorite-type="major" data-favorite="${html(major.slug)}" type="button">收藏专业</button>
      </div>
    </section>
    <section class="content-grid">
      <article class="article">
        <h2>专业是什么</h2><p>${html(major.description)}</p>
        ${renderMajorJudgement(major, civilServiceStat, zhejiangCivilServiceStat, careers)}
        <h2>核心能力</h2><div class="tags">${tagList(major.skill_requirements.length ? major.skill_requirements : ["待公开来源复核"])}</div>
        <h2>学什么</h2><ul>${list(major.core_courses)}</ul>
        <h2>适合什么人</h2><ul>${list(major.suitable_personality)}</ul>
        <h2>不太适合什么人</h2><ul>${list(major.unsuitable_personality)}</ul>
        <h2>就业方向</h2><ul>${list(major.career_directions)}</ul>
        <h2>考研方向</h2><ul>${list(major.postgraduate_directions)}</ul>
        <h2>公务员/事业编适配度</h2><p>${html(major.civil_service_fit)}</p>
        <h2>AI替代风险</h2><p>${html(major.ai_risk)}</p>
        <h2>未来趋势</h2><p>${html(major.future_trend)}</p>
        <h2>常见问题</h2>
        <div class="faq">${major.faq_json.length ? major.faq_json.map((item) => `<details><summary>${html(item.q)}</summary><p>${html(item.a)}</p></details>`).join("") : "<p>等待公开来源复核后补充。</p>"}</div>
        ${renderCitations(majorCitations)}
      </article>
      <aside class="side">
        ${renderCivilServicePanel(civilServiceStat, zhejiangCivilServiceStat)}
        ${renderSubjectEvaluationPanel(subjectEvaluationsForMajor)}
        ${renderMajorSharpReview(major)}
        ${renderAdvicePanels(advice)}
        <div class="panel"><h2>开设院校样例</h2>${openUniversities.length ? `<ul>${openUniversities.map((university) => `<li><a href="/university/${university.slug}/">${html(university.name)}</a></li>`).join("")}</ul>` : "<p>暂无已接入院校。</p>"}</div>
        <div class="panel"><h2>数据纠错</h2><p><a href="/feedback/">补充公开来源或提交纠错</a></p></div>
        ${sourceBadge(major.source_note)}
      </aside>
    </section>
  `;
  await write(`/major/${major.slug}/`, layout({
    title: `${major.name}专业介绍、课程、就业方向与适合人群 | 知途`,
    description: `${major.name}是什么、学什么、适合什么人、就业方向、考研方向、AI风险和常见问题。`,
    pathname: `/major/${major.slug}/`,
    body,
    jsonLd: [
      breadcrumbJson([{ name: "首页", path: "/" }, { name: major.name, path: `/major/${major.slug}/` }]),
      major.faq_json.length ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: major.faq_json.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a }
        }))
      } : null
    ]
  }));
}

for (const university of universities) {
  const links = universityMajorsByUniversityId.get(university.id) || [];
  const officialMajorLinks = links.filter((link) => !String(link.id).startsWith("score-"));
  const historicalAdmissionLinks = links.filter((link) => String(link.id).startsWith("score-"));
  const universityScores = admissionScoresByUniversityId.get(university.id) || [];
  const transferPolicy = transferPolicyByUniversityId.get(university.id);
  const advice = adviceByUniversitySlug.get(university.slug);
  const progression = progressionByUniversityId.get(university.id);
  const recommendationEligibility = recommendationEligibilityByUniversityId.get(university.id);
  const employmentReports = employmentReportsByUniversityId.get(university.id) || [];
  const cooperationRecords = cooperationByChinesePartner.get(university.name) || [];
  const doubleFirstClassRecord = university.double_first_class;
  const subjectEvaluationsForUniversity = subjectEvaluationsByUniversityName.get(university.name) || [];
  const intro = conciseUniversityIntro(university);
  const universityCitations = [
    { title: "阳光高考招生章程", url: university.admission_charter_2026_url || university.admission_charter_url },
    { title: "学校招生官网", url: university.admission_brochure_2026_url || university.admission_site },
    { title: "学校官网", url: university.website },
    ...(reportLinks(employmentReports).slice(0, 1).map((report) => ({ title: `${report.year || ""}届就业质量报告入口`, url: report.report_url }))),
    ...(progressionSourceLinks(progression).slice(0, 1).map((url) => ({ title: "升学与保研数据来源", url }))),
    { title: "推免资格来源", url: recommendationEligibility?.source_url },
    { title: "第二轮双一流名单", url: doubleFirstClassRecord?.source_page || doubleFirstClassRecord?.source_url },
    { title: transferPolicy?.source_name || "转专业政策来源", url: transferPolicy?.source_url },
    ...(university.fee_source_urls || []).slice(0, 1).map((url) => ({ title: citationTitle(url, "校区住宿费用"), url })),
    ...(cooperationRecords.length ? (sinoForeignCooperation.source_pages || []).slice(0, 1).map((source) => ({ title: "中外合作办学", url: source.url })) : [])
  ];
  const body = `
    <section class="detail-hero">
      <div>
        <p class="eyebrow">${html(university.province)} · ${html(university.city)} · ${html(university.authority)}</p>
        <h1>${html(university.name)}</h1>
        <div class="tags">${tagList([university.level, university.type, university.ownership, ...(university.tags || [])])}</div>
      </div>
      <div class="hero-actions">
        <button class="favorite-button" data-favorite-type="university" data-favorite="${html(university.slug)}" type="button">收藏大学</button>
        ${university.admission_site ? `<a class="button" href="${html(university.admission_site)}" rel="noopener noreferrer">招生官网</a>` : ""}
        ${university.admission_charter_url ? `<a class="button secondary" href="${html(university.admission_charter_url)}" rel="noopener noreferrer">阳光高考招生章程</a>` : ""}
        ${reportLinks(employmentReports)[0] ? `<a class="button secondary" href="${html(reportLinks(employmentReports)[0].report_url)}" rel="noopener noreferrer">就业质量报告</a>` : ""}
      </div>
    </section>
    <section class="content-grid">
      <article class="article">
        <h2>学校简介</h2><p>${html(intro)}</p>
        ${renderDoubleFirstClassBlock(doubleFirstClassRecord)}
        ${latestAdmissionNotice(university)}
        ${university.admission_charter_url ? `<p><a href="${html(university.admission_charter_url)}" rel="noopener noreferrer">查看阳光高考审核通过的招生章程</a></p>` : ""}
        <h2>历年投档线</h2>${renderUniversityScoreExplorer(university, universityScores)}
        <h2>升学与就业报告</h2>
        ${renderEmploymentReportSummary(employmentReports)}
        ${renderCampusCostPanel(university)}
        ${renderCitations(universityCitations)}
      </article>
      <aside class="side">
        <div class="panel"><h2>基础信息</h2><dl><dt>学校标识码</dt><dd>${html(university.moe_code)}</dd><dt>所在地</dt><dd>${html(university.province)} ${html(university.city)}</dd><dt>主管部门</dt><dd>${html(university.authority)}</dd><dt>办学性质</dt><dd>${html(university.ownership)}</dd></dl></div>
        ${renderUniversitySharpReview(university)}
        ${renderRankingPanel(university.ranking)}
        ${renderDoubleFirstClassPanel(doubleFirstClassRecord)}
        ${renderUniversitySubjectEvaluationPanel(subjectEvaluationsForUniversity)}
        ${renderRecommendationEligibilityPanel(recommendationEligibility)}
        ${renderEmploymentReportPanel(employmentReports)}
        ${renderCooperationSummaryPanel(cooperationRecords)}
        ${renderProgressionPanel(progression)}
        ${admissionCharterChecklist(university)}
        ${renderAdvicePanels(advice)}
        ${hasVerifiedTransferPolicy(transferPolicy) ? `<div class="panel"><h2>转专业</h2><p><span class="status-pill">${html(transferPolicy.difficulty_level)}</span></p>${transferPolicyLink(transferPolicy)}</div>` : ""}
      </aside>
    </section>
  `;
  await write(`/university/${university.slug}/`, layout({
    title: `${university.name}专业与招生信息入口 | 知途`,
    description: `${university.name}基础信息、所在地、标签、招生官网、开设专业和录取数据入口。`,
    pathname: `/university/${university.slug}/`,
    body,
    jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: university.name, path: `/university/${university.slug}/` }])]
  }));
}

for (const link of universityMajors) {
  const university = universityById.get(link.university_id);
  const major = majorById.get(link.major_id);
  if (!university || !major) continue;
  const scores = admissionScoresByUniversityMajor.get(`${university.id}:${major.id}`) || [];
  const plans = admissionPlansByUniversityMajor.get(`${university.id}:${major.id}`) || [];
  const transferPolicy = transferPolicyByUniversityId.get(university.id);
  const subjectEvaluationsForMajor = subjectEvaluationsByMajorSlug.get(major.slug) || [];
  const body = `
    <section class="detail-hero">
      <div>
        <p class="eyebrow">${html(university.name)} · ${html(major.discipline)} · ${html(link.year)}</p>
        <h1>${html(university.name)}${html(major.name)}</h1>
        <p>${html(major.ai_summary)}</p>
      </div>
      ${university.admission_site ? `<a class="button" href="${html(university.admission_site)}" rel="noopener noreferrer">招生官网</a>` : ""}
      ${university.admission_charter_url ? `<a class="button secondary" href="${html(university.admission_charter_url)}" rel="noopener noreferrer">阳光高考招生章程</a>` : ""}
    </section>
    <section class="content-grid">
      <article class="article">
        ${latestAdmissionNotice(university)}
        <h2>专业介绍</h2><p>${html(university.name)}的${html(major.name)}页面先展示专业百科和公开招生入口。具体培养方案、招生专业名称、校区、学费、学制、选科要求、体检限制和专业备注，以学校最新招生章程/招生简章及省考试院当年招生计划为准。</p>
        <h2>招生计划</h2><p>${plans.length ? "已导入公开招生计划样例。" : "暂未导入正式招生计划。后续优先接入浙江、江苏、山东、广东、河南、四川公开数据。"}</p>
        <h2>学费学制</h2><dl class="inline-dl"><dt>学制</dt><dd>${html(link.duration)}</dd><dt>学位</dt><dd>${html(link.degree)}</dd><dt>学费</dt><dd>${link.tuition ? `${link.tuition}元/年` : "以当年招生章程为准"}</dd><dt>校区</dt><dd>${html(link.campus)}</dd></dl>
        <h2>选科要求</h2><p>${html(link.subject_requirements)}</p>
        <h2>历年分数和位次</h2>${renderScoreTable(scores, major)}
        <h2>适合哪些考生</h2><ul>${list(major.suitable_personality)}</ul>
        <h2>相似选择</h2><div class="tags">${tagList((majorsByCategory.get(major.category) || []).filter((candidate) => candidate.id !== major.id).slice(0, 8).map((candidate) => candidate.name))}</div>
      </article>
      <aside class="side">${renderMajorSharpReview(major)}${renderUniversitySharpReview(university)}${admissionCharterChecklist(university)}${renderSubjectEvaluationPanel(subjectEvaluationsForMajor)}${transferPolicy ? `<div class="panel"><h2>转专业难度</h2><p><span class="status-pill">${html(transferPolicy.difficulty_level)}</span></p>${transferPolicyLink(transferPolicy)}</div>` : ""}${sourceLinks(major.source_urls)}${sourceBadge(link.source_note)}${sourceBadge(major.source_note)}</aside>
    </section>
  `;
  await write(`/university/${university.slug}/major/${major.slug}/`, layout({
    title: `${university.name}${major.name}：招生计划、选科要求与历年位次入口 | 知途`,
    description: `${university.name}${major.name}介绍、学费学制、选科要求、招生计划和历年分数位次入口。`,
    pathname: `/university/${university.slug}/major/${major.slug}/`,
    body,
    jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: university.name, path: `/university/${university.slug}/` }, { name: major.name, path: `/university/${university.slug}/major/${major.slug}/` }])]
  }));
}

const compareRows = (left, right) => [
  ["学什么不同", left.core_courses.slice(0, 5).join("、") || "待补充", right.core_courses.slice(0, 5).join("、") || "待补充"],
  ["就业方向不同", left.career_directions.slice(0, 5).join("、") || "待补充", right.career_directions.slice(0, 5).join("、") || "待补充"],
  ["考研方向不同", left.postgraduate_directions.slice(0, 5).join("、") || "待补充", right.postgraduate_directions.slice(0, 5).join("、") || "待补充"],
  ["课程难度", `${left.discipline} ${left.category}，${left.duration}`, `${right.discipline} ${right.category}，${right.duration}`],
  ["未来趋势", left.future_trend, right.future_trend],
  ["适合人群", left.suitable_personality.join("、") || "待补充", right.suitable_personality.join("、") || "待补充"],
  ["填报建议", left.ai_summary, right.ai_summary]
];

for (const comparison of comparisons) {
  const left = majorBySlug.get(comparison.left);
  const right = majorBySlug.get(comparison.right);
  if (!left || !right) continue;
  const body = `
    <section class="detail-hero"><div><p class="eyebrow">专业对比</p><h1>${html(comparison.title)}</h1><p>${html(comparison.description)}</p></div></section>
    <section class="band">
      <div class="table-wrap compare-table"><table><thead><tr><th>维度</th><th>${html(left.name)}</th><th>${html(right.name)}</th></tr></thead><tbody>${compareRows(left, right).map((row) => `<tr><th>${html(row[0])}</th><td>${html(row[1])}</td><td>${html(row[2])}</td></tr>`).join("")}</tbody></table></div>
      <p class="source-note">对比为AI结构化辅助内容，目录字段来自教育部专业目录，报考前需结合学校培养方案、招生章程和省考试院计划核验。</p>
    </section>
  `;
  for (const prefix of ["compare", "comparison"]) {
    await write(`/${prefix}/${comparison.slug}/`, layout({
      title: `${comparison.title}：课程、就业、考研和填报建议 | 知途`,
      description: comparison.description,
      pathname: `/${prefix}/${comparison.slug}/`,
      body,
      jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: comparison.title, path: `/${prefix}/${comparison.slug}/` }])]
    }));
  }
}

for (const topic of topics) {
  const items = topic.major_slugs.map((slug) => majorBySlug.get(slug)).filter(Boolean);
  const body = `
    <section class="detail-hero"><div><p class="eyebrow">${topic.type === "rankings" ? "专业清单" : "选专业专题"}</p><h1>${html(topic.title)}</h1><p>${html(topic.description)}</p></div></section>
    <section class="band">
      <article class="article narrow"><p>${html(topic.content)}</p></article>
      ${renderTopicSections(topic.sections)}
      <div class="grid cards">${renderMajorCards(items)}</div>
      <p class="source-note">专题用于启发筛选，不构成录取建议。请结合个人成绩、选科、体检要求、招生计划和公开录取数据判断。</p>
      ${renderTopicSourceLinks(topic.source_urls)}
    </section>
  `;
  await write(`/${topic.type}/${topic.slug}/`, layout({
    title: `${topic.title} | 知途`,
    description: topic.description,
    pathname: `/${topic.type}/${topic.slug}/`,
    body,
    jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: topic.title, path: `/${topic.type}/${topic.slug}/` }])]
  }));
}

for (const page of allSharePages) {
  const items = page.major_slugs.map((slug) => majorBySlug.get(slug)).filter(Boolean);
  const body = `
    <section class="detail-hero">
      <div>
        <p class="eyebrow">${html(page.channel)}</p>
        <h1>${html(page.title)}</h1>
        <p>${html(page.description)}</p>
      </div>
      <a class="button" href="${html(page.primary_href)}">${html(page.primary_cta)}</a>
    </section>
    <section class="band">
      <article class="article narrow">
        <p class="lead">${html(page.hook)}</p>
        <ul>${list(page.points)}</ul>
        <p>
          <a class="button" href="${html(page.primary_href)}">${html(page.primary_cta)}</a>
          <a class="text-link" href="${html(page.secondary_href)}">${html(page.secondary_cta)}</a>
        </p>
      </article>
      <div class="grid cards">${renderMajorCards(items)}</div>
      <p class="source-note">${html(page.source_note)} 知途只提供公开数据整理和AI结构化辅助，不承诺录取概率。</p>
    </section>
  `;
  await write(`/share/${page.slug}/`, layout({
    title: `${page.title} | 知途`,
    description: page.description,
    pathname: `/share/${page.slug}/`,
    body,
    jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: page.title, path: `/share/${page.slug}/` }])]
  }));
}

const sourcesBody = `
  <section class="detail-hero"><div><p class="eyebrow">数据来源</p><h1>数据来源与使用边界</h1><p>本站按公开权威数据优先级分层建设。AI内容只做结构化解释，不作为事实来源。</p></div></section>
  <section class="band">
    <div class="grid cards">${sources.filter((source) => !isNoisyOpinionSource(source)).map((source) => `
      <article class="card">
        <div class="card-kicker">优先级 ${source.priority} · ${html(source.publisher)}</div>
        <h3>${source.url ? `<a href="${html(source.url)}" rel="noopener noreferrer">${html(source.name)}</a>` : html(source.name)}</h3>
        ${renderSourceCardBody(source)}
      </article>`).join("")}</div>
  </section>
`;

await write("/sources/", layout({
  title: "数据来源与使用边界 | 知途",
  description: "知途公开数据来源、AI内容边界、招生分数和就业薪资数据使用原则。",
  pathname: "/sources/",
  body: sourcesBody
}));

const transferPolicyRows = transferPolicies.map((policy) => {
  const university = universityById.get(policy.university_id);
  return `
    <tr>
      <td><strong>${html(university?.name || "未知院校")}</strong><br><small>${html(university?.province || "")}${html(university?.city || "")}</small></td>
      <td><span class="status-pill">${html(policy.difficulty_level)}</span><br><small>开放度参考 ${html(policy.openness_score)}</small></td>
      <td>${html(policy.summary)}<br><small>${html(policy.application_window)}</small></td>
      <td>${tagList(policy.common_limits || [])}</td>
      <td>${policy.source_url ? `<a href="${html(policy.source_url)}" rel="noopener noreferrer">${html(policy.source_name)}</a>` : html(policy.source_name)}<br><small>${html(policy.source_note)}</small></td>
    </tr>
  `;
}).join("");

const transferBody = `
  <section class="detail-hero">
    <div>
      <p class="eyebrow">转专业政策</p>
      <h1>哪些学校转专业更值得提前查</h1>
      <p>很多考生会把“先进学校，再转到更喜欢的专业”当作备选路径。知途 先把公开政策、申请窗口、常见限制和风险提醒整理出来，帮助你判断这条路能不能作为志愿排序的辅助因素。</p>
    </div>
  </section>
  <section class="band">
    <article class="article narrow">
      <p class="source-note">转专业难度会随学校、学院、专业、年级、名额和当年政策变化。这里是公开来源整理和风险提示，不代表学校承诺，也不能替代本科生院、教务处和学院当年通知。</p>
    </article>
    <div class="table-wrap rank-source-table">
      <table>
        <thead><tr><th>学校</th><th>难度参考</th><th>政策摘要</th><th>常见限制</th><th>来源</th></tr></thead>
        <tbody>${transferPolicyRows}</tbody>
      </table>
    </div>
  </section>
`;

await write("/transfer-major/", layout({
  title: "大学转专业难度与政策参考 | 知途",
  description: "整理高校转专业政策、申请窗口、常见限制和风险提醒，帮助高考志愿排序时判断转专业路径是否可靠。",
  pathname: "/transfer-major/",
  body: transferBody,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "转专业政策", path: "/transfer-major/" }])]
}));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pagePaths.map((pathname) => `  <url><loc>${canonical(pathname)}</loc></url>`).join("\n")}
</urlset>
`;

await fs.writeFile(path.join(dist, "sitemap.xml"), sitemap, "utf8");
await fs.writeFile(path.join(dist, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`, "utf8");
await fs.writeFile(path.join(dist, indexNow.key_file), indexNow.key, "utf8");
await fs.writeFile(path.join(dist, "llms.txt"), `# 知途

知途 is an AI volunteer-ranking decision system and university-major knowledge base for Chinese gaokao students.

Canonical site: ${siteUrl}
Developer: AILATEST STUDIO

## Core Pages

- Home: ${siteUrl}/
- 80-choice volunteer ranking optimizer: ${siteUrl}/planner/
- Public data sources: ${siteUrl}/data-sources/
- Methodology: ${siteUrl}/methodology/
- Editorial policy: ${siteUrl}/editorial-policy/
- Feedback and correction: ${siteUrl}/feedback/
- Sitemap: ${siteUrl}/sitemap.xml

## Product Boundary

This site is not a traditional admissions-guarantee or probability-prediction product. It helps users sort, inspect, and explain volunteer choices using public-source data, structured major profiles, preference matching, and risk rules. It does not promise admission probability.

## Data Policy

Facts should be sourced from public authoritative sources such as the Ministry of Education, CHSI/Yangguang Gaokao, provincial examination authorities, university admissions sites, the National Bureau of Statistics, occupational classifications, and university employment quality reports. AI-generated content is explanatory only and must not be treated as the source of factual data.
`, "utf8");
await fs.writeFile(path.join(dist, "humans.txt"), `/* TEAM */
Developer: AILATEST STUDIO
Site: 知途
Domain: ${siteUrl}

/* SITE */
Purpose: AI志愿排序决策系统 + 大学专业百科
Audience: 高考考生、家长、老师
Data policy: 公开权威来源优先，不做灰色爬取，不复用未授权商业志愿填报数据库
Safety policy: 只提供历史参考区间、冲稳保结构、匹配度和风险提示，不承诺录取概率

/* KEY URLS */
Sitemap: ${siteUrl}/sitemap.xml
Data sources: ${siteUrl}/data-sources/
Methodology: ${siteUrl}/methodology/
Editorial policy: ${siteUrl}/editorial-policy/
Contact: ${siteUrl}/contact/
`, "utf8");
await fs.writeFile(path.join(dist, "_redirects"), "/* /index.html 200\n", "utf8");

console.log(`Built ${pagePaths.length} pages in ${dist}`);
