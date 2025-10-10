import { config, send } from '../../_shared.js';
export { config };

export default function handler(_req, res) {
  const headers = [
    'Date','Ticket','First Name','Last Name','Email','Phone','Company (if Applicable)','Reseller / Customer',
    'Address 1','Address 2','City','State (use 2 digit code)','Country','Post Code',
    "Product with fault",'Serial Number of faulty product',"Product SKU for replacement (no more ninja's without my approval)",
    'Device Name','RMA Type','Stock Type','Quantity','Return Reason (Subject)','Action',
    'Customer Return Tracking Number (REQUIRED)','RMA NO# (from RO)','New Order # (Dream) if Warranty Repalcement / Reshipment (from RO)','Category','Organization'
  ];
  const csv = '\uFEFF' + headers.join(',') + '\n';
  res.setHeader('Content-Disposition', 'attachment; filename=rma_entries_template.csv');
  return send(res, 200, csv, 'text/csv; charset=utf-8');
}
