export const config = { runtime: "nodejs" };
import { ok, clearCookie } from "./_lib.js";

export default async function handler(_req, res) {
  clearCookie(res, "rma_sess");
  return ok(res, { ok: true });
}
