"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClientSupabaseClient } from "@/lib/supabase-client";
import { useEffect, useState } from "react";
import AdminLink from "./AdminLink";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const supabase = createClientSupabaseClient();

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || null);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email || null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  // Hide navigation on login/signup pages (check after hooks)
  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/signup");
  
  if (isAuthPage) {
    return null;
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-blue-600 border-b border-blue-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-12 flex items-center justify-between">
          <div className="flex items-center gap-6 overflow-x-auto w-full">
            <Link
              href="/"
              className={`inline-flex items-center px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive("/")
                  ? "border-white text-white"
                  : "border-transparent text-blue-100 hover:text-white hover:border-blue-300"
              }`}
            >
              Inventory
            </Link>
            <Link
              href="/quotes"
              className={`inline-flex items-center px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive("/quotes")
                  ? "border-white text-white"
                  : "border-transparent text-blue-100 hover:text-white hover:border-blue-300"
              }`}
            >
              Quotes
            </Link>
            <Link
              href="/crew"
              className={`inline-flex items-center px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive("/crew")
                  ? "border-white text-white"
                  : "border-transparent text-blue-100 hover:text-white hover:border-blue-300"
              }`}
            >
              Crew
            </Link>
            <Link
              href="/events"
              className={`inline-flex items-center px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive("/events") || pathname?.startsWith("/events/")
                  ? "border-white text-white"
                  : "border-transparent text-blue-100 hover:text-white hover:border-blue-300"
              }`}
            >
              Events
            </Link>
            <AdminLink />
          </div>
          <div className="flex items-center gap-4 ml-4">
            {userEmail && (
              <span className="text-sm text-blue-100 hidden sm:inline">
                {userEmail}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm font-medium text-blue-100 hover:text-white border border-blue-400 rounded-md hover:border-blue-300 transition-colors whitespace-nowrap"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
