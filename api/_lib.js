// /api/_lib.js
export function ok(res, body){ res.statusCode=200; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(body)); }
export function send(res,status,body,type='application/json'){ res.statusCode=status; res.setHeader('Content-Type',type); res.end(type==='application/json'?JSON.stringify(body):body); }
export function readBody(req){ return new Promise(r=>{ let d=''; req.on('data',c=>d+=c); req.on('end',()=>{ try{ r(JSON.parse(d||'{}')); }catch{ r({}); } }); }); }
export function parseCookies(req){ const h=req.headers.cookie||''; return h.split(';').reduce((a,p)=>{ const [k,v]=p.split('=').map(s=>s&&s.trim()); if(!k) return a; a[k]=decodeURIComponent(v||''); return a; },{}); }
// Vercel (HTTPS) requires SameSite=None + Secure for SPA cookie flows
export function setCookie(res,name,value,{maxAgeDays=30,path='/',sameSite=process.env.VERCEL?'None':'Lax',httpOnly=true,secure=!!process.env.VERCEL}={}) {
  const maxAge = maxAgeDays*24*60*60;
  const parts=[`${name}=${encodeURIComponent(value)}`,`Path=${path}`,`Max-Age=${maxAge}`,`SameSite=${sameSite}`];
  if(secure) parts.push('Secure'); if(httpOnly) parts.push('HttpOnly');
  res.setHeader('Set-Cookie', parts.join('; '));
}
export function clearCookie(res,name){
  const secure=!!process.env.VERCEL; const sameSite=process.env.VERCEL?'None':'Lax';
  res.setHeader('Set-Cookie', `${name}=; Path=/; Max-Age=0; SameSite=${sameSite}; ${secure?'Secure; ':''}HttpOnly`);
}
