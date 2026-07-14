import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = process.env.BUILD_DIST ? path.resolve(process.env.BUILD_DIST) : path.join(root, "dist");
const dataDir = path.join(root, "data");
const indexNow = JSON.parse(await fs.readFile(path.join(dataDir, "indexnow.json"), "utf8"));

const requiredFiles = [
  "index.html",
  "sitemap.xml",
  "robots.txt",
  "llms.txt",
  "humans.txt",
  indexNow.key_file,
  "data/site-data.json",
  "majors/index.html",
  "universities/index.html",
  "universities/cooperation/index.html",
  "progression/index.html",
  "planner/index.html",
  "about/index.html",
  "data-sources/index.html",
  "methodology/index.html",
  "contact/index.html",
  "privacy/index.html",
  "terms/index.html",
  "editorial-policy/index.html",
  "login/index.html",
  "favorites/index.html",
  "major/artificial-intelligence/index.html",
  "major/embodied-intelligence/index.html",
  "topics/ai-majors-2026/index.html",
  "share/zhejiang-80-volunteer-ranking/index.html",
  "share/ai-hot-majors-guide/index.html",
  "share/rank-data-explained/index.html",
  "share/xiaohongshu-ai-major-choice/index.html",
  "share/zhihu-zhejiang-80-volunteer-order/index.html",
  "comparison/artificial-intelligence-vs-computer-science/index.html",
  "admissions/charters/index.html",
  "admissions/match/index.html",
  "admissions/rank-lines/index.html",
  "admissions/rank-sources/index.html",
  "transfer-major/index.html",
  "feedback/index.html",
  "sources/index.html"
];

const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};

for (const file of requiredFiles) {
  try {
    await fs.access(path.join(dist, file));
  } catch {
    fail(`Missing launch file: ${path.relative(root, path.join(dist, file))}`);
  }
}

const read = async (file) => fs.readFile(path.join(dist, file), "utf8");
const index = await read("index.html");
const sitemap = await read("sitemap.xml");
const robots = await read("robots.txt");
const indexNowKey = await read(indexNow.key_file);
const siteData = JSON.parse(await read("data/site-data.json"));

const requiredText = [
  "知途",
  "中外合作办学库",
  "搜索专业",
  "志愿优化",
  "查投档线",
  "人工智能",
  "具身智能",
  "不承诺录取概率",
  "数据来源"
];

for (const text of requiredText) {
  if (!index.includes(text) && !sitemap.includes(text)) fail(`Missing expected launch text: ${text}`);
}

const requiredUrls = [
  "https://major.ailatest.org/",
  "https://major.ailatest.org/majors/",
  "https://major.ailatest.org/universities/",
  "https://major.ailatest.org/universities/cooperation/",
  "https://major.ailatest.org/progression/",
  "https://major.ailatest.org/planner/",
  "https://major.ailatest.org/about/",
  "https://major.ailatest.org/data-sources/",
  "https://major.ailatest.org/methodology/",
  "https://major.ailatest.org/contact/",
  "https://major.ailatest.org/privacy/",
  "https://major.ailatest.org/terms/",
  "https://major.ailatest.org/editorial-policy/",
  "https://major.ailatest.org/login/",
  "https://major.ailatest.org/favorites/",
  "https://major.ailatest.org/major/artificial-intelligence/",
  "https://major.ailatest.org/topics/ai-majors-2026/",
  "https://major.ailatest.org/share/zhejiang-80-volunteer-ranking/",
  "https://major.ailatest.org/share/ai-hot-majors-guide/",
  "https://major.ailatest.org/share/rank-data-explained/",
  "https://major.ailatest.org/share/xiaohongshu-ai-major-choice/",
  "https://major.ailatest.org/share/zhihu-zhejiang-80-volunteer-order/",
  "https://major.ailatest.org/admissions/charters/",
  "https://major.ailatest.org/admissions/rank-sources/",
  "https://major.ailatest.org/transfer-major/",
  "https://major.ailatest.org/feedback/"
];

for (const url of requiredUrls) {
  if (!sitemap.includes(url)) fail(`Sitemap missing ${url}`);
}

if (!robots.includes("Sitemap: https://major.ailatest.org/sitemap.xml")) {
  fail("robots.txt missing sitemap reference");
}

if (indexNowKey.trim() !== indexNow.key) {
  fail("IndexNow key file does not match data/indexnow.json");
}

if (!Array.isArray(siteData.majors) || siteData.majors.length < 18) {
  fail("site-data.json does not include the current major set");
}

if (siteData.majors.some((major) => !major.source_note)) {
  fail("A major is missing source_note");
}

if (!process.exitCode) {
  console.log(`Launch verification passed: ${siteData.majors.length} majors, ${siteData.universities.length} universities.`);
}
