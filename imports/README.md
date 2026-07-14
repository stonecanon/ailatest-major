# Public Data Imports

This folder is for official/public source files that have been downloaded and converted into UTF-8 CSV/TSV for audit-friendly import.

Do not place commercial volunteer-filling exports here. Do not import data from unauthorized paid databases.

## Workflow

1. Create a local source snapshot from the registered official/public URL:

```bash
npm run snapshot:source -- --source-id zhejiang-2025-major-rank-lines
```

2. Keep the original file in `raw/source-snapshots/` with URL, download date, publisher, response metadata, and checksum. This folder is ignored by version control.
3. If the manifest lists official attachment links, download the needed attachment manually or with a separate reviewed snapshot.
4. Convert only the needed sheet/table to UTF-8 CSV or TSV.
5. Run a preview import:

```bash
npm run import:public -- --majors imports/major_catalog.csv --universities imports/university_list.csv
```

6. Review `data/generated/*.imported.json`.
7. Apply only after checking row counts and source notes:

```bash
npm run import:public -- --majors imports/major_catalog.csv --universities imports/university_list.csv --apply
npm run check
npm run build
```

Admissions data preview:

```bash
npm run import:public -- --plans imports/zhejiang_admission_plans.csv --scores imports/zhejiang_admission_scores.csv
```

## Expected Columns

Major catalog:

- `专业代码`
- `专业名称`
- `学科门类`
- `专业类`
- `修业年限`
- `授予学位`
- `是否特设专业`
- `是否国家控制布点专业`
- optional: `slug`, `来源说明`

University list:

- `学校标识码`
- `学校名称`
- `主管部门`
- `所在地`
- `办学层次`
- `备注`
- optional: `办学类型`, `省份`, `城市`, `官网`, `招生官网`, `slug`, `来源说明`

The importer preserves existing enriched fields when `专业代码` or `学校标识码` matches current JSON records.

Admission plans:

- `年份`
- `省份`
- `学校名称` or `学校标识码`
- `专业代码` or `专业名称`
- `批次`
- `科类/选科组合`
- `招生计划数`
- `学费`
- `校区`
- `专业备注`
- `来源说明`

Admission scores:

- `年份`
- `省份`
- `学校名称` or `学校标识码`
- `专业代码` or `专业名称`
- `批次`
- `科类/选科组合`
- `最低分`
- `最低位次`
- `平均分`
- `最高分`
- `计划数`
- `来源说明`
