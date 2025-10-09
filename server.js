// server.js
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import fs from "fs/promises";
import { fileURLToPath } from "url";

// ------------------------ utils (paths, files) ------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, "dist");
const DATA_DIR = path.join(__dirname, "data");

const ENTRIES_FILE = path.join(DATA_DIR, "rma_entries.json");
const US_STOCK_FILE = path.join(DATA_DIR, "rma_stock_us.json");
const EMEA_STOCK_FILE = path.join(DATA_DIR, "rma_stock_emea.json");

// device list (for dropdowns)
const DEVICE_NAMES = [
  "Ninja","Ninja V","Ninja V Plus","Ninja Ultra","Ninja Phone",
  "Shinobi II","Shinobi 7","Shinobi GO","Shogun Ultra","Shogun Connect",
  "Sumo 19SE","A-Eye PTZ camera","Sun Hood","Master Caddy III","Atomos Connect",
  "AtomX Battery","Ultrasync Blue","AtomFlex HDMI Cable","Atomos Creator Kit 5''",
];

// ensure data dir & files exist
async function ensureDataFiles() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
  for (const f of [ENTRIES_FILE, US_STOCK_FILE, EMEA_STOCK_FILE]) {
    try { await fs.access(f); }
    catch { await fs.writeFile(f, "[]", "utf8"); }
  }
}

// JSON helpers
async function readJson(file) {
  try {
    const txt = await fs.readFile(file, "utf8");
    return JSON.parse(txt || "[]");
  } catch {
    return [];
  }
}
async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

// id helper
function genId(prefix="id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

// csv helpers
function csvEscape(val) {
  if (val === undefined || val === null) return "";
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCSV(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map(r => columns.map(c => csvEscape(r[c])).join(","));
  return "\uFEFF" + [header, ...lines].join("\n");
}

// date helpers
function fmtDateISO(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0,10);
  } catch { return null; }
}
function toMonth(v) { // YYYY-MM
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0,7);
  return d.toISOString().slice(0,7);
}

// ------------------------ session cookie helpers ------------------------
const COOKIE_NAME = "rma_sess";
function buildCookieString(name, value, { maxAge, secure = true } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  if (typeof maxAge === "number") parts.push(`Max-Age=${maxAge}`);
  return parts.join("; ");
}
function setSessionCookie(res, session, { maxDays = 30 } = {}) {
  const value = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const maxAge = maxDays * 24 * 3600;
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const cookie = buildCookieString(COOKIE_NAME, value, { maxAge, secure: isProd });
  res.setHeader("Set-Cookie", cookie);
}
function clearSessionCookie(res) {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const cookie = buildCookieString(COOKIE_NAME, "", { maxAge: 0, secure: isProd });
  res.setHeader("Set-Cookie", cookie);
}
function getSessionFromCookie(req) {
  const raw = (req.cookies || {})[COOKIE_NAME];
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch { return null; }
}
function requireAdmin(req, res, next) {
  const s = getSessionFromCookie(req);
  if (!s || s.role !== "admin") return res.status(401).json({ error: "Admin required" });
  req.session = s;
  next();
}
function requireAny(req, res, next) {
  const s = getSessionFromCookie(req);
  if (!s) return res.status(401).json({ error: "Not authenticated" });
  req.session = s;
  next();
}

// ------------------------ app bootstrap ------------------------
await ensureDataFiles();

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// Dev CORS for Vite + LAN
if (process.env.NODE_ENV !== "production") {
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (/^http:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+):5173$/.test(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  }));
}

// ------------------------ auth routes ------------------------
app.post("/api/internal-login", async (req, res) => {
  const { email, password } = req.body || {};
  if (email?.toLowerCase() === "internal@mahimedisolutions.com" && password === "mahimediasolutions") {
    const session = { role: "admin", user: { email, name: "Internal Admin" }, source: "internal" };
    setSessionCookie(res, session);
    return res.json({ ok: true, role: "admin", user: session.user });
  }
  return res.status(401).json({ ok: false, error: "Invalid internal credentials" });
});

app.post("/api/viewer-login", async (req, res) => {
  const { email, password } = req.body || {};
  if (email?.toLowerCase() === "rush@mahimediasolutions.com" && password === "aamirtest") {
    const session = { role: "viewer", user: { email, name: "Rush Viewer" }, source: "viewer" };
    setSessionCookie(res, session);
    return res.json({ ok: true, role: "viewer", user: session.user });
  }
  return res.status(401).json({ ok: false, error: "Invalid viewer credentials" });
});

app.get("/api/session", (req, res) => {
  const s = getSessionFromCookie(req);
  if (!s) return res.status(401).json({ error: "No session" });
  return res.json({ ok: true, role: s.role || "viewer", user: s.user || null });
});

app.post("/api/logout", (req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

// ------------------------ RMA entries ------------------------
// GET /api/rma/entries?month=YYYY-MM&category=
app.get("/api/rma/entries", requireAny, async (req, res) => {
  const month = (req.query.month || "").trim();
  const category = (req.query.category || "").trim();
  const items = await readJson(ENTRIES_FILE);
  let entries = items;
  if (month) {
    entries = entries.filter(e => toMonth(e.entry_date || e.created_at) === month);
  }
  if (category) {
    entries = entries.filter(e => (e.category || "") === category);
  }
  return res.json({ entries });
});

// POST /api/rma/entries
app.post("/api/rma/entries", requireAny, async (req, res) => {
  const body = req.body || {};
  const now = new Date().toISOString();
  const entry = {
    id: genId("rma"),
    entry_date: fmtDateISO(body.entry_date) || now.slice(0,10),
    ticket_id: body.ticket_id || "",
    first_name: body.first_name || "",
    last_name: body.last_name || "",
    email: body.email || "",
    phone: body.phone || "",
    company: body.company || "",
    reseller_customer: body.reseller_customer || "",
    address1: body.address1 || "",
    address2: body.address2 || "",
    city: body.city || "",
    state: body.state || "",
    country: body.country || "",
    postcode: body.postcode || "",
    product_with_fault: body.product_with_fault || "",
    serial_number: body.serial_number || "",
    product_sku: body.product_sku || "",
    device_name: body.device_name || "",
    rma_type: body.rma_type || "",
    stock_type: body.stock_type || "",
    quantity: Number(body.quantity) || 0,
    returned_reason: body.returned_reason || "",
    action: body.action || "",
    custom_tracking: body.custom_tracking || "",
    rma_no: body.rma_no || "",
    replacement_tracking: body.replacement_tracking || "",
    category: body.category || "",
    organization: body.organization || "",
    created_at: now,
    updated_at: now,
  };
  const items = await readJson(ENTRIES_FILE);
  items.push(entry);
  await writeJson(ENTRIES_FILE, items);
  return res.json({ ok: true, entry });
});

// PUT /api/rma/entries/:id
app.put("/api/rma/entries/:id", requireAny, async (req, res) => {
  const { id } = req.params;
  const patch = req.body || {};
  const items = await readJson(ENTRIES_FILE);
  const idx = items.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const merged = { ...items[idx], ...patch, entry_date: fmtDateISO(patch.entry_date) ?? items[idx].entry_date, updated_at: new Date().toISOString() };
  items[idx] = merged;
  await writeJson(ENTRIES_FILE, items);
  return res.json({ ok: true, entry: merged });
});

// DELETE /api/rma/entries/:id
app.delete("/api/rma/entries/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const items = await readJson(ENTRIES_FILE);
  const next = items.filter(e => e.id !== id);
  await writeJson(ENTRIES_FILE, next);
  return res.json({ ok: true });
});

// POST /api/rma/entries/import  body: { items: [...] }
app.post("/api/rma/entries/import", requireAdmin, async (req, res) => {
  const { items = [] } = req.body || {};
  const now = new Date().toISOString();
  let imported = 0;
  let failed = 0;
  const report = [];

  const existing = await readJson(ENTRIES_FILE);
  for (const raw of items) {
    try {
      const e = {
        id: genId("rma"),
        entry_date: fmtDateISO(raw.entry_date) || now.slice(0,10),
        ticket_id: raw.ticket_id || "",
        first_name: raw.first_name || "",
        last_name: raw.last_name || "",
        email: raw.email || "",
        phone: raw.phone || "",
        company: raw.company || "",
        reseller_customer: raw.reseller_customer || "",
        address1: raw.address1 || "",
        address2: raw.address2 || "",
        city: raw.city || "",
        state: raw.state || "",
        country: raw.country || "",
        postcode: raw.postcode || "",
        product_with_fault: raw.product_with_fault || "",
        serial_number: raw.serial_number || "",
        product_sku: raw.product_sku || "",
        device_name: raw.device_name || "",
        rma_type: raw.rma_type || "",
        stock_type: raw.stock_type || "",
        quantity: Number(raw.quantity) || 0,
        returned_reason: raw.returned_reason || "",
        action: raw.action || "",
        custom_tracking: raw.custom_tracking || "",
        rma_no: raw.rma_no || "",
        replacement_tracking: raw.replacement_tracking || "",
        category: raw.category || "",
        organization: raw.organization || "",
        created_at: now,
        updated_at: now,
      };
      existing.push(e);
      imported++;
    } catch (err) {
      failed++;
      report.push({ item: raw, error: err?.message || "Unknown import error" });
    }
  }
  await writeJson(ENTRIES_FILE, existing);
  const status = failed > 0 && imported > 0 ? 207 : 200;
  return res.status(status).json({ ok: failed === 0, imported, failed, report });
});

// GET /api/rma/entries/template.csv
app.get("/api/rma/entries/template.csv", requireAny, async (req, res) => {
  const headers = [
    "Date","Ticket","First Name","Last Name","Email","Phone","Company (if Applicable)","Reseller / Customer",
    "Address 1","Address 2","City","State (use 2 digit code)","Country","Post Code",
    "Product with fault","Serial Number of faulty product","Product SKU for replacement (no more ninja's without my approval)",
    "Device Name","RMA Type","Stock Type","Quantity","Return Reason (Subject)","Action",
    "Customer Return Tracking Number (REQUIRED)","RMA NO# (from RO)","New Order # (Dream) if Warranty Repalcement / Reshipment (from RO)","Category","Organization"
  ];
  const csv = "\uFEFF" + headers.join(",") + "\n";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=rma_entries_template.csv");
  return res.send(csv);
});

// GET /api/rma/entries/export.csv
app.get("/api/rma/entries/export.csv", requireAny, async (req, res) => {
  const month = (req.query.month || "").trim();
  const category = (req.query.category || "").trim();
  let entries = await readJson(ENTRIES_FILE);
  if (month) entries = entries.filter(e => toMonth(e.entry_date || e.created_at) === month);
  if (category) entries = entries.filter(e => (e.category || "") === category);

  const cols = [
    "id","entry_date","rma_no","ticket_id","first_name","last_name","email","phone","company","reseller_customer",
    "address1","address2","city","state","country","postcode","product_with_fault","serial_number",
    "product_sku","device_name","category","rma_type","stock_type","quantity","returned_reason","action",
    "custom_tracking","replacement_tracking","created_at","updated_at","organization"
  ];
  const csv = toCSV(entries, cols);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=RMA_Entries_${month || "all"}.csv`);
  return res.send(csv);
});

// ------------------------ RMA stock (US / EMEA) ------------------------
// helpers
async function listStock(file, month, device) {
  let items = await readJson(file);
  if (month) items = items.filter(r => (r.month || "") === month);
  if (device) items = items.filter(r => (r.device_name || "") === device);
  return items;
}
function numberizeAll(obj) {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) out[k] = Number(v);
  }
  return out;
}

// DEVICES (US)
app.get("/api/rma/us/devices", requireAny, async (req, res) => {
  // union of known DEVICE_NAMES and any device_name present in US stock
  const stock = await readJson(US_STOCK_FILE);
  const found = [...new Set(stock.map(s => s.device_name).filter(Boolean))];
  const devices = Array.from(new Set([...DEVICE_NAMES, ...found])).sort();
  return res.json({ devices });
});

// STOCK LIST (US)
app.get("/api/rma/us/stock", requireAny, async (req, res) => {
  const month = (req.query.month || "").trim();
  const device = (req.query.device_name || "").trim();
  const items = await listStock(US_STOCK_FILE, month, device);
  return res.json({ items });
});

// STOCK CREATE (US)
app.post("/api/rma/us/stock", requireAny, async (req, res) => {
  const body = numberizeAll(req.body || {});
  const items = await readJson(US_STOCK_FILE);
  const row = {
    id: genId("us"),
    month: body.month || toMonth(new Date().toISOString()),
    device_name: body.device_name || "—",
    d_stock_received: Number(body.d_stock_received)||0,
    b_stock_received: Number(body.b_stock_received)||0,
    new_stock_sent: Number(body.new_stock_sent)||0,
    rma_bstock_rstock_sent: Number(body.rma_bstock_rstock_sent)||0,
    a_stock_received: Number(body.a_stock_received)||0,
    awaiting_delivery_from_user: Number(body.awaiting_delivery_from_user)||0,
    receive_only: Number(body.receive_only)||0,
    awaiting_return_from_rush: Number(body.awaiting_return_from_rush)||0,
    notes: body.notes || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  items.push(row);
  await writeJson(US_STOCK_FILE, items);
  return res.json({ ok: true, row });
});

// STOCK UPDATE (US)
app.put("/api/rma/us/stock/:id", requireAny, async (req, res) => {
  const { id } = req.params;
  const patch = numberizeAll(req.body || {});
  const items = await readJson(US_STOCK_FILE);
  const i = items.findIndex(r => r.id === id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  items[i] = { ...items[i], ...patch, updated_at: new Date().toISOString() };
  await writeJson(US_STOCK_FILE, items);
  return res.json({ ok: true, row: items[i] });
});

// STOCK DELETE (US)
app.delete("/api/rma/us/stock/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const items = await readJson(US_STOCK_FILE);
  const next = items.filter(r => r.id !== id);
  await writeJson(US_STOCK_FILE, next);
  return res.json({ ok: true });
});

// DEVICES (EMEA)
app.get("/api/rma/emea/devices", requireAny, async (req, res) => {
  const stock = await readJson(EMEA_STOCK_FILE);
  const found = [...new Set(stock.map(s => s.device_name).filter(Boolean))];
  const devices = Array.from(new Set([...DEVICE_NAMES, ...found])).sort();
  return res.json({ devices });
});

// STOCK LIST (EMEA)
app.get("/api/rma/emea/stock", requireAny, async (req, res) => {
  const month = (req.query.month || "").trim();
  const device = (req.query.device_name || "").trim();
  const items = await listStock(EMEA_STOCK_FILE, month, device);
  return res.json({ items });
});

// STOCK CREATE (EMEA)
app.post("/api/rma/emea/stock", requireAny, async (req, res) => {
  const body = numberizeAll(req.body || {});
  const items = await readJson(EMEA_STOCK_FILE);
  const row = {
    id: genId("emea"),
    month: body.month || toMonth(new Date().toISOString()),
    device_name: body.device_name || "—",
    d_stock_received: Number(body.d_stock_received)||0,
    b_stock_received: Number(body.b_stock_received)||0,
    new_stock_sent: Number(body.new_stock_sent)||0,
    rma_bstock_rstock_sent: Number(body.rma_bstock_rstock_sent)||0,
    awaiting_delivery_from_user: Number(body.awaiting_delivery_from_user)||0,
    receiving_only: Number(body.receiving_only)||0,
    awaiting_return_from_rush: Number(body.awaiting_return_from_rush)||0,
    notes: body.notes || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  items.push(row);
  await writeJson(EMEA_STOCK_FILE, items);
  return res.json({ ok: true, row });
});

// STOCK UPDATE (EMEA)
app.put("/api/rma/emea/stock/:id", requireAny, async (req, res) => {
  const { id } = req.params;
  const patch = numberizeAll(req.body || {});
  const items = await readJson(EMEA_STOCK_FILE);
  const i = items.findIndex(r => r.id === id);
  if (i === -1) return res.status(404).json({ error: "Not found" });
  items[i] = { ...items[i], ...patch, updated_at: new Date().toISOString() };
  await writeJson(EMEA_STOCK_FILE, items);
  return res.json({ ok: true, row: items[i] });
});

// STOCK DELETE (EMEA)
app.delete("/api/rma/emea/stock/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const items = await readJson(EMEA_STOCK_FILE);
  const next = items.filter(r => r.id !== id);
  await writeJson(EMEA_STOCK_FILE, next);
  return res.json({ ok: true });
});

// ------------------------ static (prod) ------------------------
app.use(express.static(DIST_DIR));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

// ------------------------ start ------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API listening on http://0.0.0.0:${PORT}`);
});
