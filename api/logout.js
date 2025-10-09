export const config = { runtime: 'nodejs' }
import { clearSession } from "./_session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  clearSession(res);
  res.status(200).json({ ok: true });
}
