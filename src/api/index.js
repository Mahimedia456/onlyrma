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
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}
function send(res, status, body, type = 'application/json') {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}
function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((a, p) => {
    const [k, v] = p.split('=').map(s => s && s.trim());
    if (!k) return a;
    a[k] = decodeURIComponent(v || '');
    return a;
  }, {});
}

function setCookie(res, name, value, {
  maxAgeDays = 30,
  path = '/',
  sameSite = 'Lax',
  httpOnly = true,
  secure = process.env.NODE_ENV === 'production'
} = {}) {
  const maxAge = maxAgeDays * 24 * 60 * 60;
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`,
  ];
  if (secure) parts.push('Secure');
  if (httpOnly) parts.push('HttpOnly');
  res.setHeader('Set-Cookie', parts.join('; '));
}
function clearCookie(res, name) {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie',
    `${name}=; Path=/; Max-Age=0; SameSite=Lax; ${secure ? 'Secure; ' : ''}HttpOnly`
  );
}

function requireAny(req, res) {
  const cookies = parseCookies(req);
  if (cookies.rma_sess !== '1') {
    send(res, 401, { error: 'Not authenticated' });
    return false;
  }
  return true;
}
function csvEscape(val) {
  if (val === undefined || val === null) return '';
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCSV(rows, columns) {
  const header = columns.join(',');
  const lines = rows.map(r => columns.map(c => csvEscape(r[c])).join(','));
  return '\uFEFF' + [header, ...lines].join('\n');
}
function genId(prefix='id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}
function toMonth(v) { // YYYY-MM
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0,7);
  return d.toISOString().slice(0,7);
}
function fmtDateISO(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0,10);
  } catch { return null; }
}
function numberizeAll(obj) {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) out[k] = Number(v);
  }
  return out;
}

/* ---------------- Route handlers ---------------- */
// Auth/session
async function handleInternalLogin(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method Not Allowed' });
  const { email, password } = await readBody(req);
  if (email?.toLowerCase() === 'internal@mahimedisolutions.com' && password === 'mahimediasolutions') {
    setCookie(res, 'rma_sess', '1', {
      maxAgeDays: 30,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'Lax'
    });
    return ok(res, { ok: true, role: 'admin', user: { email } });
  }
  return send(res, 401, { ok: false, error: 'Invalid credentials' });
}
async function handleViewerLogin(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method Not Allowed' });
  const { email, password } = await readBody(req);
  if (email?.toLowerCase() === 'rush@mahimedisolutions.com' && password === 'aamirtest') {
    setCookie(res, 'rma_sess', '1', {
      maxAgeDays: 30,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'Lax'
    });
    return ok(res, { ok: true, role: 'viewer', user: { email } });
  }
  return send(res, 401, { ok: false, error: 'Invalid viewer credentials' });
}
function handleSession(req, res) {
  const cookies = parseCookies(req);
  if (cookies.rma_sess === '1') {
    return ok(res, { ok: true, role: 'admin', user: { email: 'internal@mahimedisolutions.com' } });
  }
  return send(res, 401, { error: 'No session' });
}
function handleLogout(_req, res) {
  clearCookie(res, 'rma_sess');
  return ok(res, { ok: true });
}
// 🔁 refresh cookie expiry
function handleSessionRefresh(req, res) {
  const cookies = parseCookies(req);
  if (cookies.rma_sess === '1') {
    setCookie(res, 'rma_sess', '1', {
      maxAgeDays: 30,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'Lax'
    });
    return ok(res, { ok: true, refreshed: true });
  }
  return send(res, 401, { error: 'No session' });
}

// RMA entries
async function handleEntries(req, res) {
  if (!requireAny(req, res)) return;
  if (req.method === 'GET') {
    const u = new URL(req.url, 'http://x');
    const month = (u.searchParams.get('month') || '').trim();
    const category = (u.searchParams.get('category') || '').trim();
    let out = entries;
    if (month) out = out.filter(e => toMonth(e.entry_date || e.created_at) === month);
    if (category) out = out.filter(e => (e.category || '') === category);
    return ok(res, { entries: out });
  }
  if (req.method === 'POST') {
    const body = await readBody(req);
    const now = new Date().toISOString();
    const entry = {
      id: genId('rma'),
      entry_date: fmtDateISO(body.entry_date) || now.slice(0,10),
      ticket_id: body.ticket_id || '',
      first_name: body.first_name || '',
      last_name: body.last_name || '',
      email: body.email || '',
      phone: body.phone || '',
      company: body.company || '',
      reseller_customer: body.reseller_customer || '',
      address1: body.address1 || '',
      address2: body.address2 || '',
      city: body.city || '',
      state: body.state || '',
      country: body.country || '',
      postcode: body.postcode || '',
      product_with_fault: body.product_with_fault || '',
      serial_number: body.serial_number || '',
      product_sku: body.product_sku || '',
      device_name: body.device_name || '',
      rma_type: body.rma_type || '',
      stock_type: body.stock_type || '',
      quantity: Number(body.quantity) || 0,
      returned_reason: body.returned_reason || '',
      action: body.action || '',
      custom_tracking: body.custom_tracking || '',
      rma_no: body.rma_no || '',
      replacement_tracking: body.replacement_tracking || '',
      category: body.category || '',
      organization: body.organization || '',
      created_at: now,
      updated_at: now,
    };
    entries.push(entry);
    return ok(res, { ok: true, entry });
  }
  return send(res, 405, { error: 'Method Not Allowed' });
}
async function handleEntryId(req, res, id) {
  if (!requireAny(req, res)) return;
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return send(res, 404, { error: 'Not found' });

  if (req.method === 'PUT') {
    const patch = await readBody(req);
    const merged = {
      ...entries[idx],
      ...patch,
      entry_date: fmtDateISO(patch.entry_date) ?? entries[idx].entry_date,
      updated_at: new Date().toISOString(),
    };
    entries[idx] = merged;
    return ok(res, { ok: true, entry: merged });
  }
  if (req.method === 'DELETE') {
    entries.splice(idx, 1);
    return ok(res, { ok: true });
  }
  return send(res, 405, { error: 'Method Not Allowed' });
}

// RMA entries export/template/import
function handleEntriesTemplate(_req, res) {
  const headers = [
    'Date','Ticket','First Name','Last Name','Email','Phone','Company (if Applicable)','Reseller / Customer',
    'Address 1','Address 2','City','State (use 2 digit code)','Country','Post Code',
    'Product with fault','Serial Number of faulty product',"Product SKU for replacement (no more ninja's without my approval)",
    'Device Name','RMA Type','Stock Type','Quantity','Return Reason (Subject)','Action',
    'Customer Return Tracking Number (REQUIRED)','RMA NO# (from RO)','New Order # (Dream) if Warranty Repalcement / Reshipment (from RO)','Category','Organization'
  ];
  const csv = '\uFEFF' + headers.join(',') + '\n';
  res.setHeader('Content-Disposition', 'attachment; filename=rma_entries_template.csv');
  return send(res, 200, csv, 'text/csv; charset=utf-8');
}
function handleEntriesExport(req, res) {
  if (!requireAny(req, res)) return;
  const u = new URL(req.url, 'http://x');
  const month = (u.searchParams.get('month') || '').trim();
  const category = (u.searchParams.get('category') || '').trim();
  let list = entries;
  if (month) list = list.filter(e => toMonth(e.entry_date || e.created_at) === month);
  if (category) list = list.filter(e => (e.category || '') === category);

  const cols = [
    'id','entry_date','rma_no','ticket_id','first_name','last_name','email','phone','company','reseller_customer',
    'address1','address2','city','state','country','postcode','product_with_fault','serial_number',
    'product_sku','device_name','category','rma_type','stock_type','quantity','returned_reason','action',
    'custom_tracking','replacement_tracking','created_at','updated_at','organization'
  ];
  const csv = toCSV(list, cols);
  res.setHeader('Content-Disposition', `attachment; filename=RMA_Entries_${month || 'all'}.csv`);
  return send(res, 200, csv, 'text/csv; charset=utf-8');
}
async function handleEntriesImport(req, res) {
  if (!requireAny(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'Method Not Allowed' });
  const { items = [] } = await readBody(req);
  const now = new Date().toISOString();
  let imported = 0;
  const report = [];

  for (const raw of items) {
    try {
      const e = {
        id: genId('rma'),
        entry_date: fmtDateISO(raw.entry_date) || now.slice(0,10),
        ticket_id: raw.ticket_id || '',
        first_name: raw.first_name || '',
        last_name: raw.last_name || '',
        email: raw.email || '',
        phone: raw.phone || '',
        company: raw.company || '',
        reseller_customer: raw.reseller_customer || '',
        address1: raw.address1 || '',
        address2: raw.address2 || '',
        city: raw.city || '',
        state: raw.state || '',
        country: raw.country || '',
        postcode: raw.postcode || '',
        product_with_fault: raw.product_with_fault || '',
        serial_number: raw.serial_number || '',
        product_sku: raw.product_sku || '',
        device_name: raw.device_name || '',
        rma_type: raw.rma_type || '',
        stock_type: raw.stock_type || '',
        quantity: Number(raw.quantity) || 0,
        returned_reason: raw.returned_reason || '',
        action: raw.action || '',
        custom_tracking: raw.custom_tracking || '',
        rma_no: raw.rma_no || '',
        replacement_tracking: raw.replacement_tracking || '',
        category: raw.category || '',
        organization: raw.organization || '',
        created_at: now,
        updated_at: now,
      };
      entries.push(e);
      imported++;
      report.push({ ok: true, id: e.id });
    } catch (err) {
      report.push({ ok: false, error: err?.message || 'Unknown import error' });
    }
  }
  const failed = items.length - imported;
  if (failed > 0) return send(res, 207, { imported, failed, report });
  return ok(res, { imported, failed: 0 });
}

// Stock: shared filters
function filterStock(list, url) {
  const u = new URL(url, 'http://x');
  const month = (u.searchParams.get('month') || '').trim();
  const device = (u.searchParams.get('device_name') || '').trim();
  let out = list;
  if (month) out = out.filter(r => (r.month || '') === month);
  if (device) out = out.filter(r => (r.device_name || '') === device);
  return out;
}

// EMEA stock
async function handleEmeaStock(req, res) {
  if (!requireAny(req, res)) return;
  if (req.method === 'GET') {
    const items = filterStock(emeaStock, req.url);
    return ok(res, { items });
  }
  if (req.method === 'POST') {
    const body = numberizeAll(await readBody(req));
    const row = {
      id: genId('emea'),
      month: body.month || toMonth(new Date().toISOString()),
      device_name: body.device_name || '—',
      d_stock_received: Number(body.d_stock_received)||0,
      b_stock_received: Number(body.b_stock_received)||0,
      new_stock_sent: Number(body.new_stock_sent)||0,
      rma_bstock_rstock_sent: Number(body.rma_bstock_rstock_sent)||0,
      awaiting_delivery_from_user: Number(body.awaiting_delivery_from_user)||0,
      receiving_only: Number(body.receiving_only)||0,
      awaiting_return_from_rush: Number(body.awaiting_return_from_rush)||0,
      notes: body.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    emeaStock.push(row);
    return ok(res, { ok: true, row });
  }
  return send(res, 405, { error: 'Method Not Allowed' });
}
async function handleEmeaStockId(req, res, id) {
  if (!requireAny(req, res)) return;
  const idx = emeaStock.findIndex(r => r.id === id);
  if (idx === -1) return send(res, 404, { error: 'Not found' });

  if (req.method === 'PUT') {
    const patch = numberizeAll(await readBody(req));
    emeaStock[idx] = { ...emeaStock[idx], ...patch, updated_at: new Date().toISOString() };
    return ok(res, { ok: true });
  }
  if (req.method === 'DELETE') {
    emeaStock.splice(idx, 1);
    return ok(res, { ok: true });
  }
  return send(res, 405, { error: 'Method Not Allowed' });
}
function handleEmeaDevices(_req, res) {
  const DEVICE_NAMES = [
    "Ninja","Ninja V","Ninja V Plus","Ninja Ultra","Ninja Phone",
    "Shinobi II","Shinobi 7","Shinobi GO","Shogun Ultra","Shogun Connect",
    "Sumo 19SE","A-Eye PTZ camera","Sun Hood","Master Caddy III","Atomos Connect",
    "AtomX Battery","Ultrasync Blue","AtomFlex HDMI Cable","Atomos Creator Kit 5''",
  ];
  const found = [...new Set(emeaStock.map(s => s.device_name).filter(Boolean))];
  const devices = Array.from(new Set([...DEVICE_NAMES, ...found])).sort();
  return ok(res, { devices });
}

// US stock
async function handleUsStock(req, res) {
  if (!requireAny(req, res)) return;
  if (req.method === 'GET') {
    const items = filterStock(usStock, req.url);
    return ok(res, { items });
  }
  if (req.method === 'POST') {
    const body = numberizeAll(await readBody(req));
    const row = {
      id: genId('us'),
      month: body.month || toMonth(new Date().toISOString()),
      device_name: body.device_name || '—',
      d_stock_received: Number(body.d_stock_received)||0,
      b_stock_received: Number(body.b_stock_received)||0,
      new_stock_sent: Number(body.new_stock_sent)||0,
      rma_bstock_rstock_sent: Number(body.rma_bstock_rstock_sent)||0,
      a_stock_received: Number(body.a_stock_received)||0,
      awaiting_delivery_from_user: Number(body.awaiting_delivery_from_user)||0,
      receive_only: Number(body.receive_only)||0,
      awaiting_return_from_rush: Number(body.awaiting_return_from_rush)||0,
      notes: body.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    usStock.push(row);
    return ok(res, { ok: true, row });
  }
  return send(res, 405, { error: 'Method Not Allowed' });
}
async function handleUsStockId(req, res, id) {
  if (!requireAny(req, res)) return;
  const idx = usStock.findIndex(r => r.id === id);
  if (idx === -1) return send(res, 404, { error: 'Not found' });

  if (req.method === 'PUT') {
    const patch = numberizeAll(await readBody(req));
    usStock[idx] = { ...usStock[idx], ...patch, updated_at: new Date().toISOString() };
    return ok(res, { ok: true });
  }
  if (req.method === 'DELETE') {
    usStock.splice(idx, 1);
    return ok(res, { ok: true });
  }
  return send(res, 405, { error: 'Method Not Allowed' });
}
function handleUsDevices(_req, res) {
  const DEVICE_NAMES = [
    "Ninja","Ninja V","Ninja V Plus","Ninja Ultra","Ninja Phone",
    "Shinobi II","Shinobi 7","Shinobi GO","Shogun Ultra","Shogun Connect",
    "Sumo 19SE","A-Eye PTZ camera","Sun Hood","Master Caddy III","Atomos Connect",
    "AtomX Battery","Ultrasync Blue","AtomFlex HDMI Cable","Atomos Creator Kit 5''",
  ];
  const found = [...new Set(usStock.map(s => s.device_name).filter(Boolean))];
  const devices = Array.from(new Set([...DEVICE_NAMES, ...found])).sort();
  return ok(res, { devices });
}

/* ---------------- Main handler / router ---------------- */
export default async function handler(req, res) {
  const path = (req.url.split('?')[0] || '');

  // auth
  if (path === '/api/internal-login') return handleInternalLogin(req, res);
  if (path === '/api/viewer-login')   return handleViewerLogin(req, res);
  if (path === '/api/session' && req.method === 'GET') return handleSession(req, res);
  if (path === '/api/logout')         return handleLogout(req, res);
  if (path === '/api/session/refresh') return handleSessionRefresh(req, res);

  // rma entries
  if (path === '/api/rma/entries')                        return handleEntries(req, res);
  if (path === '/api/rma/entries/template.csv')           return handleEntriesTemplate(req, res);
  if (path === '/api/rma/entries/export.csv')             return handleEntriesExport(req, res);
  if (path === '/api/rma/entries/import')                 return handleEntriesImport(req, res);
  const entryId = path.match(/^\/api\/rma\/entries\/([^/]+)$/);
  if (entryId) return handleEntryId(req, res, entryId[1]);

  // emea stock
  if (path === '/api/rma/emea/stock')                     return handleEmeaStock(req, res);
  if (path === '/api/rma/emea/devices')                   return handleEmeaDevices(req, res);
  const emeaId = path.match(/^\/api\/rma\/emea\/stock\/([^/]+)$/);
  if (emeaId) return handleEmeaStockId(req, res, emeaId[1]);

  // us stock
  if (path === '/api/rma/us/stock')                       return handleUsStock(req, res);
  if (path === '/api/rma/us/devices')                     return handleUsDevices(req, res);
  const usId = path.match(/^\/api\/rma\/us\/stock\/([^/]+)$/);
  if (usId) return handleUsStockId(req, res, usId[1]);

  return send(res, 404, { error: 'Not Found' });
}
