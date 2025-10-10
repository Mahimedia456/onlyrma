import { ok, send, parseCookies, setCookie } from '../_lib.js';
export const config = { runtime: 'nodejs' };

export default function handler(req, res) {
  const cookies = parseCookies(req);
  if (cookies.rma_sess === '1') {
    // extend expiry
    setCookie(res, 'rma_sess', '1');
    return ok(res, { ok: true, refreshed: true });
  }
  return send(res, 401, { error: 'No session' });
}
