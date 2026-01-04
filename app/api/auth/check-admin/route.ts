import { NextResponse } from "next/server";
import { checkIsAdmin, getCurrentUser, getCurrentUserRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      console.log("[check-admin] No user found - not authenticated");
      return NextResponse.json({ isAdmin: false, error: "Not authenticated" });
    }

    if (!user.email) {
      console.log("[check-admin] User has no email");
      return NextResponse.json({ isAdmin: false, error: "No email" });
    }

    // Get role directly to debug
    const role = await getCurrentUserRole();
    const isAdmin = role === "admin";

    // Also check database directly for debugging
    const supabase = await createServerSupabaseClient();
    const { data: userData, error: dbError } = await supabase
      .from("users")
      .select("role, email")
      .ilike("email", user.email.toLowerCase().trim())
      .maybeSingle();

    // Log for debugging (both dev and production)
    console.log("[check-admin] Admin check:", {
      authEmail: user.email,
      authEmailLower: user.email?.toLowerCase().trim(),
      authUserId: user.id,
      dbUserEmail: userData?.email || "not found",
      dbRole: userData?.role || "not found",
      computedRole: role,
      isAdmin,
      dbError: dbError?.message || null,
      dbErrorCode: dbError?.code || null,
    });
    
    return NextResponse.json({ 
      isAdmin,
      debug: {
        authEmail: user.email,
        authEmailLower: user.email?.toLowerCase().trim(),
        dbUserEmail: userData?.email,
        dbRole: userData?.role,
        computedRole: role,
        dbError: dbError?.message,
      },
    });
  } catch (error) {
    console.error("[check-admin] Error checking admin status:", error);
    return NextResponse.json({ 
      isAdmin: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
}

