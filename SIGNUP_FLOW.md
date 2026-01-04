# Sign Up Flow - Where Data Goes

## 📊 Two Tables Are Involved

When a user signs up, their information goes to **TWO tables**:

### 1️⃣ `auth.users` (Supabase Auth Table)
**Managed by Supabase automatically**

This table stores:
- `id` - Unique user ID (UUID)
- `email` - User's email address
- `encrypted_password` - Hashed password (never stored in plain text)
- `email_confirmed_at` - When email was confirmed
- `created_at` - Account creation timestamp
- `user_metadata` - Additional data (like name)

**Location:** This is in Supabase's `auth` schema (not your public schema)

**Access:** You don't directly query this - Supabase handles it via their Auth API

---

### 2️⃣ `public.users` (Your Custom Table)
**Created by your migration: `migrations/users_table.sql`**

This table stores:
- `id` - UUID (different from auth.users id)
- `tenant_id` - Which store/tenant the user belongs to
- `email` - User's email (matches auth.users email)
- `name` - User's display name
- `role` - 'admin' or 'user'
- `created_at` - When record was created
- `updated_at` - Last update timestamp

**Location:** Your `public` schema in the database

**Access:** You query this directly for role and tenant information

---

## 🔄 Complete Sign Up Flow

```
User fills signup form
    ↓
Frontend sends to Supabase Auth
    ↓
Supabase creates record in auth.users
    - Stores: email, encrypted password, user_metadata (name)
    ↓
Supabase returns JWT token
    ↓
Frontend calls /api/auth/create-user
    ↓
Backend gets authenticated user from JWT
    ↓
Backend creates record in public.users
    - Stores: email, name, tenant_id, role
    ↓
User is now in both tables!
```

---

## 📋 What Gets Stored Where

### In `auth.users` (Supabase):
```json
{
  "id": "uuid-from-supabase",
  "email": "user@example.com",
  "encrypted_password": "hashed-password",
  "user_metadata": {
    "name": "John Doe"
  },
  "created_at": "2024-01-01T00:00:00Z"
}
```

### In `public.users` (Your table):
```json
{
  "id": "uuid-generated-by-db",
  "tenant_id": "11111111-1111-1111-1111-111111111111",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

---

## 🔗 How They're Linked

The two tables are linked by **email address**:

- `auth.users.email` = `public.users.email`

When you need to check a user's role or tenant:
1. Get the authenticated user from JWT (which gives you their email)
2. Look up that email in `public.users` table
3. Get their `role` and `tenant_id`

---

## 🎯 Why Two Tables?

### `auth.users` (Supabase):
- Handles authentication (login, password verification)
- Manages JWT tokens
- Handles password reset, email verification
- **You don't manage this** - Supabase does

### `public.users` (Your table):
- Stores business logic (role, tenant)
- Links users to your application data
- **You manage this** - for permissions and tenant isolation

---

## 🔍 How to View the Data

### View auth.users:
```sql
-- In Supabase SQL Editor
SELECT id, email, created_at, user_metadata 
FROM auth.users;
```

### View public.users:
```sql
-- In Supabase SQL Editor
SELECT id, email, name, role, tenant_id, created_at 
FROM public.users;
```

---

## ✅ Summary

**Sign up details go to:**
1. ✅ `auth.users` - For authentication (automatic by Supabase)
2. ✅ `public.users` - For role and tenant (automatic by your API)

**Both are created automatically** - no manual steps needed!

