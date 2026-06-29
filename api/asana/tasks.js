import { handleAsanaApi, withApiError } from "../../lib/asana-core.mjs";

export default async function handler(req, res) {
  const requestUrl = new URL(req.url || "/api/asana/tasks", "https://vercel.local");
  return withApiError(req, res, () => handleAsanaApi(req, res, requestUrl));
}
