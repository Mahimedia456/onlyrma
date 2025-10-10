import { ok, send, readBody, requireAny, numberizeAll, db } from '../../../../_lib.js';
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (!requireAny(req, res)) return;

  const m = req.url.match(/\/api\/rma\/emea\/stock\/([^/?]+)/);
  const id = m && m[1];
  const idx = db.emeaStock.findIndex(r => r.id === id);
  if (idx === -1) return send(res, 404, { error: 'Not found' });

  if (req.method === 'PUT') {
    const patch = numberizeAll(await readBody(req));
    db.emeaStock[idx] = { ...db.emeaStock[idx], ...patch, updated_at: new Date().toISOString() };
    return ok(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    db.emeaStock.splice(idx, 1);
    return ok(res, { ok: true });
  }

  return send(res, 405, { error: 'Method Not Allowed' });
}
