export const config = { runtime: "nodejs" };
import { ok, send, parseCookies, setCookie } from "../_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method Not Allowed" });
  const cookies = parseCookies(req);
  if (cookies.rma_sess === "1") {
    setCookie(res, "rma_sess", "1"); // extend TTL
    return ok(res, { ok: true, refreshed: true });
  }
  return send(res, 401, { error: "No session" });
}
