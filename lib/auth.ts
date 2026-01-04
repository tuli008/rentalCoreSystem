/**
 * Authorization utilities using Supabase Auth
 * 
 * This replaces the environment variable approach with proper JWT-based authentication
 */

import { createServerSupabaseClient } from "./supabase-server";

const tenantId = "11111111-1111-1111-1111-111111111111";

/**
 * Get current user from Supabase session
 */
export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Get current user's role from the users table
 * Falls back to checking user metadata if not in users table
 */
export async function getCurrentUserRole(): Promise<"admin" | "user"> {
  const user = await getCurrentUser();
  
  if (!user || !user.email) {
    return "user"; // Default to user if not logged in
  }

  const supabase = await createServerSupabaseClient();
  
  // Check users table for role (case-insensitive email match)
  const userEmail = user.email?.toLowerCase().trim();
  if (!userEmail) {
    console.warn("[getCurrentUserRole] User has no email");
    return "user";
  }

  const { data: userData, error } = await supabase
    .from("users")
    .select("role, email")
    .ilike("email", userEmail)
    .maybeSingle();

  if (error) {
    // Log error for debugging (but don't expose to client)
    console.error("[getCurrentUserRole] Error fetching user role:", {
      email: user.email,
      userEmail,
      error: error.message,
      code: error.code,
    });
    // Fallback: check user metadata or default to user
    return (user.user_metadata?.role as "admin" | "user") || "user";
  }

  if (!userData) {
    // User not found in users table - log for debugging
    console.warn("[getCurrentUserRole] User not found in users table:", {
      email: user.email,
      userEmail,
      userId: user.id,
    });
    // Fallback: check user metadata or default to user
    return (user.user_metadata?.role as "admin" | "user") || "user";
  }

  console.log("[getCurrentUserRole] Found user in database:", {
    email: user.email,
    userEmail,
    dbEmail: userData.email,
    role: userData.role,
    roleMatch: userData.role === "admin" ? "admin" : "user",
  });

  const finalRole = userData.role === "admin" ? "admin" : "user";
  return finalRole;
}

/**
 * Get current user's tenant ID
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  
  // Check users table for tenant_id
  const { data: userData, error } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("email", user.email)
    .single();

  if (error || !userData) {
    // Fallback: check user metadata or use default
    return user.user_metadata?.tenant_id || tenantId;
  }

  return userData.tenant_id;
}

/**
 * Server action to get user role for client components
 */
export async function getUserRole(): Promise<"admin" | "user"> {
  "use server";
  return await getCurrentUserRole();
}

/**
 * Server action to check if user is admin
 */
export async function checkIsAdmin(): Promise<boolean> {
  "use server";
  return await isAdmin();
}

/**
 * Check if current user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === "admin";
}

/**
 * Require admin access - throws error if not admin
 */
export async function requireAdmin(): Promise<void> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error("Unauthorized: Please log in");
  }

  const admin = await isAdmin();
  if (!admin) {
    throw new Error("Unauthorized: Admin access required");
  }
}

/**
 * Require authentication - throws error if not logged in
 */
export async function requireAuth(): Promise<void> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error("Unauthorized: Please log in");
  }
}

/**
 * Get authorization result for UI
 * Returns whether user can perform write operations
 */
export async function canWriteInventory(): Promise<boolean> {
  return await isAdmin();
}

export async function canWriteCrew(): Promise<boolean> {
  return await isAdmin();
}

export async function canWriteEvents(): Promise<boolean> {
  // Everyone can write events/quotes
  return true;
}
