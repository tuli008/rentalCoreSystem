import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const DEFAULT_TENANT_ID = "11111111-1111-1111-1111-111111111111";
const DEFAULT_ROLE = "user";

/**
 * Manual user creation endpoint
 * This can be called to create a user in public.users table
 * Useful for fixing missing users
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

    const body = await request.json();
    const { name } = body;

    // Check if user already exists in users table
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("email", user.email)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 means no rows found, which is fine
      console.error("[create-user-manual] Error checking existing user:", checkError);
      return NextResponse.json(
        { error: `Error checking user: ${checkError.message}` },
        { status: 500 }
      );
    }

    if (existingUser) {
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
        email: user.email,
        name: name || user.user_metadata?.name || user.email?.split("@")[0] || "User",
        role: DEFAULT_ROLE,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[create-user-manual] Error inserting user:", insertError);
      return NextResponse.json(
        { error: `Failed to create user record: ${insertError.message}. Code: ${insertError.code}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: "User created successfully",
      user: newUser
    });
  } catch (error) {
    console.error("[create-user-manual] Unexpected error:", error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

