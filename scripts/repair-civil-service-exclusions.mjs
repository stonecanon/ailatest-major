import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");

const readJson = async (name) => JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));
const writeJson = async (name, value) => fs.writeFile(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");

const clean = (value = "") => String(value).replace(/\s+/g, "");
const normalizeCode = (value = "") => String(value).toUpperCase().replace(/[^0-9A-Z]/g, "");
const normalizeName = (value = "") => String(value).replace(/[（(].*?[）)]/g, "").trim();
const isBroadUnlimited = (text) => ["不限", "专业不限", "不限专业"].includes(clean(text));

const inferLevel = (count) => {
  if (count >= 300) return "很高";
  if (count >= 120) return "较高";
  if (count >= 40) return "中等";
  if (count >= 10) return "偏低";
  return "很少";
};

const buildLookup = (majors) => majors.map((major) => {
  const code = normalizeCode(major.code || "");
  const candidates = new Set([major.name, normalizeName(major.name || "")].filter(Boolean));
  return {
    id: major.id,
    slug: major.slug,
    name: major.name,
    code,
    code4: code.slice(0, 4),
    code2: code.slice(0, 2),
    category: major.category || "",
    discipline: major.discipline || "",
    candidates: [...candidates].sort((a, b) => b.length - a.length)
  };
});

const excludedByText = (text, item) => {
  const compact = clean(text);
  const keys = [item.name, ...item.candidates, item.code, item.code.replace(/[A-Z]+$/, "")].filter(Boolean);
  return keys.some((key) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:不含|不包括|不招|除外|排除)[^；;。]*${escaped}`).test(compact);
  });
};

const matchKind = (text, item) => {
  if (excludedByText(text, item)) return "";
  const codes = new Set([...text.matchAll(/\d{2,6}/g)].map((match) => match[0]));
  const codeDigits = item.code.replace(/[A-Z]+$/, "");
  if (item.code && codes.has(item.code)) return item.code;
  if (codeDigits && codes.has(codeDigits)) return codeDigits;
  if (item.code4 && codes.has(item.code4)) return item.code4;
  if (item.code2 && codes.has(item.code2) && item.discipline && text.includes(item.discipline)) return item.code2;
  if (item.candidates.some((candidate) => candidate && text.includes(candidate))) return item.name;
  if (item.category && text.includes(item.category)) return item.category;
  if (item.discipline && text.includes(`${item.discipline}类`)) return item.discipline;
  return "";
};

const classifyCounts = (stat, major) => {
  const digits = normalizeCode(major?.code || "").replace(/[A-Z]+$/, "");
  const exactKeys = new Set([stat.major_name, major?.name, major?.code, digits].filter(Boolean));
  let direct = 0;
  let category = 0;
  let unrestricted = 0;
  for (const item of stat.matched_keywords || []) {
    if (item.keyword === "不限") unrestricted += item.count || 0;
    else if (exactKeys.has(item.keyword)) direct += item.count || 0;
    else category += item.count || 0;
  }
  stat.direct_match_count = direct;
  stat.category_match_count = category;
  stat.unrestricted_match_count = unrestricted;
  const topBroad = (stat.matched_keywords || []).find((item) => item.keyword !== stat.major_name && item.keyword !== digits);
  stat.match_scope_note = category + unrestricted > direct * 2 && (category + unrestricted) > 20
    ? `主要来自“${topBroad?.keyword || major?.category || "专业类"}”等专业类/不限口径，不是${stat.major_name}专属岗位。`
    : "包含专业名称、代码、专业类和不限岗位的粗匹配。";
};

const createBaseStat = (major, provinceMode) => ({
  major_id: major.id,
  major_slug: major.slug,
  major_name: major.name,
  matched_position_count: 0,
  matched_plan_count: 0,
  ...(provinceMode ? { year_counts: {} } : { main_position_count: 0, supplemental_position_count: 0 }),
  sample_positions: [],
  matched_keywords: new Map()
});

const addKeyword = (stat, keyword) => {
  stat.matched_keywords.set(keyword, (stat.matched_keywords.get(keyword) || 0) + 1);
};

const finalize = (stats, total, majorById) => [...stats.values()]
  .filter((stat) => stat.matched_position_count)
  .map((stat) => {
    stat.position_share = total ? Number((stat.matched_position_count / total).toFixed(6)) : 0;
    stat.position_share_percent = Number((stat.position_share * 100).toFixed(2));
    stat.feasibility_level = inferLevel(stat.matched_position_count);
    stat.matched_keywords = [...stat.matched_keywords.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));
    classifyCounts(stat, majorById.get(stat.major_id));
    return stat;
  })
  .sort((a, b) => b.matched_position_count - a.matched_position_count || a.major_name.localeCompare(b.major_name, "zh-Hans-CN"));

const repair = async (name, provinceMode = false) => {
  const majors = await readJson("majors.json");
  const majorById = new Map(majors.map((major) => [major.id, major]));
  const lookup = buildLookup(majors);
  const payload = await readJson(name);
  const stats = new Map(majors.map((major) => [major.id, createBaseStat(major, provinceMode)]));

  for (const position of payload.positions || []) {
    const text = position.specialty || "";
    const matched = new Map();
    if (isBroadUnlimited(text)) {
      for (const item of lookup) {
        if (!excludedByText(text, item)) matched.set(item.id, "不限");
      }
    } else {
      for (const item of lookup) {
        const keyword = matchKind(text, item);
        if (keyword) matched.set(item.id, keyword);
      }
    }
    for (const [majorId, keyword] of matched.entries()) {
      const stat = stats.get(majorId);
      stat.matched_position_count += 1;
      stat.matched_plan_count += position.plan_count || 0;
      addKeyword(stat, keyword);
      if (provinceMode) {
        const year = String(position.year || "");
        stat.year_counts[year] = (stat.year_counts[year] || 0) + 1;
        if (stat.sample_positions.length < 8) {
          stat.sample_positions.push({
            year: position.year,
            unit: position.unit,
            position_name: position.position_name,
            position_category: position.position_category,
            plan_count: position.plan_count,
            education: position.education,
            specialty: position.specialty
          });
        }
      } else {
        if (position.source_kind === "main") stat.main_position_count += 1;
        else stat.supplemental_position_count += 1;
        if (stat.sample_positions.length < 8) {
          stat.sample_positions.push({
            department: position.department,
            bureau: position.bureau,
            position_name: position.position_name,
            plan_count: position.plan_count,
            education: position.education,
            specialty: position.specialty,
            work_location: position.work_location,
            source_kind: position.source_kind
          });
        }
      }
    }
  }
  payload.major_stats = finalize(stats, (payload.positions || []).length, majorById);
  await writeJson(name, payload);
  return { file: name, majors: payload.major_stats.length };
};

const result = [
  await repair("civil_service_positions_2026.json", false),
  await repair("civil_service_positions_zhejiang_2023_2025.json", true)
];

console.log(JSON.stringify(result, null, 2));
