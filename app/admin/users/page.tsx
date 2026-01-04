import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentUserRole } from "@/lib/auth";
import UsersManagementPage from "@/app/components/admin/UsersManagementPage";
import { getUsers, updateUserRole, updateUser, createUser } from "@/app/actions/admin";

export default async function AdminUsersPage() {
  try {
    // Check if user is logged in
    const user = await getCurrentUser();
    if (!user) {
      console.log("[AdminUsersPage] No user found, redirecting to login");
      redirect("/login");
    }

    // Check if user is admin
    const role = await getCurrentUserRole();
    console.log("[AdminUsersPage] User role check:", {
      email: user?.email,
      role: role,
      isAdmin: role === "admin",
    });

    if (role !== "admin") {
      console.log("[AdminUsersPage] User is not admin, redirecting to home");
      redirect("/");
    }

    // Get all users
    const users = await getUsers();

    // Ensure users is an array
    const safeUsers = Array.isArray(users) ? users : [];

    return (
      <UsersManagementPage
        initialUsers={safeUsers}
        updateUserRole={updateUserRole}
        updateUser={updateUser}
        createUser={createUser}
      />
    );
  } catch (error) {
    console.error("[AdminUsersPage] Error:", error);
    // Return error page instead of crashing
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Admin Page</h1>
          <p className="text-gray-700 mb-4">
            There was an error loading the admin page. Please try again or contact support.
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Error: {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }
}

