# Fix Users Table - Troubleshooting Guide

## Problem: Users Not Being Created

If users aren't being added to the `public.users` table, follow these steps:

## Step 1: Check if Users Table Exists

Run this in Supabase SQL Editor:

```sql
SELECT * FROM public.users LIMIT 5;
```

If you get an error, the table doesn't exist. Run the migration:

```sql
-- Run migrations/users_table.sql
```

## Step 2: Check Your Current User

See if you exist in auth.users:

```sql
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;
```

Note your email address.

## Step 3: Manually Create User (Quick Fix)

Replace `your-email@example.com` with your actual email:

```sql
INSERT INTO public.users (tenant_id, email, name, role)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'your-email@example.com',
  'Your Name',
  'admin'  -- or 'user'
)
ON CONFLICT (tenant_id, email) DO UPDATE
SET role = EXCLUDED.role;
```

## Step 4: Test the API Endpoint

After logging in, open browser console (F12) and run:

```javascript
// This will create your user if it doesn't exist
fetch('/api/auth/create-user-manual', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({ name: 'Your Name' })
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## Step 5: Check for Errors

Common issues:

### Issue 1: Foreign Key Constraint
If you get an error about `tenant_id`, make sure the tenant exists:

```sql
SELECT id FROM public.tenants WHERE id = '11111111-1111-1111-1111-111111111111';
```

If it doesn't exist, create it:

```sql
INSERT INTO public.tenants (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Default Tenant')
ON CONFLICT (id) DO NOTHING;
```

### Issue 2: Unique Constraint
If you get a duplicate key error, the user already exists. Check:

```sql
SELECT * FROM public.users WHERE email = 'your-email@example.com';
```

### Issue 3: Check Constraint
If you get an error about role, make sure it's exactly 'admin' or 'user':

```sql
-- Check current role
SELECT email, role FROM public.users WHERE email = 'your-email@example.com';

-- Fix if needed
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'your-email@example.com';
```

## Step 6: Verify Signup Flow

After fixing, test signup again:

1. Sign up a new user
2. Check browser console for errors
3. Check server logs for errors
4. Verify user was created:

```sql
SELECT * FROM public.users ORDER BY created_at DESC LIMIT 5;
```

## Quick Diagnostic Query

Run this to see the current state:

```sql
-- Check auth users
SELECT 
  'auth.users' as source,
  email,
  created_at
FROM auth.users
UNION ALL
-- Check public users
SELECT 
  'public.users' as source,
  email,
  created_at
FROM public.users
ORDER BY created_at DESC;
```

This shows which users exist in which table.

## Still Not Working?

1. Check Supabase logs for errors
2. Check browser console for API errors
3. Verify your Supabase connection is working
4. Make sure RLS (Row Level Security) isn't blocking inserts

