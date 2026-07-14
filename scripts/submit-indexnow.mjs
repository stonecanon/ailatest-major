import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const dataDir = path.join(root, "data");

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

const indexNow = JSON.parse(await fs.readFile(path.join(dataDir, "indexnow.json"), "utf8"));
const submit = args.has("--submit");
const endpoint = String(args.get("--endpoint") || indexNow.endpoint);
const site = new URL(String(args.get("--site") || "https://major.ailatest.org"));
const limit = Number(args.get("--limit") || 0);

const sitemapXml = await fs.readFile(path.join(dist, "sitemap.xml"), "utf8");
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const urlList = sitemapUrls
  .map((value) => {
    const url = new URL(value);
    url.protocol = site.protocol;
    url.host = site.host;
    return url.toString();
  })
  .filter((value, index, array) => array.indexOf(value) === index)
  .slice(0, limit > 0 ? limit : undefined);

if (!urlList.length) {
  throw new Error("No URLs found in dist/sitemap.xml. Run npm run build first.");
}

const keyLocation = new URL(indexNow.key_file, site).toString();
const payload = {
  host: site.host,
  key: indexNow.key,
  keyLocation,
  urlList
};

console.log(`IndexNow target: ${endpoint}`);
console.log(`Host: ${payload.host}`);
console.log(`Key location: ${payload.keyLocation}`);
console.log(`URLs: ${urlList.length}`);

if (!submit) {
  console.log("Dry run only. Add --submit to send URLs.");
  console.log(JSON.stringify({ ...payload, urlList: urlList.slice(0, 10) }, null, 2));
  if (urlList.length > 10) console.log(`...and ${urlList.length - 10} more URLs`);
  process.exit(0);
}

const keyResponse = await fetch(keyLocation, { redirect: "follow" });
if (!keyResponse.ok) {
  throw new Error(`Cannot verify IndexNow key file at ${keyLocation}: HTTP ${keyResponse.status}`);
}
const remoteKey = (await keyResponse.text()).trim();
if (remoteKey !== indexNow.key) {
  throw new Error(`IndexNow key file mismatch at ${keyLocation}`);
}

for (let index = 0; index < urlList.length; index += 10000) {
  const chunk = urlList.slice(index, index + 10000);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ...payload, urlList: chunk })
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`IndexNow submission failed: HTTP ${response.status} ${body}`);
  }
  console.log(`Submitted ${chunk.length} URLs: HTTP ${response.status}`);
}
