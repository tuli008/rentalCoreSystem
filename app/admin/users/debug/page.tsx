import { getCurrentUser, getCurrentUserRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function AdminDebugPage() {
  const user = await getCurrentUser();
  const role = await getCurrentUserRole();
  
  let dbUser = null;
  if (user?.email) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("users")
      .select("*")
      .ilike("email", user.email.toLowerCase().trim())
      .maybeSingle();
    dbUser = data;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4">Admin Access Debug</h1>
        
        <div className="space-y-4">
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-2">Auth User</h2>
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
              {JSON.stringify(
                {
                  id: user?.id || "Not logged in",
                  email: user?.email || "No email",
                  metadata: user?.user_metadata || {},
                },
                null,
                2
              )}
            </pre>
          </div>

          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-2">Computed Role</h2>
            <div className="bg-gray-100 p-3 rounded">
              <p className="text-lg">
                Role: <span className="font-bold">{role}</span>
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Is Admin: {role === "admin" ? "✅ Yes" : "❌ No"}
              </p>
            </div>
          </div>

          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-2">Database User Record</h2>
            {dbUser ? (
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(dbUser, null, 2)}
              </pre>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                <p className="text-yellow-800">
                  ⚠️ No user record found in database for email: {user?.email}
                </p>
                <p className="text-sm text-yellow-700 mt-2">
                  Go to /admin/fix-user to create your user record.
                </p>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">Quick Fix</h2>
            <div className="bg-blue-50 border border-blue-200 p-4 rounded">
              <p className="text-sm text-blue-800 mb-2">
                If you're not admin, run this SQL in Supabase:
              </p>
              <code className="block bg-white p-3 rounded text-xs overflow-auto">
                {`UPDATE public.users 
SET role = 'admin' 
WHERE email ILIKE '${user?.email || "your-email@example.com"}';`}
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

