// api/rma-entries.js
export const config = { runtime: 'nodejs' };

let entries = []; // in-memory per function instance

/* ---- helpers ---- */
function ok(res, body){ res.statusCode=200; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(body)); }
function send(res,status,body,type='application/json'){ res.statusCode=status; res.setHeader('Content-Type',type); res.end(type==='application/json'?JSON.stringify(body):body); }
function readBody(req){ return new Promise(r=>{ let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{ r(JSON.parse(d||'{}')); }catch{ r({}); } }); }); }
function parseCookies(req){ const h=req.headers.cookie||''; return h.split(';').reduce((a,p)=>{ const [k,v]=p.split('=').map(s=>s&&s.trim()); if(!k) return a; a[k]=decodeURIComponent(v||''); return a; },{}); }
function requireAny(req,res){ const c=parseCookies(req); if(c.rma_sess!=='1'){ send(res,401,{error:'Not authenticated'}); return false;} return true; }
function csvEscape(val){ if(val==null) return ''; const s=String(val); return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; }
function toCSV(rows,cols){ const header=cols.join(','); const lines=rows.map(r=>cols.map(c=>csvEscape(r[c])).join(',')); return '\uFEFF'+[header,...lines].join('\n'); }
function genId(prefix='id'){ return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
function toMonth(v){ const d=new Date(v); if(Number.isNaN(d.getTime())) return new Date().toISOString().slice(0,7); return d.toISOString().slice(0,7); }
function fmtDateISO(v){ if(!v) return null; try{ const d=new Date(v); if(Number.isNaN(d.getTime())) return null; return d.toISOString().slice(0,10);}catch{return null;} }

/* ---- handlers ---- */
async function listOrCreate(req,res){
  if(!requireAny(req,res)) return;
  if(req.method==='GET'){
    const u=new URL(req.url,'http://x');
    const month=(u.searchParams.get('month')||'').trim();
    const category=(u.searchParams.get('category')||'').trim();
    let out=entries;
    if(month) out=out.filter(e=>toMonth(e.entry_date||e.created_at)===month);
    if(category) out=out.filter(e=>(e.category||'')===category);
    return ok(res,{ entries: out });
  }
  if(req.method==='POST'){
    const body=await readBody(req);
    const now=new Date().toISOString();
    const entry={
      id: genId('rma'),
      entry_date: fmtDateISO(body.entry_date)||now.slice(0,10),
      ticket_id: body.ticket_id||'',
      first_name: body.first_name||'',
      last_name: body.last_name||'',
      email: body.email||'',
      phone: body.phone||'',
      company: body.company||'',
      reseller_customer: body.reseller_customer||'',
      address1: body.address1||'',
      address2: body.address2||'',
      city: body.city||'',
      state: body.state||'',
      country: body.country||'',
      postcode: body.postcode||'',
      product_with_fault: body.product_with_fault||'',
      serial_number: body.serial_number||'',
      product_sku: body.product_sku||'',
      device_name: body.device_name||'',
      rma_type: body.rma_type||'',
      stock_type: body.stock_type||'',
      quantity: Number(body.quantity)||0,
      returned_reason: body.returned_reason||'',
      action: body.action||'',
      custom_tracking: body.custom_tracking||'',
      rma_no: body.rma_no||'',
      replacement_tracking: body.replacement_tracking||'',
      category: body.category||'',
      organization: body.organization||'',
      created_at: now,
      updated_at: now,
    };
    entries.push(entry);
    return ok(res,{ ok:true, entry });
  }
  return send(res,405,{error:'Method Not Allowed'});
}

async function byId(req,res,id){
  if(!requireAny(req,res)) return;
  const idx=entries.findIndex(e=>e.id===id);
  if(idx===-1) return send(res,404,{error:'Not found'});
  if(req.method==='PUT'){
    const patch=await readBody(req);
    const merged={ ...entries[idx], ...patch, entry_date: fmtDateISO(patch.entry_date) ?? entries[idx].entry_date, updated_at: new Date().toISOString() };
    entries[idx]=merged;
    return ok(res,{ ok:true, entry: merged });
  }
  if(req.method==='DELETE'){
    entries.splice(idx,1);
    return ok(res,{ ok:true });
  }
  return send(res,405,{error:'Method Not Allowed'});
}

function template(_req,res){
  const headers=[
    'Date','Ticket','First Name','Last Name','Email','Phone','Company (if Applicable)','Reseller / Customer',
    'Address 1','Address 2','City','State (use 2 digit code)','Country','Post Code',
    'Product with fault','Serial Number of faulty product',"Product SKU for replacement (no more ninja's without my approval)",
    'Device Name','RMA Type','Stock Type','Quantity','Return Reason (Subject)','Action',
    'Customer Return Tracking Number (REQUIRED)','RMA NO# (from RO)','New Order # (Dream) if Warranty Repalcement / Reshipment (from RO)','Category','Organization'
  ];
  const csv='\uFEFF'+headers.join(',')+'\n';
  res.setHeader('Content-Disposition','attachment; filename=rma_entries_template.csv');
  return send(res,200,csv,'text/csv; charset=utf-8');
}

function exportCsv(req,res){
  if(!requireAny(req,res)) return;
  const u=new URL(req.url,'http://x');
  const month=(u.searchParams.get('month')||'').trim();
  const category=(u.searchParams.get('category')||'').trim();
  let list=entries;
  if(month) list=list.filter(e=>toMonth(e.entry_date||e.created_at)===month);
  if(category) list=list.filter(e=>(e.category||'')===category);
  const cols=[
    'id','entry_date','rma_no','ticket_id','first_name','last_name','email','phone','company','reseller_customer',
    'address1','address2','city','state','country','postcode','product_with_fault','serial_number',
    'product_sku','device_name','category','rma_type','stock_type','quantity','returned_reason','action',
    'custom_tracking','replacement_tracking','created_at','updated_at','organization'
  ];
  const csv=toCSV(list,cols);
  res.setHeader('Content-Disposition',`attachment; filename=RMA_Entries_${month||'all'}.csv`);
  return send(res,200,csv,'text/csv; charset=utf-8');
}

async function importJson(req,res){
  if(!requireAny(req,res)) return;
  if(req.method!=='POST') return send(res,405,{error:'Method Not Allowed'});
  const { items=[] } = await readBody(req);
  const now=new Date().toISOString();
  let imported=0;
  const report=[];
  for (const raw of items){
    try{
      const e={
        id: genId('rma'),
        entry_date: fmtDateISO(raw.entry_date)||now.slice(0,10),
        ticket_id: raw.ticket_id||'',
        first_name: raw.first_name||'',
        last_name: raw.last_name||'',
        email: raw.email||'',
        phone: raw.phone||'',
        company: raw.company||'',
        reseller_customer: raw.reseller_customer||'',
        address1: raw.address1||'',
        address2: raw.address2||'',
        city: raw.city||'',
        state: raw.state||'',
        country: raw.country||'',
        postcode: raw.postcode||'',
        product_with_fault: raw.product_with_fault||'',
        serial_number: raw.serial_number||'',
        product_sku: raw.product_sku||'',
        device_name: raw.device_name||'',
        rma_type: raw.rma_type||'',
        stock_type: raw.stock_type||'',
        quantity: Number(raw.quantity)||0,
        returned_reason: raw.returned_reason||'',
        action: raw.action||'',
        custom_tracking: raw.custom_tracking||'',
        rma_no: raw.rma_no||'',
        replacement_tracking: raw.replacement_tracking||'',
        category: raw.category||'',
        organization: raw.organization||'',
        created_at: now, updated_at: now,
      };
      entries.push(e); imported++; report.push({ ok:true, id:e.id });
    }catch(err){ report.push({ ok:false, error: err?.message||'Unknown import error' }); }
  }
  const failed = items.length - imported;
  if (failed>0) return send(res,207,{ imported, failed, report });
  return ok(res,{ imported, failed:0 });
}

export default async function handler(req,res){
  const path = (req.url.split('?')[0] || '');

  if (path === '/api/rma/entries')                      return listOrCreate(req,res);
  if (path === '/api/rma/entries/template.csv')         return template(req,res);
  if (path === '/api/rma/entries/export.csv')           return exportCsv(req,res);
  if (path === '/api/rma/entries/import')               return importJson(req,res);
  const entryId = path.match(/^\/api\/rma\/entries\/([^/]+)$/);
  if (entryId) return byId(req,res,entryId[1]);

  return send(res,404,{ error:'Not Found' });
}
