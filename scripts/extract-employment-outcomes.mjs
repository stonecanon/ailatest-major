import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");

const args = new Set(process.argv.slice(2));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const fileArg = process.argv.find((arg) => arg.startsWith("--file="));
const limit = Number(limitArg?.split("=")[1] || 0);
const targetFiles = fileArg
  ? [fileArg.split("=")[1]]
  : args.has("--include-2025")
    ? ["employment_quality_reports_2024.json", "employment_quality_reports_2025.json"]
    : ["employment_quality_reports_2024.json"];

const readJson = async (name) => JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));
const writeJson = async (name, value) => {
  await fs.writeFile(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const decodeHtml = (value = "") => String(value)
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'");

const normalizeText = (value = "") => decodeHtml(value)
  .replace(/\u00a0/g, " ")
  .replace(/[ \t\r\f\v]+/g, " ")
  .replace(/\n[ \t]+/g, "\n")
  .replace(/[。；;]\s*/g, "$&\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();

const htmlToText = (html = "") => normalizeText(html
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<\/(p|div|li|tr|h[1-6]|section|article|table)>/gi, "\n")
  .replace(/<br\s*\/?>/gi, "\n")
  .replace(/<[^>]+>/g, " "));

const extractTablesFromHtml = (html = "") => {
  const tables = [];
  for (const tableMatch of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    const rows = [];
    for (const rowMatch of tableMatch[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
      const cells = [...rowMatch[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((cell) => htmlToText(cell[1]).replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
};

const findPython = () => {
  const candidates = [
    process.env.PYTHON,
    "C:\\Users\\dell\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe",
    "python",
    "python3"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, ["--version"], { encoding: "utf8", timeout: 5000 });
      if (result.status === 0) return candidate;
    } catch {
      // Try next candidate.
    }
  }
  return null;
};

let pythonBin;
const extractPdfText = (absolutePath) => {
  pythonBin ||= findPython();
  if (!pythonBin) return { text: "", tables: [], error: "python_not_found" };
  const code = `
import json, sys
try:
    import pdfplumber
except Exception as exc:
    print(json.dumps({"text": "", "tables": [], "error": "pdfplumber_missing:" + str(exc)}, ensure_ascii=False))
    raise SystemExit(0)
path = sys.argv[1]
parts = []
tables = []
try:
    with pdfplumber.open(path) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if text:
                parts.append(f"\\n[page {page_no}]\\n" + text)
            try:
                for table in page.extract_tables() or []:
                    rows = []
                    for row in table or []:
                        cells = [("" if cell is None else str(cell).strip()) for cell in row]
                        if any(cells):
                            rows.append(cells)
                    if rows:
                        tables.append(rows)
            except Exception:
                pass
    print(json.dumps({"text": "\\n".join(parts), "tables": tables[:30], "error": ""}, ensure_ascii=False))
except Exception as exc:
    print(json.dumps({"text": "", "tables": [], "error": str(exc)}, ensure_ascii=False))
`;
  const result = spawnSync(pythonBin, ["-c", code, absolutePath], {
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONPATH: [
        process.env.PYTHONPATH,
        "C:\\Users\\dell\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python"
      ].filter(Boolean).join(path.delimiter),
      PYTHONIOENCODING: "utf-8"
    },
    timeout: 60000,
    maxBuffer: 12 * 1024 * 1024
  });
  try {
    return JSON.parse(result.stdout || "{}");
  } catch {
    return { text: "", tables: [], error: result.stderr || "pdf_parse_failed" };
  }
};

const percentPattern = /(\d{1,3}(?:\.\d+)?)\s*%/g;
const positivePattern = /毕业|就业|升学|深造|出国|出境|境外|国内|单位|行业|地区|地域|流向|去向|落实|签约|协议|合同|灵活|自由职业|待就业|未就业|毕业生/;
const negativePattern = /师资|教师|专任|国家级|省级|平台|课程|学科|科研|招生计划|录取|奖学金|满意度|用人单位需求|能力|知识|评价|反馈|占地|图书|经费|浏览量|阅读|版权|责任编辑|编辑|发布|二维码/;

const metricRules = [
  ["overall_destination_rate", "毕业去向落实率", /毕业.{0,8}去向.{0,4}落实率|毕业生.{0,6}落实率|总体.{0,4}落实率|去向落实率/],
  ["domestic_study_rate", "国内升学率", /国内.{0,4}(升学|深造)|境内.{0,4}(升学|深造)/],
  ["overseas_study_rate", "出国/境升学率", /出国|出境|境外|留学/],
  ["further_study_rate", "升学深造率", /升学|深造|继续深造/],
  ["contract_employment_rate", "协议和合同就业率", /协议|合同|签约/],
  ["flexible_employment_rate", "灵活就业率", /灵活就业|自由职业/],
  ["unemployed_rate", "待就业率", /待就业|未就业/],
  ["employment_rate", "就业率", /就业率|就业比例|就业人数/]
];

const distributionRules = [
  ["unit_type_distribution", /单位性质|单位类型|就业单位|机关|事业单位|国有企业|民营企业|三资企业/],
  ["industry_distribution", /行业|产业|制造业|信息传输|软件|金融|教育|科研|公共管理|卫生|建筑/],
  ["region_distribution", /地区|地域|省市|就业地|流向|京津冀|长三角|粤港澳|西部|基层/],
  ["study_destination_distribution", /升学院校|深造去向|境内升学|境外升学|国内升学|出国/]
];

const knownTags = {
  unit_type_distribution: ["机关", "事业单位", "国有企业", "民营企业", "三资企业", "外资企业", "高等教育单位", "科研设计单位", "医疗卫生单位", "部队", "基层项目"],
  industry_distribution: ["信息传输、软件和信息技术服务业", "教育", "科学研究和技术服务业", "制造业", "金融业", "公共管理、社会保障和社会组织", "卫生和社会工作", "建筑业", "交通运输、仓储和邮政业", "文化、体育和娱乐业", "电力、热力、燃气及水生产和供应业"],
  region_distribution: ["北京", "上海", "浙江", "江苏", "广东", "深圳", "杭州", "南京", "苏州", "广州", "成都", "武汉", "西安", "京外", "长三角", "粤港澳大湾区", "西部地区", "基层"],
  study_destination_distribution: ["国内升学", "境内升学", "出国", "出境", "境外升学", "保研", "推免", "硕士研究生", "博士研究生"]
};

const notableEmployerLexicon = ["国家电网", "中国建筑", "中国银行", "中国工商银行", "中国农业银行", "中国建设银行", "中国移动", "中国电信", "中国联通", "华为", "腾讯", "阿里巴巴", "字节跳动", "美团", "百度", "京东", "网易", "小米", "比亚迪", "宁德时代", "大疆", "中芯国际", "中国科学院", "地方选调", "基层选调"];

const confidenceRank = { high: 3, medium: 2, low: 1, none: 0, pending: 0 };

const clampPercent = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100;
};

const shortExcerpt = (text = "") => text.replace(/\s+/g, " ").trim().slice(0, 160);

const shouldUseLine = (line = "") => {
  if (!positivePattern.test(line)) return false;
  if (/计算公式|公式|[=＝]|x\s*100|×\s*100/.test(line)) return false;
  if (negativePattern.test(line) && !/毕业|就业|升学|去向|落实|行业|地区|单位/.test(line)) return false;
  return true;
};

const classifyMetric = (text = "") => {
  for (const [key, label, pattern] of metricRules) {
    if (pattern.test(text)) return { key, label };
  }
  return null;
};

const distributionKey = (text = "") => {
  for (const [key, pattern] of distributionRules) {
    if (pattern.test(text)) return key;
  }
  return null;
};

const addFact = (facts, fact) => {
  if (!fact?.value || !fact?.label) return;
  const key = `${fact.metric_key || fact.category || ""}|${fact.label}|${fact.value}|${fact.text_excerpt || ""}`;
  if (facts.some((item) => `${item.metric_key || item.category || ""}|${item.label}|${item.value}|${item.text_excerpt || ""}` === key)) return;
  facts.push(fact);
};

const extractFactsFromLines = (lines) => {
  const facts = [];
  for (const line of lines) {
    const clean = line.replace(/\s+/g, " ").trim();
    if (clean.length < 4 || clean.length > 260 || !shouldUseLine(clean)) continue;
    const values = [...clean.matchAll(percentPattern)]
      .map((match) => match[1])
      .filter(clampPercent);
    if (!values.length) continue;
    const metric = classifyMetric(clean);
    const dKey = distributionKey(clean);
    for (const value of values.slice(0, 4)) {
      if (metric) {
        addFact(facts, {
          metric_key: metric.key,
          label: metric.label,
          value: `${value}%`,
          unit: "%",
          confidence: /率|比例|落实/.test(clean) ? "medium" : "low",
          source_kind: "sentence",
          text_excerpt: shortExcerpt(clean)
        });
      } else if (dKey) {
        addFact(facts, {
          category: dKey,
          label: clean.replace(percentPattern, "").replace(/[：:，,。；;]+$/g, "").slice(0, 36) || "就业去向",
          value: `${value}%`,
          unit: "%",
          confidence: "medium",
          source_kind: "sentence",
          text_excerpt: shortExcerpt(clean)
        });
      }
    }
  }
  return facts;
};

const extractFactsFromTables = (tables) => {
  const facts = [];
  const sourceTables = [];
  for (const rows of tables || []) {
    const usableRows = rows
      .map((row) => row.map((cell) => String(cell || "").replace(/\s+/g, " ").trim()).filter(Boolean))
      .filter((row) => row.length >= 2);
    if (!usableRows.length) continue;
    const tableText = usableRows.slice(0, 8).flat().join(" ");
    const explicitDistributionTable = /单位性质|单位类型|就业单位|用人单位|就业行业|行业流向|就业地区|就业地域|就业地|地区流向|地域流向|升学院校|深造去向|升学去向/.test(tableText);
    const dKey = explicitDistributionTable ? distributionKey(tableText) : null;
    const interestingRows = [];
    for (const row of usableRows) {
      const rowText = row.join(" ");
      if (!shouldUseLine(rowText) && !dKey) continue;
      const values = [...rowText.matchAll(percentPattern)].map((match) => match[1]).filter(clampPercent);
      if (!values.length) continue;
      const metric = classifyMetric(rowText);
      const label = row.find((cell) => !percentPattern.test(cell) && /[\u4e00-\u9fff]/.test(cell)) || row[0];
      const summaryMetricRow = /合计|总计|全校|总体|毕业生|本科生|研究生|硕士|博士/.test(rowText);
      for (const value of values.slice(0, 2)) {
        if (metric && summaryMetricRow) {
          addFact(facts, {
            metric_key: metric.key,
            label: metric.label,
            value: `${value}%`,
            unit: "%",
            confidence: "high",
            source_kind: "table",
            text_excerpt: shortExcerpt(rowText)
          });
        } else if (dKey) {
          addFact(facts, {
            category: dKey,
            label: label.slice(0, 36),
            value: `${value}%`,
            unit: "%",
            confidence: "high",
            source_kind: "table",
            text_excerpt: shortExcerpt(rowText)
          });
        }
      }
      interestingRows.push(row.slice(0, 8));
    }
    if (interestingRows.length) sourceTables.push({ rows: interestingRows.slice(0, 12) });
  }
  return { facts, sourceTables: sourceTables.slice(0, 8) };
};

const extractKnownTags = (text = "") => {
  const result = {};
  for (const [key, tags] of Object.entries(knownTags)) {
    result[key] = [...new Set(tags.filter((tag) => text.includes(tag)))].slice(0, 10).map((label) => ({
      label,
      value: "",
      unit: "",
      confidence: "low",
      text_excerpt: ""
    }));
  }
  result.notable_employers = [...new Set(notableEmployerLexicon.filter((name) => text.includes(name)))].slice(0, 12);
  return result;
};

const mergeDistributionFacts = (outcomes, facts, known) => {
  for (const [key] of distributionRules) {
    const factRows = facts
      .filter((fact) => fact.category === key)
      .sort((a, b) => confidenceRank[b.confidence] - confidenceRank[a.confidence])
      .slice(0, 12);
    const tagged = known[key] || [];
    outcomes[key] = factRows.length ? factRows : tagged;
  }
};

const buildStructuredOutcomes = ({ text, tables }) => {
  const normalized = normalizeText(text);
  const lines = normalized
    .split(/\n|(?<=。)|(?<=；)|(?<=;)/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lineFacts = extractFactsFromLines(lines);
  const tableResult = extractFactsFromTables(tables);
  const facts = [...tableResult.facts, ...lineFacts]
    .sort((a, b) => confidenceRank[b.confidence] - confidenceRank[a.confidence]);
  const known = extractKnownTags(normalized);
  const metrics = {};
  for (const fact of facts) {
    if (!fact.metric_key) continue;
    const existing = metrics[fact.metric_key];
    if (!existing || confidenceRank[fact.confidence] > confidenceRank[existing.confidence]) {
      metrics[fact.metric_key] = fact;
    }
  }
  const outcomes = {
    metrics,
    key_facts: facts.filter((fact) => confidenceRank[fact.confidence] >= 2).slice(0, 16),
    source_tables: tableResult.sourceTables,
    notable_employers: known.notable_employers
  };
  mergeDistributionFacts(outcomes, facts, known);

  const bestConfidence = facts[0]?.confidence || (Object.values(known).some((value) => Array.isArray(value) && value.length) ? "low" : "none");
  return { outcomes, facts, confidence: bestConfidence };
};

const loadArtifact = async (report) => {
  if (!report.artifact_path) return { text: "", tables: [], error: "missing_artifact" };
  const absolutePath = path.join(root, report.artifact_path);
  if (!fsSync.existsSync(absolutePath)) return { text: "", tables: [], error: "artifact_not_found" };
  if (report.artifact_type === "pdf" || /\.pdf$/i.test(absolutePath)) {
    const parsed = extractPdfText(absolutePath);
    return {
      text: normalizeText(parsed.text || ""),
      tables: parsed.tables || [],
      error: parsed.error || ""
    };
  }
  if (report.artifact_type === "doc") return { text: "", tables: [], error: "doc_parse_not_implemented" };
  const raw = await fs.readFile(absolutePath, "utf8");
  return {
    text: htmlToText(raw),
    tables: extractTablesFromHtml(raw),
    error: ""
  };
};

const statusFrom = (report, parseResult, extraction) => {
  if (report.download_status === "external_platform_limited") return "外部平台不可抓取";
  if (report.download_status === "missing_url") return "无报告入口";
  if (report.download_status && !String(report.download_status).startsWith("downloaded")) return "下载失败";
  if (parseResult.error === "doc_parse_not_implemented") return "文档待人工解析";
  if (parseResult.error && !parseResult.text) return "解析失败";
  if (confidenceRank[extraction.confidence] >= 2) return "已结构化";
  if (extraction.confidence === "low") return "低可信待复核";
  return "未提取到结构化字段";
};

const extractFile = async (name) => {
  const payload = await readJson(name);
  const reports = (payload.reports || []).slice(0, limit || undefined);
  const counts = {};
  for (const report of reports) {
    const parseResult = await loadArtifact(report);
    const extraction = parseResult.text
      ? buildStructuredOutcomes({ text: parseResult.text, tables: parseResult.tables || [] })
      : { outcomes: { metrics: {}, key_facts: [], source_tables: [], notable_employers: [] }, facts: [], confidence: "none" };
    const status = statusFrom(report, parseResult, extraction);
    const highOrMediumFacts = extraction.facts.filter((fact) => confidenceRank[fact.confidence] >= 2);

    report.structured_outcomes = extraction.outcomes;
    report.employment_facts = highOrMediumFacts.slice(0, 10).map((fact) => ({
      label: fact.label,
      value: fact.value,
      text: fact.text_excerpt,
      confidence: fact.confidence,
      metric_key: fact.metric_key,
      category: fact.category
    }));
    report.unit_type_distribution = extraction.outcomes.unit_type_distribution || [];
    report.industry_distribution = extraction.outcomes.industry_distribution || [];
    report.region_distribution = extraction.outcomes.region_distribution || [];
    report.study_destination_distribution = extraction.outcomes.study_destination_distribution || [];
    report.notable_employers = extraction.outcomes.notable_employers || [];
    report.confidence = extraction.confidence;
    report.parse_status = status;
    report.outcome_parse_status = status;
    report.parsed_at = new Date().toISOString();
    report.parse_error = parseResult.error || "";
    report.outcome_summary = highOrMediumFacts.length
      ? `${report.university_name}${report.year || ""}届就业质量报告已抽取 ${highOrMediumFacts.length} 条中高可信就业/升学去向指标。`
      : `${report.university_name}${report.year || ""}届就业质量报告暂未形成中高可信结构化摘要，需继续复核原报告。`;
    counts[status] = (counts[status] || 0) + 1;
  }
  payload.extraction = {
    updated_at: new Date().toISOString(),
    parser: "section-aware-cache-v1",
    scope_count: reports.length,
    confidence_policy: "前台默认展示 high/medium；low 保留用于复核。"
  };
  await writeJson(name, payload);
  return { file: name, total: reports.length, counts };
};

const results = [];
for (const file of targetFiles) {
  results.push(await extractFile(file));
}
console.log(JSON.stringify(results, null, 2));
