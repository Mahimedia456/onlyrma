import { send, requireAny, toMonth, toCSV, db } from '../../../_lib.js';
export const config = { runtime: 'nodejs' };

export default function handler(req, res) {
  if (!requireAny(req, res)) return;

  const u = new URL(req.url, 'http://x');
  const month = (u.searchParams.get('month') || '').trim();
  const category = (u.searchParams.get('category') || '').trim();
  let list = db.entries;
  if (month) list = list.filter(e => toMonth(e.entry_date || e.created_at) === month);
  if (category) list = list.filter(e => (e.category || '') === category);

  const cols = [
    'id','entry_date','rma_no','ticket_id','first_name','last_name','email','phone','company','reseller_customer',
    'address1','address2','city','state','country','postcode','product_with_fault','serial_number',
    'product_sku','device_name','category','rma_type','stock_type','quantity','returned_reason','action',
    'custom_tracking','replacement_tracking','created_at','updated_at','organization'
  ];
  const csv = toCSV(list, cols);
  res.setHeader('Content-Disposition', `attachment; filename=RMA_Entries_${month || 'all'}.csv`);
  return send(res, 200, csv, 'text/csv; charset=utf-8');
}
