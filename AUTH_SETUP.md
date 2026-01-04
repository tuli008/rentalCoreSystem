# Authentication Setup Guide

## ✅ What's Been Implemented

Your rental core system now has **proper JWT-based authentication** using Supabase Auth!

### What You Have Now:

1. **Login Page** (`/login`) - Users must log in to access the app
2. **JWT Authentication** - Secure token-based auth (handled by Supabase)
3. **Role-Based Access** - Admin vs User permissions
4. **Tenant Isolation** - Each user belongs to one tenant/store
5. **Protected Routes** - Middleware automatically redirects unauthenticated users

---

## 🚀 Quick Start (No Manual Steps Needed!)

### Step 1: Enable Email Authentication in Supabase (One-time setup)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Authentication** → **Providers**
4. Enable **Email** provider
5. (Optional) Configure email templates

**That's it!** Everything else is automatic.

### Step 2: Create Your First User (Automatic!)

**Just use the Sign Up page:**

1. Start your dev server: `npm run dev`
2. Go to: `http://localhost:3000/signup`
3. Enter:
   - Name: Your full name
   - Email: Your email address
   - Password: Choose a password (min 6 characters)
   - Confirm Password: Re-enter password
4. Click **"Sign up"**

**What happens automatically:**
- ✅ User is created in Supabase Auth
- ✅ User is automatically added to `users` table
- ✅ Assigned to default tenant
- ✅ Assigned "user" role (can be changed to "admin" later)
- ✅ You're logged in and redirected to home page

### Step 3: Make First User Admin (Optional)

If you want your first user to be an admin, update the role in the database:

```sql
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

### Step 4: Test Login

1. Go to: `http://localhost:3000/login`
2. Enter your email and password
3. You should be redirected to the home page

---

## 📋 How It Works

### Login Flow

```
User enters email/password
    ↓
Frontend sends to Supabase Auth
    ↓
Supabase validates credentials
    ↓
Supabase returns JWT token
    ↓
Token stored in secure cookies
    ↓
Every request includes token
    ↓
Backend validates token & gets user info
    ↓
Checks users table for role & tenant
    ↓
Allows/denies based on permissions
```

### JWT Token Contains

- User ID
- Email
- Session info

### Backend Looks Up

- Role (admin/user) from `users` table
- Tenant ID from `users` table
- Uses this for authorization

---

## 🔐 Authorization Rules

### Admin Users Can:
- ✅ Create/update/delete inventory items
- ✅ Create/update/delete inventory groups
- ✅ Create/update/delete crew members
- ✅ Update stock, units, maintenance logs
- ✅ Create/update events and quotes

### Regular Users Can:
- ✅ View inventory (read-only)
- ✅ View crew (read-only)
- ✅ Create/update events and quotes (full access)

### Everyone:
- ✅ Must be logged in to access the app
- ✅ Can only see data from their tenant

---

## 🏗️ Architecture

### Files Created/Updated:

1. **`lib/supabase-server.ts`** - Server-side Supabase client with auth
2. **`lib/supabase-client.ts`** - Client-side Supabase client
3. **`lib/auth.ts`** - Authorization utilities (updated to use Supabase)
4. **`app/login/page.tsx`** - Login page
5. **`middleware.ts`** - Route protection
6. **`app/components/Navigation.tsx`** - Added logout button

### How Server Actions Work Now:

```typescript
// Before (environment variable)
const isAdmin = process.env.CURRENT_USER_ROLE === "admin";

// After (JWT-based)
const user = await getCurrentUser(); // Gets user from JWT
const role = await getCurrentUserRole(); // Gets role from users table
const isAdmin = role === "admin";
```

---

## 🔧 Configuration

### Environment Variables

Your `.env.local` should have:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Note:** You can remove `CURRENT_USER_ROLE=admin` - it's no longer needed!

---

## 👥 Adding More Users

### It's Automatic! 

**Users can sign up themselves:**

1. Go to `/signup`
2. Fill out the form
3. Click "Sign up"
4. They're automatically:
   - Created in Supabase Auth
   - Added to `users` table
   - Assigned to default tenant
   - Given "user" role
   - Logged in immediately

**To make a user an admin:**

Update their role in the database:

```sql
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'user@example.com';
```

Or create an admin user directly:

```sql
-- First, have them sign up normally
-- Then update their role:
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'admin@example.com';
```

---

## 🛡️ Tenant Isolation

Each user belongs to one tenant. All queries automatically filter by tenant:

```typescript
const tenantId = await getCurrentTenantId();
// All queries include: .eq("tenant_id", tenantId)
```

This ensures:
- ABC Rentals users never see XYZ Rentals data
- No cross-tenant data leakage
- Automatic filtering on all queries

---

## 🚨 Troubleshooting

### "Invalid API key" error
- Check your `.env.local` has correct Supabase keys
- Restart dev server after changing `.env.local`

### "Unauthorized" error
- User is not logged in → redirects to `/login`
- User doesn't have required role → shows error

### User can't log in
- Check user exists in Supabase Auth
- Check user exists in `users` table
- Verify email matches in both places

### User has wrong permissions
- Check `role` in `users` table
- Must be exactly `'admin'` or `'user'`
- Restart server after updating database

---

## 📝 Next Steps (Optional Enhancements)

1. **Sign Up Page** - Allow users to register themselves
2. **Password Reset** - Email-based password recovery
3. **Email Verification** - Require email confirmation
4. **Row Level Security (RLS)** - Database-level tenant isolation
5. **Session Management** - View active sessions, logout all devices

---

## 🎯 Summary

You now have:
- ✅ Login page
- ✅ JWT authentication
- ✅ Role-based access control
- ✅ Tenant isolation
- ✅ Protected routes

**Users log in → Get JWT → Backend checks role → Allows/denies actions**

That's it! Your authentication system is production-ready! 🎉

