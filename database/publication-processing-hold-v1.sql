-- D4-V1 branch candidate. Apply after closed D3. No live application.
begin;

create or replace function dv_market_private.d4_battle_targets_publishable(p_users uuid[])
returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.profiles p
   where p.id=any(p_users) and p.data_processing_restricted_at is not null);
$$;
revoke all on function dv_market_private.d4_battle_targets_publishable(uuid[]) from public,anon,authenticated,service_role;
grant execute on function dv_market_private.d4_battle_targets_publishable(uuid[]) to authenticated;

CREATE OR REPLACE FUNCTION public.get_public_battle_ratings(p_username text)
 RETURNS TABLE(tcg text, rating integer, games integer, wins integer, losses integer, draws integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.tcg,r.rating,r.games,r.wins,r.losses,r.draws
  from public.battle_ratings r
  join public.profiles p on p.id=r.user_id
  where lower(p.username)=lower(trim(p_username))
    and coalesce(p.account_status,'active') not in ('suspended','deleted')
      and p.data_processing_restricted_at is null
  order by r.tcg;
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_battle_ranked_profile(p_username text)
 RETURNS TABLE(tcg text, rating integer, games integer, wins integer, losses integer, draws integer, global_rank bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with all_ranked as (
    select
      r.user_id,
      r.tcg,
      r.rating,
      r.games,
      r.wins,
      r.losses,
      r.draws,
      rank() over(partition by r.tcg order by r.rating desc, r.wins desc, r.games asc, r.updated_at asc) as global_rank
    from public.battle_ratings r
    join public.profiles p on p.id=r.user_id
    where r.games>0
      and p.username is not null
      and coalesce(p.account_status,'active') not in ('suspended','deleted')
      and p.data_processing_restricted_at is null
  )
  select a.tcg,a.rating,a.games,a.wins,a.losses,a.draws,a.global_rank
  from all_ranked a
  join public.profiles p on p.id=a.user_id
  where lower(p.username)=lower(trim(p_username))
  order by a.tcg;
$function$
;

CREATE OR REPLACE FUNCTION public.get_battle_leaderboard(p_tcg text, p_limit integer DEFAULT 100)
 RETURNS TABLE(place bigint, username text, display_name text, founder_number integer, role text, rating integer, games integer, wins integer, losses integer, draws integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with ranked as (
    select
      rank() over(order by r.rating desc, r.wins desc, r.games asc, r.updated_at asc) as place,
      p.username,
      p.display_name,
      p.founder_number,
      p.role,
      r.rating,
      r.games,
      r.wins,
      r.losses,
      r.draws
    from public.battle_ratings r
    join public.profiles p on p.id=r.user_id
    where r.tcg=p_tcg
      and r.games>0
      and p.username is not null
      and coalesce(p.account_status,'active') not in ('suspended','deleted')
      and p.data_processing_restricted_at is null
  )
  select * from ranked
  order by place, username
  limit greatest(1, least(coalesce(p_limit,100),250));
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_battle_recent(p_username text, p_limit integer DEFAULT 5)
 RETURNS TABLE(match_id uuid, tcg text, mode text, result text, completed_at timestamp with time zone, opponent_username text, opponent_display_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with target as (
    select id
    from public.profiles
    where lower(username)=lower(trim(p_username))
      and coalesce(account_status,'active') not in ('suspended','deleted')
      and data_processing_restricted_at is null
    limit 1
  ), base as (
    select m.*,
           t.id as target_id,
           case when t.id=m.host_id then m.guest_id else m.host_id end as opponent_id,
           case
             when m.winner_id is null then 'draw'
             when m.winner_id=t.id then 'win'
             else 'loss'
           end as result
    from public.battle_matches m
    join target t on t.id in (m.host_id,m.guest_id)
    where m.status='completed'
      and m.completed_at is not null
      and dv_market_private.d4_battle_targets_publishable(array[m.host_id,m.guest_id,m.moderator_id,m.paused_by,m.winner_id])
  )
  select b.id as match_id,
         b.tcg,
         b.mode,
         b.result,
         b.completed_at,
         case when coalesce(op.account_status,'active') not in ('suspended','deleted') then op.username else null end as opponent_username,
         coalesce(
           case when coalesce(op.account_status,'active') not in ('suspended','deleted') then op.display_name else null end,
           case when b.target_id=b.host_id then b.guest_display_name else b.host_display_name end,
           'DUELVANTA Player'
         ) as opponent_display_name
  from base b
  left join public.profiles op on op.id=b.opponent_id
  order by b.completed_at desc
  limit greatest(1,least(coalesce(p_limit,5),20));
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_battle_stats(p_username text)
 RETURNS TABLE(tcg text, matches bigint, wins bigint, losses bigint, draws bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with target as (
    select id from public.profiles
    where lower(username)=lower(trim(p_username))
      and coalesce(account_status,'active') not in ('suspended','deleted')
      and data_processing_restricted_at is null
    limit 1
  ), played as (
    select m.*, t.id as player_id
    from public.battle_matches m
    join target t on t.id in (m.host_id,m.guest_id)
    where m.status='completed' and m.completed_at is not null
      and dv_market_private.d4_battle_targets_publishable(array[m.host_id,m.guest_id,m.moderator_id,m.paused_by,m.winner_id])
  )
  select p.tcg,
         count(*)::bigint as matches,
         count(*) filter (where p.winner_id=p.player_id)::bigint as wins,
         count(*) filter (where p.winner_id is not null and p.winner_id<>p.player_id)::bigint as losses,
         count(*) filter (where p.winner_id is null)::bigint as draws
  from played p
  group by p.tcg
  order by p.tcg;
$function$
;

-- RESTRICTIVE intersects both historical permissive SELECT policies.
-- Existing own/Staff predicates are repeated only as exemptions from this
-- additional public-target filter; this policy cannot grant any new row.
drop policy if exists d4_battle_public_target_hold on public.battle_matches;
create policy d4_battle_public_target_hold on public.battle_matches as restrictive
for select to authenticated using (
 host_id=auth.uid() or guest_id=auth.uid()
 or (public.has_duelvanta_privileged_session() and
     (moderator_id=auth.uid() or exists(select 1 from public.profiles p
       where p.id=auth.uid() and p.role in ('owner','admin','judge'))))
 or dv_market_private.d4_battle_targets_publishable(array[host_id,guest_id,moderator_id,paused_by,winner_id])
);

-- Public identity remains readable; freeze its actual public inputs under H.
-- No actor/role/GUC bypass. Private/local profile fields and safety decisions
-- keep their existing rules. Visibility can narrow, never expand.
create or replace function dv_market_private.d4_protect_public_profile()
returns trigger language plpgsql security invoker set search_path=pg_catalog as $$
begin
 if old.data_processing_restricted_at is not null or new.data_processing_restricted_at is not null then
  if row(new.username,new.display_name,new.avatar_path,new.founder_number,new.founder_generation,new.founder_since,new.created_at)
     is distinct from row(old.username,old.display_name,old.avatar_path,old.founder_number,old.founder_generation,old.founder_since,old.created_at)
     or (new.collection_visibility is distinct from old.collection_visibility
         and not (new.collection_visibility='private' or
                  (old.collection_visibility='public' and new.collection_visibility='custom')))
     or (old.account_status in ('suspended','deleted') and
         new.account_status is distinct from old.account_status and new.account_status not in ('suspended','deleted')) then
   raise exception 'account_publication_processing_restricted' using errcode='42501';
  end if;
 end if;
 return new;
end$$;
revoke all on function dv_market_private.d4_protect_public_profile() from public,anon,authenticated,service_role;
drop trigger if exists d4_protect_public_profile on public.profiles;
create trigger d4_protect_public_profile before update on public.profiles
for each row execute function dv_market_private.d4_protect_public_profile();

-- Existing collection actor guards stay intact; additionally bind inserts /
-- updates to their actual owners so a different internal actor cannot expand
-- held public content. No DELETE/retention rule, no storage policy.
create or replace function dv_market_private.d4_protect_collection_publication()
returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid; held timestamptz; owners uuid[];
begin
 owners:=array[new.user_id];
 if tg_op='UPDATE' then owners:=owners||old.user_id; end if;
 for u in select p.id from public.profiles p where p.id=any(owners) order by p.id loop
  select p.data_processing_restricted_at into held from public.profiles p where p.id=u for no key update;
  if held is not null then raise exception 'account_publication_processing_restricted' using errcode='42501'; end if;
 end loop;
 return new;
end$$;
revoke all on function dv_market_private.d4_protect_collection_publication() from public,anon,authenticated,service_role;
drop trigger if exists d4_protect_collection_publication on public.collection_items;
create trigger d4_protect_collection_publication before insert or update on public.collection_items
for each row execute function dv_market_private.d4_protect_collection_publication();
drop trigger if exists d4_protect_collection_publication on public.collection_folders;
create trigger d4_protect_collection_publication before insert or update on public.collection_folders
for each row execute function dv_market_private.d4_protect_collection_publication();

CREATE OR REPLACE FUNCTION public.list_battle_spectator_matches(p_tcg text DEFAULT 'pokemon'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_result jsonb;
begin
  perform battle_spectator_private.actor_session();
  if p_tcg is null or p_tcg not in ('pokemon','one_piece') then raise exception 'spectator_invalid_tcg'; end if;
  select coalesce(jsonb_agg(battle_spectator_private.snapshot(q.id) order by q.created_at desc),'[]'::jsonb)
    into v_result from (select m.id,m.created_at from public.battle_matches m
      where m.visibility='public' and m.status in ('waiting','ready','live','dispute')
        and dv_market_private.d4_battle_targets_publishable(array[m.host_id,m.guest_id,m.moderator_id,m.paused_by,m.winner_id])
        and m.tcg=p_tcg and auth.uid() is distinct from m.host_id
        and auth.uid() is distinct from m.guest_id and auth.uid() is distinct from m.moderator_id
      order by m.created_at desc,m.id limit 100) q;
  return v_result;
end $function$
;

CREATE OR REPLACE FUNCTION battle_spectator_private.snapshot(p_match uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
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
  from public.battle_matches m where m.id=p_match
    and dv_market_private.d4_battle_targets_publishable(array[m.host_id,m.guest_id,m.moderator_id,m.paused_by,m.winner_id]);
$function$
;

-- Serialize authenticated image writes with target Hold; policies are a separate
-- Storage-schema candidate, never an object mutation.
create or replace function dv_market_private.d4_image_write_allowed(p_bucket text,p_name text)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare h timestamptz;
begin
 if p_bucket not in ('profile-avatars','collection-cards') then return true; end if;
 if auth.uid() is null or split_part(p_name,'/',1)<>auth.uid()::text then return false; end if;
 select data_processing_restricted_at into h from public.profiles where id=auth.uid() for no key update;
 return found and h is null;
end$$;
revoke all on function dv_market_private.d4_image_write_allowed(text,text) from public,anon,authenticated,service_role;
grant execute on function dv_market_private.d4_image_write_allowed(text,text) to authenticated;

commit;
