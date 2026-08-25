import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

export function isSupabaseConfigured() {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

export function createSupabaseServerClient({ serviceRole = false } = {}) {
  const key = serviceRole ? config.supabaseServiceRoleKey : config.supabaseAnonKey;
  if (!config.supabaseUrl || !key) {
    throw new Error("Supabase is not configured.");
  }
  return createClient(config.supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
