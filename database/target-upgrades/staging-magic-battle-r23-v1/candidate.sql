-- R23 isolated candidate: no hosted apply authorized. No data/config/ACL writes.
alter table public.battle_matches drop constraint battle_matches_tcg_check;
alter table public.battle_matches add constraint battle_matches_tcg_check check (tcg in ('pokemon','one_piece','magic'));
alter table public.battle_matches add constraint battle_matches_magic_casual_check check (tcg <> 'magic' or mode = 'casual');
CREATE OR REPLACE FUNCTION public.create_battle_match_v2(p_tcg text, p_visibility text DEFAULT 'public'::text, p_title text DEFAULT NULL::text, p_language text DEFAULT 'de'::text, p_mode text DEFAULT 'casual'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid; v_profile public.profiles; v_code text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_tcg not in ('pokemon','one_piece','magic') then raise exception 'Ungültiges TCG'; end if;
  if p_visibility not in ('public','private') then raise exception 'Ungültige Sichtbarkeit'; end if;
  if p_mode not in ('casual','ranked') then raise exception 'Ungültiger Modus'; end if;
  if p_mode='ranked' and p_visibility<>'public' then raise exception 'Ranked Matches sind in der Beta nur öffentlich'; end if;

  if p_tcg='magic' and p_mode is distinct from 'casual' then raise exception 'magic_battle_casual_only'; end if;

  select * into v_profile from public.profiles where id=auth.uid() for share;
  if v_profile.id is null then raise exception 'Profil nicht gefunden'; end if;
  if coalesce(v_profile.account_status,'beta') not in ('beta','active') then raise exception 'Account ist nicht aktiv'; end if;
  if coalesce(v_profile.safety_restricted,false) then raise exception 'BATTLE ist für diesen Account eingeschränkt'; end if;
  if v_profile.data_processing_restricted_at is not null then
    raise exception 'account_data_processing_restricted' using errcode='42501';
  end if;

  if p_tcg='magic' and not battle_spectator_private.eligible(auth.uid()) then raise exception 'magic_battle_access_required' using errcode='42501'; end if;

  if exists(select 1 from public.battle_matches where (host_id=auth.uid() or guest_id=auth.uid()) and status in ('waiting','ready','live','dispute')) then
    raise exception 'Du hast bereits ein aktives Match';
  end if;

  if p_visibility='private' then v_code:=upper(substr(md5(gen_random_uuid()::text),1,6)); end if;
  insert into public.battle_matches(host_id,tcg,mode,visibility,invite_code,title,language,host_display_name,host_founder_number)
  values(auth.uid(),p_tcg,p_mode,p_visibility,v_code,nullif(trim(p_title),''),coalesce(nullif(p_language,''),'de'),coalesce(v_profile.display_name,v_profile.username,'DUELVANTA Player'),v_profile.founder_number)
  returning id into v_id;
  return v_id;
end
$function$
;

CREATE OR REPLACE FUNCTION public.join_battle_match(p_match_id uuid DEFAULT NULL::uuid, p_invite_code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_match public.battle_matches; v_profile public.profiles;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 -- Keep the existing actor/Safety boundary; serialize admission with Hold writes.
 perform 1 from public.profiles where id=auth.uid() for share;
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status in ('beta','active') and not coalesce(safety_restricted,false)) then raise exception 'battle_account_unavailable'; end if;
 if exists(select 1 from public.profiles where id=auth.uid() and data_processing_restricted_at is not null) then
   raise exception 'account_data_processing_restricted' using errcode='42501';
 end if;
 if p_match_id is not null then select * into v_match from public.battle_matches where id=p_match_id for update;
 else select * into v_match from public.battle_matches where invite_code=upper(trim(p_invite_code)) for update; end if;
 if v_match.id is null then raise exception 'Match nicht gefunden'; end if;
 if v_match.tcg='magic' and not battle_spectator_private.eligible(auth.uid()) then raise exception 'magic_battle_access_required' using errcode='42501'; end if;
 if v_match.host_id=auth.uid() then return v_match.id; end if;
 if v_match.status<>'waiting' or v_match.guest_id is not null then raise exception 'Match ist nicht mehr verfügbar'; end if;
 if v_match.visibility='private' and (p_invite_code is null or upper(trim(p_invite_code))<>v_match.invite_code) then raise exception 'Ungültiger Einladungscode'; end if;
 if exists(select 1 from public.battle_matches where (host_id=auth.uid() or guest_id=auth.uid()) and status in ('waiting','ready','live')) then raise exception 'Du hast bereits ein aktives Match'; end if;
 select * into v_profile from public.profiles where id=auth.uid();
 update public.battle_matches set guest_id=auth.uid(),guest_display_name=coalesce(v_profile.display_name,v_profile.username,'DUELVANTA Player'),guest_founder_number=v_profile.founder_number,status='ready',updated_at=now() where id=v_match.id;
 return v_match.id;
end $function$
;

CREATE OR REPLACE FUNCTION public.set_battle_ready(p_match_id uuid, p_ready boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v public.battle_matches; begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 -- Keep the existing actor/Safety boundary; serialize admission with Hold writes.
 perform 1 from public.profiles where id=auth.uid() for share;
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status in ('beta','active') and not coalesce(safety_restricted,false)) then raise exception 'battle_account_unavailable'; end if;
 if exists(select 1 from public.profiles where id=auth.uid() and data_processing_restricted_at is not null) then
   raise exception 'account_data_processing_restricted' using errcode='42501';
 end if;
 select * into v from public.battle_matches where id=p_match_id for update; if v.id is null or auth.uid() not in (v.host_id,coalesce(v.guest_id,v.host_id)) then raise exception 'Nicht erlaubt'; end if; if v.tcg='magic' and not battle_spectator_private.eligible(auth.uid()) then raise exception 'magic_battle_access_required' using errcode='42501'; end if; if v.moderation_state='paused' or v.paused_at is not null then raise exception 'Match ist durch die Moderation pausiert'; end if; if v.status not in ('waiting','ready') then raise exception 'Bereits gestartet'; end if; if auth.uid()=v.host_id then update public.battle_matches set host_ready=p_ready,updated_at=now() where id=v.id; else update public.battle_matches set guest_ready=p_ready,updated_at=now() where id=v.id; end if; end $function$
;

CREATE OR REPLACE FUNCTION public.start_battle_match(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v public.battle_matches; begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 -- Keep the existing actor/Safety boundary; serialize admission with Hold writes.
 perform 1 from public.profiles where id=auth.uid() for share;
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status in ('beta','active') and not coalesce(safety_restricted,false)) then raise exception 'battle_account_unavailable'; end if;
 if exists(select 1 from public.profiles where id=auth.uid() and data_processing_restricted_at is not null) then
   raise exception 'account_data_processing_restricted' using errcode='42501';
 end if;
 select * into v from public.battle_matches where id=p_match_id for update; if v.id is null or v.host_id<>auth.uid() then raise exception 'Nur der Host kann starten'; end if; if v.tcg='magic' and not battle_spectator_private.eligible(auth.uid()) then raise exception 'magic_battle_access_required' using errcode='42501'; end if; if v.moderation_state='paused' or v.paused_at is not null then raise exception 'Match ist durch die Moderation pausiert'; end if; if v.guest_id is null or not v.host_ready or not v.guest_ready then raise exception 'Beide Spieler müssen bereit sein'; end if; if v.status not in ('waiting','ready') then raise exception 'Match kann nicht gestartet werden'; end if; if v.tcg='magic' and (not battle_spectator_private.eligible(v.host_id) or not battle_spectator_private.eligible(v.guest_id)) then raise exception 'magic_battle_access_required' using errcode='42501'; end if; update public.battle_matches set status='live',started_at=now(),updated_at=now() where id=v.id; end $function$
;

CREATE OR REPLACE FUNCTION battle_spectator_private.authorized(p_match uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.battle_matches m where m.id=p_match and m.tcg in ('pokemon','one_piece')
    and p_uid is distinct from m.host_id and p_uid is distinct from m.guest_id
    and p_uid is distinct from m.moderator_id
    and (m.visibility='public' or (m.visibility='private' and exists (
      select 1 from battle_spectator_private.links l
      join battle_spectator_private.grants g on g.match_id=l.match_id and g.generation=l.generation
      where l.match_id=m.id and l.enabled and g.user_id=p_uid))));
$function$
;

CREATE OR REPLACE FUNCTION battle_spectator_media_private.sync_epoch(p_match uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  o:=m.tcg in ('pokemon','one_piece') and c.media_enabled and m.guest_id is not null and m.status in('waiting','ready','live')
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
end $function$
;

CREATE OR REPLACE FUNCTION public.set_battle_spectator_link(p_match_id uuid, p_enabled boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if m.tcg='magic' and p_enabled then raise exception 'magic_battle_spectators_disabled' using errcode='42501'; end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.set_battle_spectator_media_consent(p_match_id uuid, p_granted boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if m.tcg='magic' and p_granted then raise exception 'magic_battle_spectators_disabled' using errcode='42501'; end if;
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
end $function$
;
