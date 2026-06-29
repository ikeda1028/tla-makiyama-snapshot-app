import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const appRoot = join(root, "outputs", "tla-makiyama-snapshot-app");
const port = Number(process.env.PORT || 8787);
const asanaBase = "https://app.asana.com/api/1.0";

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

function json(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": process.env.CORS_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  res.end(JSON.stringify(data));
}

function token() {
  if (!process.env.ASANA_ACCESS_TOKEN) {
    throw new Error("ASANA_ACCESS_TOKEN is not set");
  }
  return process.env.ASANA_ACCESS_TOKEN;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function asana(path, options = {}) {
  const response = await fetch(`${asanaBase}${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token()}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.errors?.[0]?.message || `Asana API error: ${response.status}`;
    throw new Error(message);
  }
  return data.data;
}

async function createSection(projectGid, name) {
  const data = await asana(`/projects/${projectGid}/sections`, {
    method: "POST",
    body: JSON.stringify({ data: { name } })
  });
  return data.gid;
}

async function createTask(projectGid, sectionMap, task) {
  const data = await asana("/tasks", {
    method: "POST",
    body: JSON.stringify({
      data: {
        name: task.name,
        notes: task.notes,
        projects: [projectGid],
        due_on: task.due_on || undefined
      }
    })
  });
  if (task.section_name) {
    const sectionGid = sectionMap.get(task.section_name) || await createSection(projectGid, task.section_name);
    sectionMap.set(task.section_name, sectionGid);
    await asana(`/sections/${sectionGid}/addTask`, {
      method: "POST",
      body: JSON.stringify({ data: { task: data.gid } })
    });
  }
  return { local_id: task.local_id, gid: data.gid, name: data.name };
}

function ppmTaskId(notes = "") {
  return notes.match(/PPM Task ID:\s*([^\s]+)/)?.[1] || "";
}

async function api(req, res, url) {
  if (req.method === "OPTIONS") return json(res, 204, {});

  if (url.pathname === "/api/asana/me" && req.method === "GET") {
    const me = await asana("/users/me");
    return json(res, 200, { gid: me.gid, name: me.name, email: me.email });
  }

  if (url.pathname === "/api/asana/projects" && req.method === "POST") {
    const body = await readJson(req);
    const workspace = body.workspace_gid || process.env.ASANA_WORKSPACE_GID;
    if (!workspace) throw new Error("workspace_gid is required");
    const project = await asana("/projects", {
      method: "POST",
      body: JSON.stringify({
        data: {
          name: body.name || "PPM Project",
          notes: body.notes || "",
          workspace
        }
      })
    });
    return json(res, 200, { gid: project.gid, name: project.name });
  }

  if (url.pathname === "/api/asana/tasks/bulk" && req.method === "POST") {
    const body = await readJson(req);
    if (!body.project_gid) throw new Error("project_gid is required");
    if (!Array.isArray(body.tasks)) throw new Error("tasks must be an array");
    const sectionMap = new Map();
    const tasks = [];
    for (const task of body.tasks) {
      tasks.push(await createTask(body.project_gid, sectionMap, task));
    }
    return json(res, 200, { tasks });
  }

  if (url.pathname === "/api/asana/tasks" && req.method === "GET") {
    const projectGid = url.searchParams.get("project_gid");
    if (!projectGid) throw new Error("project_gid is required");
    const fields = [
      "gid",
      "name",
      "completed",
      "completed_at",
      "modified_at",
      "notes",
      "due_on",
      "memberships.section.name"
    ].join(",");
    const tasks = await asana(`/projects/${projectGid}/tasks?limit=100&opt_fields=${encodeURIComponent(fields)}`);
    return json(res, 200, {
      tasks: tasks.map((task) => ({
        gid: task.gid,
        name: task.name,
        completed: Boolean(task.completed),
        completed_at: task.completed_at,
        modified_at: task.modified_at,
        notes: task.notes || "",
        due_on: task.due_on,
        section_name: task.memberships?.[0]?.section?.name || "",
        ppm_task_id: ppmTaskId(task.notes || "")
      }))
    });
  }

  return false;
}

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
      const handled = await api(req, res, url);
      if (handled !== false) return;
    }
    return staticFile(res, url.pathname);
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
}).listen(port, () => {
  console.log(`TLA Makiyama app: http://127.0.0.1:${port}`);
});
