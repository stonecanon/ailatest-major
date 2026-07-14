# 知途 / AILatest Major

`major.ailatest.org` is a public-data-first university major encyclopedia and AI-assisted major choice site for Chinese gaokao students.

The project deliberately starts with open authoritative sources and transparent AI structured content. It must not scrape grey-market admission databases or reuse commercial volunteer-filling data without authorization.

## MVP Scope

- Static generated SEO pages for majors, universities, university-major combinations, comparisons, and topics.
- Search, favorites, and a lightweight preference questionnaire in the browser.
- Source registry, normalized JSON seed data, SQL schema, and a Cloudflare D1-backed feedback endpoint.
- Safety copy that avoids promising admission probability. Scores/ranks should be described as historical reference bands only.

## Commands

```bash
npm install
npm run check
npm run build
npm run dev
```

Local preview defaults to `http://localhost:4173`.
If that port is already occupied by another ailatest project, run:

```bash
node scripts/serve.mjs dist 4183
```

## Public Data Import

Before converting an official page or attachment into CSV/TSV, create a local audit snapshot:

```bash
npm run snapshot:source -- --source-id zhejiang-2025-major-rank-lines
```

Snapshots are written under `raw/source-snapshots/`, which is ignored by version control. Keep the manifest for URL, fetch time, response metadata, file hash, and candidate official attachment links. Do not republish raw official attachments unless the source explicitly permits redistribution.

The site can preview official CSV/TSV imports without changing published data:

```bash
npm run import:public -- --majors imports/templates/moe_major_catalog.sample.csv --universities imports/templates/moe_university_list.sample.csv
```

Preview output is written to `data/generated/` with an import report containing source file hashes. After reviewing row counts and source notes, apply a real import with:

```bash
npm run import:public -- --majors imports/major_catalog.csv --universities imports/university_list.csv --apply
npm run check
npm run build
```

Admissions plan and score/rank files use the same preview/apply workflow:

```bash
npm run import:public -- --plans imports/zhejiang_admission_plans.csv --scores imports/zhejiang_admission_scores.csv
```

See `imports/README.md` and `docs/data-ingestion.md` for the non-gray ingestion workflow.

## Current Deployment

The MVP has been deployed to Cloudflare Pages:

- `https://ailatest-major.pages.dev/`
- Core decision page: `https://ailatest-major.pages.dev/planner/`
- Feedback endpoint: `https://ailatest-major.pages.dev/api/feedback`

Cloudflare D1 is configured for user feedback:

- Database: `ailatest-major`
- Binding: `DB`
- Table: `user_feedback`

Bind `major.ailatest.org` in Cloudflare Pages custom domains, then submit `https://major.ailatest.org/sitemap.xml` to search engines. See `docs/deployment-status.md` and `docs/launch-seo-checklist.md`.

After the custom domain is active, verify and submit current sitemap URLs to IndexNow:

```bash
npm run indexnow:dry-run
npm run indexnow:submit
```

Google Search should be handled through Search Console and `robots.txt`; do not use the deprecated Google sitemap ping endpoint.

## Data Policy

Priority sources:

1. Ministry of Education undergraduate major catalog.
2. Ministry of Education national higher education institution list.
3. Sunshine Gaokao major knowledge base and university database.
4. University admission sites, provincial education examination authorities, and public admission brochures/plans.
5. National Bureau of Statistics, occupational classification documents, and university employment quality reports.

AI-generated explanations must keep `source_note` and must not be treated as factual source data. Important facts, score/rank data, and enrollment plans need explicit public source notes before being surfaced as verified.

## Repository Layout

- `data/schema.sql`: first-phase relational schema.
- `data/sources.json`: authoritative/public source registry and ingestion policy.
- `data/*.json`: normalized seed data used by the static build.
- `src/app.css`, `src/app.js`: shared front-end assets.
- `scripts/build.mjs`: static page generator.
- `scripts/check-data.mjs`: data integrity checks.
- `scripts/serve.mjs`: local static server.
- `scripts/import-public-data.mjs`: official/public CSV import preview and apply tool.
- `scripts/submit-indexnow.mjs`: IndexNow dry-run/submission tool for Bing and other IndexNow participants.
- `imports/templates/`: import templates for Ministry of Education major and university tables.
- `docs/launch-seo-checklist.md`: launch and search indexing checklist.

## Deployment Notes

This is set up for Cloudflare Pages. Build command:

```bash
npm run build
```

Output directory:

```bash
dist
```
