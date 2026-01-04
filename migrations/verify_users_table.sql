-- Verify users table exists and check its structure
-- Run this to diagnose issues with the users table

-- 1. Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'users'
) as table_exists;

-- 2. Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- 3. Check constraints
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass;

-- 4. Check if tenant exists (required for foreign key)
SELECT id, name 
FROM public.tenants 
WHERE id = '11111111-1111-1111-1111-111111111111';

-- 5. If tenant doesn't exist, create it
INSERT INTO public.tenants (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Default Tenant')
ON CONFLICT (id) DO NOTHING;

-- 6. Try a test insert (replace with your email)
-- INSERT INTO public.users (tenant_id, email, name, role)
-- VALUES (
--   '11111111-1111-1111-1111-111111111111',
--   'test@example.com',
--   'Test User',
--   'user'
-- )
-- ON CONFLICT (tenant_id, email) DO NOTHING
-- RETURNING *;

