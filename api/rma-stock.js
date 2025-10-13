export const config = { runtime: 'nodejs' };
import { supa, genId, toMonth } from './_db.js';
import { ok, send, readBody, parseCookies } from './_lib.js';

function requireAny(req, res) {
  const cookies = parseCookies(req);
  if (cookies.rma_sess !== '1') { send(res, 401, { error: 'Not authenticated' }); return false; }
  return true;
}

async function list(table, req, res) {
  const u = new URL(req.url, 'http://x');
  const month  = (u.searchParams.get('month') || '').trim();
  const device = (u.searchParams.get('device_name') || '').trim();
  let q = supa.from(table).select('*').order('created_at', { ascending: false });
  if (month)  q = q.eq('month', month);
  if (device) q = q.eq('device_name', device);
  const { data, error } = await q;
  if (error) return send(res, 500, { error: error.message });
  return ok(res, { items: data || [] });
}
async function create(table, req, res) {
  const body = await readBody(req);
  const row = {
    id: genId(table.includes('emea') ? 'emea' : 'us'),
    month: body.month || toMonth(new Date().toISOString()),
    device_name: body.device_name || '—',
    ...body,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supa.from(table).insert(row);
  if (error) return send(res, 500, { error: error.message });
  return ok(res, { ok: true, row });
}
async function update(table, id, req, res) {
  const patch = await readBody(req);
  patch.updated_at = new Date().toISOString();
  const { error } = await supa.from(table).update(patch).eq('id', id);
  if (error) return send(res, 500, { error: error.message });
  return ok(res, { ok: true });
}
async function remove(table, id, _req, res) {
  const { error } = await supa.from(table).delete().eq('id', id);
  if (error) return send(res, 500, { error: error.message });
  return ok(res, { ok: true });
}

export default async function handler(req, res) {
  const path = (req.url.split('?')[0] || '');
  if (path === '/api/rma/us/stock') {
    if (!requireAny(req, res)) return;
    if (req.method === 'GET')  return list('rma_stock_us', req, res);
    if (req.method === 'POST') return create('rma_stock_us', req, res);
    return send(res, 405, { error: 'Method Not Allowed' });
  }
  const usId = path.match(/^\/api\/rma\/us\/stock\/([^/]+)$/);
  if (usId) {
    if (!requireAny(req, res)) return;
    if (req.method === 'PUT')    return update('rma_stock_us', usId[1], req, res);
    if (req.method === 'DELETE') return remove('rma_stock_us', usId[1], req, res);
    return send(res, 405, { error: 'Method Not Allowed' });
  }

  if (path === '/api/rma/emea/stock') {
    if (!requireAny(req, res)) return;
    if (req.method === 'GET')  return list('rma_stock_emea', req, res);
    if (req.method === 'POST') return create('rma_stock_emea', req, res);
    return send(res, 405, { error: 'Method Not Allowed' });
  }
  const emeaId = path.match(/^\/api\/rma\/emea\/stock\/([^/]+)$/);
  if (emeaId) {
    if (!requireAny(req, res)) return;
    if (req.method === 'PUT')    return update('rma_stock_emea', emeaId[1], req, res);
    if (req.method === 'DELETE') return remove('rma_stock_emea', emeaId[1], req, res);
    return send(res, 405, { error: 'Method Not Allowed' });
  }

  // optional devices endpoints: read distinct names from each table
  if (path === '/api/rma/us/devices') {
    if (!requireAny(req, res)) return;
    const { data, error } = await supa.from('rma_stock_us').select('device_name');
    if (error) return send(res, 500, { error: error.message });
    const devices = Array.from(new Set((data||[]).map(d => d.device_name).filter(Boolean))).sort();
    return ok(res, { devices });
  }
  if (path === '/api/rma/emea/devices') {
    if (!requireAny(req, res)) return;
    const { data, error } = await supa.from('rma_stock_emea').select('device_name');
    if (error) return send(res, 500, { error: error.message });
    const devices = Array.from(new Set((data||[]).map(d => d.device_name).filter(Boolean))).sort();
    return ok(res, { devices });
  }

  return send(res, 404, { error: 'Not Found' });
}
