# Fix Admin Access in Production

If the Admin link is not showing in production but works locally, follow these steps:

## Step 1: Verify User Exists in Database

Run this SQL in your Supabase SQL Editor:

```sql
-- Check if your user exists in public.users
SELECT id, email, name, role, tenant_id, created_at
FROM public.users
WHERE email = 'your-email@example.com';  -- Replace with your actual email
```

## Step 2: If User Doesn't Exist, Create It

If the query returns no rows, create your user:

```sql
INSERT INTO public.users (tenant_id, email, name, role)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'your-email@example.com',  -- Replace with your actual email
  'Your Name',
  'admin'  -- Set to 'admin' for admin access
)
ON CONFLICT (tenant_id, email) DO UPDATE
SET role = 'admin';
```

## Step 3: Verify Email Match

Make sure the email in `auth.users` matches exactly (case-insensitive) with `public.users`:

```sql
-- Check auth.users email
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Compare with public.users
SELECT id, email, role
FROM public.users
ORDER BY created_at DESC
LIMIT 5;
```

## Step 4: Check Vercel Logs

1. Go to your Vercel dashboard
2. Navigate to your project
3. Go to "Deployments" → Select latest deployment → "Functions" tab
4. Look for logs from `/api/auth/check-admin`
5. Check for any errors or warnings

## Step 5: Test the API Directly

After logging in, open browser console (F12) and run:

```javascript
fetch('/api/auth/check-admin', {
  credentials: 'include'
})
.then(r => r.json())
.then(data => {
  console.log('Admin check result:', data);
  if (!data.isAdmin) {
    console.error('User is not admin. Check database.');
  }
})
.catch(console.error);
```

## Step 6: Common Issues

### Issue 1: Email Case Mismatch
- The code now uses case-insensitive matching (`ilike`), but ensure emails match

### Issue 2: User Not in Database
- Signup might have failed to create the user record
- Use the fix page: `/admin/fix-user` (if accessible) or run SQL manually

### Issue 3: Session Not Persisting
- Clear cookies and log in again
- Check that Supabase session cookies are being set

### Issue 4: Tenant ID Mismatch
- Ensure your user has the correct `tenant_id` in `public.users`
- Default tenant ID: `11111111-1111-1111-1111-111111111111`

## Quick Fix SQL

Run this to make yourself admin (replace email):

```sql
-- Make yourself admin
UPDATE public.users 
SET role = 'admin' 
WHERE email ILIKE 'your-email@example.com';

-- Or create if doesn't exist
INSERT INTO public.users (tenant_id, email, name, role)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'your-email@example.com',
  'Your Name',
  'admin'
)
ON CONFLICT (tenant_id, email) DO UPDATE
SET role = 'admin';
```

## After Fixing

1. Clear browser cache and cookies
2. Log out and log back in
3. The Admin link should appear in the navigation
4. Check browser console for any errors

