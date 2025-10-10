import { config, setCookie, ok, send } from './_shared.js';
export { config };

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method Not Allowed' });
  const { email, password } = await readBody(req);
  if (email?.toLowerCase() === 'rush@mahimedisolutions.com' && password === 'aamirtest') {
    setCookie(res, 'rma_sess', '1', { httpOnly: true });
    return ok(res, { ok: true, role: 'viewer', user: { email } });
  }
  return send(res, 401, { ok: false, error: 'Invalid viewer credentials' });
}
