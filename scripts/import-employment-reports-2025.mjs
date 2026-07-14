import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const eolUrl = "https://news.eol.cn/dongtai/jiuye/index_5.shtml";

const readJson = async (name) => JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));
const cleanText = (value = "") => value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const absoluteUrl = (href) => new URL(href, eolUrl).href;

const knownNames = [
  "南方科技大学",
  "宁波大学",
  "西交利物浦大学",
  "北师香港浸会大学",
  "香港中文大学（深圳）",
  "香港中文大学(深圳)",
  "昆山杜克大学",
  "杭州电子科技大学",
  "西安电子科技大学",
  "同济大学",
  "北京邮电大学",
  "上海科技大学",
  "西安交通大学"
];

const aliases = new Map([
  ["北师香港浸会大学", "北京师范大学-香港浸会大学联合国际学院"],
  ["香港中文大学(深圳)", "香港中文大学（深圳）"]
]);

const response = await fetch(eolUrl, {
  headers: {
    "User-Agent": "majorAI public-source-import/0.1 (+https://major.ailatest.org/data-sources/)"
  }
});
if (!response.ok) throw new Error(`Failed to fetch EOL employment report list: HTTP ${response.status}`);

const html = await response.text();
const universities = await readJson("universities.json");
const universityByName = new Map(universities.map((item) => [item.name, item]));
const records = [];
const seen = new Set();

for (const anchor of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
  const text = cleanText(anchor[2]);
  if (!text.includes("2025")) continue;
  const rawName = knownNames.find((name) => text.includes(name));
  if (!rawName) continue;
  const universityName = aliases.get(rawName) || rawName;
  const university = universityByName.get(universityName);
  const key = `${universityName}|${anchor[1]}`;
  if (seen.has(key)) continue;
  seen.add(key);
  records.push({
    id: records.length + 1,
    university_id: university?.id ?? null,
    university_slug: university?.slug ?? null,
    university_name: universityName,
    year: 2025,
    cohort: "2025届毕业生",
    report_title: text,
    report_url: absoluteUrl(anchor[1]),
    source_name: "中国教育在线：就业质量报告栏目",
    source_url: eolUrl,
    source_note: "中国教育在线就业质量报告栏目集中索引部分高校2025届就业质量报告或就业去向数据；本站只保存入口链接和标题，不转载正文。"
  });
}

const tsinghua = universityByName.get("清华大学");
records.unshift({
  id: 1,
  university_id: tsinghua?.id ?? null,
  university_slug: tsinghua?.slug ?? null,
  university_name: "清华大学",
  year: 2025,
  cohort: "2025届毕业生",
  report_title: "清华毕业生都去哪儿了？最新数据公布",
  report_url: "https://www.tsinghua.edu.cn/info/1182/124548.htm",
  source_name: "清华大学新闻网",
  source_url: "https://www.tsinghua.edu.cn/info/1182/124548.htm",
  source_note: "清华大学官网发布2025届毕业生就业质量报告相关数据；页面披露重点单位就业、京外就业、行业流向和出国（境）深造比例等信息。"
});

records.forEach((record, index) => { record.id = index + 1; });

await fs.writeFile(path.join(dataDir, "employment_quality_reports_2025.json"), `${JSON.stringify({
  source_name: "2025届毕业生就业质量报告公开入口",
  source_url: eolUrl,
  total: records.length,
  matched_universities: records.filter((item) => item.university_id).length,
  reports: records
}, null, 2)}\n`, "utf8");

console.log(`Imported ${records.length} 2025 employment report links.`);
