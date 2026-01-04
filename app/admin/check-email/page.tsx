import { getCurrentUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function CheckEmailPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    return (
      <div className="p-8">
        <p>Not logged in</p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  
  // Try exact match
  const { data: exactMatch } = await supabase
    .from("users")
    .select("*")
    .eq("email", user.email || "")
    .maybeSingle();

  // Try case-insensitive match
  const { data: caseInsensitiveMatch } = await supabase
    .from("users")
    .select("*")
    .ilike("email", user.email?.toLowerCase().trim() || "")
    .maybeSingle();

  // Try with trimmed
  const { data: trimmedMatch } = await supabase
    .from("users")
    .select("*")
    .ilike("email", (user.email || "").toLowerCase().trim())
    .maybeSingle();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-4">Email Matching Test</h1>
        
        <div className="space-y-4">
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-2">Your Auth Email</h2>
            <div className="bg-gray-100 p-3 rounded">
              <p className="font-mono">{user.email || "No email"}</p>
              <p className="text-sm text-gray-600 mt-1">
                Lowercase: {user.email?.toLowerCase()}
              </p>
              <p className="text-sm text-gray-600">
                Trimmed: "{user.email?.toLowerCase().trim()}"
              </p>
            </div>
          </div>

          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold mb-2">Database Query Results</h2>
            
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">Exact Match (eq):</p>
                {exactMatch ? (
                  <pre className="bg-green-50 p-2 rounded text-xs">
                    {JSON.stringify(exactMatch, null, 2)}
                  </pre>
                ) : (
                  <p className="text-red-600 text-sm">❌ No match</p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium">Case-Insensitive Match (ilike):</p>
                {caseInsensitiveMatch ? (
                  <pre className="bg-green-50 p-2 rounded text-xs">
                    {JSON.stringify(caseInsensitiveMatch, null, 2)}
                  </pre>
                ) : (
                  <p className="text-red-600 text-sm">❌ No match</p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium">Trimmed Match (ilike with trim):</p>
                {trimmedMatch ? (
                  <pre className="bg-green-50 p-2 rounded text-xs">
                    {JSON.stringify(trimmedMatch, null, 2)}
                  </pre>
                ) : (
                  <p className="text-red-600 text-sm">❌ No match</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-2">All Users in Database</h2>
            <p className="text-sm text-gray-600 mb-2">To verify your email exists:</p>
            <code className="block bg-gray-100 p-3 rounded text-xs overflow-auto">
              SELECT email, role FROM public.users;
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

