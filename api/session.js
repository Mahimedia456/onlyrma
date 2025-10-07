// /api/session.js
export const config = { runtime: "nodejs" };
import { getSession } from "./_session.js";

/**
 * Returns the logged-in session details to the frontend.
 * - If a Zendesk session is present (e.g. zdUser or zdToken), we elevate role to "admin".
 * - Otherwise we keep whatever the Rush role is (defaults to "viewer" if unknown).
 */
export default async function handler(req, res) {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: "No session" });

  // Heuristics: adjust these to match what you set during Zendesk login.
  const hasZendesk =
    Boolean(s.zdUser) ||
    Boolean(s.zdToken) ||
    // optional: if your Zendesk proxy requires subdomain+email in session:
    (Boolean(s.subdomain) && Boolean(s.email));

  // Preserve Rush role if you store it; otherwise default viewer.
  const rushRole = s.role || "viewer";
  const role = hasZendesk ? "admin" : rushRole;

  res.status(200).json({
    role,
    user: {
      // include anything your UI needs
      email: s.email || null,
      name: s.name || null,
      id: s.userId || null,
    },
    subdomain: s.subdomain || null,
    // helpful for debugging (safe, not secrets)
    providers: {
      zendesk: !!hasZendesk,
      rush: !!s.rushUser, // if you set this in your Rush auth, otherwise drop it
    },
  });
}
