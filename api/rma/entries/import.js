import { ok, send, readBody, requireAny, fmtDateISO, genId, db } from '../../../_lib.js';
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (!requireAny(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'Method Not Allowed' });

  const { items = [] } = await readBody(req);
  const now = new Date().toISOString();
  let imported = 0;
  const report = [];

  for (const raw of items) {
    try {
      const e = {
        id: genId('rma'),
        entry_date: fmtDateISO(raw.entry_date) || now.slice(0,10),
        ticket_id: raw.ticket_id || '',
        first_name: raw.first_name || '',
        last_name: raw.last_name || '',
        email: raw.email || '',
        phone: raw.phone || '',
        company: raw.company || '',
        reseller_customer: raw.reseller_customer || '',
        address1: raw.address1 || '',
        address2: raw.address2 || '',
        city: raw.city || '',
        state: raw.state || '',
        country: raw.country || '',
        postcode: raw.postcode || '',
        product_with_fault: raw.product_with_fault || '',
        serial_number: raw.serial_number || '',
        product_sku: raw.product_sku || '',
        device_name: raw.device_name || '',
        rma_type: raw.rma_type || '',
        stock_type: raw.stock_type || '',
        quantity: Number(raw.quantity) || 0,
        returned_reason: raw.returned_reason || '',
        action: raw.action || '',
        custom_tracking: raw.custom_tracking || '',
        rma_no: raw.rma_no || '',
        replacement_tracking: raw.replacement_tracking || '',
        category: raw.category || '',
        organization: raw.organization || '',
        created_at: now,
        updated_at: now,
      };
      db.entries.push(e);
      imported++;
      report.push({ ok: true, id: e.id });
    } catch (err) {
      report.push({ ok: false, error: err?.message || 'Unknown import error' });
    }
  }
  const failed = items.length - imported;
  if (failed > 0) return send(res, 207, { imported, failed, report });
  return ok(res, { imported, failed: 0 });
}
