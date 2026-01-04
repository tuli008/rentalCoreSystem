import { createBrowserClient } from "@supabase/ssr";

/**
 * Client-side Supabase client with authentication
 * Use this in Client Components
 */
export function createClientSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

