import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env?.VITE_SUPABASE_URL || "https://mgpcfbvzomzlpeiipdii.supabase.co";
const supabaseAnonKey =
  import.meta.env?.VITE_SUPABASE_ANON_KEY || "sb_publishable_EB_tROJiLq88pipIovDk4g_iditmWi4";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
