-- Read-only Judge Desk discovery. Only battle_moderate staff may list open disputes.
begin;
create or replace function public.get_battle_disputes_for_moderation()
returns table(id uuid,tcg text,mode text,status text,host_display_name text,guest_display_name text,host_result text,guest_result text,created_at timestamptz)
language plpgsql security definer set search_path to 'public'
as $function$
begin
 if auth.uid() is null then raise exception 'not_authenticated'; end if;
 if not public.has_staff_permission('battle_moderate',auth.uid()) then raise exception 'battle_moderate permission required'; end if;
 return query select m.id,m.tcg,m.mode,m.status,m.host_display_name,m.guest_display_name,m.host_result,m.guest_result,m.created_at
 from public.battle_matches m where m.status='dispute' order by m.created_at asc limit 100;
end $function$;
revoke execute on function public.get_battle_disputes_for_moderation() from public,anon;
grant execute on function public.get_battle_disputes_for_moderation() to authenticated,service_role;
commit;