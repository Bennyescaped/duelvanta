-- T3/D1: own existing withdrawal only. Reviewed offline candidate; never a live migration.
-- Prerequisites: P0-02/P0-05, T2, G1-G5. Existing signatures, ACLs and helpers retained.
begin;
create or replace function public.set_battle_spectator_link(p_match_id uuid,p_enabled boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare m public.battle_matches%rowtype; held boolean; changed boolean:=false; v_code text;
begin
  perform battle_spectator_private.actor_session(false);
  -- Serialize with marker/Closure writes. Recheck eligibility after any lock wait.
  select p.data_processing_restricted_at is not null into held from public.profiles p where p.id=auth.uid() for share;
  if p_enabled is distinct from false or not coalesce(held,false) then
    perform battle_spectator_private.actor_session();
  end if;
  select * into m from public.battle_matches where id=p_match_id for update;
  perform battle_spectator_private.actor_session(false);
  if m.id is null or m.host_id is distinct from auth.uid() or m.visibility<>'private'
     or m.status not in ('waiting','ready','live','dispute') or p_enabled is null then
    raise exception 'spectator_link_host_only' using errcode='42501'; end if;
  if p_enabled then
    v_code:='SP-'||upper(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''));
    insert into battle_spectator_private.links(match_id,generation,secret_hash,enabled)
      values(p_match_id,gen_random_uuid(),encode(sha256(convert_to(v_code,'UTF8')),'hex'),true)
      on conflict(match_id) do update set generation=excluded.generation,secret_hash=excluded.secret_hash,
        enabled=true,updated_at=clock_timestamp();
  else
    -- No missing-state insertion, no generation churn on replay.
    update battle_spectator_private.links set enabled=false,secret_hash=null,generation=gen_random_uuid(),updated_at=clock_timestamp()
      where match_id=p_match_id and enabled;
    changed:=found;
    -- Includes a previously disabled legacy link whose old open epoch was not yet synced.
    if exists(select 1 from battle_spectator_private.links where match_id=p_match_id)
       and exists(select 1 from battle_spectator_media_private.epochs where match_id=p_match_id and media_open) then
      perform battle_spectator_media_private.close_epoch(p_match_id,'generation_changed');
    end if;
    if exists(select 1 from battle_spectator_private.links where match_id=p_match_id) then
      update battle_spectator_media_private.epochs set generation=null where match_id=p_match_id and generation is not null;
    end if;
  end if;
  -- Existing link cleanup. No Match/Auth/Signal deletion, no external media action.
  delete from battle_spectator_private.grants where match_id=p_match_id;
  delete from battle_spectator_private.presence where match_id=p_match_id;
  return jsonb_build_object('match_id',p_match_id,'enabled',p_enabled,'code',v_code)
    ||case when not p_enabled then jsonb_build_object('withdrawn',changed) else '{}'::jsonb end;
end $$;

create or replace function public.set_battle_spectator_media_consent(p_match_id uuid,p_granted boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.battle_matches%rowtype; c battle_spectator_media_private.config%rowtype;
  e battle_spectator_media_private.epochs%rowtype; held boolean; changed boolean:=false; g uuid;
begin
  perform battle_spectator_private.actor_session(false);
  select p.data_processing_restricted_at is not null into held from public.profiles p where p.id=auth.uid() for share;
  if p_granted is distinct from false or not coalesce(held,false) then
    perform battle_spectator_private.actor_session();
  end if;
  if p_granted is null then raise exception 'spectator_media_invalid_consent';end if;
  -- Both setters use the same exclusive match lock, also serializing host/guest withdrawal.
  select * into m from public.battle_matches where id=p_match_id for update;
  perform battle_spectator_private.actor_session(false);
  if m.id is null or (auth.uid() is distinct from m.host_id and auth.uid() is distinct from m.guest_id)
     or m.status not in('waiting','ready','live') then
    raise exception 'spectator_media_player_only' using errcode='42501';end if;
  select * into c from battle_spectator_media_private.config where singleton;
  if p_granted then
    insert into battle_spectator_media_private.consents values(p_match_id,auth.uid(),c.consent_version,true,clock_timestamp())
      on conflict(match_id,user_id) do update set consent_version=excluded.consent_version,granted=true,updated_at=excluded.updated_at;
    return battle_spectator_media_private.sync_epoch(p_match_id);
  end if;
  update battle_spectator_media_private.consents set granted=false,consent_version=c.consent_version,updated_at=clock_timestamp()
    where match_id=p_match_id and user_id=auth.uid() and granted;
  changed:=found;
  select * into e from battle_spectator_media_private.epochs where match_id=p_match_id for update;
  if changed and e.media_open then
    perform battle_spectator_media_private.close_epoch(p_match_id,'player_withdrawal');
    -- close_epoch clears generation; retain the actual link generation before sync to avoid
    -- revoking a never-open intermediate epoch. The match lock protects the link generation.
    select generation into g from battle_spectator_private.links where match_id=p_match_id and enabled;
    update battle_spectator_media_private.epochs set generation=g where match_id=p_match_id;
    return battle_spectator_media_private.sync_epoch(p_match_id)||jsonb_build_object('withdrawn',true);
  end if;
  -- No sync for missing/closed/replayed state: it would create/rotate an unnecessary epoch.
  return jsonb_build_object('media_open',coalesce(e.media_open,false),'epoch',e.epoch,
    'max_viewers_per_match',c.max_viewers_per_match,'consent_version',c.consent_version,'withdrawn',changed);
end $$;
-- CREATE OR REPLACE retains existing owner, EXECUTE ACL and signatures. No new endpoint.
notify pgrst,'reload schema';
commit;
