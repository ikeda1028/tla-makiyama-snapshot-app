const keyPrefix = "tla-makiyama-snapshot";

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("access-control-allow-origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN are not set");
  }
  return { url, token };
}

function stateKey(key = "default") {
  const safe = String(key || "default").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 80) || "default";
  return `${keyPrefix}:${safe}`;
}

async function redis(command) {
  const { url, token } = kvConfig();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(command)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error || `KV API error: ${response.status}`);
  }
  return data.result;
}

export async function handleStateApi(req, res, url) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (url.pathname !== "/api/state") return false;

  if (req.method === "GET") {
    const result = await redis(["GET", stateKey(url.searchParams.get("key"))]);
    return sendJson(res, 200, result ? JSON.parse(result) : { state: null, savedAt: null });
  }

  if (req.method === "POST") {
    const body = await readJson(req);
    if (!body.state || typeof body.state !== "object") throw new Error("state is required");
    const savedAt = new Date().toISOString();
    const record = {
      state: body.state,
      savedAt,
      version: 1
    };
    await redis(["SET", stateKey(body.key), JSON.stringify(record)]);
    return sendJson(res, 200, { savedAt });
  }

  return sendJson(res, 405, { error: "Method not allowed" });
}

export async function withStateError(req, res, handler) {
  try {
    return await handler();
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}
