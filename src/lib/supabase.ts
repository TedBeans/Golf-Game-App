import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when the Supabase keys are set. Without them the app runs local-only on this device. */
export const cloudEnabled = Boolean(url && key);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!cloudEnabled) return null;
  if (!client) client = createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return client;
}
