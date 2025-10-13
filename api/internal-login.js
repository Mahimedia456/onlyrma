export const config = { runtime: "nodejs" };
import { ok, send, readBody, setCookie } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method Not Allowed" });
  const { email, password } = await readBody(req);
  if (email?.toLowerCase().trim() === "internal@mahimediasolutions.com" && password === "mahimediasolutions") {
    setCookie(res, "rma_sess", "1");
    return ok(res, { ok: true, role: "admin", user: { email } });
  }
  return send(res, 401, { ok: false, error: "Invalid credentials" });
}
