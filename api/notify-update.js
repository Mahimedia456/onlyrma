// /api/notify-update.js
export const config = { runtime: "nodejs" };

function ok(res, body) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); }
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method Not Allowed" });

  const { id, changed = {}, entry_date, who = "viewer" } = await readBody(req);

  // Build simple text
  const lines = [
    `An RMA entry was updated by a ${who}.`,
    `ID: ${id}`,
    entry_date ? `Entry Date: ${entry_date}` : "",
    "",
    "Changed fields:",
  ].filter(Boolean);

  for (const [k, v] of Object.entries(changed)) {
    lines.push(`- ${k}: "${v.before}" → "${v.after}"`);
  }
  const text = lines.join("\n");

  // Use Resend (https://resend.com) — add RESEND_API_KEY in Vercel
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return send(res, 500, { error: "Missing RESEND_API_KEY" });

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RMA Bot <aamir@mahimediasolutions.com>", // use your verified domain/sender in Resend
        to: ["aamir@mahimediasolutions.com"],
        subject: `RMA Updated: ${id}`,
        text,
      }),
    });
    const j = await r.json();
    if (!r.ok) return send(res, r.status, { error: j?.message || "Email send failed" });

    return ok(res, { ok: true });
  } catch (e) {
    return send(res, 500, { error: e?.message || "Email send error" });
  }
}
