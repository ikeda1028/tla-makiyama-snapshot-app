const asanaBase = "https://app.asana.com/api/1.0";

export function token() {
  if (!process.env.ASANA_ACCESS_TOKEN) {
    throw new Error("ASANA_ACCESS_TOKEN is not set");
  }
  return process.env.ASANA_ACCESS_TOKEN;
}

export function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("access-control-allow-origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.end(JSON.stringify(data));
}

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function asana(path, options = {}) {
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

export async function createTask(projectGid, sectionMap, task) {
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

export function ppmTaskId(notes = "") {
  return notes.match(/PPM Task ID:\s*([^\s]+)/)?.[1] || "";
}

export async function handleAsanaApi(req, res, url) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});

  if (url.pathname === "/api/asana/me" && req.method === "GET") {
    const me = await asana("/users/me");
    return sendJson(res, 200, { gid: me.gid, name: me.name, email: me.email });
  }

  if (url.pathname === "/api/asana/workspaces" && req.method === "GET") {
    const me = await asana("/users/me?opt_fields=workspaces.gid,workspaces.name");
    return sendJson(res, 200, {
      workspaces: (me.workspaces || []).map((workspace) => ({
        gid: workspace.gid,
        name: workspace.name
      }))
    });
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
    return sendJson(res, 200, { gid: project.gid, name: project.name });
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
    return sendJson(res, 200, { tasks });
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
    return sendJson(res, 200, {
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

export async function withApiError(req, res, handler) {
  try {
    return await handler();
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}
