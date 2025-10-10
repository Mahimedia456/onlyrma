import { config, store, requireAny, send, toMonth, toCSV } from '../../_shared.js';
export { config };

export default function handler(req, res) {
  if (!requireAny(req, res)) return;

  const url = new URL(req.url, 'http://x');
  const month = (url.searchParams.get('month') || '').trim();
  const category = (url.searchParams.get('category') || '').trim();

  let entries = store.entries;
  if (month) entries = entries.filter(e => toMonth(e.entry_date || e.created_at) === month);
  if (category) entries = entries.filter(e => (e.category || '') === category);

  const cols = [
    'id','entry_date','rma_no','ticket_id','first_name','last_name','email','phone','company','reseller_customer',
    'address1','address2','city','state','country','postcode','product_with_fault','serial_number',
    'product_sku','device_name','category','rma_type','stock_type','quantity','returned_reason','action',
    'custom_tracking','replacement_tracking','created_at','updated_at','organization'
  ];
  const csv = toCSV(entries, cols);
  res.setHeader('Content-Disposition', `attachment; filename=RMA_Entries_${month || 'all'}.csv`);
  return send(res, 200, csv, 'text/csv; charset=utf-8');
}
