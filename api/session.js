import { ok, send, parseCookies } from './_lib.js';
export const config = { runtime: 'nodejs' };

export default function handler(req, res) {
  const cookies = parseCookies(req);
  if (cookies.rma_sess === '1') {
    // NOTE: simple demo — hamisha admin return kar raha. Agar viewer login hua ho to
    // role ko FE se localStorage me set kar rahe ho. (Yeh minimal server hai.)
    return ok(res, { ok: true, role: 'admin', user: { email: 'internal@mahimediasolutions.com' } });
  }
  return send(res, 401, { error: 'No session' });
}
