# Signup and Login Flow Explained

## How Signup Works

When you sign up, you provide:
1. **Email** - Your email address
2. **Password** - A password you create (minimum 6 characters)
3. **Name** - Your full name

This creates:
- ✅ An account in Supabase Auth (with your email and password)
- ✅ (Should create) A record in `public.users` table

## How Login Works

After signing up, you log in with:
- **Email** - The same email you used to sign up
- **Password** - The same password you created during signup

## The Fix Page (`/admin/fix-user`)

The fix page is **NOT** for creating your account. It's for:
- Creating the user record in `public.users` table if signup failed to create it
- This happens AFTER you've already signed up and logged in

## Complete Flow

### Scenario 1: Normal Signup (Everything Works)
1. Go to `/signup`
2. Enter: Email, Password, Name
3. Click "Sign up"
4. System creates:
   - Account in Supabase Auth ✅
   - User record in `public.users` ✅
5. You're automatically logged in
6. You can now use the system

### Scenario 2: Signup Succeeds but User Record Not Created
1. Go to `/signup`
2. Enter: Email, Password, Name
3. Click "Sign up"
4. System creates:
   - Account in Supabase Auth ✅
   - User record in `public.users` ❌ (failed)
5. You're logged in, but some features might not work
6. Go to `/admin/fix-user`
7. Click "Get Current User Email"
8. Enter your name and select role
9. Click "Create User in Database"
10. Now everything works!

### Scenario 3: You Already Signed Up
If you already signed up but the user record wasn't created:
1. **Log in** with the email and password you used during signup
2. Go to `/admin/fix-user`
3. Click "Get Current User Email"
4. Enter your name and select role
5. Click "Create User in Database"

## Important Notes

- **The password you create during signup is the password you use to log in**
- The fix page doesn't create your account - it only creates the user record
- If you forgot your password, you'll need to use Supabase's password reset (not implemented yet)
- Each email can only have one account

## Troubleshooting

**Q: I signed up but can't log in. What password do I use?**
A: Use the password you created during signup. If you forgot it, you'll need to reset it (password reset not implemented yet).

**Q: I don't remember if I signed up. How do I check?**
A: Try to sign up again with the same email. If it says "User already exists", then you already have an account. Try logging in with that email.

**Q: Can I change my password?**
A: Password reset functionality is not implemented yet. You'll need to use Supabase dashboard or wait for password reset feature.

**Q: The fix page says I'm not logged in. What do I do?**
A: You need to log in first! The fix page only works when you're already logged in.

