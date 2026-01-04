"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Admin Page</h1>
        <p className="text-gray-700 mb-4">
          There was an error loading the admin page. This might be due to:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-600 mb-4 space-y-1">
          <li>You don't have admin access</li>
          <li>Database connection issue</li>
          <li>Session expired - try logging out and back in</li>
        </ul>
        <p className="text-sm text-gray-500 mb-4">
          Error: {error.message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Go to Home
          </a>
        </div>
      </div>
    </div>
  );
}

