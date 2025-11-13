import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;

if (!url) throw new Error("SUPABASE_URL is missing");
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE is missing");

export const supa = createClient(url, serviceKey, {
  auth: { persistSession: false },
  global: {
    headers: { "x-application-name": "Zendesk RMA / Rush Orders" },
  },
});
