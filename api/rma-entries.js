// /api/rma-entries.js
export const config = { runtime: "nodejs" };

import { supa, genId, fmtDateISO } from "./_db.js";
import { ok, send, readBody, parseCookies } from "./_lib.js";

function requireAny(req, res) {
  const c = parseCookies(req);
  if (!c.rma_sess) { send(res, 401, { error: "Not authenticated" }); return false; }
  return true;
}

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
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const nextMonth = m === 12 ? `${y + 1}-01` : `${String(y)}-${String(m + 1).padStart(2, "0")}`;
  const end = `${nextMonth}-01`;
  return { start, end };
}

export default async function handler(req, res) {
  const path = (req.url.split("?")[0] || "");

  // List / Create
  if (path === "/api/rma/entries") {
    if (!requireAny(req, res)) return;

    if (req.method === "GET") {
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
      return ok(res, { entries: data || [] });
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const now = new Date().toISOString();
      const entry = {
        id: genId("rma"),
        entry_date: fmtDateISO(body.entry_date) || now.slice(0, 10),
        ticket_id: body.ticket_id || "",
        first_name: body.first_name || "",
        last_name: body.last_name || "",
        email: body.email || "",
        phone: body.phone || "",
        company: body.company || "",
        reseller_customer: body.reseller_customer || "",
        address1: body.address1 || "",
        address2: body.address2 || "",
        city: body.city || "",
        state: body.state || "",
        country: body.country || "",
        postcode: body.postcode || "",
        product_with_fault: body.product_with_fault || "",
        serial_number: body.serial_number || "",
        product_sku: body.product_sku || "",
        device_name: body.device_name || "",
        rma_type: body.rma_type || "",
        stock_type: body.stock_type || "",
        quantity: Number(body.quantity) || 0,
        returned_reason: body.returned_reason || "",
        action: body.action || "",
        custom_tracking: body.custom_tracking || "",
        rma_no: body.rma_no || "",
        replacement_tracking: body.replacement_tracking || "",
        category: body.category || "",
        organization: body.organization || "",
        created_at: now,
        updated_at: now,
      };
      const { error } = await supa.from("rma_entries").insert(entry);
      if (error) return send(res, 500, { error: error.message });
      return ok(res, { ok: true, entry });
    }
    return send(res, 405, { error: "Method Not Allowed" });
  }

  // Import
  if (path === "/api/rma/entries/import") {
    if (!requireAny(req, res)) return;
    if (req.method !== "POST") return send(res, 405, { error: "Method Not Allowed" });

    const { items = [] } = await readBody(req);
    const now = new Date().toISOString();
    let imported = 0, failed = 0, report = [];
    for (const raw of items) {
      try {
        const e = {
          id: genId("rma"),
          entry_date: fmtDateISO(raw.entry_date) || now.slice(0, 10),
          ...raw,
          quantity: Number(raw.quantity) || 0,
          created_at: now,
          updated_at: now,
        };
        const { error } = await supa.from("rma_entries").insert(e);
        if (error) throw new Error(error.message);
        imported++;
      } catch (err) {
        failed++;
        report.push({ error: err?.message || "Import error" });
      }
    }
    const status = failed > 0 ? 207 : 200;
    return send(res, status, { ok: failed === 0, imported, failed, report });
  }

  // PUT/DELETE by id
  const idm = path.match(/^\/api\/rma\/entries\/([^/]+)$/);
  if (idm) {
    if (!requireAny(req, res)) return;
    const id = idm[1];

    if (req.method === "PUT") {
      const patch = await readBody(req);
      patch.updated_at = new Date().toISOString();
      const { data, error } = await supa
        .from("rma_entries")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) return send(res, 500, { error: error.message });
      return ok(res, { ok: true, entry: data });
    }
    if (req.method === "DELETE") {
      const { error } = await supa.from("rma_entries").delete().eq("id", id);
      if (error) return send(res, 500, { error: error.message });
      return ok(res, { ok: true });
    }
    return send(res, 405, { error: "Method Not Allowed" });
  }

  // Template CSV
  if (path === "/api/rma/entries/template.csv") {
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

  // Export CSV
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
