import fs from "node:fs/promises";

const path = "data/university_rankings.json";
const sourcesPath = "data/sources.json";
const usNewsUrl = "https://www.usnews.com/education/best-global-universities/china";
const releaseUrl = "https://clarivate.com/news/u-s-news-releases-2025-2026-best-global-universities-rankings/";
const mirrorUrl = "https://en.wikipedia.org/wiki/Rankings_of_universities_in_China#US_News_Best_Global_Universities_Ranking";
const note = "综合公开榜单信号；U.S. News Best Global Universities 2025-2026 排名仅作为公开研究声誉、论文表现和国际比较参考，不等同于专业实力、录取难度或志愿推荐结论。";

const updates = [
  ["清华大学", 11],
  ["北京大学", 25],
  ["浙江大学", 45],
  ["上海交通大学", 46],
  ["中国科学院大学", 54],
  ["复旦大学", 70],
  ["中国科学技术大学", 71],
  ["中山大学", 85],
  ["南京大学", 86],
  ["武汉大学", 90],
  ["华中科技大学", 91],
  ["湖南大学", 109],
  ["南方科技大学", 123],
  ["同济大学", 124],
  ["哈尔滨工业大学", 128],
  ["电子科技大学", 137],
  ["西安交通大学", 141],
  ["中南大学", 146],
  ["东南大学", 155],
  ["北京理工大学", 156],
  ["深圳大学", 156],
  ["南开大学", 166],
  ["华南理工大学", 166],
  ["北京师范大学", 173],
  ["四川大学", 182],
  ["天津大学", 182],
  ["厦门大学", 189],
  ["中国农业大学", 202],
  ["郑州大学", 203],
  ["北京航空航天大学", 207],
  ["西北工业大学", 207],
  ["中国地质大学（武汉）", 211],
  ["重庆大学", 212],
  ["华东师范大学", 230],
  ["山东大学", 238],
  ["武汉理工大学", 260],
  ["大连理工大学", 261],
  ["江苏大学", 271],
  ["西北农林科技大学", 288],
  ["苏州大学", 292],
  ["吉林大学", 296],
  ["上海大学", 296],
  ["南京农业大学", 302],
  ["西湖大学", 308],
  ["北京化工大学", 319],
  ["上海科技大学", 330]
];

const rankings = JSON.parse(await fs.readFile(path, "utf8"))
  .filter((item) => !/^\?+$/.test(item.name));

const byName = new Map(rankings.map((item) => [item.name, item]));
for (const [name, rank] of updates) {
  let item = byName.get(name);
  if (!item) {
    item = { name, rankings: {}, source_note: note, source_urls: [] };
    rankings.push(item);
    byName.set(name, item);
  }
  item.rankings ||= {};
  item.rankings.usnews_2025_2026_world = rank;
  item.source_note = note;
  item.source_urls = [...new Set([
    ...(Array.isArray(item.source_urls) ? item.source_urls : []),
    usNewsUrl,
    releaseUrl,
    mirrorUrl
  ])];
}

rankings.sort((a, b) => {
  const ar = a.rankings?.ruanke_2026_cn ?? a.rankings?.ruanke_2025_cn ?? 9999;
  const br = b.rankings?.ruanke_2026_cn ?? b.rankings?.ruanke_2025_cn ?? 9999;
  const au = a.rankings?.usnews_2025_2026_world ?? 9999;
  const bu = b.rankings?.usnews_2025_2026_world ?? 9999;
  return ar - br || au - bu || a.name.localeCompare(b.name, "zh-Hans-CN");
});

await fs.writeFile(path, `${JSON.stringify(rankings, null, 2)}\n`, "utf8");

const sources = JSON.parse(await fs.readFile(sourcesPath, "utf8"));
const rankingSource = sources.find((source) => source.id === "public-university-rankings");
if (rankingSource) {
  rankingSource.url = usNewsUrl;
  rankingSource.notes = "已同步 U.S. News Best Global Universities 2025-2026 中国高校公开排名信号；不同榜单指标差异很大。页面排序优先解决“不要按拼音浏览”的体验问题，正式报考仍需结合专业、城市、招生计划、位次、就业质量报告和学校政策。";
}
await fs.writeFile(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`, "utf8");

console.log(`Updated ${updates.length} U.S. News rankings; total ranking records: ${rankings.length}`);
