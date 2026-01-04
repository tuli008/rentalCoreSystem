import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";
const DEFAULT_ROLE = "user";

/**
 * Manual fix endpoint - creates user in public.users if they exist in auth.users but not in public.users
 * This can be called if signup failed to create the user record
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get the current authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in first." },
        { status: 401 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "User email not found" },
        { status: 400 }
      );
    }

    // Check if user already exists in users table
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", user.email)
      .single();

    if (existingUser) {
      return NextResponse.json({ 
        success: true, 
        message: "User already exists in users table" 
      });
    }

    // Create user in users table
    const { error: insertError } = await supabase.from("users").insert({
      tenant_id: DEFAULT_TENANT_ID,
      email: user.email,
      name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
      role: DEFAULT_ROLE,
    });

    if (insertError) {
      console.error("[fix-user] Error inserting user:", insertError);
      return NextResponse.json(
        { error: `Failed to create user record: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: "User created successfully in users table" 
    });
  } catch (error) {
    console.error("[fix-user] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

