export const config = { runtime: 'nodejs' };

function setCookie(res, name, value, { maxAge = 60 * 60 * 24 * 30, path = '/', httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `Max-Age=${maxAge}`, 'SameSite=Lax', 'Secure'];
  if (httpOnly) parts.push('HttpOnly');
  res.setHeader('Set-Cookie', parts.join('; '));
}
async function readBody(req) {
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method Not Allowed'); }
  const { email, password } = await readBody(req);
  if (email === 'rush@mahimediasolutions.com' && password) {
    setCookie(res, 'rma_sess', '1', { httpOnly: true });
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: true, role: 'viewer', user: { email } }));
  }
  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: false, error: 'Invalid viewer credentials' }));
}
