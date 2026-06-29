import { handleOpenAiApi, withOpenAiError } from "../../lib/openai-core.mjs";

export default async function handler(req, res) {
  return withOpenAiError(req, res, () => handleOpenAiApi(req, res, new URL("/api/openai/ppm-plan", "https://vercel.local")));
}
