import { NextResponse } from "next/server";
import { checkIsAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const isAdmin = await checkIsAdmin();
    return NextResponse.json({ isAdmin });
  } catch (error) {
    return NextResponse.json({ isAdmin: false });
  }
}

