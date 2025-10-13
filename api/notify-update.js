// /api/notify-update.js
export const config = { runtime: "nodejs" };

import nodemailer from "nodemailer";

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
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return ok(res, { ok: true, message: "SMTP notify endpoint is alive." });
  }

  if (req.method !== "POST")
    return send(res, 405, { error: "Method Not Allowed" });

  const { id, changed = {}, entry_date, who = "viewer" } = await readBody(req);

  if (!id || Object.keys(changed).length === 0)
    return send(res, 400, { error: "Missing or invalid payload" });

  // Construct plain-text email
  const lines = [
    `An RMA entry was updated by a ${who}.`,
    `ID: ${id}`,
    entry_date ? `Entry Date: ${entry_date}` : "",
    "",
    "Changed fields:",
  ].filter(Boolean);

  for (const [key, v] of Object.entries(changed)) {
    lines.push(`- ${key}: "${v.before}" → "${v.after}"`);
  }

  const emailText = lines.join("\n");

  try {
    // SMTP transporter for Hostinger
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: true, // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: `"RMA Notifier" <${process.env.SMTP_USER}>`,
      to: "aamir@mahimediasolutions.com",
      subject: `RMA Updated: ${id}`,
      text: emailText,
    });

    return ok(res, { ok: true, messageId: info.messageId });
  } catch (error) {
    console.error("SMTP send failed:", error);
    return send(res, 500, { error: error.message || "SMTP send failed" });
  }
}
