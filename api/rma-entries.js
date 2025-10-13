export const config = { runtime: 'nodejs' };
import { supa, genId, fmtDateISO, toMonth } from './_db.js';
import { ok, send, readBody, parseCookies } from './_lib.js'; // reuse your existing helpers or inline

function requireAny(req, res) {
  const cookies = parseCookies(req);
  if (cookies.rma_sess !== '1') { send(res, 401, { error: 'Not authenticated' }); return false; }
  return true;
}

export default async function handler(req, res) {
  const path = (req.url.split('?')[0] || '');
  if (path === '/api/rma/entries') {
    if (!requireAny(req, res)) return;

    if (req.method === 'GET') {
      const u = new URL(req.url, 'http://x');
      const month = (u.searchParams.get('month') || '').trim();
      const category = (u.searchParams.get('category') || '').trim();

      let q = supa.from('rma_entries').select('*').order('created_at', { ascending: false });
      if (month)    q = q.gte('entry_date', `${month}-01`).lt('entry_date', `${month}-31`);
      if (category) q = q.eq('category', category);

      const { data, error } = await q;
      if (error) return send(res, 500, { error: error.message });
      return ok(res, { entries: data || [] });
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
        updated_at: now
      };
      const { error } = await supa.from('rma_entries').insert(entry);
      if (error) return send(res, 500, { error: error.message });
      return ok(res, { ok: true, entry });
    }

    return send(res, 405, { error: 'Method Not Allowed' });
  }

  const m = path.match(/^\/api\/rma\/entries\/([^/]+)$/);
  if (m) {
    if (!requireAny(req, res)) return;
    const id = m[1];

    if (req.method === 'PUT') {
      const patch = await readBody(req);
      patch.updated_at = new Date().toISOString();
      const { data, error } = await supa.from('rma_entries').update(patch).eq('id', id).select('*').single();
      if (error) return send(res, 500, { error: error.message });
      return ok(res, { ok: true, entry: data });
    }

    if (req.method === 'DELETE') {
      // keep your admin check if needed
      const { error } = await supa.from('rma_entries').delete().eq('id', id);
      if (error) return send(res, 500, { error: error.message });
      return ok(res, { ok: true });
    }

    return send(res, 405, { error: 'Method Not Allowed' });
  }

  return send(res, 404, { error: 'Not Found' });
}
