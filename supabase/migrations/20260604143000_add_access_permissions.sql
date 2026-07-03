-- Fine-grained application access model.

create table if not exists public.app_modules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_module_pages (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.app_modules(id) on delete cascade,
  key text not null,
  name text not null,
  route text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, key)
);

create table if not exists public.user_module_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  module_key text not null references public.app_modules(key) on delete cascade,
  page_key text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_approve boolean not null default false,
  can_export boolean not null default false,
  can_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id, module_key, page_key)
);

create table if not exists public.access_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.access_profile_permissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.access_profiles(id) on delete cascade,
  module_key text not null references public.app_modules(key) on delete cascade,
  page_key text not null,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  can_approve boolean not null default false,
  can_export boolean not null default false,
  can_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, module_key, page_key)
);

create table if not exists public.user_access_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.access_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);

create index if not exists idx_app_module_pages_module on public.app_module_pages(module_id);
create index if not exists idx_user_module_permissions_user_org on public.user_module_permissions(user_id, organization_id);
create index if not exists idx_user_module_permissions_module_page on public.user_module_permissions(module_key, page_key);
create index if not exists idx_access_profiles_org on public.access_profiles(organization_id);

alter table public.app_modules enable row level security;
alter table public.app_module_pages enable row level security;
alter table public.user_module_permissions enable row level security;
alter table public.access_profiles enable row level security;
alter table public.access_profile_permissions enable row level security;
alter table public.user_access_profiles enable row level security;

create or replace function public.is_org_admin(target_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_owners po
    where po.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('admin', 'admin_master')
      and (target_org_id is null or ur.organization_id = target_org_id)
  );
$$;

drop policy if exists "Modules are readable by authenticated users" on public.app_modules;
create policy "Modules are readable by authenticated users"
on public.app_modules for select
to authenticated
using (true);

drop policy if exists "Module pages are readable by authenticated users" on public.app_module_pages;
create policy "Module pages are readable by authenticated users"
on public.app_module_pages for select
to authenticated
using (true);

drop policy if exists "Admins manage modules" on public.app_modules;
create policy "Admins manage modules"
on public.app_modules for all
to authenticated
using (public.is_org_admin(null))
with check (public.is_org_admin(null));

drop policy if exists "Admins manage module pages" on public.app_module_pages;
create policy "Admins manage module pages"
on public.app_module_pages for all
to authenticated
using (public.is_org_admin(null))
with check (public.is_org_admin(null));

drop policy if exists "Users read own permissions and admins read org" on public.user_module_permissions;
create policy "Users read own permissions and admins read org"
on public.user_module_permissions for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_org_admin(organization_id)
);

drop policy if exists "Admins manage user permissions" on public.user_module_permissions;
create policy "Admins manage user permissions"
on public.user_module_permissions for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists "Users read profiles assigned to them and admins read org profiles" on public.access_profiles;
create policy "Users read profiles assigned to them and admins read org profiles"
on public.access_profiles for select
to authenticated
using (
  public.is_org_admin(organization_id)
  or exists (
    select 1
    from public.user_access_profiles uap
    where uap.profile_id = id
      and uap.user_id = auth.uid()
  )
);

drop policy if exists "Admins manage access profiles" on public.access_profiles;
create policy "Admins manage access profiles"
on public.access_profiles for all
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

drop policy if exists "Users read assigned profile permissions and admins read org" on public.access_profile_permissions;
create policy "Users read assigned profile permissions and admins read org"
on public.access_profile_permissions for select
to authenticated
using (
  exists (
    select 1
    from public.access_profiles ap
    where ap.id = profile_id
      and (
        public.is_org_admin(ap.organization_id)
        or exists (
          select 1
          from public.user_access_profiles uap
          where uap.profile_id = ap.id
            and uap.user_id = auth.uid()
        )
      )
  )
);

drop policy if exists "Admins manage access profile permissions" on public.access_profile_permissions;
create policy "Admins manage access profile permissions"
on public.access_profile_permissions for all
to authenticated
using (
  exists (
    select 1
    from public.access_profiles ap
    where ap.id = profile_id
      and public.is_org_admin(ap.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.access_profiles ap
    where ap.id = profile_id
      and public.is_org_admin(ap.organization_id)
  )
);

drop policy if exists "Users read own access profiles and admins manage org" on public.user_access_profiles;
create policy "Users read own access profiles and admins manage org"
on public.user_access_profiles for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.access_profiles ap
    where ap.id = profile_id
      and public.is_org_admin(ap.organization_id)
  )
);

drop policy if exists "Admins manage user access profiles" on public.user_access_profiles;
create policy "Admins manage user access profiles"
on public.user_access_profiles for all
to authenticated
using (
  exists (
    select 1
    from public.access_profiles ap
    where ap.id = profile_id
      and public.is_org_admin(ap.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.access_profiles ap
    where ap.id = profile_id
      and public.is_org_admin(ap.organization_id)
  )
);

insert into public.app_modules (key, name, description, icon, sort_order)
values
  ('equipment', 'Gestao de Equipamentos', 'Equipamentos, inspecoes, certificados e manutencao', 'package', 10),
  ('health', 'Gestao de Saude', 'Heat stress e health check', 'activity', 20),
  ('evv', 'eV&V', 'Execution Verification and Validation', 'shield-check', 30),
  ('obs_cards', 'OBS Cards', 'Observacoes, datasets e classificacao', 'shield-alert', 40),
  ('reports', 'Relatorios', 'Relatorios consolidados e exportacoes', 'file-text', 50),
  ('alerts', 'Alertas', 'Alertas operacionais', 'bell', 60),
  ('admin', 'Administracao', 'Usuarios, navios, regioes e plataforma', 'users', 70),
  ('audit', 'Auditoria', 'Audit log e reversoes', 'history', 80),
  ('settings', 'Configuracoes', 'Preferencias, perfil, offline e diagnosticos', 'settings', 90)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    sort_order = excluded.sort_order,
    updated_at = now();

with pages(module_key, key, name, route, description, sort_order) as (
  values
    ('equipment', 'dashboard', 'Dashboard', '/', null, 10),
    ('equipment', 'equipment', 'Equipamentos', '/equipment', null, 20),
    ('equipment', 'inspections', 'Inspecoes', '/inspections', null, 30),
    ('equipment', 'maintenance', 'Manutencao', '/maintenance', null, 40),
    ('equipment', 'certificates', 'Certificados', '/certificates', null, 50),
    ('equipment', 'pending', 'Pendencias', '/pending', null, 60),
    ('equipment', 'categories', 'Categorias', '/categories', null, 70),
    ('equipment', 'supervisor', 'Supervisor', '/supervisor', null, 80),
    ('health', 'heat_stress', 'Heat Stress', '/heat-stress', null, 10),
    ('health', 'health_check', 'Health Check', '/health-check', null, 20),
    ('evv', 'home', 'Inicio', '/evv', null, 10),
    ('evv', 'forms', 'Formularios', '/evv/forms', null, 20),
    ('evv', 'history', 'Historico', '/evv/history', null, 30),
    ('evv', 'reports', 'Relatorios', '/evv/reports', null, 40),
    ('obs_cards', 'dashboard', 'Dashboard', '/obs-cards', null, 10),
    ('obs_cards', 'upload', 'Upload', '/obs-cards/upload', null, 20),
    ('obs_cards', 'datasets', 'Datasets', '/obs-cards/datasets', null, 30),
    ('reports', 'reports', 'Relatorios Consolidados', '/reports', null, 10),
    ('alerts', 'alerts', 'Alertas', '/alerts', null, 10),
    ('admin', 'users', 'Usuarios', '/users', null, 10),
    ('admin', 'ships', 'Navios', '/users', null, 20),
    ('admin', 'regions', 'Regioes', '/users', null, 30),
    ('admin', 'platform_admin', 'Plataforma', '/platform-admin', null, 40),
    ('audit', 'audit_log', 'Audit Log', '/audit-log', null, 10),
    ('settings', 'settings', 'Configuracoes', '/settings', null, 10),
    ('settings', 'profile', 'Perfil', '/profile', null, 20),
    ('settings', 'offline', 'Dados Offline', '/offline', null, 30),
    ('settings', 'diagnostics', 'Diagnosticos', '/diagnostics', null, 40)
)
insert into public.app_module_pages (module_id, key, name, route, description, sort_order)
select m.id, p.key, p.name, p.route, p.description, p.sort_order
from pages p
join public.app_modules m on m.key = p.module_key
on conflict (module_id, key) do update
set name = excluded.name,
    route = excluded.route,
    description = excluded.description,
    sort_order = excluded.sort_order,
    updated_at = now();
