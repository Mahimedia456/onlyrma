// api/_lib.js
export const config = { runtime: 'nodejs' };

/* ------------ In-memory stores (cold start pe reset) ------------ */
export const db = {
  entries: [],
  emeaStock: [],
  usStock: [],
};

/* ----------------------- Helpers ----------------------- */
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
export function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}
export function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((a, p) => {
    const [k, v] = p.split('=').map(s => s && s.trim());
    if (!k) return a;
    a[k] = decodeURIComponent(v || '');
    return a;
  }, {});
}
export function setCookie(res, name, value, {
  maxAgeDays = 30,
  path = '/',
  sameSite = 'Lax',
  httpOnly = true,
  // Vercel prod pe Secure, local pe off
  secure = process.env.VERCEL ? true : false
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
export function clearCookie(res, name) {
  const secure = !!process.env.VERCEL;
  res.setHeader('Set-Cookie',
    `${name}=; Path=/; Max-Age=0; SameSite=Lax; ${secure ? 'Secure; ' : ''}HttpOnly`
  );
}
export function requireAny(req, res) {
  const cookies = parseCookies(req);
  if (cookies.rma_sess !== '1') {
    send(res, 401, { error: 'Not authenticated' });
    return false;
  }
  return true;
}
export function genId(prefix='id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}
export function toMonth(v) { // YYYY-MM
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0,7);
  return d.toISOString().slice(0,7);
}
export function fmtDateISO(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0,10);
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
