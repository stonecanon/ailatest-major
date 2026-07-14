# Launch and Search Indexing Checklist

Use this before promoting `major.ailatest.org`.

## Build

```bash
npm run check
npm run build
```

Deploy `dist/` to Cloudflare Pages. Keep the custom domain set to `major.ailatest.org`.

## Required URLs

- `https://major.ailatest.org/`
- `https://major.ailatest.org/majors/`
- `https://major.ailatest.org/universities/`
- `https://major.ailatest.org/sitemap.xml`
- `https://major.ailatest.org/robots.txt`
- `https://major.ailatest.org/topics/ai-majors-2026/`
- `https://major.ailatest.org/major/artificial-intelligence/`
- `https://major.ailatest.org/comparison/artificial-intelligence-vs-computer-science/`
- `https://major.ailatest.org/admissions/match/`
- `https://major.ailatest.org/admissions/rank-sources/`
- `https://major.ailatest.org/transfer-major/`
- `https://major.ailatest.org/feedback/`
- `https://major.ailatest.org/about/`
- `https://major.ailatest.org/data-sources/`
- `https://major.ailatest.org/methodology/`
- `https://major.ailatest.org/contact/`
- `https://major.ailatest.org/privacy/`
- `https://major.ailatest.org/terms/`
- `https://major.ailatest.org/editorial-policy/`

## Search Engine Submission

1. Google Search Console
   - Add property: `https://major.ailatest.org/`
   - Verify via DNS TXT or HTML file.
   - Submit sitemap: `https://major.ailatest.org/sitemap.xml`
   - Do not use the old Google sitemap ping endpoint. Google has deprecated it; use `robots.txt` and Search Console.

2. Bing Webmaster Tools
   - Add site and import from Google Search Console if available.
   - Submit sitemap.
   - After `major.ailatest.org` is bound and live, verify the IndexNow key file: `https://major.ailatest.org/5f1f7bd9e20b4b1bb06cb7f61c1f8d0a.txt`
   - Dry run: `npm run indexnow:dry-run`
   - Submit current sitemap URLs to IndexNow: `npm run indexnow:submit`
   - IndexNow only confirms URL receipt; it does not guarantee ranking or immediate indexing.

3. Baidu Search Resource Platform
   - Add site: `major.ailatest.org`
   - Submit sitemap or important URL batch.
   - Prioritize Chinese AI major topic pages and major detail pages.

4. Sogou / 360 Webmaster
   - Add site and submit sitemap when account access is ready.

## Source Credibility

Every data page should include source notes. Priority sources:

- Ministry of Education undergraduate major catalog.
- Sunshine Gaokao major knowledge base and university database.
- Ministry of Education national university list query.
- Provincial education examination authorities.
- University admission sites.

Do not market the site as a guaranteed volunteer-filling tool. Use phrases such as:

- `大学专业百科`
- `AI专业选择助手`
- `公开数据专业库`
- `历史位次参考`

Avoid:

- `录取概率保证`
- `志愿填报神器`
- `内部数据`
- `保录`
