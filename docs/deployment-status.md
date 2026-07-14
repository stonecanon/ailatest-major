# Deployment Status

Current Pages project:

- Project: `ailatest-major`
- Official production domain: `https://major.ailatest.org/`
- Cloudflare Pages fallback domain: `https://ailatest-major.pages.dev/`
- Latest verified deployment: `https://799eab76.ailatest-major.pages.dev/`
- Build output: `dist/`
- Verified sitemap URL count: `3929` unique URLs
- Last verified: `2026-06-12 16:37:53 +08:00`
- Custom domain: `major.ailatest.org` resolved and verified with HTTPS 200.
- D1 database: `ailatest-major` (`0670627c-7185-4db8-9af9-08b8a9b033eb`), binding `DB`
- Feedback storage: verified with `POST /api/feedback`, D1 `user_feedback` row `id=1`, `feedback_type=system_test`
- Build output optimization: production build was generated with `BUILD_DIST=C:\Users\dell\AppData\Local\Temp\ailatest-major-dist` because the Google Drive workspace is very slow for large static-output writes. Cloudflare Pages was deployed from that temp build folder.
- Admission scores: imported 49237 public official score/rank rows; 49217 are Zhejiang 2025/2024 普通类第一段/第二段 records from 浙江省教育考试院, and 20 are existing 山东 sample rows.
  - 浙江省教育考试院 2025 普通类第一段平行投档分数线: 17890 rows, raw official file SHA256 `875d344e0b163a19796add0c071dbe2d1d832183b8b797b8063c166809fe7e47`
  - 浙江省教育考试院 2025 普通类第二段平行投档分数线: 7096 rows, raw official file SHA256 `5a7a6b72a357e80c77676b7a0c9920778ac4f235cc6e015cf8eccf1f461d9ebc`
  - 浙江省教育考试院 2024 普通类第一段平行投档分数线: 17241 rows, raw official file SHA256 `66745bfa9d7d06a9a9a66a62cca2087ab1ea14c49cd46d1a551b5abbd56adad7`
  - 浙江省教育考试院 2024 普通类第二段平行投档分数线: 6990 rows, raw official file SHA256 `2d1a2273493692a7e7ba7119aed81c4cafe5301077b6b251515403153ffc8ed8`
  - 山东省教育招生考试院 2025 普通类常规批第1次志愿投档情况表: 20 matched rows, raw official file SHA256 `9fdc37c96d3ddceec0f62da7021f8ae01f3cbc6eac7d3698c2efcd202f0c87f1`; site does not republish the original full table.
- Data bundle split: `site-data.json` is 4.02 MiB and lazy-loaded `admission-scores.json` is 16.37 MiB, under Cloudflare Pages' 25 MiB per-file limit.
- Rank matcher: verified `/admissions/match/` with Zhejiang and Shandong sample buttons.
- Rank lines: added `/admissions/rank-lines/` for direct high-school admission rank-line lookup. The page shows province/year stats, searchable school/major keyword filtering, optional rank ceiling, minimum score, minimum rank, plan count and official source links. Verified Zhejiang University + Artificial Intelligence local interaction and production pages `/admissions/rank-lines/`, `/planner/`, and `/university/zhejiang-university/`.
- Province rank source map: verified `/admissions/rank-sources/` with 7 province source records.
- Transfer major policy map: verified `/transfer-major/` with 6 university policy records.
- Promo landing pages: verified `/share/xiaohongshu-ai-major-choice/` and `/share/zhihu-zhejiang-80-volunteer-order/`.
- Major expansion: verified 883 undergraduate major pages from the 2026 undergraduate major catalog, including `/major/oral-medicine/`, `/major/integrated-circuit-design-and-integrated-system/`, `/major/new-energy-vehicles-engineering/`.
- University expansion: verified 2977 university/admission-unit pages from the 2025 national regular universities list plus Zhejiang投档招生单位. University tags include 38 `985` and 112 `211` historical-engineering notes where matched.
- Hong Kong/Macau universities: added 19 Hong Kong and Macau higher-education institutions as separate `港澳高校` records, sourced from Hong Kong UGC, Macau DSEDJ, Yangguang Gaokao 2026 Hong Kong/Macau mainland admissions guide and school official sites. Verified `/universities/`, `/university/university-of-hong-kong/`, `/university/university-of-macau/` and `/data-sources/` on `major.ailatest.org`; cards show QS/THE/QS Asia labels where public ranking references were added.
- CHSI admission charters: Zhejiang University, Hangzhou Dianzi University and Ningbo University use exact Yangguang Gaokao charter detail URLs. Zhejiang University of Technology and Zhejiang Sci-Tech University now use school-level Yangguang Gaokao charter list URLs (`listZszc--schId-258` and `listZszc--schId-259`). Other newly added Zhejiang universities link to the official Zhejiang undergraduate charter list pending detail-page verification.
- Admission charter UX: university pages and university-major pages include a user-facing "招生章程重点看" checklist for professional remarks, campus, tuition, language requirements, physical examination limits, same-score rules and major admission rules.
- Directory pages: verified `/majors/` and `/universities/`.
- University detail copy: verified placeholder school intros and unverified policy prose are reduced to concise no-data states, with source links retained where available. Peking University page now shows `暂无已核验学校简介。`, `暂无已接入专业。`, and the original transfer-policy link without filler text.
- Double First-Class labels: verified 147 records from the 2022 Ministry of Education second-round Double First-Class list. University pages now distinguish the university-level second-round construction label, construction disciplines, and first-round A/B historical classification; second-round pages state that A/B is no longer a current classification.
- University decision tags: verified university cards and recommendation surfaces now show highlighted labels for `985`, `211`, `双一流`, first-round A/B historical class, and `有推免资格`. Rank-match results and planner rows render the same tags, and planner ranking reasons include `院校标签` with a small weighting bonus.
- Public opinion framework: added the user-supplied `ZhangXueFeng-skill` GitHub repository as a low-priority public framework source. Major and university detail pages now show non-official "公开观点框架提醒" panels for employment-backward reasoning, median-outcome checks, city/platform checks and source-boundary caveats. Verified `/major/computer-science-and-technology/`, `/university/zhejiang-university/` and `/data-sources/` on `major.ailatest.org`.
- Public figure engineering framework: added `alchaincyf/elon-musk-skill` as a low-priority public framework source for AI/engineering pages. AI and engineering major advice now includes first-principles, five-step algorithm, physical-world engineering and vertical-integration checks, with caveats that this is not a celebrity endorsement or China undergraduate-major recommendation. Verified `/major/artificial-intelligence/` and `/data-sources/` on `major.ailatest.org`.
- AI sharp review: added the four user-supplied WeChat public articles as a non-official volunteer-planning opinion framework. Major pages, university pages and university-major pages now render `AI锐评` panels with source links and caveats that the panel is a decision-question checklist, not an official fact source. Verified `/major/artificial-intelligence/`, `/university/zhejiang-university/`, `/university/zhejiang-university/major/computer-science-and-technology/` and `/data-sources/` on `major.ailatest.org`, with no `????` mojibake.
- Civil-service topic rewrite: replaced `/topics/majors-for-civil-service/` with a job-pool-first planning page. The topic now ranks fiscal/tax, economics, finance, accounting/auditing, computer, law, trade, electronic information, statistics and mathematics ahead of generic "stable" majors; adds three planning sections and links official National Civil Service Administration/Tax sources plus public media and Zhihu discussion references. Verified `/topics/majors-for-civil-service/` and `/data-sources/` on `major.ailatest.org`.
- University library ranking sort: `/universities/` no longer defaults to province/name order. It now shows a top comprehensive section sorted by public ranking signals and decision tags: soft rankings from 软科/QS/THE/U.S. News where available, then 985, 双一流, 211, 推免资格 and undergraduate level as fallback. University cards and search snippets expose ranking labels; university detail pages include a "公开排名参考" panel. Verified `/universities/`, `/university/zhejiang-university/` and `/data-sources/` on `major.ailatest.org`, with no mojibake.
- Discipline evaluation MVP: added `subject_evaluations.json` with 12 high-interest first-level disciplines from Ministry degree-center fourth-round discipline evaluation pages. Major pages and university-major pages now render "学科评估参考" panels; university pages render "学科评估A类" panels for matched A-class disciplines. Verified `/major/computer-science-and-technology/`, `/university/zhejiang-university/`, `/university/zhejiang-university/major/computer-science-and-technology/` and `/data-sources/` on `major.ailatest.org`, with no mojibake.
- Detail-page layout: fixed content-grid overflow caused by long source URLs; professional and university detail pages now use wider bounded side panels with `overflow-wrap` protection. Verified desktop and mobile local previews before production deploy.
- Library search: verified `/majors/` has a major-only search box and `/universities/` has a university-only search box; both use live client-side results from `site-data.json`.
- Major decision tags: verified all 40 majors have public-facing decision labels for civil-service fit, work scene, gender/common-family questions and public-opinion caveats. Professional pages show the "选专业决策标签" panel, and the major library links AI hot majors, civil-service-friendly majors and gender/work-scene question topics.
- Major source links: verified professional pages render clickable source URLs.
- Career profiles: expanded and verified 12 structured career profile records.
- Home UX: homepage is search-first, with task entries for major search, university search and volunteer-order optimization. Top navigation is simplified to university library, major library, volunteer optimization, favorites and login; AI-major topics live under the major library, progression/admission-charter/transfer-policy entries live under the university library, and rank matching lives under volunteer optimization.
- Planner subject checks: verified `/planner/` now asks for selected subjects, supports explicit row-level requirements such as `物理+化学` or `不限`, and flags volunteers as `不可报`, `需核对`, `未确认`, or `通过`. Cache-busted assets use `app.js?v=20260611-subject-planner`.
- Home task entries: verified the three primary homepage choices use distinct color blocks for major search, university search and volunteer optimization.
- Login and favorites: verified `/login/` and `/favorites/`; `/login/` now uses email-code UI and Pages Functions auth endpoints backed by D1 email user/code/session tables. `GET /api/auth/me` returns unauthenticated state correctly.
- Email OTP delivery: deployed `majorai-email-sender` Worker at `https://majorai-email-sender.jiantaoweng.workers.dev` with Cloudflare `send_email` binding and shared secret from Pages. Live send test currently returns Cloudflare Email Service `E_INTERNAL_SERVER_ERROR` for `login@ailatest.org`; Wrangler Email Sending zone listing also returns API `2036 Unauthorized`. Code is live, but the `ailatest.org` sender/domain needs Cloudflare Email Sending onboarding/verification before real OTP emails deliver.
- Favorites fix: verified favorite storage tolerates legacy arrays, old keys, URL-like values and legacy numeric IDs, then migrates matches back to slugs.
- Progression data: added `/progression/` and university-page "升学与保研参考" panels. Verified progression samples now include Hangzhou Dianzi University 2023 undergraduate further-study rate `39.21%`, Peking University 2024 undergraduate study-destination share `84.23%`, and Tsinghua University 2024 undergraduate overseas-study rate `18.4%`. Nanjing University 2024 further-study rate `70.64%` and Zhejiang University 2024 further-study rate `70.06%` are marked "需复核" pending original report-table verification. Sun Yat-sen University 2024 undergraduate graduate count and progression-quality description are marked "部分核验".
- Recommendation eligibility: verified all 15 university samples now show school-level 推免资格 with source links. University cards include `有推免资格`; university detail pages include a dedicated 推免资格 panel; `/progression/` includes a 推免资格 column and caveat that school eligibility does not mean each student personally has 保研资格.
- Recommendation eligibility expansion: imported the public 433-school eligibility list, matched 431 schools already present in the site data, and marked 65 newly added 2025 eligible schools. Verified Beijing University, Tsinghua University and Zhejiang University all show the school-level `有推免资格` label on production.
- Employment quality reports: imported 140 NCSS 2024 report-index links and 12 currently found 2025 public report links. University pages now prefer the latest matched report entry and expose an employment-quality report entrance instead of repeating progression-rate copy.
- Employment quality reports: upgraded the 2024 NCSS workflow to cache public report artifacts under `raw/employment-reports/`, classify HTML/PDF/WeChat/document entries, extract medium/high-confidence employment outcomes into structured fields, and render university-page/report-index summaries before falling back to source links.
- Civil-service library: imported 2026 national civil-service main and supplemental position tables, totaling 21641 positions and 39413 planned recruits; imported Zhejiang 2023-2025 civil-service position tables, totaling 15167 positions and 21613 planned recruits. Major pages now show `2026国考` and `浙江省考 2023-2025` professional matching summaries, and `/civil-service/` exposes a separate civil-service data library.
- IndexNow key file: verified `https://major.ailatest.org/5f1f7bd9e20b4b1bb06cb7f61c1f8d0a.txt`
- IndexNow submit: latest submission covered 3929 canonical URLs for `major.ailatest.org`, HTTP 200.

Verified URLs:

- `https://major.ailatest.org/`
- `https://major.ailatest.org/planner/`
- `https://major.ailatest.org/majors/`
- `https://major.ailatest.org/universities/`
- `https://major.ailatest.org/progression/`
- `https://major.ailatest.org/login/`
- `https://major.ailatest.org/favorites/`
- `https://major.ailatest.org/university/hangzhou-dianzi-university/`
- `https://major.ailatest.org/university/ningbo-university/`
- `https://major.ailatest.org/sitemap.xml`
- `https://major.ailatest.org/5f1f7bd9e20b4b1bb06cb7f61c1f8d0a.txt`
- `https://ailatest-major.pages.dev/`
- `https://ailatest-major.pages.dev/majors/`
- `https://ailatest-major.pages.dev/universities/`
- `https://ailatest-major.pages.dev/planner/`
- `https://ailatest-major.pages.dev/sitemap.xml`
- `https://ailatest-major.pages.dev/about/`
- `https://ailatest-major.pages.dev/data-sources/`
- `https://ailatest-major.pages.dev/methodology/`
- `https://ailatest-major.pages.dev/contact/`
- `https://ailatest-major.pages.dev/privacy/`
- `https://ailatest-major.pages.dev/terms/`
- `https://ailatest-major.pages.dev/editorial-policy/`
- `https://ailatest-major.pages.dev/llms.txt`
- `https://ailatest-major.pages.dev/humans.txt`
- `https://ailatest-major.pages.dev/5f1f7bd9e20b4b1bb06cb7f61c1f8d0a.txt`
- `https://ailatest-major.pages.dev/share/zhejiang-80-volunteer-ranking/`
- `https://ailatest-major.pages.dev/share/ai-hot-majors-guide/`
- `https://ailatest-major.pages.dev/share/rank-data-explained/`
- `https://ailatest-major.pages.dev/share/xiaohongshu-ai-major-choice/`
- `https://ailatest-major.pages.dev/share/zhihu-zhejiang-80-volunteer-order/`
- `https://ailatest-major.pages.dev/major/electronic-information-engineering/`
- `https://ailatest-major.pages.dev/major/information-security/`
- `https://ailatest-major.pages.dev/admissions/rank-sources/`
- `https://ailatest-major.pages.dev/transfer-major/`
- `https://ailatest-major.pages.dev/api/feedback`
- `https://ailatest-major.pages.dev/university/zhejiang-university/major/artificial-intelligence/`
- `https://ailatest-major.pages.dev/university/zhejiang-university/major/robotics-engineering/`
- `https://ailatest-major.pages.dev/university/nanjing-university/major/artificial-intelligence/`
- `https://ailatest-major.pages.dev/university/nanjing-university/major/software-engineering/`

## Search Indexing

- Submit `https://major.ailatest.org/sitemap.xml` in Google Search Console.
- Submit `https://major.ailatest.org/sitemap.xml` in Bing Webmaster Tools.
- IndexNow key file is live and `npm run indexnow:submit` returned HTTP 200 for 3929 URLs.

## Redeploy

```bash
npm run deploy:production
```

This runs data checks, rebuilds the static site, verifies launch-critical files, then deploys `dist/`.
