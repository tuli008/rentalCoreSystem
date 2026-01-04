# Fix Missing User in Users Table

If you signed up but don't see your user in the `public.users` table, here's how to fix it:

## Quick Fix (Automatic)

1. **Make sure you're logged in**
2. **Open browser console** (F12)
3. **Run this command:**

```javascript
fetch('/api/auth/fix-user', { method: 'POST', credentials: 'include' })
  .then(r => r.json())
  .then(console.log)
```

This will automatically create your user record in the `public.users` table.

## Manual Fix (SQL)

If the automatic fix doesn't work, you can manually add yourself:

1. **Get your email** from Supabase Auth:
   - Go to Supabase Dashboard → Authentication → Users
   - Find your user and note the email

2. **Run this SQL** in Supabase SQL Editor:

```sql
-- Replace 'your-email@example.com' with your actual email
INSERT INTO public.users (tenant_id, email, name, role)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'your-email@example.com',
  'Your Name',  -- Or use: split_part('your-email@example.com', '@', 1)
  'user'  -- Change to 'admin' if you want admin access
)
ON CONFLICT (tenant_id, email) DO NOTHING;
```

## Why This Happens

The signup process:
1. Creates user in `auth.users` ✅ (works)
2. Tries to create user in `public.users` ❌ (sometimes fails)

Common reasons for failure:
- Session not established yet when API is called
- Network error during API call
- Database constraint violation

## Prevention

The signup flow has been improved to:
- Wait longer for session establishment
- Refresh session before API call
- Better error handling
- Include credentials in fetch

If you still have issues, use the fix above!

