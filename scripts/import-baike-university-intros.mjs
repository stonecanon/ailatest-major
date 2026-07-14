import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const rawDir = path.join(root, "raw");

const readJson = async (name) => JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));
const writeJson = async (name, value) => {
  await fs.writeFile(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const decodeHtml = (value = "") => value
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'");

const clean = (value = "") => decodeHtml(value)
  .replace(/[\r\n\t]+/g, " ")
  .replace(/\s+/g, " ")
  .replace(/_百度百科$/, "")
  .trim();

const fetchBaikeText = async (name) => {
  const url = `https://baike.baidu.com/item/${encodeURIComponent(name)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; ZhituDataBot/0.1)",
        "accept": "text/html,application/xhtml+xml"
      }
    });
    if (!response.ok) return { url, text: "" };
    const html = await response.text();
    const meta = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1] || "";
    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "";
    const text = clean(meta || title);
    return { url, text };
  } catch {
    return { url, text: "" };
  } finally {
    clearTimeout(timer);
  }
};

const extractFacts = (text) => {
  const founded = text.match(/(?:始建|创建|创办|创立|成立|前身可追溯至)[^0-9一二三四五六七八九十百]{0,12}(\d{4})年/)?.[1];
  const former = text.match(/前身(?:是|为|可追溯至)([^，。；]{4,36})/)?.[1];
  const direct = /教育部直属/.test(text) ? "教育部直属高校" : "";
  const type = /综合性/.test(text) ? "综合性大学" : /理工/.test(text) ? "理工类高校" : /师范/.test(text) ? "师范类高校" : /医科|医学/.test(text) ? "医药类高校" : "";
  return { founded, former, direct, type };
};

const rewriteIntro = (university, facts) => {
  const base = `${university.name}位于${[university.province, university.city].filter(Boolean).join("")}，${university.authority ? `由${university.authority}主管` : "主管部门待核验"}，办学层次为${university.level || "普通高等学校"}。`;
  const history = facts.founded
    ? `公开百科线索显示，学校办学源流可追溯至${facts.founded}年${facts.former ? `，前身与${facts.former}有关` : ""}。`
    : facts.former
      ? `公开百科线索显示，学校前身与${facts.former}有关。`
      : "学校沿革、学科特色和校区信息仍需回到学校官网、招生章程与公开校史材料核验。";
  const labels = [facts.direct, facts.type, ...(university.tags || [])].filter(Boolean).slice(0, 4);
  return `${base}${history}${labels.length ? `可重点核对的标签包括：${labels.join("、")}。` : ""}`;
};

const args = process.argv.slice(2);
const limitArg = args.find((arg) => arg.startsWith("--limit="));
const limit = Number(limitArg?.split("=")[1] || 30);
const offset = Number(args.find((arg) => arg.startsWith("--offset="))?.split("=")[1] || 0);

const universities = await readJson("universities.json");
const records = [];
let updated = 0;

await fs.mkdir(rawDir, { recursive: true });

for (const university of universities.slice(offset, offset + limit)) {
  const fetched = await fetchBaikeText(university.name);
  const facts = extractFacts(fetched.text);
  if (fetched.text && (facts.founded || facts.former || facts.direct || facts.type)) {
    university.description = rewriteIntro(university, facts);
    university.baike_intro_source_url = fetched.url;
    university.baike_intro_status = "百科线索已抽取，简介为本站改写";
    updated += 1;
  }
  records.push({ id: university.id, name: university.name, source_url: fetched.url, text: fetched.text, facts });
}

await fs.writeFile(path.join(rawDir, `baike-university-intros-${offset}-${offset + limit}.json`), `${JSON.stringify(records, null, 2)}\n`, "utf8");
await writeJson("universities.json", universities);

console.log(JSON.stringify({ offset, limit, updated }, null, 2));
