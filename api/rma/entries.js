import {
  ok, send, readBody, requireAny, toMonth, fmtDateISO, genId, toCSV, db
} from '../../_lib.js';
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (!requireAny(req, res)) return;

  if (req.method === 'GET') {
    const u = new URL(req.url, 'http://x');
    const month = (u.searchParams.get('month') || '').trim();
    const category = (u.searchParams.get('category') || '').trim();
    let out = db.entries;
    if (month) out = out.filter(e => toMonth(e.entry_date || e.created_at) === month);
    if (category) out = out.filter(e => (e.category || '') === category);
    return ok(res, { entries: out });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const now = new Date().toISOString();
    const entry = {
      id: genId('rma'),
      entry_date: fmtDateISO(body.entry_date) || now.slice(0,10),
      ticket_id: body.ticket_id || '',
      first_name: body.first_name || '',
      last_name: body.last_name || '',
      email: body.email || '',
      phone: body.phone || '',
      company: body.company || '',
      reseller_customer: body.reseller_customer || '',
      address1: body.address1 || '',
      address2: body.address2 || '',
      city: body.city || '',
      state: body.state || '',
      country: body.country || '',
      postcode: body.postcode || '',
      product_with_fault: body.product_with_fault || '',
      serial_number: body.serial_number || '',
      product_sku: body.product_sku || '',
      device_name: body.device_name || '',
      rma_type: body.rma_type || '',
      stock_type: body.stock_type || '',
      quantity: Number(body.quantity) || 0,
      returned_reason: body.returned_reason || '',
      action: body.action || '',
      custom_tracking: body.custom_tracking || '',
      rma_no: body.rma_no || '',
      replacement_tracking: body.replacement_tracking || '',
      category: body.category || '',
      organization: body.organization || '',
      created_at: now,
      updated_at: now,
    };
    db.entries.push(entry);
    return ok(res, { ok: true, entry });
  }

  return send(res, 405, { error: 'Method Not Allowed' });
}
