import { ok, clearCookie } from './_lib.js';
export const config = { runtime: 'nodejs' };
export default function handler(_req,res){ clearCookie(res,'rma_sess'); return ok(res,{ ok:true }); }
