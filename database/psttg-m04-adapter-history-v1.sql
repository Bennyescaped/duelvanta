-- V147 private synthetic installation, additive to V140. No new business table.
-- Install before concurrent writers; profile attachment is a separate closed TX.
begin;
alter table dv_market_private.m04_journal_v1 drop constraint m04_journal_v1_kind_check;
alter table dv_market_private.m04_journal_v1 drop constraint m04_journal_v1_contract_check;
alter table dv_market_private.m04_journal_v1 drop constraint m04_journal_v1_codec_check;
alter table dv_market_private.m04_journal_v1 drop constraint m04_journal_v1_check1;
alter table dv_market_private.m04_journal_v1 alter column status drop not null;
alter table dv_market_private.m04_journal_v1 add constraint m04_history_closed_branch check ((
 (contract='V133-M04-synthetic-store/1' and codec='m04-json-hex/1'
  and status is not null and
  ((kind='RESPONSE' and observation_ref is not null and physical_proof_id is null)
   or (kind='ATTEMPT_CONFLICT' and observation_ref is null and physical_proof_id is not null and status='CONFLICT')))
 or
 (contract='V147-M04-synthetic-adapter-history/1' and codec='m04-adapter-history-json-hex/1'
  and kind in ('ADAPTER_ATTACHMENT','REQUEST','SEND_EVIDENCE','M03_SNAPSHOT',
               'RAW_CAPTURE','RECEIPT_INTERPRETATION','EVIDENCE_ASSERTION','ADAPTER_CONFLICT')
  and observation_ref is null and physical_proof_id is null
  and evidence->>'origin'='synthetic_test'
  and evidence ?& array['operation_ref','identity','input','origin']
  and ((kind in ('RECEIPT_INTERPRETATION','ADAPTER_CONFLICT') and status is not null)
    or (kind not in ('RECEIPT_INTERPRETATION','ADAPTER_CONFLICT') and status is null))
  and (kind='RAW_CAPTURE' or original_response is null))
) IS TRUE);
create unique index m04_history_attachment_v1 on dv_market_private.m04_journal_v1(store_profile)
 where kind='ADAPTER_ATTACHMENT';
create unique index m04_history_identity_v1 on dv_market_private.m04_journal_v1
 (store_profile,kind,(evidence->>'identity'))
 where codec='m04-adapter-history-json-hex/1' and canonical_event_ref is null;
create unique index m04_history_send_revision_v1 on dv_market_private.m04_journal_v1
 (store_profile,(evidence->>'request_ref'),((evidence->>'revision')::bigint))
 where kind='SEND_EVIDENCE' and codec='m04-adapter-history-json-hex/1';
create unique index m04_history_dispatch_request_v1 on dv_market_private.m04_journal_v1
 (store_profile,(evidence->>'request_ref'))
 where kind='SEND_EVIDENCE' and evidence->>'send_kind'='SEND_STARTED';
create unique index m04_history_dispatch_slot_v1 on dv_market_private.m04_journal_v1
 (store_profile,(evidence->'dispatch_slot'))
 where kind='SEND_EVIDENCE' and evidence->>'send_kind'='SEND_STARTED';
create unique index m04_history_snapshot_revision_v1 on dv_market_private.m04_journal_v1
 (store_profile,(evidence->'m03_scope'),((evidence->>'revision')::bigint))
 where kind='M03_SNAPSHOT';

alter function dv_market_private.m04_state_v1(uuid) rename to m04_state_base_v1;
alter function dv_market_private.m04_gate_v1(uuid,uuid,text,uuid,jsonb,uuid) rename to m04_gate_base_v1;
alter function dv_market_private.m04_write_v1(jsonb,jsonb,bytea,text) rename to m04_write_base_v1;

create function dv_market_private.m04_history_attached_v1(profile uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select from dv_market_private.m04_journal_v1
 where store_profile=profile and kind='ADAPTER_ATTACHMENT')
$$;
create function dv_market_private.m04_state_v1(profile uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$begin
 perform dv_market_private.m04_caller_v1();
 if dv_market_private.m04_history_attached_v1(profile) then raise exception 'm04_adapter_version_required';end if;
 return dv_market_private.m04_state_base_v1(profile);
end$$;
create function dv_market_private.m04_gate_v1(profile uuid,authority uuid,kind text,ref uuid,scope jsonb,claimed uuid)
returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform dv_market_private.m04_caller_v1();
 if dv_market_private.m04_history_attached_v1(profile) then raise exception 'm04_adapter_version_required';end if;
 return dv_market_private.m04_gate_base_v1(profile,authority,kind,ref,scope,claimed);
end$$;
create function dv_market_private.m04_write_v1(ticket jsonb,payload jsonb,attestation bytea,secret text)
returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform dv_market_private.m04_caller_v1();
 if dv_market_private.m04_history_attached_v1((ticket->'challenge'->>'profile')::uuid)
 then raise exception 'm04_adapter_version_required';end if;
 return dv_market_private.m04_write_base_v1(ticket,payload,attestation,secret);
end$$;

create function dv_market_private.m04_history_gate_v1(profile uuid,authority uuid,op jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer;k bytea;c jsonb;scopes jsonb[];r record;begin
 perform dv_market_private.m04_caller_v1();
 if current_setting('transaction_isolation')<>'read committed' or current_setting('fsync')<>'on'
 or current_setting('synchronous_commit')<>'on' then raise exception 'history_transaction';end if;
 k:=dv_market_private.m04_key_v1(authority);
 if k is null or profile is null or op->>'kind' not in
 ('ADAPTER_ATTACHMENT','REQUEST','SEND_EVIDENCE','M03_SNAPSHOT','RAW_CAPTURE','RECEIPT_INTERPRETATION','EVIDENCE_ASSERTION')
 or op->>'origin' is distinct from 'synthetic_test' then raise exception 'history_input';end if;
 -- Stage 1: the same persistent scope keys for snapshot mutation and dispatch.
 for n in select distinct hashtext(profile::text||':'||value::text) h
 from jsonb_array_elements(op->'m03_scopes') order by h loop
  perform pg_catalog.pg_advisory_xact_lock(14701,n);
 end loop;
 -- Stage 2: old ATTEMPT identities keep the existing namespace. All keys in
 -- each namespace are gathered before acquisition, never after scope search.
 for n in select distinct hashtext(profile::text||':ATTEMPT:'||value) h
 from jsonb_array_elements_text(op->'attempt_refs') order by h loop
  perform pg_catalog.pg_advisory_xact_lock(13301,n);
 end loop;
 for n in select distinct hashtext(profile::text||':'||value) h
 from jsonb_array_elements_text(op->'identities') order by h loop
  perform pg_catalog.pg_advisory_xact_lock(14702,n);
 end loop;
 -- Stage 3: all claimed scopes and immutable scopes of directly claimed
 -- Attempts. Identity conflicts include the original identity's scopes.
 select coalesce(array_agg(value),array[]::jsonb[]) into scopes from jsonb_array_elements(op->'scopes');
 for r in select binding->'scope' s from dv_market_private.m04_attempt_v1
 where store_profile=profile and attempt_ref::text in
 (select value from jsonb_array_elements_text(op->'attempt_refs')) loop scopes:=array_append(scopes,r.s);end loop;
 for r in select j.evidence->'scope' s from dv_market_private.m04_journal_v1 j
 where j.store_profile=profile and j.evidence->>'identity'=op->>'identity'
 and j.kind=op->>'kind' and j.evidence->'scope' is not null loop scopes:=array_append(scopes,r.s);end loop;
 for r in select distinct v s from unnest(scopes) v loop perform dv_market_private.m04_scope_v1(r.s);end loop;
 for n in select distinct hashtext(profile::text||':'||v::text) h from unnest(scopes) v order by h loop
  perform pg_catalog.pg_advisory_xact_lock(13302,n);
 end loop;
 -- A new statement in the private adapter must read after this gate returns.
 c:=jsonb_build_object('profile',profile,'authority',authority,'operation',op,
 'transaction',pg_current_xact_id()::text,'pid',pg_backend_pid());
 return jsonb_build_object('challenge',c,'mac',encode(dv_market_private.psttg_w11_mac_v1
 (jsonb_build_array('m04-history-gates/1',c),k),'hex'));
end$$;

create function dv_market_private.m04_history_write_v1(ticket jsonb,payload jsonb,attestation bytea)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare c jsonb;k bytea;profile uuid;x jsonb;y jsonb;j dv_market_private.m04_journal_v1;
 target dv_market_private.m04_journal_v1;refs jsonb:='[]';begin
 perform dv_market_private.m04_caller_v1();
 c:=ticket->'challenge';profile:=(c->>'profile')::uuid;
 k:=dv_market_private.m04_key_v1((c->>'authority')::uuid);
 if k is null or c->>'transaction' is distinct from pg_current_xact_id()::text
 or (c->>'pid')::int is distinct from pg_backend_pid()
 or decode(ticket->>'mac','hex') is distinct from dv_market_private.psttg_w11_mac_v1(jsonb_build_array('m04-history-gates/1',c),k)
 or attestation is distinct from dv_market_private.psttg_w11_mac_v1(jsonb_build_array('m04-history-decision/1',c,payload),k)
 then raise exception 'history_private_attestation';end if;
 if current_setting('transaction_isolation')<>'read committed' or current_setting('fsync')<>'on'
 or current_setting('synchronous_commit')<>'on' then raise exception 'history_transaction';end if;
 if payload->'external_ack_performed' is distinct from 'false'::jsonb
 or payload->'real_receipt_adapter' is distinct from 'false'::jsonb
 or payload->>'codec' is distinct from 'm04-adapter-history-json-hex/1'
 or payload->'operation' is distinct from c->'operation' then raise exception 'history_boundary';end if;
 for x in select value from jsonb_array_elements(payload->'rows') loop
  j:=null;
  j.event_ref:=(x->>'event_ref')::uuid;j.store_profile:=profile;
  j.event_order:=(x->>'event_order')::bigint;j.kind:=x->>'kind';
  j.canonical_event_ref:=(x->>'canonical_event_ref')::uuid;
  j.prior_event_ref:=(x->>'prior_event_ref')::uuid;
  j.resolved_attempt_ref:=(x->>'resolved_attempt_ref')::uuid;
  j.evidence:=x->'evidence';j.original_response:=decode(x->>'original_hex','hex');
  j.response_sha256:=encode(pg_catalog.sha256(j.original_response),'hex');
  j.response_length:=octet_length(j.original_response);
  j.input_fingerprint:=x->>'input_fingerprint';j.status:=x->>'status';j.reason:=x->>'reason';
  j.contract:='V147-M04-synthetic-adapter-history/1';j.codec:='m04-adapter-history-json-hex/1';
  j.created_transaction:=pg_current_xact_id();j.writer_pid:=pg_backend_pid();
  j.commit_ref:=(x->>'commit_ref')::uuid;j.created_at:=(x->>'created_at')::timestamptz;
  if j.evidence->>'operation_ref' is distinct from c->'operation'->>'operation_ref'
  or j.event_order<=0 then raise exception 'history_operation';end if;
  if j.prior_event_ref is not null and not exists(select from dv_market_private.m04_journal_v1
   where event_ref=j.prior_event_ref and store_profile=profile) then raise exception 'history_prior';end if;
  if j.canonical_event_ref is not null and not exists(select from dv_market_private.m04_journal_v1
   where event_ref=j.canonical_event_ref and store_profile=profile) then raise exception 'history_canonical';end if;
  if j.kind='SEND_EVIDENCE' and j.evidence->>'send_kind'='SEND_STARTED'
   and (j.evidence->'dispatch_slot' is null or j.evidence->>'fence_ref' is null)
   then raise exception 'history_fence';end if;
  if j.kind='RECEIPT_INTERPRETATION' then
   select * into strict target from dv_market_private.m04_journal_v1 where event_ref=j.prior_event_ref and store_profile=profile;
   if target.kind<>'RAW_CAPTURE' or target.evidence->>'completeness'<>'COMPLETE'
    or target.created_transaction=pg_current_xact_id()
    or j.evidence->>'raw_sha256' is distinct from target.response_sha256
   then raise exception 'history_raw_commit_required';end if;
  end if;
  j.integrity:=dv_market_private.psttg_v2_hash(to_jsonb(j)-'integrity');
  insert into dv_market_private.m04_journal_v1 select j.*;
  refs:=refs||jsonb_build_array(jsonb_build_object('event_ref',j.event_ref,'commit_ref',j.commit_ref,'event_order',j.event_order));
 end loop;
 for y in select value from jsonb_array_elements(payload->'new_services') loop
  select * into strict target from dv_market_private.m04_journal_v1
  where event_ref=(y->>'event_ref')::uuid and store_profile=profile;
  if target.kind<>'RECEIPT_INTERPRETATION' or target.status not in ('BOUND','REPLAY')
  or target.resolved_attempt_ref::text is distinct from y->>'attempt_ref'
  then raise exception 'history_service_source';end if;
  select * into strict j from dv_market_private.m04_journal_v1 where event_ref=target.prior_event_ref and store_profile=profile;
  insert into dv_market_private.m04_service_v1 values(profile,y->'scope'->>'environment',
   (y->'scope'->>'channel_profile')::uuid,(y->'scope'->>'account_profile')::uuid,
   y->>'phase',y->>'kind',y->>'value',(y->>'attempt_ref')::uuid,target.event_ref,j.response_sha256,y->>'claims_hash');
 end loop;
 return jsonb_build_object('rows',refs,'external_ack_performed',false,'real_receipt_adapter',false);
end$$;

create or replace function dv_market_private.m04_append_only_v1() returns trigger
language plpgsql security invoker set search_path='' as $$declare stack text;begin
 if TG_OP<>'INSERT' then raise exception 'm04_append_only';end if;
 get diagnostics stack=PG_CONTEXT;
 if stack !~ 'function dv_market_private\.(m04_write_base_v1|m04_history_write_v1)\('
 then raise exception 'm04_private_entry';end if;
 return new;
end$$;
do $$declare p regprocedure;begin
 for p in select x.oid::regprocedure from pg_catalog.pg_proc x join pg_catalog.pg_namespace n on n.oid=x.pronamespace
 where n.nspname='dv_market_private' and x.proname like 'm04_%_v1' loop
  execute format('alter function %s owner to dv_psttg_core_owner',p);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',p);
 end loop;
end$$;
commit;
