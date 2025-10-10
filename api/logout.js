export const config = { runtime: 'nodejs' };
export default function handler(_req, res) {
  res.setHeader('Set-Cookie', 'rma_sess=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true }));
}
