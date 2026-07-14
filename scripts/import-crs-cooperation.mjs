import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = path.join(root, "raw");
const dataDir = path.join(root, "data");
const baseUrl = "https://www.crs.jsj.edu.cn";

const provinces = [
  ["北京", 1],
  ["上海", 2],
  ["天津", 3],
  ["重庆", 4],
  ["江苏", 5],
  ["浙江", 6],
  ["广东", 7],
  ["海南", 8],
  ["福建", 9],
  ["山东", 10],
  ["江西", 11],
  ["四川", 12],
  ["安徽", 13],
  ["河北", 14],
  ["河南", 15],
  ["湖北", 16],
  ["湖南", 17],
  ["陕西", 18],
  ["山西", 19],
  ["黑龙江", 20],
  ["辽宁", 21],
  ["吉林", 22],
  ["广西", 23],
  ["云南", 24],
  ["贵州", 25],
  ["甘肃", 26],
  ["内蒙古", 27],
  ["宁夏", 28],
  ["新疆", 29],
  ["青海", 30],
  ["西藏", 31]
];

const independentLegalPersonNames = new Set([
  "宁波诺丁汉大学",
  "西交利物浦大学",
  "北京师范大学-香港浸会大学联合国际学院",
  "北京师范大学—香港浸会大学联合国际学院",
  "上海纽约大学",
  "昆山杜克大学",
  "香港中文大学（深圳）",
  "温州肯恩大学",
  "深圳北理莫斯科大学",
  "广东以色列理工学院"
]);

const readJson = async (name) => JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));

const decodeEntities = (text = "") => text
  .replaceAll("&nbsp;", " ")
  .replaceAll("&amp;", "&")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&quot;", "\"")
  .replaceAll("&#39;", "'");

const stripTags = (html = "") => decodeEntities(html)
  .replace(/<br\s*\/?\s*>/gi, "\n")
  .replace(/<[^>]+>/g, "")
  .replace(/\r/g, "")
  .replace(/[ \t\f\v]+/g, " ")
  .replace(/\n\s+/g, "\n")
  .trim();

const slugPart = (urlPath) => urlPath.replace(/^\/+/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");

const fetchOrRead = async (urlPath) => {
  await fs.mkdir(rawDir, { recursive: true });
  const rawPath = path.join(rawDir, `crs-${slugPart(urlPath)}.html`);
  try {
    const response = await fetch(`${baseUrl}${urlPath}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ZhiTu CRS data audit; +https://major.ailatest.org/data-sources/)",
        Accept: "text/html,application/xhtml+xml"
      }
    });
    if (response.ok) {
      const text = await response.text();
      if (text.includes("中外合作办学")) {
        await fs.writeFile(rawPath, text, "utf8");
        return text;
      }
    }
  } catch {
    // Fall through to cached raw file.
  }
  return fs.readFile(rawPath, "utf8");
};

const extractRows = (html) => [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
const extractCells = (row) => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => match[1]);

const extractEntries = (cellHtml) => {
  const liMatches = [...cellHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => match[1]);
  const chunks = liMatches.length ? liMatches : stripTags(cellHtml).split(/\n+/).filter(Boolean);
  return chunks
    .map((chunk) => {
      const text = stripTags(chunk);
      const approvalSymbols = [...new Set([...text.matchAll(/[▲●■]/g)].map((match) => match[0]))];
      const name = text.replace(/[▲●■]/g, " ").replace(/\s+/g, " ").trim();
      return { name, approvalSymbols };
    })
    .filter((entry) => entry.name && !["地区", "项目/机构", "名 称(含内地与港澳台)"].includes(entry.name));
};

const normalizeCategory = (category = "") => {
  if (category.includes("港澳台") && category.includes("项目")) return "内地与港澳台地区合作办学项目";
  if (category.includes("港澳台") && category.includes("机构")) return "内地与港澳台地区合作办学机构";
  if (category.includes("项目")) return "中外合作办学项目";
  if (category.includes("机构")) return "中外合作办学机构";
  return category || "未分类";
};

const approvalType = (symbols = []) => {
  if (symbols.includes("▲")) return "条例批准";
  if (symbols.includes("●")) return "暂行规定批准并复核";
  return "未标注";
};

const inferChinesePartner = (name, universities) => {
  const beforeYu = name.split("与")[0]?.trim();
  if (beforeYu && beforeYu.length >= 2 && beforeYu.length <= 30) return beforeYu;
  const match = universities.find((university) => name.includes(university.name));
  return match?.name || "";
};

const inferForeignPartner = (name) => {
  const match = name.match(/与(.+?)合作举办/);
  return match?.[1]?.trim() || "";
};

const legalPersonStatus = (name, category) => {
  if (category.includes("项目")) return "项目";
  const shortName = name.replace(/（[\s\S]*?）/g, "").trim();
  if (independentLegalPersonNames.has(shortName) || independentLegalPersonNames.has(name)) return "独立法人";
  if (category.includes("机构")) return "非独立法人";
  return "待核验";
};

const parseApprovalPage = ({ html, sourcePath, approvalAuthority, educationLevel, fallbackProvince = "" }, universities) => {
  const rows = extractRows(html);
  const records = [];
  let currentProvince = fallbackProvince;
  for (const row of rows) {
    const cells = extractCells(row);
    if (cells.length < 2) continue;
    const cleanCells = cells.map(stripTags).filter(Boolean);
    if (cleanCells.includes("地区") || cleanCells.join("").includes("平台首页")) continue;
    let province = currentProvince;
    let category = "";
    let listCell = "";
    if (cleanCells.length >= 3 && provinces.some(([name]) => name === cleanCells[0])) {
      province = cleanCells[0];
      currentProvince = province;
      category = cleanCells[1];
      listCell = cells[2];
    } else if (cleanCells.length >= 2) {
      category = cleanCells[0];
      listCell = cells[1];
    }
    category = normalizeCategory(category);
    if (!category.includes("合作办学")) continue;
    for (const entry of extractEntries(listCell)) {
      const record = {
        id: "",
        province,
        approval_authority: approvalAuthority,
        education_level: educationLevel,
        category,
        legal_person_status: legalPersonStatus(entry.name, category),
        name: entry.name,
        chinese_partner: inferChinesePartner(entry.name, universities),
        foreign_partner: inferForeignPartner(entry.name),
        approval_type: approvalType(entry.approvalSymbols),
        approval_symbols: entry.approvalSymbols,
        undergraduate_and_graduate: entry.approvalSymbols.includes("■"),
        status_note: /停止招生|已停办|已终止/.test(entry.name) ? "含停止招生/停办/终止标记，需报考前复核" : "",
        source_url: `${baseUrl}${sourcePath}`,
        source_title: approvalAuthority
      };
      records.push(record);
    }
  }
  return records;
};

const dedupeRecords = (records) => {
  const seen = new Map();
  for (const record of records) {
    const key = [
      record.approval_authority,
      record.education_level,
      record.province,
      record.category,
      record.name
    ].join("|");
    if (!seen.has(key)) seen.set(key, { ...record, id: `crs-${seen.size + 1}` });
  }
  return [...seen.values()];
};

const universities = await readJson("universities.json");
const pages = [
  {
    sourcePath: "/aproval/orglists/2",
    approvalAuthority: "教育部审批和复核",
    educationLevel: "本科"
  },
  {
    sourcePath: "/aproval/orglists/1",
    approvalAuthority: "教育部审批和复核",
    educationLevel: "硕士及以上"
  },
  ...provinces.map(([province, code]) => ({
    sourcePath: `/aproval/localbyarea/${code}`,
    approvalAuthority: "地方审批报教育部备案",
    educationLevel: "高等专科及地方备案",
    fallbackProvince: province
  }))
];

const records = [];
for (const page of pages) {
  const html = await fetchOrRead(page.sourcePath);
  records.push(...parseApprovalPage({ html, ...page }, universities));
}

const deduped = dedupeRecords(records);
const independentCount = deduped.filter((record) => record.legal_person_status === "独立法人").length;
const output = {
  updated_at: new Date().toISOString().slice(0, 10),
  source_pages: [
    {
      title: "教育部审批和复核的机构及项目名单",
      url: "https://www.crs.jsj.edu.cn/index/sort/1006",
      update_note: "页面标注为2026年5月25日更新"
    },
    {
      title: "由地方审批报教育部备案的机构及项目名单",
      url: "https://www.crs.jsj.edu.cn/index/sort/1008",
      update_note: "页面标注为2026年3月20日更新"
    }
  ],
  schema_note: "legal_person_status 由项目/机构类别和独立法人院校名单派生；非独立法人机构报考前仍需打开教育部原页面复核。",
  total_records: deduped.length,
  independent_legal_person_records: independentCount,
  records: deduped
};

await fs.writeFile(path.join(dataDir, "sino_foreign_cooperation.json"), JSON.stringify(output, null, 2), "utf8");
console.log(`Imported ${deduped.length} CRS cooperation records, independent legal-person records: ${independentCount}.`);
