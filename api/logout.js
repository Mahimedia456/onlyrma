import { config, clearCookie, ok } from './_shared.js';
export { config };

export default function handler(_req, res) {
  clearCookie(res, 'rma_sess');
  return ok(res, { ok: true });
}
