-- BATTLE beta accounts are valid participants; suspended and safety-restricted accounts remain blocked.
begin;

CREATE OR REPLACE FUNCTION public.create_battle_match_v2(p_tcg text, p_visibility text DEFAULT 'public'::text, p_title text DEFAULT NULL::text, p_language text DEFAULT 'de'::text, p_mode text DEFAULT 'casual'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid; v_profile public.profiles; v_code text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_tcg not in ('pokemon','one_piece') then raise exception 'Ungültiges TCG'; end if;
  if p_visibility not in ('public','private') then raise exception 'Ungültige Sichtbarkeit'; end if;
  if p_mode not in ('casual','ranked') then raise exception 'Ungültiger Modus'; end if;
  if p_mode='ranked' and p_visibility<>'public' then raise exception 'Ranked Matches sind in der Beta nur öffentlich'; end if;

  select * into v_profile from public.profiles where id=auth.uid();
  if v_profile.id is null then raise exception 'Profil nicht gefunden'; end if;
  if coalesce(v_profile.account_status,'beta') not in ('beta','active') then raise exception 'Account ist nicht aktiv'; end if;
  if coalesce(v_profile.safety_restricted,false) then raise exception 'BATTLE ist für diesen Account eingeschränkt'; end if;

  if exists(select 1 from public.battle_matches where (host_id=auth.uid() or guest_id=auth.uid()) and status in ('waiting','ready','live','dispute')) then
    raise exception 'Du hast bereits ein aktives Match';
  end if;

  if p_visibility='private' then v_code:=upper(substr(md5(gen_random_uuid()::text),1,6)); end if;
  insert into public.battle_matches(host_id,tcg,mode,visibility,invite_code,title,language,host_display_name,host_founder_number)
  values(auth.uid(),p_tcg,p_mode,p_visibility,v_code,nullif(trim(p_title),''),coalesce(nullif(p_language,''),'de'),coalesce(v_profile.display_name,v_profile.username,'DUELVANTA Player'),v_profile.founder_number)
  returning id into v_id;
  return v_id;
end
$function$;

CREATE OR REPLACE FUNCTION public.join_battle_match(p_match_id uuid DEFAULT NULL::uuid, p_invite_code text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_match public.battle_matches; v_profile public.profiles;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status in ('beta','active') and not coalesce(safety_restricted,false)) then raise exception 'battle_account_unavailable'; end if;
 if p_match_id is not null then select * into v_match from public.battle_matches where id=p_match_id for update;
 else select * into v_match from public.battle_matches where invite_code=upper(trim(p_invite_code)) for update; end if;
 if v_match.id is null then raise exception 'Match nicht gefunden'; end if;
 if v_match.host_id=auth.uid() then return v_match.id; end if;
 if v_match.status<>'waiting' or v_match.guest_id is not null then raise exception 'Match ist nicht mehr verfügbar'; end if;
 if v_match.visibility='private' and (p_invite_code is null or upper(trim(p_invite_code))<>v_match.invite_code) then raise exception 'Ungültiger Einladungscode'; end if;
 if exists(select 1 from public.battle_matches where (host_id=auth.uid() or guest_id=auth.uid()) and status in ('waiting','ready','live')) then raise exception 'Du hast bereits ein aktives Match'; end if;
 select * into v_profile from public.profiles where id=auth.uid();
 update public.battle_matches set guest_id=auth.uid(),guest_display_name=coalesce(v_profile.display_name,v_profile.username,'DUELVANTA Player'),guest_founder_number=v_profile.founder_number,status='ready',updated_at=now() where id=v_match.id;
 return v_match.id;
end $function$;

CREATE OR REPLACE FUNCTION public.set_battle_ready(p_match_id uuid, p_ready boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ declare v public.battle_matches; begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status in ('beta','active') and not coalesce(safety_restricted,false)) then raise exception 'battle_account_unavailable'; end if;
 select * into v from public.battle_matches where id=p_match_id for update; if v.id is null or auth.uid() not in (v.host_id,coalesce(v.guest_id,v.host_id)) then raise exception 'Nicht erlaubt'; end if; if v.moderation_state='paused' or v.paused_at is not null then raise exception 'Match ist durch die Moderation pausiert'; end if; if v.status not in ('waiting','ready') then raise exception 'Bereits gestartet'; end if; if auth.uid()=v.host_id then update public.battle_matches set host_ready=p_ready,updated_at=now() where id=v.id; else update public.battle_matches set guest_ready=p_ready,updated_at=now() where id=v.id; end if; end $function$;

CREATE OR REPLACE FUNCTION public.start_battle_match(p_match_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ declare v public.battle_matches; begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status in ('beta','active') and not coalesce(safety_restricted,false)) then raise exception 'battle_account_unavailable'; end if;
 select * into v from public.battle_matches where id=p_match_id for update; if v.id is null or v.host_id<>auth.uid() then raise exception 'Nur der Host kann starten'; end if; if v.moderation_state='paused' or v.paused_at is not null then raise exception 'Match ist durch die Moderation pausiert'; end if; if v.guest_id is null or not v.host_ready or not v.guest_ready then raise exception 'Beide Spieler müssen bereit sein'; end if; if v.status not in ('waiting','ready') then raise exception 'Match kann nicht gestartet werden'; end if; update public.battle_matches set status='live',started_at=now(),updated_at=now() where id=v.id; end $function$;

revoke execute on function public.create_battle_match_v2(text,text,text,text,text) from public, anon;
grant execute on function public.create_battle_match_v2(text,text,text,text,text) to authenticated, service_role;
commit;
