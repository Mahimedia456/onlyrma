// /api/_db.js
import { createClient } from "@supabase/supabase-js";

const URL  = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;

if (!URL || !KEY) {
  console.error("[_db] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE/ANON env vars");
}
export const supa = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function genId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function fmtDateISO(v) {
  if (!v) return null;
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch { return null; }
}

export function toMonth(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 7);
  return d.toISOString().slice(0, 7);
}
