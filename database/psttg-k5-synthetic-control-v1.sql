-- Isolated V108 synthetic control candidate. No migration, application adapter,
-- real effect, purge, worker, Hold integration or provider capability.
begin;
create table dv_market_private.psttg_k5_channel_gate (
 channel_id uuid primary key,
 environment text not null check(environment='disposable-only'),
 account_ref uuid not null,
 scope_ids uuid[] not null check(cardinality(scope_ids)>0),
 exclusive_scope boolean not null,
 incarnation uuid not null,
 verification_key bytea not null check(octet_length(verification_key)>=32),
 receipt_revision bigint not null default 0,
 stopped boolean not null default false,
 quarantine boolean not null default false,
 contract text not null check(contract in ('synthetic-atomic-v1','unsupported'))
);
create table dv_market_private.psttg_k5_end_intent (
 intent_id uuid primary key, command_id uuid not null unique,
 command_digest bytea not null,
 revision bigint not null check(revision>0),
 channel_id uuid not null references dv_market_private.psttg_k5_channel_gate,
 scope_ids uuid[] not null,
 manifest jsonb not null,
 before_binding jsonb not null,
 expected_scope_rows jsonb not null,
 gate_revision bigint not null,
 incarnation uuid not null,
 state text not null check(state in ('FENCED_READY','DISPATCH_RECORDED','OUTCOME_UNKNOWN','DEFINITELY_NOT_APPLIED','PARTIAL','RECOVERY_REQUIRED','RESTORE_QUARANTINE','CLOSED_VERIFIED','CANCELLED_SAFE')),
 state_revision bigint not null default 1,
 created_at timestamptz not null default clock_timestamp()
);
-- Append-only command and per-target attempt/result journal. A command row
-- records the projection revision it caused. No mutable outcome setter.
create table dv_market_private.psttg_k5_end_attempt (
 entry_id uuid primary key default gen_random_uuid(),
 command_id uuid not null unique, command_digest bytea not null,
 intent_id uuid, intent_revision bigint, state_revision bigint,
 attempt_id uuid, target jsonb, incarnation uuid, execution_epoch bigint,
 kind text not null check(kind in ('ADMISSION','COPY','DISPATCH_RECORDED','OUTCOME_UNKNOWN','APPLIED_SIMULATED','DEFINITELY_NOT_APPLIED','RECOVERY_REQUIRED','CLOSED_VERIFIED','CANCELLED_SAFE','RESTORE_QUARANTINE','PURPOSE_REVIEW')),
 binding jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
-- Intentionally NO FK to intent, attempt, O1-O5, auth or target objects.
create table dv_market_private.psttg_k5_evidence_receipt (
 receipt_id uuid primary key default gen_random_uuid(),
 channel_id uuid not null, environment text not null, account_ref uuid not null,
 event_id text not null, content_digest bytea not null,
 header jsonb not null, payload_ciphertext bytea not null,
 received_at timestamptz not null default clock_timestamp(),
 purpose text not null check(purpose='synthetic_result_reconciliation'),
 end_condition text not null check(end_condition='verified_transfer_and_no_remaining_dependency'),
 unique(channel_id,environment,account_ref,event_id,content_digest)
);
create function dv_market_private.psttg_k5_immutable_intent() returns trigger
language plpgsql set search_path='' as $$begin
 if TG_OP<>'UPDATE' then raise exception 'k5_immutable';end if;
 if (to_jsonb(new)-array['state','state_revision','expected_scope_rows','gate_revision']) is distinct from
    (to_jsonb(old)-array['state','state_revision','expected_scope_rows','gate_revision']) then raise exception 'k5_immutable_revision';end if;
 if new.state_revision<>old.state_revision+1 then raise exception 'k5_state_revision';end if;
 return new;
end$$;
create trigger k5_intent_immutable before update or delete on dv_market_private.psttg_k5_end_intent for each row execute function dv_market_private.psttg_k5_immutable_intent();
create trigger k5_intent_no_truncate before truncate on dv_market_private.psttg_k5_end_intent for each statement execute function dv_market_private.psttg_reject_mutation();
create trigger k5_attempt_immutable before update or delete on dv_market_private.psttg_k5_end_attempt for each row execute function dv_market_private.psttg_reject_mutation();
create trigger k5_attempt_no_truncate before truncate on dv_market_private.psttg_k5_end_attempt for each statement execute function dv_market_private.psttg_reject_mutation();
create trigger k5_receipt_immutable before update or delete on dv_market_private.psttg_k5_evidence_receipt for each row execute function dv_market_private.psttg_reject_mutation();
create trigger k5_receipt_no_truncate before truncate on dv_market_private.psttg_k5_evidence_receipt for each statement execute function dv_market_private.psttg_reject_mutation();

create function dv_market_private.psttg_k5_digest(v jsonb) returns bytea
language sql immutable set search_path='' as $$select sha256(convert_to(v::text,'UTF8'))$$;
-- Ticket must be signed by the controlled peer, binding this exact backend
-- transaction and command. The peer is outside the restored database.
create function dv_market_private.psttg_k5_challenge() returns jsonb
language sql volatile set search_path='' as $$
 select jsonb_build_object('transaction',pg_current_xact_id()::text,'pid',pg_backend_pid(),'started',transaction_timestamp())
$$;
create function dv_market_private.psttg_k5_verify(channel uuid,body jsonb,signature bytea) returns void
language plpgsql volatile security definer set search_path='' as $$
declare k bytea; ns text; expected bytea;
begin
 select verification_key into strict k from dv_market_private.psttg_k5_channel_gate where channel_id=channel;
 select n.nspname into strict ns from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
 execute format('select %I.hmac($1,$2,''sha256'')',ns) into expected using convert_to(body::text,'UTF8'),k;
 if signature is null or signature is distinct from expected then raise exception 'k5_unauthentic';end if;
end$$;
create function dv_market_private.psttg_k5_entry(channel uuid,command jsonb,ticket jsonb,signature bytea) returns void
language plpgsql volatile security definer set search_path='' as $$
declare g dv_market_private.psttg_k5_channel_gate;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='40001',message='k5_snapshot_retry';end if;
 perform dv_market_private.psttg_k5_verify(channel,ticket,signature);
 select * into strict g from dv_market_private.psttg_k5_channel_gate where channel_id=channel;
 if ticket is distinct from jsonb_build_object('challenge',dv_market_private.psttg_k5_challenge(),'command_digest',encode(dv_market_private.psttg_k5_digest(command),'hex'),'incarnation',g.incarnation,'channel',channel,'contract','synthetic-atomic-v1')
 or g.quarantine then raise exception 'k5_restore_quarantine';end if;
 if g.contract<>'synthetic-atomic-v1' then raise exception 'k5_not_authorizable_channel';end if;
end$$;
create function dv_market_private.psttg_k5_lock(channel uuid,seeds uuid[],allow_stop boolean default false) returns uuid[]
language plpgsql volatile security definer set search_path='' as $$
declare g dv_market_private.psttg_k5_channel_gate; ids uuid[]; r record;
begin
 select * into strict g from dv_market_private.psttg_k5_channel_gate where channel_id=channel for update;
 if g.quarantine or (g.stopped and not allow_stop) then raise exception 'k5_channel_stopped';end if;
 ids:=dv_market_private.psttg_evaluation_scopes(seeds);
 if exists(select from dv_market_private.psttg_k5_channel_gate where channel_id<>channel and scope_ids && ids) then raise exception 'k5_not_authorizable_channel_mapping';end if;
 if ids is null or cardinality(ids)=0 or not(ids<@g.scope_ids) or not(g.scope_ids<@ids) or not g.exclusive_scope then raise exception 'scope_granularity_unresolved';end if;
 for r in select scope_id from dv_market_private.psttg_scope_guards where scope_id=any(ids) order by scope_id for update loop null;end loop;
 if ids is distinct from dv_market_private.psttg_evaluation_scopes(seeds) then raise exception using errcode='40001',message='k5_scope_growth_retry';end if;
 if (select count(*) from dv_market_private.psttg_scope_guards where scope_id=any(ids))<>cardinality(ids) then raise exception 'k5_scope_missing';end if;
 if exists(select from dv_market_private.psttg_origin_bindings where scope_ids && ids and (operating_mode<>'synthetic_test' or classification_basis<>'isolated_fixture' or environment_id<>'disposable-only')) then raise exception 'k5_synthetic_scope_only';end if;
 return ids;
end$$;
create function dv_market_private.psttg_k5_scope_rows(ids uuid[]) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by scope_id),'[]') from dv_market_private.psttg_scope_guards x where scope_id=any(ids)
$$;
create function dv_market_private.psttg_k5_assert_intent(id uuid,rev bigint,expected_state_revision bigint,allow_stop boolean default false) returns dv_market_private.psttg_k5_end_intent
language plpgsql volatile security definer set search_path='' as $$
declare i dv_market_private.psttg_k5_end_intent; g dv_market_private.psttg_k5_channel_gate; b jsonb; ids uuid[];
begin
 select * into strict i from dv_market_private.psttg_k5_end_intent where intent_id=id;
 ids:=dv_market_private.psttg_k5_lock(i.channel_id,i.scope_ids,allow_stop);
 select * into strict i from dv_market_private.psttg_k5_end_intent where intent_id=id for update;
 select * into strict g from dv_market_private.psttg_k5_channel_gate where channel_id=i.channel_id;
 if i.revision<>rev or i.state_revision<>expected_state_revision or i.incarnation<>g.incarnation then raise exception 'k5_stale_revision';end if;
 if i.state in ('CLOSED_VERIFIED','CANCELLED_SAFE','RESTORE_QUARANTINE') then raise exception 'k5_terminal';end if;
 if dv_market_private.psttg_k5_scope_rows(ids) is distinct from i.expected_scope_rows then raise exception 'k5_foreign_scope_change';end if;
 b:=dv_market_private.evaluate_psttg_removal(ids,i.before_binding->'targets')->'binding';
 -- Compare only immutable core and target/rule identity. O5 is compared in full
 -- above against the exact rows written by our own recorded transition.
 if b->'core_fingerprint' is distinct from i.before_binding->'core_fingerprint'
 or b->'targets' is distinct from i.before_binding->'targets'
 or b->'rule_version' is distinct from i.before_binding->'rule_version'
 or b->'requested_scope_ids' is distinct from i.before_binding->'requested_scope_ids' then raise exception 'k5_foreign_core_change';end if;
 if not allow_stop and (g.receipt_revision<>i.gate_revision or g.stopped) then raise exception 'k5_evidence_stop';end if;
 return i;
end$$;

create function dv_market_private.psttg_k5_authorize(command jsonb,ticket jsonb,signature bytea) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare ch uuid:=(command->>'channel')::uuid; id uuid:=(command->>'intent_id')::uuid; cmd uuid:=(command->>'command_id')::uuid;
 ids uuid[]; b jsonb; a jsonb; old dv_market_private.psttg_k5_end_intent; g dv_market_private.psttg_k5_channel_gate; t jsonb;
begin
 if command is null or not(command ?& array['channel','intent_id','command_id','revision','scopes','binding','manifest','evidence']) or command-array['channel','intent_id','command_id','revision','scopes','binding','manifest','evidence']<>'{}'::jsonb then raise exception 'k5_command_shape';end if;
 perform dv_market_private.psttg_k5_entry(ch,command,ticket,signature);
 select array_agg(x::uuid order by x) into ids from jsonb_array_elements_text(command->'scopes') x;
 ids:=dv_market_private.psttg_k5_lock(ch,ids);
 select * into old from dv_market_private.psttg_k5_end_intent where command_id=cmd;
 if found then
  if old.command_digest<>dv_market_private.psttg_k5_digest(command) then raise exception 'k5_idempotency_conflict';end if;
  return old.intent_id;
 end if;
 select * into strict g from dv_market_private.psttg_k5_channel_gate where channel_id=ch;
 a:=dv_market_private.check_psttg_evaluation_current(command->'binding');
 if a->>'status'<>'current_core_snapshot' then raise exception 'k5_stale_assessment';end if;
 b:=a->'current_binding';
 if not((command->'scopes') @> (b->'requested_scope_ids')) or not((b->'requested_scope_ids') @> (command->'scopes')) then raise exception 'k5_scope_omission';end if;
 -- Positive evidence is signed by the independent synthetic peer as part of
 -- this exact command; it does not assert anything about real obligations.
 if command->'evidence' is distinct from '{"coverage":"synthetic_manifest_only","other_obligations":"synthetic_fixture_only","channel":"synthetic-atomic-v1","purpose":"non_destructive_simulation"}'::jsonb then raise exception 'k5_not_authorizable_evidence';end if;
 if jsonb_typeof(command->'manifest')<>'array' or jsonb_array_length(command->'manifest')=0 then raise exception 'k5_manifest';end if;
 for t in select value from jsonb_array_elements(command->'manifest') loop
  if not(t ?& array['target','incarnation','action','channel','version_digest']) or t-array['target','incarnation','action','channel','version_digest']<>'{}'::jsonb
   or t->>'action' is distinct from 'SIMULATE_ONLY' or t->>'channel' is distinct from ch::text or (t->>'incarnation')::uuid is null
   or t->'target'->>'kind' is distinct from 'record' or t->'target'->'segments' is distinct from '["whole"]'::jsonb
   or not(b->'targets' @> jsonb_build_array(t->'target')) then raise exception 'k5_not_authorizable_target';end if;
  if not exists(select from dv_market_private.psttg_records r where r.record_id=(t->'target'->>'id')::uuid and r.content_revision=t->'target'->>'version' and encode(r.payload_digest,'hex')=t->>'version_digest' and r.record_state='evidenced' and r.end_at<=clock_timestamp()) then raise exception 'k5_not_authorizable_record';end if;
 end loop;
 if jsonb_array_length(command->'manifest')<>jsonb_array_length(b->'targets')
 or (select count(distinct x->'target') from jsonb_array_elements(command->'manifest') x)<>jsonb_array_length(b->'targets') then raise exception 'k5_manifest_coverage';end if;
 if exists(select from dv_market_private.psttg_records r where scope_ids && ids and not(b->'targets' @> jsonb_build_array(jsonb_build_object('kind','record','id',record_id,'version',content_revision,'segments',jsonb_build_array('whole'))))) then raise exception 'scope_granularity_unresolved';end if;
 if exists(select from dv_market_private.psttg_operation_events where scope_ids && ids and event_kind='copy') then raise exception 'k5_not_authorizable_copy_target_mapping';end if;
 if exists(select from jsonb_array_elements(a->'current_assessment'->'targets') x cross join lateral jsonb_array_elements(x->'records') r where r->>'provenance_status'<>'test_or_sandbox' or r->>'time_status'<>'documented_boundary_reached')
 or exists(select from (select distinct on(operation_id) event_kind from dv_market_private.psttg_operation_events where scope_ids && ids order by operation_id,event_seq desc) x where event_kind in ('ready','attempting','outcome_unknown')) then raise exception 'k5_not_authorizable_pending';end if;
 update dv_market_private.psttg_scope_guards set phase='fenced',generation=generation+1,fence_token=id,fence_target_digest=dv_market_private.psttg_k5_digest(command->'manifest'),fence_generation=generation+1,recovery_state='pending' where scope_id=any(ids) and phase='open' and recovery_state='none';
 insert into dv_market_private.psttg_k5_end_intent(intent_id,command_id,command_digest,revision,channel_id,scope_ids,manifest,before_binding,expected_scope_rows,gate_revision,incarnation,state)
 values(id,cmd,dv_market_private.psttg_k5_digest(command),(command->>'revision')::bigint,ch,ids,command->'manifest',b,dv_market_private.psttg_k5_scope_rows(ids),g.receipt_revision,g.incarnation,'FENCED_READY');
 return id;
end$$;

-- Full requirement binding before existing O2 paths. Does not issue an external
-- capability; its committed row is checked by the controlled peer separately.
create function dv_market_private.psttg_k5_admit(command jsonb,ticket jsonb,signature bytea,secret text) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare ch uuid:=(command->>'channel')::uuid; cmd uuid:=(command->>'command_id')::uuid;
 ids uuid[]; e jsonb:=command->'event'; old dv_market_private.psttg_k5_end_attempt; eid uuid; o dv_market_private.psttg_origin_bindings; r record;
begin
 if command is null or not(command ?& array['channel','command_id','scopes','event','expected_sequence','input','requirements']) or command-array['channel','command_id','scopes','event','expected_sequence','input','requirements']<>'{}'::jsonb then raise exception 'k5_command_shape';end if;
 perform dv_market_private.psttg_k5_entry(ch,command,ticket,signature);
 perform pg_advisory_xact_lock(hashtextextended(e->>'operation_id',741105));
 select array_agg(x::uuid order by x) into ids from jsonb_array_elements_text(command->'scopes') x;
 ids:=dv_market_private.psttg_k5_lock(ch,ids);
 select * into old from dv_market_private.psttg_k5_end_attempt where command_id=cmd;
 if found then
  if old.command_digest<>dv_market_private.psttg_k5_digest(command) then raise exception 'k5_idempotency_conflict';end if;
  return old.entry_id;
 end if;
 perform dv_market_private.psttg_lock_scopes(ids);
 select * into strict o from dv_market_private.psttg_origin_bindings where origin_id=(e->>'origin_id')::uuid;
 if not(o.scope_ids<@ids) or jsonb_typeof(command->'requirements')<>'array' or jsonb_array_length(command->'requirements')=0 then raise exception 'k5_requirement_missing';end if;
 for r in select value t from jsonb_array_elements(command->'requirements') loop
  if r.t->>'kind'='origin' then
   if not exists(select from dv_market_private.psttg_origin_bindings where origin_id=(r.t->>'id')::uuid and source_version=r.t->>'version' and scope_ids<@ids) then raise exception 'k5_requirement_origin';end if;
  elsif r.t->>'kind'='record' then
   if not exists(select from dv_market_private.psttg_records where record_id=(r.t->>'id')::uuid and content_revision=r.t->>'version' and scope_ids<@ids) then raise exception 'k5_requirement_record';end if;
  else raise exception 'k5_requirement_unresolved';end if;
 end loop;
 if e->>'event_kind' not in ('ready','copy','attempting') then raise exception 'k5_admission_transition';end if;
 if e->>'event_kind'='copy' and not(command->'requirements' @> jsonb_build_array(jsonb_build_object('kind','record','id',e->>'original_record_id','version',e->>'original_version'))) then raise exception 'k5_copy_requirement';end if;
 if e->>'event_kind'='attempting' and not exists(select from dv_market_private.psttg_k5_end_attempt where kind='ADMISSION' and binding->'event'->>'operation_id'=e->>'operation_id' and binding->'event'->>'event_kind'='ready' and binding->'requirements'=command->'requirements') then raise exception 'k5_prior_admission_required';end if;
 eid:=dv_market_private.psttg_append_event(e,(command->>'expected_sequence')::bigint,case when e->>'event_kind'='ready' then jsonb_build_object('input_snapshot',command->'input') else null end,secret);
 insert into dv_market_private.psttg_k5_end_attempt(command_id,command_digest,kind,binding)
 values(cmd,dv_market_private.psttg_k5_digest(command),case when e->>'event_kind'='copy' then 'COPY' else 'ADMISSION' end,command||jsonb_build_object('event_id',eid)) returning entry_id into eid;
 return eid;
end$$;

create function dv_market_private.psttg_k5_begin(command jsonb,ticket jsonb,signature bytea) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare i dv_market_private.psttg_k5_end_intent; old dv_market_private.psttg_k5_end_attempt; a uuid:=(command->>'attempt_id')::uuid; e uuid;
begin
 if command is null or not(command ?& array['channel','command_id','intent_id','revision','state_revision','attempt_id','target']) or command-array['channel','command_id','intent_id','revision','state_revision','attempt_id','target']<>'{}'::jsonb then raise exception 'k5_command_shape';end if;
 perform dv_market_private.psttg_k5_entry((command->>'channel')::uuid,command,ticket,signature);
 select * into old from dv_market_private.psttg_k5_end_attempt where command_id=(command->>'command_id')::uuid;
 if found then if old.command_digest<>dv_market_private.psttg_k5_digest(command) then raise exception 'k5_idempotency_conflict';end if;return old.attempt_id;end if;
 i:=dv_market_private.psttg_k5_assert_intent((command->>'intent_id')::uuid,(command->>'revision')::bigint,(command->>'state_revision')::bigint);
 if i.channel_id<>(command->>'channel')::uuid or not(i.manifest @> jsonb_build_array(command->'target')) then raise exception 'k5_target_binding';end if;
 if i.state not in ('FENCED_READY','DEFINITELY_NOT_APPLIED','PARTIAL') then raise exception 'k5_unknown_no_retry';end if;
 if exists(select from dv_market_private.psttg_k5_end_attempt where intent_id=i.intent_id and target=command->'target' and kind='APPLIED_SIMULATED') then raise exception 'k5_target_already_applied';end if;
 if exists(select from dv_market_private.psttg_k5_end_attempt d where d.intent_id=i.intent_id and d.kind='DISPATCH_RECORDED' and not exists(select from dv_market_private.psttg_k5_end_attempt r where r.attempt_id=d.attempt_id and r.kind in ('APPLIED_SIMULATED','DEFINITELY_NOT_APPLIED'))) then raise exception 'k5_unknown_no_retry';end if;
 if exists(select from dv_market_private.psttg_k5_end_attempt where attempt_id=a) then raise exception 'k5_attempt_reuse';end if;
 insert into dv_market_private.psttg_k5_end_attempt(command_id,command_digest,intent_id,intent_revision,state_revision,attempt_id,target,incarnation,execution_epoch,kind,binding)
 values((command->>'command_id')::uuid,dv_market_private.psttg_k5_digest(command),i.intent_id,i.revision,i.state_revision+1,a,command->'target',i.incarnation,i.state_revision+1,'DISPATCH_RECORDED',command);
 update dv_market_private.psttg_k5_end_intent set state='DISPATCH_RECORDED',state_revision=state_revision+1 where intent_id=i.intent_id;
 return a;
end$$;

-- Signed canonical envelope from the controlled peer; free authenticity or
-- success flags are not part of this interface. Sensitive payload encrypted.
create function dv_market_private.psttg_k5_receive(channel uuid,envelope jsonb,signature bytea,secret text) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare g dv_market_private.psttg_k5_channel_gate; r dv_market_private.psttg_k5_evidence_receipt; h bytea:=dv_market_private.psttg_k5_digest(envelope); conflict boolean;
begin
 perform dv_market_private.psttg_k5_verify(channel,envelope,signature);
 select * into strict g from dv_market_private.psttg_k5_channel_gate where channel_id=channel for update;
 if envelope is null or not(envelope ?& array['source','environment','account','event_id','operation','attempt','target','incarnation','execution_epoch','result','payload','actual_event_at'])
 or envelope-array['source','environment','account','event_id','operation','attempt','target','incarnation','execution_epoch','result','payload','actual_event_at']<>'{}'::jsonb
 or envelope->>'source' is distinct from 'synthetic-atomic-v1' or envelope->>'environment' is distinct from g.environment or envelope->>'account' is distinct from g.account_ref::text
 or coalesce(length(envelope->>'event_id'),0) not between 1 and 200 or coalesce(envelope->>'result','') not in ('APPLIED_SIMULATED','DEFINITELY_NOT_APPLIED','UNMAPPED') or jsonb_typeof(envelope->'payload') is distinct from 'object' then raise exception 'k5_evidence_binding';end if;
 select * into r from dv_market_private.psttg_k5_evidence_receipt where channel_id=channel and environment=g.environment and account_ref=g.account_ref and event_id=envelope->>'event_id' and content_digest=h;
 if found then return r.receipt_id;end if;
 select exists(select from dv_market_private.psttg_k5_evidence_receipt where channel_id=channel and environment=g.environment and account_ref=g.account_ref and event_id=envelope->>'event_id') into conflict;
 insert into dv_market_private.psttg_k5_evidence_receipt(channel_id,environment,account_ref,event_id,content_digest,header,payload_ciphertext,purpose,end_condition)
 values(channel,g.environment,g.account_ref,envelope->>'event_id',h,(envelope-'payload')||jsonb_build_object('conflict',conflict),dv_market_private.psttg_encrypt(envelope->'payload',secret),'synthetic_result_reconciliation','verified_transfer_and_no_remaining_dependency') returning * into r;
 update dv_market_private.psttg_k5_channel_gate set receipt_revision=receipt_revision+1,stopped=true where channel_id=channel;
 return r.receipt_id; -- SQL result is NOT a durable acknowledgement before COMMIT.
end$$;
create function dv_market_private.psttg_k5_transition(command jsonb,ticket jsonb,signature bytea) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare i dv_market_private.psttg_k5_end_intent; d dv_market_private.psttg_k5_end_attempt; old dv_market_private.psttg_k5_end_attempt;
 r dv_market_private.psttg_k5_evidence_receipt; g dv_market_private.psttg_k5_channel_gate; action text:=command->>'action'; next_state text; eid uuid; nr bigint;
begin
 if command is null or not(command ?& array['channel','command_id','intent_id','revision','state_revision','action','receipt_id']) or command-array['channel','command_id','intent_id','revision','state_revision','action','receipt_id']<>'{}'::jsonb then raise exception 'k5_command_shape';end if;
 perform dv_market_private.psttg_k5_entry((command->>'channel')::uuid,command,ticket,signature);
 select * into old from dv_market_private.psttg_k5_end_attempt where command_id=(command->>'command_id')::uuid;
 if found then if old.command_digest<>dv_market_private.psttg_k5_digest(command) then raise exception 'k5_idempotency_conflict';end if;return old.entry_id;end if;
 i:=dv_market_private.psttg_k5_assert_intent((command->>'intent_id')::uuid,(command->>'revision')::bigint,(command->>'state_revision')::bigint,true);
 if i.channel_id<>(command->>'channel')::uuid then raise exception 'k5_channel_binding';end if;
 select * into strict g from dv_market_private.psttg_k5_channel_gate where channel_id=i.channel_id;
 if action='RECONCILE' then
  select * into strict r from dv_market_private.psttg_k5_evidence_receipt where receipt_id=(command->>'receipt_id')::uuid;
  if r.channel_id<>i.channel_id or r.header->>'conflict'<>'false' then raise exception 'k5_receipt_conflict';end if;
  select * into d from dv_market_private.psttg_k5_end_attempt where kind='DISPATCH_RECORDED' and attempt_id=(r.header->>'attempt')::uuid;
  if not found or d.intent_id<>i.intent_id or d.target is distinct from r.header->'target' or d.incarnation::text is distinct from r.header->>'incarnation'
   or d.execution_epoch::text is distinct from r.header->>'execution_epoch' or r.header->>'operation'<>i.intent_id::text then raise exception 'k5_receipt_unmapped';end if;
  if exists(select from dv_market_private.psttg_k5_end_attempt where attempt_id=d.attempt_id and kind in ('APPLIED_SIMULATED','DEFINITELY_NOT_APPLIED')) then raise exception 'k5_result_already_recorded';end if;
  action:=r.header->>'result';
  if action not in ('APPLIED_SIMULATED','DEFINITELY_NOT_APPLIED') then raise exception 'k5_receipt_unmapped';end if;
  next_state:=case when action='APPLIED_SIMULATED' then 'PARTIAL' else 'DEFINITELY_NOT_APPLIED' end;
 elsif action='OUTCOME_UNKNOWN' then
  if i.state<>'DISPATCH_RECORDED' then raise exception 'k5_unknown_transition';end if;
  select * into strict d from dv_market_private.psttg_k5_end_attempt where intent_id=i.intent_id and kind='DISPATCH_RECORDED' order by state_revision desc limit 1;
  next_state:='OUTCOME_UNKNOWN';
 elsif action='RECOVERY_REQUIRED' then
  if not g.stopped then raise exception 'k5_recovery_evidence_missing';end if;
  next_state:='RECOVERY_REQUIRED';
 elsif action in ('CLOSED_VERIFIED','CANCELLED_SAFE') then
  if g.stopped or g.receipt_revision<>i.gate_revision then raise exception 'k5_evidence_stop';end if;
  if exists(select from dv_market_private.psttg_k5_end_attempt a where a.intent_id=i.intent_id and a.kind='DISPATCH_RECORDED' and not exists(select from dv_market_private.psttg_k5_end_attempt z where z.attempt_id=a.attempt_id and z.kind in ('APPLIED_SIMULATED','DEFINITELY_NOT_APPLIED'))) then raise exception 'k5_unknown_no_retry';end if;
  if action='CANCELLED_SAFE' then
   if exists(select from dv_market_private.psttg_k5_end_attempt where intent_id=i.intent_id and kind='APPLIED_SIMULATED') then raise exception 'k5_partial_no_reopen';end if;
   update dv_market_private.psttg_scope_guards set generation=generation+1,phase='open',recovery_state='none',fence_token=null,fence_target_digest=null,fence_generation=null where scope_id=any(i.scope_ids) and fence_token=i.intent_id;
  else
   if exists(select from jsonb_array_elements(i.manifest) t where not exists(select from dv_market_private.psttg_k5_end_attempt where intent_id=i.intent_id and kind='APPLIED_SIMULATED' and target=t)) then raise exception 'k5_manifest_incomplete';end if;
   update dv_market_private.psttg_scope_guards set generation=generation+1,phase='closed',recovery_state='none' where scope_id=any(i.scope_ids) and fence_token=i.intent_id;
  end if;
  next_state:=action;
 else raise exception 'k5_invalid_transition';end if;
 insert into dv_market_private.psttg_k5_end_attempt(command_id,command_digest,intent_id,intent_revision,state_revision,attempt_id,target,incarnation,execution_epoch,kind,binding)
 values((command->>'command_id')::uuid,dv_market_private.psttg_k5_digest(command),i.intent_id,i.revision,i.state_revision+1,d.attempt_id,d.target,d.incarnation,d.execution_epoch,action,command) returning entry_id into eid;
 -- Only reconciled, nonconflicting receipts for this scope permit a new step.
 if action in ('APPLIED_SIMULATED','DEFINITELY_NOT_APPLIED') then
  if not exists(select from dv_market_private.psttg_k5_evidence_receipt x where x.channel_id=i.channel_id and not exists(select from dv_market_private.psttg_k5_end_attempt a where a.binding->>'receipt_id'=x.receipt_id::text and a.kind in ('APPLIED_SIMULATED','DEFINITELY_NOT_APPLIED')))
  then update dv_market_private.psttg_k5_channel_gate set stopped=false where channel_id=i.channel_id;
  else next_state:='RECOVERY_REQUIRED';end if;
 end if;
 if next_state in ('PARTIAL','RECOVERY_REQUIRED') then
  update dv_market_private.psttg_scope_guards set generation=generation+1,recovery_state=case when exists(select from dv_market_private.psttg_k5_end_attempt where intent_id=i.intent_id and kind='APPLIED_SIMULATED') then 'partial' else 'failed' end where scope_id=any(i.scope_ids) and fence_token=i.intent_id;
 end if;
 update dv_market_private.psttg_k5_end_intent set state=next_state,state_revision=state_revision+1,expected_scope_rows=dv_market_private.psttg_k5_scope_rows(i.scope_ids),gate_revision=g.receipt_revision where intent_id=i.intent_id;
 return eid;
end$$;
-- Restore entry is monotone quarantine, not a resume or epoch setter. Evidence
-- ingress remains usable. Independent peer refuses tickets after restore.
create function dv_market_private.psttg_k5_quarantine(channel uuid,notice jsonb,signature bytea) returns void
language plpgsql volatile security definer set search_path='' as $$
declare g dv_market_private.psttg_k5_channel_gate; ids uuid[]; r record;
begin
 perform dv_market_private.psttg_k5_verify(channel,notice,signature);
 if notice->>'action' is distinct from 'RESTORE_QUARANTINE' or notice->>'channel' is distinct from channel::text
 or not(notice ?& array['external_incarnation','action','channel']) or notice-array['external_incarnation','action','channel']<>'{}'::jsonb then raise exception 'k5_restore_notice';end if;
 select * into strict g from dv_market_private.psttg_k5_channel_gate where channel_id=channel for update;
 if g.quarantine then return;end if;
 ids:=dv_market_private.psttg_evaluation_scopes(g.scope_ids);
 for r in select scope_id from dv_market_private.psttg_scope_guards where scope_id=any(ids) order by scope_id for update loop null;end loop;
 if ids is distinct from dv_market_private.psttg_evaluation_scopes(g.scope_ids) then raise exception using errcode='40001',message='k5_scope_growth_retry';end if;
 update dv_market_private.psttg_k5_channel_gate set quarantine=true,stopped=true where channel_id=channel;
 update dv_market_private.psttg_k5_end_intent set state='RESTORE_QUARANTINE',state_revision=state_revision+1 where channel_id=channel and state not in ('CLOSED_VERIFIED','CANCELLED_SAFE');
end$$;

do $acl$
declare r record;
begin
 for r in select c.oid::regclass obj from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='dv_market_private' and c.relkind='r' and c.relname like 'psttg_k5_%' loop
  execute format('alter table %s owner to dv_psttg_core_owner',r.obj);
  execute format('revoke all on %s from public,anon,authenticated,service_role',r.obj);
 end loop;
 for r in select p.oid::regprocedure obj from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and p.proname like 'psttg_k5_%' loop
  execute format('alter function %s owner to dv_psttg_core_owner',r.obj);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.obj);
 end loop;
end$acl$;
commit;
