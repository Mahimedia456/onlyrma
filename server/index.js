// server/index.js
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import multer from 'multer';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import mysql from 'mysql2/promise';

const app = express();
const upload = multer(); // memory storage

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const PORT = Number(process.env.PORT || 4000);

// --- CORS / JSON / Cookies ---
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// --- In-memory session store (dev)
// Map<sessionId, { role: 'admin'|'viewer', email, token?, subdomain?, user? }>
const sessions = new Map();

// --- Helpers -----------------------------------------------------
function makeZendeskClient({ email, token, subdomain }) {
  const baseURL = `https://${subdomain}.zendesk.com/api/v2`;
  const authUser = `${email}/token`;
  const authPass = token;

  return axios.create({
    baseURL,
    auth: { username: authUser, password: authPass },
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
    validateStatus: () => true,
  });
}

function zendeskError(res, axRes) {
  const status = axRes?.status || 500;
  const data = axRes?.data;
  return res.status(status).json({
    error: data?.error || data?.description || data?.message || `Zendesk HTTP ${status}`,
    details: data || null,
  });
}

function sessionMiddleware(req, _res, next) {
  const sid = req.cookies?.session;
  if (sid && sessions.has(sid)) req.sessionData = sessions.get(sid);
  next();
}
app.use(sessionMiddleware);

function requireSession(req, res, next) {
  if (!req.sessionData) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.sessionData || req.sessionData.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden (admin only)' });
  }
  next();
}
// allow both admin and viewer to edit rma_entries (PUT)
function requireCanEditEntries(req, res, next) {
  if (!req.sessionData) return res.status(401).json({ error: 'Not authenticated' });
  const role = req.sessionData.role || 'admin';
  if (role !== 'admin' && role !== 'viewer') {
    return res.status(403).json({ error: 'Forbidden (edit not allowed)' });
  }
  next();
}

// --- MySQL -------------------------------------------------------
let sqlPool = null;

// optionally create DB+user if admin vars provided
async function ensureDbAndUserWithAdmin() {
  const {
    MYSQL_ADMIN_HOST,
    MYSQL_ADMIN_PORT = '3306',
    MYSQL_ADMIN_USER,
    MYSQL_ADMIN_PASSWORD,
    MYSQL_DATABASE,
    MYSQL_USER,
    MYSQL_PASSWORD,
  } = process.env;

  if (!MYSQL_ADMIN_HOST || !MYSQL_ADMIN_USER || !MYSQL_ADMIN_PASSWORD) return;

  const adminConn = await mysql.createConnection({
    host: MYSQL_ADMIN_HOST,
    port: Number(MYSQL_ADMIN_PORT),
    user: MYSQL_ADMIN_USER,
    password: MYSQL_ADMIN_PASSWORD,
    multipleStatements: true,
  });

  await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\``);
  await adminConn.query(`
    CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost' IDENTIFIED BY '${MYSQL_PASSWORD}';
  `);
  await adminConn.query(`
    GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'localhost';
  `);
  await adminConn.query('FLUSH PRIVILEGES');
  await adminConn.end();
}

async function initMySQL() {
  const {
    MYSQL_HOST,
    MYSQL_PORT = '3306',
    MYSQL_USER,
    MYSQL_PASSWORD,
    MYSQL_DATABASE,
  } = process.env;

  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASSWORD || !MYSQL_DATABASE) {
    throw new Error('MySQL env vars missing. Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE.');
  }

  // optional bootstrap
  await ensureDbAndUserWithAdmin();

  sqlPool = await mysql.createPool({
    host: MYSQL_HOST,
    port: Number(MYSQL_PORT),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    timezone: 'Z',
  });

  // rma_entries
  await sqlPool.query(`
    CREATE TABLE IF NOT EXISTS rma_entries (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      entry_date DATE NOT NULL,
      ticket_id BIGINT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      email VARCHAR(190),
      phone VARCHAR(50),
      company VARCHAR(190),
      reseller_customer VARCHAR(50),
      address1 VARCHAR(255),
      address2 VARCHAR(255),
      city VARCHAR(120),
      state VARCHAR(120),
      country VARCHAR(120),
      postcode VARCHAR(40),
      product_with_fault VARCHAR(255),
      serial_number VARCHAR(190),
      product_sku VARCHAR(190),
      device_name VARCHAR(190),
      rma_type VARCHAR(60),
      stock_type VARCHAR(120),
      quantity INT DEFAULT 1,
      returned_reason TEXT,
      action TEXT,
      custom_tracking VARCHAR(190),
      rma_no VARCHAR(120),
      replacement_tracking VARCHAR(190),
      category VARCHAR(60),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_entry_date (entry_date),
      KEY idx_category (category),
      KEY idx_ticket_id (ticket_id),
      KEY idx_rma_no (rma_no)
    )
  `);

  // EMEA monthly stock
  await sqlPool.query(`
    CREATE TABLE IF NOT EXISTS rma_emea_stock (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      month CHAR(7) NOT NULL,
      device_name VARCHAR(190) NOT NULL,
      d_stock_received INT DEFAULT 0,
      b_stock_received INT DEFAULT 0,
      new_stock_sent INT DEFAULT 0,
      rma_bstock_rstock_sent INT DEFAULT 0,
      awaiting_delivery_from_user INT DEFAULT 0,
      receiving_only INT DEFAULT 0,
      awaiting_return_from_rush INT DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_month_device (month, device_name),
      KEY idx_month (month),
      KEY idx_device (device_name)
    )
  `);

  // US monthly stock
  await sqlPool.query(`
    CREATE TABLE IF NOT EXISTS rma_us_stock (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      month CHAR(7) NOT NULL,
      device_name VARCHAR(190) NOT NULL,
      d_stock_received INT DEFAULT 0,
      b_stock_received INT DEFAULT 0,
      new_stock_sent INT DEFAULT 0,
      rma_bstock_rstock_sent INT DEFAULT 0,
      a_stock_received INT DEFAULT 0,
      awaiting_delivery_from_user INT DEFAULT 0,
      receive_only INT DEFAULT 0,
      awaiting_return_from_rush INT DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_month_device (month, device_name),
      KEY idx_month (month),
      KEY idx_device (device_name)
    )
  `);

  console.log('[MySQL] Tables ready');
}

// --- Routes: health ----------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

/* ======================= AUTH ======================= */

app.post('/api/login', async (req, res) => {
  try {
    const { email, token, subdomain } = req.body || {};
    if (!email || !token || !subdomain) {
      return res.status(400).json({ error: 'email, token, and subdomain are required' });
    }
    const client = makeZendeskClient({ email, token, subdomain });
    const me = await client.get('/users/me.json');
    if (me.status !== 200 || !me.data?.user) return zendeskError(res, me);

    const sid = uuidv4();
    sessions.set(sid, { role: 'admin', email, token, subdomain, user: me.data.user });

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('session', sid, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });
    res.json({ ok: true, role: 'admin', user: me.data.user, subdomain });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/viewer-login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const VE = (process.env.RMA_LOCAL_EMAIL || '').trim();
    const VP = (process.env.RMA_LOCAL_PASSWORD || '').trim();

    if (!VE || !VP) return res.status(500).json({ error: 'Viewer creds not configured on server' });
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    if (email.trim().toLowerCase() !== VE.toLowerCase() || password !== VP) {
      return res.status(401).json({ error: 'Invalid viewer credentials' });
    }

    const sid = uuidv4();
    const user = { email: VE, name: 'RMA Viewer' };
    sessions.set(sid, { user, email: VE, token: null, subdomain: null, role: 'viewer' });

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('session', sid, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
    });

    res.json({ ok: true, user, role: 'viewer', subdomain: '' });
  } catch (err) {
    console.error('Viewer login error:', err);
    res.status(500).json({ error: 'Viewer login failed' });
  }
});

app.get('/api/session', requireSession, (req, res) => {
  const { user, subdomain, email, role } = req.sessionData;
  res.json({ ok: true, role: role || 'admin', user, subdomain, email });
});

app.post('/api/logout', (req, res) => {
  const sid = req.cookies?.session;
  if (sid) sessions.delete(sid);
  res.clearCookie('session', { path: '/' });
  res.json({ ok: true });
});

/* ======================= ZENDESK (admin only) ======================= */

app.get('/api/zendesk', requireSession, requireAdmin, async (req, res) => {
  try {
    const pathQ = String(req.query.path || '');
    if (!pathQ.startsWith('/api/v2')) {
      return res.status(400).json({ error: 'Invalid path: must start with /api/v2' });
    }
    const client = makeZendeskClient(req.sessionData);
    const zr = await client.get(pathQ.replace('/api/v2', ''));
    if (zr.status >= 200 && zr.status < 300) return res.status(zr.status).json(zr.data);
    return zendeskError(res, zr);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy failed' });
  }
});

app.get('/api/zd/views', requireSession, requireAdmin, async (_req, res) => {
  try {
    const client = makeZendeskClient(req.sessionData);
    const zr = await client.get(`/views.json`);
    if (zr.status >= 200 && zr.status < 300) {
      const views = (zr.data?.views || []).map(v => ({ id: v.id, title: v.title }));
      return res.json({ views });
    }
    return zendeskError(res, zr);
  } catch (err) {
    console.error('Views error:', err);
    res.status(500).json({ error: 'Views fetch failed' });
  }
});

app.get('/api/rma/tickets', requireSession, requireAdmin, async (req, res) => {
  const { viewId, category, supportType, from, to } = req.query || {};
  if (!viewId) return res.status(400).json({ error: 'Missing viewId' });

  try {
    const client = makeZendeskClient(req.sessionData);
    const zr = await client.get(`/views/${encodeURIComponent(viewId)}/tickets.json`);
    if (zr.status < 200 || zr.status >= 300) return zendeskError(res, zr);

    let tickets = zr.data?.tickets || [];
    tickets = tickets.map(t => {
      const tags = t.tags || [];
      const derived = {
        rmaType: tags.includes('warranty') ? 'Warranty' :
                 (tags.includes('oow') || tags.includes('out_of_warranty')) ? 'Out of Warranty' : undefined,
        category: tags.includes('product_fault') ? 'product-fault' :
                  tags.includes('warranty') ? 'warranty' :
                  (tags.includes('oow') || tags.includes('out_of_warranty')) ? 'out-of-warranty' : undefined,
        supportType: tags.includes('tech_help') ? 'tech-help' :
                     tags.includes('data_recovery') ? 'data-recovery' :
                     tags.includes('warranty_claim') ? 'warranty-claim' :
                     tags.includes('general_support') ? 'general-support' : undefined,
      };
      return {
        id: t.id,
        subject: t.subject,
        status: t.status,
        requester_id: t.requester_id,
        requester_name: t.requester?.name || t.via?.source?.from?.name || '',
        updated_at: t.updated_at,
        ...derived,
      };
    });

    if (category) tickets = tickets.filter(r => (r.category || '') === String(category));
    if (supportType) tickets = tickets.filter(r => (r.supportType || '') === String(supportType));
    if (from) tickets = tickets.filter(r => new Date(r.updated_at) >= new Date(from));
    if (to) tickets = tickets.filter(r => new Date(r.updated_at) <= new Date(to + 'T23:59:59'));

    res.json({ tickets });
  } catch (err) {
    console.error('RMA tickets error:', err);
    res.status(500).json({ error: 'RMA tickets fetch failed' });
  }
});

/* ======================= RMA ENTRIES (CRUD) ======================= */

app.get('/api/rma/entries', requireSession, async (req, res) => {
  try {
    const { month, category } = req.query || {};
    const where = [];
    const params = {};
    if (month) { where.push(`DATE_FORMAT(entry_date, '%Y-%m') = :month`); params.month = month; }
    if (category) { where.push(`category = :category`); params.category = String(category); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await sqlPool.query(
      `SELECT * FROM rma_entries ${whereSql} ORDER BY entry_date DESC, id DESC`,
      params
    );
    res.json({ entries: rows });
  } catch (err) {
    console.error('List RMA entries error:', err);
    res.status(500).json({ error: 'List RMA entries failed' });
  }
});

app.get('/api/rma/entries/:id', requireSession, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await sqlPool.query(`SELECT * FROM rma_entries WHERE id = :id LIMIT 1`, { id });
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ entry: rows[0] });
  } catch (err) {
    console.error('Get RMA entry error:', err);
    res.status(500).json({ error: 'Get RMA entry failed' });
  }
});

app.post('/api/rma/entries', requireSession, requireAdmin, async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.entry_date) return res.status(400).json({ error: 'entry_date is required (YYYY-MM-DD)' });
    const sql = `
      INSERT INTO rma_entries (
        \`entry_date\`, \`ticket_id\`, \`first_name\`, \`last_name\`, \`email\`, \`phone\`,
        \`company\`, \`reseller_customer\`, \`address1\`, \`address2\`, \`city\`, \`state\`, \`country\`, \`postcode\`,
        \`product_with_fault\`, \`serial_number\`, \`product_sku\`, \`device_name\`,
        \`rma_type\`, \`stock_type\`, \`quantity\`, \`returned_reason\`, \`action\`,
        \`custom_tracking\`, \`rma_no\`, \`replacement_tracking\`, \`category\`
      ) VALUES (
        :entry_date, :ticket_id, :first_name, :last_name, :email, :phone,
        :company, :reseller_customer, :address1, :address2, :city, :state, :country, :postcode,
        :product_with_fault, :serial_number, :product_sku, :device_name,
        :rma_type, :stock_type, :quantity, :returned_reason, :action,
        :custom_tracking, :rma_no, :replacement_tracking, :category
      )
    `;
    const [r] = await sqlPool.query(sql, {
      entry_date: p.entry_date,
      ticket_id: p.ticket_id || null,
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      email: p.email || null,
      phone: p.phone || null,
      company: p.company || null,
      reseller_customer: p.reseller_customer || null,
      address1: p.address1 || null,
      address2: p.address2 || null,
      city: p.city || null,
      state: p.state || null,
      country: p.country || null,
      postcode: p.postcode || null,
      product_with_fault: p.product_with_fault || null,
      serial_number: p.serial_number || null,
      product_sku: p.product_sku || null,
      device_name: p.device_name || null,
      rma_type: p.rma_type || null,
      stock_type: p.stock_type || null,
      quantity: p.quantity ?? 1,
      returned_reason: p.returned_reason || null,
      action: p.action || null,
      custom_tracking: p.custom_tracking || null,
      rma_no: p.rma_no || null,
      replacement_tracking: p.replacement_tracking || null,
      category: p.category || null,
    });
    res.json({ ok: true, id: r.insertId });
  } catch (err) {
    console.error('Insert RMA entry error:', err?.sqlMessage || err?.message || err);
    res.status(500).json({ error: 'Insert RMA entry failed', details: err?.sqlMessage || err?.message || null });
  }
});

app.put('/api/rma/entries/:id', requireSession, requireCanEditEntries, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const allowed = [
      'entry_date','ticket_id','first_name','last_name','email','phone','company',
      'reseller_customer','address1','address2','city','state','country','postcode',
      'product_with_fault','serial_number','product_sku','device_name',
      'rma_type','stock_type','quantity','returned_reason','action',
      'custom_tracking','rma_no','replacement_tracking','category'
    ];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];

    const keys = Object.keys(patch);
    if (!keys.length) return res.json({ ok: true });

    const setClause = keys.map(k => `\`${k}\` = :${k}`).join(', ');
    await sqlPool.query(
      `UPDATE rma_entries SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
      { ...patch, id }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Update RMA entry error:', err?.sqlMessage || err?.message || err);
    res.status(500).json({ error: 'Update RMA entry failed', details: err?.sqlMessage || err?.message || null });
  }
});

app.delete('/api/rma/entries/:id', requireSession, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await sqlPool.query(`DELETE FROM rma_entries WHERE id = :id`, { id });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete RMA entry error:', err);
    res.status(500).json({ error: 'Delete RMA entry failed' });
  }
});

/* ------- NEW: RMA IMPORT/EXPORT/TEMPLATE (ADMIN) ----------------- */

// Small helpers
const ENTRY_COLUMNS = [
  'entry_date','ticket_id','first_name','last_name','email','phone','company',
  'reseller_customer','address1','address2','city','state','country','postcode',
  'product_with_fault','serial_number','product_sku','device_name',
  'rma_type','stock_type','quantity','returned_reason','action',
  'custom_tracking','rma_no','replacement_tracking','category'
];

function parseCsvSimple(buf) {
  // Very simple CSV parser (no embedded commas/quotes handling).
  const text = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf || '');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return { header: [], rows: [] };
  const header = lines[0].split(',').map(s => s.trim());
  const rows = lines.slice(1).map(l => l.split(',').map(s => s.trim()));
  return { header, rows };
}
function toYYYYMMDD(s) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(+d)) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth()+1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function sanitizeEntry(obj) {
  const out = {};
  for (const k of ENTRY_COLUMNS) {
    if (k in obj) out[k] = obj[k];
  }
  if (out.entry_date) out.entry_date = toYYYYMMDD(out.entry_date);
  if (!out.entry_date) throw new Error('entry_date is required (YYYY-MM-DD)');
  if ('quantity' in out && out.quantity !== null && out.quantity !== '') out.quantity = Number(out.quantity);
  return out;
}

app.get('/api/rma/entries/template.csv', requireSession, requireAdmin, (req, res) => {
  const header = ['entry_date', ...ENTRY_COLUMNS.filter(c => c !== 'entry_date')];
  const sample = [
    '2025-10-01','','John','Doe','john@example.com','','Acme','reseller','Street 1','','City','State','Country','12345',
    'Ninja HDMI issue','SN123','','Ninja V','Warranty','B-Stock','1','No power','Replace','TRK-001','RMA-1001','TRK-002','warranty'
  ];
  const csv = header.join(',') + '\n' + sample.join(',') + '\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="rma_entries_template.csv"');
  res.send(csv);
});

app.get('/api/rma/entries/export.csv', requireSession, requireAdmin, async (req, res) => {
  try {
    const { month, category } = req.query || {};
    const where = [];
    const params = {};
    if (month) { where.push(`DATE_FORMAT(entry_date, '%Y-%m') = :month`); params.month = month; }
    if (category) { where.push(`category = :category`); params.category = String(category); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await sqlPool.query(
      `SELECT ${['id', ...ENTRY_COLUMNS].map(c => `\`${c}\``).join(', ')} FROM rma_entries ${whereSql} ORDER BY entry_date DESC, id DESC`,
      params
    );

    const header = ['id', ...ENTRY_COLUMNS];
    const lines = [header.join(',')];
    for (const r of rows) {
      const line = header.map(h => (r[h] == null ? '' : String(r[h]).replace(/[\r\n,]+/g, ' ')));
      lines.push(line.join(','));
    }
    const csv = lines.join('\n') + '\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rma_entries_export.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
});

app.post('/api/rma/entries/import', requireSession, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const ct = (req.headers['content-type'] || '').toLowerCase();
    const isJson = ct.includes('application/json') || (req.body && !req.file);
    let items = [];

    if (isJson) {
      const body = req.body;
      if (Array.isArray(body)) items = body;
      else if (Array.isArray(body?.items)) items = body.items;
      else return res.status(400).json({ error: 'Provide JSON array or {items:[...]}' });
    } else {
      if (!req.file) return res.status(400).json({ error: 'file is required (CSV)' });
      const { header, rows } = parseCsvSimple(req.file.buffer);
      if (!header.length) return res.status(400).json({ error: 'CSV header missing' });
      // map rows to objects by header
      for (const r of rows) {
        const obj = {};
        header.forEach((h, i) => { obj[h] = r[i] ?? ''; });
        items.push(obj);
      }
    }

    if (!items.length) return res.status(400).json({ error: 'No rows to import' });

    // begin transaction
    const conn = await sqlPool.getConnection();
    try {
      await conn.beginTransaction();

      const sql = `
        INSERT INTO rma_entries (
          \`entry_date\`, \`ticket_id\`, \`first_name\`, \`last_name\`, \`email\`, \`phone\`,
          \`company\`, \`reseller_customer\`, \`address1\`, \`address2\`, \`city\`, \`state\`, \`country\`, \`postcode\`,
          \`product_with_fault\`, \`serial_number\`, \`product_sku\`, \`device_name\`,
          \`rma_type\`, \`stock_type\`, \`quantity\`, \`returned_reason\`, \`action\`,
          \`custom_tracking\`, \`rma_no\`, \`replacement_tracking\`, \`category\`
        ) VALUES (
          :entry_date, :ticket_id, :first_name, :last_name, :email, :phone,
          :company, :reseller_customer, :address1, :address2, :city, :state, :country, :postcode,
          :product_with_fault, :serial_number, :product_sku, :device_name,
          :rma_type, :stock_type, :quantity, :returned_reason, :action,
          :custom_tracking, :rma_no, :replacement_tracking, :category
        )
      `;

      const report = [];
      for (let i = 0; i < items.length; i++) {
        try {
          const clean = sanitizeEntry(items[i] || {});
          await conn.query(sql, {
            entry_date: clean.entry_date,
            ticket_id: clean.ticket_id || null,
            first_name: clean.first_name || null,
            last_name: clean.last_name || null,
            email: clean.email || null,
            phone: clean.phone || null,
            company: clean.company || null,
            reseller_customer: clean.reseller_customer || null,
            address1: clean.address1 || null,
            address2: clean.address2 || null,
            city: clean.city || null,
            state: clean.state || null,
            country: clean.country || null,
            postcode: clean.postcode || null,
            product_with_fault: clean.product_with_fault || null,
            serial_number: clean.serial_number || null,
            product_sku: clean.product_sku || null,
            device_name: clean.device_name || null,
            rma_type: clean.rma_type || null,
            stock_type: clean.stock_type || null,
            quantity: clean.quantity ?? 1,
            returned_reason: clean.returned_reason || null,
            action: clean.action || null,
            custom_tracking: clean.custom_tracking || null,
            rma_no: clean.rma_no || null,
            replacement_tracking: clean.replacement_tracking || null,
            category: clean.category || null,
          });
          report.push({ row: i + 1, ok: true });
        } catch (rowErr) {
          report.push({ row: i + 1, ok: false, error: rowErr?.message || String(rowErr) });
        }
      }

      const failed = report.filter(r => !r.ok).length;
      if (failed) {
        // keep partial inserts but return details
        await conn.commit();
        return res.status(207).json({ ok: failed === 0, imported: items.length - failed, failed, report });
      } else {
        await conn.commit();
        return res.json({ ok: true, imported: items.length, report });
      }
    } catch (txErr) {
      await conn.rollback();
      console.error('Import TX error:', txErr);
      return res.status(500).json({ error: 'Import failed', details: txErr?.message || null });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: 'Import failed' });
  }
});

/* ======================= RMA STOCK (EMEA) ======================= */

app.get('/api/rma/emea/devices', requireSession, async (_req, res) => {
  try {
    const [rows] = await sqlPool.query(
      `SELECT DISTINCT device_name FROM rma_entries WHERE device_name IS NOT NULL AND device_name <> '' ORDER BY device_name ASC`
    );
    const list = rows.map(r => r.device_name);
    const fallback = ["Ninja", "Ninja V", "Shogun Ultra", "Shinobi II", "Sumo 19SE"];
    res.json({ devices: list.length ? list : fallback });
  } catch (err) {
    console.error('emea/devices error', err);
    res.status(500).json({ error: 'Devices fetch failed' });
  }
});

app.get('/api/rma/emea/stock', requireSession, async (req, res) => {
  try {
    const { month, device_name } = req.query || {};
    if (!month) return res.status(400).json({ error: 'month (YYYY-MM) is required' });
    const params = { month };
    let sql = `SELECT * FROM rma_emea_stock WHERE month = :month`;
    if (device_name) { sql += ` AND device_name = :device_name`; params.device_name = device_name; }
    const [rows] = await sqlPool.query(sql, params);
    res.json({ items: rows });
  } catch (err) {
    console.error('emea/stock list error', err);
    res.status(500).json({ error: 'EMEA stock fetch failed' });
  }
});

app.post('/api/rma/emea/stock', requireSession, requireAdmin, async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.month || !/^\d{4}-\d{2}$/.test(p.month)) return res.status(400).json({ error: 'month is required as YYYY-MM' });
    if (!p.device_name) return res.status(400).json({ error: 'device_name is required' });

    const toInt = (v) => (v == null || v === '' ? 0 : Number(v));
    await sqlPool.query(`
      INSERT INTO rma_emea_stock
        (month, device_name, d_stock_received, b_stock_received, new_stock_sent, rma_bstock_rstock_sent,
         awaiting_delivery_from_user, receiving_only, awaiting_return_from_rush, notes)
      VALUES
        (:month, :device_name, :d_stock_received, :b_stock_received, :new_stock_sent, :rma_bstock_rstock_sent,
         :awaiting_delivery_from_user, :receiving_only, :awaiting_return_from_rush, :notes)
      ON DUPLICATE KEY UPDATE
        d_stock_received = VALUES(d_stock_received),
        b_stock_received = VALUES(b_stock_received),
        new_stock_sent = VALUES(new_stock_sent),
        rma_bstock_rstock_sent = VALUES(rma_bstock_rstock_sent),
        awaiting_delivery_from_user = VALUES(awaiting_delivery_from_user),
        receiving_only = VALUES(receiving_only),
        awaiting_return_from_rush = VALUES(awaiting_return_from_rush),
        notes = VALUES(notes),
        updated_at = CURRENT_TIMESTAMP
    `, {
      month: p.month,
      device_name: p.device_name,
      d_stock_received: toInt(p.d_stock_received),
      b_stock_received: toInt(p.b_stock_received),
      new_stock_sent: toInt(p.new_stock_sent),
      rma_bstock_rstock_sent: toInt(p.rma_bstock_rstock_sent),
      awaiting_delivery_from_user: toInt(p.awaiting_delivery_from_user),
      receiving_only: toInt(p.receiving_only),
      awaiting_return_from_rush: toInt(p.awaiting_return_from_rush),
      notes: p.notes || null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('emea/stock upsert error', err);
    res.status(500).json({ error: 'EMEA stock save failed' });
  }
});

app.put('/api/rma/emea/stock/:id', requireSession, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const allowed = [
      'month','device_name','d_stock_received','b_stock_received','new_stock_sent',
      'rma_bstock_rstock_sent','awaiting_delivery_from_user','receiving_only','awaiting_return_from_rush','notes'
    ];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
    const fields = Object.keys(patch);
    if (!fields.length) return res.json({ ok: true });

    const toIntKeys = new Set(['d_stock_received','b_stock_received','new_stock_sent','rma_bstock_rstock_sent','awaiting_delivery_from_user','receiving_only','awaiting_return_from_rush']);
    const setClause = fields.map(k => `${k} = :${k}`).join(', ');
    const params = {};
    for (const k of fields) params[k] = toIntKeys.has(k) ? Number(patch[k] || 0) : patch[k];

    await sqlPool.query(
      `UPDATE rma_emea_stock SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
      { ...params, id }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('emea/stock update error', err);
    res.status(500).json({ error: 'EMEA stock update failed' });
  }
});

app.delete('/api/rma/emea/stock/:id', requireSession, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await sqlPool.query(`DELETE FROM rma_emea_stock WHERE id = :id`, { id });
    res.json({ ok: true });
  } catch (err) {
    console.error('emea/stock delete error', err);
    res.status(500).json({ error: 'EMEA stock delete failed' });
  }
});

/* ======================= RMA STOCK (US) ======================= */

app.get('/api/rma/us/devices', requireSession, async (_req, res) => {
  try {
    const [rows] = await sqlPool.query(
      `SELECT DISTINCT device_name FROM rma_entries WHERE device_name IS NOT NULL AND device_name <> '' ORDER BY device_name ASC`
    );
    const list = rows.map(r => r.device_name);
    const fallback = ["Ninja", "Ninja V", "Shogun Ultra", "Shinobi II", "Sumo 19SE"];
    res.json({ devices: list.length ? list : fallback });
  } catch (err) {
    console.error('us/devices error', err);
    res.status(500).json({ error: 'Devices fetch failed' });
  }
});

app.get('/api/rma/us/stock', requireSession, async (req, res) => {
  try {
    const { month, device_name } = req.query || {};
    if (!month) return res.status(400).json({ error: 'month (YYYY-MM) is required' });
    const params = { month };
    let sql = `SELECT * FROM rma_us_stock WHERE month = :month`;
    if (device_name) { sql += ` AND device_name = :device_name`; params.device_name = device_name; }
    const [rows] = await sqlPool.query(sql, params);
    res.json({ items: rows });
  } catch (err) {
    console.error('us/stock list error', err);
    res.status(500).json({ error: 'US stock fetch failed' });
  }
});

app.post('/api/rma/us/stock', requireSession, requireAdmin, async (req, res) => {
  try {
    const p = req.body || {};
    if (!p.month || !/^\d{4}-\d{2}$/.test(p.month)) return res.status(400).json({ error: 'month is required as YYYY-MM' });
    if (!p.device_name) return res.status(400).json({ error: 'device_name is required' });

    const toInt = (v) => (v == null || v === '' ? 0 : Number(v));
    await sqlPool.query(`
      INSERT INTO rma_us_stock
        (month, device_name, d_stock_received, b_stock_received, new_stock_sent, rma_bstock_rstock_sent,
         a_stock_received, awaiting_delivery_from_user, receive_only, awaiting_return_from_rush, notes)
      VALUES
        (:month, :device_name, :d_stock_received, :b_stock_received, :new_stock_sent, :rma_bstock_rstock_sent,
         :a_stock_received, :awaiting_delivery_from_user, :receive_only, :awaiting_return_from_rush, :notes)
      ON DUPLICATE KEY UPDATE
        d_stock_received = VALUES(d_stock_received),
        b_stock_received = VALUES(b_stock_received),
        new_stock_sent = VALUES(new_stock_sent),
        rma_bstock_rstock_sent = VALUES(rma_bstock_rstock_sent),
        a_stock_received = VALUES(a_stock_received),
        awaiting_delivery_from_user = VALUES(awaiting_delivery_from_user),
        receive_only = VALUES(receive_only),
        awaiting_return_from_rush = VALUES(awaiting_return_from_rush),
        notes = VALUES(notes),
        updated_at = CURRENT_TIMESTAMP
    `, {
      month: p.month,
      device_name: p.device_name,
      d_stock_received: toInt(p.d_stock_received),
      b_stock_received: toInt(p.b_stock_received),
      new_stock_sent: toInt(p.new_stock_sent),
      rma_bstock_rstock_sent: toInt(p.rma_bstock_rstock_sent),
      a_stock_received: toInt(p.a_stock_received),
      awaiting_delivery_from_user: toInt(p.awaiting_delivery_from_user),
      receive_only: toInt(p.receive_only),
      awaiting_return_from_rush: toInt(p.awaiting_return_from_rush),
      notes: p.notes || null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('us/stock upsert error', err);
    res.status(500).json({ error: 'US stock save failed' });
  }
});

app.put('/api/rma/us/stock/:id', requireSession, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const allowed = [
      'month','device_name','d_stock_received','b_stock_received','new_stock_sent',
      'rma_bstock_rstock_sent','a_stock_received','awaiting_delivery_from_user','receive_only','awaiting_return_from_rush','notes'
    ];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];
    const fields = Object.keys(patch);
    if (!fields.length) return res.json({ ok: true });

    const toIntKeys = new Set(['d_stock_received','b_stock_received','new_stock_sent','rma_bstock_rstock_sent','a_stock_received','awaiting_delivery_from_user','receive_only','awaiting_return_from_rush']);
    const setClause = fields.map(k => `${k} = :${k}`).join(', ');
    const params = {};
    for (const k of fields) params[k] = toIntKeys.has(k) ? Number(patch[k] || 0) : patch[k];

    await sqlPool.query(
      `UPDATE rma_us_stock SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
      { ...params, id }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('us/stock update error', err);
    res.status(500).json({ error: 'US stock update failed' });
  }
});

app.delete('/api/rma/us/stock/:id', requireSession, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await sqlPool.query(`DELETE FROM rma_us_stock WHERE id = :id`, { id });
    res.json({ ok: true });
  } catch (err) {
    console.error('us/stock delete error', err);
    res.status(500).json({ error: 'US stock delete failed' });
  }
});

// --- Start server ------------------------------------------------
initMySQL()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API server listening on http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    console.error('MySQL init failed:', e);
    process.exit(1);
  });
