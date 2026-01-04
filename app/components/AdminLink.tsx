"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClientSupabaseClient } from "@/lib/supabase-client";

export default function AdminLink() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClientSupabaseClient();

  const checkAdminStatus = async () => {
    try {
      const response = await fetch("/api/auth/check-admin", {
        credentials: "include", // Important: include cookies for session
        cache: "no-store", // Don't cache this check
      });

      if (!response.ok) {
        console.error("[AdminLink] API error:", response.status, response.statusText);
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      
      // Always log in development, and log errors in production
      console.log("[AdminLink] Admin check result:", {
        isAdmin: data.isAdmin,
        debug: data.debug,
        error: data.error,
      });
      
      if (!data.isAdmin && data.debug) {
        console.warn("[AdminLink] Not admin - debug info:", data.debug);
      }
      
      setIsAdmin(data.isAdmin || false);
      setIsLoading(false);
    } catch (error) {
      console.error("[AdminLink] Error checking admin status:", error);
      setIsAdmin(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check admin status on mount
    checkAdminStatus();

    // Listen for auth state changes (login/logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // User logged in - check admin status immediately
        checkAdminStatus();
      } else {
        // User logged out - clear admin status
        setIsAdmin(false);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Only show Admin link if user is admin
  if (isLoading || !isAdmin) {
    return null;
  }

  const isActive = pathname?.startsWith("/admin");

  return (
    <Link
      href="/admin/users"
      className={`inline-flex items-center px-1 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        isActive
          ? "border-white text-white"
          : "border-transparent text-blue-100 hover:text-white hover:border-blue-300"
      }`}
    >
      Admin
    </Link>
  );
}

