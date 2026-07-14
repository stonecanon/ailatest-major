import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const sourceUrl = "https://www.ncss.cn/ncss/zt/jyzlbg2024.shtml";
const outputName = "employment_quality_reports_2024.json";

const readJson = async (name, fallback = null) => {
  try {
    return JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));
  } catch {
    return fallback;
  }
};

const cleanText = (value = "") => value
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, " ")
  .trim();

const fetchIndexHtml = async () => {
  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "majorAI public-source-import/0.1 (+https://major.ailatest.org/data-sources/)",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.7"
    }
  });
  if (!response.ok) throw new Error(`Failed to fetch NCSS employment reports page: HTTP ${response.status}`);
  return response.text();
};

const existingPayload = await readJson(outputName, { reports: [] });
const existingByKey = new Map();
for (const report of existingPayload.reports || []) {
  const key = `${report.university_name || ""}|${report.original_url_text || report.report_url || ""}`;
  existingByKey.set(key, report);
}

let html;
try {
  html = await fetchIndexHtml();
  await fs.writeFile(path.join(root, "ncss-jyzlbg2024.html"), html, "utf8");
} catch (error) {
  html = await fs.readFile(path.join(root, "ncss-jyzlbg2024.html"), "utf8");
  console.warn(`Using local NCSS snapshot because live fetch failed: ${error.message}`);
}

const universities = await readJson("universities.json", []);
const universityByName = new Map(universities.map((item) => [item.name, item]));
const reports = [];
const seen = new Set();

for (const block of html.matchAll(/<div class="province" id="([^"]+)">([\s\S]*?)(?=<div class="province" id=|<\/body>|<script)/g)) {
  const province = cleanText(block[1]);
  for (const anchor of block[2].matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const originalUrl = anchor[1].trim();
    const universityName = cleanText(anchor[2]);
    if (!universityName || originalUrl.startsWith("#")) continue;
    const key = `${universityName}|${originalUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const university = universityByName.get(universityName);
    const isUsableUrl = /^https?:\/\//i.test(originalUrl) && !originalUrl.includes("***");
    const existing = existingByKey.get(key) || {};
    reports.push({
      ...existing,
      id: reports.length + 1,
      university_id: university?.id ?? existing.university_id ?? null,
      university_name: universityName,
      university_slug: university?.slug ?? existing.university_slug ?? null,
      province,
      year: 2024,
      cohort: "2024届毕业生",
      report_title: `${universityName}2024届毕业生就业质量报告`,
      report_url: isUsableUrl ? originalUrl : null,
      original_url_text: originalUrl,
      url_status: isUsableUrl ? "可访问入口" : "原专题页链接不可用或被打码",
      source_name: "全国大学生就业服务平台：全国本科院校2024届毕业生就业质量报告",
      source_url: sourceUrl,
      source_note: "NCSS专题页集中整理各本科院校2024届毕业生就业质量报告入口；本站缓存公开材料仅用于结构化摘要，不转载报告正文或PDF内容。"
    });
  }
}

const matched = reports.filter((item) => item.university_id).length;
const usable = reports.filter((item) => item.report_url).length;
const payload = {
  ...existingPayload,
  source_name: "全国本科院校2024届毕业生就业质量报告",
  source_url: sourceUrl,
  fetched_at: new Date().toISOString(),
  total: reports.length,
  matched_universities: matched,
  usable_report_urls: usable,
  reports
};

await fs.writeFile(path.join(dataDir, outputName), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Imported ${reports.length} NCSS report links; matched ${matched}; usable URLs ${usable}.`);
