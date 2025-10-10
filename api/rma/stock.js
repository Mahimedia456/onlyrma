import { ok, send, readBody, requireAny, numberizeAll, db } from '../../../_lib.js';
export const config = { runtime: 'nodejs' };

function filterStock(list, url) {
  const u = new URL(url, 'http://x');
  const month = (u.searchParams.get('month') || '').trim();
  const device = (u.searchParams.get('device_name') || '').trim();
  let out = list;
  if (month) out = out.filter(r => (r.month || '') === month);
  if (device) out = out.filter(r => (r.device_name || '') === device);
  return out;
}

export default async function handler(req, res) {
  if (!requireAny(req, res)) return;

  if (req.method === 'GET') {
    const items = filterStock(db.emeaStock, req.url);
    return ok(res, { items });
  }

  if (req.method === 'POST') {
    const body = numberizeAll(await readBody(req));
    const row = {
      id: `emea_${Date.now()}`,
      month: body.month || new Date().toISOString().slice(0,7),
      device_name: body.device_name || '—',
      d_stock_received: Number(body.d_stock_received)||0,
      b_stock_received: Number(body.b_stock_received)||0,
      new_stock_sent: Number(body.new_stock_sent)||0,
      rma_bstock_rstock_sent: Number(body.rma_bstock_rstock_sent)||0,
      awaiting_delivery_from_user: Number(body.awaiting_delivery_from_user)||0,
      receiving_only: Number(body.receiving_only)||0,
      awaiting_return_from_rush: Number(body.awaiting_return_from_rush)||0,
      notes: body.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.emeaStock.push(row);
    return ok(res, { ok: true, row });
  }

  return send(res, 405, { error: 'Method Not Allowed' });
}
