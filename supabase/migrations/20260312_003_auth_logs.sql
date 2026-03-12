-- Auth audit logs for compliance tracking and incident investigation
create table if not exists public.auth_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,
  role text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public.auth_logs enable row level security;

create index if not exists idx_auth_logs_created_at on public.auth_logs(created_at desc);
create index if not exists idx_auth_logs_user_id on public.auth_logs(user_id);

-- Any signed-in user can write their own login event; reading is restricted to super admins.
create policy if not exists "auth_logs_insert_own"
  on public.auth_logs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy if not exists "super_admin_can_view_auth_logs"
  on public.auth_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'super_admin'
    )
  );
