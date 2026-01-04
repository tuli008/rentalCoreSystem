import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";
const DEFAULT_ROLE = "user"; // New users are regular users by default

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get the current authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[create-user] Auth error:", authError);
      return NextResponse.json(
        { error: `Unauthorized: ${authError.message}` },
        { status: 401 }
      );
    }

    if (!user) {
      console.error("[create-user] No user found");
      return NextResponse.json(
        { error: "Unauthorized: No user found" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, name } = body;

    // Verify the email matches the authenticated user
    if (user.email !== email) {
      return NextResponse.json(
        { error: "Email mismatch" },
        { status: 400 }
      );
    }

    // Check if user already exists in users table
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("email", email)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 means no rows found, which is fine
      console.error("[create-user] Error checking existing user:", checkError);
      return NextResponse.json(
        { error: `Error checking user: ${checkError.message}` },
        { status: 500 }
      );
    }

    if (existingUser) {
      // User already exists, return success
      return NextResponse.json({ 
        success: true,
        message: "User already exists",
        user: existingUser
      });
    }

    // Create user in users table
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        tenant_id: DEFAULT_TENANT_ID,
        email: email,
        name: name || user.email?.split("@")[0] || "User",
        role: DEFAULT_ROLE,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[create-user] Error inserting user:", insertError);
      return NextResponse.json(
        { error: `Failed to create user record: ${insertError.message}. Code: ${insertError.code}. Hint: ${insertError.hint || 'none'}` },
        { status: 500 }
      );
    }

    console.log("[create-user] User created successfully:", newUser);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[create-user] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

