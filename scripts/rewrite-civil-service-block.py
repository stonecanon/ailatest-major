from pathlib import Path

file = Path("scripts/build.mjs")
text = file.read_text(encoding="utf-8")
start = text.index("const civilServiceRows = ")
end = text.index("const allEmploymentReports = ", start)

block = r'''
const civilServiceRows = (civilServicePositions2026.major_stats || [])
  .slice(0, 120)
  .map((item) => `<tr>
    <td><strong><a href="/major/${html(item.major_slug)}/">${html(item.major_name)}</a></strong><br><span class="status-pill">${html(item.feasibility_level)}</span></td>
    <td>${html(item.matched_position_count)}</td>
    <td>${html(item.matched_plan_count)}</td>
    <td>${html(item.main_position_count)} / ${html(item.supplemental_position_count)}</td>
    <td>${(item.sample_positions || []).slice(0, 3).map((sample) => `${html(sample.department || "")}${sample.position_name ? `：${html(sample.position_name)}` : ""}`).join("<br>")}</td>
  </tr>`).join("");

const zhejiangCivilServiceRows = (zhejiangCivilServicePositions.major_stats || [])
  .slice(0, 120)
  .map((item) => `<tr>
    <td><strong><a href="/major/${html(item.major_slug)}/">${html(item.major_name)}</a></strong><br><span class="status-pill">${html(item.feasibility_level)}</span></td>
    <td>${html(item.matched_position_count)}</td>
    <td>${html(item.matched_plan_count)}</td>
    <td>${html(Object.entries(item.year_counts || {}).map(([year, count]) => `${year}:${count}`).join(" / "))}</td>
    <td>${(item.sample_positions || []).slice(0, 3).map((sample) => `${html(sample.year || "")} ${html(sample.unit || "")}${sample.position_name ? `：${html(sample.position_name)}` : ""}`).join("<br>")}</td>
  </tr>`).join("");

await write("/civil-service/", layout({
  title: "2026国考与浙江省考岗位专业匹配库 | majorAI",
  description: "majorAI整理2026国考职位表和浙江省2023-2025省考职位表，按本科专业名称、专业代码和专业类粗匹配岗位池，辅助判断专业考公报名可行性。",
  pathname: "/civil-service/",
  body: `
    <section class="detail-hero">
      <div>
        <p class="eyebrow">国考 · 浙江省考 · 专业粗匹配</p>
        <h1>考公岗位专业匹配库</h1>
        <p>已导入2026国考职位 ${html(civilServicePositions2026.total_positions)} 个、浙江省考2023-2025职位 ${html(zhejiangCivilServicePositions.total_positions)} 个。这里按专业名称、专业代码、专业类做粗匹配，用来观察岗位池大小，不代表资格审查一定通过。</p>
      </div>
    </section>
    <section class="band">
      <article class="article narrow">
        <h2>2026国考</h2>
        <p>主招和补录合计计划人数 ${html(civilServicePositions2026.total_plan_count)} 人。职位表还会限制学历、学位、政治面貌、基层年限、服务基层项目、工作地点和备注条件。</p>
        <p class="source-note">${html(civilServicePositions2026.source_note)}</p>
      </article>
      <div class="table-wrap rank-source-table">
        <table>
          <thead><tr><th>专业</th><th>匹配职位</th><th>计划人数</th><th>主招/补录</th><th>样例岗位</th></tr></thead>
          <tbody>${civilServiceRows}</tbody>
        </table>
      </div>
    </section>
    <section class="band">
      <article class="article narrow">
        <h2>浙江省考 2023-2025</h2>
        <p>三年合计计划人数 ${html(zhejiangCivilServicePositions.total_plan_count)} 人。浙江考生可以重点看本省岗位池，同时逐条核对学历、学位、身份、政治面貌、年龄、专业备注和人民警察体测等限制。</p>
        <p class="source-note">${html(zhejiangCivilServicePositions.source_note)}</p>
      </article>
      <div class="table-wrap rank-source-table">
        <table>
          <thead><tr><th>专业</th><th>三年匹配职位</th><th>计划人数</th><th>年度分布</th><th>样例岗位</th></tr></thead>
          <tbody>${zhejiangCivilServiceRows}</tbody>
        </table>
      </div>
    </section>
  `,
  jsonLd: [breadcrumbJson([{ name: "首页", path: "/" }, { name: "考公岗位库", path: "/civil-service/" }])]
}));

'''

file.write_text(text[:start] + block + text[end:], encoding="utf-8")
print("rewrote civil-service block")
