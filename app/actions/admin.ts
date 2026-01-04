"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/auth";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get all users (admin only)
 */
export async function getUsers(): Promise<User[]> {
  // Require admin access
  await requireAdmin();

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[getUsers] Error:", error);
      return [];
    }

    return (data || []) as User[];
  } catch (error) {
    console.error("[getUsers] Unexpected error:", error);
    return [];
  }
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(
  userId: string,
  newRole: "admin" | "user"
): Promise<{ success?: boolean; error?: string }> {
  // Require admin access
  await requireAdmin();

  if (!userId || !newRole) {
    return { error: "User ID and role are required" };
  }

  if (newRole !== "admin" && newRole !== "user") {
    return { error: "Role must be 'admin' or 'user'" };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({ role: newRole })
      .eq("id", userId);

    if (updateError) {
      console.error("[updateUserRole] Error:", updateError);
      return { error: "Failed to update user role" };
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("[updateUserRole] Unexpected error:", error);
    return { error: "Internal server error" };
  }
}

/**
 * Update user (name and role) (admin only)
 */
export async function updateUser(
  userId: string,
  name: string,
  role: "admin" | "user"
): Promise<{ success?: boolean; error?: string }> {
  // Require admin access
  await requireAdmin();

  if (!userId || !name.trim()) {
    return { error: "User ID and name are required" };
  }

  if (role !== "admin" && role !== "user") {
    return { error: "Role must be 'admin' or 'user'" };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error: updateError } = await supabase
      .from("users")
      .update({ name: name.trim(), role })
      .eq("id", userId);

    if (updateError) {
      console.error("[updateUser] Error:", updateError);
      return { error: "Failed to update user" };
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("[updateUser] Unexpected error:", error);
    return { error: "Internal server error" };
  }
}

/**
 * Create new user (admin only)
 */
export async function createUser(
  email: string,
  name: string,
  role: "admin" | "user"
): Promise<{ success?: boolean; error?: string; user?: User }> {
  // Require admin access
  await requireAdmin();

  if (!email || !name.trim()) {
    return { error: "Email and name are required" };
  }

  if (role !== "admin" && role !== "user") {
    return { error: "Role must be 'admin' or 'user'" };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { error: "Invalid email format" };
  }

  try {
    const supabase = await createServerSupabaseClient();

    // Get current user's tenant_id
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return { error: "Unauthorized" };
    }

    // Get tenant_id from current user
    const { data: currentUserData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", currentUser.id)
      .single();

    const tenantId =
      currentUserData?.tenant_id ||
      "11111111-1111-1111-1111-111111111111";

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email.toLowerCase().trim())
      .eq("tenant_id", tenantId)
      .single();

    if (existingUser) {
      return { error: "User with this email already exists" };
    }

    // Create user in users table
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        tenant_id: tenantId,
        email: email.toLowerCase().trim(),
        name: name.trim(),
        role: role,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[createUser] Error:", insertError);
      return {
        error: `Failed to create user: ${insertError.message}`,
      };
    }

    revalidatePath("/admin/users");
    return { success: true, user: newUser as User };
  } catch (error) {
    console.error("[createUser] Unexpected error:", error);
    return { error: "Internal server error" };
  }
}

/**
 * Delete user (admin only)
 */
export async function deleteUser(
  userId: string
): Promise<{ success?: boolean; error?: string }> {
  // Require admin access
  await requireAdmin();

  if (!userId) {
    return { error: "User ID is required" };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error: deleteError } = await supabase
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteError) {
      console.error("[deleteUser] Error:", deleteError);
      return { error: "Failed to delete user" };
    }

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("[deleteUser] Unexpected error:", error);
    return { error: "Internal server error" };
  }
}

