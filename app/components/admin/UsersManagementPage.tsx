"use client";

import { useState, useTransition } from "react";
import type { User } from "@/app/actions/admin";

interface UsersManagementPageProps {
  initialUsers: User[];
  updateUserRole: (userId: string, role: "admin" | "user") => Promise<{
    success?: boolean;
    error?: string;
  }>;
  updateUser: (userId: string, name: string, role: "admin" | "user") => Promise<{
    success?: boolean;
    error?: string;
  }>;
  createUser: (
    email: string,
    name: string,
    role: "admin" | "user"
  ) => Promise<{
    success?: boolean;
    error?: string;
    user?: User;
  }>;
}

export default function UsersManagementPage({
  initialUsers,
  updateUserRole,
  updateUser,
  createUser,
}: UsersManagementPageProps) {
  // Ensure initialUsers is an array
  const safeInitialUsers = Array.isArray(initialUsers) ? initialUsers : [];
  const [users, setUsers] = useState(safeInitialUsers);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "user" as "admin" | "user",
  });
  const [addForm, setAddForm] = useState({
    email: "",
    name: "",
    role: "user" as "admin" | "user",
  });

  const handleEdit = (user: User) => {
    setEditingUserId(user.id);
    setEditForm({
      name: user.name,
      role: user.role,
    });
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditForm({ name: "", role: "user" });
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!editingUserId) return;

    setError(null);
    setSuccess(null);

    if (!editForm.name.trim()) {
      setError("Name is required");
      return;
    }

    startTransition(async () => {
      const result = await updateUser(
        editingUserId,
        editForm.name.trim(),
        editForm.role
      );

      if (result.success) {
        // Update local state
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.id === editingUserId
              ? { ...user, name: editForm.name.trim(), role: editForm.role }
              : user
          )
        );
        setSuccess("User updated successfully");
        setEditingUserId(null);
        setEditForm({ name: "", role: "user" });
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to update user");
        setTimeout(() => setError(null), 5000);
      }
    });
  };

  const handleQuickRoleChange = async (userId: string, newRole: "admin" | "user") => {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await updateUserRole(userId, newRole);

      if (result.success) {
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.id === userId ? { ...user, role: newRole } : user
          )
        );
        setSuccess(`User role updated to ${newRole}`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to update user role");
        setTimeout(() => setError(null), 5000);
      }
    });
  };

  const handleAddUser = () => {
    setIsAddingUser(true);
    setAddForm({ email: "", name: "", role: "user" });
    setError(null);
    setSuccess(null);
  };

  const handleCancelAdd = () => {
    setIsAddingUser(false);
    setAddForm({ email: "", name: "", role: "user" });
    setError(null);
    setSuccess(null);
  };

  const handleSaveNewUser = async () => {
    if (!addForm.email.trim() || !addForm.name.trim()) {
      setError("Email and name are required");
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await createUser(
        addForm.email.trim(),
        addForm.name.trim(),
        addForm.role
      );

      if (result.success && result.user) {
        // Add new user to the list
        setUsers((prevUsers) => [result.user!, ...prevUsers]);
        setSuccess("User created successfully");
        setIsAddingUser(false);
        setAddForm({ email: "", name: "", role: "user" });
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "Failed to create user");
        setTimeout(() => setError(null), 5000);
      }
    });
  };

  const getRoleBadgeColor = (role: "admin" | "user") => {
    return role === "admin"
      ? "bg-purple-100 text-purple-800"
      : "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              User Management
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Manage users, their roles, and permissions. Only admins can access this page.
            </p>
          </div>
          <button
            onClick={handleAddUser}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            + Add User
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead className="bg-gray-50 border-b-2 border-gray-300">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">
                    Role
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700 text-sm">
                    Created
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700 text-sm">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 px-4 text-center text-gray-500"
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-3 px-4 text-gray-900 font-medium">
                        {user.name}
                      </td>
                      <td className="py-3 px-4 text-gray-700">{user.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor(
                            user.role
                          )}`}
                        >
                          {user.role === "admin" ? "Admin" : "User"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm">
                        {new Date(user.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        {users.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Total: {users.length} user{users.length !== 1 ? "s" : ""} (
            {users.filter((u) => u.role === "admin").length} Admin
            {users.filter((u) => u.role === "admin").length !== 1 ? "s" : ""}
            , {users.filter((u) => u.role === "user").length} User
            {users.filter((u) => u.role === "user").length !== 1 ? "s" : ""})
          </div>
        )}

        {/* Add User Modal */}
        {isAddingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Add New User
                  </h2>
                  <button
                    onClick={handleCancelAdd}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Form */}
                <div className="space-y-6">
                  {/* User Details Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                      User Details
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="add-name"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="add-name"
                          type="text"
                          value={addForm.name}
                          onChange={(e) =>
                            setAddForm({ ...addForm, name: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          placeholder="User Name"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="add-email"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="add-email"
                          type="email"
                          value={addForm.email}
                          onChange={(e) =>
                            setAddForm({ ...addForm, email: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          placeholder="user@example.com"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          User can sign up later with this email to activate their account
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Role Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                      Role & Permissions
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="add-role"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Role <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="add-role"
                          value={addForm.role}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              role: e.target.value as "admin" | "user",
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                          Admin: Full access to inventory and crew management.
                          User: Read-only access to inventory and crew.
                        </p>
                      </div>

                      {/* Role Permissions Info */}
                      <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-xs font-medium text-gray-700 mb-2">
                          Permissions:
                        </p>
                        <div className="space-y-1 text-xs text-gray-600">
                          {addForm.role === "admin" ? (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">✓</span>
                                <span>Create/Edit/Delete inventory items</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">✓</span>
                                <span>Create/Edit/Delete crew members</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">✓</span>
                                <span>Manage users and roles</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">✓</span>
                                <span>Create/Edit events and quotes</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">✗</span>
                                <span>Read-only: Inventory items</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">✗</span>
                                <span>Read-only: Crew members</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">✓</span>
                                <span>Create/Edit events and quotes</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleCancelAdd}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNewUser}
                    disabled={isPending || !addForm.name.trim() || !addForm.email.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? "Creating..." : "Create User"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editingUserId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Edit User
                  </h2>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Form */}
                <div className="space-y-6">
                  {/* User Details Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                      User Details
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="edit-name"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="edit-name"
                          type="text"
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          placeholder="User Name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={
                            users.find((u) => u.id === editingUserId)?.email ||
                            ""
                          }
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Email cannot be changed
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Role Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                      Role & Permissions
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="edit-role"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Role <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="edit-role"
                          value={editForm.role}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              role: e.target.value as "admin" | "user",
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                          Admin: Full access to inventory and crew management.
                          User: Read-only access to inventory and crew.
                        </p>
                      </div>

                      {/* Role Permissions Info */}
                      <div className="bg-gray-50 p-3 rounded-md">
                        <p className="text-xs font-medium text-gray-700 mb-2">
                          Permissions:
                        </p>
                        <div className="space-y-1 text-xs text-gray-600">
                          {editForm.role === "admin" ? (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">✓</span>
                                <span>Create/Edit/Delete inventory items</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">✓</span>
                                <span>Create/Edit/Delete crew members</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">✓</span>
                                <span>Manage users and roles</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">✓</span>
                                <span>Create/Edit events and quotes</span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">✗</span>
                                <span>Read-only: Inventory items</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">✗</span>
                                <span>Read-only: Crew members</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">✓</span>
                                <span>Create/Edit events and quotes</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isPending || !editForm.name.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? "Updating..." : "Update"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
