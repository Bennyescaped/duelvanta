-- V123-W11-verified-envelope-commit/1. Isolated review/test installation only.
-- No change to any V114 function, unit, gate, grant or ingress payload contract.
begin;
create table dv_market_private.psttg_w11_envelope_proof_v1 (
 proof_id uuid primary key,
 channel_id uuid not null references dv_market_private.psttg_v2_channel_v1 on delete restrict,
 operating_incarnation uuid not null, operation_ref uuid not null, envelope_revision uuid not null,
 event_ref uuid not null,
 admission_id uuid not null references dv_market_private.psttg_v2_use_admission_v1 on delete restrict,
 attempt_transition_id uuid not null references dv_market_private.psttg_v2_use_transition_v1 on delete restrict,
 receipt_id uuid not null unique references dv_market_private.psttg_v2_ingress_v1 on delete restrict,
 predecessor_proof_id uuid references dv_market_private.psttg_w11_envelope_proof_v1 on delete restrict,
 canonical_proof_id uuid references dv_market_private.psttg_w11_envelope_proof_v1 on delete restrict,
 record_kind text not null check(record_kind in ('BOUND','CONFLICT')),
 contract text not null check(contract='V123-W11-verified-envelope-commit/1'),
 key_ref uuid not null unique, wrapped_key bytea not null,
 ciphertext bytea not null check(octet_length(ciphertext) between 1 and 50331648),
 cipher_commitment bytea not null check(octet_length(cipher_commitment)=32),
 created_transaction xid8 not null, writer_backend_pid integer not null,
 created_at timestamptz not null, commit_ref uuid not null,
 check ((record_kind='BOUND' and canonical_proof_id is null) or
        (record_kind='CONFLICT' and canonical_proof_id is not null and canonical_proof_id<>proof_id)),
 check(predecessor_proof_id is null or predecessor_proof_id<>proof_id)
);
create unique index w11_canonical_identity on dv_market_private.psttg_w11_envelope_proof_v1
 (channel_id,operating_incarnation,operation_ref,envelope_revision) where record_kind='BOUND';
create unique index w11_canonical_event on dv_market_private.psttg_w11_envelope_proof_v1
 (channel_id,event_ref) where record_kind='BOUND';
create index w11_conflict_parent on dv_market_private.psttg_w11_envelope_proof_v1(canonical_proof_id);
create table dv_market_private.psttg_w11_ack_ready_v1 (
 marker_id uuid primary key,
 proof_id uuid not null unique references dv_market_private.psttg_w11_envelope_proof_v1 on delete restrict,
 proof_cipher_commitment bytea not null check(octet_length(proof_cipher_commitment)=32),
 observation_id uuid not null unique, observed_transaction xid8 not null,
 observer_backend_pid integer not null, marker_transaction xid8 not null,
 marked_at timestamptz not null,
 contract text not null check(contract='V123-W11-verified-envelope-commit/1'),
 external_ack_performed boolean not null check(external_ack_performed=false)
);

-- Internal helpers are SECURITY INVOKER, callable only through the private owner.
create function dv_market_private.psttg_w11_mac_v1(value jsonb,key bytea) returns bytea
language plpgsql security invoker set search_path='' as $$
declare ns text; result bytea; begin
 select n.nspname into strict ns from pg_catalog.pg_extension e join pg_catalog.pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
 execute format('select %I.hmac($1,$2,''sha256'')',ns) into result using convert_to(value::text,'UTF8'),key;
 return result;
end$$;

create function dv_market_private.psttg_w11_plain_v1(id uuid,secret text) returns jsonb
language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare r dv_market_private.psttg_w11_envelope_proof_v1; k jsonb; b jsonb; e jsonb; expected jsonb; begin
 select * into strict r from dv_market_private.psttg_w11_envelope_proof_v1 where proof_id=id;
 if r.cipher_commitment is distinct from dv_market_private.psttg_v2_hash(to_jsonb(r)-'cipher_commitment') then raise exception 'w11_cipher_integrity';end if;
 k:=dv_market_private.psttg_v2_decrypt(r.wrapped_key,secret);
 if k->>'proof_id' is distinct from id::text or k->>'key_ref' is distinct from r.key_ref::text then raise exception 'w11_key_binding';end if;
 b:=dv_market_private.psttg_v2_decrypt(r.ciphertext,k->>'key');
 if b->'stored' is distinct from (to_jsonb(r)-array['wrapped_key','ciphertext','cipher_commitment']) then raise exception 'w11_stored_binding';end if;
 if b->>'input_sha256' is distinct from encode(dv_market_private.psttg_v2_hash(b->'input'),'hex') then raise exception 'w11_input_integrity';end if;
 e:=dv_market_private.psttg_v2_ingress_plain_v1(r.receipt_id,secret);
 expected:=jsonb_set(b->'input'->'context'->'envelope','{payload,detail_ref}',to_jsonb(id::text));
 if e is distinct from expected or e is distinct from b->'ingress' or
    e->>'channel' is distinct from r.channel_id::text or e->>'event_ref' is distinct from r.event_ref::text then raise exception 'w11_ingress_binding';end if;
 return b;
end$$;

create function dv_market_private.psttg_w11_eligible_v1(id uuid,secret text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare r dv_market_private.psttg_w11_envelope_proof_v1; g dv_market_private.psttg_v2_channel_v1; ss uuid[]; c jsonb; begin
 select * into strict r from dv_market_private.psttg_w11_envelope_proof_v1 where proof_id=id;
 select * into strict g from dv_market_private.psttg_v2_channel_v1 where channel_id=r.channel_id;
 ss:=dv_market_private.psttg_v2_scopes(g.scope_ids);
 c:=dv_market_private.psttg_w11_plain_v1(id,secret)->'input'->'context';
 return r.record_kind='BOUND' and g.operating_incarnation=r.operating_incarnation and not g.quarantine
 and g.configuration_revision=(c->>'configuration_revision')::bigint
 and g.execution_epoch=(c->'envelope'->>'epoch')::bigint
 and g.receipt_revision=(c->>'receipt_revision')::bigint+1
 and g.mapping_revision=(c->>'mapping_revision')::bigint
 and g.stop_revision=(c->>'stop_revision')::bigint+1
 and not exists(select from dv_market_private.psttg_w11_envelope_proof_v1 p where p.canonical_proof_id=r.proof_id)
 and not exists(select from dv_market_private.psttg_v2_channel_v1 c where c.scope_ids&&ss and c.quarantine)
 and not exists(select from dv_market_private.psttg_scope_guards s where s.scope_id=any(ss) and (s.phase<>'open' or s.recovery_state<>'none'))
 and not exists(select from dv_market_private.psttg_unit_guard u join dv_market_private.psttg_unit_binding b using(object_id) where b.scope_ids&&ss and u.phase<>'present')
 -- Only this receipt may be the reason for an outstanding ingress stop.
 and not exists(select from dv_market_private.psttg_v2_ingress_v1 i where i.channel_id=g.channel_id and i.receipt_id<>r.receipt_id
   and not exists(select from dv_market_private.psttg_v2_receipt_mapping_v1 m where m.receipt_id=i.receipt_id))
 and (not g.stopped or exists(select from dv_market_private.psttg_v2_ingress_v1 i where i.receipt_id=r.receipt_id
   and not exists(select from dv_market_private.psttg_v2_receipt_mapping_v1 m where m.receipt_id=i.receipt_id)));
end$$;

create function dv_market_private.psttg_w11_bind_verified_v1(input jsonb,attestation bytea,secret text) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare c jsonb; e jsonb; g dv_market_private.psttg_v2_channel_v1;
 a dv_market_private.psttg_v2_use_admission_v1; t dv_market_private.psttg_v2_use_transition_v1;
 r dv_market_private.psttg_w11_envelope_proof_v1; old dv_market_private.psttg_w11_envelope_proof_v1;
 canon uuid; b jsonb; ns text; key text; expected jsonb; n bigint;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='40001',message='w11_snapshot_retry';end if;
 if current_setting('synchronous_commit')<>'on' or current_setting('fsync')<>'on' then raise exception 'w11_durability';end if;
 if input is null or octet_length(input::text)>44739244 then raise exception 'w11_bundle_size';end if;
 perform dv_market_private.psttg_v2_shape(input,array['contract','codec','m02','context']);
 if input->>'contract' is distinct from 'V123-W11-verified-envelope-commit/1' or input->>'codec' is distinct from 'w11-canonical-json-base64/1' then raise exception 'w11_contract';end if;
 c:=input->'context';e:=c->'envelope';
 perform dv_market_private.psttg_v2_shape(c,array['proof_id','channel_id','operating_incarnation','operation_ref','envelope_revision','admission_id','attempt_transition_id','admission_commit_ref','input_revision','transition_commit_ref','transition_revision','scope_ids','configuration_revision','receipt_revision','mapping_revision','stop_revision','predecessor_proof_id','envelope','environment_binding']);
 select * into strict g from dv_market_private.psttg_v2_channel_v1 where channel_id=(c->>'channel_id')::uuid for update;
 if attestation is distinct from dv_market_private.psttg_w11_mac_v1(jsonb_build_array('w11-verified-input/1',input),g.verification_key) then raise exception 'w11_unverified_input';end if;
 if c->'environment_binding' is distinct from jsonb_build_object('origin','synthetic_test','environment','TEST','application','DAC7','dip_version','2.0','environment_ref',g.environment_ref,'account_ref',g.account_ref,'system_ref',g.target_system_ref) then raise exception 'w11_environment';end if;
 if c->>'envelope_revision' is distinct from input->'m02'->'spec'->>'revision' or input->'m02'->>'profile' is distinct from 'V119-M02-offline-envelope/1'
 or input->'m02'->'evidence'->>'status' is distinct from 'OFFLINE_PROFILE_VERIFIED' then raise exception 'w11_profile';end if;
 if e->>'result' is distinct from 'SIMULATED' or e->'payload'->>'detail_ref' is distinct from c->>'proof_id' or e->>'channel' is distinct from c->>'channel_id'
 or e->>'operating_incarnation' is distinct from c->>'operating_incarnation' or e->>'operation_ref' is distinct from c->>'operation_ref' then raise exception 'w11_context';end if;
 select * into strict a from dv_market_private.psttg_v2_use_admission_v1 where admission_id=(c->>'admission_id')::uuid;
 select * into strict t from dv_market_private.psttg_v2_use_transition_v1 where transition_id=(c->>'attempt_transition_id')::uuid;
 if a.channel_id<>g.channel_id or a.operation_ref::text is distinct from c->>'operation_ref' or a.operating_incarnation::text is distinct from c->>'operating_incarnation'
 or a.commit_ref::text is distinct from c->>'admission_commit_ref' or a.input_revision::text is distinct from c->>'input_revision' or to_jsonb(a.scope_ids) is distinct from c->'scope_ids'
 or t.admission_id<>a.admission_id or t.transition_kind<>'ATTEMPTING' or t.commit_ref::text is distinct from c->>'transition_commit_ref' or t.revision::text is distinct from c->>'transition_revision'
 or e->>'target_ref' is distinct from a.admission_id::text or e->>'attempt_ref' is distinct from t.attempt_id::text or e->>'epoch' is distinct from t.execution_epoch::text
 or a.registered_transaction=pg_current_xact_id() or t.registered_transaction=pg_current_xact_id() then raise exception 'w11_committed_context';end if;
 -- Compare frozen input, never random ciphertext or a refreshed channel snapshot.
 for old in select * from dv_market_private.psttg_w11_envelope_proof_v1 p where p.channel_id=g.channel_id and
  ((p.operating_incarnation=(c->>'operating_incarnation')::uuid and p.operation_ref=a.operation_ref and p.envelope_revision=(c->>'envelope_revision')::uuid)
   or p.event_ref=(e->>'event_ref')::uuid) order by p.proof_id for update loop
  b:=dv_market_private.psttg_w11_plain_v1(old.proof_id,secret);
  if b->'input'=input then return jsonb_build_object('proof_id',old.proof_id,'receipt_id',old.receipt_id,'record_kind',old.record_kind,'replay',true,'external_ack_performed',false);end if;
  if old.record_kind='BOUND' then
   if canon is not null and canon<>old.proof_id then raise exception 'w11_multiple_identity_conflict';end if;
   canon:=old.proof_id;
  end if;
 end loop;
 if canon is null and exists(select from dv_market_private.psttg_w11_envelope_proof_v1 where proof_id=(c->>'proof_id')::uuid) then raise exception 'w11_proof_id_conflict';end if;
 if g.quarantine or g.operating_incarnation::text is distinct from c->>'operating_incarnation' then raise exception 'w11_restore';end if;
 if canon is null then
  if g.stopped or g.execution_epoch<>t.execution_epoch or g.configuration_revision::text is distinct from c->>'configuration_revision'
   or g.receipt_revision::text is distinct from c->>'receipt_revision' or g.mapping_revision::text is distinct from c->>'mapping_revision' or g.stop_revision::text is distinct from c->>'stop_revision'
   or exists(select from dv_market_private.psttg_v2_use_transition_v1 x where x.admission_id=a.admission_id and x.revision>t.revision)
   then raise exception 'w11_stale_context';end if;
 end if;
 if exists(select from dv_market_private.psttg_v2_channel_v1 x where x.quarantine and x.scope_ids&&dv_market_private.psttg_v2_scopes(a.scope_ids))
 or exists(select from dv_market_private.psttg_scope_guards s where s.scope_id=any(dv_market_private.psttg_v2_scopes(a.scope_ids)) and (s.phase<>'open' or s.recovery_state<>'none')) then raise exception 'w11_global_guard';end if;
 if c->>'predecessor_proof_id' is not null then
  select * into strict old from dv_market_private.psttg_w11_envelope_proof_v1 where proof_id=(c->>'predecessor_proof_id')::uuid;
  if old.created_transaction=pg_current_xact_id() or old.record_kind<>'BOUND' or old.channel_id<>g.channel_id or old.proof_id=(c->>'proof_id')::uuid then raise exception 'w11_predecessor';end if;
 end if;
 r.proof_id:=(c->>'proof_id')::uuid;r.channel_id:=g.channel_id;r.operating_incarnation:=g.operating_incarnation;
 -- A verified alternate may reuse the submitted row address. Preserve that
 -- complete input and K; allocate only its separate CONFLICT evidence address.
 -- This never rotates K/event/attempt or creates a new canonical delivery.
 if canon is not null and exists(select from dv_market_private.psttg_w11_envelope_proof_v1 where proof_id=r.proof_id) then
  r.proof_id:=gen_random_uuid();
 end if;
 e:=jsonb_set(e,'{payload,detail_ref}',to_jsonb(r.proof_id::text));
 r.operation_ref:=a.operation_ref;r.envelope_revision:=(c->>'envelope_revision')::uuid;r.event_ref:=(e->>'event_ref')::uuid;
 r.admission_id:=a.admission_id;r.attempt_transition_id:=t.transition_id;r.predecessor_proof_id:=(c->>'predecessor_proof_id')::uuid;
 r.canonical_proof_id:=canon;r.record_kind:=case when canon is null then 'BOUND' else 'CONFLICT' end;r.contract:=input->>'contract';
 r.receipt_id:=dv_market_private.psttg_v2_receive_v1(g.channel_id,e,dv_market_private.psttg_w11_mac_v1(e,g.verification_key),secret);
 r.key_ref:=gen_random_uuid();r.commit_ref:=gen_random_uuid();r.created_transaction:=pg_current_xact_id();r.writer_backend_pid:=pg_backend_pid();r.created_at:=clock_timestamp();
 select nspname into strict ns from pg_catalog.pg_namespace where oid=(select extnamespace from pg_catalog.pg_extension where extname='pgcrypto');
 execute format('select encode(%I.gen_random_bytes(32),''hex'')',ns) into key;
 r.wrapped_key:=dv_market_private.psttg_encrypt(jsonb_build_object('key',key,'proof_id',r.proof_id,'key_ref',r.key_ref),secret);
 b:=jsonb_build_object('input',input,'input_sha256',encode(dv_market_private.psttg_v2_hash(input),'hex'),'ingress',e,'stored',to_jsonb(r)-array['wrapped_key','ciphertext','cipher_commitment']);
 r.ciphertext:=dv_market_private.psttg_encrypt(b,key);
 r.cipher_commitment:=dv_market_private.psttg_v2_hash(to_jsonb(r)-'cipher_commitment');
 insert into dv_market_private.psttg_w11_envelope_proof_v1 select r.*;
 return jsonb_build_object('proof_id',r.proof_id,'receipt_id',r.receipt_id,'record_kind',r.record_kind,'replay',false,'external_ack_performed',false);
end$$;

create function dv_market_private.psttg_w11_read_bound_v1(id uuid,secret text) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare r dv_market_private.psttg_w11_envelope_proof_v1;g dv_market_private.psttg_v2_channel_v1;b jsonb;o jsonb;m jsonb;begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'w11_snapshot_retry';end if;
 select * into strict r from dv_market_private.psttg_w11_envelope_proof_v1 where proof_id=id;
 if r.created_transaction=pg_current_xact_id() or (r.writer_backend_pid=pg_backend_pid() and r.created_at>=pg_postmaster_start_time()) then raise exception 'w11_independent_commit_observer_required';end if;
 select * into strict g from dv_market_private.psttg_v2_channel_v1 where channel_id=r.channel_id;
 b:=dv_market_private.psttg_w11_plain_v1(id,secret);
 o:=jsonb_build_object('observation_id',gen_random_uuid(),'proof_id',id,'commitment',encode(r.cipher_commitment,'hex'),
  'input_sha256',b->>'input_sha256','transaction',pg_current_xact_id()::text,'backend_pid',pg_backend_pid());
 select to_jsonb(a) into m from dv_market_private.psttg_w11_ack_ready_v1 a where proof_id=id;
 if m is not null and (m->>'proof_cipher_commitment' is distinct from '\x'||encode(r.cipher_commitment,'hex') or m->>'external_ack_performed'<>'false') then raise exception 'w11_marker_binding';end if;
 return jsonb_build_object('bundle',b,'observation',o,'observation_mac',encode(dv_market_private.psttg_w11_mac_v1(jsonb_build_array('w11-observation/1',o),g.verification_key),'hex'),
  'marker',m,'eligible',dv_market_private.psttg_w11_eligible_v1(id,secret),'external_ack_performed',false,'real_receipt_adapter',false);
end$$;

create function dv_market_private.psttg_w11_mark_ack_ready_v1(observation jsonb,observation_mac bytea,revalidated_mac bytea,secret text) returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare r dv_market_private.psttg_w11_envelope_proof_v1;g dv_market_private.psttg_v2_channel_v1;m dv_market_private.psttg_w11_ack_ready_v1;b jsonb;begin
 if current_setting('transaction_isolation')<>'read committed' or current_setting('synchronous_commit')<>'on' or current_setting('fsync')<>'on' then raise exception 'w11_durability';end if;
 perform dv_market_private.psttg_v2_shape(observation,array['observation_id','proof_id','commitment','input_sha256','transaction','backend_pid']);
 select * into strict r from dv_market_private.psttg_w11_envelope_proof_v1 where proof_id=(observation->>'proof_id')::uuid;
 select * into strict g from dv_market_private.psttg_v2_channel_v1 where channel_id=r.channel_id for update;
 perform 1 from dv_market_private.psttg_w11_envelope_proof_v1 where proof_id=r.proof_id for update;
 if observation_mac is distinct from dv_market_private.psttg_w11_mac_v1(jsonb_build_array('w11-observation/1',observation),g.verification_key)
 or revalidated_mac is distinct from dv_market_private.psttg_w11_mac_v1(jsonb_build_array('w11-revalidated/1',observation),g.verification_key) then raise exception 'w11_revalidation_required';end if;
 if observation->>'transaction' is distinct from pg_current_xact_id()::text or (observation->>'backend_pid')::int<>pg_backend_pid()
 or r.created_transaction=pg_current_xact_id() or (r.writer_backend_pid=pg_backend_pid() and r.created_at>=pg_postmaster_start_time()) then raise exception 'w11_independent_commit_observer_required';end if;
 b:=dv_market_private.psttg_w11_plain_v1(r.proof_id,secret);
 if observation->>'commitment' is distinct from encode(r.cipher_commitment,'hex') or observation->>'input_sha256' is distinct from b->>'input_sha256'
 or not dv_market_private.psttg_w11_eligible_v1(r.proof_id,secret) then raise exception 'w11_ack_blocked';end if;
 select * into m from dv_market_private.psttg_w11_ack_ready_v1 where proof_id=r.proof_id;
 if found then return to_jsonb(m);end if;
 m.marker_id:=gen_random_uuid();m.proof_id:=r.proof_id;m.proof_cipher_commitment:=r.cipher_commitment;
 m.observation_id:=(observation->>'observation_id')::uuid;m.observed_transaction:=pg_current_xact_id();m.observer_backend_pid:=pg_backend_pid();
 m.marker_transaction:=pg_current_xact_id();m.marked_at:=clock_timestamp();m.contract:=r.contract;m.external_ack_performed:=false;
 insert into dv_market_private.psttg_w11_ack_ready_v1 select m.*;
 return to_jsonb(m); -- not visible/ack-ready until TX2 itself commits
end$$;

create function dv_market_private.psttg_w11_append_only_v1() returns trigger
language plpgsql security invoker set search_path='' as $$declare stack text;fn text;begin
 if TG_OP<>'INSERT' then raise exception 'w11_append_only';end if;
 fn:=case TG_TABLE_NAME when 'psttg_w11_envelope_proof_v1' then 'psttg_w11_bind_verified_v1' when 'psttg_w11_ack_ready_v1' then 'psttg_w11_mark_ack_ready_v1' else null end;
 get diagnostics stack=PG_CONTEXT;
 if fn is null or stack !~ ('function dv_market_private\.'||fn||'\(') then raise exception 'w11_private_entry';end if;
 return new;
end$$;
do $$declare t text;p regprocedure;begin
 foreach t in array array['psttg_w11_envelope_proof_v1','psttg_w11_ack_ready_v1'] loop
  execute format('alter table dv_market_private.%I owner to dv_psttg_core_owner',t);
  execute format('alter table dv_market_private.%I enable row level security',t);
  execute format('revoke all on dv_market_private.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger w11_append_only before insert or update or delete on dv_market_private.%I for each row execute function dv_market_private.psttg_w11_append_only_v1()',t);
  execute format('create trigger w11_no_truncate before truncate on dv_market_private.%I for each statement execute function dv_market_private.psttg_w11_append_only_v1()',t);
 end loop;
 for p in select x.oid::regprocedure from pg_catalog.pg_proc x join pg_catalog.pg_namespace n on n.oid=x.pronamespace where n.nspname='dv_market_private' and x.proname like 'psttg_w11_%' loop
  execute format('alter function %s owner to dv_psttg_core_owner',p);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',p);
 end loop;
end$$;
commit;
