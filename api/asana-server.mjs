import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { handleAsanaApi, sendJson } from "../lib/asana-core.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const appRoot = join(root, "outputs", "tla-makiyama-snapshot-app");
const port = Number(process.env.PORT || 8787);

async function loadLocalEnv() {
  for (const name of [".env.local", ".env"]) {
    try {
      const text = await readFile(join(root, name), "utf8");
      text.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const index = trimmed.indexOf("=");
        if (index < 0) return;
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
        if (key && process.env[key] == null) process.env[key] = value;
      });
    } catch {
      // Local env files are optional.
    }
  }
}

await loadLocalEnv();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

async function staticFile(res, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const target = normalize(join(appRoot, relative));
  if (!target.startsWith(appRoot)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  try {
    const data = await readFile(target);
    res.writeHead(200, { "content-type": contentTypes[extname(target)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleAsanaApi(req, res, url);
      if (handled !== false) return;
    }
    return staticFile(res, url.pathname);
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}).listen(port, () => {
  console.log(`TLA Makiyama app: http://127.0.0.1:${port}`);
});
