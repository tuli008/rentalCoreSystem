create table public.tenants (
id uuid not null default extensions.uuid_generate_v4 (),
name text not null,
created_at timestamp with time zone not null default now(),
constraint tenants_pkey primary key (id)
) TABLESPACE pg_default;

create table public.locations (
id uuid not null default extensions.uuid_generate_v4 (),
tenant_id uuid not null,
name text not null,
type text not null,
created_at timestamp with time zone not null default now(),
constraint locations_pkey primary key (id),
constraint locations_tenant_id_name_key unique (tenant_id, name),
constraint locations_tenant_id_fkey foreign KEY (tenant_id) references tenants (id) on delete CASCADE,
constraint locations_type_check check (
(
type = any (
array['warehouse'::text, 'event'::text, 'transit'::text]
)
)
)
) TABLESPACE pg_default;

create table public.inventory_units (
id uuid not null default extensions.uuid_generate_v4 (),
tenant_id uuid not null,
item_id uuid not null,
location_id uuid not null,
serial_number text not null,
barcode text not null,
status text not null,
created_at timestamp with time zone not null default now(),
constraint inventory_units_pkey primary key (id),
constraint inventory_units_tenant_id_serial_number_key unique (tenant_id, serial_number),
constraint inventory_units_tenant_id_barcode_key unique (tenant_id, barcode),
constraint inventory_units_location_id_fkey foreign KEY (location_id) references locations (id),
constraint inventory_units_item_id_fkey foreign KEY (item_id) references inventory_items (id) on delete CASCADE,
constraint inventory_units_tenant_id_fkey foreign KEY (tenant_id) references tenants (id) on delete CASCADE,
constraint inventory_units_status_check check (
(
status = any (
array[
'available'::text,
'out'::text,
'maintenance'::text
]
)
)
)
) TABLESPACE pg_default;

create table public.inventory_stock (
id uuid not null default extensions.uuid_generate_v4 (),
tenant_id uuid not null,
item_id uuid not null,
location_id uuid not null,
total_quantity integer not null,
out_of_service_quantity integer not null default 0,
created_at timestamp with time zone not null default now(),
constraint inventory_stock_pkey primary key (id),
constraint inventory_stock_item_id_location_id_key unique (item_id, location_id),
constraint inventory_stock_tenant_id_fkey foreign KEY (tenant_id) references tenants (id) on delete CASCADE,
constraint inventory_stock_location_id_fkey foreign KEY (location_id) references locations (id),
constraint inventory_stock_item_id_fkey foreign KEY (item_id) references inventory_items (id) on delete CASCADE,
constraint inventory_stock_out_of_service_quantity_check check ((out_of_service_quantity >= 0)),
constraint inventory_stock_total_quantity_check check ((total_quantity >= 0))
) TABLESPACE pg_default;

create table public.inventory_items (
id uuid not null default extensions.uuid_generate_v4 (),
tenant_id uuid not null,
group_id uuid not null,
name text not null,
category text not null,
is_serialized boolean not null,
price numeric(10, 2) not null,
replacement_cost numeric(10, 2) null,
weight numeric null,
dimensions text null,
active boolean not null default true,
created_at timestamp with time zone not null default now(),
display_order integer not null default 0,
constraint inventory_items_pkey primary key (id),
constraint inventory_items_tenant_id_name_key unique (tenant_id, name),
constraint inventory_items_group_id_fkey foreign KEY (group_id) references inventory_groups (id),
constraint inventory_items_tenant_id_fkey foreign KEY (tenant_id) references tenants (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.inventory_groups (
id uuid not null default extensions.uuid_generate_v4 (),
tenant_id uuid not null,
name text not null,
created_at timestamp with time zone not null default now(),
display_order integer not null default 0,
constraint inventory_groups_pkey primary key (id),
constraint inventory_groups_tenant_id_name_key unique (tenant_id, name),
constraint inventory_groups_tenant_id_fkey foreign KEY (tenant_id) references tenants (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.inventory_maintenance_logs (
id uuid not null default extensions.uuid_generate_v4 (),
tenant_id uuid not null,
item_id uuid not null,
unit_id uuid null,
note text not null,
created_at timestamp with time zone not null default now(),
constraint inventory_maintenance_logs_pkey primary key (id),
constraint inventory_maintenance_logs_tenant_id_fkey foreign KEY (tenant_id) references tenants (id) on delete CASCADE,
constraint inventory_maintenance_logs_item_id_fkey foreign KEY (item_id) references inventory_items (id) on delete CASCADE,
constraint inventory_maintenance_logs_unit_id_fkey foreign KEY (unit_id) references inventory_units (id) on delete CASCADE
) TABLESPACE pg_default;
