export const config = { runtime: "nodejs" };
import { ok, send, parseCookies, setCookie } from "../_lib.js";

export default async function handler(req, res) {
  const cookies = parseCookies(req);
  if (cookies.rma_sess) {
    setCookie(res, "rma_sess", cookies.rma_sess); // extend TTL
    return ok(res, { ok: true, refreshed: true });
  }
  return send(res, 401, { error: "No session" });
}
