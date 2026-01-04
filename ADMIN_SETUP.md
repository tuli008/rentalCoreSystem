# How to Get Admin Role

## Current Setup (Development)

The authorization system currently uses an environment variable to determine user role.

### Option 1: Environment Variable (Recommended for Development)

1. Create or edit `.env.local` file in the root of your project:
   ```bash
   CURRENT_USER_ROLE=admin
   ```

2. Restart your development server:
   ```bash
   npm run dev
   ```

### Option 2: Browser LocalStorage (Client-side only)

For quick testing in the browser console:
```javascript
localStorage.setItem("userRole", "admin");
// Then refresh the page
```

**Note:** This only affects client-side checks. Server-side actions will still use the environment variable.

## Production Setup (Recommended)

For production, you should:

1. **Run the users table migration:**
   ```sql
   -- Run migrations/users_table.sql in your database
   ```

2. **Create a user in the database:**
   ```sql
   INSERT INTO public.users (tenant_id, email, name, role)
   VALUES (
     '11111111-1111-1111-1111-111111111111',
     'admin@example.com',
     'Admin User',
     'admin'
   );
   ```

3. **Update `lib/auth.ts` to check the database:**
   - Replace the environment variable check with a database query
   - Use session/auth to get the current user's email
   - Query the `users` table to get their role

## Current Behavior

- **Default:** All users have "user" role (read-only for inventory/crew)
- **With `CURRENT_USER_ROLE=admin`:** User has full admin access
- **Admin can:** Create, update, delete inventory items, groups, crew members
- **Non-admin can:** Only read inventory and crew data (view-only)
- **Everyone can:** Create and update events/quotes (no restrictions)

## Testing Admin Access

After setting `CURRENT_USER_ROLE=admin`:
- ✅ You should see "Add Crew Member" button on the Crew page
- ✅ You should see Edit/Delete buttons in the Crew table
- ✅ You should be able to create/update/delete inventory items
- ✅ You should be able to create/update/delete inventory groups

