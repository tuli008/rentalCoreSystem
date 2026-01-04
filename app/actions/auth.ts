"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";
const DEFAULT_ROLE = "user";

/**
 * Create user in users table after Supabase Auth signup
 * This is called automatically after user signs up
 */
export async function createUserInDatabase(email: string, name: string): Promise<{
  success?: boolean;
  error?: string;
}> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get the current authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Unauthorized" };
    }

    // Verify the email matches the authenticated user
    if (user.email !== email) {
      return { error: "Email mismatch" };
    }

    // Check if user already exists in users table
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existingUser) {
      // User already exists, return success
      return { success: true };
    }

    // Create user in users table
    const { error: insertError } = await supabase.from("users").insert({
      tenant_id: DEFAULT_TENANT_ID,
      email: email,
      name: name || user.email?.split("@")[0] || "User",
      role: DEFAULT_ROLE,
    });

    if (insertError) {
      console.error("[createUserInDatabase] Error inserting user:", insertError);
      return { error: "Failed to create user record" };
    }

    return { success: true };
  } catch (error) {
    console.error("[createUserInDatabase] Unexpected error:", error);
    return { error: "Internal server error" };
  }
}

