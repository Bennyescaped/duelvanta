-- CI-only ephemeral PostgreSQL. No real Supabase Auth users or credentials.
create role anon;
create role authenticated;
create schema auth;
create table public.profiles (
  id uuid primary key,
  email text not null,
  role text not null default 'player',
  account_status text not null default 'active'
);
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  target_user_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
grant usage on schema auth to authenticated;
