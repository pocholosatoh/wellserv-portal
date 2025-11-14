// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server only
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { "x-client-info": "wellserv-portal/other-labs" } },
  });
}
