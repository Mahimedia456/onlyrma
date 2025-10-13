export const config = { runtime: 'nodejs' };

/* --------- helpers ---------- */
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
  sameSite = process.env.VERCEL ? 'None' : 'Lax',
  httpOnly = true,
  secure = !!process.env.VERCEL
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
  const secure = !!process.env.VERCEL;
  res.setHeader('Set-Cookie',
    `${name}=; Path=/; Max-Age=0; SameSite=Lax; ${secure ? 'Secure; ' : ''}HttpOnly`
  );
}

/* --------- handlers ---------- */
async function internalLogin(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method Not Allowed' });
  const { email, password } = await readBody(req);
  if (email?.toLowerCase() === 'internal@mahimedisolutions.com' && password === 'mahimediasolutions') {
    setCookie(res, 'rma_sess', '1');
    return ok(res, { ok: true, role: 'admin', user: { email } });
  }
  return send(res, 401, { ok: false, error: 'Invalid credentials' });
}
async function viewerLogin(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method Not Allowed' });
  const { email, password } = await readBody(req);
  if (email?.toLowerCase() === 'rush@mahimedisolutions.com' && password === 'aamirtest') {
    setCookie(res, 'rma_sess', '1');
    return ok(res, { ok: true, role: 'viewer', user: { email } });
  }
  return send(res, 401, { ok: false, error: 'Invalid viewer credentials' });
}
function sessionGet(req, res) {
  const cookies = parseCookies(req);
  if (cookies.rma_sess === '1') {
    return ok(res, { ok: true, role: 'admin', user: { email: 'internal@mahimedisolutions.com' } });
  }
  return send(res, 401, { error: 'No session' });
}
function sessionRefresh(req, res) {
  const cookies = parseCookies(req);
  if (cookies.rma_sess === '1') {
    setCookie(res, 'rma_sess', '1'); // extend
    return ok(res, { ok: true, refreshed: true });
  }
  return send(res, 401, { error: 'No session' });
}
function logout(_req, res) {
  clearCookie(res, 'rma_sess');
  return ok(res, { ok: true });
}

/* --------- main handler ---------- */
export default async function handler(req, res) {
  const path = (req.url.split('?')[0] || '');

  if (path.includes('/internal-login'))  return internalLogin(req, res);
  if (path.includes('/viewer-login'))    return viewerLogin(req, res);
  if (path.includes('/session/refresh')) return sessionRefresh(req, res);
  if (path.includes('/session'))         return sessionGet(req, res);
  if (path.includes('/logout'))          return logout(req, res);

  return send(res, 404, { error: 'Not Found' });
}
