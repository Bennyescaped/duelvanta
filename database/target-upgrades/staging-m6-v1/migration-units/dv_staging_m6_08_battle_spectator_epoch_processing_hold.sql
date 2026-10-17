-- T3/D2 reviewed offline candidate, after G1-G5/D1/T2. No provider/media action.
begin;
-- Internal queue handoff only. Caller owns the match lock before the epoch lock.
-- Unlike normal close_epoch, a held epoch gets no replacement ID or row.
create or replace function battle_spectator_media_private.close_epoch_for_processing_hold(p_match uuid)
returns void language plpgsql security definer set search_path='' as $$
declare e battle_spectator_media_private.epochs%rowtype;
begin
  select * into e from battle_spectator_media_private.epochs where match_id=p_match for update;
  if found and e.media_open then
    insert into battle_spectator_media_private.revocations(match_id,epoch,reason)
      values(p_match,e.epoch,'processing_hold') on conflict do nothing;
    update battle_spectator_media_private.epochs set media_open=false,updated_at=clock_timestamp()
      where match_id=p_match;
  end if;
end $$;
revoke all on function battle_spectator_media_private.close_epoch_for_processing_hold(uuid) from public,anon,authenticated,service_role;

create or replace function battle_spectator_media_private.restrict_player_epochs_on_hold()
returns trigger language plpgsql security definer set search_path='' as $$
declare m record;
begin
  -- Lock *all* current-player matches, including missing epochs; serialize creation as well.
  -- No profile lock is acquired here: the UPDATE already owns NEW.id's profile row.
  for m in select id from public.battle_matches where host_id=new.id or guest_id=new.id order by id for update loop
    perform battle_spectator_media_private.close_epoch_for_processing_hold(m.id);
  end loop;
  return new;
end $$;
revoke all on function battle_spectator_media_private.restrict_player_epochs_on_hold() from public,anon,authenticated,service_role;
drop trigger if exists battle_spectator_epoch_processing_hold on public.profiles;
create trigger battle_spectator_epoch_processing_hold
  after update of data_processing_restricted_at on public.profiles
  for each row when (old.data_processing_restricted_at is null and new.data_processing_restricted_at is not null)
  execute function battle_spectator_media_private.restrict_player_epochs_on_hold();

create or replace function battle_spectator_media_private.sync_epoch(p_match uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.battle_matches%rowtype;c battle_spectator_media_private.config%rowtype;
  g uuid;o boolean;e battle_spectator_media_private.epochs%rowtype;
begin
  -- Consistent lock order with Hold and D1: match, then epoch. Never lock peer profiles here.
  select * into m from public.battle_matches where id=p_match for update;
  if not found then raise exception 'spectator_media_unavailable' using errcode='42501';end if;
  select * into c from battle_spectator_media_private.config where singleton;
  if exists(select 1 from public.profiles p where p.id in(m.host_id,m.guest_id) and p.data_processing_restricted_at is not null) then
    perform battle_spectator_media_private.close_epoch_for_processing_hold(p_match);
    select * into e from battle_spectator_media_private.epochs where match_id=p_match;
    return jsonb_build_object('media_open',false,'epoch',e.epoch,
      'max_viewers_per_match',c.max_viewers_per_match,'consent_version',c.consent_version);
  end if;
  select generation into g from battle_spectator_private.links where match_id=p_match and enabled;
  o:=c.media_enabled and m.guest_id is not null and m.status in('waiting','ready','live')
    and m.moderation_state is distinct from 'paused' and m.paused_at is null
    and exists(select 1 from battle_spectator_media_private.consents x where x.match_id=p_match and x.user_id=m.host_id and x.granted and x.consent_version=c.consent_version)
    and exists(select 1 from battle_spectator_media_private.consents x where x.match_id=p_match and x.user_id=m.guest_id and x.granted and x.consent_version=c.consent_version)
    and (m.visibility='public' or g is not null);
  select * into e from battle_spectator_media_private.epochs where match_id=p_match for update;
  if not found then
    insert into battle_spectator_media_private.epochs(match_id,generation,media_open) values(p_match,g,o) returning * into e;
  elsif exists(select 1 from battle_spectator_media_private.revocations r where r.match_id=p_match and r.epoch=e.epoch and r.reason='processing_hold') then
    -- Defensive reuse boundary only: no unhold endpoint is introduced. Normal eligibility above
    -- must already be restored by an existing trusted path before a new open epoch is possible.
    if o then
      update battle_spectator_media_private.epochs set epoch=gen_random_uuid(),generation=g,media_open=true,updated_at=clock_timestamp()
        where match_id=p_match returning * into e;
    end if;
  elsif e.generation is distinct from g or(e.media_open and not o) then
    perform battle_spectator_media_private.close_epoch(p_match,case when e.generation is distinct from g then 'generation_changed' else 'media_closed' end);
    update battle_spectator_media_private.epochs set generation=g,media_open=o where match_id=p_match returning * into e;
  elsif e.media_open is distinct from o then
    update battle_spectator_media_private.epochs set media_open=o where match_id=p_match returning * into e;
  end if;
  return jsonb_build_object('media_open',e.media_open,'epoch',e.epoch,
    'max_viewers_per_match',c.max_viewers_per_match,'consent_version',c.consent_version);
end $$;
-- Existing sync ACL/owner preserved. No public signature, table, policy, or provider change.
notify pgrst,'reload schema';
commit;
