// /api/_lib.js
export function ok(res, body) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
export function send(res, status, body, type = "application/json") {
  res.statusCode = status;
  res.setHeader("Content-Type", type);
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}
export function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); }
      catch { resolve({}); }
    });
  });
}
export function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((a, p) => {
    const [k, v] = p.split("=").map((s) => s && s.trim());
    if (!k) return a;
    a[k] = decodeURIComponent(v || "");
    return a;
  }, {});
}
export function setCookie(res, name, value, {
  maxAgeDays = 30,
  path = "/",
  sameSite = process.env.VERCEL ? "None" : "Lax",
  httpOnly = true,
  secure = !!process.env.VERCEL,
} = {}) {
  const maxAge = maxAgeDays * 24 * 60 * 60;
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
  ];
  if (secure) parts.push("Secure");
  if (httpOnly) parts.push("HttpOnly");
  res.setHeader("Set-Cookie", parts.join("; "));
}
export function clearCookie(res, name) {
  const secure = !!process.env.VERCEL;
  const parts = [
    `${name}=; Path=/; Max-Age=0; SameSite=${secure ? "None" : "Lax"};`,
    secure ? "Secure;" : "",
    "HttpOnly",
  ];
  res.setHeader("Set-Cookie", parts.join(" "));
}
