import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const defaultOutDir = path.join(root, "raw", "source-snapshots");

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith("--")) continue;
  const next = process.argv[index + 1];
  if (!next || next.startsWith("--")) args.set(key, true);
  else {
    args.set(key, next);
    index += 1;
  }
}

const usage = () => {
  console.error("Usage: npm run snapshot:source -- --source-id zhejiang-2025-major-rank-lines");
  console.error("   or: npm run snapshot:source -- --url https://example.edu.cn/file.pdf --source-id optional-id");
  process.exit(1);
};

const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const sanitize = (value) => String(value || "source")
  .normalize("NFKD")
  .toLowerCase()
  .replace(/[^a-z0-9._-]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 120) || "source";

const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

const extensionFrom = (url, contentType = "") => {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname);
  if (ext && ext.length <= 8) return ext.toLowerCase();
  if (contentType.includes("text/html")) return ".html";
  if (contentType.includes("pdf")) return ".pdf";
  if (contentType.includes("spreadsheetml")) return ".xlsx";
  if (contentType.includes("ms-excel")) return ".xls";
  if (contentType.includes("csv")) return ".csv";
  if (contentType.includes("json")) return ".json";
  return ".bin";
};

const absolutize = (href, baseUrl) => {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
};

const extractCandidateAttachments = (text, baseUrl) => {
  const matches = [...text.matchAll(/href\s*=\s*["']([^"']+)["']/gi)];
  const urls = matches
    .map((match) => absolutize(match[1], baseUrl))
    .filter(Boolean)
    .filter((url) => /\.(xls|xlsx|csv|tsv|pdf|zip)(\?|#|$)/i.test(url));
  return [...new Set(urls)];
};

const sources = await readJson(path.join(dataDir, "sources.json"));
const sourceId = args.get("--source-id") || "";
const source = sourceId ? sources.find((item) => item.id === sourceId) : null;
const url = args.get("--url") || source?.url;
if (!url) usage();

const outRoot = path.resolve(root, args.get("--out") || defaultOutDir);
const snapshotId = `${sanitize(sourceId || new URL(url).hostname)}-${timestamp()}`;
const snapshotDir = path.join(outRoot, snapshotId);

const response = await fetch(url, {
  headers: {
    "User-Agent": "majorAI official-source-snapshot/0.1 (+https://major.ailatest.org/data-sources/)"
  },
  redirect: "follow"
});

const arrayBuffer = await response.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);
const contentType = response.headers.get("content-type") || "";
const ext = extensionFrom(response.url, contentType);
const fileName = `source${ext}`;
const filePath = path.join(snapshotDir, fileName);
await fs.mkdir(snapshotDir, { recursive: true });
await fs.writeFile(filePath, buffer);

let candidateAttachments = [];
if (contentType.includes("text/html") || ext === ".html") {
  const text = buffer.toString("utf8");
  candidateAttachments = extractCandidateAttachments(text, response.url);
}

const manifest = {
  snapshot_id: snapshotId,
  fetched_at: new Date().toISOString(),
  source_id: source?.id || sourceId || null,
  source_name: source?.name || null,
  publisher: source?.publisher || null,
  requested_url: url,
  final_url: response.url,
  status: response.status,
  ok: response.ok,
  content_type: contentType,
  bytes: buffer.length,
  sha256: sha256(buffer),
  file: path.relative(root, filePath),
  candidate_attachments: candidateAttachments,
  notes: [
    "Local audit snapshot only. Do not republish raw attachments unless the source explicitly permits redistribution.",
    "Use this manifest to preserve source URL, fetch time, content type and file hash before converting selected fields to import CSV/TSV."
  ]
};

await fs.writeFile(path.join(snapshotDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Snapshot saved: ${path.relative(root, snapshotDir)}`);
console.log(`Status: ${response.status} ${response.statusText}`);
console.log(`Bytes: ${buffer.length}`);
console.log(`SHA256: ${manifest.sha256}`);
if (candidateAttachments.length) {
  console.log("Candidate official attachments:");
  for (const candidate of candidateAttachments) console.log(`- ${candidate}`);
}
