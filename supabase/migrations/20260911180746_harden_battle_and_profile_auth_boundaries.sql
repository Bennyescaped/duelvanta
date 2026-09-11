-- Close anonymous mutation paths and SQL NULL authentication gaps.
-- No existing matches, profiles, orders or collection rows are changed.
begin;

CREATE OR REPLACE FUNCTION public.join_battle_match(p_match_id uuid DEFAULT NULL::uuid, p_invite_code text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_match public.battle_matches; v_profile public.profiles;
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status='active' and not coalesce(safety_restricted,false)) then raise exception 'battle_account_unavailable'; end if;

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
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v public.battle_matches; begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status='active' and not coalesce(safety_restricted,false)) then raise exception 'battle_account_unavailable'; end if;
 select * into v from public.battle_matches where id=p_match_id for update; if v.id is null or auth.uid() not in (v.host_id,coalesce(v.guest_id,v.host_id)) then raise exception 'Nicht erlaubt'; end if; if v.moderation_state='paused' or v.paused_at is not null then raise exception 'Match ist durch die Moderation pausiert'; end if; if v.status not in ('waiting','ready') then raise exception 'Bereits gestartet'; end if; if auth.uid()=v.host_id then update public.battle_matches set host_ready=p_ready,updated_at=now() where id=v.id; else update public.battle_matches set guest_ready=p_ready,updated_at=now() where id=v.id; end if; end $function$;

CREATE OR REPLACE FUNCTION public.start_battle_match(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v public.battle_matches; begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and account_status='active' and not coalesce(safety_restricted,false)) then raise exception 'battle_account_unavailable'; end if;
 select * into v from public.battle_matches where id=p_match_id for update; if v.id is null or v.host_id<>auth.uid() then raise exception 'Nur der Host kann starten'; end if; if v.moderation_state='paused' or v.paused_at is not null then raise exception 'Match ist durch die Moderation pausiert'; end if; if v.guest_id is null or not v.host_ready or not v.guest_ready then raise exception 'Beide Spieler müssen bereit sein'; end if; if v.status not in ('waiting','ready') then raise exception 'Match kann nicht gestartet werden'; end if; update public.battle_matches set status='live',started_at=now(),updated_at=now() where id=v.id; end $function$;

CREATE OR REPLACE FUNCTION public.report_battle_result(p_match_id uuid, p_result text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ declare v public.battle_matches; v_status text; begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if p_result not in ('host','guest','draw') then raise exception 'Ungültiges Ergebnis'; end if; select * into v from public.battle_matches where id=p_match_id for update; if v.id is null or auth.uid() not in (v.host_id,coalesce(v.guest_id,v.host_id)) then raise exception 'Nicht erlaubt'; end if; if v.moderation_state='paused' or v.paused_at is not null then raise exception 'Match ist durch die Moderation pausiert'; end if; if v.status not in ('live','dispute') then raise exception 'Match ist nicht aktiv'; end if; if auth.uid()=v.host_id then update public.battle_matches set host_result=p_result,updated_at=now() where id=v.id; else update public.battle_matches set guest_result=p_result,updated_at=now() where id=v.id; end if; select * into v from public.battle_matches where id=p_match_id for update; if v.host_result is not null and v.guest_result is not null then if v.host_result=v.guest_result then update public.battle_matches set status='completed',winner_id=case when v.host_result='host' then v.host_id when v.host_result='guest' then v.guest_id else null end,completed_at=now(),updated_at=now() where id=v.id; v_status:='completed'; else update public.battle_matches set status='dispute',updated_at=now() where id=v.id; v_status:='dispute'; end if; else v_status:='live'; end if; return v_status; end $function$;

create or replace function public.create_battle_match(p_tcg text, p_visibility text default 'public', p_title text default null, p_language text default 'de')
returns uuid language plpgsql security definer set search_path = '' as $function$
begin
 return public.create_battle_match_v2(p_tcg,p_visibility,p_title,p_language,'casual');
end
$function$;

CREATE OR REPLACE FUNCTION public.can_update_own_profile_safe(p_row profiles)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare old_row public.profiles;
begin
  select * into old_row from public.profiles where id = (select auth.uid());
  if not found then return false; end if;
  return p_row.id = old_row.id
    and p_row.email is not distinct from old_row.email
    and p_row.role is not distinct from old_row.role
    and p_row.safety_restricted is not distinct from old_row.safety_restricted
    and p_row.account_status is not distinct from old_row.account_status
    and p_row.founder_number is not distinct from old_row.founder_number
    and p_row.founder_generation is not distinct from old_row.founder_generation
    and p_row.founder_since is not distinct from old_row.founder_since
    and p_row.username is not distinct from old_row.username
    and p_row.username_changed_at is not distinct from old_row.username_changed_at;
end;
$function$;

-- Keep public reads available; mutations require an authenticated session.
do $grants$
declare signature text;
begin
 foreach signature in array array[
'public.accept_battle_safety_gate(text, text)',
'public.accept_duelvanta_safety(text, text)',
'public.activate_my_beta_account()',
'public.begin_market_deal(uuid)',
'public.cancel_market_deal(uuid, text)',
'public.clear_my_battle_signals(uuid)',
'public.complete_market_deal(uuid)',
'public.confirm_market_deal_complete(uuid)',
'public.confirm_market_deal_received(uuid)',
'public.create_battle_match(text, text, text, text)',
'public.edit_my_market_listing(uuid, text, numeric, text)',
'public.edit_my_market_listing_v2(uuid, text, numeric, text, text, numeric, text)',
'public.expire_market_listings()',
'public.finish_my_market_listing(uuid, text)',
'public.join_battle_as_moderator(uuid)',
'public.join_battle_match(uuid, text)',
'public.leave_battle_match(uuid)',
'public.leave_battle_moderation(uuid, text)',
'public.moderate_battle_report(uuid, text, text)',
'public.open_market_deal_dispute(uuid, text)',
'public.renew_my_market_listing(uuid)',
'public.report_battle_result(uuid, text)',
'public.report_battle_user(uuid, uuid, text, text)',
'public.review_battle_report(uuid, text, text)',
'public.review_staff_application(uuid, text, text)',
'public.set_battle_moderation_pause(uuid, boolean, text)',
'public.set_battle_ready(uuid, boolean)',
'public.set_my_collection_folder_visibility(uuid, boolean)',
'public.set_my_locale(text)',
'public.set_my_public_profile(text, text, text)',
'public.set_staff_permission(uuid, text, boolean)',
'public.set_staff_role(uuid, text, text)',
'public.start_battle_match(uuid)',
'public.submit_market_review(uuid, text, text)',
'public.submit_staff_application(text, text[], text, text, text[], text, text)',
'public.withdraw_my_market_offer(uuid)'
 ] loop
   if to_regprocedure(signature) is null then continue; end if;
   execute format('revoke execute on function %s from public, anon',signature);
   execute format('grant execute on function %s to authenticated, service_role',signature);
 end loop;
end
$grants$;
commit;
