# Admission Rank Source Notes

This file records the public official sources that can feed `admission_scores`.
Do not use grey scraping or unauthorized commercial volunteer-filling databases.

## Data Grain Rules

Use `data_grain` on every imported score row:

- `major`: school + major / major class. Suitable for Zhejiang and Shandong style professional parallel choices.
- `university_major_group`: school + major group. Suitable for Guangdong, Shanghai, Jiangsu, Hubei, Hunan, Fujian and similar group-based provinces.
- `university`: school-level line only. Do not present it as a major line.

Product wording must follow the grain:

- `major`: "专业投档位次参考"
- `university_major_group`: "院校专业组投档位次参考，不代表单专业位次"
- `university`: "院校投档线参考，不代表专业录取结果"

## First-Batch Official Sources

| Province | Source | Grain | URL | Import priority |
| --- | --- | --- | --- | --- |
| 浙江 | 浙江省2025年普通高校招生普通类第一段平行投档分数线表 | `major` | https://www.zjzs.net/art/2025/7/21/art_45_11467.html | Highest |
| 山东 | 山东省2025年普通类常规批第1次志愿投档情况表 | `major` | https://www.sdzk.cn/NewsInfo.aspx?NewsID=6996 | Highest |
| 广东 | 广东省2025年普通高考本科批次投档情况 | `university_major_group` | https://eea.gd.gov.cn/ptgk/content/post_4746781.html | Medium |
| 上海 | 上海市2025年本科普通批次平行志愿院校专业组投档分数线 | `university_major_group` | https://www.shmeea.edu.cn/download/20250719/186.pdf | Medium |
| 江苏 | 江苏省2025年普通高校招生普通类本科批次平行志愿投档线 | `university_major_group` | https://www.jseea.cn/webfile/upload/2025/07-18/09-33-380724-1917118608.pdf | Medium |
| 四川 | 四川省2025年普通类本科批次B段投档新闻与专业组口径说明 | `university_major_group` | https://www.sceea.cn/Html/202507/Newsdetail_4405.html | Research |
| 河南 | 河南省2025年普通高校招生考生指南与普通本科批专业组口径说明 | `university_major_group` | https://www.haeea.cn/a/202506/43548_96487aca.shtml | Research |

## Snapshot Workflow

Create a local audit snapshot before conversion:

```bash
npm run snapshot:source -- --source-id zhejiang-2025-major-rank-lines
```

The snapshot tool writes to `raw/source-snapshots/` and records:

- requested URL and final URL after redirects
- fetch time
- HTTP status and content type
- file size and SHA256
- candidate official attachment links found on HTML pages

The `raw/` folder is ignored by version control. Keep it for audit and conversion, but do not publish or redistribute official raw attachments unless the source explicitly permits it.

## Legal And Editorial Notes

- Keep source page URL, attachment URL if available, published date, original file name and SHA256 in import reports.
- Do not re-host official Excel/PDF attachments unless the source explicitly permits redistribution.
- For sources with copyright or anti-mirroring notices, import only the fields needed for historical reference and link back to the official page.
- Never convert Guangdong/Shanghai professional-group data into a fake single-major line.
- Do not infer missing ranks from high-score redaction such as Shanghai's "580分及以上" rows.
- Every user-facing result must say it is historical reference only and does not promise admission probability.

## Current Import Templates

- `imports/templates/zhejiang_admission_scores.sample.csv`: major-grain score/rank rows.
- `imports/templates/provincial_major_group_scores.sample.csv`: major-group score/rank rows.
