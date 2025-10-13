import { ok, send, readBody, setCookie } from './_lib.js';
export const config = { runtime: 'nodejs' };
export default async function handler(req,res){
  if (req.method !== 'POST') return send(res,405,{error:'Method Not Allowed'});
  const { email, password } = await readBody(req);
  if (email?.toLowerCase().trim()==='rush@mahimedisolutions.com' && password==='aamirtest'){
    setCookie(res,'rma_sess','1');
    return ok(res,{ ok:true, role:'viewer', user:{ email } });
  }
  return send(res,401,{ ok:false, error:'Invalid viewer credentials' });
}
