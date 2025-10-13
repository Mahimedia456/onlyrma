export const config = { runtime: "nodejs" };
import { ok, send, parseCookies } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method Not Allowed" });
  const cookies = parseCookies(req);
  if (cookies.rma_sess) {
    // If you want role-aware cookie, swap to a JSON/base64 like the server version you had.
    return ok(res, { ok: true, role: "admin", user: { email: "internal@mahimedisolutions.com" } });
  }
  return send(res, 401, { error: "No session" });
}
