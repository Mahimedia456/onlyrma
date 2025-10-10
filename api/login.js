export const config = { runtime: 'nodejs' }
import { setSession } from "./_session.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const { email, token, subdomain } = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");

  if (!email || !token || !subdomain) {
    return res.status(400).json({ error: "email, token, subdomain required" });
  }
  setSession(res, { email, token, subdomain });
  res.status(200).json({ user: { email }, subdomain });
}
