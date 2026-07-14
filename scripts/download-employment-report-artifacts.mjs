import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const rawRoot = path.join(root, "raw", "employment-reports");

const args = new Set(process.argv.slice(2));
const fileArg = process.argv.find((arg) => arg.startsWith("--file="));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const concurrencyArg = process.argv.find((arg) => arg.startsWith("--concurrency="));
const targetFile = fileArg?.split("=")[1] || "employment_quality_reports_2024.json";
const limit = Number(limitArg?.split("=")[1] || 0);
const concurrency = Math.max(1, Math.min(12, Number(concurrencyArg?.split("=")[1] || 5)));
const refresh = args.has("--refresh");

const readJson = async (name) => JSON.parse(await fs.readFile(path.join(dataDir, name), "utf8"));
const writeJson = async (name, value) => {
  await fs.writeFile(path.join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const safeSegment = (value = "") => String(value)
  .normalize("NFKD")
  .replace(/[^\w.-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80) || "unknown";

const detectArtifactType = (url = "", contentType = "") => {
  const lowerUrl = url.toLowerCase();
  const lowerType = contentType.toLowerCase();
  if (/mp\.weixin\.qq\.com/.test(lowerUrl)) return "wechat";
  if (lowerType.includes("pdf") || /\.pdf($|[?#])/i.test(lowerUrl)) return "pdf";
  if (lowerType.includes("word") || /\.(docx?|wps)($|[?#])/i.test(lowerUrl)) return "doc";
  if (lowerType.includes("html") || /\.(s?html?)($|[?#])/i.test(lowerUrl)) return "html";
  if (lowerType.includes("text")) return "html";
  return "unknown";
};

const refineArtifactType = (artifactType, bytes, contentType = "") => {
  const head = bytes.subarray(0, Math.min(bytes.length, 1024)).toString("utf8").trimStart();
  if (artifactType === "pdf" && !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    if (/^<!doctype html|^<html|<body[\s>]/i.test(head) || contentType.toLowerCase().includes("html")) return "html";
  }
  if (artifactType === "unknown" && (/^<!doctype html|^<html|<body[\s>]/i.test(head) || contentType.toLowerCase().includes("html"))) return "html";
  return artifactType;
};

const extensionFor = (artifactType, contentType = "") => {
  if (artifactType === "pdf") return ".pdf";
  if (artifactType === "doc") return contentType.toLowerCase().includes("openxml") ? ".docx" : ".doc";
  if (artifactType === "html" || artifactType === "wechat") return ".html";
  return ".bin";
};

const looksLikeBlockedWechat = (text = "") => /环境异常|访问过于频繁|请在微信客户端打开|操作频繁|验证|captcha/i.test(text)
  && !/var\s+msg_title|rich_media_content|js_content|profile_nickname/.test(text);

const decodeHtml = (value = "") => String(value)
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
  .replace(/&amp;/g, "&")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'");

const findAttachmentUrl = (html = "", baseUrl = "") => {
  const candidates = [];
  for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    const raw = decodeHtml(match[1]).trim();
    if (!raw || raw.startsWith("#") || raw.startsWith("javascript:")) continue;
    if (!/\.(pdf|docx?|wps)(?:$|[?#])/i.test(raw) && !/(download|uploads?|files?)/i.test(raw)) continue;
    try {
      const url = new URL(raw, baseUrl).toString();
      const score = /\.pdf(?:$|[?#])/i.test(url) ? 4 : /\.(docx?|wps)(?:$|[?#])/i.test(url) ? 3 : /(download|uploads?|files?)/i.test(url) ? 1 : 0;
      candidates.push({ url, score });
    } catch {
      // Ignore malformed attachment candidates.
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  return candidates[0]?.url || "";
};

const fetchWithTimeout = async (url, timeoutMs = 18000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 majorAI-public-source-cache/0.1",
        accept: "text/html,application/xhtml+xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*;q=0.8",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.7"
      }
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    return { response, bytes };
  } finally {
    clearTimeout(timer);
  }
};

const saveMeta = async (metaPath, meta) => {
  await fs.writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
};

const downloadOne = async (report) => {
  const now = new Date().toISOString();
  if (!report.report_url) {
    Object.assign(report, {
      artifact_type: "unknown",
      download_status: "missing_url",
      parse_status: "no_report_url",
      confidence: "none",
      last_checked_at: now
    });
    return "missing_url";
  }

  if (report.artifact_path && report.download_status?.startsWith("downloaded") && !refresh) {
    try {
      await fs.access(path.join(root, report.artifact_path));
      report.last_checked_at = report.last_checked_at || now;
      return "cached";
    } catch {
      // Cache pointer is stale; fetch again.
    }
  }

  const year = String(report.year || "unknown");
  const schoolDir = path.join(rawRoot, year, safeSegment(report.university_slug || `${report.university_id || report.id}-${report.university_name || "school"}`));
  await fs.mkdir(schoolDir, { recursive: true });

  try {
    const { response, bytes } = await fetchWithTimeout(report.report_url);
    const contentType = response.headers.get("content-type") || "";
    const finalUrl = response.url || report.report_url;
    const artifactType = refineArtifactType(detectArtifactType(finalUrl, contentType), bytes, contentType);
    const extension = extensionFor(artifactType, contentType);
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const artifactPath = path.join(schoolDir, `report${extension}`);
    const metaPath = path.join(schoolDir, "meta.json");

    if (!response.ok) {
      Object.assign(report, {
        artifact_type: artifactType,
        download_status: `http_error_${response.status}`,
        parse_status: "download_failed",
        confidence: "none",
        final_url: finalUrl,
        http_status: response.status,
        content_type: contentType,
        last_checked_at: now
      });
      await saveMeta(metaPath, { ...report, cached_at: now });
      return report.download_status;
    }

    let finalArtifactType = artifactType;
    let finalArtifactPath = artifactPath;
    let finalBytes = bytes;
    let finalContentType = contentType;
    let finalSha256 = sha256;
    let attachmentUrl = "";
    let landingPagePath = "";
    const relMetaPath = path.relative(root, metaPath).replaceAll("\\", "/");
    const textPreview = (artifactType === "html" || artifactType === "wechat") ? bytes.toString("utf8", 0, Math.min(bytes.length, 20000)) : "";
    const blockedWechat = artifactType === "wechat" && looksLikeBlockedWechat(textPreview);
    if (!blockedWechat && (artifactType === "html" || artifactType === "wechat")) {
      attachmentUrl = findAttachmentUrl(textPreview, finalUrl);
      if (attachmentUrl) {
        const landingPath = path.join(schoolDir, "landing.html");
        await fs.writeFile(landingPath, bytes);
        landingPagePath = path.relative(root, landingPath).replaceAll("\\", "/");
        try {
          const attachment = await fetchWithTimeout(attachmentUrl, 30000);
          const attachmentType = attachment.response.headers.get("content-type") || "";
          const attachmentFinalUrl = attachment.response.url || attachmentUrl;
          const detectedAttachmentType = refineArtifactType(detectArtifactType(attachmentFinalUrl, attachmentType), attachment.bytes, attachmentType);
          if (attachment.response.ok && ["pdf", "doc", "html"].includes(detectedAttachmentType)) {
            finalArtifactType = detectedAttachmentType;
            finalBytes = attachment.bytes;
            finalContentType = attachmentType;
            finalSha256 = crypto.createHash("sha256").update(finalBytes).digest("hex");
            finalArtifactPath = path.join(schoolDir, `report${extensionFor(finalArtifactType, finalContentType)}`);
            report.attachment_url = attachmentUrl;
            report.attachment_final_url = attachmentFinalUrl;
          }
        } catch (error) {
          report.attachment_url = attachmentUrl;
          report.attachment_error = String(error?.message || error);
        }
      }
    }
    await fs.writeFile(finalArtifactPath, finalBytes);
    const relArtifactPath = path.relative(root, finalArtifactPath).replaceAll("\\", "/");

    Object.assign(report, {
      artifact_type: finalArtifactType,
      download_status: blockedWechat ? "external_platform_limited" : "downloaded",
      parse_status: blockedWechat ? "blocked_external_platform" : "pending_parse",
      confidence: blockedWechat ? "none" : "pending",
      artifact_path: relArtifactPath,
      artifact_meta_path: relMetaPath,
      landing_page_path: landingPagePath || undefined,
      final_url: finalUrl,
      http_status: response.status,
      content_type: finalContentType,
      content_length: finalBytes.length,
      content_sha256: finalSha256,
      landing_page_sha256: landingPagePath ? sha256 : undefined,
      last_checked_at: now
    });
    await saveMeta(metaPath, { ...report, cached_at: now });
    return report.download_status;
  } catch (error) {
    Object.assign(report, {
      artifact_type: detectArtifactType(report.report_url, ""),
      download_status: error?.name === "AbortError" ? "fetch_timeout" : "fetch_failed",
      parse_status: "download_failed",
      confidence: "none",
      fetch_error: String(error?.message || error),
      last_checked_at: now
    });
    return report.download_status;
  }
};

const runQueue = async (items, worker) => {
  let index = 0;
  const results = [];
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const current = items[index++];
      const result = await worker(current);
      results.push(result);
      if (results.length % 10 === 0 || results.length === items.length) {
        console.log(`Downloaded/checkpoint ${results.length}/${items.length}`);
      }
    }
  });
  await Promise.all(workers);
  return results;
};

const payload = await readJson(targetFile);
const reports = (payload.reports || []).slice(0, limit || undefined);
const statuses = await runQueue(reports, downloadOne);

payload.artifact_cache = {
  root: "raw/employment-reports",
  updated_at: new Date().toISOString(),
  target_file: targetFile,
  scope_count: reports.length
};
await writeJson(targetFile, payload);

const counts = statuses.reduce((acc, status) => {
  acc[status] = (acc[status] || 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({ file: targetFile, total: reports.length, counts }, null, 2));
