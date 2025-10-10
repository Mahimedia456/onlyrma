import { config, store, requireAny, ok, send, numberizeAll } from '../../../_shared.js';
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
  const idx = store.emeaStock.findIndex(r => r.id === id);
  if (idx === -1) return send(res, 404, { error: 'Not found' });

  if (req.method === 'PUT') {
    const patch = numberizeAll(await readBody(req));
    store.emeaStock[idx] = { ...store.emeaStock[idx], ...patch, updated_at: new Date().toISOString() };
    return ok(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    store.emeaStock.splice(idx, 1);
    return ok(res, { ok: true });
  }

  return send(res, 405, { error: 'Method Not Allowed' });
}
