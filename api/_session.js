


export const config = { runtime: "nodejs" };

const COOKIE_NAME = "zd";

function b64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}
function b64urlDecode(str) {
  try { return JSON.parse(Buffer.from(str, "base64url").toString("utf8")); }
  catch { return null; }
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((acc, part) => {
    const [k, v] = part.split("=").map(s => s && s.trim());
    if (!k) return acc;
    acc[k] = decodeURIComponent(v || "");
    return acc;
  }, {});
}

export function getSession(req) {
  const raw = parseCookies(req)[COOKIE_NAME];
  if (!raw) return null;
  const s = b64urlDecode(raw);
  if (!s || !s.email || !s.token || !s.subdomain) return null;
  return s;
}

export function setSession(res, session, { maxDays = 30 } = {}) {
  const value = b64urlEncode(session);
  const maxAge = maxDays * 24 * 3600;
  const cookie = [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    `Max-Age=${maxAge}`
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
}

export function clearSession(res) {
  const cookie = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    "Max-Age=0"
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
}
