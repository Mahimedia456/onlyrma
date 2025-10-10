import { config, store, requireAny, ok, send, fmtDateISO } from '../../_shared.js';
export { config };

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

export default async function handler(req, res) {
  if (!requireAny(req, res)) return;

  const id = req.url.split('/').pop();
  const idx = store.entries.findIndex(e => e.id === id);
  if (idx === -1) return send(res, 404, { error: 'Not found' });

  if (req.method === 'PUT') {
    const patch = await readBody(req);
    const merged = {
      ...store.entries[idx],
      ...patch,
      entry_date: fmtDateISO(patch.entry_date) ?? store.entries[idx].entry_date,
      updated_at: new Date().toISOString(),
    };
    store.entries[idx] = merged;
    return ok(res, { ok: true, entry: merged });
  }

  if (req.method === 'DELETE') {
    store.entries.splice(idx, 1);
    return ok(res, { ok: true });
  }

  return send(res, 405, { error: 'Method Not Allowed' });
}
