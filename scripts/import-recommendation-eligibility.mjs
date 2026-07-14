import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const sourceUrl = "https://www.gaokzx.com/gk/gaokao/146800.html";
const chsiTmUrl = "https://yz.chsi.com.cn/tm/";
const moeNoticeMirrorUrl = "https://www.chinazy.org/info/1014/20431.htm";

const readJson = async (name) => JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));
const cleanText = (value = "") => value
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const response = await fetch(sourceUrl, {
  headers: {
    "User-Agent": "majorAI public-source-import/0.1 (+https://major.ailatest.org/data-sources/)"
  }
});
if (!response.ok) throw new Error(`Failed to fetch recommendation eligibility page: HTTP ${response.status}`);

const html = await response.text();
const text = cleanText(html);
const universities = await readJson("universities.json");
const universityByName = new Map(universities.map((item) => [item.name, item]));
const provincePattern = "北京|天津|河北|山西|内蒙古|辽宁|吉林|黑龙江|上海|江苏|浙江|安徽|福建|江西|山东|河南|湖北|湖南|广东|广西|海南|重庆|四川|贵州|云南|西藏|陕西|甘肃|青海|宁夏|新疆";

const marker = "序号 学校名称 省份 双一流";
const listText = text.slice(text.indexOf(marker) + marker.length);
const rowRe = new RegExp(`(\\d{1,3})\\s+(.+?)\\s+(${provincePattern})\\s+(是|否)`, "g");
const rows = [];
for (const match of listText.matchAll(rowRe)) {
  rows.push({
    sequence: Number(match[1]),
    name: match[2].trim(),
    province: match[3],
    double_first_class_in_source: match[4] === "是"
  });
}

if (rows.length !== 433) {
  throw new Error(`Expected 433 recommendation eligibility rows, got ${rows.length}`);
}

const firstAddedMarker = text.indexOf("2025年新增推免资格高校备案名单");
const addedStart = text.indexOf("2025年新增推免资格高校备案名单", firstAddedMarker + 1);
const addedEnd = text.indexOf("全国433所推免资格高校名单汇总", addedStart);
const addedText = addedStart >= 0 && addedEnd > addedStart ? text.slice(addedStart, addedEnd) : "";
const addedNames = new Set(rows.filter((row) => addedText.includes(row.name)).map((row) => row.name));

const output = rows.map((row, index) => {
  const university = universityByName.get(row.name);
  return {
    id: index + 1,
    university_id: university?.id ?? null,
    university_slug: university?.slug ?? null,
    university_name: row.name,
    province: row.province,
    eligibility: "有推免资格",
    status: addedNames.has(row.name) ? "2025新增备案" : "已列入433所名单",
    newly_added_2025: addedNames.has(row.name),
    double_first_class_in_source: row.double_first_class_in_source,
    basis: addedNames.has(row.name)
      ? "教育部办公厅2025年新增推免资格高校备案名单；同时列入全国433所推免资格高校汇总。"
      : "列入全国433所推免资格高校汇总；最终以研招网推免服务系统备案与学校当年推免办法、公示为准。",
    student_note: "学校有推免资格只是前提，不代表学生个人一定能保研；个人资格还要看学院名额、成绩排名、综合评价、专项计划和当年公示。",
    source_name: "全国433所推免资格高校名单汇总（2025年新增67所推免资格高校）",
    source_url: sourceUrl,
    extra_source_urls: [chsiTmUrl, moeNoticeMirrorUrl],
    source_note: "433所名单来自公开汇总页；2025新增67所对应教育部办公厅备案通知公开信息。推免生最终备案、录取和公示以研招网推免服务系统及学校公告为准。"
  };
}).filter((item) => item.university_id);

await fs.writeFile(
  path.join(dataDir, "university_recommendation_eligibility.json"),
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8"
);

const matched = output.filter((item) => item.university_id).length;
console.log(`Imported ${output.length} recommendation-eligible universities; matched ${matched}; 2025 added ${addedNames.size}.`);
