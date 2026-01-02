"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row h-auto sm:h-16 py-3 sm:py-0">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-8">
            <Link
              href="/"
              className={`inline-flex items-center px-1 pt-1 pb-2 sm:pb-1 text-sm font-medium border-b-2 transition-colors ${
                isActive("/")
                  ? "border-blue-500 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Inventory
            </Link>
            <Link
              href="/quotes"
              className={`inline-flex items-center px-1 pt-1 pb-2 sm:pb-1 text-sm font-medium border-b-2 transition-colors ${
                isActive("/quotes")
                  ? "border-blue-500 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Quotes
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}