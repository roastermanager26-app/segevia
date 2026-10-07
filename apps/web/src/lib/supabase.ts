import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/** Cliente con anon key: todo acceso queda sujeto a RLS. */
export const supabase: SupabaseClient | null = env
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function db(): SupabaseClient {
  if (!supabase) throw new Error("Supabase no está configurado");
  return supabase;
}
