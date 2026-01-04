-- Create users table for authentication and authorization
create table if not exists public.users (
  id uuid not null default extensions.uuid_generate_v4(),
  tenant_id uuid not null,
  email text not null,
  name text not null,
  role text not null check (role in ('admin', 'user')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint users_pkey primary key (id),
  constraint users_tenant_id_email_key unique (tenant_id, email),
  constraint users_tenant_id_fkey foreign key (tenant_id) references tenants (id) on delete cascade
) tablespace pg_default;

-- Create index for better query performance
create index if not exists idx_users_tenant_id on public.users (tenant_id);
create index if not exists idx_users_email on public.users (email);
create index if not exists idx_users_role on public.users (role);

-- Add comment for documentation
comment on table public.users is 'Stores user information and roles for authorization';
comment on column public.users.role is 'User role: admin (full access) or user (read-only for inventory/crew)';

