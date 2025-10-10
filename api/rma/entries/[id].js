import { ok, send, readBody, requireAny, fmtDateISO, db } from '../../../_lib.js';
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (!requireAny(req, res)) return;

  const m = req.url.match(/\/api\/rma\/entries\/([^/?]+)/);
  const id = m && m[1];
  const idx = db.entries.findIndex(e => e.id === id);
  if (idx === -1) return send(res, 404, { error: 'Not found' });

  if (req.method === 'PUT') {
    const patch = await readBody(req);
    const merged = {
      ...db.entries[idx],
      ...patch,
      entry_date: fmtDateISO(patch.entry_date) ?? db.entries[idx].entry_date,
      updated_at: new Date().toISOString(),
    };
    db.entries[idx] = merged;
    return ok(res, { ok: true, entry: merged });
  }

  if (req.method === 'DELETE') {
    db.entries.splice(idx, 1);
    return ok(res, { ok: true });
  }

  return send(res, 405, { error: 'Method Not Allowed' });
}
