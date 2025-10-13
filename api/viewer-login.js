export const config = { runtime: "nodejs" };
import { ok, send, readBody, setCookie } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method Not Allowed" });
  const { email, password } = await readBody(req);

  const normalized = (email || "").toLowerCase().trim();
  const okEmail = normalized === "rush@mahimediasolutions.com" || normalized === "rush@mahimedia.com";
  if (okEmail && password === "aamirtest") {
    setCookie(res, "rma_sess", "1");
    return ok(res, { ok: true, role: "viewer", user: { email: normalized } });
  }
  return send(res, 401, { ok: false, error: "Invalid viewer credentials" });
}
