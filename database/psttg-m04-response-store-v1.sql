-- V133-M04-synthetic-store/1: private isolated installation ONLY.
-- Three business objects; no application grants, transport or ACK mutation.
begin;
create sequence dv_market_private.m04_order_v1 as bigint;
create table dv_market_private.m04_attempt_v1 (
 store_profile uuid not null,
 attempt_ref uuid not null,
 physical_proof_id uuid not null references dv_market_private.psttg_w11_envelope_proof_v1 on delete restrict,
 canonical_proof_id uuid references dv_market_private.psttg_w11_envelope_proof_v1 on delete restrict,
 binding jsonb not null check(jsonb_typeof(binding)='object' and not binding ? 'signed_bytes'),
 expectation jsonb not null,
 proof_binding jsonb not null,
 event_order bigint not null unique,
 contract text not null check(contract='V133-M04-synthetic-store/1'),
 codec text not null check(codec='m04-json-hex/1'),
 created_transaction xid8 not null, writer_pid integer not null,
 commit_ref uuid not null unique, created_at timestamptz not null,
 integrity bytea not null,
 primary key(store_profile,attempt_ref),
 check(binding->>'origin'='synthetic_test' and binding->'scope'->>'environment'='TEST'),
 check(binding->'proof'->>'attempt_ref'=attempt_ref::text)
);
create table dv_market_private.m04_journal_v1 (
 event_ref uuid primary key, store_profile uuid not null,
 event_order bigint not null unique,
 kind text not null check(kind in ('ATTEMPT_CONFLICT','RESPONSE')),
 observation_ref uuid,
 canonical_event_ref uuid references dv_market_private.m04_journal_v1 on delete restrict,
 prior_event_ref uuid references dv_market_private.m04_journal_v1 on delete restrict,
 resolved_attempt_ref uuid,
 physical_proof_id uuid references dv_market_private.psttg_w11_envelope_proof_v1 on delete restrict,
 evidence jsonb not null,
 original_response bytea,
 response_sha256 text,
 response_length integer,
 input_fingerprint text not null,
 status text not null check(status in ('BOUND','REPLAY','CONFLICT','UNRESOLVED','UNKNOWN')),
 reason text not null,
 contract text not null check(contract='V133-M04-synthetic-store/1'),
 codec text not null check(codec='m04-json-hex/1'),
 created_transaction xid8 not null, writer_pid integer not null,
 commit_ref uuid not null unique, created_at timestamptz not null,
 integrity bytea not null,
 foreign key(store_profile,resolved_attempt_ref) references dv_market_private.m04_attempt_v1 on delete restrict,
 check((original_response is null and response_sha256 is null and response_length is null) or
       (original_response is not null and response_length=octet_length(original_response)
        and response_length<=4194304 and response_sha256=encode(pg_catalog.sha256(original_response),'hex'))),
 check((kind='RESPONSE' and observation_ref is not null and physical_proof_id is null)
    or (kind='ATTEMPT_CONFLICT' and observation_ref is null and physical_proof_id is not null and status='CONFLICT'))
);
create unique index m04_first_observation_v1 on dv_market_private.m04_journal_v1(store_profile,observation_ref)
 where observation_ref is not null and canonical_event_ref is null;
create index m04_journal_order_v1 on dv_market_private.m04_journal_v1(store_profile,event_order);
create index m04_journal_fingerprint_v1 on dv_market_private.m04_journal_v1(store_profile,input_fingerprint);
create table dv_market_private.m04_service_v1 (
 store_profile uuid not null, environment text not null check(environment in ('TEST','SYNTHETIC_OTHER')),
 channel_profile uuid not null, account_profile uuid,
 phase text not null, id_type text not null,
 observed_value text not null,
 attempt_ref uuid not null, event_ref uuid not null references dv_market_private.m04_journal_v1 on delete restrict,
 response_sha256 text not null, claims_hash text not null,
 foreign key(store_profile,attempt_ref) references dv_market_private.m04_attempt_v1 on delete restrict,
 unique nulls not distinct(store_profile,environment,channel_profile,account_profile,phase,id_type,observed_value)
);

create function dv_market_private.m04_scope_v1(s jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$begin
 if jsonb_typeof(s) is distinct from 'object' or
    (select array_agg(k order by k) from jsonb_object_keys(s) k) is distinct from array['account_profile','channel_profile','environment']::text[] or
    s->>'environment' not in ('TEST','SYNTHETIC_OTHER') or s->>'environment' is null then raise exception 'm04_scope';end if;
 perform (s->>'channel_profile')::uuid;
 if s->>'channel_profile' is null then raise exception 'm04_scope';end if;
 if s->>'account_profile' is not null then perform (s->>'account_profile')::uuid;end if;
 return s;
end$$;

-- Invoker-only helpers have no grants. Application roles cannot obtain keys.
create function dv_market_private.m04_caller_v1() returns void
language plpgsql stable security invoker set search_path='' as $$begin
 -- A fixed private owner or the disposable cluster administrator. No caller
 -- supplied role name; application roles remain denied even after bad grants.
 if current_setting('role') not in ('none','dv_psttg_core_owner') or
    not exists(select from pg_catalog.pg_roles where rolname=session_user and
      (rolsuper or rolname='dv_psttg_core_owner')) then raise exception 'm04_private_role';end if;
end$$;

create function dv_market_private.m04_key_v1(authority uuid) returns bytea
language sql stable security invoker set search_path='' as $$
 select g.verification_key from dv_market_private.psttg_w11_envelope_proof_v1 p
 join dv_market_private.psttg_v2_channel_v1 g using(channel_id)
 where p.proof_id=authority and p.record_kind='BOUND'
$$;

create function dv_market_private.m04_state_v1(profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare a jsonb;j jsonb;s jsonb;r record;begin
 perform dv_market_private.m04_caller_v1();
 for r in select to_jsonb(x) v from dv_market_private.m04_attempt_v1 x where store_profile=profile loop
  if decode(substr(r.v->>'integrity',3),'hex') is distinct from dv_market_private.psttg_v2_hash(r.v-'integrity') then raise exception 'm04_attempt_integrity';end if;
 end loop;
 for r in select to_jsonb(x) v from dv_market_private.m04_journal_v1 x where store_profile=profile loop
  if decode(substr(r.v->>'integrity',3),'hex') is distinct from dv_market_private.psttg_v2_hash(r.v-'integrity') then raise exception 'm04_journal_integrity';end if;
 end loop;
 select coalesce(jsonb_agg(to_jsonb(x) order by event_order),'[]') into a from dv_market_private.m04_attempt_v1 x where store_profile=profile;
 select coalesce(jsonb_agg(to_jsonb(x) order by event_order),'[]') into j from dv_market_private.m04_journal_v1 x where store_profile=profile;
 select coalesce(jsonb_agg(to_jsonb(x) order by environment,channel_profile,account_profile,phase,id_type,observed_value),'[]') into s from dv_market_private.m04_service_v1 x where store_profile=profile;
 return jsonb_build_object('attempts',a,'journal',j,'services',s);
end$$;

-- Stage 1: exact input identity; stage 2: every affected immutable scope.
-- Separate advisory namespaces avoid cross-stage hash collision inversion.
create function dv_market_private.m04_gate_v1(profile uuid,authority uuid,kind text,ref uuid,scope jsonb,claimed uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer;scopes jsonb[];old jsonb;r record;c jsonb;k bytea;begin
 perform dv_market_private.m04_caller_v1();
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'm04_read_committed_required';end if;
 if current_setting('fsync')<>'on' or current_setting('synchronous_commit')<>'on' then raise exception 'm04_durability';end if;
 if kind not in ('ATTEMPT','RESPONSE') or profile is null or ref is null then raise exception 'm04_gate_input';end if;
 k:=dv_market_private.m04_key_v1(authority);if k is null then raise exception 'm04_private_authority';end if;
 perform dv_market_private.m04_scope_v1(scope);
 for n in select distinct hashtext(profile::text||':'||v) h from unnest(array[
    kind||':'||ref::text,case when claimed is not null then 'ATTEMPT:'||claimed::text end]) v
    where v is not null order by h loop
  perform pg_catalog.pg_advisory_xact_lock(13301,n);
 end loop;
 scopes:=array[scope];
 for r in select binding->'scope' s from dv_market_private.m04_attempt_v1
    where store_profile=profile and attempt_ref=any(array[case when kind='ATTEMPT' then ref end,claimed]) loop scopes:=array_append(scopes,r.s);end loop;
 if kind='RESPONSE' then
  select evidence->'input'->'scope' into old from dv_market_private.m04_journal_v1
   where store_profile=profile and observation_ref=ref and canonical_event_ref is null;
  if old is not null then scopes:=array_append(scopes,old);end if;
  for r in select a.binding->'scope' s from dv_market_private.m04_attempt_v1 a join dv_market_private.m04_journal_v1 j
   on a.store_profile=j.store_profile and a.attempt_ref=j.resolved_attempt_ref
   where j.store_profile=profile and j.observation_ref=ref and j.canonical_event_ref is null loop scopes:=array_append(scopes,r.s);end loop;
 end if;
 for n in select distinct hashtext(profile::text||':'||v::text) h from unnest(scopes) v order by h loop
  perform pg_catalog.pg_advisory_xact_lock(13302,n);
 end loop;
 c:=jsonb_build_object('profile',profile,'authority',authority,'kind',kind,'ref',ref,'scope',scope,'claimed',claimed,
     'transaction',pg_current_xact_id()::text,'pid',pg_backend_pid());
 return jsonb_build_object('challenge',c,'mac',encode(dv_market_private.psttg_w11_mac_v1(jsonb_build_array('m04-gates/1',c),k),'hex'));
end$$;

create function dv_market_private.m04_order_next_v1() returns bigint
language plpgsql volatile security definer set search_path='' as $$begin
 perform dv_market_private.m04_caller_v1();return nextval('dv_market_private.m04_order_v1'::regclass);
end$$;

-- SQL verifies W11's independent observation and the private verifier's full
-- binding attestation. This function never calls W11 bind or ACK mutation.
create function dv_market_private.m04_proof_v1(source jsonb,secret text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p dv_market_private.psttg_w11_envelope_proof_v1;g dv_market_private.psttg_v2_channel_v1;
 b jsonb;c jsonb;m jsonb;a jsonb;o jsonb;begin
 select * into strict p from dv_market_private.psttg_w11_envelope_proof_v1 where proof_id=(source->>'physical_proof_id')::uuid;
 select * into strict g from dv_market_private.psttg_v2_channel_v1 where channel_id=p.channel_id;
 o:=source->'observation';a:=source->'binding';
 if o->>'transaction' is distinct from pg_current_xact_id()::text or (o->>'backend_pid')::int is distinct from pg_backend_pid()
 or p.created_transaction=pg_current_xact_id() or (p.writer_backend_pid=pg_backend_pid() and p.created_at>=pg_postmaster_start_time()) then raise exception 'm04_independent_proof';end if;
 if decode(source->>'observation_mac','hex') is distinct from dv_market_private.psttg_w11_mac_v1(jsonb_build_array('w11-observation/1',o),g.verification_key)
 or decode(source->>'revalidated_mac','hex') is distinct from dv_market_private.psttg_w11_mac_v1(jsonb_build_array('m04-proof/1',o,a,source->'expectation'),g.verification_key) then raise exception 'm04_proof_attestation';end if;
 b:=dv_market_private.psttg_w11_plain_v1(p.proof_id,secret);c:=b->'input'->'context';m:=b->'input'->'m02';
 if o->>'proof_id' is distinct from p.proof_id::text or o->>'commitment' is distinct from encode(p.cipher_commitment,'hex')
 or o->>'input_sha256' is distinct from b->>'input_sha256' or a ? 'signed_bytes'
 or a->>'origin' is distinct from 'synthetic_test' or a->'scope'->>'environment' is distinct from 'TEST'
 or a->'proof'->>'proof_id' is distinct from c->>'proof_id'
 or a->'proof'->>'attempt_ref' is distinct from c->'envelope'->>'attempt_ref'
 or a->'proof'->>'operation_ref' is distinct from c->>'operation_ref'
 or a->'proof'->>'input_revision' is distinct from c->>'input_revision'
 or a->'proof'->>'envelope_revision' is distinct from m->'spec'->>'revision'
 or a->'proof'->>'edition_binding' is distinct from m->>'edition_binding'
 or a->'proof'->>'signed_sha256' is distinct from encode(pg_catalog.sha256(decode(m->'bytes'->>'signed','base64')),'hex')
 or (a->>'signed_length')::int is distinct from octet_length(decode(m->'bytes'->>'signed','base64'))
 or a->>'delivery_revision' is distinct from m->'delivery'->>'revision'
 or a->>'source_revision' is distinct from m->'delivery'->>'source_revision'
 or a->>'message_ref' is distinct from m->'delivery'->>'message_ref'
 or a->>'transfer_ticket' is distinct from m->'spec'->>'transfer_ticket'
 or a->>'item_position' is distinct from m->'spec'->>'item_position' then raise exception 'm04_proof_binding';end if;
 perform dv_market_private.m04_scope_v1(a->'scope');
 return jsonb_build_object('physical_proof_id',p.proof_id,'canonical_proof_id',p.canonical_proof_id,
    'record_kind',p.record_kind,'commit_ref',p.commit_ref,'cipher_commitment',encode(p.cipher_commitment,'hex'),
    'input_sha256',b->>'input_sha256');
end$$;

create function dv_market_private.m04_write_v1(ticket jsonb,payload jsonb,attestation bytea,secret text) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare c jsonb;k bytea;profile uuid;a dv_market_private.m04_attempt_v1;j dv_market_private.m04_journal_v1;
 olda dv_market_private.m04_attempt_v1;oldj dv_market_private.m04_journal_v1;proof jsonb;source jsonb;x jsonb;inp jsonb;scope jsonb;begin
 perform dv_market_private.m04_caller_v1();
 c:=ticket->'challenge';profile:=(c->>'profile')::uuid;k:=dv_market_private.m04_key_v1((c->>'authority')::uuid);
 if k is null or c->>'transaction' is distinct from pg_current_xact_id()::text or (c->>'pid')::int is distinct from pg_backend_pid()
 or decode(ticket->>'mac','hex') is distinct from dv_market_private.psttg_w11_mac_v1(jsonb_build_array('m04-gates/1',c),k)
 or attestation is distinct from dv_market_private.psttg_w11_mac_v1(jsonb_build_array('m04-decision/1',c,payload),k) then raise exception 'm04_private_decision';end if;
 if current_setting('transaction_isolation')<>'read committed' or current_setting('fsync')<>'on' or current_setting('synchronous_commit')<>'on' then raise exception 'm04_durability';end if;
 if payload->>'contract' is distinct from 'V133-M04-synthetic-store/1' or payload->>'codec' is distinct from 'm04-json-hex/1'
 or payload->'external_ack_performed' is distinct from 'false'::jsonb or payload->'real_receipt_adapter' is distinct from 'false'::jsonb then raise exception 'm04_profile';end if;
 if payload->>'kind' is distinct from c->>'kind' then raise exception 'm04_kind';end if;
 -- The private verifier attests its decision after a fresh post-gate statement.
 -- The gates are scoped, not a global optimistic version or global store lock.
 if payload->>'kind'='ATTEMPT' then
  source:=payload->'source';proof:=dv_market_private.m04_proof_v1(source,secret);
  if source->'binding'->'proof'->>'attempt_ref' is distinct from c->>'ref' or source->'binding'->'scope' is distinct from c->'scope' then raise exception 'm04_attempt_gate';end if;
  select * into olda from dv_market_private.m04_attempt_v1 where store_profile=profile and attempt_ref=(c->>'ref')::uuid;
  if found and olda.binding=source->'binding' and olda.physical_proof_id=(source->>'physical_proof_id')::uuid then
   if payload->>'new_event'='true' then raise exception 'm04_spurious_attempt_event';end if;
   return jsonb_build_object('canonical_attempt',olda.attempt_ref,'event_order',olda.event_order,'status',payload->>'status','commit_ref',olda.commit_ref,'external_ack_performed',false,'real_receipt_adapter',false);
  end if;
  if olda.attempt_ref is null then
   if proof->>'record_kind'<>'BOUND' or payload->>'status'<>'BOUND' then raise exception 'm04_bound_proof_required';end if;
   a.store_profile:=profile;a.attempt_ref:=(c->>'ref')::uuid;a.physical_proof_id:=(source->>'physical_proof_id')::uuid;
   a.canonical_proof_id:=(proof->>'canonical_proof_id')::uuid;a.binding:=source->'binding';a.expectation:=source->'expectation';a.proof_binding:=proof;
   a.event_order:=(payload->>'event_order')::bigint;a.contract:=payload->>'contract';a.codec:=payload->>'codec';
   a.created_transaction:=pg_current_xact_id();a.writer_pid:=pg_backend_pid();a.commit_ref:=gen_random_uuid();a.created_at:=clock_timestamp();
   a.integrity:=dv_market_private.psttg_v2_hash(to_jsonb(a)-'integrity');
   insert into dv_market_private.m04_attempt_v1 select a.*;
   return jsonb_build_object('canonical_attempt',a.attempt_ref,'event_order',a.event_order,'status','BOUND','commit_ref',a.commit_ref,'external_ack_performed',false,'real_receipt_adapter',false);
  end if;
  if payload->>'status'<>'CONFLICT' or payload->>'new_event'<>'true' then raise exception 'm04_attempt_conflict_required';end if;
  j.kind:='ATTEMPT_CONFLICT';j.physical_proof_id:=(source->>'physical_proof_id')::uuid;j.resolved_attempt_ref:=olda.attempt_ref;
  j.evidence:=(payload-'source')||jsonb_build_object('source',(source-array['observation','observation_mac','revalidated_mac'])||jsonb_build_object('proof_binding',proof));
 else
  inp:=payload->'input';scope:=dv_market_private.m04_scope_v1(inp->'scope');
  if inp->>'observation_ref' is distinct from c->>'ref' or scope is distinct from c->'scope' or inp->>'attempt_ref' is distinct from c->>'claimed'
   or inp->>'origin' is distinct from 'synthetic_test' then raise exception 'm04_response_gate';end if;
  if payload->>'new_event'='false' then
   select * into strict oldj from dv_market_private.m04_journal_v1 where store_profile=profile and event_ref=(payload->>'replay_event_ref')::uuid;
   if oldj.evidence->'input' is distinct from inp-'original_hex' or oldj.original_response is distinct from decode(inp->>'original_hex','hex')
    or oldj.prior_event_ref is distinct from (payload->>'prior_event_ref')::uuid then raise exception 'm04_false_replay';end if;
   return jsonb_build_object('event_ref',oldj.event_ref,'event_order',oldj.event_order,'status',payload->>'status','commit_ref',oldj.commit_ref,'external_ack_performed',false,'real_receipt_adapter',false);
  end if;
  j.kind:='RESPONSE';j.observation_ref:=(inp->>'observation_ref')::uuid;j.resolved_attempt_ref:=(payload->>'resolved_attempt_ref')::uuid;
  j.prior_event_ref:=(payload->>'prior_event_ref')::uuid;
  if j.prior_event_ref is not null and not exists(select from dv_market_private.m04_journal_v1
     where event_ref=j.prior_event_ref and store_profile=profile) then raise exception 'm04_history_link';end if;
  select * into oldj from dv_market_private.m04_journal_v1 where store_profile=profile and observation_ref=j.observation_ref and canonical_event_ref is null;
  if found then
   if payload->>'status'<>'CONFLICT' then raise exception 'm04_ref_conflict_required';end if;
   j.canonical_event_ref:=oldj.event_ref;
  end if;
  j.original_response:=decode(inp->>'original_hex','hex');j.response_length:=octet_length(j.original_response);
  j.response_sha256:=encode(pg_catalog.sha256(j.original_response),'hex');
  if inp->>'presence'='observed_in_memory' then
   if j.original_response is null then raise exception 'm04_observed_bytes';end if;
  elsif inp->>'presence' in ('not_observed','possibly_lost') then
   if j.original_response is not null then raise exception 'm04_unknown_bytes';end if;
  else raise exception 'm04_presence';end if;
  j.evidence:=jsonb_set(payload,'{input}',inp-'original_hex');
 end if;
 j.event_ref:=(payload->>'event_ref')::uuid;j.store_profile:=profile;j.event_order:=(payload->>'event_order')::bigint;
 j.input_fingerprint:=payload->>'input_fingerprint';j.status:=payload->>'status';j.reason:=payload->>'reason';
 j.contract:=payload->>'contract';j.codec:=payload->>'codec';j.created_transaction:=pg_current_xact_id();j.writer_pid:=pg_backend_pid();j.commit_ref:=gen_random_uuid();j.created_at:=clock_timestamp();
 j.integrity:=dv_market_private.psttg_v2_hash(to_jsonb(j)-'integrity');
 insert into dv_market_private.m04_journal_v1 select j.*;
 if j.kind='RESPONSE' and j.status in ('BOUND','REPLAY') then
  for x in select value from jsonb_array_elements(payload->'new_services') loop
   if x->'scope' is distinct from scope or x->>'attempt_ref' is distinct from j.resolved_attempt_ref::text or x->>'phase' is distinct from inp->>'phase'
    or not exists(select from jsonb_array_elements(inp->'service_ids') i where i->>'kind'=x->>'kind' and i->>'value'=x->>'value') then raise exception 'm04_service_binding';end if;
   insert into dv_market_private.m04_service_v1 values(profile,scope->>'environment',(scope->>'channel_profile')::uuid,(scope->>'account_profile')::uuid,
      x->>'phase',x->>'kind',x->>'value',j.resolved_attempt_ref,j.event_ref,j.response_sha256,x->>'claims_hash');
  end loop;
 elsif jsonb_array_length(payload->'new_services')<>0 then raise exception 'm04_unresolved_service';end if;
 return jsonb_build_object('event_ref',j.event_ref,'event_order',j.event_order,'status',j.status,'commit_ref',j.commit_ref,'external_ack_performed',false,'real_receipt_adapter',false);
end$$;

create function dv_market_private.m04_append_only_v1() returns trigger
language plpgsql security invoker set search_path='' as $$declare stack text;begin
 if TG_OP<>'INSERT' then raise exception 'm04_append_only';end if;
 get diagnostics stack=PG_CONTEXT;
 if stack !~ 'function dv_market_private\.m04_write_v1\(' then raise exception 'm04_private_entry';end if;
 return new;
end$$;
do $$declare t text;p regprocedure;begin
 foreach t in array array['m04_attempt_v1','m04_journal_v1','m04_service_v1'] loop
  execute format('alter table dv_market_private.%I owner to dv_psttg_core_owner',t);
  execute format('alter table dv_market_private.%I enable row level security',t);
  execute format('revoke all on dv_market_private.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger m04_append_only before insert or update or delete on dv_market_private.%I for each row execute function dv_market_private.m04_append_only_v1()',t);
  execute format('create trigger m04_no_truncate before truncate on dv_market_private.%I for each statement execute function dv_market_private.m04_append_only_v1()',t);
 end loop;
 alter sequence dv_market_private.m04_order_v1 owner to dv_psttg_core_owner;
 revoke all on sequence dv_market_private.m04_order_v1 from public,anon,authenticated,service_role;
 for p in select x.oid::regprocedure from pg_catalog.pg_proc x join pg_catalog.pg_namespace n on n.oid=x.pronamespace where n.nspname='dv_market_private' and x.proname like 'm04_%_v1' loop
  execute format('alter function %s owner to dv_psttg_core_owner',p);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',p);
 end loop;
end$$;
commit;
