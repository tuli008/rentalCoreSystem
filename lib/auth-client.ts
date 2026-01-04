/**
 * Client-side authorization utilities
 * 
 * This provides a way for client components to check if user is admin
 * For now, we'll use a simple approach with environment variable
 * In production, this should come from session/auth context
 */

/**
 * Check if current user is admin (client-side)
 * This reads from a cookie or localStorage
 * For now, defaults to checking an environment variable
 */
export function isAdminClient(): boolean {
  // TODO: Replace with actual session/auth check
  // For now, check localStorage or default to false
  if (typeof window !== "undefined") {
    const userRole = localStorage.getItem("userRole") || "user";
    return userRole === "admin";
  }
  return false;
}

/**
 * Get user role (client-side)
 */
export function getUserRoleClient(): "admin" | "user" {
  if (typeof window !== "undefined") {
    const userRole = localStorage.getItem("userRole") || "user";
    return userRole === "admin" ? "admin" : "user";
  }
  return "user";
}

/**
 * Set user role (for testing/development)
 */
export function setUserRoleClient(role: "admin" | "user"): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("userRole", role);
  }
}

