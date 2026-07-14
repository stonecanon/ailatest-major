import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const generatedDir = path.join(dataDir, "generated");

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith("--")) continue;
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) args.set(key, true);
  else {
    args.set(key, next);
    index += 1;
  }
}

const apply = args.has("--apply");
const majorsFile = args.get("--majors");
const universitiesFile = args.get("--universities");
const plansFile = args.get("--plans");
const scoresFile = args.get("--scores");

if (!majorsFile && !universitiesFile && !plansFile && !scoresFile) {
  console.error("Usage: npm run import:public -- --majors imports/major_catalog.csv --universities imports/university_list.csv --plans imports/admission_plans.csv --scores imports/admission_scores.csv [--apply]");
  process.exit(1);
}

const readJson = async (name) =>
  JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));

const writeJson = async (file, value) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const parseDelimited = (text) => {
  const delimiter = text.slice(0, 2048).includes("\t") ? "\t" : ",";
  const rows = [];
  let cell = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((values, lineIndex) => {
    const rowObject = { __line: lineIndex + 2 };
    headers.forEach((header, index) => {
      rowObject[header] = (values[index] || "").trim();
    });
    return rowObject;
  });
};

const readTable = async (file) => {
  const text = await fs.readFile(path.resolve(root, file), "utf8");
  return parseDelimited(text);
};

const fileMeta = async (file) => {
  const absolute = path.resolve(root, file);
  const bytes = await fs.readFile(absolute);
  return {
    path: path.relative(root, absolute),
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length
  };
};

const pick = (row, aliases) => {
  for (const alias of aliases) {
    if (row[alias]) return row[alias].trim();
  }
  return "";
};

const truthy = (value) => /^(1|true|yes|y|是|特设|国控|国家控制)$/i.test(String(value || "").trim());

const normalizeCode = (value) => String(value || "").replace(/\s+/g, "").toUpperCase();
const toInt = (value) => {
  const clean = String(value || "").replace(/[^\d.-]/g, "");
  if (!clean) return null;
  const number = Number(clean);
  return Number.isFinite(number) ? Math.round(number) : null;
};

const slugifyAscii = (value, fallback) => {
  const slug = String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
};

const stripProvinceSuffix = (value) =>
  String(value || "")
    .replace(/(省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区)$/u, "")
    .trim();

const municipality = new Set(["北京", "上海", "天津", "重庆"]);

const defaultMajorSummary = (major) =>
  `${major.name}是${major.discipline}${major.category}下的本科专业。当前页面先展示教育部专业目录字段，专业介绍、课程、就业和FAQ等待阳光高考及高校培养方案复核后补充。`;

const defaultUniversityDescription = (university) =>
  `${university.name}位于${university.province}${university.city && university.city !== university.province ? university.city : ""}，办学层次为${university.level || "以教育部名单为准"}。当前页面先展示教育部全国高校名单字段，院校介绍和招生入口等待学校官网复核后补充。`;

const importMajors = async (file) => {
  const existing = await readJson("majors.json");
  const existingByCode = new Map(existing.map((major) => [normalizeCode(major.code), major]));
  const existingByName = new Map(existing.map((major) => [major.name, major]));
  const rows = await readTable(file);
  const imported = [];
  const seen = new Set();
  let nextId = Math.max(0, ...existing.map((major) => Number(major.id) || 0)) + 1;

  for (const row of rows) {
    const rawCode = normalizeCode(pick(row, ["专业代码", "code", "Code"]));
    const name = pick(row, ["专业名称", "name", "Name"]);
    if (!rawCode || !name) continue;
    if (seen.has(rawCode)) throw new Error(`Duplicate major code ${rawCode} at line ${row.__line}`);
    seen.add(rawCode);

    const prior = existingByCode.get(rawCode) || existingByName.get(name) || {};
    const discipline = pick(row, ["学科门类", "discipline", "Discipline"]) || prior.discipline || "待核验";
    const category = pick(row, ["专业类", "category", "Category"]) || prior.category || "待核验";
    const degree = pick(row, ["授予学位", "degree", "Degree"]) || prior.degree || `${discipline}学士`;
    const duration = pick(row, ["修业年限", "duration", "Duration"]) || prior.duration || "以学校培养方案为准";
    const isSpecial = truthy(pick(row, ["是否特设专业", "is_special", "special"])) || rawCode.includes("T");
    const isControlled = truthy(pick(row, ["是否国家控制布点专业", "is_controlled", "controlled"])) || rawCode.includes("K");
    const sourceNote = pick(row, ["来源说明", "source_note"]) || "教育部《普通高等学校本科专业目录》公开目录字段；非目录解释性内容需另行核验。";

    const major = {
      id: prior.id || nextId++,
      code: rawCode,
      slug: prior.slug || slugifyAscii(pick(row, ["slug", "Slug", "英文slug"]), `major-${rawCode.toLowerCase().replace(/[^a-z0-9]/g, "")}`),
      name,
      category,
      discipline,
      degree,
      duration,
      is_special: isSpecial,
      is_controlled: isControlled,
      description: prior.description || "",
      core_courses: prior.core_courses || [],
      career_directions: prior.career_directions || [],
      postgraduate_directions: prior.postgraduate_directions || [],
      suitable_personality: prior.suitable_personality || [],
      unsuitable_personality: prior.unsuitable_personality || [],
      skill_requirements: prior.skill_requirements || [],
      fit_tags: prior.fit_tags || [],
      civil_service_fit: prior.civil_service_fit || "待补充：需结合公务员职位表和公开岗位专业目录判断。",
      ai_risk: prior.ai_risk || "待补充：需结合职业任务、行业报告和AI工具发展趋势判断。",
      future_trend: prior.future_trend || "待补充：需结合公开产业政策、就业质量报告和高校培养方案判断。",
      ai_summary: prior.ai_summary || defaultMajorSummary({ name, discipline, category }),
      faq_json: prior.faq_json || [],
      source_note: sourceNote,
      source_urls: prior.source_urls || []
    };
    imported.push(major);
  }

  imported.sort((left, right) => left.code.localeCompare(right.code, "zh-Hans-CN"));
  return imported;
};

const importUniversities = async (file) => {
  const existing = await readJson("universities.json");
  const existingByCode = new Map(existing.filter((item) => item.moe_code).map((item) => [item.moe_code, item]));
  const existingByName = new Map(existing.map((item) => [item.name, item]));
  const rows = await readTable(file);
  const imported = [];
  const seen = new Set();
  let nextId = Math.max(0, ...existing.map((university) => Number(university.id) || 0)) + 1;

  for (const row of rows) {
    const moeCode = pick(row, ["学校标识码", "moe_code", "MoeCode", "code"]);
    const name = pick(row, ["学校名称", "name", "Name"]);
    if (!moeCode || !name) continue;
    if (seen.has(moeCode)) throw new Error(`Duplicate university code ${moeCode} at line ${row.__line}`);
    seen.add(moeCode);

    const prior = existingByCode.get(moeCode) || existingByName.get(name) || {};
    const rawLocation = pick(row, ["所在地", "所在省市", "province", "location", "Location"]) || prior.province || "";
    const province = stripProvinceSuffix(pick(row, ["省份", "province", "Province"]) || rawLocation);
    const city = stripProvinceSuffix(pick(row, ["城市", "city", "City"]) || (municipality.has(province) ? province : rawLocation));
    const level = pick(row, ["办学层次", "level", "Level"]) || prior.level || "";
    const authority = pick(row, ["主管部门", "authority", "Authority"]) || prior.authority || "";
    const ownershipRaw = pick(row, ["备注", "公办/民办", "ownership", "Ownership"]) || prior.ownership || "";
    const ownership = ownershipRaw.includes("民办") ? "民办" : ownershipRaw.includes("中外") ? "中外合作办学" : ownershipRaw.includes("内地") ? ownershipRaw : prior.ownership || "公办";
    const type = pick(row, ["办学类型", "type", "Type"]) || prior.type || "待补充";
    const sourceNote = pick(row, ["来源说明", "source_note"]) || "教育部全国高等学校名单公开字段；院校标签、官网和招生入口需用阳光高考院校库及学校官网复核。";

    const university = {
      id: prior.id || nextId++,
      moe_code: moeCode,
      slug: prior.slug || slugifyAscii(pick(row, ["slug", "Slug", "英文slug"]), `university-${moeCode}`),
      name,
      province: province || rawLocation || "待核验",
      city: city || province || "待核验",
      level,
      type,
      ownership,
      authority,
      tags: prior.tags || [],
      website: prior.website || pick(row, ["官网", "website", "Website"]),
      admission_site: prior.admission_site || pick(row, ["招生官网", "admission_site", "AdmissionSite"]),
      description: prior.description || "",
      source_note: sourceNote
    };
    university.description ||= defaultUniversityDescription(university);
    imported.push(university);
  }

  imported.sort((left, right) => left.moe_code.localeCompare(right.moe_code, "zh-Hans-CN"));
  return imported;
};

const referenceMaps = async () => {
  const majors = await readJson("majors.json");
  const universities = await readJson("universities.json");
  return {
    majorById: new Map(majors.map((major) => [String(major.id), major])),
    majorByCode: new Map(majors.map((major) => [normalizeCode(major.code), major])),
    majorByName: new Map(majors.map((major) => [major.name, major])),
    universityById: new Map(universities.map((university) => [String(university.id), university])),
    universityByCode: new Map(universities.filter((university) => university.moe_code).map((university) => [String(university.moe_code), university])),
    universityByName: new Map(universities.map((university) => [university.name, university]))
  };
};

const resolveMajor = (row, maps) => {
  const id = pick(row, ["major_id", "专业ID"]);
  const code = normalizeCode(pick(row, ["专业代码", "major_code", "code"]));
  const name = pick(row, ["专业", "专业名称", "major_name", "name"]);
  return maps.majorById.get(id) || maps.majorByCode.get(code) || maps.majorByName.get(name);
};

const resolveUniversity = (row, maps) => {
  const id = pick(row, ["university_id", "院校ID"]);
  const code = pick(row, ["学校标识码", "院校代码", "moe_code", "university_code"]);
  const name = pick(row, ["学校", "院校", "学校名称", "university_name", "name"]);
  return maps.universityById.get(id) || maps.universityByCode.get(String(code)) || maps.universityByName.get(name);
};

const rowSourceNote = (row, fallback) => pick(row, ["来源说明", "source_note", "SourceNote"]) || fallback;
const allowedScoreGrains = new Set(["major", "major_group", "university_major_group", "university"]);
const normalizeScoreGrain = (value, province) => {
  const raw = String(value || "").trim().toLowerCase();
  if (allowedScoreGrains.has(raw)) return raw;
  if (/专业组|院校专业组|group/i.test(raw)) return "university_major_group";
  if (/学校|院校$/i.test(raw)) return "university";
  if (["广东", "上海"].includes(province)) return "university_major_group";
  return "major";
};

const importAdmissionPlans = async (file) => {
  const maps = await referenceMaps();
  const rows = await readTable(file);
  const imported = [];

  for (const row of rows) {
    const university = resolveUniversity(row, maps);
    const major = resolveMajor(row, maps);
    const year = toInt(pick(row, ["年份", "year", "Year"]));
    const province = pick(row, ["省份", "province", "Province"]);
    if (!university || !major || !year || !province) {
      throw new Error(`Admission plan line ${row.__line} cannot resolve required year/province/university/major`);
    }
    imported.push({
      id: imported.length + 1,
      year,
      province,
      university_id: university.id,
      major_id: major.id,
      batch: pick(row, ["批次", "batch", "Batch"]),
      subject_group: pick(row, ["科类/选科组合", "选科组合", "科类", "subject_group", "SubjectGroup"]),
      plan_count: toInt(pick(row, ["招生计划数", "计划数", "plan_count", "PlanCount"])),
      tuition: toInt(pick(row, ["学费", "tuition", "Tuition"])),
      campus: pick(row, ["校区", "campus", "Campus"]),
      remarks: pick(row, ["专业备注", "备注", "remarks", "Remarks"]),
      source_note: rowSourceNote(row, "省教育考试院、高校招生网或阳光高考公开招生计划字段；导入前需保留原始公开文件URL和发布日期。")
    });
  }
  return imported;
};

const importAdmissionScores = async (file) => {
  const maps = await referenceMaps();
  const rows = await readTable(file);
  const imported = [];

  for (const row of rows) {
    const university = resolveUniversity(row, maps);
    const major = resolveMajor(row, maps);
    const year = toInt(pick(row, ["年份", "year", "Year"]));
    const province = pick(row, ["省份", "province", "Province"]);
    const dataGrain = normalizeScoreGrain(pick(row, ["数据颗粒度", "颗粒度", "data_grain", "DataGrain"]), province);
    if (!university || !year || !province) {
      throw new Error(`Admission score line ${row.__line} cannot resolve required year/province/university`);
    }
    if (dataGrain === "major" && !major) {
      throw new Error(`Admission score line ${row.__line} is major-grain data but cannot resolve major`);
    }
    imported.push({
      id: imported.length + 1,
      year,
      province,
      university_id: university.id,
      major_id: major ? major.id : null,
      data_grain: dataGrain,
      major_group_code: pick(row, ["专业组代码", "院校专业组代码", "major_group_code", "MajorGroupCode"]),
      major_group_name: pick(row, ["专业组名称", "院校专业组名称", "major_group_name", "MajorGroupName"]),
      batch: pick(row, ["批次", "batch", "Batch"]),
      subject_group: pick(row, ["科类/选科组合", "选科组合", "科类", "subject_group", "SubjectGroup"]),
      min_score: toInt(pick(row, ["最低分", "min_score", "MinScore"])),
      min_rank: toInt(pick(row, ["最低位次", "最低名次", "最低排位", "min_rank", "MinRank"])),
      avg_score: toInt(pick(row, ["平均分", "avg_score", "AvgScore"])),
      max_score: toInt(pick(row, ["最高分", "max_score", "MaxScore"])),
      plan_count: toInt(pick(row, ["计划数", "招生计划数", "plan_count", "PlanCount"])),
      source_url: pick(row, ["来源URL", "source_url", "SourceUrl"]),
      published_at: pick(row, ["发布日期", "published_at", "PublishedAt"]),
      source_note: rowSourceNote(row, "省教育考试院投档线/录取分数线或高校招生网公开历史录取数据；仅用于历史参考区间，不承诺录取概率。")
    });
  }
  return imported;
};

const outputs = [];
const report = {
  generated_at: new Date().toISOString(),
  applied: apply,
  inputs: {},
  outputs: []
};

if (majorsFile) {
  const majors = await importMajors(majorsFile);
  const file = apply ? path.join(dataDir, "majors.json") : path.join(generatedDir, "majors.imported.json");
  await writeJson(file, majors);
  outputs.push(`${majors.length} majors -> ${path.relative(root, file)}`);
  report.inputs.majors = await fileMeta(majorsFile);
  report.outputs.push({ type: "majors", count: majors.length, path: path.relative(root, file) });
}

if (universitiesFile) {
  const universities = await importUniversities(universitiesFile);
  const file = apply ? path.join(dataDir, "universities.json") : path.join(generatedDir, "universities.imported.json");
  await writeJson(file, universities);
  outputs.push(`${universities.length} universities -> ${path.relative(root, file)}`);
  report.inputs.universities = await fileMeta(universitiesFile);
  report.outputs.push({ type: "universities", count: universities.length, path: path.relative(root, file) });
}

if (plansFile) {
  const plans = await importAdmissionPlans(plansFile);
  const file = apply ? path.join(dataDir, "admission_plans.json") : path.join(generatedDir, "admission_plans.imported.json");
  await writeJson(file, plans);
  outputs.push(`${plans.length} admission plans -> ${path.relative(root, file)}`);
  report.inputs.admission_plans = await fileMeta(plansFile);
  report.outputs.push({ type: "admission_plans", count: plans.length, path: path.relative(root, file) });
}

if (scoresFile) {
  const scores = await importAdmissionScores(scoresFile);
  const file = apply ? path.join(dataDir, "admission_scores.json") : path.join(generatedDir, "admission_scores.imported.json");
  await writeJson(file, scores);
  outputs.push(`${scores.length} admission scores -> ${path.relative(root, file)}`);
  report.inputs.admission_scores = await fileMeta(scoresFile);
  report.outputs.push({ type: "admission_scores", count: scores.length, path: path.relative(root, file) });
}

const reportFile = apply ? path.join(dataDir, "import_manifest.json") : path.join(generatedDir, "import-report.json");
await writeJson(reportFile, report);

console.log(`Imported public data preview${apply ? " and applied" : ""}:`);
for (const output of outputs) console.log(`- ${output}`);
console.log(`- report -> ${path.relative(root, reportFile)}`);
