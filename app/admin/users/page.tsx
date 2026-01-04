import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentUserRole } from "@/lib/auth";
import UsersManagementPage from "@/app/components/admin/UsersManagementPage";
import { getUsers, updateUserRole, updateUser, createUser } from "@/app/actions/admin";

export default async function AdminUsersPage() {
  // Check if user is logged in
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Check if user is admin
  const role = await getCurrentUserRole();
  if (role !== "admin") {
    redirect("/");
  }

  // Get all users
  const users = await getUsers();

  return (
    <UsersManagementPage
      initialUsers={users}
      updateUserRole={updateUserRole}
      updateUser={updateUser}
      createUser={createUser}
    />
  );
}

