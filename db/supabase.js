import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "[Supabase Warning] Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseKey || "", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Validates connection to Supabase database by performing a test ping
 */
export async function connectSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    console.error("[Supabase Error] SUPABASE_URL or SUPABASE_ANON_KEY is missing.");
    return null;
  }

  try {
    const { data, error } = await supabase.from("departments").select("id").limit(1);
    if (error) {
      // If table does not exist yet, still reachable
      if (error.code === "PGRST116" || error.message?.includes("relation") || error.message?.includes("does not exist")) {
        console.warn(
          `[Supabase] Connected to ${supabaseUrl}, but tables are not yet created.\n` +
          `           Please run the queries in 'supabase_schema.sql' in your Supabase SQL Editor!`
        );
        return supabase;
      }
      console.warn(`[Supabase Notice] Connected to ${supabaseUrl} (Response: ${error.message})`);
      return supabase;
    }

    console.log(`[Supabase] ✅ Connected successfully to Supabase: ${supabaseUrl}`);
    return supabase;
  } catch (err) {
    console.error("[Supabase Error] Connection probe failed:", err.message || err);
    return null;
  }
}
