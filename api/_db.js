// /api/_db.js
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (use SERVICE ROLE key, never expose to browser)
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE;

if (!url || !key) {
  console.warn("[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE env vars");
}

export const supa = createClient(url, key, {
  auth: { persistSession: false },
});

// --- tiny helpers you already use elsewhere ---
export function genId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
export function toMonth(v) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 7) : d.toISOString().slice(0, 7);
}
export function fmtDateISO(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
