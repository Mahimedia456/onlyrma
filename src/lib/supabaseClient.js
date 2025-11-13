// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

/**
 * Client for the BROWSER only (uses anon key).
 * Vite injects VITE_* envs at build time.
 */
const url  = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON;

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
});
