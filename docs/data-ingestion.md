# Data Ingestion Boundary

majorAI uses a layered public-data pipeline. The first layer is factual identity data from official public sources; AI text is a separate enrichment layer and never becomes the source of truth.

## Layer 1: Official Identity Tables

- Undergraduate major catalog: Ministry of Education / Sunshine Gaokao policy page and attachment.
- Higher education institution list: Ministry of Education national list.

These records establish stable keys such as `专业代码` and `学校标识码`.

## Layer 2: Public Descriptive Sources

- Sunshine Gaokao major knowledge base.
- Sunshine Gaokao university database.
- University undergraduate admission sites and program pages.

Use these to fill descriptions, course lists, postgraduate directions, open universities, and admissions entrance links. Keep source notes.

## Layer 3: Provincial Admissions Data

Initial provinces: Zhejiang, Jiangsu, Shandong, Guangdong, Henan, Sichuan.

Allowed sources:

- Provincial education examination authority one-point-one-section tables.
- Provincial filing lines and admission score documents.
- University admission site historical score pages.

Every imported score row must keep a `data_grain` value:

- `major`: school + major / major class, suitable for Zhejiang and Shandong professional parallel志愿.
- `university_major_group`: school + major group, suitable for Guangdong, Shanghai, Jiangsu and similar group-based provinces.
- `university`: school-level line only.

Do not present `university_major_group` or `university` rows as single-major rank data. See `docs/admission-rank-sources.md` for the current official source list.

Display only historical reference bands, `冲稳保建议`, or historical matching labels. Never show a guaranteed admission probability.

## Layer 4: Career and Salary Signals

Allowed sources:

- National Bureau of Statistics industry wage tables.
- Occupational classification documents from public authorities.
- University employment quality reports.

Commercial reports may inform manual interpretation, but their original text and data tables must not be scraped or republished without authorization.

## Import Command

Preview:

```bash
npm run import:public -- --majors imports/major_catalog.csv --universities imports/university_list.csv
```

Apply:

```bash
npm run import:public -- --majors imports/major_catalog.csv --universities imports/university_list.csv --apply
npm run check
npm run build
```

Admissions preview:

```bash
npm run import:public -- --plans imports/zhejiang_admission_plans.csv --scores imports/zhejiang_admission_scores.csv
```

The importer keeps existing AI-enriched records when official keys match, and fills non-enriched rows with clearly marked placeholder summaries.
