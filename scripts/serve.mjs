import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.resolve(root, process.argv[2] || "dist");
const port = Number(process.argv[3] || 4173);

const types = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

const resolveRequest = async (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const safePath = decoded.replace(/^\/+/, "");
  const candidates = [
    path.join(dir, safePath),
    path.join(dir, safePath, "index.html"),
    path.join(dir, "index.html")
  ];
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (!resolved.startsWith(dir)) continue;
    try {
      const stat = await fs.stat(resolved);
      if (stat.isFile()) return resolved;
    } catch {
      // Try next candidate.
    }
  }
  return null;
};

http
  .createServer(async (request, response) => {
    const file = await resolveRequest(request.url || "/");
    if (!file) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    const ext = path.extname(file);
    response.writeHead(200, {
      "content-type": types.get(ext) || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-store" : "public, max-age=60"
    });
    response.end(await fs.readFile(file));
  })
  .listen(port, () => {
    console.log(`Serving ${dir} at http://localhost:${port}`);
  });
