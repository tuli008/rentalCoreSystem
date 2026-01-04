/**
 * @deprecated Use createServerSupabaseClient() or createClientSupabaseClient() instead
 * This file is kept for backward compatibility with existing code
 */
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
