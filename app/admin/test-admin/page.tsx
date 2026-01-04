"use client";

import { useEffect, useState } from "react";

export default function TestAdminPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/check-admin", {
      credentials: "include",
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        setResult(data);
        setLoading(false);
      })
      .catch((error) => {
        setResult({ error: error.message });
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin Check Debug</h1>
      <div className="bg-gray-100 p-4 rounded-md">
        <pre className="text-sm overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
      <div className="mt-4">
        <p className="text-sm text-gray-600">
          {result?.isAdmin ? (
            <span className="text-green-600 font-semibold">
              ✓ You are an admin
            </span>
          ) : (
            <span className="text-red-600 font-semibold">
              ✗ You are NOT an admin
            </span>
          )}
        </p>
      </div>
      <div className="mt-4">
        <button
          onClick={() => {
            setLoading(true);
            fetch("/api/auth/check-admin", {
              credentials: "include",
              cache: "no-store",
            })
              .then((res) => res.json())
              .then((data) => {
                setResult(data);
                setLoading(false);
              })
              .catch((error) => {
                setResult({ error: error.message });
                setLoading(false);
              });
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Refresh Check
        </button>
      </div>
    </div>
  );
}

