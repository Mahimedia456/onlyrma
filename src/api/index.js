// One-file serverless API for Vercel (Hobby plan friendly).
// Memory-only (resets on cold start). No disk writes on Vercel.

export const config = { runtime: 'nodejs' };

/* ---------------- In-memory stores ---------------- */
let entries = [];   // RMA entries
let emeaStock = []; // EMEA stock rows
let usStock   = []; // US stock rows

/* ---------------- Helpers ---------------- */
function ok(res, body) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
function send(res, status, body, type = "application/json") {
  res.statusCode = status;
  res.setHeader("Content-Type", type);
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

/* ---------------- Cookie helpers ---------------- */
function isProd() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}
function setCookie(
  res,
  name,
  value,
  {
    maxAge = 60 * 60 * 24 * 180, // 180 days
    path = "/",
    sameSite = "Lax",
    httpOnly = true,
    secure = isProd(),
  } = {}
) {
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
function clearCookie(res, name) {
  const parts = [
    `${name}=; Path=/; Max-Age=0; SameSite=Lax;`,
    isProd() ? "Secure;" : "",
    "HttpOnly",
  ];
  res.setHeader("Set-Cookie", parts.join(" "));
}
function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((a, p) => {
    const [k, v] = p.split("=").map((s) => s && s.trim());
    if (!k) return a;
    a[k] = decodeURIComponent(v || "");
    return a;
  }, {});
}

/* ---------------- Session helpers ---------------- */
function getSession(req) {
  const cookies = parseCookies(req);
  const raw = cookies.rma_sess;
  if (!raw) return null;
  try {
    const json =
      /^[A-Za-z0-9\-_]+$/.test(raw) ?
      Buffer.from(raw, "base64url").toString("utf8") :
      raw;
    const s = JSON.parse(json);
    return s?.role ? s : null;
  } catch {
    return null;
  }
}
function requireAny(req, res) {
  const s = getSession(req);
  if (!s) {
    send(res, 401, { error: "Not authenticated" });
    return false;
  }
  req.session = s;
  return true;
}

/* ---------------- Misc utils ---------------- */
function csvEscape(val) {
  if (val === undefined || val === null) return "";
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCSV(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","));
  return "\uFEFF" + [header, ...lines].join("\n");
}
function genId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function toMonth(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 7);
  return d.toISOString().slice(0, 7);
}
function fmtDateISO(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}
function numberizeAll(obj) {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)))
      out[k] = Number(v);
  }
  return out;
}

/* ---------------- Auth/session ---------------- */
async function handleInternalLogin(req, res) {
  if (req.method !== "POST")
    return send(res, 405, { error: "Method Not Allowed" });
  const { email, password } = await readBody(req);
  if (
    email?.toLowerCase() === "internal@mahimedisolutions.com" &&
    password === "mahimediasolutions"
  ) {
    const sess = { role: "admin", user: { email } };
    const val = Buffer.from(JSON.stringify(sess), "utf8").toString("base64url");
    setCookie(res, "rma_sess", val);
    return ok(res, { ok: true, ...sess });
  }
  return send(res, 401, { ok: false, error: "Invalid credentials" });
}
async function handleViewerLogin(req, res) {
  if (req.method !== "POST")
    return send(res, 405, { error: "Method Not Allowed" });
  const { email, password } = await readBody(req);
  if (
    email?.toLowerCase() === "rush@mahimediasolutions.com" &&
    password === "aamirtest"
  ) {
    const sess = { role: "viewer", user: { email } };
    const val = Buffer.from(JSON.stringify(sess), "utf8").toString("base64url");
    setCookie(res, "rma_sess", val);
    return ok(res, { ok: true, ...sess });
  }
  return send(res, 401, { ok: false, error: "Invalid viewer credentials" });
}
function handleSession(req, res) {
  const s = getSession(req);
  if (s) return ok(res, { ok: true, ...s });
  return send(res, 401, { error: "No session" });
}
function handleLogout(_req, res) {
  clearCookie(res, "rma_sess");
  return ok(res, { ok: true });
}
function handleSessionRefresh(req, res) {
  const s = getSession(req);
  if (!s) return send(res, 401, { error: "No session" });
  const val = Buffer.from(JSON.stringify(s), "utf8").toString("base64url");
  setCookie(res, "rma_sess", val);
  return ok(res, { ok: true, refreshed: true });
}

/* ---------------- RMA entries ---------------- */
async function handleEntries(req, res) {
  if (!requireAny(req, res)) return;
  if (req.method === "GET") {
    const u = new URL(req.url, "http://x");
    const month = (u.searchParams.get("month") || "").trim();
    const category = (u.searchParams.get("category") || "").trim();
    let out = entries;
    if (month)
      out = out.filter(
        (e) => toMonth(e.entry_date || e.created_at) === month
      );
    if (category) out = out.filter((e) => (e.category || "") === category);
    return ok(res, { entries: out });
  }
  if (req.method === "POST") {
    const body = await readBody(req);
    const now = new Date().toISOString();
    const entry = {
      id: genId("rma"),
      entry_date: fmtDateISO(body.entry_date) || now.slice(0, 10),
      ...body,
      quantity: Number(body.quantity) || 0,
      created_at: now,
      updated_at: now,
    };
    entries.push(entry);
    return ok(res, { ok: true, entry });
  }
  return send(res, 405, { error: "Method Not Allowed" });
}
async function handleEntryId(req, res, id) {
  if (!requireAny(req, res)) return;
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return send(res, 404, { error: "Not found" });

  if (req.method === "PUT") {
    const patch = await readBody(req);
    entries[idx] = {
      ...entries[idx],
      ...patch,
      updated_at: new Date().toISOString(),
    };
    return ok(res, { ok: true, entry: entries[idx] });
  }
  if (req.method === "DELETE") {
    entries.splice(idx, 1);
    return ok(res, { ok: true });
  }
  return send(res, 405, { error: "Method Not Allowed" });
}

/* ---------------- Stock shared helpers ---------------- */
function filterStock(list, url) {
  const u = new URL(url, "http://x");
  const month = (u.searchParams.get("month") || "").trim();
  const device = (u.searchParams.get("device_name") || "").trim();
  let out = list;
  if (month) out = out.filter((r) => (r.month || "") === month);
  if (device) out = out.filter((r) => (r.device_name || "") === device);
  return out;
}

/* ---------------- EMEA stock ---------------- */
async function handleEmeaStock(req, res) {
  if (!requireAny(req, res)) return;
  if (req.method === "GET") return ok(res, { items: filterStock(emeaStock, req.url) });
  if (req.method === "POST") {
    const body = numberizeAll(await readBody(req));
    const row = {
      id: genId("emea"),
      month: body.month || toMonth(new Date().toISOString()),
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    emeaStock.push(row);
    return ok(res, { ok: true, row });
  }
  return send(res, 405, { error: "Method Not Allowed" });
}
async function handleEmeaStockId(req, res, id) {
  if (!requireAny(req, res)) return;
  const idx = emeaStock.findIndex((r) => r.id === id);
  if (idx === -1) return send(res, 404, { error: "Not found" });
  if (req.method === "PUT") {
    const patch = numberizeAll(await readBody(req));
    emeaStock[idx] = { ...emeaStock[idx], ...patch, updated_at: new Date().toISOString() };
    return ok(res, { ok: true });
  }
  if (req.method === "DELETE") {
    emeaStock.splice(idx, 1);
    return ok(res, { ok: true });
  }
  return send(res, 405, { error: "Method Not Allowed" });
}

/* ---------------- US stock ---------------- */
async function handleUsStock(req, res) {
  if (!requireAny(req, res)) return;
  if (req.method === "GET") return ok(res, { items: filterStock(usStock, req.url) });
  if (req.method === "POST") {
    const body = numberizeAll(await readBody(req));
    const row = {
      id: genId("us"),
      month: body.month || toMonth(new Date().toISOString()),
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    usStock.push(row);
    return ok(res, { ok: true, row });
  }
  return send(res, 405, { error: "Method Not Allowed" });
}
async function handleUsStockId(req, res, id) {
  if (!requireAny(req, res)) return;
  const idx = usStock.findIndex((r) => r.id === id);
  if (idx === -1) return send(res, 404, { error: "Not found" });
  if (req.method === "PUT") {
    const patch = numberizeAll(await readBody(req));
    usStock[idx] = { ...usStock[idx], ...patch, updated_at: new Date().toISOString() };
    return ok(res, { ok: true });
  }
  if (req.method === "DELETE") {
    usStock.splice(idx, 1);
    return ok(res, { ok: true });
  }
  return send(res, 405, { error: "Method Not Allowed" });
}

/* ---------------- Main handler / router ---------------- */
export default async function handler(req, res) {
  const path = (req.url.split("?")[0] || "");

  // auth
  if (path === "/api/internal-login") return handleInternalLogin(req, res);
  if (path === "/api/viewer-login") return handleViewerLogin(req, res);
  if (path === "/api/session" && req.method === "GET") return handleSession(req, res);
  if (path === "/api/logout") return handleLogout(req, res);
  if (path === "/api/session/refresh") return handleSessionRefresh(req, res);

  // entries
  if (path === "/api/rma/entries") return handleEntries(req, res);
  const entryId = path.match(/^\/api\/rma\/entries\/([^/]+)$/);
  if (entryId) return handleEntryId(req, res, entryId[1]);

  // emea
  if (path === "/api/rma/emea/stock") return handleEmeaStock(req, res);
  const emeaId = path.match(/^\/api\/rma\/emea\/stock\/([^/]+)$/);
  if (emeaId) return handleEmeaStockId(req, res, emeaId[1]);

  // us
  if (path === "/api/rma/us/stock") return handleUsStock(req, res);
  const usId = path.match(/^\/api\/rma\/us\/stock\/([^/]+)$/);
  if (usId) return handleUsStockId(req, res, usId[1]);

  return send(res, 404, { error: "Not Found" });
}
