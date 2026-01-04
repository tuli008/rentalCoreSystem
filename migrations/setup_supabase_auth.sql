-- Setup instructions for Supabase Authentication
-- 
-- This migration helps you set up authentication in Supabase
-- Follow these steps in your Supabase Dashboard:

-- 1. Enable Email Authentication
--    - Go to Authentication > Providers in Supabase Dashboard
--    - Enable "Email" provider
--    - Configure email templates if needed

-- 2. Create your first admin user
--    You can do this in two ways:

--    Option A: Using Supabase Dashboard
--    - Go to Authentication > Users
--    - Click "Add user" > "Create new user"
--    - Enter email and password
--    - After creating, note the user's email

--    Option B: Using SQL (after user signs up)
--    - User signs up via the app
--    - Then run this to add them to users table:

-- Example: Add user to users table after they sign up
-- INSERT INTO public.users (tenant_id, email, name, role)
-- VALUES (
--   '11111111-1111-1111-1111-111111111111',  -- Your tenant ID
--   'admin@example.com',                     -- User's email (must match auth.users)
--   'Admin User',                            -- User's name
--   'admin'                                  -- Role: 'admin' or 'user'
-- );

-- 3. Link Supabase Auth users to your users table
--    The email in auth.users must match the email in public.users
--    This is how we determine the user's role and tenant

-- 4. Enable Row Level Security (RLS) - Optional but recommended
--    This ensures users can only see their tenant's data

-- Example RLS policy for inventory_groups:
-- CREATE POLICY "Users can only see their tenant's groups"
-- ON public.inventory_groups
-- FOR SELECT
-- USING (tenant_id = (
--   SELECT tenant_id FROM public.users 
--   WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
-- ));

-- 5. Test the setup
--    - Create a user in Supabase Auth
--    - Add them to public.users table
--    - Try logging in via /login page
--    - Verify they can access the app

