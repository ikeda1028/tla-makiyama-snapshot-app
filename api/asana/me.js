import { handleAsanaApi, withApiError } from "../../lib/asana-core.mjs";

export default async function handler(req, res) {
  return withApiError(req, res, () => handleAsanaApi(req, res, new URL("/api/asana/me", "https://vercel.local")));
}
