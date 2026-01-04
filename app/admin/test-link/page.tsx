"use client";

import { useState } from "react";

export default function TestAdminLinkPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testAdminCheck = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/auth/check-admin", {
        credentials: "include",
        cache: "no-store",
      });

      const data = await response.json();
      setResult({
        status: response.status,
        ok: response.ok,
        data,
      });
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4">Admin Link Test</h1>

        <div className="mb-4">
          <button
            onClick={testAdminCheck}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Testing..." : "Test Admin Check API"}
          </button>
        </div>

        {result && (
          <div className="mt-4">
            <h2 className="text-lg font-semibold mb-2">Result:</h2>
            <div className="bg-gray-100 p-4 rounded">
              <pre className="text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>

            {result.data?.isAdmin ? (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                <p className="text-green-800 font-semibold">
                  ✅ You ARE detected as admin!
                </p>
                <p className="text-sm text-green-700 mt-2">
                  The Admin link should appear in the navigation. If it doesn't, there might be a client-side issue.
                </p>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                <p className="text-red-800 font-semibold">
                  ❌ You are NOT detected as admin
                </p>
                {result.data?.debug && (
                  <div className="mt-2 text-sm text-red-700">
                    <p>Debug Info:</p>
                    <ul className="list-disc list-inside mt-1">
                      <li>Auth Email: {result.data.debug.authEmail}</li>
                      <li>DB Email: {result.data.debug.dbUserEmail || "not found"}</li>
                      <li>DB Role: {result.data.debug.dbRole || "not found"}</li>
                      <li>Computed Role: {result.data.debug.computedRole}</li>
                    </ul>
                    {!result.data.debug.dbUserEmail && (
                      <p className="mt-2 font-medium">
                        ⚠️ Your user record was not found in the database!
                        <br />
                        Go to /admin/fix-user to create it.
                      </p>
                    )}
                    {result.data.debug.dbRole !== "admin" && result.data.debug.dbUserEmail && (
                      <p className="mt-2 font-medium">
                        ⚠️ Your role in database is "{result.data.debug.dbRole}", not "admin"!
                        <br />
                        Run: UPDATE public.users SET role = 'admin' WHERE email = '{result.data.debug.authEmail}';
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-semibold mb-2">Quick Fixes:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Check browser console (F12) for [AdminLink] logs</li>
            <li>Visit /admin/check-email to verify email matching</li>
            <li>Visit /admin/users/debug to see full user info</li>
            <li>If user not found: Go to /admin/fix-user</li>
            <li>If role is wrong: Update in database with SQL</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

