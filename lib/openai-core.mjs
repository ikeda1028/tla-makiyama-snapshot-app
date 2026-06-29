const openAiBase = "https://api.openai.com/v1";

const ppmPlanningSteps = ["IMAGE PLANNING", "PILOT PLANNING", "MASTER PLANNING", "IMPLEMENTATION PLANNING"];
const ppmParameters = [
  "MARKETING",
  "TECHNOLOGY",
  "STAKEHOLDERS ANALYSIS",
  "INVESTMENT & FINANCE",
  "REGULATION",
  "HUMAN RESOURCE",
  "PROCESS MANAGEMENT",
  "DECISION MAKING SYSTEM"
];

function openAiToken() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return process.env.OPENAI_API_KEY;
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("access-control-allow-origin", process.env.CORS_ORIGIN || "*");
  res.setHeader("access-control-allow-methods", "POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function ppmPrompt() {
  return [
    "あなたは牧山式PROJECT PROCESS MANAGEMENT(PPM)を使うプロジェクト設計AIです。",
    "入力されたプロジェクト名と概要から、発生するタスク、作業量、全体価値、リスク、意思決定ポイントを日本語で設計してください。",
    `PLANNING STEP: ${ppmPlanningSteps.join(", ")}`,
    `PARAMETER: ${ppmParameters.join(", ")}`,
    "作業量は貢献度ポイントに転用できるよう、各タスクに workload_points を 5〜40 の整数で付けてください。",
    "value_score は実現可能性、社会的/事業的価値、関係者合意、継続性を総合した 0〜100 の整数にしてください。",
    "出力は指定JSONスキーマに厳密に従ってください。"
  ].join("\n");
}

function ppmSchema() {
  const task = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      ppm_stage: { type: "string", enum: ppmPlanningSteps },
      parameter: { type: "string", enum: ppmParameters },
      description: { type: "string" },
      deliverable: { type: "string" },
      workload_points: { type: "integer" },
      value_points: { type: "integer" },
      priority: { type: "string", enum: ["高", "中", "低"] }
    },
    required: ["title", "ppm_stage", "parameter", "description", "deliverable", "workload_points", "value_points", "priority"]
  };
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      project_name: { type: "string" },
      overview: { type: "string" },
      ppm_stages: { type: "array", items: { type: "string" } },
      value_score: { type: "integer" },
      tasks: { type: "array", minItems: 5, maxItems: 10, items: task },
      risks: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
      decision_points: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } }
    },
    required: ["project_name", "overview", "ppm_stages", "value_score", "tasks", "risks", "decision_points"]
  };
}

function outputText(data) {
  return data.output_text ?? data.output?.flatMap((item) => item.content ?? []).find((part) => part.type === "output_text")?.text;
}

export async function handleOpenAiApi(req, res, url) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (url.pathname !== "/api/openai/ppm-plan" || req.method !== "POST") return false;

  const body = await readJson(req);
  if (!body.project_name || !body.summary) {
    throw new Error("project_name and summary are required");
  }

  const payload = {
    model: body.model || process.env.OPENAI_MODEL || "gpt-5.5",
    instructions: ppmPrompt(),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `プロジェクト名: ${body.project_name}\n概要: ${body.summary}`
          }
        ]
      }
    ],
    reasoning: { effort: "medium" },
    text: {
      format: {
        type: "json_schema",
        name: "ppm_project_design",
        strict: true,
        schema: ppmSchema()
      }
    }
  };

  const response = await fetch(`${openAiBase}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${openAiToken()}`
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error?.message || `OpenAI API error: ${response.status}`;
    throw new Error(message);
  }

  const text = outputText(data);
  if (!text) throw new Error("AI output was empty");
  return sendJson(res, 200, { analysis: JSON.parse(text) });
}

export async function withOpenAiError(req, res, handler) {
  try {
    return await handler();
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
}
