// inside /api/rma-entries.js
import { supa } from "./_db.js";
import { ok, send, readBody, parseCookies } from "./_lib.js";

// ... your existing code ...

function csvEscape(val) {
  if (val === undefined || val === null) return "";
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCSV(rows, columns) {
  const header = columns.join(",");
  const lines = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(","));
  return "\uFEFF" + [header, ...lines].join("\n");
}
function monthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const start = `${month}-01T00:00:00.000Z`;
  const [y, m] = month.split("-").map(Number);
  const next = (m === 12) ? `${y + 1}-01` : `${String(y)}-${String(m + 1).padStart(2, "0")}`;
  const end = `${next}-01T00:00:00.000Z`;
  return { start, end };
}

export default async function handler(req, res) {
  const path = (req.url.split("?")[0] || "");

  // ... your existing /api/rma/entries GET/POST and /:id PUT/DELETE and /import ...

  // -------- template.csv (download)
  if (path === "/api/rma/entries/template.csv") {
    // auth optional; add requireAny if you want
    const headers = [
      "Date","Ticket","First Name","Last Name","Email","Phone","Company (if Applicable)","Reseller / Customer",
      "Address 1","Address 2","City","State (use 2 digit code)","Country","Post Code",
      "Product with fault","Serial Number of faulty product","Product SKU for replacement (no more ninja's without my approval)",
      "Device Name","RMA Type","Stock Type","Quantity","Return Reason (Subject)","Action",
      "Customer Return Tracking Number (REQUIRED)","RMA NO# (from RO)","New Order # (Dream) if Warranty Repalcement / Reshipment (from RO)","Category","Organization"
    ];
    const csv = "\uFEFF" + headers.join(",") + "\n";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=rma_entries_template.csv");
    return res.end(csv);
  }

  // -------- export.csv (download)
  if (path === "/api/rma/entries/export.csv") {
    const u = new URL(req.url, "http://x");
    const month = (u.searchParams.get("month") || "").trim();
    const category = (u.searchParams.get("category") || "").trim();

    let q = supa.from("rma_entries").select("*").order("created_at", { ascending: false });
    if (month) {
      const r = monthRange(month);
      if (r) q = q.gte("entry_date", r.start).lt("entry_date", r.end);
    }
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) return send(res, 500, { error: error.message });

    const cols = [
      "id","entry_date","rma_no","ticket_id","first_name","last_name","email","phone","company","reseller_customer",
      "address1","address2","city","state","country","postcode","product_with_fault","serial_number",
      "product_sku","device_name","category","rma_type","stock_type","quantity","returned_reason","action",
      "custom_tracking","replacement_tracking","created_at","updated_at","organization"
    ];

    const csv = toCSV(data || [], cols);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=RMA_Entries_${month || "all"}.csv`);
    return res.end(csv);
  }

  return send(res, 404, { error: "Not Found" });
}
