-- V112 isolated synthetic connection. Installed ONLY by disposable tests.
-- psttg-v2-writer-use/1 and psttg-k5-unitmanifest/1. No destructive adapter.
begin;
create table dv_market_private.psttg_v2_connection_context_v1(
 context_id uuid primary key, backend integer not null, transaction_id xid8 not null,
 scopes uuid[] not null, units uuid[] not null, operation_keys bigint[] not null,
 command_keys bigint[] not null, channel_ids uuid[] not null,
 unique(backend,transaction_id)
);
-- The context is a private, transaction-bound capability, not a caller flag.
-- A context cannot be committed or created outside an actual enclosing entry.
create function dv_market_private.psttg_v2_context_caller_v1() returns void
language plpgsql volatile security definer set search_path='' as $$
declare stack text;begin
 get diagnostics stack=PG_CONTEXT;
 if stack !~ 'function dv_market_private\.psttg_v2_(execute_v1|capture|read|connection_read_v1|quarantine_v1)\(' then
  raise exception 'v2_internal_context_required';
 end if;
end$$;
create function dv_market_private.psttg_v2_context_write_v1() returns trigger
language plpgsql volatile security definer set search_path='' as $$begin
 perform dv_market_private.psttg_v2_context_caller_v1();
 if TG_OP='INSERT' and (new.backend<>pg_backend_pid() or new.transaction_id<>pg_current_xact_id()) then raise exception 'v2_context_transaction';end if;
 if TG_OP='UPDATE' then raise exception 'v2_context_immutable';end if;
 return case when TG_OP='DELETE' then old else new end;
end$$;
create trigger connection_context_write before insert or update or delete on dv_market_private.psttg_v2_connection_context_v1 for each row execute function dv_market_private.psttg_v2_context_write_v1();
create function dv_market_private.psttg_v2_context_commit_v1() returns trigger
language plpgsql volatile security definer set search_path='' as $$begin
 if exists(select from dv_market_private.psttg_v2_connection_context_v1 where context_id=new.context_id) then raise exception 'v2_context_must_not_commit';end if;return null;
end$$;
create constraint trigger connection_context_no_commit after insert on dv_market_private.psttg_v2_connection_context_v1 deferrable initially deferred for each row execute function dv_market_private.psttg_v2_context_commit_v1();
create function dv_market_private.psttg_v2_context_assert_v1(ctx uuid,objects uuid[] default '{}') returns void
language plpgsql volatile security definer set search_path='' as $$
declare c dv_market_private.psttg_v2_connection_context_v1; k bigint;begin
 perform dv_market_private.psttg_v2_context_caller_v1();
 select * into strict c from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx and backend=pg_backend_pid() and transaction_id=pg_current_xact_id();
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='40001',message='v2_snapshot_retry';end if;
 if exists(select from dv_market_private.psttg_unit_guard g where g.object_id=any(objects) and not(g.unit_id=any(c.units)) and g.xmin::text<>pg_current_xact_id()::text) then raise exception 'v2_unlocked_group';end if;
 foreach k in array c.operation_keys||c.command_keys loop
  if not exists(select from pg_locks where pid=pg_backend_pid() and locktype='advisory' and granted and classid::bigint=((k>>32)&4294967295) and objid::bigint=(k&4294967295) and objsubid=1) then raise exception 'v2_missing_actual_lock';end if;
 end loop;
end$$;
create table dv_market_private.psttg_v2_channel_v1(
 channel_id uuid primary key, target_system_ref uuid not null, environment_ref uuid not null,
 account_ref uuid not null, configuration_revision bigint not null check(configuration_revision>0),
 scope_ids uuid[] not null, operating_incarnation uuid not null,
 verification_key bytea not null check(octet_length(verification_key)=32),
 execution_epoch bigint not null default 0, receipt_revision bigint not null default 0,
 mapping_revision bigint not null default 0, stop_revision bigint not null default 0,
 stopped boolean not null default false, quarantine boolean not null default false,
 contract_version text not null check(contract_version='psttg-k5-unitmanifest/1')
);
create table dv_market_private.psttg_v2_use_admission_v1(
 admission_id uuid primary key, contract_version text not null check(contract_version='psttg-v2-writer-use/1'),
 command_id uuid not null unique, operation_ref uuid not null unique, input_revision bigint not null check(input_revision>0),
 channel_id uuid not null references dv_market_private.psttg_v2_channel_v1,
 operating_incarnation uuid not null, admission_revision bigint not null check(admission_revision=1),
 input_group_ref uuid not null references dv_market_private.psttg_object_anchor,
 own_group_ref uuid references dv_market_private.psttg_object_anchor,
 source_heads uuid[] not null, required_units uuid[] not null, extraction_units uuid[] not null,
 scope_ids uuid[] not null, adapter_version text not null check(adapter_version='synthetic-writer/1'),
 commit_ref uuid not null, registered_transaction xid8 not null,
 commitment bytea not null check(octet_length(commitment)=32),
 registered_at timestamptz not null, binding_projection jsonb not null
);
create table dv_market_private.psttg_v2_use_transition_v1(
 transition_id uuid primary key, admission_id uuid not null references dv_market_private.psttg_v2_use_admission_v1,
 command_id uuid not null unique, revision bigint not null check(revision>0),
 previous_ref uuid, transition_kind text not null check(transition_kind in ('EXTRACT_COMMITTED','ATTEMPTING','OUTCOME_UNKNOWN','EVIDENCE_BOUND','SEALED')),
 attempt_id uuid, execution_epoch bigint, group_ref uuid references dv_market_private.psttg_object_anchor,
 receipt_ref uuid, affected_units uuid[] not null,
 commit_ref uuid not null, registered_transaction xid8 not null,
 before_commitment bytea not null, after_commitment bytea not null,
 requested_group_ref uuid not null, capture_command_id uuid not null,
 contract_version text not null check(contract_version='psttg-v2-writer-use/1'),
 unique(admission_id,revision)
);
create table dv_market_private.psttg_v2_origin_head_v1(
 origin_ref uuid primary key references dv_market_private.psttg_object_anchor,
 source_ref uuid not null, source_version bigint not null, origin_revision bigint not null,
 predecessor_ref uuid unique references dv_market_private.psttg_v2_origin_head_v1,
 operation_ref uuid not null, command_id uuid not null unique, scope_ids uuid[] not null,
 unique(source_ref,source_version,origin_revision)
);
create table dv_market_private.psttg_v2_integration_entry_v1(
 entry_id uuid primary key, command_id uuid not null unique, scope_ids uuid[] not null,
 unit_ids uuid[] not null, event_kind text not null check(event_kind in ('SOURCE','ADMIT','EXTRACT_COMMITTED','ATTEMPTING','OUTCOME_UNKNOWN','EVIDENCE_BOUND','SEALED','FENCE','BEGIN','RECONCILE','ABORT_UNSTARTED','CANCELLED_SAFE','QUARANTINE')),
 entry_ref uuid not null, commit_ref uuid not null
);
create table dv_market_private.psttg_k5_unitmanifest_v1(
 manifest_id uuid primary key, manifest_revision bigint not null check(manifest_revision>0), previous_manifest_ref uuid,
 contract_version text not null check(contract_version='psttg-k5-unitmanifest/1'),
 command_id uuid not null unique, operation_ref uuid not null,
 channel_id uuid not null references dv_market_private.psttg_v2_channel_v1,
 target_ids uuid[] not null, target_units uuid[] not null, scope_ids uuid[] not null,
 attempt_id uuid not null unique, operating_incarnation uuid not null, execution_epoch bigint not null,
 action text not null check(action='SIMULATE_UNIT_TRANSITION'), adapter_version text not null check(adapter_version='synthetic-unit/1'),
 authorization_ref uuid not null, evidence_refs uuid[] not null,
 canonicalization_version integer not null check(canonicalization_version=1),
 authorization_revision bigint not null check(authorization_revision=1),
 issuer_ref uuid not null, issuer_key_version bigint not null,
 positive_evidence jsonb not null,
 before_projection jsonb not null, after_projection jsonb not null,
 signed_commitment bytea not null, commit_ref uuid not null, registered_transaction xid8 not null
);
create table dv_market_private.psttg_k5_unitattempt_v1(
 entry_id uuid primary key, manifest_id uuid not null references dv_market_private.psttg_k5_unitmanifest_v1,
 command_id uuid not null unique, state_revision bigint not null, previous_ref uuid,
 state text not null check(state in ('FENCED','ATTEMPTING','OUTCOME_UNKNOWN','SIMULATED','NOT_APPLIED_REVOKED','CANCELLED_SAFE','QUARANTINE')),
 attempt_id uuid not null, execution_epoch bigint not null, receipt_ref uuid,
 before_projection jsonb not null, after_projection jsonb not null,
 commit_ref uuid not null, registered_transaction xid8 not null,
 unique(manifest_id,state_revision)
);
-- Receipt storage has no FK to the target, attempt, or admission.
create table dv_market_private.psttg_v2_ingress_v1(
 receipt_id uuid primary key, channel_id uuid not null, event_ref uuid not null,
 receipt_revision bigint not null, key_ref uuid not null unique, wrapped_key bytea not null,
 ciphertext bytea not null, cipher_commitment bytea not null, received_at timestamptz not null,
 unique(channel_id,receipt_revision)
);
create table dv_market_private.psttg_v2_receipt_mapping_v1(
 mapping_id uuid primary key, receipt_id uuid not null unique references dv_market_private.psttg_v2_ingress_v1,
 channel_id uuid not null, operation_ref uuid not null, attempt_id uuid not null,
 target_ref uuid not null, group_ref uuid, commit_ref uuid not null
);
-- Only exact guard changes planned by the enclosing unit transition may pass.
create table dv_market_private.psttg_v2_guard_plan_v1(
 context_id uuid not null references dv_market_private.psttg_v2_connection_context_v1,
 unit_id uuid not null, before_row jsonb not null, after_row jsonb not null,
 primary key(context_id,unit_id)
);
create function dv_market_private.psttg_v2_guard_connection_v1() returns trigger
language plpgsql volatile security definer set search_path='' as $$declare p dv_market_private.psttg_v2_guard_plan_v1;begin
 if TG_OP='UPDATE' and (to_jsonb(new)-'demand_revision')=(to_jsonb(old)-'demand_revision') then
  if new.demand_revision<>old.demand_revision+1 or old.phase<>'present' or new.demand_revision<>(select 1+count(*) from dv_market_private.psttg_unit_binding where old.unit_id=any(dependencies)) then raise exception 'v2_guard_immutable';end if;return new;
 end if;
 if TG_OP<>'UPDATE' then raise exception 'v2_guard_immutable';end if;
 select p1.* into p from dv_market_private.psttg_v2_guard_plan_v1 p1 join dv_market_private.psttg_v2_connection_context_v1 c using(context_id) where c.backend=pg_backend_pid() and c.transaction_id=pg_current_xact_id() and p1.unit_id=old.unit_id;
 if not found then raise exception 'v2_guard_plan_required';end if;
 perform dv_market_private.psttg_v2_context_assert_v1(p.context_id,array[old.object_id]);
 if to_jsonb(old)<>p.before_row or to_jsonb(new)<>p.after_row or new.phase not in ('present','fenced') or old.phase not in ('present','fenced') or new.revision<>old.revision+1 or new.demand_revision<>old.demand_revision then raise exception 'v2_guard_plan_mismatch';end if;
 return new;
end$$;
drop trigger v2_immutable on dv_market_private.psttg_unit_guard;
create trigger v2_immutable before update or delete on dv_market_private.psttg_unit_guard for each row execute function dv_market_private.psttg_v2_guard_connection_v1();
create function dv_market_private.psttg_v2_connection_set_v1(seed uuid[],ops uuid[],cmds uuid[],channels uuid[]) returns jsonb
language sql stable security definer set search_path='' as $$
 with s as(select dv_market_private.psttg_v2_scopes(seed) ids),
 o as(select unnest(ops) id union select operation_ref from dv_market_private.psttg_v2_use_admission_v1,s where scope_ids&&s.ids union select operation_ref from dv_market_private.psttg_k5_unitmanifest_v1,s where scope_ids&&s.ids union select operation_ref from dv_market_private.psttg_v2_origin_head_v1,s where scope_ids&&s.ids),
 c as(select unnest(cmds) id union select command_id from dv_market_private.psttg_unit_binding,s where scope_ids&&s.ids union select command_id from dv_market_private.psttg_k5_unitmanifest_v1,s where scope_ids&&s.ids),
 ch as(select unnest(channels) id union select channel_id from dv_market_private.psttg_v2_channel_v1,s where scope_ids&&s.ids)
 select jsonb_build_object('scopes',(select ids from s),'units',(select coalesce(jsonb_agg(g.unit_id order by g.unit_id),'[]') from dv_market_private.psttg_unit_guard g join dv_market_private.psttg_unit_binding b using(object_id),s where b.scope_ids&&s.ids),
 'operations',(select coalesce(jsonb_agg(k order by k),'[]') from (select distinct hashtextextended(id::text,741105) k from o where id is not null) x),
 'commands',(select coalesce(jsonb_agg(k order by k),'[]') from (select distinct hashtextextended(id::text,741112) k from c where id is not null) x),
 'channels',(select coalesce(jsonb_agg(id order by id),'[]') from ch where id is not null))
$$;
create function dv_market_private.psttg_v2_connection_lock_v1(seed uuid[],ops uuid[],cmds uuid[],channels uuid[]) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare p jsonb; q jsonb; k text; id uuid:=gen_random_uuid(); ss uuid[]; us uuid[]; cs uuid[]; oo bigint[]; cc bigint[];begin
 perform dv_market_private.psttg_v2_context_caller_v1();
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='40001',message='v2_snapshot_retry';end if;
 p:=dv_market_private.psttg_v2_connection_set_v1(seed,ops,cmds,channels);
 select array_agg(x::uuid order by x::uuid) into ss from jsonb_array_elements_text(p->'scopes') x;
 if ss is null or cardinality(ss)>4096 then raise exception 'v2_connection_scopes';end if;
 select coalesce(array_agg(x::uuid order by x::uuid),'{}') into us from jsonb_array_elements_text(p->'units') x;
 select coalesce(array_agg(x::uuid order by x::uuid),'{}') into cs from jsonb_array_elements_text(p->'channels') x;
 select coalesce(array_agg(x::bigint order by x::bigint),'{}') into oo from jsonb_array_elements_text(p->'operations') x;
 select coalesce(array_agg(x::bigint order by x::bigint),'{}') into cc from jsonb_array_elements_text(p->'commands') x;
 foreach k in array oo::text[] loop perform pg_advisory_xact_lock(k::bigint);end loop;
 foreach k in array cc::text[] loop perform pg_advisory_xact_lock(k::bigint);end loop;
 perform 1 from dv_market_private.psttg_v2_channel_v1 where channel_id=any(cs) order by channel_id for update;
 perform 1 from dv_market_private.psttg_scope_guards where scope_id=any(ss) order by scope_id for update;
 perform 1 from dv_market_private.psttg_unit_guard where unit_id=any(us) order by unit_id for update;
 perform 1 from dv_market_private.psttg_v2_use_admission_v1 where scope_ids&&ss order by admission_id for update;
 perform 1 from dv_market_private.psttg_k5_unitmanifest_v1 where scope_ids&&ss order by manifest_id for update;
 q:=dv_market_private.psttg_v2_connection_set_v1(seed,ops,cmds,channels);
 if p is distinct from q then raise exception using errcode='40001',message='v2_scope_growth_retry';end if;
 if (select count(*) from dv_market_private.psttg_scope_guards where scope_id=any(ss))<>cardinality(ss) then raise exception 'v2_connection_scope_missing';end if;
 if exists(select from dv_market_private.psttg_scope_guards where scope_id=any(ss) and (phase<>'open' or recovery_state<>'none')) then raise exception 'v2_global_guard';end if;
 insert into dv_market_private.psttg_v2_connection_context_v1 values(id,pg_backend_pid(),pg_current_xact_id(),ss,us,oo,cc,cs);
 return id;
end$$;
create function dv_market_private.psttg_v2_writer_shape_v1(kind text,p jsonb) returns void
language plpgsql immutable set search_path='' as $$begin
 if kind='input' then perform dv_market_private.psttg_v2_validate(kind,p);
 elsif kind='event' and p->>'meaning'='internal_ready' then
  perform dv_market_private.psttg_v2_shape(p,array['operation_ref','event_ref','admission_ref','meaning']);
  if (p->>'operation_ref')::uuid is null or (p->>'event_ref')::uuid is null or (p->>'admission_ref')::uuid is null then raise exception 'v2_ready_binding';end if;
 elsif kind='event' then
  perform dv_market_private.psttg_v2_shape(p,array['operation_ref','event_ref','admission_ref','meaning','input_group_ref','input_revision','attempt_ref','receipt_ref']);
  if (p->>'operation_ref')::uuid is null or (p->>'event_ref')::uuid is null or (p->>'admission_ref')::uuid is null or (p->>'input_group_ref')::uuid is null or (p->>'input_revision')::bigint<1 or (p->>'attempt_ref')::uuid is null or (p->>'receipt_ref')::uuid is null or p->>'meaning'<>'simulated_evidenced' then raise exception 'v2_evidence_binding';end if;
 elsif kind='proof' then
  perform dv_market_private.psttg_v2_validate(kind,p-array['admission_ref','admission_revision','input_revision','input_group_ref']);
  perform dv_market_private.psttg_v2_shape(p->'request',array['digest']||case when p->'request' ? 'connection' then array['connection'] else '{}'::text[] end);
  if (p->>'admission_ref')::uuid is null or (p->>'input_group_ref')::uuid is null or (p->>'admission_revision')::bigint<>1 or (p->>'input_revision')::bigint<1 or p->'original_binding'<>'{}'::jsonb or p->'extraction'<>'{}'::jsonb then raise exception 'v2_writer_proof_binding';end if;
 else raise exception 'v2_writer_unit_kind';end if;
end$$;
alter table dv_market_private.psttg_content_unit drop constraint psttg_content_unit_schema_version_check;
alter table dv_market_private.psttg_content_unit add constraint psttg_content_unit_schema_version_check check(schema_version in ('psttg-unit-v2','psttg-unit-v2-writer1'));

-- Explicit versioned locked helpers. V111 payload/seal formats stay intact.
create or replace function dv_market_private.psttg_v2_plain(id uuid,secret text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare u dv_market_private.psttg_content_unit;k jsonb;p jsonb;begin
 select * into strict u from dv_market_private.psttg_content_unit where unit_id=id;
 if u.unit_seal is distinct from dv_market_private.psttg_v2_hash(to_jsonb(u)-'unit_seal') then raise exception 'v2_unit_integrity';end if;
 k:=dv_market_private.psttg_v2_decrypt(u.wrapped_key,secret);
 perform dv_market_private.psttg_v2_shape(k,array['key','unit','key_ref']);
 if k->>'unit'<>id::text or k->>'key_ref'<>u.key_ref::text then raise exception 'v2_key_binding';end if;
 p:=dv_market_private.psttg_v2_decrypt(u.ciphertext,k->>'key');
 perform dv_market_private.psttg_v2_shape(p,array['target','kind','content']);
 if p->'target'<>jsonb_build_array(u.object_id,u.incarnation,u.content_version,u.slot,u.unit_id) or p->>'kind'<>u.unit_kind then raise exception 'v2_cipher_binding';end if;
 if u.schema_version='psttg-unit-v2-writer1' then perform dv_market_private.psttg_v2_writer_shape_v1(u.unit_kind,p->'content');elsif u.schema_version='psttg-unit-v2' then perform dv_market_private.psttg_v2_validate(u.unit_kind,p->'content');else raise exception 'v2_schema_version';end if;return p->'content';
end$$;
create function dv_market_private.psttg_v2_read_locked_v1(ctx uuid,id uuid,secret text,representation integer default 2) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare a dv_market_private.psttg_object_anchor;b dv_market_private.psttg_unit_binding;g dv_market_private.psttg_unit_guard;
 u dv_market_private.psttg_content_unit;r dv_market_private.psttg_unit_end_receipt;s jsonb;p jsonb;states jsonb:='[]'; units jsonb:='[]'; st text;ids uuid[];actual jsonb;hasu boolean;hasr boolean;bad boolean:=false;body jsonb;frag jsonb;proof jsonb;rel jsonb;d uuid;
begin
 perform dv_market_private.psttg_v2_context_assert_v1(ctx,array[id]);
 if representation<>2 or representation is null then raise exception 'v2_representation_rejected';end if;
 select * into a from dv_market_private.psttg_object_anchor where object_id=id;
 if not found then return jsonb_build_object('object_id',id,'states',jsonb_build_array('missing_unexplained'),'removal_authorized',false,'external_coverage_complete',false,'other_obligations','not_evaluated');end if;
 if a.representation_version<>2 then raise exception 'v2_representation_rejected';end if;
 select * into strict b from dv_market_private.psttg_unit_binding where object_id=id;
 select scopes into strict ids from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;
 if not(b.scope_ids<@ids) then raise exception 'v2_unlocked_scope';end if;
 perform dv_market_private.psttg_v2_context_assert_v1(ctx,array(select distinct object_id from dv_market_private.psttg_unit_guard where unit_id=any(b.dependencies)));
 if b.manifest_seal is distinct from dv_market_private.psttg_v2_hash(jsonb_build_array(to_jsonb(a),to_jsonb(b)-'manifest_seal')) then bad:=true;end if;
 select coalesce(jsonb_agg(jsonb_build_object('unit',unit_id,'slot',slot) order by slot),'[]') into actual from dv_market_private.psttg_unit_guard where object_id=id;
 if actual is distinct from (select coalesce(jsonb_agg(jsonb_build_object('unit',x->'unit','slot',x->'slot') order by (x->>'slot')::int),'[]') from jsonb_array_elements(b.slots) x) then bad:=true;end if;
 for s in select value from jsonb_array_elements(b.slots) order by (value->>'slot')::int loop
  select * into g from dv_market_private.psttg_unit_guard where unit_id=(s->>'unit')::uuid;
  select * into u from dv_market_private.psttg_content_unit where unit_id=(s->>'unit')::uuid;hasu:=found;
  select * into r from dv_market_private.psttg_unit_end_receipt where unit_id=(s->>'unit')::uuid;hasr:=found;
  st:=null;
  if bad or g.unit_id is null or (g.object_id,g.incarnation,g.content_version,g.slot) is distinct from (a.object_id,a.incarnation,a.content_version,(s->>'slot')::int) then st:='integrity_violation';
  elsif hasu then
   if hasr or g.phase='ended' or u.unit_kind<>s->>'kind' or encode(u.unit_seal,'hex')<>s->>'seal' or (u.object_id,u.incarnation,u.content_version,u.slot) is distinct from (g.object_id,g.incarnation,g.content_version,g.slot) then st:='integrity_violation';
   else
    begin p:=dv_market_private.psttg_v2_plain(u.unit_id,secret);st:='present_verified';
     if u.unit_kind='body' then body:=p;elsif u.unit_kind='original_fragment' then frag:=p;elsif u.unit_kind='proof' then proof:=p;elsif u.unit_kind='relationship' then rel:=p;end if;
    exception when others then st:='integrity_violation';end;
   end if;
  elsif not hasr then st:=case when g.phase='ended' then 'integrity_violation' else 'missing_unexplained' end;
  elsif g.phase<>'ended' or r.receipt_seal is distinct from dv_market_private.psttg_v2_hash(to_jsonb(r)-'receipt_seal') or
   (r.object_id,r.incarnation,r.content_version,r.slot,r.manifest_id,r.manifest_revision,r.authorization_id,r.attempt_id,r.result_id)
   is distinct from (g.object_id,g.incarnation,g.content_version,g.slot,g.manifest_id,g.manifest_revision,g.authorization_id,g.attempt_id,g.result_id)
   or r.prior_unit_seal is distinct from decode(s->>'seal','hex') or r.manifest_seal is distinct from b.manifest_seal then st:='integrity_violation';
  else st:='authorized_end_verified';end if;
  if not(states ? st) then states:=states||to_jsonb(st);end if;
  if g.phase='fenced' and not(states ? 'copy_or_dependency_unresolved') then states:=states||'"copy_or_dependency_unresolved"'::jsonb;end if;
  units:=units||jsonb_build_array(jsonb_build_object('unit_id',s->'unit','slot',s->'slot','state',st,'guard_revision',g.revision,'demand_revision',g.demand_revision));
 end loop;
 -- A valid per-slot receipt does not dissolve a still-present preservation
 -- group. Only all-present or all-ended can be a complete group statement.
 if states ? 'present_verified' and states ? 'authorized_end_verified' then states:=states||'"copy_or_dependency_unresolved"'::jsonb;end if;
 if rel is not null and (rel->>'target',rel->>'incarnation',rel->>'version') is distinct from (b.related_object_id::text,b.related_incarnation::text,b.related_version::text) then states:=states||'"integrity_violation"'::jsonb;end if;
 if frag is not null then
  if body is null or proof is null or rel is null or proof->>'extraction' is distinct from encode(dv_market_private.psttg_v2_hash(frag),'hex') or rel->>'relation'<>'corrects' or proof->'original_binding'->>'object_id' is distinct from rel->>'target' or proof->'original_binding'->>'incarnation' is distinct from rel->>'incarnation' or proof->'original_binding'->>'content_version' is distinct from rel->>'version' or states ?| array['missing_unexplained','integrity_violation','authorized_end_verified'] then
   states:=states||'"copy_or_dependency_unresolved"'::jsonb;
  else states:=states||'"required_correction_fragment"'::jsonb;end if;
 end if;
 for d in select unnest(b.dependencies) loop
  begin perform dv_market_private.psttg_v2_plain(d,secret);
  exception when others then states:=states||'"copy_or_dependency_unresolved"'::jsonb;end;
 end loop;
 if states ? 'required_correction_fragment' then
  select jsonb_agg(case when x->>'unit_id' in(select unit_id::text from dv_market_private.psttg_content_unit where object_id=id and unit_kind='original_fragment') then x||jsonb_build_object('requirement','required_correction_fragment') else x end) into units from jsonb_array_elements(units) x;
 end if;
 -- Unintegrated copies never become complete simply because a local unit ended.
 if a.object_kind='COPY' or exists(select from dv_market_private.psttg_unit_binding cb join dv_market_private.psttg_object_anchor ca on ca.object_id=cb.object_id where ca.object_kind='COPY' and cb.dependencies && (select array_agg(unit_id) from dv_market_private.psttg_unit_guard where object_id=id)) or exists(select from dv_market_private.psttg_operation_events where scope_ids && b.scope_ids and evidence_payload_ciphertext is not null) or exists(select from unnest(b.dependencies) dependency_id left join dv_market_private.psttg_unit_guard z on z.unit_id=dependency_id left join dv_market_private.psttg_content_unit c on c.unit_id=dependency_id where z.unit_id is null or z.phase<>'present' or c.unit_id is null) then states:=states||'"copy_or_dependency_unresolved"'::jsonb;end if;
 return jsonb_build_object('object_id',id,'representation',2,'states',states,'units',units,'original_full_rechecked',false,'removal_authorized',false,'external_coverage_complete',false,'other_obligations','not_evaluated','end_proof_boundary','synthetic_prepared_state_only','snapshot_fingerprint',encode(dv_market_private.psttg_v2_hash(jsonb_build_array(
  (select jsonb_agg(to_jsonb(sb) order by sb.object_id) from dv_market_private.psttg_unit_binding sb where sb.scope_ids && ids),
  (select jsonb_agg(to_jsonb(sg) order by sg.unit_id) from dv_market_private.psttg_unit_guard sg join dv_market_private.psttg_unit_binding sb using(object_id) where sb.scope_ids && ids)
 )),'hex'));
end$$;
create function dv_market_private.psttg_v2_capture_locked_v1(ctx uuid,cmd jsonb,content jsonb,secret text,request_binding jsonb default '{}') returns uuid language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare id uuid;inc uuid;kind text;ver bigint;scopes uuid[];deps uuid[];original uuid;oa dv_market_private.psttg_object_anchor;ob dv_market_private.psttg_unit_binding;
 old dv_market_private.psttg_unit_binding;group_data jsonb:='[]';item jsonb;slots jsonb:='[]';projection jsonb;op jsonb;proof jsonb;g record;u dv_market_private.psttg_content_unit;
 keyval text;ns text;uid uuid;keyref uuid;n integer:=0;result jsonb;request jsonb;oldproof jsonb;dep uuid;depobj uuid;expected_deps uuid[];binding dv_market_private.psttg_unit_binding;anchor dv_market_private.psttg_object_anchor;
begin
 perform dv_market_private.psttg_v2_context_assert_v1(ctx);
 perform dv_market_private.psttg_v2_shape(cmd,array['command_id','object_id','incarnation','version','kind','scopes','dependencies','decision_ref','original']);
 id:=(cmd->>'object_id')::uuid;inc:=(cmd->>'incarnation')::uuid;ver:=(cmd->>'version')::bigint;kind:=cmd->>'kind';
 if ver<1 or kind not in ('O1','O2','O3','O4','COPY','O2_READY','O2_EVIDENCE') or jsonb_typeof(cmd->'scopes')<>'array' or jsonb_typeof(cmd->'dependencies')<>'array' then raise exception 'v2_capture_shape';end if;
 select coalesce(array_agg(distinct x::uuid order by x::uuid),'{}') into scopes from jsonb_array_elements_text(cmd->'scopes') x;
 select coalesce(array_agg(distinct x::uuid order by x::uuid),'{}') into deps from jsonb_array_elements_text(cmd->'dependencies') x;
 if not(hashtextextended(cmd->>'command_id',741112)=any((select command_keys from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx)::bigint[])) then raise exception 'v2_unlocked_command';end if;
 if cmd->'original'<>'{}'::jsonb then
  perform dv_market_private.psttg_v2_shape(cmd->'original',array['id','incarnation','version']);
  original:=(cmd->'original'->>'id')::uuid;
  select * into strict oa from dv_market_private.psttg_object_anchor where object_id=original;
  if oa.object_kind<>'O3' or oa.incarnation<>(cmd->'original'->>'incarnation')::uuid or oa.content_version<>(cmd->'original'->>'version')::bigint then raise exception 'v2_original_version';end if;
  select * into strict ob from dv_market_private.psttg_unit_binding where object_id=original;
  scopes:=scopes||ob.scope_ids;
 end if;
 for g in select distinct b.scope_ids from dv_market_private.psttg_unit_binding b join dv_market_private.psttg_unit_guard z on z.object_id=b.object_id where z.unit_id=any(deps) loop scopes:=scopes||g.scope_ids;end loop;
 -- Required dependencies always include the complete evidence group, not an
 -- arbitrary chosen slot. Resolve before taking the common ordered scope locks.
 select coalesce(array_agg(unit_id order by unit_id),'{}') into expected_deps from dv_market_private.psttg_unit_guard where object_id in(select object_id from dv_market_private.psttg_unit_guard where unit_id=any(deps));
 if deps is distinct from expected_deps then raise exception 'v2_incomplete_preservation_group';end if;
 if not(scopes<@(select c.scopes from dv_market_private.psttg_v2_connection_context_v1 c where context_id=ctx)) then raise exception 'v2_unlocked_scope';end if;
 scopes:=dv_market_private.psttg_v2_scopes(scopes);
 perform dv_market_private.psttg_v2_context_assert_v1(ctx,array(select distinct object_id from dv_market_private.psttg_unit_guard where object_id=original or unit_id=any(deps)));
 if (select count(*) from dv_market_private.psttg_unit_guard where unit_id=any(deps))<>cardinality(deps) or exists(select from dv_market_private.psttg_unit_guard where (object_id=original or unit_id=any(deps)) and phase<>'present') then raise exception 'v2_target_guard';end if;
 for dep in select unnest(deps) loop perform dv_market_private.psttg_v2_plain(dep,secret);end loop;
 for depobj in select distinct object_id from dv_market_private.psttg_unit_guard where unit_id=any(deps) loop
  result:=dv_market_private.psttg_v2_read_locked_v1(ctx,depobj,secret);
  if result->'states' ?| array['integrity_violation','missing_unexplained','authorized_end_verified','copy_or_dependency_unresolved'] then raise exception 'v2_dependency_integrity';end if;
 end loop;
 request:=jsonb_build_object('cmd',cmd,'content',content);
 select * into old from dv_market_private.psttg_unit_binding where command_id=(cmd->>'command_id')::uuid;
 if found then
  result:=dv_market_private.psttg_v2_read_locked_v1(ctx,old.object_id,secret);
  if result->'states' ?| array['integrity_violation','missing_unexplained','authorized_end_verified'] then raise exception 'v2_retry_unavailable';end if;
  select dv_market_private.psttg_v2_plain(unit_id,secret) into strict oldproof from dv_market_private.psttg_content_unit where object_id=old.object_id and unit_kind='proof';
  if oldproof->'request'->>'digest' is distinct from encode(dv_market_private.psttg_v2_hash(request),'hex') then raise exception 'v2_idempotency_conflict';end if;return old.object_id;
 end if;
 if exists(select from dv_market_private.psttg_records where record_id=id) or exists(select from dv_market_private.psttg_origin_bindings where origin_id=id) or exists(select from dv_market_private.psttg_operation_events where event_id=id) then raise exception 'v2_v1_identity';end if;
 if kind='O3' then
  perform dv_market_private.psttg_v2_shape(content,array['body','source_fragment','original_fragment']);
  perform dv_market_private.psttg_v2_validate('body',content->'body');
  perform dv_market_private.psttg_v2_validate('source_fragment',content->'source_fragment');
  if content->'source_fragment' is distinct from ((content->'body')-array['other_attributes','correction_reason']) then raise exception 'v2_source_values';end if;
  group_data:=jsonb_build_array(jsonb_build_object('kind','body','content',content->'body'),jsonb_build_object('kind','source_fragment','content',content->'source_fragment'));
  if original is not null then
   result:=dv_market_private.psttg_v2_read_locked_v1(ctx,original,secret);
   if result->'states'<> '["present_verified"]'::jsonb then raise exception 'v2_original_integrity';end if;
   select dv_market_private.psttg_v2_plain(unit_id,secret) into strict op from dv_market_private.psttg_content_unit where object_id=original and unit_kind='body';
   select dv_market_private.psttg_v2_plain(unit_id,secret) into strict oldproof from dv_market_private.psttg_content_unit where object_id=original and unit_kind='proof';
   projection:=op-array['other_attributes','correction_reason'];
   if content->'original_fragment' is distinct from projection or nullif(content->'body'->>'correction_reason','') is null then raise exception 'v2_original_values';end if;
   group_data:=group_data||jsonb_build_array(jsonb_build_object('kind','original_fragment','content',projection),jsonb_build_object('kind','relationship','content',jsonb_build_object('target',original,'incarnation',oa.incarnation,'version',oa.content_version,'purpose_ref',cmd->'decision_ref','relation','corrects')));
  elsif content->'original_fragment'<>'{}'::jsonb or content->'body'->>'correction_reason'<>'' then raise exception 'v2_original_required';end if;
 elsif kind in ('O2_READY','O2_EVIDENCE') then
  if kind='O2_READY' then
   perform dv_market_private.psttg_v2_shape(content,array['input','event']);
   if content->'input'->>'operation_ref' is distinct from content->'event'->>'operation_ref' or content->'event'->>'meaning' is distinct from 'internal_ready' then raise exception 'v2_ready_binding';end if;
   group_data:=jsonb_build_array(jsonb_build_object('kind','input','content',content->'input'),jsonb_build_object('kind','event','content',content->'event'));
  else
   perform dv_market_private.psttg_v2_shape(content,array['event']);
   if content->'event'->>'meaning' is distinct from 'simulated_evidenced' then raise exception 'v2_evidence_binding';end if;
   group_data:=jsonb_build_array(jsonb_build_object('kind','event','content',content->'event'));
  end if;
 elsif kind='O2' then
  perform dv_market_private.psttg_v2_shape(content,array['input','event']);
  if content->'input'->>'operation_ref' is distinct from content->'event'->>'operation_ref' then raise exception 'v2_operation_binding';end if;
  group_data:=jsonb_build_array(jsonb_build_object('kind','input','content',content->'input'),jsonb_build_object('kind','event','content',content->'event'));
 else
  if original is not null then raise exception 'v2_original_class';end if;
  if kind in ('O4','COPY') then
   select * into strict oa from dv_market_private.psttg_object_anchor where object_id=(content->>'target')::uuid;
   if not exists(select from dv_market_private.psttg_unit_guard where object_id=oa.object_id and unit_id=any(deps)) then raise exception 'v2_relationship_dependencies';end if;
   if kind='O4' and (content->>'relation'<>'uses_information_from' or (content->>'incarnation')::uuid<>oa.incarnation or (content->>'version')::bigint<>oa.content_version) then raise exception 'v2_relationship_binding';end if;
  end if;
  group_data:=jsonb_build_array(jsonb_build_object('kind',case kind when 'O1' then 'origin' when 'O4' then 'relationship' else 'copy' end,'content',content));
 end if;
 -- Idempotency digest is inside the independently encrypted proof, never in clear metadata.
 select nsp.nspname into strict ns from pg_extension e join pg_namespace nsp on nsp.oid=e.extnamespace where e.extname='pgcrypto';
 proof:=jsonb_build_object('mode','synthetic_test','captured_at',clock_timestamp(),'command',cmd->'command_id','request',request,'original_binding',case when original is null then '{}'::jsonb else to_jsonb(oa)||jsonb_build_object('manifest',encode(ob.manifest_seal,'hex'),'original_captured_at',oldproof->'captured_at','extraction_schema','reported-amount-currency-period-position-v2') end,'extraction',case when projection is null then '{}'::jsonb else to_jsonb(encode(dv_market_private.psttg_v2_hash(projection),'hex')) end);
 -- Replace the temporary request with its encrypted-only digest; no full-input duplicate is persisted.
 proof:=jsonb_set(proof,'{request}',jsonb_build_object('digest',encode(dv_market_private.psttg_v2_hash(request),'hex'))||case when request_binding='{}'::jsonb then '{}'::jsonb else jsonb_build_object('connection',encode(dv_market_private.psttg_v2_hash(request_binding),'hex')) end);
 if kind in ('O2_READY','O2_EVIDENCE') then proof:=proof||jsonb_build_object('admission_ref',content->'event'->'admission_ref','admission_revision',1,'input_revision',case when kind='O2_READY' then content->'input'->'input_revision' else content->'event'->'input_revision' end,'input_group_ref',case when kind='O2_READY' then to_jsonb(id) else content->'event'->'input_group_ref' end);end if;
 group_data:=group_data||jsonb_build_array(jsonb_build_object('kind','proof','content',proof));
 insert into dv_market_private.psttg_object_anchor values(id,inc,ver,case when kind in ('O2_READY','O2_EVIDENCE') then 'O2' else kind end,2) returning * into anchor;
 for item in select value from jsonb_array_elements(group_data) loop
  if kind in ('O2_READY','O2_EVIDENCE') then perform dv_market_private.psttg_v2_writer_shape_v1(item->>'kind',item->'content');else perform dv_market_private.psttg_v2_validate(item->>'kind',item->'content');end if;
  n:=n+1;uid:=gen_random_uuid();keyref:=gen_random_uuid();
  execute format('select encode(%I.gen_random_bytes(32),''hex'')',ns) into keyval;
  insert into dv_market_private.psttg_unit_guard(unit_id,object_id,incarnation,content_version,slot,phase,revision,demand_revision) values(uid,id,inc,ver,n,'present',1,1);
  u.unit_id:=uid;u.object_id:=id;u.incarnation:=inc;u.content_version:=ver;u.slot:=n;u.unit_kind:=item->>'kind';u.schema_version:=case when kind in ('O2_READY','O2_EVIDENCE') then 'psttg-unit-v2-writer1' else 'psttg-unit-v2' end;u.key_ref:=keyref;
  u.wrapped_key:=dv_market_private.psttg_encrypt(jsonb_build_object('key',keyval,'unit',uid,'key_ref',keyref),secret);
  u.ciphertext:=dv_market_private.psttg_encrypt(jsonb_build_object('target',jsonb_build_array(id,inc,ver,n,uid),'kind',u.unit_kind,'content',item->'content'),keyval);
  u.unit_seal:=dv_market_private.psttg_v2_hash(to_jsonb(u)-'unit_seal');
  insert into dv_market_private.psttg_content_unit select u.*;
  slots:=slots||jsonb_build_array(jsonb_build_object('unit',uid,'slot',n,'kind',u.unit_kind,'seal',encode(u.unit_seal,'hex'),'group',id));
 end loop;
 binding.object_id:=id;binding.command_id:=(cmd->>'command_id')::uuid;binding.scope_ids:=scopes;binding.slots:=slots;binding.dependencies:=deps;binding.decision_ref:=(cmd->>'decision_ref')::uuid;binding.related_object_id:=oa.object_id;binding.related_incarnation:=oa.incarnation;binding.related_version:=oa.content_version;
 binding.manifest_seal:=dv_market_private.psttg_v2_hash(jsonb_build_array(to_jsonb(anchor),to_jsonb(binding)-'manifest_seal'));
 insert into dv_market_private.psttg_unit_binding select binding.*;
 update dv_market_private.psttg_unit_guard set demand_revision=demand_revision+1 where unit_id=any(deps);
 return id;
end$$;
create or replace function dv_market_private.psttg_v2_commit_check() returns trigger language plpgsql security definer set search_path='' as $$
declare id uuid:=new.object_id;b dv_market_private.psttg_unit_binding;a dv_market_private.psttg_object_anchor;s jsonb;g dv_market_private.psttg_unit_guard;u dv_market_private.psttg_content_unit;expected text[];actual text[];
begin
 select * into strict a from dv_market_private.psttg_object_anchor where object_id=id;
 select * into strict b from dv_market_private.psttg_unit_binding where object_id=id;
 if b.manifest_seal is distinct from dv_market_private.psttg_v2_hash(jsonb_build_array(to_jsonb(a),to_jsonb(b)-'manifest_seal')) then raise exception 'v2_manifest_integrity';end if;
 expected:=case a.object_kind when 'O1' then array['origin','proof'] when 'O2' then case when jsonb_array_length(b.slots)=2 and not exists(select from dv_market_private.psttg_content_unit where object_id=id and schema_version<>'psttg-unit-v2-writer1') then array['event','proof'] else array['input','event','proof'] end when 'O4' then array['relationship','proof'] when 'COPY' then array['copy','proof'] else case when jsonb_array_length(b.slots)=5 then array['body','source_fragment','original_fragment','relationship','proof'] else array['body','source_fragment','proof'] end end;
 select array_agg(x->>'kind' order by (x->>'slot')::int) into actual from jsonb_array_elements(b.slots) x;
 if actual is distinct from expected or (select count(*) from dv_market_private.psttg_unit_guard where object_id=id)<>cardinality(expected) then raise exception 'v2_slot_manifest';end if;
 for s in select value from jsonb_array_elements(b.slots) loop
  perform dv_market_private.psttg_v2_shape(s,array['unit','slot','kind','seal','group']);
  select * into strict g from dv_market_private.psttg_unit_guard where unit_id=(s->>'unit')::uuid;
  select * into strict u from dv_market_private.psttg_content_unit where unit_id=g.unit_id;
  if s->>'group'<>id::text or (g.object_id,g.incarnation,g.content_version,g.slot) is distinct from (a.object_id,a.incarnation,a.content_version,(s->>'slot')::int) or g.phase<>'present' or exists(select from dv_market_private.psttg_unit_end_receipt where unit_id=g.unit_id) or u.unit_kind<>s->>'kind' or u.unit_seal<>decode(s->>'seal','hex') or u.unit_seal is distinct from dv_market_private.psttg_v2_hash(to_jsonb(u)-'unit_seal') then raise exception 'v2_capture_invariant';end if;
 end loop;
 return null;
end$$;
create or replace function dv_market_private.psttg_v2_capture(cmd jsonb,content jsonb,secret text) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare ctx uuid; seeds uuid[]; id uuid;begin
 if cmd->>'kind' in ('O2_READY','O2_EVIDENCE') then raise exception 'v2_admission_entry_required';end if;
 select array_agg(x::uuid) into seeds from jsonb_array_elements_text(cmd->'scopes') x;
 seeds:=seeds||coalesce((select array_agg(distinct s) from dv_market_private.psttg_unit_binding b cross join lateral unnest(b.scope_ids) s where b.object_id=(cmd->'original'->>'id')::uuid or b.object_id in(select g.object_id from dv_market_private.psttg_unit_guard g where g.unit_id in(select x::uuid from jsonb_array_elements_text(cmd->'dependencies') x))),'{}');
 ctx:=dv_market_private.psttg_v2_connection_lock_v1(seeds,'{}',array[(cmd->>'command_id')::uuid],'{}');
 if exists(select from dv_market_private.psttg_v2_channel_v1 g join dv_market_private.psttg_v2_connection_context_v1 c on g.channel_id=any(c.channel_ids) where c.context_id=ctx and (g.stopped or g.quarantine)) then raise exception 'v2_channel_stopped';end if;
 id:=dv_market_private.psttg_v2_capture_locked_v1(ctx,cmd,content,secret);
 delete from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;return id;
end$$;
create or replace function dv_market_private.psttg_v2_read(id uuid,secret text,representation integer default 2) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare ctx uuid; seeds uuid[]; r jsonb;begin
 if representation is distinct from 2 then raise exception 'v2_representation_rejected';end if;
 select scope_ids into seeds from dv_market_private.psttg_unit_binding where object_id=id;
 if not found then return jsonb_build_object('object_id',id,'states',jsonb_build_array('missing_unexplained'),'removal_authorized',false,'external_coverage_complete',false,'other_obligations','not_evaluated');end if;
 ctx:=dv_market_private.psttg_v2_connection_lock_v1(seeds,'{}','{}','{}');
 if exists(select from dv_market_private.psttg_v2_channel_v1 g join dv_market_private.psttg_v2_connection_context_v1 c on g.channel_id=any(c.channel_ids) where c.context_id=ctx and g.quarantine) then raise exception 'v2_restore_quarantine';end if;
 r:=dv_market_private.psttg_v2_read_locked_v1(ctx,id,secret,representation);
 delete from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;return r;
end$$;
create function dv_market_private.psttg_v2_challenge_v1() returns jsonb language sql volatile security definer set search_path='' set timezone='UTC' as $$select dv_market_private.psttg_k5_challenge()$$;
create function dv_market_private.psttg_v2_verify_ticket_v1(ch uuid,command jsonb,ticket jsonb,signature bytea) returns void
language plpgsql volatile security definer set search_path='' as $$
declare g dv_market_private.psttg_v2_channel_v1; ns text; expected bytea; expected_ticket jsonb;claims jsonb;begin
 select * into strict g from dv_market_private.psttg_v2_channel_v1 where channel_id=ch;
 select n.nspname into strict ns from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
 execute format('select %I.hmac($1,$2,''sha256'')',ns) into expected using convert_to(ticket::text,'UTF8'),g.verification_key;
 if signature is distinct from expected then raise exception 'v2_ticket_unauthentic';end if;
 expected_ticket:=jsonb_build_object('contract','psttg-k5-unitmanifest/1','channel',ch,'incarnation',g.operating_incarnation,'challenge',dv_market_private.psttg_v2_challenge_v1(),'command',encode(dv_market_private.psttg_v2_hash(command),'hex'));
 if command->0->>'action'='FENCE' then
  select jsonb_agg(jsonb_build_object('evidence_ref',(command->0->'proof_refs')->(c.n::integer-1),'version',1,'issuer_ref',g.account_ref,'key_version',g.configuration_revision,'claim',c.claim,'binding',expected_ticket->'command') order by c.n) into claims
  from unnest(array['provenance','endpoint','carrier_coverage','other_obligations','correction_preservation','open_operations','channel_effect','result_storage','restore_reconciliation']) with ordinality c(claim,n);
  expected_ticket:=expected_ticket||jsonb_build_object('positive_test_proofs',claims);
 end if;
 if ticket is distinct from expected_ticket then raise exception 'v2_ticket_binding';end if;
 if g.quarantine then raise exception 'v2_restore_quarantine';end if;
end$$;
create function dv_market_private.psttg_v2_group_units_v1(objects uuid[]) returns uuid[]
language sql stable security definer set search_path='' as $$select coalesce(array_agg(unit_id order by unit_id),'{}') from dv_market_private.psttg_unit_guard where object_id=any(objects)$$;
create function dv_market_private.psttg_v2_demand_v1(id uuid) returns bigint
language sql stable security definer set search_path='' as $$
 select (select count(*) from dv_market_private.psttg_v2_use_admission_v1 where id=any(required_units||extraction_units))+(select count(*) from dv_market_private.psttg_v2_use_transition_v1 where id=any(affected_units))+(select count(*) from dv_market_private.psttg_v2_receipt_mapping_v1 rm join dv_market_private.psttg_k5_unitmanifest_v1 m on m.manifest_id=rm.target_ref where id=any(m.target_units))
$$;
create function dv_market_private.psttg_v2_active_demand_v1(id uuid) returns boolean
language sql stable security definer set search_path='' as $$select exists(select from dv_market_private.psttg_v2_use_admission_v1 a where id=any(a.required_units) or (id=any(a.extraction_units) and not exists(select from dv_market_private.psttg_v2_use_transition_v1 t where t.admission_id=a.admission_id and t.transition_kind='EXTRACT_COMMITTED' and t.group_ref=a.own_group_ref and id=any(t.affected_units)))) or exists(select from dv_market_private.psttg_v2_use_transition_v1 t where t.transition_kind in ('EVIDENCE_BOUND','SEALED') and id=any(t.affected_units))$$;
-- Closed server-derived demand graph. Never accepts a caller-supplied edge array.
create function dv_market_private.psttg_v2_edges_v1(ss uuid[],addition jsonb default null,admission_addition jsonb default null) returns jsonb
language sql stable security definer set search_path='' as $$
 with admissions as(select * from dv_market_private.psttg_v2_use_admission_v1 union all select (jsonb_populate_record(null::dv_market_private.psttg_v2_use_admission_v1,admission_addition)).* where admission_addition is not null), transitions as(select * from dv_market_private.psttg_v2_use_transition_v1 union all select (jsonb_populate_record(null::dv_market_private.psttg_v2_use_transition_v1,addition)).* where addition is not null), uses as(
  select a.admission_id carrier_ref,1::bigint carrier_revision,a.admission_id admission_ref,a.required_units units,'ongoing_content'::text usage_kind from admissions a where a.scope_ids&&ss
  union all select a.admission_id,1,a.admission_id,a.extraction_units,'extract_until_committed' from admissions a where a.scope_ids&&ss
  union all select t.transition_id,t.revision,t.admission_id,t.affected_units,'retained_independent_proof' from transitions t join admissions a using(admission_id) where a.scope_ids&&ss and t.transition_kind in ('EVIDENCE_BOUND','SEALED')
 ), edges as(
 select jsonb_build_object('carrier_ref',x.carrier_ref,'carrier_revision',x.carrier_revision,'admission_ref',x.admission_ref,
 'target',jsonb_build_array(c.target_system_ref,c.environment_ref,2,o.object_kind,g.object_id,g.incarnation,g.content_version,g.unit_id,g.slot,u.schema_version),
 'purpose','synthetic_registered_use','decision_ref',b.decision_ref,
 'usage',case when o.object_kind='COPY' then 'copy_artifact' when g.object_id=a.own_group_ref and cardinality(a.extraction_units)>0 then 'retained_independent_proof' else x.usage_kind end,
 'binding_status',case when x.usage_kind='extract_until_committed' and exists(select from transitions t where t.admission_id=a.admission_id and t.transition_kind='EXTRACT_COMMITTED' and t.group_ref=a.own_group_ref and g.unit_id=any(t.affected_units)) then 'replaced_by_committed_group' else 'bound' end) edge
 from uses x join admissions a on a.admission_id=x.admission_ref
 join dv_market_private.psttg_v2_channel_v1 c on c.channel_id=a.channel_id
 cross join lateral unnest(x.units) d
 join dv_market_private.psttg_unit_guard g on g.unit_id=d
 join dv_market_private.psttg_object_anchor o on o.object_id=g.object_id
 join dv_market_private.psttg_content_unit u on u.unit_id=g.unit_id
 join dv_market_private.psttg_unit_binding b on b.object_id=a.input_group_ref
 union all
 select jsonb_build_object('carrier_ref',a.admission_id,'carrier_revision',1,'admission_ref',a.admission_id,'artifact_ref',a.own_group_ref,'artifact_version',a.input_revision,'purpose','synthetic_copy_carrier','usage','unresolved_carrier','binding_status','unresolved')
 from admissions a join dv_market_private.psttg_object_anchor o on o.object_id=a.own_group_ref where a.scope_ids&&ss and o.object_kind='COPY'
 ) select coalesce(jsonb_agg(edge order by edge::text),'[]') from edges
$$;
create function dv_market_private.psttg_v2_projection_v1(ctx uuid,ch uuid,addition jsonb default null,admission_addition jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare ss uuid[]; p jsonb;begin
 perform dv_market_private.psttg_v2_context_assert_v1(ctx);
 select scopes into strict ss from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;
 select jsonb_build_object(
 'edges',dv_market_private.psttg_v2_edges_v1(ss,addition,admission_addition),
 'guards',(select coalesce(jsonb_agg(to_jsonb(g)||jsonb_build_object('use_demand_revision',dv_market_private.psttg_v2_demand_v1(g.unit_id)+case when (addition->'affected_units') ? g.unit_id::text then 1 else 0 end+case when (admission_addition->'required_units') ? g.unit_id::text or (admission_addition->'extraction_units') ? g.unit_id::text then 1 else 0 end) order by g.unit_id),'[]') from dv_market_private.psttg_unit_guard g join dv_market_private.psttg_unit_binding b using(object_id) where b.scope_ids&&ss),
 'anchors',(select coalesce(jsonb_agg(to_jsonb(a) order by a.object_id),'[]') from dv_market_private.psttg_object_anchor a join dv_market_private.psttg_unit_binding b using(object_id) where b.scope_ids&&ss),
 'bindings',(select coalesce(jsonb_agg(to_jsonb(b) order by b.object_id),'[]') from dv_market_private.psttg_unit_binding b where b.scope_ids&&ss),
 'units',(select coalesce(jsonb_agg(jsonb_build_object('unit_id',u.unit_id,'schema_version',u.schema_version,'unit_seal',encode(u.unit_seal,'hex'),'cipher',encode(sha256(u.ciphertext),'hex'),'envelope',encode(sha256(u.wrapped_key),'hex')) order by u.unit_id),'[]') from dv_market_private.psttg_content_unit u join dv_market_private.psttg_unit_binding b using(object_id) where b.scope_ids&&ss),
 'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by r.unit_id),'[]') from dv_market_private.psttg_unit_end_receipt r join dv_market_private.psttg_unit_binding b using(object_id) where b.scope_ids&&ss),
 'admissions',(select coalesce(jsonb_agg(to_jsonb(a)-'binding_projection' order by a.admission_id),'[]') from (select * from dv_market_private.psttg_v2_use_admission_v1 union all select (jsonb_populate_record(null::dv_market_private.psttg_v2_use_admission_v1,admission_addition)).* where admission_addition is not null) a where a.scope_ids&&ss),
 'transitions',(select coalesce(jsonb_agg(to_jsonb(t)-array['before_commitment','after_commitment'] order by t.transition_id),'[]') from (select * from dv_market_private.psttg_v2_use_transition_v1 union all select (jsonb_populate_record(null::dv_market_private.psttg_v2_use_transition_v1,addition)).* where addition is not null) t join dv_market_private.psttg_v2_use_admission_v1 a using(admission_id) where a.scope_ids&&ss),
 'origins',(select coalesce(jsonb_agg(to_jsonb(o) order by o.origin_ref),'[]') from dv_market_private.psttg_v2_origin_head_v1 o where o.scope_ids&&ss),
 'scopes',(select coalesce(jsonb_agg(jsonb_build_object('o5_commitment',encode(dv_market_private.psttg_v2_hash(to_jsonb(g)),'hex'),'scope_id',g.scope_id,'generation',g.generation,'phase',g.phase,'recovery_state',g.recovery_state,'fence_token',g.fence_token,'fence_target_digest',encode(g.fence_target_digest,'hex'),'fence_generation',g.fence_generation,'integration_revision',(select count(*) from dv_market_private.psttg_v2_integration_entry_v1 e where g.scope_id=any(e.scope_ids))) order by g.scope_id),'[]') from dv_market_private.psttg_scope_guards g where g.scope_id=any(ss)),
 'v1_commitment',encode(dv_market_private.psttg_v2_hash(jsonb_build_array(
 (select jsonb_agg(to_jsonb(o) order by o.origin_id) from dv_market_private.psttg_origin_bindings o where o.scope_ids&&ss),
 (select jsonb_agg(to_jsonb(e) order by e.event_id) from dv_market_private.psttg_operation_events e where e.scope_ids&&ss),
 (select jsonb_agg(to_jsonb(r) order by r.record_id) from dv_market_private.psttg_records r where r.scope_ids&&ss))),'hex'),
 'channels',(select coalesce(jsonb_agg(to_jsonb(c)-'verification_key' order by c.channel_id),'[]') from dv_market_private.psttg_v2_channel_v1 c join dv_market_private.psttg_v2_connection_context_v1 x on c.channel_id=any(x.channel_ids) where x.context_id=ctx),
 'channel',(select to_jsonb(c)-'verification_key' from dv_market_private.psttg_v2_channel_v1 c where c.channel_id=ch)
 ) into p;return p;
end$$;
create function dv_market_private.psttg_v2_expected_channel_v1(p jsonb) returns jsonb
language sql immutable set search_path='' as $$select jsonb_set(p,'{channels}',(select coalesce(jsonb_agg(case when z->>'channel_id'=p->'channel'->>'channel_id' then p->'channel' else z end order by z->>'channel_id'),'[]') from jsonb_array_elements(p->'channels') z))$$;
create function dv_market_private.psttg_v2_expected_scope_step_v1(p jsonb,ids uuid[]) returns jsonb
language sql immutable set search_path='' as $$select jsonb_set(p,'{scopes}',(select jsonb_agg(case when (x->>'scope_id')::uuid=any(ids) then jsonb_set(x,'{integration_revision}',to_jsonb((x->>'integration_revision')::bigint+1)) else x end order by x->>'scope_id') from jsonb_array_elements(p->'scopes') x))$$;
create function dv_market_private.psttg_v2_require_groups_v1(ctx uuid,objects uuid[],secret text) returns uuid[]
language plpgsql volatile security definer set search_path='' as $$
declare id uuid; r jsonb; count_objects integer;begin
 with recursive closure(id) as(select unnest(objects) union select g.object_id from closure c join dv_market_private.psttg_unit_binding b on b.object_id=c.id cross join lateral unnest(b.dependencies) d join dv_market_private.psttg_unit_guard g on g.unit_id=d) select array_agg(distinct cl.id order by cl.id) into objects from closure cl;
 select count(distinct x) into count_objects from unnest(objects) x;
 if array_position(objects,null) is not null or (select count(*) from dv_market_private.psttg_object_anchor where object_id=any(objects))<>count_objects then raise exception 'v2_required_group_missing';end if;
 foreach id in array objects loop
  r:=dv_market_private.psttg_v2_read_locked_v1(ctx,id,secret);
  if r->'states' ?| array['integrity_violation','missing_unexplained','authorized_end_verified','copy_or_dependency_unresolved'] then raise exception 'v2_required_group_unavailable';end if;
 end loop;
 return dv_market_private.psttg_v2_group_units_v1(objects);
end$$;
create function dv_market_private.psttg_v2_new_capture_command_v1(id uuid,cmd uuid,kind text,ss uuid[],deps uuid[],decision uuid,original jsonb default '{}') returns jsonb
language sql volatile set search_path='' as $$select jsonb_build_object('command_id',cmd,'object_id',id,'incarnation',gen_random_uuid(),'version',1,'kind',kind,'scopes',ss,'dependencies',deps,'decision_ref',decision,'original',original)$$;
-- Every existing-object reference on the connection is tagged before any capture.
create function dv_market_private.psttg_v2_reference_v1(ref jsonb) returns uuid
language plpgsql stable security definer set search_path='' as $$declare id uuid;begin
 perform dv_market_private.psttg_v2_shape(ref,array['representation','schema_version','id','incarnation','version']);
 if ref->>'representation' is distinct from '2' or ref->>'schema_version' not in ('psttg-unit-v2','psttg-unit-v2-writer1') then raise exception 'v2_representation_mismatch';end if;
 id:=(ref->>'id')::uuid;
 if not exists(select from dv_market_private.psttg_object_anchor a where a.object_id=id and a.incarnation=(ref->>'incarnation')::uuid and a.content_version=(ref->>'version')::bigint and a.representation_version=2) or not exists(select from dv_market_private.psttg_content_unit where object_id=id) or exists(select from dv_market_private.psttg_content_unit where object_id=id and schema_version<>ref->>'schema_version') then raise exception 'v2_reference_version';end if;
 return id;
end$$;
create function dv_market_private.psttg_v2_dispatch_v1(contract text,refs jsonb) returns integer
language plpgsql stable security definer set search_path='' as $$declare r jsonb;id uuid;begin
 if jsonb_typeof(refs)<>'array' then raise exception 'v2_representation_mismatch';end if;
 if contract is null or contract='psttg-v1' then
  for r in select value from jsonb_array_elements(refs) loop
   id:=nullif(coalesce(r->>'id',r->>'origin_id',r->>'record_id',r->>'event_id'),'')::uuid;
   if coalesce(r->>'representation','1')<>'1' or exists(select from dv_market_private.psttg_object_anchor where object_id=id) then raise exception 'v2_representation_mismatch';end if;
  end loop;
  return 1; -- Legacy untagged references remain exclusively V1. No migration.
 end if;
 if contract<>'psttg-v2-writer-use/1' then raise exception 'v2_representation_mismatch';end if;
 for r in select value from jsonb_array_elements(refs) loop perform dv_market_private.psttg_v2_reference_v1(r);end loop;
 return 2;
end$$;
create function dv_market_private.psttg_v2_execute_v1(cmd jsonb,payload jsonb,ticket jsonb,signature bytea,secret text) returns jsonb
language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare action text:=cmd->>'action';ch uuid:=(cmd->>'channel')::uuid; op uuid:=(cmd->>'operation_ref')::uuid; command uuid:=(cmd->>'command_id')::uuid;
 ctx uuid; ss uuid[]; objects uuid[]:='{}'; deps uuid[]:='{}'; extract_units uuid[]:='{}'; keys uuid[]:=array[command]; sources uuid[]:='{}'; ids uuid[]; id uuid; groupid uuid; ownid uuid; proof jsonb; ccmd jsonb; copycmd jsonb; ready jsonb;
 g dv_market_private.psttg_v2_channel_v1; a dv_market_private.psttg_v2_use_admission_v1; t dv_market_private.psttg_v2_use_transition_v1; nt dv_market_private.psttg_v2_use_transition_v1; o dv_market_private.psttg_v2_origin_head_v1;
 m dv_market_private.psttg_k5_unitmanifest_v1; it dv_market_private.psttg_k5_unitattempt_v1;
 p jsonb; expected jsonb; actual jsonb; beforehash bytea; afterhash bytea; nextrev bigint; prev uuid; attempt uuid; epoch bigint; commitid uuid:=gen_random_uuid(); entryid uuid:=gen_random_uuid(); kind text; fields text[];
 oldguard jsonb; newguard jsonb; received_projection jsonb; item jsonb; result jsonb; u record; envelope jsonb; receipt dv_market_private.psttg_v2_ingress_v1;
begin
 fields:=array['contract','action','channel','operation_ref','command_id'];
 if action='SOURCE' then fields:=fields||array['source_ref','source_version','predecessor','group_ref','capture_command','scopes'];
 elsif action='ADMIT' then fields:=fields||array['admission_ref','input_group','input_command','own_group','own_command','input_revision','sources','mode','target','decision_ref'];
 elsif action in ('EXTRACT_COMMITTED','ATTEMPTING','OUTCOME_UNKNOWN','SEALED','BIND_EVIDENCE') then fields:=fields||array['admission_ref','revision','attempt_ref','epoch','group_ref','capture_command'];if action='BIND_EVIDENCE' then fields:=fields||array['receipt_ref','expected'];end if;
 elsif action in ('ASSESS','FENCE') then fields:=fields||array['targets','manifest_ref','manifest_revision','previous_manifest_ref','attempt_ref','epoch','authorization_ref','proof_refs','expected','adapter','unit_action'];
 elsif action in ('BEGIN','CANCELLED_SAFE','RECONCILE','ABORT_UNSTARTED') then fields:=fields||array['manifest_ref','revision','expected'];if action in ('RECONCILE','ABORT_UNSTARTED') then fields:=fields||array['receipt_ref'];end if;
 else raise exception 'v2_connection_action';end if;
 perform dv_market_private.psttg_v2_shape(cmd,fields);
 if cmd->>'contract' is distinct from 'psttg-v2-writer-use/1' or ch is null or op is null or command is null then raise exception 'v2_representation_dispatch';end if;
 perform dv_market_private.psttg_v2_dispatch_v1(cmd->>'contract',case when action='ADMIT' then (cmd->'sources')||case when cmd->'target'='{}'::jsonb then '[]'::jsonb else jsonb_build_array(cmd->'target') end when action in ('ASSESS','FENCE') then cmd->'targets' when action='SOURCE' and cmd->'predecessor'<>'{}'::jsonb then jsonb_build_array(cmd->'predecessor') else '[]'::jsonb end);
 select * into strict g from dv_market_private.psttg_v2_channel_v1 where channel_id=ch;ss:=g.scope_ids;
 if action='SOURCE' then
  select array_agg(x::uuid) into ss from jsonb_array_elements_text(cmd->'scopes') x;
  if not(ss<@g.scope_ids) then raise exception 'v2_channel_scope';end if;
  keys:=keys||array[(cmd->>'capture_command')::uuid];
  if cmd->'predecessor'<>'{}'::jsonb then objects:=array[dv_market_private.psttg_v2_reference_v1(cmd->'predecessor')];end if;
 elsif action='ADMIT' then
  select coalesce(array_agg(distinct dv_market_private.psttg_v2_reference_v1(value) order by dv_market_private.psttg_v2_reference_v1(value)),'{}') into sources from jsonb_array_elements(cmd->'sources');
  objects:=sources;keys:=keys||array[(cmd->>'input_command')::uuid,(cmd->>'own_command')::uuid];
  if cmd->'target'<>'{}'::jsonb then objects:=objects||array[dv_market_private.psttg_v2_reference_v1(cmd->'target')];end if;
 elsif action in ('EXTRACT_COMMITTED','ATTEMPTING','OUTCOME_UNKNOWN','SEALED','BIND_EVIDENCE') then
  select * into strict a from dv_market_private.psttg_v2_use_admission_v1 where admission_id=(cmd->>'admission_ref')::uuid;
  if a.channel_id<>ch or a.operation_ref<>op then raise exception 'v2_admission_binding';end if;
  ss:=a.scope_ids;keys:=keys||array[(cmd->>'capture_command')::uuid];
 elsif action in ('ASSESS','FENCE') then
  if cmd->>'unit_action' is distinct from 'SIMULATE_UNIT_TRANSITION' or cmd->>'adapter' is distinct from 'synthetic-unit/1' or payload<>'{}'::jsonb then raise exception 'v2_only_simulate_unit_transition';end if;
  select array_agg(dv_market_private.psttg_v2_reference_v1(x) order by x->>'id') into objects from jsonb_array_elements(cmd->'targets') x;
  if objects is null or cardinality(objects)>256 or cardinality(objects)<>(select count(distinct x) from unnest(objects) x) then raise exception 'v2_manifest_targets';end if;
 else
  select * into strict m from dv_market_private.psttg_k5_unitmanifest_v1 where manifest_id=(cmd->>'manifest_ref')::uuid;
  if m.channel_id<>ch or m.operation_ref<>op then raise exception 'v2_manifest_binding';end if;ss:=m.scope_ids;objects:=m.target_ids;
 end if;
 ss:=ss||coalesce((select array_agg(distinct s) from dv_market_private.psttg_unit_binding b cross join lateral unnest(b.scope_ids) s where b.object_id=any(objects)),'{}');
 ctx:=dv_market_private.psttg_v2_connection_lock_v1(ss,array[op],keys,array[ch]);
 select scopes into strict ss from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;
 perform dv_market_private.psttg_v2_verify_ticket_v1(ch,jsonb_build_array(cmd,payload),ticket,signature);
 if exists(select from dv_market_private.psttg_v2_channel_v1 q join dv_market_private.psttg_v2_connection_context_v1 c on q.channel_id=any(c.channel_ids) where c.context_id=ctx and q.quarantine) then raise exception 'v2_restore_quarantine';end if;
 select * into strict g from dv_market_private.psttg_v2_channel_v1 where channel_id=ch;
 if g.stopped and action not in ('BIND_EVIDENCE','RECONCILE','ABORT_UNSTARTED','ASSESS') then raise exception 'v2_channel_stopped';end if;
 if not(ss<@g.scope_ids) then raise exception 'v2_channel_scope';end if;
 p:=dv_market_private.psttg_v2_projection_v1(ctx,ch);beforehash:=dv_market_private.psttg_v2_hash(jsonb_build_array('psttg-v2-writer-use/1','projection/1',p));
 if action='SOURCE' then
  perform dv_market_private.psttg_v2_validate('origin',payload);
  if payload->>'source_ref'<>cmd->>'source_ref' or payload->>'source_version'<>cmd->>'source_version' then raise exception 'v2_source_binding';end if;
  select * into o from dv_market_private.psttg_v2_origin_head_v1 where source_ref=(cmd->>'source_ref')::uuid order by origin_revision desc limit 1;
  if found then
   if o.command_id=command then
    select dv_market_private.psttg_v2_plain(unit_id,secret) into strict proof from dv_market_private.psttg_content_unit where object_id=o.origin_ref and unit_kind='proof';
    if proof->'request'->>'connection' is distinct from encode(dv_market_private.psttg_v2_hash(jsonb_build_array(cmd,payload)),'hex') then raise exception 'v2_idempotency_conflict';end if;
    delete from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;return jsonb_build_object('group_ref',o.origin_ref);
   end if;
   if cmd->'predecessor'->>'id' is distinct from o.origin_ref::text then raise exception 'v2_stale_origin';end if;
   if (cmd->>'source_version')::bigint<o.source_version then raise exception 'v2_source_version_regression';end if;
   deps:=dv_market_private.psttg_v2_require_groups_v1(ctx,array[o.origin_ref],secret);nextrev:=o.origin_revision+1;
  else if cmd->'predecessor'<>'{}'::jsonb then raise exception 'v2_origin_predecessor';end if;nextrev:=1;end if;
  groupid:=(cmd->>'group_ref')::uuid;
  ccmd:=dv_market_private.psttg_v2_new_capture_command_v1(groupid,(cmd->>'capture_command')::uuid,'O1',ss,deps,command);
  perform dv_market_private.psttg_v2_capture_locked_v1(ctx,ccmd,payload,secret,jsonb_build_array(cmd,payload));
  insert into dv_market_private.psttg_v2_origin_head_v1 values(groupid,(cmd->>'source_ref')::uuid,(cmd->>'source_version')::bigint,nextrev,o.origin_ref,op,command,ss);
  insert into dv_market_private.psttg_v2_integration_entry_v1 values(entryid,command,ss,deps,'SOURCE',groupid,commitid);
  result:=jsonb_build_object('group_ref',groupid);
 elsif action='ADMIT' then
  if cmd->>'mode' not in ('record','correction','copy') or cardinality(sources)=0 or (cmd->>'input_revision')::bigint<1 then raise exception 'v2_writer_mode';end if;
  if exists(select from unnest(sources) s left join dv_market_private.psttg_v2_origin_head_v1 h on h.origin_ref=s where h.origin_ref is null or exists(select from dv_market_private.psttg_v2_origin_head_v1 n where n.predecessor_ref=h.origin_ref)) then raise exception 'v2_stale_origin';end if;
  if sources is distinct from (select array_agg(h.origin_ref order by h.origin_ref) from dv_market_private.psttg_v2_origin_head_v1 h where h.scope_ids&&ss and not exists(select from dv_market_private.psttg_v2_origin_head_v1 n where n.predecessor_ref=h.origin_ref)) then raise exception 'v2_incomplete_synthetic_source_mapping';end if;
  deps:=dv_market_private.psttg_v2_require_groups_v1(ctx,sources,secret);
  select * into a from dv_market_private.psttg_v2_use_admission_v1 where command_id=command;
  if found then
   select dv_market_private.psttg_v2_plain(unit_id,secret) into strict proof from dv_market_private.psttg_content_unit where object_id=a.input_group_ref and unit_kind='proof';
   if proof->'request'->>'connection' is distinct from encode(dv_market_private.psttg_v2_hash(jsonb_build_array(cmd,payload)),'hex') then raise exception 'v2_idempotency_conflict';end if;
   perform dv_market_private.psttg_v2_require_groups_v1(ctx,array[a.input_group_ref]||case when a.own_group_ref is null then '{}'::uuid[] else array[a.own_group_ref] end,secret);
   delete from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;return jsonb_build_object('admission_ref',a.admission_id,'commit_ref',a.commit_ref);
  end if;
  perform dv_market_private.psttg_v2_shape(payload,array['body','source_fragment','original_fragment']);
  perform dv_market_private.psttg_v2_validate('body',payload->'body');
  if cmd->>'mode'='record' and cmd->'target'<>'{}'::jsonb then raise exception 'v2_unregistered_target';end if;
  ownid:=(cmd->>'own_group')::uuid;
  if cmd->>'mode' in ('correction','copy') then
   perform dv_market_private.psttg_v2_reference_v1(cmd->'target');
   if not exists(select from dv_market_private.psttg_object_anchor where object_id=(cmd->'target'->>'id')::uuid and incarnation=(cmd->'target'->>'incarnation')::uuid and content_version=(cmd->'target'->>'version')::bigint) then raise exception 'v2_target_version';end if;
   extract_units:=dv_market_private.psttg_v2_require_groups_v1(ctx,array[(cmd->'target'->>'id')::uuid],secret);
   if cmd->>'mode'='copy' then
    select dv_market_private.psttg_v2_plain(unit_id,secret) into strict proof from dv_market_private.psttg_content_unit where object_id=(cmd->'target'->>'id')::uuid and unit_kind='body';
    if proof is distinct from payload->'body' then raise exception 'v2_copy_input_version';end if;
    deps:=deps||extract_units;extract_units:='{}';
    ccmd:=dv_market_private.psttg_v2_new_capture_command_v1(ownid,(cmd->>'own_command')::uuid,'COPY',ss,deps,(cmd->>'decision_ref')::uuid);
    copycmd:=ccmd;
   else
    ccmd:=dv_market_private.psttg_v2_new_capture_command_v1(ownid,(cmd->>'own_command')::uuid,'O3',ss,deps,(cmd->>'decision_ref')::uuid,(cmd->'target')-array['representation','schema_version']);
    perform dv_market_private.psttg_v2_capture_locked_v1(ctx,ccmd,payload,secret,jsonb_build_array(cmd,payload));
   end if;
  else ownid:=null;end if;
  groupid:=(cmd->>'input_group')::uuid;
  ready:=jsonb_build_object('input',jsonb_build_object('operation_ref',op,'input_revision',cmd->'input_revision','body',payload->'body'),'event',jsonb_build_object('operation_ref',op,'event_ref',gen_random_uuid(),'admission_ref',cmd->'admission_ref','meaning','internal_ready'));
  ccmd:=dv_market_private.psttg_v2_new_capture_command_v1(groupid,(cmd->>'input_command')::uuid,'O2_READY',ss,deps,(cmd->>'decision_ref')::uuid);
  perform dv_market_private.psttg_v2_capture_locked_v1(ctx,ccmd,ready,secret,jsonb_build_array(cmd,payload));
  if copycmd is not null then
    perform dv_market_private.psttg_v2_capture_locked_v1(ctx,copycmd,jsonb_build_object('target',cmd->'target'->'id','artifact',ownid,'artifact_version',cmd->'input_revision','coverage','unresolved'),secret,jsonb_build_array(cmd,payload));
  end if;
  deps:=deps||dv_market_private.psttg_v2_group_units_v1(array[groupid]||case when ownid is null then '{}'::uuid[] else array[ownid] end);
  select array_agg(distinct v order by v) into deps from unnest(deps) v;
  a.admission_id:=(cmd->>'admission_ref')::uuid;a.contract_version:='psttg-v2-writer-use/1';a.command_id:=command;a.operation_ref:=op;a.input_revision:=(cmd->>'input_revision')::bigint;a.channel_id:=ch;a.operating_incarnation:=g.operating_incarnation;a.admission_revision:=1;a.input_group_ref:=groupid;a.own_group_ref:=ownid;a.source_heads:=sources;a.required_units:=deps;a.extraction_units:=extract_units;a.scope_ids:=ss;a.adapter_version:='synthetic-writer/1';a.commit_ref:=commitid;a.registered_transaction:=pg_current_xact_id();a.registered_at:=clock_timestamp();a.binding_projection:=dv_market_private.psttg_v2_projection_v1(ctx,ch);a.commitment:=dv_market_private.psttg_v2_hash(jsonb_build_array('psttg-v2-writer-use/1','admission/1',to_jsonb(a)-'commitment'));
  expected:=dv_market_private.psttg_v2_expected_scope_step_v1(dv_market_private.psttg_v2_projection_v1(ctx,ch,null,to_jsonb(a)),ss);
  insert into dv_market_private.psttg_v2_use_admission_v1 select a.*;
  insert into dv_market_private.psttg_v2_integration_entry_v1 values(entryid,command,ss,deps||extract_units,'ADMIT',a.admission_id,commitid);
  if dv_market_private.psttg_v2_projection_v1(ctx,ch) is distinct from expected then raise exception 'v2_exact_admission_projection';end if;
  result:=jsonb_build_object('admission_ref',a.admission_id,'commit_ref',commitid);
 elsif action in ('EXTRACT_COMMITTED','ATTEMPTING','OUTCOME_UNKNOWN','SEALED','BIND_EVIDENCE') then
  select * into strict a from dv_market_private.psttg_v2_use_admission_v1 where admission_id=(cmd->>'admission_ref')::uuid;
  if a.registered_transaction=pg_current_xact_id() then raise exception 'v2_admission_commit_required';end if;
  if a.operating_incarnation<>g.operating_incarnation or a.commitment<>dv_market_private.psttg_v2_hash(jsonb_build_array('psttg-v2-writer-use/1','admission/1',to_jsonb(a)-'commitment')) then raise exception 'v2_admission_integrity';end if;
  if payload<>'{}'::jsonb then raise exception 'v2_transition_additional_input';end if;
  select * into t from dv_market_private.psttg_v2_use_transition_v1 where command_id=command;
  if found then
   if (t.admission_id,t.revision,t.attempt_id,t.execution_epoch,t.requested_group_ref,t.capture_command_id,t.transition_kind) is distinct from (a.admission_id,(cmd->>'revision')::bigint,(cmd->>'attempt_ref')::uuid,(cmd->>'epoch')::bigint,(cmd->>'group_ref')::uuid,(cmd->>'capture_command')::uuid,case when action='BIND_EVIDENCE' then 'EVIDENCE_BOUND' else action end) or (action='BIND_EVIDENCE' and (t.receipt_ref is distinct from (cmd->>'receipt_ref')::uuid or t.before_commitment is distinct from dv_market_private.psttg_v2_hash(jsonb_build_array('psttg-v2-writer-use/1','projection/1',cmd->'expected')))) then raise exception 'v2_idempotency_conflict';end if;
   delete from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;
   return jsonb_build_object('transition_ref',t.transition_id,'commit_ref',t.commit_ref);
  end if;
  select * into t from dv_market_private.psttg_v2_use_transition_v1 where admission_id=a.admission_id order by revision desc limit 1;
  nextrev:=coalesce(t.revision,0)+1;prev:=t.transition_id;
  if (cmd->>'revision')::bigint<>nextrev then raise exception 'v2_stale_transition';end if;
  if exists(select from dv_market_private.psttg_v2_origin_head_v1 where predecessor_ref=any(a.source_heads)) then raise exception 'v2_stale_origin';end if;
  select array_agg(distinct object_id order by object_id) into objects from dv_market_private.psttg_unit_guard where unit_id=any(a.required_units);
  -- COPY coverage stays unresolved, even though its own bytes can be checked.
  foreach id in array objects loop
   actual:=dv_market_private.psttg_v2_read_locked_v1(ctx,id,secret);
   if actual->'states' ?| array['integrity_violation','missing_unexplained','authorized_end_verified'] or exists(select from dv_market_private.psttg_unit_guard where object_id=id and phase<>'present') then raise exception 'v2_required_group_unavailable';end if;
  end loop;
  deps:='{}';groupid:=null;attempt:=(cmd->>'attempt_ref')::uuid;epoch:=(cmd->>'epoch')::bigint;
  if action='BIND_EVIDENCE' then
   if cmd->'expected' is distinct from p or t.transition_kind not in ('ATTEMPTING','OUTCOME_UNKNOWN') or t.attempt_id<>attempt or t.execution_epoch<>epoch then raise exception 'v2_receipt_transition_binding';end if;
   select * into strict receipt from dv_market_private.psttg_v2_ingress_v1 where receipt_id=(cmd->>'receipt_ref')::uuid;
   if receipt.channel_id<>ch or (select count(*) from dv_market_private.psttg_v2_ingress_v1 where channel_id=ch and event_ref=receipt.event_ref)<>1 then raise exception 'v2_receipt_conflict';end if;
   if exists(select from dv_market_private.psttg_v2_ingress_v1 where receipt_id=receipt.receipt_id and xmin::text=pg_current_xact_id()::text) then raise exception 'v2_receipt_commit_required';end if;
   if exists(select from dv_market_private.psttg_v2_ingress_v1 where receipt_id=receipt.receipt_id and xmin::text=pg_current_xact_id()::text) then raise exception 'v2_receipt_commit_required';end if;
   envelope:=dv_market_private.psttg_v2_ingress_plain_v1(receipt.receipt_id,secret);
   if envelope->>'target_ref'<>a.admission_id::text or envelope->>'operation_ref'<>op::text or envelope->>'attempt_ref'<>attempt::text or envelope->>'epoch'<>epoch::text or envelope->>'operating_incarnation'<>a.operating_incarnation::text or envelope->>'result'<>'SIMULATED' then raise exception 'v2_receipt_unmapped';end if;
   groupid:=(cmd->>'group_ref')::uuid;
   ccmd:=dv_market_private.psttg_v2_new_capture_command_v1(groupid,(cmd->>'capture_command')::uuid,'O2_EVIDENCE',ss,dv_market_private.psttg_v2_group_units_v1(array[a.input_group_ref]),command);
   perform dv_market_private.psttg_v2_capture_locked_v1(ctx,ccmd,jsonb_build_object('event',jsonb_build_object('operation_ref',op,'event_ref',receipt.event_ref,'admission_ref',a.admission_id,'meaning','simulated_evidenced','input_group_ref',a.input_group_ref,'input_revision',a.input_revision,'attempt_ref',attempt,'receipt_ref',receipt.receipt_id)),secret);
   deps:=dv_market_private.psttg_v2_group_units_v1(array[groupid]);
   insert into dv_market_private.psttg_v2_receipt_mapping_v1 values(gen_random_uuid(),receipt.receipt_id,ch,op,attempt,a.admission_id,groupid,commitid);
   update dv_market_private.psttg_v2_channel_v1 set mapping_revision=mapping_revision+1,stopped=exists(select from dv_market_private.psttg_v2_ingress_v1 r where r.channel_id=ch and not exists(select from dv_market_private.psttg_v2_receipt_mapping_v1 mm where mm.receipt_id=r.receipt_id)) where channel_id=ch;
   action:='EVIDENCE_BOUND';
  elsif action='EXTRACT_COMMITTED' then
   if t.transition_id is not null or cardinality(a.extraction_units)=0 or a.own_group_ref<>(cmd->>'group_ref')::uuid then raise exception 'v2_extraction_commit_binding';end if;
   if exists(select from dv_market_private.psttg_content_unit where object_id=a.own_group_ref and xmin::text=pg_current_xact_id()::text) then raise exception 'v2_correction_commit_required';end if;
   actual:=dv_market_private.psttg_v2_read_locked_v1(ctx,a.own_group_ref,secret);
   if not(actual->'states' ? 'required_correction_fragment') then raise exception 'v2_correction_proof_required';end if;
   deps:=a.extraction_units;groupid:=a.own_group_ref;
  elsif action='ATTEMPTING' then
   if (t.transition_id is not null and t.transition_kind<>'EXTRACT_COMMITTED') or (cardinality(a.extraction_units)>0 and t.transition_kind is distinct from 'EXTRACT_COMMITTED') then raise exception 'v2_unknown_no_retry';end if;
   if t.registered_transaction=pg_current_xact_id() then raise exception 'v2_prior_commit_required';end if;
   if epoch<>g.execution_epoch+1 then raise exception 'v2_epoch_consumed';end if;
   if exists(select from dv_market_private.psttg_v2_use_transition_v1 where attempt_id=attempt and transition_kind='ATTEMPTING') then raise exception 'v2_attempt_reuse';end if;
   update dv_market_private.psttg_v2_channel_v1 set execution_epoch=epoch where channel_id=ch;
  elsif action='OUTCOME_UNKNOWN' then
   if t.transition_kind is distinct from 'ATTEMPTING' or t.attempt_id<>attempt or t.execution_epoch<>epoch or t.registered_transaction=pg_current_xact_id() then raise exception 'v2_unknown_transition';end if;
  else
   if t.transition_kind is distinct from 'EVIDENCE_BOUND' or t.attempt_id<>attempt or t.execution_epoch<>epoch or t.registered_transaction=pg_current_xact_id() then raise exception 'v2_evidence_required';end if;
   perform dv_market_private.psttg_v2_require_groups_v1(ctx,array[t.group_ref],secret);
   -- Record materialization is bound exclusively to committed input, not caller additions.
   if payload<>'{}'::jsonb then raise exception 'v2_seal_additional_input';end if;
   select dv_market_private.psttg_v2_plain(unit_id,secret) into strict proof from dv_market_private.psttg_content_unit where object_id=a.input_group_ref and unit_kind='input';
   groupid:=(cmd->>'group_ref')::uuid;
   if a.own_group_ref is not null then groupid:=a.own_group_ref;
   else
    ccmd:=dv_market_private.psttg_v2_new_capture_command_v1(groupid,(cmd->>'capture_command')::uuid,'O3',ss,a.required_units||dv_market_private.psttg_v2_group_units_v1(array[t.group_ref]),command);
    perform dv_market_private.psttg_v2_capture_locked_v1(ctx,ccmd,jsonb_build_object('body',proof->'body','source_fragment',(proof->'body')-array['other_attributes','correction_reason'],'original_fragment','{}'::jsonb),secret);
   end if;
  end if;
  if action='SEALED' then deps:=dv_market_private.psttg_v2_group_units_v1(array[groupid,t.group_ref]);end if;
  nt.transition_id:=entryid;nt.admission_id:=a.admission_id;nt.command_id:=command;nt.revision:=nextrev;nt.previous_ref:=prev;nt.transition_kind:=action;nt.attempt_id:=attempt;nt.execution_epoch:=epoch;nt.group_ref:=groupid;nt.receipt_ref:=receipt.receipt_id;nt.affected_units:=deps;nt.commit_ref:=commitid;nt.registered_transaction:=pg_current_xact_id();nt.before_commitment:=beforehash;nt.requested_group_ref:=(cmd->>'group_ref')::uuid;nt.capture_command_id:=(cmd->>'capture_command')::uuid;nt.contract_version:='psttg-v2-writer-use/1';
  -- Compute the exact journal, demand-edge and scope projection BEFORE INSERT.
  -- The projection excludes its own two commitment bytes to avoid a hash cycle.
  expected:=dv_market_private.psttg_v2_expected_scope_step_v1(dv_market_private.psttg_v2_projection_v1(ctx,ch,to_jsonb(nt)),ss);
  nt.after_commitment:=dv_market_private.psttg_v2_hash(jsonb_build_array('psttg-v2-writer-use/1','projection/1',expected));
  insert into dv_market_private.psttg_v2_use_transition_v1 select nt.*;
  insert into dv_market_private.psttg_v2_integration_entry_v1 values(gen_random_uuid(),command,ss,deps,action,entryid,commitid);
  if dv_market_private.psttg_v2_projection_v1(ctx,ch) is distinct from expected then raise exception 'v2_exact_transition_projection';end if;
  result:=jsonb_build_object('transition_ref',entryid,'commit_ref',commitid);
 elsif action in ('ASSESS','FENCE') then
  for item in select value from jsonb_array_elements(cmd->'targets') loop
   perform dv_market_private.psttg_v2_reference_v1(item);
   if item->>'representation' is distinct from '2' or not exists(select from dv_market_private.psttg_object_anchor where object_id=(item->>'id')::uuid and incarnation=(item->>'incarnation')::uuid and content_version=(item->>'version')::bigint) then raise exception 'v2_representation_target';end if;
  end loop;
  if action='ASSESS' then
   delete from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;return p;
  end if;
  if p is distinct from cmd->'expected' then raise exception 'v2_manifest_stale_projection';end if;
  perform dv_market_private.psttg_v2_require_groups_v1(ctx,objects,secret);
  deps:=dv_market_private.psttg_v2_group_units_v1(objects);
  if exists(select from unnest(deps) du(unit_id) where dv_market_private.psttg_v2_active_demand_v1(du.unit_id)) or exists(select from dv_market_private.psttg_unit_binding where dependencies&&deps and not(object_id=any(objects))) then raise exception 'v2_manifest_required_group';end if;
  if (cmd->>'epoch')::bigint<>g.execution_epoch+1 then raise exception 'v2_epoch_consumed';end if;
  if jsonb_array_length(cmd->'proof_refs')<>9 or (select count(distinct x) from jsonb_array_elements_text(cmd->'proof_refs') x)<>9 then raise exception 'v2_positive_test_evidence_required';end if;
  for item in select value from jsonb_array_elements(cmd->'proof_refs') loop if (item#>>'{}')::uuid is null then raise exception 'v2_positive_test_evidence_required';end if;end loop;
  if nullif(cmd->>'previous_manifest_ref','') is null then
   if (cmd->>'manifest_revision')::bigint<>1 or exists(select from dv_market_private.psttg_k5_unitmanifest_v1 mm where mm.operation_ref=op) then raise exception 'v2_manifest_predecessor';end if;
  else
   select * into strict m from dv_market_private.psttg_k5_unitmanifest_v1 where manifest_id=(cmd->>'previous_manifest_ref')::uuid;
   select * into strict it from dv_market_private.psttg_k5_unitattempt_v1 where manifest_id=m.manifest_id order by state_revision desc limit 1;
   if m.channel_id<>ch or m.operation_ref<>op or m.manifest_revision+1<>(cmd->>'manifest_revision')::bigint or it.state<>'CANCELLED_SAFE' or exists(select from dv_market_private.psttg_k5_unitmanifest_v1 mm where mm.previous_manifest_ref=m.manifest_id) then raise exception 'v2_manifest_predecessor';end if;
  end if;
  m.manifest_id:=(cmd->>'manifest_ref')::uuid;m.manifest_revision:=(cmd->>'manifest_revision')::bigint;m.previous_manifest_ref:=nullif(cmd->>'previous_manifest_ref','')::uuid;m.contract_version:='psttg-k5-unitmanifest/1';m.command_id:=command;m.operation_ref:=op;m.channel_id:=ch;m.target_ids:=objects;m.target_units:=deps;m.scope_ids:=ss;m.attempt_id:=(cmd->>'attempt_ref')::uuid;m.operating_incarnation:=g.operating_incarnation;m.execution_epoch:=(cmd->>'epoch')::bigint;m.action:='SIMULATE_UNIT_TRANSITION';m.adapter_version:='synthetic-unit/1';m.authorization_ref:=(cmd->>'authorization_ref')::uuid;
  select array_agg(x::uuid) into m.evidence_refs from jsonb_array_elements_text(cmd->'proof_refs') x;
  m.canonicalization_version:=1;m.authorization_revision:=1;m.issuer_ref:=g.account_ref;m.issuer_key_version:=g.configuration_revision;m.positive_evidence:=ticket->'positive_test_proofs';
  m.before_projection:=p;m.signed_commitment:=dv_market_private.psttg_v2_hash(jsonb_build_array('psttg-k5-unitmanifest/1','canonical-jsonb/1',cmd));m.commit_ref:=commitid;m.registered_transaction:=pg_current_xact_id();
  expected:=dv_market_private.psttg_v2_expected_scope_step_v1(p,ss);
  for u in select * from dv_market_private.psttg_unit_guard where unit_id=any(deps) order by unit_id loop
   oldguard:=to_jsonb(u);newguard:=oldguard||jsonb_build_object('phase','fenced','revision',u.revision+1,'manifest_id',m.manifest_id,'manifest_revision',m.manifest_revision,'authorization_id',m.authorization_ref,'attempt_id',m.attempt_id);
   insert into dv_market_private.psttg_v2_guard_plan_v1 values(ctx,u.unit_id,oldguard,newguard);
   expected:=jsonb_set(expected,'{guards}',(select jsonb_agg(case when z->>'unit_id'=u.unit_id::text then newguard||jsonb_build_object('use_demand_revision',z->'use_demand_revision') else z end order by z->>'unit_id') from jsonb_array_elements(expected->'guards') z));
  end loop;
  m.after_projection:=expected;
  insert into dv_market_private.psttg_k5_unitmanifest_v1 select m.*;
  update dv_market_private.psttg_unit_guard set phase='fenced',revision=revision+1,manifest_id=m.manifest_id,manifest_revision=m.manifest_revision,authorization_id=m.authorization_ref,attempt_id=m.attempt_id where unit_id=any(deps);
  insert into dv_market_private.psttg_v2_integration_entry_v1 values(entryid,command,ss,'{}','FENCE',m.manifest_id,commitid);
  expected:=dv_market_private.psttg_v2_expected_channel_v1(expected);
  actual:=dv_market_private.psttg_v2_projection_v1(ctx,ch);
  if actual is distinct from expected then raise exception 'v2_exact_fence_postprojection';end if;
  insert into dv_market_private.psttg_k5_unitattempt_v1 values(gen_random_uuid(),m.manifest_id,command,1,null,'FENCED',m.attempt_id,m.execution_epoch,receipt.receipt_id,p,expected,commitid,pg_current_xact_id());
  result:=jsonb_build_object('manifest_ref',m.manifest_id,'commit_ref',commitid);
 else
  select * into strict it from dv_market_private.psttg_k5_unitattempt_v1 where manifest_id=m.manifest_id order by state_revision desc limit 1;
  if m.registered_transaction=pg_current_xact_id() or it.registered_transaction=pg_current_xact_id() then raise exception 'v2_prior_commit_required';end if;
  if (cmd->>'revision')::bigint<>it.state_revision or cmd->'expected' is distinct from p or (action not in ('RECONCILE','ABORT_UNSTARTED') and it.after_projection is distinct from p) then raise exception 'v2_foreign_projection_change';end if;
  expected:=dv_market_private.psttg_v2_expected_scope_step_v1(p,ss);
  if action='ABORT_UNSTARTED' then
   -- A NEW signed assessment may close a discarded reservation. It does not
   -- reinterpret intervening foreign scope/channel steps as this intent's work.
   if it.state<>'FENCED' or exists(select from dv_market_private.psttg_k5_unitattempt_v1 x where x.manifest_id=m.manifest_id and x.state='ATTEMPTING') then raise exception 'v2_unstarted_required';end if;
   if exists(select from dv_market_private.psttg_unit_guard gu where gu.unit_id=any(m.target_units) and (to_jsonb(gu)||jsonb_build_object('use_demand_revision',dv_market_private.psttg_v2_demand_v1(gu.unit_id))) is distinct from (select z from jsonb_array_elements(it.after_projection->'guards') z where z->>'unit_id'=gu.unit_id::text)) then raise exception 'v2_foreign_unit_change';end if;
   select * into strict receipt from dv_market_private.psttg_v2_ingress_v1 where receipt_id=(cmd->>'receipt_ref')::uuid;
   if receipt.channel_id<>ch or (select count(*) from dv_market_private.psttg_v2_ingress_v1 where channel_id=ch and event_ref=receipt.event_ref)<>1 then raise exception 'v2_receipt_conflict';end if;
   if exists(select from dv_market_private.psttg_v2_ingress_v1 where receipt_id=receipt.receipt_id and xmin::text=pg_current_xact_id()::text) then raise exception 'v2_receipt_commit_required';end if;
   envelope:=dv_market_private.psttg_v2_ingress_plain_v1(receipt.receipt_id,secret);
   if envelope->>'target_ref'<>m.manifest_id::text or envelope->>'operation_ref'<>op::text or envelope->>'attempt_ref'<>m.attempt_id::text or envelope->>'epoch'<>m.execution_epoch::text or envelope->>'operating_incarnation'<>m.operating_incarnation::text or envelope->>'result'<>'NOT_APPLIED_REVOKED' then raise exception 'v2_unstarted_revocation_required';end if;
   expected:=jsonb_set(expected,'{guards}',(select jsonb_agg(case when (z->>'unit_id')::uuid=any(m.target_units) then jsonb_set(z,'{use_demand_revision}',to_jsonb((z->>'use_demand_revision')::bigint+1)) else z end order by z->>'unit_id') from jsonb_array_elements(expected->'guards') z));
   insert into dv_market_private.psttg_v2_receipt_mapping_v1 values(gen_random_uuid(),receipt.receipt_id,ch,op,m.attempt_id,m.manifest_id,null,commitid);
   expected:=jsonb_set(expected,'{channel,mapping_revision}',to_jsonb(g.mapping_revision+1));
   expected:=jsonb_set(expected,'{channel,stopped}',to_jsonb(exists(select from dv_market_private.psttg_v2_ingress_v1 r where r.channel_id=ch and not exists(select from dv_market_private.psttg_v2_receipt_mapping_v1 mm where mm.receipt_id=r.receipt_id))));
   update dv_market_private.psttg_v2_channel_v1 set mapping_revision=g.mapping_revision+1,stopped=(expected->'channel'->>'stopped')::boolean where channel_id=ch;
  end if;
  if action='RECONCILE' then
   if it.state not in ('ATTEMPTING','OUTCOME_UNKNOWN') then raise exception 'v2_foreign_projection_change';end if;
   select * into strict receipt from dv_market_private.psttg_v2_ingress_v1 where receipt_id=(cmd->>'receipt_ref')::uuid;
   if receipt.channel_id<>ch or (select count(*) from dv_market_private.psttg_v2_ingress_v1 where channel_id=ch and event_ref=receipt.event_ref)<>1 then raise exception 'v2_receipt_conflict';end if;
   if exists(select from dv_market_private.psttg_v2_ingress_v1 where receipt_id=receipt.receipt_id and xmin::text=pg_current_xact_id()::text) then raise exception 'v2_receipt_commit_required';end if;
   envelope:=dv_market_private.psttg_v2_ingress_plain_v1(receipt.receipt_id,secret);
   if envelope->>'target_ref'<>m.manifest_id::text or envelope->>'operation_ref'<>op::text or envelope->>'attempt_ref'<>m.attempt_id::text or envelope->>'epoch'<>m.execution_epoch::text or envelope->>'operating_incarnation'<>m.operating_incarnation::text or envelope->>'result' not in ('SIMULATED','NOT_APPLIED_REVOKED','UNKNOWN') then raise exception 'v2_receipt_unmapped';end if;
   if g.receipt_revision<>(it.after_projection->'channel'->>'receipt_revision')::bigint+1 or g.stop_revision<>(it.after_projection->'channel'->>'stop_revision')::bigint+1 or not g.stopped or receipt.receipt_revision<>g.receipt_revision then raise exception 'v2_unbound_receipt_revision';end if;
   received_projection:=jsonb_set(jsonb_set(jsonb_set(it.after_projection,'{channel,receipt_revision}',to_jsonb(receipt.receipt_revision)),'{channel,stop_revision}',to_jsonb((it.after_projection->'channel'->>'stop_revision')::bigint+1)),'{channel,stopped}','true');
   received_projection:=dv_market_private.psttg_v2_expected_channel_v1(received_projection);
   if p is distinct from received_projection then raise exception 'v2_foreign_channel_change';end if;
   kind:=case envelope->>'result' when 'UNKNOWN' then 'OUTCOME_UNKNOWN' else envelope->>'result' end;
   expected:=jsonb_set(expected,'{guards}',(select jsonb_agg(case when (z->>'unit_id')::uuid=any(m.target_units) then jsonb_set(z,'{use_demand_revision}',to_jsonb((z->>'use_demand_revision')::bigint+1)) else z end order by z->>'unit_id') from jsonb_array_elements(expected->'guards') z));
   insert into dv_market_private.psttg_v2_receipt_mapping_v1 values(gen_random_uuid(),receipt.receipt_id,ch,op,m.attempt_id,m.manifest_id,null,commitid);
   expected:=jsonb_set(expected,'{channel,mapping_revision}',to_jsonb(g.mapping_revision+1));
   expected:=jsonb_set(expected,'{channel,stopped}',to_jsonb(exists(select from dv_market_private.psttg_v2_ingress_v1 r where r.channel_id=ch and not exists(select from dv_market_private.psttg_v2_receipt_mapping_v1 mm where mm.receipt_id=r.receipt_id))));
   update dv_market_private.psttg_v2_channel_v1 set mapping_revision=g.mapping_revision+1,stopped=(expected->'channel'->>'stopped')::boolean where channel_id=ch;
  elsif action='BEGIN' then
   if it.state<>'FENCED' then raise exception 'v2_unknown_no_retry';end if;
   if m.execution_epoch<>g.execution_epoch+1 then raise exception 'v2_epoch_consumed';end if;
   expected:=jsonb_set(expected,'{channel,execution_epoch}',to_jsonb(m.execution_epoch));
   update dv_market_private.psttg_v2_channel_v1 set execution_epoch=m.execution_epoch where channel_id=ch;
   kind:='ATTEMPTING';
  else
   if action<>'ABORT_UNSTARTED' and it.state<>'NOT_APPLIED_REVOKED' then raise exception 'v2_not_applied_revocation_required';end if;
   for u in select * from dv_market_private.psttg_unit_guard where unit_id=any(m.target_units) order by unit_id loop
    if u.phase<>'fenced' or u.manifest_id<>m.manifest_id or u.attempt_id<>m.attempt_id then raise exception 'v2_fence_ownership';end if;
    oldguard:=to_jsonb(u);newguard:=oldguard||jsonb_build_object('phase','present','revision',u.revision+1,'manifest_id',null,'manifest_revision',null,'authorization_id',null,'attempt_id',null);
    insert into dv_market_private.psttg_v2_guard_plan_v1 values(ctx,u.unit_id,oldguard,newguard);
    expected:=jsonb_set(expected,'{guards}',(select jsonb_agg(case when z->>'unit_id'=u.unit_id::text then newguard||jsonb_build_object('use_demand_revision',z->'use_demand_revision') else z end order by z->>'unit_id') from jsonb_array_elements(expected->'guards') z));
   end loop;
   update dv_market_private.psttg_unit_guard set phase='present',revision=revision+1,manifest_id=null,manifest_revision=null,authorization_id=null,attempt_id=null where unit_id=any(m.target_units);kind:='CANCELLED_SAFE';
  end if;
  insert into dv_market_private.psttg_v2_integration_entry_v1 values(entryid,command,ss,'{}',action,m.manifest_id,commitid);
  expected:=dv_market_private.psttg_v2_expected_channel_v1(expected);
  actual:=dv_market_private.psttg_v2_projection_v1(ctx,ch);
  if actual is distinct from expected then raise exception 'v2_exact_unit_postprojection';end if;
  insert into dv_market_private.psttg_k5_unitattempt_v1 values(gen_random_uuid(),m.manifest_id,command,it.state_revision+1,it.entry_id,kind,m.attempt_id,m.execution_epoch,receipt.receipt_id,p,expected,commitid,pg_current_xact_id());
  result:=jsonb_build_object('manifest_ref',m.manifest_id,'attempt_ref',m.attempt_id,'commit_ref',commitid);
 end if;
 delete from dv_market_private.psttg_v2_guard_plan_v1 where context_id=ctx;
 delete from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;
 return result;
end$$;
create function dv_market_private.psttg_v2_ingress_plain_v1(id uuid,secret text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$declare r dv_market_private.psttg_v2_ingress_v1;k jsonb;begin
 select * into strict r from dv_market_private.psttg_v2_ingress_v1 where receipt_id=id;
 if r.cipher_commitment<>dv_market_private.psttg_v2_hash(jsonb_build_array(r.receipt_id,r.channel_id,r.event_ref,r.receipt_revision,r.key_ref,encode(r.wrapped_key,'hex'),encode(r.ciphertext,'hex'))) then raise exception 'v2_receipt_integrity';end if;
 k:=dv_market_private.psttg_v2_decrypt(r.wrapped_key,secret);
 if k->>'receipt'<>id::text or k->>'key_ref'<>r.key_ref::text then raise exception 'v2_receipt_key_binding';end if;
 return dv_market_private.psttg_v2_decrypt(r.ciphertext,k->>'key');
end$$;
create function dv_market_private.psttg_v2_receive_v1(ch uuid,envelope jsonb,signature bytea,secret text) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare g dv_market_private.psttg_v2_channel_v1;ns text;sig bytea;k text;r dv_market_private.psttg_v2_ingress_v1;old record;begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='40001',message='v2_snapshot_retry';end if;
 select * into strict g from dv_market_private.psttg_v2_channel_v1 where channel_id=ch for update;
 perform dv_market_private.psttg_v2_shape(envelope,array['contract','channel','system_ref','environment_ref','account_ref','event_ref','operation_ref','attempt_ref','target_ref','operating_incarnation','epoch','result','proof_ref','payload']);
 if envelope->>'contract' is distinct from 'synthetic-unit-result/1' or envelope->>'channel'<>ch::text or envelope->>'system_ref'<>g.target_system_ref::text or envelope->>'environment_ref'<>g.environment_ref::text or envelope->>'account_ref'<>g.account_ref::text or envelope->>'result' not in ('SIMULATED','NOT_APPLIED_REVOKED','UNKNOWN','UNMAPPED') then raise exception 'v2_ingress_binding';end if;
 perform dv_market_private.psttg_v2_shape(envelope->'payload',array['detail_ref']);
 perform (envelope->'payload'->>'detail_ref')::uuid;
 perform (envelope->>'proof_ref')::uuid;
 perform (envelope->>'event_ref')::uuid;perform (envelope->>'operation_ref')::uuid;perform (envelope->>'attempt_ref')::uuid;perform (envelope->>'target_ref')::uuid;perform (envelope->>'operating_incarnation')::uuid;
 if (envelope->>'epoch')::bigint<1 then raise exception 'v2_ingress_epoch';end if;
 select n.nspname into strict ns from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
 execute format('select %I.hmac($1,$2,''sha256'')',ns) into sig using convert_to(envelope::text,'UTF8'),g.verification_key;
 if signature is distinct from sig then raise exception 'v2_ingress_unauthentic';end if;
 for old in select receipt_id from dv_market_private.psttg_v2_ingress_v1 where channel_id=ch and event_ref=(envelope->>'event_ref')::uuid order by receipt_revision loop
  if dv_market_private.psttg_v2_ingress_plain_v1(old.receipt_id,secret)=envelope then return old.receipt_id;end if;
 end loop;
 r.receipt_id:=gen_random_uuid();r.channel_id:=ch;r.event_ref:=(envelope->>'event_ref')::uuid;r.receipt_revision:=g.receipt_revision+1;r.key_ref:=gen_random_uuid();
 execute format('select encode(%I.gen_random_bytes(32),''hex'')',ns) into k;
 r.wrapped_key:=dv_market_private.psttg_encrypt(jsonb_build_object('key',k,'receipt',r.receipt_id,'key_ref',r.key_ref),secret);
 r.ciphertext:=dv_market_private.psttg_encrypt(envelope,k);r.received_at:=clock_timestamp();
 r.cipher_commitment:=dv_market_private.psttg_v2_hash(jsonb_build_array(r.receipt_id,r.channel_id,r.event_ref,r.receipt_revision,r.key_ref,encode(r.wrapped_key,'hex'),encode(r.ciphertext,'hex')));
 insert into dv_market_private.psttg_v2_ingress_v1 select r.*;
 update dv_market_private.psttg_v2_channel_v1 set receipt_revision=r.receipt_revision,stop_revision=stop_revision+1,stopped=true where channel_id=ch;
 return r.receipt_id; -- caller must independently observe COMMIT before ACK
end$$;
create function dv_market_private.psttg_v2_quarantine_v1(ch uuid,notice jsonb,signature bytea) returns void
language plpgsql volatile security definer set search_path='' as $$
declare g dv_market_private.psttg_v2_channel_v1;ns text;sig bytea;ctx uuid;ss uuid[];plans jsonb;z jsonb;keys uuid[];qc uuid:=gen_random_uuid();commitid uuid:=gen_random_uuid();p jsonb;expected jsonb;actual jsonb;m dv_market_private.psttg_k5_unitmanifest_v1;it dv_market_private.psttg_k5_unitattempt_v1;begin
 perform dv_market_private.psttg_v2_shape(notice,array['contract','action','channel','external_incarnation']);
 select * into strict g from dv_market_private.psttg_v2_channel_v1 where channel_id=ch;
 select coalesce(jsonb_agg(jsonb_build_object('manifest',manifest_id,'command',gen_random_uuid()) order by manifest_id),'[]') into plans from dv_market_private.psttg_k5_unitmanifest_v1 where channel_id=ch;
 select coalesce(array_agg((value->>'command')::uuid),'{}')||array[qc] into keys from jsonb_array_elements(plans);
 ctx:=dv_market_private.psttg_v2_connection_lock_v1(g.scope_ids,array[ch],keys,array[ch]);
 select scopes into strict ss from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;
 select * into strict g from dv_market_private.psttg_v2_channel_v1 where channel_id=ch;
 if notice->>'contract' is distinct from 'psttg-k5-unitmanifest/1' or notice->>'action' is distinct from 'RESTORE_QUARANTINE' or notice->>'channel'<>ch::text or (notice->>'external_incarnation')::uuid is null or (notice->>'external_incarnation')::uuid=g.operating_incarnation then raise exception 'v2_restore_notice';end if;
 select n.nspname into strict ns from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
 execute format('select %I.hmac($1,$2,''sha256'')',ns) into sig using convert_to(notice::text,'UTF8'),g.verification_key;
 if signature is distinct from sig then raise exception 'v2_restore_unauthentic';end if;
 if g.quarantine then delete from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;return;end if;
 p:=dv_market_private.psttg_v2_projection_v1(ctx,ch);expected:=dv_market_private.psttg_v2_expected_scope_step_v1(p,ss);
 expected:=jsonb_set(jsonb_set(jsonb_set(expected,'{channel,quarantine}','true'),'{channel,stopped}','true'),'{channel,stop_revision}',to_jsonb(g.stop_revision+1));
 update dv_market_private.psttg_v2_channel_v1 set quarantine=true,stopped=true,stop_revision=stop_revision+1 where channel_id=ch;
 insert into dv_market_private.psttg_v2_integration_entry_v1 values(gen_random_uuid(),qc,ss,'{}','QUARANTINE',ch,commitid);
 expected:=dv_market_private.psttg_v2_expected_channel_v1(expected);
 actual:=dv_market_private.psttg_v2_projection_v1(ctx,ch);if actual is distinct from expected then raise exception 'v2_exact_quarantine_projection';end if;
 for z in select value from jsonb_array_elements(plans) loop
  select * into strict m from dv_market_private.psttg_k5_unitmanifest_v1 where manifest_id=(z->>'manifest')::uuid;
  select * into strict it from dv_market_private.psttg_k5_unitattempt_v1 where manifest_id=m.manifest_id order by state_revision desc limit 1;
  insert into dv_market_private.psttg_k5_unitattempt_v1 values(gen_random_uuid(),m.manifest_id,(z->>'command')::uuid,it.state_revision+1,it.entry_id,'QUARANTINE',m.attempt_id,m.execution_epoch,null,p,expected,commitid,pg_current_xact_id());
 end loop;
 delete from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;
end$$;
create function dv_market_private.psttg_v2_connection_read_v1(id uuid,secret text,representation integer default 2) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare ss uuid[];ctx uuid;p jsonb;r jsonb;begin
 if representation is distinct from 2 then raise exception 'v2_representation_rejected';end if;
 select scope_ids into strict ss from dv_market_private.psttg_unit_binding where object_id=id;
 ctx:=dv_market_private.psttg_v2_connection_lock_v1(ss,'{}','{}','{}');
 if exists(select from dv_market_private.psttg_v2_channel_v1 c join dv_market_private.psttg_v2_connection_context_v1 x on c.channel_id=any(x.channel_ids) where x.context_id=ctx and c.quarantine) then raise exception 'v2_restore_quarantine';end if;
 r:=dv_market_private.psttg_v2_read_locked_v1(ctx,id,secret,representation);
 p:=dv_market_private.psttg_v2_projection_v1(ctx,null);
 r:=r||jsonb_build_object('reader_contract','psttg-v2-writer-use/1','demand_vector',p->'guards','scope_vector',p->'scopes','edge_commitment',encode(dv_market_private.psttg_v2_hash(p->'edges'),'hex'),'integration_fingerprint',encode(dv_market_private.psttg_v2_hash(p),'hex'));
 delete from dv_market_private.psttg_v2_connection_context_v1 where context_id=ctx;return r;
end$$;
-- A transport retry can read the same immutable operation without initiating one.
-- An entry visible in this backend's own uncommitted transaction is never a receipt.
create function dv_market_private.psttg_v2_result_v1(ch uuid,op uuid,command uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$declare r jsonb;tx xid8;begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='40001',message='v2_snapshot_retry';end if;
 if not exists(select from dv_market_private.psttg_v2_channel_v1 where channel_id=ch and not quarantine) then raise exception 'v2_restore_quarantine';end if;
 select jsonb_build_object('admission_ref',a.admission_id,'commit_ref',a.commit_ref),a.registered_transaction into r,tx from dv_market_private.psttg_v2_use_admission_v1 a where a.channel_id=ch and a.operation_ref=op and a.command_id=command;
 if r is null then select jsonb_build_object('transition_ref',t.transition_id,'commit_ref',t.commit_ref),t.registered_transaction into r,tx from dv_market_private.psttg_v2_use_transition_v1 t join dv_market_private.psttg_v2_use_admission_v1 a using(admission_id) where a.channel_id=ch and a.operation_ref=op and t.command_id=command;end if;
 if r is null then select jsonb_build_object('manifest_ref',m.manifest_id,'commit_ref',m.commit_ref),m.registered_transaction into r,tx from dv_market_private.psttg_k5_unitmanifest_v1 m where m.channel_id=ch and m.operation_ref=op and m.command_id=command;end if;
 if r is null then select jsonb_build_object('manifest_ref',t.manifest_id,'attempt_ref',t.attempt_id,'commit_ref',t.commit_ref),t.registered_transaction into r,tx from dv_market_private.psttg_k5_unitattempt_v1 t join dv_market_private.psttg_k5_unitmanifest_v1 m using(manifest_id) where m.channel_id=ch and m.operation_ref=op and t.command_id=command;end if;
 if r is null or tx=pg_current_xact_id() then return jsonb_build_object('status','commit_not_confirmed');end if;
 return r||jsonb_build_object('status','committed_visible');
end$$;
-- PROTECTION INSTALLATION: tests may prepare configuration fixtures before this marker.
create function dv_market_private.psttg_v2_append_only_v1() returns trigger
language plpgsql volatile security definer set search_path='' as $$declare stack text;begin
 if TG_OP<>'INSERT' then raise exception 'v2_append_only';end if;
 get diagnostics stack=PG_CONTEXT;
 if stack !~ 'function dv_market_private\.psttg_v2_(execute_v1|receive_v1|quarantine_v1)\(' then raise exception 'v2_private_journal_entry';end if;
 return new;
end$$;
create function dv_market_private.psttg_v2_channel_write_v1() returns trigger
language plpgsql volatile security definer set search_path='' as $$declare stack text;begin
 get diagnostics stack=PG_CONTEXT;
 if TG_OP<>'UPDATE' or stack !~ 'function dv_market_private\.psttg_v2_(execute_v1|receive_v1|quarantine_v1)\(' then raise exception 'v2_private_channel_transition';end if;
 if (to_jsonb(new)-array['execution_epoch','receipt_revision','mapping_revision','stop_revision','stopped','quarantine']) is distinct from (to_jsonb(old)-array['execution_epoch','receipt_revision','mapping_revision','stop_revision','stopped','quarantine']) or new.execution_epoch not between old.execution_epoch and old.execution_epoch+1 or new.receipt_revision not between old.receipt_revision and old.receipt_revision+1 or new.mapping_revision not between old.mapping_revision and old.mapping_revision+1 or new.stop_revision not between old.stop_revision and old.stop_revision+1 or (old.quarantine and not new.quarantine) then raise exception 'v2_channel_immutable';end if;
 return new;
end$$;
create trigger connection_channel_write before insert or update or delete on dv_market_private.psttg_v2_channel_v1 for each row execute function dv_market_private.psttg_v2_channel_write_v1();
create function dv_market_private.psttg_v2_plan_write_v1() returns trigger
language plpgsql volatile security definer set search_path='' as $$declare cid uuid;begin
 cid:=case when TG_OP='DELETE' then old.context_id else new.context_id end;
 perform dv_market_private.psttg_v2_context_assert_v1(cid);
 if TG_OP='UPDATE' then raise exception 'v2_plan_immutable';end if;
 return case when TG_OP='DELETE' then old else new end;
end$$;
create trigger connection_plan_write before insert or update or delete on dv_market_private.psttg_v2_guard_plan_v1 for each row execute function dv_market_private.psttg_v2_plan_write_v1();
do $$declare t text;r record;begin
 foreach t in array array['psttg_v2_use_admission_v1','psttg_v2_use_transition_v1','psttg_v2_origin_head_v1','psttg_v2_integration_entry_v1','psttg_k5_unitmanifest_v1','psttg_k5_unitattempt_v1','psttg_v2_ingress_v1','psttg_v2_receipt_mapping_v1'] loop
  execute format('create trigger connection_append_only before insert or update or delete on dv_market_private.%I for each row execute function dv_market_private.psttg_v2_append_only_v1()',t);
 end loop;
 for r in select c.oid::regclass obj from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='dv_market_private' and c.relkind='r' and (c.relname like 'psttg_v2_%_v1' or c.relname in ('psttg_k5_unitmanifest_v1','psttg_k5_unitattempt_v1')) loop
  execute format('alter table %s owner to dv_psttg_core_owner',r.obj);
  execute format('alter table %s enable row level security',r.obj);
  execute format('revoke all on %s from public,anon,authenticated,service_role',r.obj);
  execute format('create trigger connection_no_truncate before truncate on %s for each statement execute function dv_market_private.psttg_reject_mutation()',r.obj);
 end loop;
 for r in select p.oid::regprocedure obj from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and p.proname like 'psttg_v2_%' loop
  execute format('alter function %s owner to dv_psttg_core_owner',r.obj);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.obj);
 end loop;
end$$;
commit;
