-- DUELVANTA Marketplace notice-and-action foundation.
-- REVIEW ONLY: do not apply to production before the complete compliance release.

create extension if not exists pgcrypto;
create schema if not exists dv_market_private;
revoke all on schema dv_market_private from public, anon, authenticated;

create table if not exists dv_market_private.listing_notices (
  id uuid primary key default gen_random_uuid(),
  case_reference text not null unique,
  listing_id uuid references public.market_listings(id) on delete set null,
  listing_snapshot jsonb not null,
  reporter_user_id uuid references auth.users(id) on delete set null,
  reporter_name text not null,
  reporter_email text not null,
  reporter_email_hash bytea not null,
  access_code_hash bytea not null,
  category text not null check (category in (
    'counterfeit','stolen_goods','consumer_deception','intellectual_property',
    'prohibited_goods','privacy','harassment','other_illegal'
  )),
  explanation text not null,
  alleged_legal_basis text,
  exact_url text not null,
  good_faith_confirmed boolean not null check (good_faith_confirmed),
  status text not null default 'submitted' check (status in (
    'submitted','under_review','decided_no_action','decided_restricted',
    'decided_removed','appealed','closed'
  )),
  assigned_to uuid references auth.users(id) on delete set null,
  decision_action text check (decision_action in ('no_action','restrict_visibility','remove_listing')),
  decision_basis_kind text check (decision_basis_kind in ('law','terms','law_and_terms','no_violation')),
  decision_reference text,
  decision_reason text,
  decision_scope text,
  decision_duration text,
  automated_means_used boolean,
  original_listing_status text,
  submitted_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  review_started_at timestamptz,
  decided_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists listing_notices_queue_idx
  on dv_market_private.listing_notices(status, submitted_at);
create index if not exists listing_notices_listing_idx
  on dv_market_private.listing_notices(listing_id, submitted_at desc);
create index if not exists listing_notices_reporter_idx
  on dv_market_private.listing_notices(reporter_user_id, submitted_at desc);

create table if not exists dv_market_private.listing_notice_appeals (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references dv_market_private.listing_notices(id) on delete restrict,
  appellant_kind text not null check (appellant_kind in ('reporter','seller')),
  appellant_user_id uuid references auth.users(id) on delete set null,
  grounds text not null,
  status text not null default 'submitted' check (status in ('submitted','under_review','upheld','reversed')),
  reviewer_id uuid references auth.users(id) on delete set null,
  decision_reason text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists listing_notice_appeals_queue_idx
  on dv_market_private.listing_notice_appeals(status, submitted_at);

create table if not exists dv_market_private.listing_notice_events (
  id bigint generated always as identity primary key,
  notice_id uuid not null references dv_market_private.listing_notices(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists listing_notice_events_notice_idx
  on dv_market_private.listing_notice_events(notice_id, created_at, id);

create table if not exists dv_market_private.marketplace_message_outbox (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references dv_market_private.listing_notices(id) on delete restrict,
  recipient_kind text not null check (recipient_kind in ('reporter','seller')),
  recipient_user_id uuid references auth.users(id) on delete set null,
  recipient_email text,
  message_kind text not null check (message_kind in (
    'notice_received','notice_decided','seller_statement_of_reasons','appeal_received','appeal_decided'
  )),
  payload jsonb not null,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sending','sent','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists marketplace_message_outbox_pending_idx
  on dv_market_private.marketplace_message_outbox(delivery_status, created_at);

revoke all on all tables in schema dv_market_private from public, anon, authenticated;
revoke all on all sequences in schema dv_market_private from public, anon, authenticated;

create or replace function dv_market_private.block_notice_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception 'notice_audit_is_immutable';
end
$$;

revoke all on function dv_market_private.block_notice_event_mutation() from public, anon, authenticated;
drop trigger if exists listing_notice_events_immutable on dv_market_private.listing_notice_events;
create trigger listing_notice_events_immutable
before update or delete on dv_market_private.listing_notice_events
for each row execute function dv_market_private.block_notice_event_mutation();

create or replace function dv_market_private.notice_owner_caller()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'owner'
      and coalesce(p.account_status, 'active') = 'active'
  )
$$;

revoke all on function dv_market_private.notice_owner_caller() from public, anon, authenticated;

create or replace function public.submit_marketplace_listing_notice(
  p_listing_id uuid,
  p_category text,
  p_explanation text,
  p_alleged_legal_basis text,
  p_reporter_name text,
  p_reporter_email text,
  p_exact_url text,
  p_good_faith_confirmed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare
  v_listing public.market_listings%rowtype;
  v_notice dv_market_private.listing_notices%rowtype;
  v_category text := lower(trim(coalesce(p_category,'')));
  v_name text := trim(coalesce(p_reporter_name,''));
  v_email text := lower(trim(coalesce(p_reporter_email,'')));
  v_explanation text := trim(coalesce(p_explanation,''));
  v_legal_basis text := nullif(trim(coalesce(p_alleged_legal_basis,'')), '');
  v_url text := trim(coalesce(p_exact_url,''));
  v_access_code text := upper(encode(gen_random_bytes(9),'hex'));
  v_reference text := 'DVN-' || to_char(current_date,'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
  v_recent integer;
begin
  if p_listing_id is null then raise exception 'listing_required'; end if;
  if v_category not in ('counterfeit','stolen_goods','consumer_deception','intellectual_property','prohibited_goods','privacy','harassment','other_illegal') then
    raise exception 'invalid_notice_category';
  end if;
  if char_length(v_name) not between 2 and 160 then raise exception 'reporter_name_invalid'; end if;
  if char_length(v_email) > 320 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'reporter_email_invalid';
  end if;
  if char_length(v_explanation) not between 30 and 5000 then raise exception 'notice_explanation_invalid'; end if;
  if v_legal_basis is not null and char_length(v_legal_basis) > 1000 then raise exception 'notice_legal_basis_too_long'; end if;
  if char_length(v_url) > 1000 or v_url !~ '^https://([a-z0-9-]+[.])*duelvanta[.](de|com)/' then
    raise exception 'listing_url_invalid';
  end if;
  if coalesce(p_good_faith_confirmed,false) is not true then raise exception 'good_faith_confirmation_required'; end if;

  select * into v_listing from public.market_listings where id=p_listing_id;
  if not found then raise exception 'listing_not_found'; end if;

  select count(*) into v_recent
  from dv_market_private.listing_notices n
  where n.reporter_email_hash=digest(convert_to(v_email,'UTF8'),'sha256')
    and n.submitted_at > now()-interval '1 hour';
  if v_recent >= 5 then raise exception 'notice_rate_limit'; end if;

  insert into dv_market_private.listing_notices(
    case_reference,listing_id,listing_snapshot,reporter_user_id,reporter_name,reporter_email,
    reporter_email_hash,access_code_hash,category,explanation,alleged_legal_basis,exact_url,
    good_faith_confirmed,acknowledged_at
  ) values (
    v_reference,v_listing.id,to_jsonb(v_listing),auth.uid(),v_name,v_email,
    digest(convert_to(v_email,'UTF8'),'sha256'),digest(convert_to(v_access_code,'UTF8'),'sha256'),
    v_category,v_explanation,v_legal_basis,v_url,true,now()
  ) returning * into v_notice;

  insert into dv_market_private.listing_notice_events(notice_id,actor_id,event_type,event_data)
  values(v_notice.id,auth.uid(),'notice_submitted',jsonb_build_object('category',v_category,'listing_id',v_listing.id));

  insert into dv_market_private.marketplace_message_outbox(
    notice_id,recipient_kind,recipient_email,message_kind,payload
  ) values (
    v_notice.id,'reporter',v_email,'notice_received',
    jsonb_build_object('case_reference',v_reference,'received_at',v_notice.submitted_at)
  );

  return jsonb_build_object(
    'case_reference',v_reference,
    'access_code',v_access_code,
    'status','submitted',
    'received_at',v_notice.submitted_at
  );
end
$$;

revoke all on function public.submit_marketplace_listing_notice(uuid,text,text,text,text,text,text,boolean) from public;
grant execute on function public.submit_marketplace_listing_notice(uuid,text,text,text,text,text,text,boolean) to anon, authenticated;

create or replace function public.get_marketplace_notice_status(p_case_reference text,p_access_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare v_notice dv_market_private.listing_notices%rowtype; v_appeals jsonb;
begin
  select * into v_notice
  from dv_market_private.listing_notices n
  where n.case_reference=upper(trim(coalesce(p_case_reference,'')))
    and n.access_code_hash=digest(convert_to(upper(trim(coalesce(p_access_code,''))),'UTF8'),'sha256');
  if not found then raise exception 'notice_access_denied'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'status',a.status,'submitted_at',a.submitted_at,
    'decided_at',a.decided_at,'decision_reason',a.decision_reason
  ) order by a.submitted_at),'[]'::jsonb) into v_appeals
  from dv_market_private.listing_notice_appeals a where a.notice_id=v_notice.id and a.appellant_kind='reporter';

  return jsonb_build_object(
    'case_reference',v_notice.case_reference,'status',v_notice.status,'submitted_at',v_notice.submitted_at,
    'category',v_notice.category,'listing',jsonb_build_object('id',v_notice.listing_snapshot->>'id','title',v_notice.listing_snapshot->>'card_name'),
    'decision',case when v_notice.decided_at is null then null else jsonb_build_object(
      'action',v_notice.decision_action,'basis_kind',v_notice.decision_basis_kind,
      'reference',v_notice.decision_reference,'reason',v_notice.decision_reason,
      'scope',v_notice.decision_scope,'duration',v_notice.decision_duration,
      'automated_means_used',coalesce(v_notice.automated_means_used,false),'decided_at',v_notice.decided_at,
      'redress','Interner Einspruch, zertifizierte außergerichtliche Streitbeilegung oder gerichtlicher Rechtsbehelf.'
    ) end,
    'appeals',v_appeals
  );
end
$$;

revoke all on function public.get_marketplace_notice_status(text,text) from public;
grant execute on function public.get_marketplace_notice_status(text,text) to anon, authenticated;

create or replace function public.submit_marketplace_notice_appeal(
  p_case_reference text,p_access_code text,p_grounds text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare v_notice dv_market_private.listing_notices%rowtype; v_appeal dv_market_private.listing_notice_appeals%rowtype; v_grounds text:=trim(coalesce(p_grounds,''));
begin
  select * into v_notice from dv_market_private.listing_notices n
  where n.case_reference=upper(trim(coalesce(p_case_reference,'')))
    and n.access_code_hash=digest(convert_to(upper(trim(coalesce(p_access_code,''))),'UTF8'),'sha256')
  for update;
  if not found then raise exception 'notice_access_denied'; end if;
  if v_notice.decided_at is null then raise exception 'notice_not_decided'; end if;
  if v_notice.decided_at < now()-interval '6 months' then raise exception 'appeal_period_expired'; end if;
  if char_length(v_grounds) not between 30 and 5000 then raise exception 'appeal_grounds_invalid'; end if;
  if exists(select 1 from dv_market_private.listing_notice_appeals where notice_id=v_notice.id and appellant_kind='reporter' and status in ('submitted','under_review')) then
    raise exception 'appeal_already_open';
  end if;

  insert into dv_market_private.listing_notice_appeals(notice_id,appellant_kind,appellant_user_id,grounds)
  values(v_notice.id,'reporter',auth.uid(),v_grounds) returning * into v_appeal;
  update dv_market_private.listing_notices set status='appealed',updated_at=now() where id=v_notice.id;
  insert into dv_market_private.listing_notice_events(notice_id,actor_id,event_type,event_data)
  values(v_notice.id,auth.uid(),'reporter_appeal_submitted',jsonb_build_object('appeal_id',v_appeal.id));
  insert into dv_market_private.marketplace_message_outbox(notice_id,recipient_kind,recipient_email,message_kind,payload)
  values(v_notice.id,'reporter',v_notice.reporter_email,'appeal_received',jsonb_build_object('case_reference',v_notice.case_reference,'appeal_id',v_appeal.id));
  return jsonb_build_object('appeal_id',v_appeal.id,'status',v_appeal.status,'submitted_at',v_appeal.submitted_at);
end
$$;

revoke all on function public.submit_marketplace_notice_appeal(text,text,text) from public;
grant execute on function public.submit_marketplace_notice_appeal(text,text,text) to anon, authenticated;

create or replace function public.get_owner_marketplace_notices(p_status text default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare v_result jsonb;
begin
  if not dv_market_private.notice_owner_caller() then raise exception 'owner_access_required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',n.id,'case_reference',n.case_reference,'listing_id',n.listing_id,'listing',n.listing_snapshot,
    'reporter_name',n.reporter_name,'reporter_email',n.reporter_email,'category',n.category,
    'explanation',n.explanation,'alleged_legal_basis',n.alleged_legal_basis,'exact_url',n.exact_url,
    'status',n.status,'submitted_at',n.submitted_at,'decision_action',n.decision_action,
    'decision_basis_kind',n.decision_basis_kind,'decision_reference',n.decision_reference,
    'decision_reason',n.decision_reason,'decided_at',n.decided_at,
    'appeals',(select coalesce(jsonb_agg(to_jsonb(a) order by a.submitted_at),'[]'::jsonb) from dv_market_private.listing_notice_appeals a where a.notice_id=n.id)
  ) order by n.submitted_at desc),'[]'::jsonb) into v_result
  from dv_market_private.listing_notices n
  where p_status is null or n.status=p_status;
  return v_result;
end
$$;

revoke all on function public.get_owner_marketplace_notices(text) from public, anon;
grant execute on function public.get_owner_marketplace_notices(text) to authenticated;

create or replace function public.decide_marketplace_listing_notice(
  p_notice_id uuid,p_action text,p_basis_kind text,p_reference text,p_reason text,
  p_scope text default 'Deutschland',p_duration text default 'bis zur Korrektur',p_automated_means_used boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare v_notice dv_market_private.listing_notices%rowtype; v_action text:=lower(trim(coalesce(p_action,''))); v_basis text:=lower(trim(coalesce(p_basis_kind,''))); v_reason text:=trim(coalesce(p_reason,'')); v_seller uuid;
begin
  if not dv_market_private.notice_owner_caller() then raise exception 'owner_access_required'; end if;
  if v_action not in ('no_action','restrict_visibility','remove_listing') then raise exception 'invalid_notice_action'; end if;
  if v_basis not in ('law','terms','law_and_terms','no_violation') then raise exception 'invalid_decision_basis'; end if;
  if (v_action='no_action') <> (v_basis='no_violation') then raise exception 'decision_basis_mismatch'; end if;
  if char_length(v_reason) not between 30 and 5000 then raise exception 'decision_reason_invalid'; end if;
  if v_action<>'no_action' and char_length(trim(coalesce(p_reference,'')))<3 then raise exception 'decision_reference_required'; end if;

  select * into v_notice from dv_market_private.listing_notices where id=p_notice_id for update;
  if not found then raise exception 'notice_not_found'; end if;
  if v_notice.status not in ('submitted','under_review') then raise exception 'notice_already_decided'; end if;
  v_seller:=nullif(v_notice.listing_snapshot->>'seller_id','')::uuid;

  if v_action in ('restrict_visibility','remove_listing') and v_notice.listing_id is not null then
    update public.market_listings set status='paused',updated_at=now() where id=v_notice.listing_id;
  end if;

  update dv_market_private.listing_notices set
    status=case v_action when 'no_action' then 'decided_no_action' when 'restrict_visibility' then 'decided_restricted' else 'decided_removed' end,
    assigned_to=auth.uid(),decision_action=v_action,decision_basis_kind=v_basis,
    decision_reference=nullif(trim(coalesce(p_reference,'')),''),decision_reason=v_reason,
    decision_scope=case when v_action='no_action' then null else nullif(trim(coalesce(p_scope,'')),'') end,
    decision_duration=case when v_action='no_action' then null else nullif(trim(coalesce(p_duration,'')),'') end,
    automated_means_used=coalesce(p_automated_means_used,false),
    original_listing_status=coalesce(original_listing_status,listing_snapshot->>'status'),
    review_started_at=coalesce(review_started_at,now()),decided_at=now(),updated_at=now()
  where id=v_notice.id returning * into v_notice;

  insert into dv_market_private.listing_notice_events(notice_id,actor_id,event_type,event_data)
  values(v_notice.id,auth.uid(),'notice_decided',jsonb_build_object('action',v_action,'basis_kind',v_basis,'reference',p_reference,'automated_means_used',coalesce(p_automated_means_used,false)));
  insert into dv_market_private.marketplace_message_outbox(notice_id,recipient_kind,recipient_email,message_kind,payload)
  values(v_notice.id,'reporter',v_notice.reporter_email,'notice_decided',jsonb_build_object('case_reference',v_notice.case_reference,'action',v_action,'reason',v_reason,'redress','Interner Einspruch innerhalb von sechs Monaten sowie weitere gesetzliche Rechtsbehelfe.'));
  insert into dv_market_private.marketplace_message_outbox(notice_id,recipient_kind,recipient_user_id,message_kind,payload)
  values(v_notice.id,'seller',v_seller,'seller_statement_of_reasons',jsonb_build_object(
    'case_reference',v_notice.case_reference,'action',v_action,'scope',v_notice.decision_scope,'duration',v_notice.decision_duration,
    'facts',v_reason,'basis_kind',v_basis,'reference',v_notice.decision_reference,'automated_means_used',coalesce(p_automated_means_used,false),
    'redress','Interner Einspruch innerhalb von sechs Monaten, zertifizierte außergerichtliche Streitbeilegung oder gerichtlicher Rechtsbehelf.'
  ));
  return jsonb_build_object('case_reference',v_notice.case_reference,'status',v_notice.status,'decided_at',v_notice.decided_at);
end
$$;

revoke all on function public.decide_marketplace_listing_notice(uuid,text,text,text,text,text,text,boolean) from public, anon;
grant execute on function public.decide_marketplace_listing_notice(uuid,text,text,text,text,text,text,boolean) to authenticated;

create or replace function public.review_marketplace_notice_appeal(
  p_appeal_id uuid,p_outcome text,p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare v_appeal dv_market_private.listing_notice_appeals%rowtype; v_notice dv_market_private.listing_notices%rowtype; v_outcome text:=lower(trim(coalesce(p_outcome,''))); v_reason text:=trim(coalesce(p_reason,''));
begin
  if not dv_market_private.notice_owner_caller() then raise exception 'owner_access_required'; end if;
  if v_outcome not in ('upheld','reversed') then raise exception 'invalid_appeal_outcome'; end if;
  if char_length(v_reason) not between 30 and 5000 then raise exception 'appeal_decision_reason_invalid'; end if;
  select * into v_appeal from dv_market_private.listing_notice_appeals where id=p_appeal_id for update;
  if not found then raise exception 'appeal_not_found'; end if;
  if v_appeal.status not in ('submitted','under_review') then raise exception 'appeal_already_decided'; end if;
  select * into v_notice from dv_market_private.listing_notices where id=v_appeal.notice_id for update;

  update dv_market_private.listing_notice_appeals set status=v_outcome,reviewer_id=auth.uid(),decision_reason=v_reason,decided_at=now() where id=v_appeal.id returning * into v_appeal;
  if v_outcome='reversed' then
    update dv_market_private.listing_notices set status='closed',decision_action='no_action',decision_basis_kind='no_violation',decision_reference=null,decision_reason=v_reason,decision_scope=null,decision_duration=null,decided_at=now(),updated_at=now() where id=v_notice.id returning * into v_notice;
    if v_notice.listing_id is not null and v_notice.original_listing_status='active' and not exists(
      select 1 from dv_market_private.listing_notices other where other.listing_id=v_notice.listing_id and other.id<>v_notice.id and other.status in ('decided_restricted','decided_removed')
    ) then
      update public.market_listings set status='active',updated_at=now() where id=v_notice.listing_id and status='paused';
    end if;
  else
    update dv_market_private.listing_notices set status='closed',updated_at=now() where id=v_notice.id returning * into v_notice;
  end if;
  insert into dv_market_private.listing_notice_events(notice_id,actor_id,event_type,event_data)
  values(v_notice.id,auth.uid(),'appeal_decided',jsonb_build_object('appeal_id',v_appeal.id,'outcome',v_outcome));
  insert into dv_market_private.marketplace_message_outbox(notice_id,recipient_kind,recipient_user_id,recipient_email,message_kind,payload)
  values(
    v_notice.id,v_appeal.appellant_kind,
    case when v_appeal.appellant_kind='seller' then v_appeal.appellant_user_id else null end,
    case when v_appeal.appellant_kind='reporter' then v_notice.reporter_email else null end,
    'appeal_decided',jsonb_build_object('case_reference',v_notice.case_reference,'outcome',v_outcome,'reason',v_reason)
  );
  return jsonb_build_object('appeal_id',v_appeal.id,'outcome',v_outcome,'notice_status',v_notice.status,'decided_at',v_appeal.decided_at);
end
$$;

revoke all on function public.review_marketplace_notice_appeal(uuid,text,text) from public, anon;
grant execute on function public.review_marketplace_notice_appeal(uuid,text,text) to authenticated;

create or replace function public.get_my_marketplace_moderation_cases()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare v_uid uuid:=auth.uid(); v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'notice_id',n.id,'case_reference',n.case_reference,'listing_id',n.listing_id,
    'listing_title',n.listing_snapshot->>'card_name','status',n.status,
    'action',n.decision_action,'basis_kind',n.decision_basis_kind,'reference',n.decision_reference,
    'reason',n.decision_reason,'scope',n.decision_scope,'duration',n.decision_duration,
    'automated_means_used',coalesce(n.automated_means_used,false),'decided_at',n.decided_at,
    'appeals',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'submitted_at',a.submitted_at,'decision_reason',a.decision_reason) order by a.submitted_at),'[]'::jsonb) from dv_market_private.listing_notice_appeals a where a.notice_id=n.id and a.appellant_kind='seller')
  ) order by n.decided_at desc),'[]'::jsonb) into v_result
  from dv_market_private.listing_notices n
  where n.listing_snapshot->>'seller_id'=v_uid::text and n.decided_at is not null;
  return v_result;
end
$$;

revoke all on function public.get_my_marketplace_moderation_cases() from public, anon;
grant execute on function public.get_my_marketplace_moderation_cases() to authenticated;

create or replace function public.submit_my_marketplace_moderation_appeal(p_notice_id uuid,p_grounds text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, dv_market_private
as $$
declare v_uid uuid:=auth.uid(); v_notice dv_market_private.listing_notices%rowtype; v_appeal dv_market_private.listing_notice_appeals%rowtype; v_grounds text:=trim(coalesce(p_grounds,''));
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_notice from dv_market_private.listing_notices n where n.id=p_notice_id and n.listing_snapshot->>'seller_id'=v_uid::text for update;
  if not found then raise exception 'moderation_case_access_denied'; end if;
  if v_notice.decided_at is null then raise exception 'notice_not_decided'; end if;
  if v_notice.decided_at < now()-interval '6 months' then raise exception 'appeal_period_expired'; end if;
  if char_length(v_grounds) not between 30 and 5000 then raise exception 'appeal_grounds_invalid'; end if;
  if exists(select 1 from dv_market_private.listing_notice_appeals where notice_id=v_notice.id and appellant_kind='seller' and status in ('submitted','under_review')) then raise exception 'appeal_already_open'; end if;
  insert into dv_market_private.listing_notice_appeals(notice_id,appellant_kind,appellant_user_id,grounds)
  values(v_notice.id,'seller',v_uid,v_grounds) returning * into v_appeal;
  update dv_market_private.listing_notices set status='appealed',updated_at=now() where id=v_notice.id;
  insert into dv_market_private.listing_notice_events(notice_id,actor_id,event_type,event_data)
  values(v_notice.id,v_uid,'seller_appeal_submitted',jsonb_build_object('appeal_id',v_appeal.id));
  insert into dv_market_private.marketplace_message_outbox(notice_id,recipient_kind,recipient_user_id,message_kind,payload)
  values(v_notice.id,'seller',v_uid,'appeal_received',jsonb_build_object('case_reference',v_notice.case_reference,'appeal_id',v_appeal.id));
  return jsonb_build_object('appeal_id',v_appeal.id,'status',v_appeal.status,'submitted_at',v_appeal.submitted_at);
end
$$;

revoke all on function public.submit_my_marketplace_moderation_appeal(uuid,text) from public, anon;
grant execute on function public.submit_my_marketplace_moderation_appeal(uuid,text) to authenticated;
