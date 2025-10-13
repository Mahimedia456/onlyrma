import { ok, send, parseCookies } from './_lib.js';
export const config = { runtime: 'nodejs' };
export default function handler(req,res){
  if (req.method !== 'GET') return send(res,405,{error:'Method Not Allowed'});
  const cookies=parseCookies(req);
  if (cookies.rma_sess==='1') return ok(res,{ ok:true, role:'admin', user:{ email:'internal@mahimedisolutions.com' }});
  return send(res,401,{ error:'No session' });
}
