"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminLink() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is admin by calling server action
    fetch("/api/auth/check-admin")
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(data.isAdmin || false);
        setIsLoading(false);
      })
      .catch(() => {
        setIsAdmin(false);
        setIsLoading(false);
      });
  }, []);

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

