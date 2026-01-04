# How to Access Admin Page

## ✅ Admin Page Exists

The admin page is located at: **`/admin/users`**

## 🔍 Why You Don't See It

The "Admin" link in the navigation **only appears if you're an admin**. 

If you don't see it, you're likely not an admin yet.

## 🚀 How to Access

### Option 1: Make Yourself Admin First

1. **Check your current role:**
   ```sql
   SELECT email, role FROM public.users WHERE email = 'your-email@example.com';
   ```

2. **Make yourself admin:**
   ```sql
   UPDATE public.users 
   SET role = 'admin' 
   WHERE email = 'your-email@example.com';
   ```

3. **Refresh the page** - The "Admin" link will appear in navigation

4. **Click "Admin"** or go to `/admin/users`

### Option 2: Access Directly (Will Redirect if Not Admin)

1. Go to: `http://localhost:3000/admin/users`
2. If you're not admin, you'll be redirected to home page
3. If you are admin, you'll see the user management page

## 📋 What You'll See

Once you're an admin and access `/admin/users`, you'll see:

- **Table of all users** with:
  - Name
  - Email
  - Role (Admin/User badge)
  - Created date
  - Role dropdown to change roles

- **Summary** showing:
  - Total users
  - Number of admins
  - Number of regular users

## 🔧 Troubleshooting

### "Admin" link not showing?
- You're not an admin - update your role in database (see above)

### Page redirects to home?
- You're not an admin - update your role in database

### Page shows "No users found"?
- No users exist in `public.users` table
- Users need to sign up first

### Can't change roles?
- Make sure you're logged in as admin
- Check browser console for errors

## ✅ Quick Test

1. Make yourself admin (SQL above)
2. Refresh page
3. You should see "Admin" link in navigation
4. Click it or go to `/admin/users`
5. You should see all users and be able to change roles

