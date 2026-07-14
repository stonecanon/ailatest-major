import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const dist = process.env.BUILD_DIST ? path.resolve(process.env.BUILD_DIST) : path.join(root, "dist");
const readJson = async (name) => JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));

const failures = [];
const fail = (message) => failures.push(message);
const thinText = /暂无已核验|暂无已接入|等待公开来源复核后补充|待补充：需结合|排名来源 · 排名来源|参考1|补充来源 · 补充来源|已接入 7 条公开投档线记录|先搜专业和学校，弄清楚/;

const majors = await readJson("majors.json");
const universities = await readJson("universities.json");
const reports2025 = await readJson("employment_quality_reports_2025.json");
const reports2024 = await readJson("employment_quality_reports_2024.json");
const rankings = await readJson("university_rankings.json");
const recommendation = await readJson("university_recommendation_eligibility.json");
const admissionScores = await readJson("admission_scores.json");
const civil = await readJson("civil_service_positions_2026.json");
const zhejiangCivil = await readJson("civil_service_positions_zhejiang_2023_2025.json");
const sinoForeignCooperation = await readJson("sino_foreign_cooperation.json");

for (const university of universities) {
  if (!university.description || thinText.test(university.description)) fail(`university ${university.slug} has thin description`);
  for (const key of ["campus_locations"]) {
    if (!Array.isArray(university[key]) || !university[key].length) fail(`university ${university.slug} missing ${key}`);
  }
  for (const key of ["campus_locations_summary", "tuition_range", "tuition_note", "accommodation_fee", "dormitory"]) {
    if (!university[key]) fail(`university ${university.slug} missing ${key}`);
  }
  if (!university.cooperative_education || typeof university.cooperative_education.total_records !== "number") {
    fail(`university ${university.slug} missing cooperative education summary`);
  }
}

for (const major of majors) {
  for (const key of ["description", "ai_summary", "civil_service_fit", "ai_risk", "future_trend"]) {
    if (!major[key] || thinText.test(major[key])) fail(`major ${major.slug} has thin ${key}`);
  }
  for (const key of ["core_courses", "career_directions", "postgraduate_directions", "skill_requirements", "suitable_personality", "unsuitable_personality", "faq_json"]) {
    if (!Array.isArray(major[key]) || !major[key].length) fail(`major ${major.slug} missing ${key}`);
  }
}

const rankingByName = new Map(rankings.map((item) => [item.name, item]));
const eligibilityById = new Set(recommendation.map((item) => item.university_id));
const rankingValue = (university) => {
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
const top200 = universities.slice().sort((a, b) => rankingValue(a) - rankingValue(b) || a.name.localeCompare(b.name, "zh-Hans-CN")).slice(0, 200);
const reportIds = new Set([...(reports2025.reports || []), ...(reports2024.reports || [])].map((item) => item.university_id).filter(Boolean));
for (const university of top200) {
  if (!reportIds.has(university.id)) fail(`top200 university missing employment report entry: ${university.name}`);
}

if (admissionScores.length !== 49237) fail(`admission_scores expected 49237, got ${admissionScores.length}`);
const zju = universities.find((item) => item.moe_code === "4133010335" || item.slug === "zhejiang-university");
if (!zju) {
  fail("zhejiang university not found");
} else {
  const zjuScores = admissionScores.filter((score) => score.university_id === zju.id);
  const zjuZhejiang2025 = zjuScores.filter((score) => score.province === "浙江" && Number(score.year) === 2025);
  if (zjuScores.length !== 47) fail(`zju expected 47 scores, got ${zjuScores.length}`);
  if (zjuZhejiang2025.length !== 24) fail(`zju zhejiang 2025 expected 24 scores, got ${zjuZhejiang2025.length}`);
}

if ((civil.major_stats || []).length !== majors.length) fail("national civil-service stats do not cover all majors");
if ((zhejiangCivil.major_stats || []).length !== majors.length) fail("zhejiang civil-service stats do not cover all majors");
for (const stat of civil.major_stats || []) {
  if (typeof stat.position_share_percent !== "number") fail(`civil stat missing percent for ${stat.major_name}`);
}
for (const stat of zhejiangCivil.major_stats || []) {
  if (typeof stat.position_share_percent !== "number") fail(`zhejiang civil stat missing percent for ${stat.major_name}`);
}

if (!Array.isArray(sinoForeignCooperation.records) || sinoForeignCooperation.records.length < 3000) {
  fail(`sino_foreign_cooperation expected at least 3000 records, got ${sinoForeignCooperation.records?.length || 0}`);
}
if (!sinoForeignCooperation.records.some((record) => record.legal_person_status === "独立法人")) {
  fail("sino_foreign_cooperation missing independent legal-person records");
}
if (!sinoForeignCooperation.records.some((record) => record.approval_authority === "地方审批报教育部备案")) {
  fail("sino_foreign_cooperation missing local filing records");
}

try {
  const candidates = [
    path.join(dist, "index.html"),
    path.join(dist, "university", "zhejiang-university", "index.html"),
    path.join(dist, "universities", "cooperation", "index.html"),
    path.join(dist, "civil-service", "index.html"),
    path.join(dist, "planner", "index.html")
  ];
  for (const file of candidates) {
    const content = await fs.readFile(file, "utf8");
    if (thinText.test(content)) fail(`dist contains banned text in ${path.relative(root, file)}`);
  }
} catch {
  // Dist may not exist before build; data audit still runs.
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`MVP audit passed: ${majors.length} majors, ${universities.length} universities, top200 employment covered.`);
