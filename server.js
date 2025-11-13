// server.js
import "dotenv/config";
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import fs from "fs/promises";
import { fileURLToPath } from "url";// ✅ Supabase SERVER client (service role)
// make sure file exists: root/server/supabaseClient.js
import { supa } from "./server/supabaseClient.js";

/* ------------------------ paths ------------------------ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, "dist");
const DATA_DIR = path.join(__dirname, "data");

const ENTRIES_FILE = path.join(DATA_DIR, "rma_entries.json");
const US_STOCK_FILE = path.join(DATA_DIR, "rma_stock_us.json");
const EMEA_STOCK_FILE = path.join(DATA_DIR, "rma_stock_emea.json");

/* ------------------------ constants ------------------------ */
const DEVICE_NAMES = [
  "Ninja","Ninja V","Ninja V Plus","Ninja Ultra","Ninja Phone",
  "Shinobi II","Shinobi 7","Shinobi GO","Shogun Ultra","Shogun Connect",
  "Sumo 19SE","A-Eye PTZ camera","Sun Hood","Master Caddy III","Atomos Connect",
  "AtomX Battery","Ultrasync Blue","AtomFlex HDMI Cable","Atomos Creator Kit 5''",
];

/* ------------------------ bootstrap data files ------------------------ */
async function ensureDataFiles() {
  try { await fs.mkdir(DATA_DIR, { recursive: true }); } catch {}
  for (const f of [ENTRIES_FILE, US_STOCK_FILE, EMEA_STOCK_FILE]) {
    try { await fs.access(f); }
    catch { await fs.writeFile(f, "[]", "utf8"); }
  }
}

/* ------------------------ helpers: json & csv ------------------------ */
async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, "utf8") || "[]"); }
  catch { return []; }
}
async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

function genId(prefix="id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

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
function numberizeAll(obj) {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) out[k] = Number(v);
  }
  return out;
}

/* ------------------------ session cookie helpers ------------------------ */
// Name matches your frontend expectations
const COOKIE_NAME = "rma_sess";

// Build cookie string
function buildCookieString(name, value, { maxAge, secure = true, sameSite = "Lax", httpOnly = true, path = "/" } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `SameSite=${sameSite}`,
  ];
  if (typeof maxAge === "number") parts.push(`Max-Age=${maxAge}`);
  if (secure) parts.push("Secure");
  if (httpOnly) parts.push("HttpOnly");
  return parts.join("; ");
}

// Set cookie with session object (JSON -> base64url)
function setSessionCookie(res, session, { maxDays = 30 } = {}) {
  const value = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const maxAge = maxDays * 24 * 3600;
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const cookie = buildCookieString(COOKIE_NAME, value, {
    maxAge,
    secure: isProd,     // NOT secure on localhost
    sameSite: "Lax",
    httpOnly: true,
    path: "/",
  });
  res.setHeader("Set-Cookie", cookie);
}

// Refresh the cookie TTL without changing contents
function refreshSessionCookie(req, res) {
  const s = getSessionFromCookie(req);
  if (!s) return false;
  setSessionCookie(res, s, { maxDays: 30 });
  return true;
}

// Clear cookie
function clearSessionCookie(res) {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const cookie = buildCookieString(COOKIE_NAME, "", {
    maxAge: 0,
    secure: isProd,
    sameSite: "Lax",
    httpOnly: true,
    path: "/",
  });
  res.setHeader("Set-Cookie", cookie);
}

// Parse cookie -> session object
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

/* ------------------------ app ------------------------ */
await ensureDataFiles();

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// Dev CORS so Vite can send cookies
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

/* ------------------------ AUTH ------------------------ */
app.post("/api/internal-login", async (req, res) => {
  const { email, password } = req.body || {};
  console.log("[internal-login]", email);
  if (email?.toLowerCase().trim() === "internal@mahimediasolutions.com" && password === "mahimediasolutions") {
    const session = { role: "admin", user: { email, name: "Internal Admin" }, source: "internal" };
    setSessionCookie(res, session);
    return res.json({ ok: true, role: "admin", user: session.user });
  }
  return res.status(401).json({ ok: false, error: "Invalid internal credentials" });
});

app.post("/api/viewer-login", async (req, res) => {
  const { email, password } = req.body || {};
  console.log("[viewer-login]", email);
  if (email?.toLowerCase().trim() === "rush@mahimediasolutions.com" && password === "aamirtest") {
    const session = { role: "viewer", user: { email, name: "Rush Viewer" }, source: "viewer" };
    setSessionCookie(res, session);
    return res.json({ ok: true, role: "viewer", user: session.user });
  }
  return res.status(401).json({ ok: false, error: "Invalid viewer credentials" });
});

// keep-alive refresh
app.get("/api/session/refresh", (req, res) => {
  const ok = refreshSessionCookie(req, res);
  if (!ok) return res.status(401).json({ error: "No session" });
  return res.json({ ok: true, refreshed: true });
});

// whoami
app.get("/api/session", (req, res) => {
  const s = getSessionFromCookie(req);
  if (!s) return res.status(401).json({ error: "No session" });
  return res.json({ ok: true, role: s.role, user: s.user });
});

app.post("/api/logout", (req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

/* ------------------------ RMA entries ------------------------ */
app.get("/api/rma/entries", requireAny, async (req, res) => {
  const month = (req.query.month || "").trim();
  const category = (req.query.category || "").trim();
  const items = await readJson(ENTRIES_FILE);
  let entries = items;
  if (month) entries = entries.filter(e => toMonth(e.entry_date || e.created_at) === month);
  if (category) entries = entries.filter(e => (e.category || "") === category);
  return res.json({ entries });
});

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

app.delete("/api/rma/entries/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const items = await readJson(ENTRIES_FILE);
  const next = items.filter(e => e.id !== id);
  await writeJson(ENTRIES_FILE, next);
  return res.json({ ok: true });
});

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

/* ------------------------ RMA stock (US / EMEA) ------------------------ */
async function listStock(file, month, device) {
  let items = await readJson(file);
  if (month) items = items.filter(r => (r.month || "") === month);
  if (device) items = items.filter(r => (r.device_name || "") === device);
  return items;
}

app.get("/api/rma/us/devices", requireAny, async (req, res) => {
  const stock = await readJson(US_STOCK_FILE);
  const found = [...new Set(stock.map(s => s.device_name).filter(Boolean))];
  const devices = Array.from(new Set([...DEVICE_NAMES, ...found])).sort();
  return res.json({ devices });
});

app.get("/api/rma/us/stock", requireAny, async (req, res) => {
  const month = (req.query.month || "").trim();
  const device = (req.query.device_name || "").trim();
  const items = await listStock(US_STOCK_FILE, month, device);
  return res.json({ items });
});

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

app.delete("/api/rma/us/stock/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const items = await readJson(US_STOCK_FILE);
  const next = items.filter(r => r.id !== id);
  await writeJson(US_STOCK_FILE, next);
  return res.json({ ok: true });
});

app.get("/api/rma/emea/devices", requireAny, async (req, res) => {
  const stock = await readJson(EMEA_STOCK_FILE);
  const found = [...new Set(stock.map(s => s.device_name).filter(Boolean))];
  const devices = Array.from(new Set([...DEVICE_NAMES, ...found])).sort();
  return res.json({ devices });
});

app.get("/api/rma/emea/stock", requireAny, async (req, res) => {
  const month = (req.query.month || "").trim();
  const device = (req.query.device_name || "").trim();
  const items = await listStock(EMEA_STOCK_FILE, month, device);
  return res.json({ items });
});

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

app.delete("/api/rma/emea/stock/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const items = await readJson(EMEA_STOCK_FILE);
  const next = items.filter(r => r.id !== id);
  await writeJson(EMEA_STOCK_FILE, next);
  return res.json({ ok: true });
});
/* ------------------------ Rush: Sales by Source Code ------------------------ */

/**
 * List + basic filters (by source_code, report_date range)
 * GET /api/rush/sales?source_code=INVADJ&from=2025-01-01&to=2025-12-31
 */
app.get("/api/rush/sales", requireAny, async (req, res) => {
  try {
    const { source_code, from, to } = req.query;
    let q = supa.from("rush_sales_by_source").select("*").order("report_date", { ascending: true });

    if (source_code) q = q.eq("source_code", source_code);
    if (from) q = q.gte("report_date", from);
    if (to) q = q.lte("report_date", to);

    const { data, error } = await q;
    if (error) throw error;
    return res.json({ items: data || [] });
  } catch (e) {
    console.error("rush/sales list", e);
    return res.status(500).json({ error: e.message || "Sales list failed" });
  }
});

/**
 * Create single row
 */
app.post("/api/rush/sales", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const now = new Date().toISOString();

    const payload = {
      source_code: body.source_code || "",
      source_code_description: body.source_code_description || "",
      product_code: body.product_code || "",
      product_description: body.product_description || "",
      unit_price: Number(body.unit_price) || 0,
      units_sold: Number(body.units_sold) || 0,
      sales_amount: Number(body.sales_amount) || 0,
      units_returned: Number(body.units_returned) || 0,
      returns_amount: Number(body.returns_amount) || 0,
      net_units: Number(body.net_units) || 0,
      net_sales: Number(body.net_sales) || 0,
      currency: body.currency || "USD",
      report_date: body.report_date || null,
      updated_at: now,
    };

    const { data, error } = await supa
      .from("rush_sales_by_source")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return res.json({ ok: true, item: data });
  } catch (e) {
    console.error("rush/sales create", e);
    return res.status(500).json({ error: e.message || "Sales create failed" });
  }
});

/**
 * Update
 */
app.put("/api/rush/sales/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const patch = req.body || {};
    patch.updated_at = new Date().toISOString();

    const { data, error } = await supa
      .from("rush_sales_by_source")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return res.json({ ok: true, item: data });
  } catch (e) {
    console.error("rush/sales update", e);
    return res.status(500).json({ error: e.message || "Sales update failed" });
  }
});

/**
 * Delete
 */
app.delete("/api/rush/sales/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supa
      .from("rush_sales_by_source")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (e) {
    console.error("rush/sales delete", e);
    return res.status(500).json({ error: e.message || "Sales delete failed" });
  }
});

/**
 * Import from CSV (headers similar to the columns)
 * POST /api/rush/sales/import { items: [...] }
 */
app.post("/api/rush/sales/import", requireAdmin, async (req, res) => {
  try {
    const { items = [] } = req.body || {};
    if (!items.length) return res.json({ ok: true, imported: 0 });

    const now = new Date().toISOString();
    const rows = items.map((r) => ({
      source_code: r.source_code || r["Source Code"] || "",
      source_code_description: r.source_code_description || r["Source Code Description"] || "",
      product_code: r.product_code || r["Product"] || "",
      product_description: r.product_description || r["Description"] || "",
      unit_price: Number(r.unit_price || r["Unit Price"] || 0),
      units_sold: Number(r.units_sold || r["# Sold"] || 0),
      sales_amount: Number(r.sales_amount || r["Sales"] || 0),
      units_returned: Number(r.units_returned || r["# Returned"] || 0),
      returns_amount: Number(r.returns_amount || r["Returns"] || 0),
      net_units: Number(r.net_units || r["# Net Units"] || 0),
      net_sales: Number(r.net_sales || r["Net Sales"] || 0),
      currency: r.currency || "USD",
      report_date: r.report_date || null,
      created_at: now,
      updated_at: now,
    }));

    const { data, error } = await supa
      .from("rush_sales_by_source")
      .insert(rows);

    if (error) throw error;
    return res.json({ ok: true, imported: data?.length || rows.length });
  } catch (e) {
    console.error("rush/sales import", e);
    return res.status(500).json({ error: e.message || "Sales import failed" });
  }
});

/**
 * Export CSV
 * GET /api/rush/sales/export.csv?source_code=...
 */
app.get("/api/rush/sales/export.csv", requireAny, async (req, res) => {
  try {
    const { source_code, from, to } = req.query;
    let q = supa.from("rush_sales_by_source").select("*").order("report_date", { ascending: true });
    if (source_code) q = q.eq("source_code", source_code);
    if (from) q = q.gte("report_date", from);
    if (to) q = q.lte("report_date", to);

    const { data, error } = await q;
    if (error) throw error;
    const rows = data || [];

    const cols = [
      "source_code","source_code_description",
      "product_code","product_description",
      "unit_price","units_sold","sales_amount",
      "units_returned","returns_amount","net_units","net_sales",
      "currency","report_date","created_at","updated_at"
    ];

    const header = cols.join(",");
    const lines = rows.map(r =>
      cols.map(c => csvEscape(r[c])).join(",")
    );
    const csv = "\uFEFF" + [header, ...lines].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=Rush_Sales_${Date.now()}.csv`);
    return res.send(csv);
  } catch (e) {
    console.error("rush/sales export", e);
    return res.status(500).json({ error: e.message || "Sales export failed" });
  }
});


/* ------------------------ Rush: Processed Orders ------------------------ */

app.get("/api/rush/orders", requireAny, async (req, res) => {
  try {
    const { order_no, from, to } = req.query;
    let q = supa.from("rush_processed_orders").select("*").order("order_date", { ascending: true });
    if (order_no) q = q.eq("order_no", order_no);
    if (from) q = q.gte("order_date", from);
    if (to) q = q.lte("order_date", to);

    const { data, error } = await q;
    if (error) throw error;
    return res.json({ items: data || [] });
  } catch (e) {
    console.error("rush/orders list", e);
    return res.status(500).json({ error: e.message || "Orders list failed" });
  }
});

app.post("/api/rush/orders", requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const now = new Date().toISOString();
    const payload = {
      order_no: b.order_no || b.Order || "",
      invoice_part: b.invoice_part || b["Invoice Part"] || "",
      order_date: b.order_date || b["Order Date"] || null,
      invoice_date: b.invoice_date || b["Invoice Date"] || null,
      alternate_order: b.alternate_order || b["Alternate Order"] || "",
      purchase_order: b.purchase_order || b["Purchase Order"] || "",
      customer_name: b.customer_name || b["Name"] || "",
      company: b.company || b["Company"] || "",
      email: b.email || b["Email"] || "",
      units_on_order: Number(b.units_on_order || b["Units On Order"] || 0),
      units_invoiced: Number(b.units_invoiced || b["Units Invoiced"] || 0),
      units_on_back_order: Number(b.units_on_back_order || b["Units on Back Order"] || 0),
      carrier_service: b.carrier_service || b["Carrier / Service"] || "",
      tracking_number: b.tracking_number || b["Tracking Number"] || "",
      serials: b.serials || b["Serials"] || "",
      updated_at: now,
    };

    const { data, error } = await supa
      .from("rush_processed_orders")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return res.json({ ok: true, item: data });
  } catch (e) {
    console.error("rush/orders create", e);
    return res.status(500).json({ error: e.message || "Orders create failed" });
  }
});

app.put("/api/rush/orders/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const patch = { ...(req.body || {}), updated_at: new Date().toISOString() };
    const { data, error } = await supa
      .from("rush_processed_orders")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return res.json({ ok: true, item: data });
  } catch (e) {
    console.error("rush/orders update", e);
    return res.status(500).json({ error: e.message || "Orders update failed" });
  }
});

app.delete("/api/rush/orders/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supa
      .from("rush_processed_orders")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (e) {
    console.error("rush/orders delete", e);
    return res.status(500).json({ error: e.message || "Orders delete failed" });
  }
});

app.post("/api/rush/orders/import", requireAdmin, async (req, res) => {
  try {
    const { items = [] } = req.body || {};
    if (!items.length) return res.json({ ok: true, imported: 0 });

    const now = new Date().toISOString();
    const rows = items.map((r) => ({
      order_no: r.order_no || r["Order"] || "",
      invoice_part: r.invoice_part || r["Invoice Part"] || "",
      order_date: r.order_date || r["Order Date"] || null,
      invoice_date: r.invoice_date || r["Invoice Date"] || null,
      alternate_order: r.alternate_order || r["Alternate Order"] || "",
      purchase_order: r.purchase_order || r["Purchase Order"] || "",
      customer_name: r.customer_name || r["Name"] || "",
      company: r.company || r["Company"] || "",
      email: r.email || r["Email"] || "",
      units_on_order: Number(r.units_on_order || r["Units On Order"] || 0),
      units_invoiced: Number(r.units_invoiced || r["Units Invoiced"] || 0),
      units_on_back_order: Number(r.units_on_back_order || r["Units on Back Order"] || 0),
      carrier_service: r.carrier_service || r["Carrier / Service"] || "",
      tracking_number: r.tracking_number || r["Tracking Number"] || "",
      serials: r.serials || r["Serials"] || "",
      created_at: now,
      updated_at: now,
    }));

    const { data, error } = await supa
      .from("rush_processed_orders")
      .insert(rows);
    if (error) throw error;

    return res.json({ ok: true, imported: data?.length || rows.length });
  } catch (e) {
    console.error("rush/orders import", e);
    return res.status(500).json({ error: e.message || "Orders import failed" });
  }
});

app.get("/api/rush/orders/export.csv", requireAny, async (req, res) => {
  try {
    const { order_no, from, to } = req.query;
    let q = supa.from("rush_processed_orders").select("*").order("order_date", { ascending: true });
    if (order_no) q = q.eq("order_no", order_no);
    if (from) q = q.gte("order_date", from);
    if (to) q = q.lte("order_date", to);

    const { data, error } = await q;
    if (error) throw error;
    const rows = data || [];

    const cols = [
      "order_no","invoice_part","order_date","invoice_date",
      "alternate_order","purchase_order","customer_name","company","email",
      "units_on_order","units_invoiced","units_on_back_order",
      "carrier_service","tracking_number","serials","created_at","updated_at"
    ];
    const header = cols.join(",");
    const lines = rows.map(r => cols.map(c => csvEscape(r[c])).join(","));
    const csv = "\uFEFF" + [header, ...lines].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=Rush_Processed_Orders_${Date.now()}.csv`);
    return res.send(csv);
  } catch (e) {
    console.error("rush/orders export", e);
    return res.status(500).json({ error: e.message || "Orders export failed" });
  }
});
/* ------------------------ Rush: Inventory ------------------------ */

app.get("/api/rush/inventory", requireAny, async (req, res) => {
  try {
    const { stock_number } = req.query;
    let q = supa.from("rush_inventory").select("*").order("stock_number", { ascending: true });
    if (stock_number) q = q.eq("stock_number", stock_number);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ items: data || [] });
  } catch (e) {
    console.error("rush/inventory list", e);
    return res.status(500).json({ error: e.message || "Inventory list failed" });
  }
});

app.post("/api/rush/inventory", requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const now = new Date().toISOString();
    const payload = {
      stock_number: b.stock_number || b["Stock Number"] || "",
      description: b.description || b["Description"] || "",
      upc: b.upc || b["UPC"] || "",
      class: b.class || b["Class"] || "",
      total_net_on_shelf: Number(b.total_net_on_shelf || b["Total Net on Shelf"] || 0),
      available: Number(b.available || b["Available"] || 0),
      committed: Number(b.committed || b["Committed"] || 0),
      back_ordered: Number(b.back_ordered || b["Back Ordered"] || 0),
      list_price: Number(b.list_price || b["List Price"] || 0),
      currency: b.currency || "USD",
      updated_at: now,
    };
    const { data, error } = await supa
      .from("rush_inventory")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return res.json({ ok: true, item: data });
  } catch (e) {
    console.error("rush/inventory create", e);
    return res.status(500).json({ error: e.message || "Inventory create failed" });
  }
});

app.put("/api/rush/inventory/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const patch = { ...(req.body || {}), updated_at: new Date().toISOString() };
    const { data, error } = await supa
      .from("rush_inventory")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return res.json({ ok: true, item: data });
  } catch (e) {
    console.error("rush/inventory update", e);
    return res.status(500).json({ error: e.message || "Inventory update failed" });
  }
});

app.delete("/api/rush/inventory/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supa
      .from("rush_inventory")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (e) {
    console.error("rush/inventory delete", e);
    return res.status(500).json({ error: e.message || "Inventory delete failed" });
  }
});

app.post("/api/rush/inventory/import", requireAdmin, async (req, res) => {
  try {
    const { items = [] } = req.body || {};
    if (!items.length) return res.json({ ok: true, imported: 0 });
    const now = new Date().toISOString();

    const rows = items.map((r) => ({
      stock_number: r.stock_number || r["Stock Number"] || "",
      description: r.description || r["Description"] || "",
      upc: r.upc || r["UPC"] || "",
      class: r.class || r["Class"] || "",
      total_net_on_shelf: Number(r.total_net_on_shelf || r["Total Net on Shelf"] || 0),
      available: Number(r.available || r["Available"] || 0),
      committed: Number(r.committed || r["Committed"] || 0),
      back_ordered: Number(r.back_ordered || r["Back Ordered"] || 0),
      list_price: Number(r.list_price || (r["List Price"] || "").replace(/\$/g, "") || 0),
      currency: r.currency || "USD",
      created_at: now,
      updated_at: now,
    }));

    const { data, error } = await supa
      .from("rush_inventory")
      .insert(rows);
    if (error) throw error;

    return res.json({ ok: true, imported: data?.length || rows.length });
  } catch (e) {
    console.error("rush/inventory import", e);
    return res.status(500).json({ error: e.message || "Inventory import failed" });
  }
});

app.get("/api/rush/inventory/export.csv", requireAny, async (req, res) => {
  try {
    const { stock_number } = req.query;
    let q = supa.from("rush_inventory").select("*").order("stock_number", { ascending: true });
    if (stock_number) q = q.eq("stock_number", stock_number);
    const { data, error } = await q;
    if (error) throw error;
    const rows = data || [];

    const cols = [
      "stock_number","description","upc","class",
      "total_net_on_shelf","available","committed","back_ordered",
      "list_price","currency","created_at","updated_at"
    ];
    const header = cols.join(",");
    const lines = rows.map(r => cols.map(c => csvEscape(r[c])).join(","));
    const csv = "\uFEFF" + [header, ...lines].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=Rush_Inventory_${Date.now()}.csv`);
    return res.send(csv);
  } catch (e) {
    console.error("rush/inventory export", e);
    return res.status(500).json({ error: e.message || "Inventory export failed" });
  }
});


/* ------------------------ static (prod) ------------------------ */
app.use(express.static(DIST_DIR));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

/* ------------------------ start ------------------------ */
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API listening on http://0.0.0.0:${PORT}`);
});
