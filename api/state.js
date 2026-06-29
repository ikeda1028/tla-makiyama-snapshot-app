import { handleStateApi, withStateError } from "../lib/state-core.mjs";

export default async function handler(req, res) {
  const requestUrl = new URL(req.url || "/api/state", "https://vercel.local");
  return withStateError(req, res, () => handleStateApi(req, res, requestUrl));
}
