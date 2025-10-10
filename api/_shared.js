// api/_shared.js
// Shared helpers + in-memory stores (non-persistent).

export const config = { runtime: 'nodejs' }; // Node runtime on Vercel

// -------- In-memory stores (reset on cold start) --------
export const store = {
  entries: [],
  emeaStock: [],
  usStock: [],
  nextId: 1,
};

// -------- Cookie/session helpers --------
const COOKIE_NAME = 'rma_sess';

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((a, p) => {
    const [k, v] = p.split('=').map(s => s && s.trim());
    if (!k) return a;
    a[k] = decodeURIComponent(v || '');
    return a;
  }, {});
}

export function setCookie(res, name, value, { maxAge = 60 * 60 * 24 * 30, path = '/', httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `Max-Age=${maxAge}`, 'SameSite=Lax', 'Secure'];
  if (httpOnly) parts.push('HttpOnly');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`);
}

export function ok(res, body) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function send(res, status, body, type = 'application/json') {
  res.statusCode = status;
  res.setHeader('Content-Type', type);
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

export function requireAny(req, res) {
  const cookies = parseCookies(req);
  if (cookies[COOKIE_NAME] !== '1') {
    send(res, 401, { error: 'Not authenticated' });
    return false;
  }
  return true;
}

export function requireAdmin(req, res) {
  // In this memory version, we don’t store role in cookie; treat session==1 as logged-in
  // If you want strict admin vs viewer, store a role cookie/value similarly.
  return requireAny(req, res);
}

// -------- Misc utils --------
export function genId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function csvEscape(val) {
  if (val === undefined || val === null) return '';
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows, columns) {
  const header = columns.join(',');
  const lines = rows.map(r => columns.map(c => csvEscape(r[c])).join(','));
  return '\uFEFF' + [header, ...lines].join('\n');
}

export function toMonth(v) { // YYYY-MM
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 7);
  return d.toISOString().slice(0, 7);
}

export function fmtDateISO(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch { return null; }
}

export function numberizeAll(obj) {
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) out[k] = Number(v);
  }
  return out;
}
