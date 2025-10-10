import { config, store, requireAny, ok, send, numberizeAll, toMonth, genId } from '../../../_shared.js';
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

  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://x');
    const month = (url.searchParams.get('month') || '').trim();
    const device = (url.searchParams.get('device_name') || '').trim();
    let items = store.usStock;
    if (month) items = items.filter(r => (r.month || '') === month);
    if (device) items = items.filter(r => (r.device_name || '') === device);
    return ok(res, { items });
  }

  if (req.method === 'POST') {
    const body = numberizeAll(await readBody(req));
    const row = {
      id: genId('us'),
      month: body.month || toMonth(new Date().toISOString()),
      device_name: body.device_name || '—',
      d_stock_received: Number(body.d_stock_received)||0,
      b_stock_received: Number(body.b_stock_received)||0,
      new_stock_sent: Number(body.new_stock_sent)||0,
      rma_bstock_rstock_sent: Number(body.rma_bstock_rstock_sent)||0,
      a_stock_received: Number(body.a_stock_received)||0,
      awaiting_delivery_from_user: Number(body.awaiting_delivery_from_user)||0,
      receive_only: Number(body.receive_only)||0,
      awaiting_return_from_rush: Number(body.awaiting_return_from_rush)||0,
      notes: body.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.usStock.push(row);
    return ok(res, { ok: true, row });
  }

  return send(res, 405, { error: 'Method Not Allowed' });
}
