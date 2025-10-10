// api/rma-stock.js
export const config = { runtime: 'nodejs' };

let emeaStock = [];
let usStock   = [];

/* helpers */
function ok(res, body){ res.statusCode=200; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(body)); }
function send(res,status,body,type='application/json'){ res.statusCode=status; res.setHeader('Content-Type',type); res.end(type==='application/json'?JSON.stringify(body):body); }
function readBody(req){ return new Promise(r=>{ let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{ r(JSON.parse(d||'{}')); }catch{ r({}); } }); }); }
function parseCookies(req){ const h=req.headers.cookie||''; return h.split(';').reduce((a,p)=>{ const [k,v]=p.split('=').map(s=>s&&s.trim()); if(!k) return a; a[k]=decodeURIComponent(v||''); return a; },{}); }
function requireAny(req,res){ const c=parseCookies(req); if(c.rma_sess!=='1'){ send(res,401,{error:'Not authenticated'}); return false;} return true; }
function numberizeAll(obj){ const out={...obj}; for (const k of Object.keys(out)){ const v=out[k]; if(typeof v==='string' && v.trim()!=='' && !isNaN(Number(v))) out[k]=Number(v); } return out; }
function toMonth(v){ const d=new Date(v); if(Number.isNaN(d.getTime())) return new Date().toISOString().slice(0,7); return d.toISOString().slice(0,7); }

/* common filters */
function filterStock(list, url){
  const u=new URL(url,'http://x');
  const month=(u.searchParams.get('month')||'').trim();
  const device=(u.searchParams.get('device_name')||'').trim();
  let out=list;
  if(month) out=out.filter(r=>(r.month||'')===month);
  if(device) out=out.filter(r=>(r.device_name||'')===device);
  return out;
}

/* EMEA */
async function emeaListOrCreate(req,res){
  if(!requireAny(req,res)) return;
  if(req.method==='GET'){
    return ok(res,{ items: filterStock(emeaStock, req.url) });
  }
  if(req.method==='POST'){
    const body=numberizeAll(await readBody(req));
    const row={
      id:`emea_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
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
    emeaStock.push(row);
    return ok(res,{ ok:true, row });
  }
  return send(res,405,{error:'Method Not Allowed'});
}
async function emeaById(req,res,id){
  if(!requireAny(req,res)) return;
  const idx=emeaStock.findIndex(r=>r.id===id);
  if(idx===-1) return send(res,404,{error:'Not found'});
  if(req.method==='PUT'){
    const patch=numberizeAll(await readBody(req));
    emeaStock[idx] = { ...emeaStock[idx], ...patch, updated_at: new Date().toISOString() };
    return ok(res,{ ok:true });
  }
  if(req.method==='DELETE'){
    emeaStock.splice(idx,1);
    return ok(res,{ ok:true });
  }
  return send(res,405,{error:'Method Not Allowed'});
}
function emeaDevices(_req,res){
  const DEVICE_NAMES=[
    "Ninja","Ninja V","Ninja V Plus","Ninja Ultra","Ninja Phone",
    "Shinobi II","Shinobi 7","Shinobi GO","Shogun Ultra","Shogun Connect",
    "Sumo 19SE","A-Eye PTZ camera","Sun Hood","Master Caddy III","Atomos Connect",
    "AtomX Battery","Ultrasync Blue","AtomFlex HDMI Cable","Atomos Creator Kit 5''",
  ];
  const found=[...new Set(emeaStock.map(s=>s.device_name).filter(Boolean))];
  const devices=Array.from(new Set([...DEVICE_NAMES, ...found])).sort();
  return ok(res,{ devices });
}

/* US */
async function usListOrCreate(req,res){
  if(!requireAny(req,res)) return;
  if(req.method==='GET'){
    return ok(res,{ items: filterStock(usStock, req.url) });
  }
  if(req.method==='POST'){
    const body=numberizeAll(await readBody(req));
    const row={
      id:`us_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      month: body.month || new Date().toISOString().slice(0,7),
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
    usStock.push(row);
    return ok(res,{ ok:true, row });
  }
  return send(res,405,{error:'Method Not Allowed'});
}
async function usById(req,res,id){
  if(!requireAny(req,res)) return;
  const idx=usStock.findIndex(r=>r.id===id);
  if(idx===-1) return send(res,404,{error:'Not found'});
  if(req.method==='PUT'){
    const patch=numberizeAll(await readBody(req));
    usStock[idx] = { ...usStock[idx], ...patch, updated_at: new Date().toISOString() };
    return ok(res,{ ok:true });
  }
  if(req.method==='DELETE'){
    usStock.splice(idx,1);
    return ok(res,{ ok:true });
  }
  return send(res,405,{error:'Method Not Allowed'});
}
function usDevices(_req,res){
  const DEVICE_NAMES=[
    "Ninja","Ninja V","Ninja V Plus","Ninja Ultra","Ninja Phone",
    "Shinobi II","Shinobi 7","Shinobi GO","Shogun Ultra","Shogun Connect",
    "Sumo 19SE","A-Eye PTZ camera","Sun Hood","Master Caddy III","Atomos Connect",
    "AtomX Battery","Ultrasync Blue","AtomFlex HDMI Cable","Atomos Creator Kit 5''",
  ];
  const found=[...new Set(usStock.map(s=>s.device_name).filter(Boolean))];
  const devices=Array.from(new Set([...DEVICE_NAMES, ...found])).sort();
  return ok(res,{ devices });
}

export default async function handler(req,res){
  const path = (req.url.split('?')[0] || '');

  // EMEA
  if (path === '/api/rma/emea/stock')                   return emeaListOrCreate(req,res);
  if (path === '/api/rma/emea/devices')                 return emeaDevices(req,res);
  const emeaId = path.match(/^\/api\/rma\/emea\/stock\/([^/]+)$/);
  if (emeaId) return emeaById(req,res,emeaId[1]);

  // US
  if (path === '/api/rma/us/stock')                     return usListOrCreate(req,res);
  if (path === '/api/rma/us/devices')                   return usDevices(req,res);
  const usId = path.match(/^\/api\/rma\/us\/stock\/([^/]+)$/);
  if (usId) return usById(req,res,usId[1]);

  return send(res,404,{ error:'Not Found' });
}
