// /api/test-supabase.js
export const config = { runtime: "nodejs" };
import { supa } from "./_db.js";

export default async function handler(_req, res) {
  try {
    // sanity check: try reading one row from each table (works even if empty)
    const [entries, us, emea] = await Promise.all([
      supa.from("rma_entries").select("id").limit(1),
      supa.from("rma_stock_us").select("id").limit(1),
      supa.from("rma_stock_emea").select("id").limit(1),
    ]);

    const err = entries.error || us.error || emea.error;
    if (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: err.message }));
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      ok: true,
      sample: {
        rma_entries: entries.data || [],
        rma_stock_us: us.data || [],
        rma_stock_emea: emea.data || [],
      },
    }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: e?.message || "Unknown error" }));
  }
}
