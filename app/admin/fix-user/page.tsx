"use client";

import { useState } from "react";
import { createClientSupabaseClient } from "@/lib/supabase-client";

export default function FixUserPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [result, setResult] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClientSupabaseClient();

  const handleCreateUser = async () => {
    if (!email.trim()) {
      setResult("Error: Email is required");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/auth/create-user-manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim() || email.split("@")[0],
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(`✅ Success: ${data.message || "User created"}`);
        
        // If user was created, update role if needed
        if (data.user && role !== "user") {
          // Update role via direct SQL (you'll need to do this manually in Supabase)
          setResult(`✅ User created! Now update role in database: UPDATE public.users SET role = '${role}' WHERE email = '${email}';`);
        }
      } else {
        setResult(`❌ Error: ${data.error || "Failed to create user"}`);
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetCurrentUser = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setEmail(user.email);
        setName(user.user_metadata?.name || user.email.split("@")[0]);
        setResult(`✅ Found user: ${user.email}`);
      } else {
        setResult("❌ No user logged in");
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 sm:p-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Fix User - Manual Creation
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Use this page to manually create a user in the users table if signup failed.
          </p>

          <div className="space-y-4">
            <div>
              <button
                onClick={handleGetCurrentUser}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Get Current User Email
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                placeholder="User Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "user")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              onClick={handleCreateUser}
              disabled={isLoading || !email.trim()}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create User in Database"}
            </button>

            {result && (
              <div
                className={`p-4 rounded-md ${
                  result.includes("✅")
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{result}</p>
              </div>
            )}

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                Manual SQL Alternative:
              </p>
              <code className="text-xs bg-white p-2 rounded block overflow-x-auto">
                {`INSERT INTO public.users (tenant_id, email, name, role)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  '${email || 'your-email@example.com'}',
  '${name || 'User Name'}',
  '${role}'
)
ON CONFLICT (tenant_id, email) DO UPDATE
SET role = EXCLUDED.role;`}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

