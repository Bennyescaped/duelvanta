-- BATTLE Spectator Foundation V1. Apply only to explicitly approved STAGING.
-- No player RPC, match SELECT policy, signal path or media code is replaced.
begin;
create schema if not exists battle_spectator_private;
revoke all on schema battle_spectator_private from public, anon, authenticated;

create table battle_spectator_private.links (
  match_id uuid primary key references public.battle_matches(id) on delete cascade,
  generation uuid not null default gen_random_uuid(),
  secret_hash text unique check (secret_hash is null or secret_hash ~ '^[0-9a-f]{64}$'),
  enabled boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  check (not enabled or secret_hash is not null)
);
create table battle_spectator_private.grants (
  match_id uuid not null references public.battle_matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  generation uuid not null,
  primary key (match_id, user_id)
);
create table battle_spectator_private.presence (
  match_id uuid not null references public.battle_matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  tab_id uuid not null,
  expires_at timestamptz not null,
  primary key (match_id, user_id, session_id, tab_id)
);
create index spectator_presence_match_expiry on battle_spectator_private.presence(match_id, expires_at);
create index spectator_presence_user on battle_spectator_private.presence(user_id);
create index spectator_presence_session on battle_spectator_private.presence(session_id);
alter table battle_spectator_private.links enable row level security;
alter table battle_spectator_private.grants enable row level security;
alter table battle_spectator_private.presence enable row level security;
revoke all on all tables in schema battle_spectator_private from public, anon, authenticated;

create function battle_spectator_private.eligible(p_uid uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id=p_uid
    and p.account_status in ('beta','active') and not coalesce(p.safety_restricted,false)
    and p.age_band in ('16_17','18_plus') and p.conduct_accepted_at is not null
    and p.conduct_version='battle-v1-2026-09' and p.data_processing_restricted_at is null);
$$;
create function battle_spectator_private.actor_session(p_require_eligible boolean default true) returns uuid
language plpgsql set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_sid uuid;
begin
  if v_uid is null or coalesce(auth.jwt()->>'role','') <> 'authenticated'
     or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'spectator_not_authenticated' using errcode='42501';
  end if;
  begin v_sid := nullif(auth.jwt()->>'session_id','')::uuid;
  exception when invalid_text_representation then
    raise exception 'spectator_session_unavailable' using errcode='42501'; end;
  if not exists (select 1 from auth.sessions s where s.id=v_sid and s.user_id=v_uid
    and (s.not_after is null or s.not_after>clock_timestamp())) then
    raise exception 'spectator_session_unavailable' using errcode='42501';
  end if;
  if p_require_eligible and not battle_spectator_private.eligible(v_uid) then
    raise exception 'spectator_battle_access_required' using errcode='42501';
  end if;
  return v_sid;
end $$;
create function battle_spectator_private.authorized(p_match uuid,p_uid uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.battle_matches m where m.id=p_match
    and p_uid is distinct from m.host_id and p_uid is distinct from m.guest_id
    and p_uid is distinct from m.moderator_id
    and (m.visibility='public' or (m.visibility='private' and exists (
      select 1 from battle_spectator_private.links l
      join battle_spectator_private.grants g on g.match_id=l.match_id and g.generation=l.generation
      where l.match_id=m.id and l.enabled and g.user_id=p_uid))));
$$;
create function battle_spectator_private.viewer_count(p_match uuid) returns integer
language sql volatile set search_path = '' as $$
  select count(distinct p.user_id)::integer from battle_spectator_private.presence p
  join auth.sessions s on s.id=p.session_id and s.user_id=p.user_id
  join public.battle_matches m on m.id=p.match_id
  where p.match_id=p_match and p.expires_at>clock_timestamp()
    and (s.not_after is null or s.not_after>clock_timestamp())
    and m.status in ('waiting','ready','live','dispute')
    and battle_spectator_private.eligible(p.user_id)
    and battle_spectator_private.authorized(p_match,p.user_id);
$$;
-- Explicit allowlist, never to_jsonb(match), SELECT * response or player codes.
create function battle_spectator_private.snapshot(p_match uuid) returns jsonb
language sql volatile set search_path = '' as $$
  select jsonb_build_object('id',m.id,'title',m.title,'tcg',m.tcg,'mode',m.mode,
    'visibility',m.visibility,'language',m.language,'status',m.status,
    'host_name',m.host_display_name,'guest_name',m.guest_display_name,
    'host_ready',m.host_ready,'guest_ready',m.guest_ready,
    'paused',coalesce(m.moderation_state='paused',false) or m.paused_at is not null,
    'moderator_present',m.moderator_id is not null,
    'result',case when m.status='completed' then case when m.winner_id=m.host_id then 'host'
      when m.winner_id=m.guest_id then 'guest' else 'draw' end else null end,
    'started_at',m.started_at,'completed_at',m.completed_at,
    'spectator_count',battle_spectator_private.viewer_count(m.id))
  from public.battle_matches m where m.id=p_match;
$$;

create function public.list_battle_spectator_matches(p_tcg text default 'pokemon') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform battle_spectator_private.actor_session();
  if p_tcg is null or p_tcg not in ('pokemon','one_piece') then raise exception 'spectator_invalid_tcg'; end if;
  select coalesce(jsonb_agg(battle_spectator_private.snapshot(q.id) order by q.created_at desc),'[]'::jsonb)
    into v_result from (select m.id,m.created_at from public.battle_matches m
      where m.visibility='public' and m.status in ('waiting','ready','live','dispute')
        and m.tcg=p_tcg and auth.uid() is distinct from m.host_id
        and auth.uid() is distinct from m.guest_id and auth.uid() is distinct from m.moderator_id
      order by m.created_at desc,m.id limit 100) q;
  return v_result;
end $$;

create function public.join_battle_spectator(p_match_id uuid,p_tab_id uuid,p_code text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_sid uuid; v_uid uuid := auth.uid(); v_id uuid := p_match_id;
  v_match public.battle_matches%rowtype; v_link battle_spectator_private.links%rowtype;
  v_code text := nullif(upper(trim(p_code)),''); v_expiry timestamptz;
begin
  v_sid := battle_spectator_private.actor_session();
  if p_tab_id is null then raise exception 'spectator_invalid_tab'; end if;
  if v_code is not null and v_code !~ '^SP-[0-9A-F]{64}$' then
    raise exception 'spectator_unavailable' using errcode='42501'; end if;
  if v_id is null and v_code is not null then
    select l.match_id into v_id from battle_spectator_private.links l
      where l.enabled and l.secret_hash=encode(sha256(convert_to(v_code,'UTF8')),'hex');
  end if;
  -- Same-user tab limits and join/leave requests serialize; match lock prevents role races.
  perform pg_advisory_xact_lock(hashtextextended('battle:spectator:'||v_uid::text,0));
  select * into v_match from public.battle_matches where id=v_id for share;
  if not found or v_match.status not in ('waiting','ready','live','dispute') then
    raise exception 'spectator_unavailable' using errcode='42501'; end if;
  if v_uid=v_match.host_id or v_uid=v_match.guest_id or v_uid=v_match.moderator_id then
    raise exception 'spectator_role_conflict' using errcode='42501'; end if;
  if v_match.visibility='private' then
    select * into v_link from battle_spectator_private.links where match_id=v_id;
    if v_code is not null then
      if not coalesce(v_link.enabled,false) or v_link.secret_hash is distinct from encode(sha256(convert_to(v_code,'UTF8')),'hex') then
        raise exception 'spectator_unavailable' using errcode='42501'; end if;
      insert into battle_spectator_private.grants(match_id,user_id,generation)
        values(v_id,v_uid,v_link.generation) on conflict(match_id,user_id)
        do update set generation=excluded.generation;
    end if;
  elsif v_code is not null then
    raise exception 'spectator_unavailable' using errcode='42501';
  end if;
  if not battle_spectator_private.authorized(v_id,v_uid) then
    raise exception 'spectator_unavailable' using errcode='42501'; end if;
  delete from battle_spectator_private.presence where user_id=v_uid and expires_at<=clock_timestamp();
  if not exists(select 1 from battle_spectator_private.presence where match_id=v_id and user_id=v_uid and session_id=v_sid and tab_id=p_tab_id)
    and (select count(*) from battle_spectator_private.presence where user_id=v_uid)>=8 then
    raise exception 'spectator_tab_limit'; end if;
  v_expiry := clock_timestamp()+interval '75 seconds';
  insert into battle_spectator_private.presence(match_id,user_id,session_id,tab_id,expires_at)
    values(v_id,v_uid,v_sid,p_tab_id,v_expiry)
    on conflict(match_id,user_id,session_id,tab_id) do update set expires_at=excluded.expires_at;
  return jsonb_build_object('match',battle_spectator_private.snapshot(v_id),'lease_expires_at',v_expiry,'heartbeat_seconds',20);
end $$;

create function public.heartbeat_battle_spectator(p_match_id uuid,p_tab_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_sid uuid; v_uid uuid:=auth.uid(); v_status text; v_expiry timestamptz; v_result jsonb;
begin
  v_sid := battle_spectator_private.actor_session();
  perform pg_advisory_xact_lock(hashtextextended('battle:spectator:'||v_uid::text,0));
  select status into v_status from public.battle_matches where id=p_match_id for share;
  if not found or not battle_spectator_private.authorized(p_match_id,v_uid) then
    raise exception 'spectator_unavailable' using errcode='42501'; end if;
  select expires_at into v_expiry from battle_spectator_private.presence
    where match_id=p_match_id and user_id=v_uid and session_id=v_sid and tab_id=p_tab_id for update;
  if not found or v_expiry<=clock_timestamp() then
    raise exception 'spectator_presence_expired' using errcode='42501'; end if;
  if v_status in ('waiting','ready','live','dispute') then
    v_expiry := clock_timestamp()+interval '75 seconds';
    update battle_spectator_private.presence set expires_at=v_expiry
      where match_id=p_match_id and user_id=v_uid and session_id=v_sid and tab_id=p_tab_id;
  else
    delete from battle_spectator_private.presence
      where match_id=p_match_id and user_id=v_uid and session_id=v_sid and tab_id=p_tab_id;
    v_expiry := null;
  end if;
  v_result := battle_spectator_private.snapshot(p_match_id);
  return jsonb_build_object('match',v_result,'lease_expires_at',v_expiry,'heartbeat_seconds',20);
end $$;

create function public.leave_battle_spectator(p_match_id uuid,p_tab_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_sid uuid;
begin
  v_sid := battle_spectator_private.actor_session(false);
  perform pg_advisory_xact_lock(hashtextextended('battle:spectator:'||auth.uid()::text,0));
  delete from battle_spectator_private.presence where match_id=p_match_id and user_id=auth.uid()
    and session_id=v_sid and tab_id=p_tab_id;
end $$;

create function public.get_battle_spectator_status(p_match_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_match public.battle_matches%rowtype;
begin
  perform battle_spectator_private.actor_session();
  select * into v_match from public.battle_matches where id=p_match_id;
  if not found or (auth.uid() is distinct from v_match.host_id and auth.uid() is distinct from v_match.guest_id
      and auth.uid() is distinct from v_match.moderator_id) then
    raise exception 'spectator_status_for_participants_only' using errcode='42501'; end if;
  return jsonb_build_object('spectator_count',battle_spectator_private.viewer_count(p_match_id),
    'link_enabled',coalesce((select enabled from battle_spectator_private.links where match_id=p_match_id),false));
end $$;

create function public.set_battle_spectator_link(p_match_id uuid,p_enabled boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_match public.battle_matches%rowtype; v_code text; v_generation uuid:=gen_random_uuid();
begin
  perform battle_spectator_private.actor_session();
  select * into v_match from public.battle_matches where id=p_match_id for update;
  if not found or v_match.host_id is distinct from auth.uid() or v_match.visibility<>'private'
     or v_match.status not in ('waiting','ready','live','dispute') or p_enabled is null then
    raise exception 'spectator_link_host_only' using errcode='42501'; end if;
  if p_enabled then v_code:='SP-'||upper(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','')); end if;
  insert into battle_spectator_private.links(match_id,generation,secret_hash,enabled)
    values(p_match_id,v_generation,case when p_enabled then encode(sha256(convert_to(v_code,'UTF8')),'hex') end,p_enabled)
    on conflict(match_id) do update set generation=excluded.generation,secret_hash=excluded.secret_hash,
      enabled=excluded.enabled,updated_at=clock_timestamp();
  -- Immediate revocation, including existing viewers. No player field is changed.
  delete from battle_spectator_private.grants where match_id=p_match_id;
  delete from battle_spectator_private.presence where match_id=p_match_id;
  return jsonb_build_object('match_id',p_match_id,'enabled',p_enabled,'code',v_code);
end $$;

-- A staff account choosing spectator mode must leave before assuming a player/judge role.
-- Additive trigger: the existing two-player and moderation functions stay unchanged.
create function battle_spectator_private.guard_match_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and exists(select 1 from battle_spectator_private.presence p
    join auth.sessions s on s.id=p.session_id and s.user_id=p.user_id
    where p.match_id=old.id and p.user_id=auth.uid() and p.expires_at>clock_timestamp()
      and (s.not_after is null or s.not_after>clock_timestamp())) then
    raise exception 'spectator_read_only_leave_first' using errcode='42501';
  end if;
  return new;
end $$;
create trigger battle_spectator_read_only before update on public.battle_matches
  for each row execute function battle_spectator_private.guard_match_write();

-- Existing browser TRUNCATE/DDL-related grants bypass row-level intent; P2P SELECT/INSERT stay intact.
revoke truncate, references, trigger on public.battle_matches, public.battle_signals from public, anon, authenticated;
revoke all on all functions in schema battle_spectator_private from public, anon, authenticated;
revoke all on function public.list_battle_spectator_matches(text),public.join_battle_spectator(uuid,uuid,text),
  public.heartbeat_battle_spectator(uuid,uuid),public.leave_battle_spectator(uuid,uuid),
  public.get_battle_spectator_status(uuid),public.set_battle_spectator_link(uuid,boolean) from public, anon;
grant execute on function public.list_battle_spectator_matches(text),public.join_battle_spectator(uuid,uuid,text),
  public.heartbeat_battle_spectator(uuid,uuid),public.leave_battle_spectator(uuid,uuid),
  public.get_battle_spectator_status(uuid),public.set_battle_spectator_link(uuid,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
