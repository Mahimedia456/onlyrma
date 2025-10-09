// api/index.js
// Minimal serverless API to satisfy /api/* endpoints used by the app.
// NOTE: Memory-only store (non-persistent on Vercel).

export const config = {
  runtime: 'nodejs18.x'
};

// ---- In-memory store (resets on cold start) ----
let entries = [];      // RMA entries
let emeaStock = [];    // EMEA stock rows
let usStock = [];      // US stock rows
let nextId = 1;

// Very-simple cookie helpers
function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((a, p) => {
    const [k, v] = p.split('=').map(s => s && s.trim());
    if (!k) return a;
    a[k] = decodeURIComponent(v || '');
    return a;
  }, {});
}
function setCookie(res, name, value, { maxAge = 60 * 60 * 24 * 30, path = '/', httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `Max-Age=${maxAge}`, 'SameSite=Lax'];
  // On Vercel HTTPS, mark Secure. Local previews still work.
  parts.push('Secure');
  if (httpOnly) parts.push('HttpOnly');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function send(res, status, body, type = 'application/json') {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

function requireAuth(req, res) {
  const cookies = parseCookies(req);
  if (cookies.rma_sess !== '1') {
    send(res, 401, { error: 'Not authenticated' });
    return false;
  }
  return true;
}

// --- Route helpers ---
function notFound(res) { send(res, 404, { error: 'Not Found' }); }
function methodNotAllowed(res) { send(res, 405, { error: 'Method Not Allowed' }); }

// --- Handlers ---
async function handleSession(req, res) {
  const cookies = parseCookies(req);
  if (cookies.rma_sess === '1') {
    // Return the internal admin session
    return send(res, 200, { ok: true, role: 'admin', user: { email: 'internal@mahimedisolutions.com' } });
  }
  send(res, 200, { ok: false });
}

async function handleInternalLogin(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const body = await readBody(req);
  const { email, password } = body || {};
  if (email === 'internal@mahimedisolutions.com' && password === 'mahimediasolutions') {
    setCookie(res, 'rma_sess', '1', { httpOnly: true });
    return send(res, 200, { ok: true, role: 'admin', user: { email } });
  }
  send(res, 401, { ok: false, error: 'Invalid credentials' });
}

async function handleViewerLogin(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  const body = await readBody(req);
  const { email, password } = body || {};
  // keep your rush login
  if (email === 'rush@mahimediasolutions.com' && password) {
    setCookie(res, 'rma_sess', '1', { httpOnly: true });
    return send(res, 200, { ok: true, role: 'viewer', user: { email } });
  }
  send(res, 401, { ok: false, error: 'Invalid viewer credentials' });
}

async function handleLogout(req, res) {
  // expire cookie
  res.setHeader('Set-Cookie', 'rma_sess=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly');
  send(res, 200, { ok: true });
}

function filterByMonthCategory(list, url) {
  const u = new URL(url, 'http://x');
  const month = u.searchParams.get('month') || '';
  const category = u.searchParams.get('category') || '';
  let out = list;
  if (month) {
    out = out.filter(r => {
      const d = r.entry_date ? new Date(r.entry_date) : null;
      if (!d || isNaN(d)) return false;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return ym === month;
    });
  }
  if (category) out = out.filter(r => (r.category || '') === category);
  return out;
}

// RMA entries
async function handleEntries(req, res) {
  if (!requireAuth(req, res)) return;

  if (req.method === 'GET') {
    const filtered = filterByMonthCategory(entries, req.url);
    return send(res, 200, { entries: filtered });
  }
  if (req.method === 'POST') {
    const body = await readBody(req);
    const row = { ...body, id: nextId++, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    entries.push(row);
    return send(res, 200, { ok: true, id: row.id });
  }
  methodNotAllowed(res);
}

async function handleEntriesId(req, res, id) {
  if (!requireAuth(req, res)) return;

  const idx = entries.findIndex(e => String(e.id) === String(id));
  if (idx === -1) return notFound(res);

  if (req.method === 'PUT') {
    const body = await readBody(req);
    entries[idx] = { ...entries[idx], ...body, updated_at: new Date().toISOString() };
    return send(res, 200, { ok: true });
  }
  if (req.method === 'DELETE') {
    entries.splice(idx, 1);
    return send(res, 200, { ok: true });
  }
  methodNotAllowed(res);
}

// Export CSV (simple)
async function handleEntriesExport(req, res) {
  if (!requireAuth(req, res)) return;
  const list = filterByMonthCategory(entries, req.url);

  const cols = [
    'id','entry_date','rma_no','ticket_id','first_name','last_name','email','phone','company','reseller_customer',
    'address1','address2','city','state','country','postcode','product_with_fault','serial_number','product_sku',
    'device_name','category','rma_type','stock_type','quantity','returned_reason','action','custom_tracking','replacement_tracking'
  ];
  const header = cols.join(',');
  const lines = list.map(r => cols.map(c => {
    const v = r[c] ?? '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(','));
  const csv = "\uFEFF" + [header, ...lines].join('\n');

  res.setHeader('Content-Disposition', 'attachment; filename="rma_entries.csv"');
  return send(res, 200, csv, 'text/csv; charset=utf-8');
}

// Template CSV
async function handleEntriesTemplate(_req, res) {
  const header = [
    'Date','Ticket','First Name','Last Name','Email','Phone','Company (if Applicable)','Reseller / Customer','Address 1','Address 2',
    'City','State (use 2 digit code)','Country','Post Code','Product with fault','Serial Number of faulty product',
    "Product SKU for replacement (no more ninja's without my approval)",'Device Name','RMA Type','Stock Type','Quantity',
    'Return Reason (Subject)','Action','Customer Return Tracking Number (REQUIRED)','RMA NO# (from RO)',
    'New Order # (Dream) if Warranty Repalcement / Reshipment (from RO)'
  ].join(',');
  return send(res, 200, header + '\n', 'text/csv; charset=utf-8');
}

// Import (partial success 207)
async function handleEntriesImport(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  const { items = [] } = await readBody(req);

  let imported = 0;
  const report = [];
  for (const raw of items) {
    try {
      const row = { ...raw, id: nextId++, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      entries.push(row);
      imported++;
      report.push({ ok: true, id: row.id });
    } catch (e) {
      report.push({ ok: false, error: e.message });
    }
  }
  const failed = items.length - imported;
  if (failed > 0) {
    res.statusCode = 207; // multi-status/partial success
    return send(res, 207, { imported, failed, report });
  }
  return send(res, 200, { imported, failed: 0 });
}

// Stock (EMEA / US) — month/device filters
function filterStock(list, url) {
  const u = new URL(url, 'http://x');
  const month = u.searchParams.get('month') || '';
  const device = u.searchParams.get('device_name') || '';
  let out = list;
  if (month) out = out.filter(r => (r.month || '') === month);
  if (device) out = out.filter(r => (r.device_name || '') === device);
  return out;
}

async function handleStockList(req, res, region) {
  if (!requireAuth(req, res)) return;
  const store = region === 'emea' ? emeaStock : usStock;

  if (req.method === 'GET') {
    const items = filterStock(store, req.url);
    return send(res, 200, { items });
  }
  if (req.method === 'POST') {
    const body = await readBody(req);
    const row = { ...body, id: nextId++, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    store.push(row);
    return send(res, 200, { ok: true, id: row.id });
  }
  methodNotAllowed(res);
}

async function handleStockId(req, res, region, id) {
  if (!requireAuth(req, res)) return;
  const store = region === 'emea' ? emeaStock : usStock;
  const idx = store.findIndex(r => String(r.id) === String(id));
  if (idx === -1) return notFound(res);

  if (req.method === 'PUT') {
    const body = await readBody(req);
    store[idx] = { ...store[idx], ...body, updated_at: new Date().toISOString() };
    return send(res, 200, { ok: true });
  }
  if (req.method === 'DELETE') {
    store.splice(idx, 1);
    return send(res, 200, { ok: true });
  }
  methodNotAllowed(res);
}

async function handleStockDevices(_req, res, region) {
  const store = region === 'emea' ? emeaStock : usStock;
  const set = new Set(store.map(r => r.device_name).filter(Boolean));
  return send(res, 200, { devices: [...set].sort() });
}

// --------------- Main handler (router) ---------------
export default async function handler(req, res) {
  const { method, url } = req;
  // All routes are under /api/*
  const path = url.split('?')[0] || '';

  // Auth/session
  if (path === '/api/session' && method === 'GET') return handleSession(req, res);
  if (path === '/api/internal-login') return handleInternalLogin(req, res);
  if (path === '/api/viewer-login') return handleViewerLogin(req, res);
  if (path === '/api/logout') return handleLogout(req, res);

  // RMA entries
  if (path === '/api/rma/entries') return handleEntries(req, res);
  if (path.startsWith('/api/rma/entries/export.csv')) return handleEntriesExport(req, res);
  if (path === '/api/rma/entries/template.csv') return handleEntriesTemplate(req, res);
  if (path === '/api/rma/entries/import') return handleEntriesImport(req, res);
  const entryIdMatch = path.match(/^\/api\/rma\/entries\/(\d+)$/);
  if (entryIdMatch) return handleEntriesId(req, res, entryIdMatch[1]);

  // EMEA stock
  if (path === '/api/rma/emea/stock') return handleStockList(req, res, 'emea');
  if (path === '/api/rma/emea/devices') return handleStockDevices(req, res, 'emea');
  const emeaId = path.match(/^\/api\/rma\/emea\/stock\/(\d+)$/);
  if (emeaId) return handleStockId(req, res, 'emea', emeaId[1]);

  // US stock
  if (path === '/api/rma/us/stock') return handleStockList(req, res, 'us');
  if (path === '/api/rma/us/devices') return handleStockDevices(req, res, 'us');
  const usId = path.match(/^\/api\/rma\/us\/stock\/(\d+)$/);
  if (usId) return handleStockId(req, res, 'us', usId[1]);

  return notFound(res);
}
