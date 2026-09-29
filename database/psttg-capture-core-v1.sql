-- V105 K1/K3 isolated branch candidate. No producer, end-path or deployment.
-- The internal primitives have NO application grantees. A future adapter needs
-- its own reviewed source/evidence contract; service_role is not an attestation.
begin;
create schema if not exists dv_market_private;
do $$begin
 if not exists(select from pg_roles where rolname='dv_psttg_core_owner') then
  create role dv_psttg_core_owner nologin noinherit;
 end if;
 if exists(select from pg_roles where rolname='dv_psttg_core_owner' and (rolcanlogin or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb)) or
 exists(select from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname='dv_psttg_core_owner') then raise exception 'psttg_owner_role_unsafe';end if;
end$$;
grant usage on schema dv_market_private to dv_psttg_core_owner;
do $$declare ns text;begin
 select n.nspname into strict ns from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
 execute format('grant usage on schema %I to dv_psttg_core_owner',ns);
end$$;

create table dv_market_private.psttg_scope_guards (
 scope_id uuid primary key default gen_random_uuid(),
 scope_kind text not null check(scope_kind in ('subject','process','source_object')),
 scope_binding_digest bytea not null check(octet_length(scope_binding_digest)=32),
 subject_binding_ciphertext bytea,
 source_object_ref text,
 generation bigint not null default 0 check(generation>=0),
 phase text not null default 'open' check(phase in ('open','fenced','closed')),
 fence_token uuid, fence_target_digest bytea, fence_generation bigint,
 recovery_state text not null default 'none' check(recovery_state in ('none','pending','partial','failed')),
 unique(scope_kind,scope_binding_digest),
 check((phase='open' and fence_token is null and fence_target_digest is null and fence_generation is null and recovery_state='none')
    or (phase in ('fenced','closed') and fence_token is not null and octet_length(fence_target_digest)=32 and fence_generation is not null))
);
create table dv_market_private.psttg_origin_bindings (
 origin_id uuid primary key default gen_random_uuid(),
 scope_ids uuid[] not null check(cardinality(scope_ids)>0),
 source_system text not null, environment_id text not null,
 source_kind text not null check(source_kind in ('process_document','seller_input','declaration','review','contract','tax_event','review_export','provider_evidence','external_record','operator_attestation')),
 source_id text not null, source_version text not null,
 source_digest bytea not null check(octet_length(source_digest)=32),
 operating_mode text not null check(operating_mode in ('synthetic_test','provider_sandbox','real_operation','unresolved')),
 classification_basis text not null check(classification_basis in ('isolated_fixture','verified_provider','approved_producer','scoped_attestation','conflict')),
 attestation_payload jsonb not null,
 attested_by text not null, attested_at timestamptz not null,
 producer_version text not null,
 provider_mode text, provider_account_ref text, provider_event_ref text, signature_verification_ref text,
 predecessor_origin_id uuid references dv_market_private.psttg_origin_bindings,
 classification_reason text,
 origin_revision bigint not null check(origin_revision>0),
 command_digest bytea not null,
 unique(source_system,environment_id,source_kind,source_id,source_version,origin_revision),
 unique(predecessor_origin_id),
 check((origin_revision=1 and predecessor_origin_id is null) or (origin_revision>1 and predecessor_origin_id is not null))
);
create table dv_market_private.psttg_operation_events (
 event_id uuid primary key default gen_random_uuid(), operation_id uuid not null,
 event_seq bigint not null check(event_seq>0),
 action_kind text not null check(action_kind in ('process_document','diligence','submission','provider_notice_general','provider_notice_annual','cooperation_request','cooperation_reminder','cooperation_measure','cooperation_lift','copy','external_record_import')),
 event_kind text not null check(event_kind in ('draft','ready','attempting','failed','outcome_unknown','cancelled','executed_evidenced','accepted','rejected','delivered','copy')),
 attempt_id uuid, scope_ids uuid[] not null,
 subject_scope_id uuid references dv_market_private.psttg_scope_guards,
 case_ref text, origin_id uuid not null references dv_market_private.psttg_origin_bindings,
 input_revision text not null, input_digest bytea not null check(octet_length(input_digest)=32),
 input_ref text not null, idempotency_key text not null,
 actor_ref text not null, producer_version text not null,
 observed_at timestamptz not null, actual_event_at timestamptz,
 event_time_basis text not null check(event_time_basis in ('none','verified_source','native_transaction')),
 evidence_payload_ciphertext bytea, evidence_digest bytea,
 external_reference text, external_event_id text, external_source_system text, external_environment_id text,
 outcome_code text, original_record_id uuid, original_origin_id uuid,
 original_version text, artifact_id text,
 command_digest bytea not null,
 unique(operation_id,event_seq),
 unique nulls not distinct(origin_id,action_kind,idempotency_key,event_kind,attempt_id),
 check((evidence_payload_ciphertext is null)=(evidence_digest is null))
);
create unique index psttg_callback_key on dv_market_private.psttg_operation_events(external_source_system,external_environment_id,external_event_id)
 where external_event_id is not null;
create table dv_market_private.psttg_records (
 record_id uuid primary key default gen_random_uuid(),
 record_class text not null check(record_class in ('process_description','due_diligence','reported_information','provider_notice','cooperation_event')),
 record_subtype text not null, schema_version text not null check(schema_version='psttg-payload-v1'),
 duty_holder_ref text not null, operation_id uuid not null,
 execution_event_id uuid not null references dv_market_private.psttg_operation_events,
 origin_id uuid not null references dv_market_private.psttg_origin_bindings,
 subject_scope_id uuid references dv_market_private.psttg_scope_guards,
 scope_ids uuid[] not null, reporting_period integer, process_version text not null,
 payload_ciphertext bytea not null, payload_digest bytea not null,
 canonicalization_version text not null check(canonicalization_version='pg-jsonb-v1'),
 encryption_key_ref text not null, source_bindings jsonb not null,
 business_at timestamptz, processed_at timestamptz, transmitted_at timestamptz,
 notified_at timestamptz, executed_at timestamptz, source_record_created_at timestamptz,
 ingested_at timestamptz not null, sealed_at timestamptz not null,
 creation_year integer check(creation_year between 1900 and 9990),
 creation_zone text not null check(creation_zone='Europe/Berlin'),
 creation_basis text not null check(creation_basis in ('native_seal','verified_external_original','unresolved')),
 creation_proof jsonb not null, producer_identity text not null, producer_version text not null,
 content_revision text not null, seal_digest bytea not null, seal_envelope jsonb not null,
 seal_algorithm_version text not null check(seal_algorithm_version='sha256-envelope-v1'),
 capture_command_id uuid not null unique,
 record_state text not null check(record_state in ('evidenced','clarification_required')),
 scope_generation_at_seal jsonb not null, end_rule_version text not null check(end_rule_version='K103-DE-v1'),
 end_at timestamptz, command_digest bytea not null,
 unique nulls not distinct(operation_id,subject_scope_id,record_class,record_subtype,content_revision),
 check((creation_basis='unresolved' and creation_year is null and end_at is null and record_state='clarification_required')
 or (creation_basis<>'unresolved' and creation_year is not null and end_at is not null and record_state='evidenced'))
);
create table dv_market_private.psttg_record_links (
 link_id uuid primary key default gen_random_uuid(),
 from_record_id uuid not null references dv_market_private.psttg_records,
 to_record_id uuid references dv_market_private.psttg_records,
 source_origin_id uuid references dv_market_private.psttg_origin_bindings,
 link_kind text not null check(link_kind in ('corrects','uses_information_from','clarifies_provenance')),
 target_version text not null, required_fields jsonb not null,
 purpose_code text not null, legal_basis_ref text,
 embedded_fragment_digest bytea, created_at timestamptz not null, producer_identity text not null,
 check(num_nonnulls(to_record_id,source_origin_id)=1),
 check(to_record_id is distinct from from_record_id),
 unique nulls not distinct(from_record_id,to_record_id,source_origin_id,link_kind)
);

create function dv_market_private.psttg_reject_mutation() returns trigger
language plpgsql set search_path='' as $$begin raise exception 'psttg_immutable';end$$;

-- No scope setter/fence issuer is installed. End-process contract peers exist
-- only in the disposable test fixture. Row locks reject old RR snapshots.
create function dv_market_private.psttg_lock_scopes(ids uuid[]) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare r record; n integer:=0; result jsonb:='{}';
begin
 if ids is null or cardinality(ids)=0 or array_position(ids,null) is not null then raise exception 'psttg_scope_missing';end if;
 for r in select * from dv_market_private.psttg_scope_guards where scope_id=any(ids) order by scope_id for update loop
  n:=n+1;
  if r.phase<>'open' then raise exception 'psttg_scope_fenced';end if;
  result:=result||jsonb_build_object(r.scope_id::text,r.generation);
 end loop;
 if n<>(select count(distinct x) from unnest(ids) x) then raise exception 'psttg_scope_missing';end if;
 return result;
end$$;
create function dv_market_private.psttg_bump_scopes(ids uuid[]) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare result jsonb;
begin
 perform dv_market_private.psttg_lock_scopes(ids);
 update dv_market_private.psttg_scope_guards set generation=generation+1 where scope_id=any(ids);
 select jsonb_object_agg(scope_id::text,generation) into result from dv_market_private.psttg_scope_guards where scope_id=any(ids);
 return result;
end$$;
create function dv_market_private.psttg_ensure_scope(kind text,binding bytea,ciphertext bytea,source_ref text) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare r dv_market_private.psttg_scope_guards;
begin
 insert into dv_market_private.psttg_scope_guards(scope_kind,scope_binding_digest,subject_binding_ciphertext,source_object_ref)
 values(kind,binding,ciphertext,source_ref) on conflict(scope_kind,scope_binding_digest) do nothing;
 select * into strict r from dv_market_private.psttg_scope_guards where scope_kind=kind and scope_binding_digest=binding for update;
 if r.source_object_ref is distinct from source_ref or r.subject_binding_ciphertext is distinct from ciphertext then raise exception 'psttg_scope_conflict';end if;
 if r.phase<>'open' then raise exception 'psttg_scope_fenced';end if;
 return r.scope_id;
end$$;

-- All metadata primitives are private. Only a future verified adapter may call
-- them. Arbitrary role names, GUCs and application JSON confer no EXECUTE right.
create function dv_market_private.psttg_bind_origin(p jsonb,ids uuid[],predecessor uuid default null) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare old dv_market_private.psttg_origin_bindings; r dv_market_private.psttg_origin_bindings;
 rev bigint:=1; h bytea:=sha256(convert_to(jsonb_build_array(p,ids,predecessor)::text,'UTF8')); b text;
begin
 perform dv_market_private.psttg_lock_scopes(ids);
 if jsonb_typeof(p)<>'object' or not(p ?& array['source_system','environment_id','source_kind','source_id','source_version','source_digest','operating_mode','classification_basis','attestation_payload','attested_by','producer_version'])
 or p-array['source_system','environment_id','source_kind','source_id','source_version','source_digest','operating_mode','classification_basis','attestation_payload','attested_by','producer_version','provider_mode','provider_account_ref','provider_event_ref','signature_verification_ref','classification_reason']<>'{}'::jsonb then raise exception 'psttg_origin_shape';end if;
 for b in select jsonb_object_keys(p) loop
  if b<>'attestation_payload' and (jsonb_typeof(p->b)<>'string' or length(p->>b)=0) then raise exception 'psttg_origin_shape';end if;
 end loop;
 if jsonb_typeof(p->'attestation_payload')<>'object' or not(p->'attestation_payload' ?& array['contract_version','evidence_ref','scope_digest'])
 or (p->'attestation_payload')-array['contract_version','evidence_ref','scope_digest']<>'{}'::jsonb then raise exception 'psttg_attestation_shape';end if;
 if p->>'source_kind'='provider_evidence' and not(p ?& array['provider_mode','provider_account_ref','provider_event_ref','signature_verification_ref']) then raise exception 'psttg_provider_evidence_missing';end if;
 if p->>'classification_basis'='verified_provider' and
 ((p->>'operating_mode'='provider_sandbox' and p->>'provider_mode' is distinct from 'test') or
 (p->>'operating_mode'='real_operation' and p->>'provider_mode' is distinct from 'live')) then raise exception 'psttg_provider_mode_conflict';end if;
 if predecessor is not null then
  select * into strict old from dv_market_private.psttg_origin_bindings where origin_id=predecessor;
  if not(old.scope_ids<@ids) or jsonb_build_array(old.source_system,old.environment_id,old.source_kind,old.source_id,old.source_version,encode(old.source_digest,'hex'))<>
  jsonb_build_array(p->>'source_system',p->>'environment_id',p->>'source_kind',p->>'source_id',p->>'source_version',p->>'source_digest') then raise exception 'psttg_origin_binding_conflict';end if;
  if old.operating_mode='real_operation' and p->>'operating_mode' in ('synthetic_test','provider_sandbox') then raise exception 'psttg_real_downgrade';end if;
  if coalesce(p->>'classification_reason','')='' then raise exception 'psttg_revision_reason';end if;
  rev:=old.origin_revision+1;
 end if;
 select * into r from dv_market_private.psttg_origin_bindings where source_system=p->>'source_system' and environment_id=p->>'environment_id' and source_kind=p->>'source_kind' and source_id=p->>'source_id' and source_version=p->>'source_version' and origin_revision=rev;
 if found then if r.command_digest<>h then raise exception 'psttg_idempotency_conflict';end if;return r.origin_id;end if;
 insert into dv_market_private.psttg_origin_bindings(scope_ids,source_system,environment_id,source_kind,source_id,source_version,source_digest,operating_mode,classification_basis,attestation_payload,attested_by,attested_at,producer_version,provider_mode,provider_account_ref,provider_event_ref,signature_verification_ref,predecessor_origin_id,classification_reason,origin_revision,command_digest)
 values(ids,p->>'source_system',p->>'environment_id',p->>'source_kind',p->>'source_id',p->>'source_version',decode(p->>'source_digest','hex'),p->>'operating_mode',p->>'classification_basis',p->'attestation_payload',p->>'attested_by',clock_timestamp(),p->>'producer_version',p->>'provider_mode',p->>'provider_account_ref',p->>'provider_event_ref',p->>'signature_verification_ref',predecessor,p->>'classification_reason',rev,h) returning * into r;
 perform dv_market_private.psttg_bump_scopes(ids);return r.origin_id;
end$$;

create function dv_market_private.psttg_encrypt(payload jsonb,secret text) returns bytea
language plpgsql volatile security definer set search_path='' as $$
declare ns text; result bytea;
begin
 if secret is null or length(secret)<32 then raise exception 'psttg_key_invalid';end if;
 select n.nspname into strict ns from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
 execute format('select %I.pgp_sym_encrypt($1,$2,''cipher-algo=aes256,compress-algo=0'')',ns) into result using payload::text,secret;
 return result;
end$$;

create function dv_market_private.psttg_append_event(p jsonb,expected_seq bigint,evidence jsonb,secret text) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare o dv_market_private.psttg_origin_bindings; prev dv_market_private.psttg_operation_events;
 r dv_market_private.psttg_operation_events; original dv_market_private.psttg_records;
 op uuid:=(p->>'operation_id')::uuid; kind text:=p->>'event_kind'; ids uuid[];
 h bytea:=sha256(convert_to(jsonb_build_array(p,evidence)::text,'UTF8')); seq bigint; cipher bytea;
begin
 if not(p ?& array['operation_id','event_kind','action_kind','origin_id','input_revision','input_digest','input_ref','idempotency_key','actor_ref','producer_version'])
 or p-array['operation_id','event_kind','action_kind','origin_id','input_revision','input_digest','input_ref','idempotency_key','actor_ref','producer_version','attempt_id','subject_scope_id','case_ref','actual_event_at','external_reference','external_event_id','outcome_code','original_record_id','original_origin_id','original_version','artifact_id']<>'{}'::jsonb then raise exception 'psttg_event_shape';end if;
 perform pg_advisory_xact_lock(hashtextextended(op::text,741105));
 select * into strict o from dv_market_private.psttg_origin_bindings where origin_id=(p->>'origin_id')::uuid;
 ids:=o.scope_ids;perform dv_market_private.psttg_lock_scopes(ids);
 if p ? 'subject_scope_id' and not((p->>'subject_scope_id')::uuid=any(ids)) then raise exception 'psttg_subject_scope';end if;
 select * into r from dv_market_private.psttg_operation_events where origin_id=o.origin_id and action_kind=p->>'action_kind' and idempotency_key=p->>'idempotency_key' and event_kind=kind and attempt_id is not distinct from (p->>'attempt_id')::uuid;
 if found then if r.command_digest<>h then raise exception 'psttg_idempotency_conflict';end if;return r.event_id;end if;
 select * into prev from dv_market_private.psttg_operation_events where operation_id=op order by event_seq desc limit 1;
 seq:=coalesce(prev.event_seq,0)+1;
 if expected_seq is distinct from seq-1 then raise exception 'psttg_sequence_conflict';end if;
 if prev.event_id is null then
  if kind not in ('draft','copy') then raise exception 'psttg_invalid_transition';end if;
 else
  if prev.origin_id<>o.origin_id or prev.action_kind<>p->>'action_kind' or prev.subject_scope_id is distinct from (p->>'subject_scope_id')::uuid or prev.idempotency_key<>p->>'idempotency_key' then raise exception 'psttg_operation_binding';end if;
  if (prev.input_revision<>p->>'input_revision' or prev.input_digest<>decode(p->>'input_digest','hex') or prev.input_ref<>p->>'input_ref') and not(prev.event_kind='failed' and kind='ready') then raise exception 'psttg_input_binding';end if;
  if not((prev.event_kind='draft' and kind in ('ready','cancelled')) or
   (prev.event_kind='ready' and kind in ('attempting','cancelled')) or
   (prev.event_kind='attempting' and kind in ('failed','outcome_unknown','executed_evidenced')) or
   (prev.event_kind='outcome_unknown' and kind='executed_evidenced') or
   (prev.event_kind='failed' and kind='ready') or
   (prev.event_kind in ('executed_evidenced','accepted','rejected','delivered') and kind in ('accepted','rejected','delivered'))) then raise exception 'psttg_invalid_transition';end if;
  if kind='attempting' and ((p->>'attempt_id')::uuid is null or exists(select from dv_market_private.psttg_operation_events where operation_id=op and attempt_id=(p->>'attempt_id')::uuid and event_kind='attempting')) then raise exception 'psttg_attempt_conflict';end if;
  if kind in ('failed','outcome_unknown','executed_evidenced') and prev.attempt_id is distinct from (p->>'attempt_id')::uuid then raise exception 'psttg_attempt_binding';end if;
 end if;
 if kind in ('ready','attempting','executed_evidenced') and exists(select from dv_market_private.psttg_origin_bindings where predecessor_origin_id=o.origin_id) then raise exception 'psttg_stale_origin';end if;
 if kind='ready' then
  if evidence is null or evidence-array['input_snapshot']<>'{}'::jsonb or not(evidence ? 'input_snapshot') or sha256(convert_to((evidence->'input_snapshot')::text,'UTF8'))<>decode(p->>'input_digest','hex') then raise exception 'psttg_input_snapshot_required';end if;
  cipher:=dv_market_private.psttg_encrypt(evidence,secret);
 elsif kind in ('failed','executed_evidenced','accepted','rejected','delivered') then
  if evidence is null or jsonb_typeof(evidence)<>'object' or not(evidence ?& array['contract_version','operation_id','input_digest','target_ref','meaning','source_ref','actual_event_at']) or
  evidence-array['contract_version','operation_id','input_digest','target_ref','meaning','source_ref','actual_event_at']<>'{}'::jsonb or
  evidence->>'operation_id'<>op::text or evidence->>'input_digest'<>p->>'input_digest' or evidence->>'target_ref'<>p->>'input_ref' or
  evidence->>'actual_event_at' is distinct from p->>'actual_event_at' or nullif(evidence->>'source_ref','') is null then raise exception 'psttg_evidence_binding';end if;
  if kind='failed' and evidence->>'meaning'<>'not_executed' or kind='executed_evidenced' and evidence->>'meaning'<>(case p->>'action_kind' when 'submission' then 'transmitted' when 'provider_notice_general' then 'notified' when 'provider_notice_annual' then 'notified' else 'performed' end)
  or kind in ('accepted','rejected','delivered') and evidence->>'meaning'<>kind then raise exception 'psttg_evidence_meaning';end if;
  cipher:=dv_market_private.psttg_encrypt(evidence,secret);
 elsif evidence is not null or p ? 'actual_event_at' then raise exception 'psttg_unproven_event_time';end if;
 if kind='copy' then
  if p->>'action_kind'<>'copy' or num_nonnulls(p->>'original_record_id',p->>'original_origin_id')<>1 or nullif(p->>'artifact_id','') is null then raise exception 'psttg_copy_binding';end if;
  if p ? 'original_record_id' then
   select * into strict original from dv_market_private.psttg_records where record_id=(p->>'original_record_id')::uuid;
   if original.content_revision<>p->>'original_version' or original.origin_id<>o.origin_id or original.payload_digest<>decode(p->>'input_digest','hex') or original.subject_scope_id is distinct from (p->>'subject_scope_id')::uuid then raise exception 'psttg_copy_binding';end if;
  elsif (p->>'original_origin_id')::uuid<>o.origin_id or p->>'original_version'<>o.source_version or o.source_digest<>decode(p->>'input_digest','hex') then raise exception 'psttg_copy_binding';end if;
 elsif p ?| array['original_record_id','original_origin_id','original_version','artifact_id'] then raise exception 'psttg_copy_binding';end if;
 insert into dv_market_private.psttg_operation_events(operation_id,event_seq,action_kind,event_kind,attempt_id,scope_ids,subject_scope_id,case_ref,origin_id,input_revision,input_digest,input_ref,idempotency_key,actor_ref,producer_version,observed_at,actual_event_at,event_time_basis,evidence_payload_ciphertext,evidence_digest,external_reference,external_event_id,external_source_system,external_environment_id,outcome_code,original_record_id,original_origin_id,original_version,artifact_id,command_digest)
 values(op,seq,p->>'action_kind',kind,(p->>'attempt_id')::uuid,ids,(p->>'subject_scope_id')::uuid,p->>'case_ref',o.origin_id,p->>'input_revision',decode(p->>'input_digest','hex'),p->>'input_ref',p->>'idempotency_key',p->>'actor_ref',p->>'producer_version',clock_timestamp(),(p->>'actual_event_at')::timestamptz,case when evidence is null or kind='ready' then 'none' else 'verified_source' end,cipher,case when evidence is null then null else sha256(convert_to(evidence::text,'UTF8')) end,p->>'external_reference',p->>'external_event_id',case when p ? 'external_event_id' then o.source_system end,case when p ? 'external_event_id' then o.environment_id end,p->>'outcome_code',(p->>'original_record_id')::uuid,(p->>'original_origin_id')::uuid,p->>'original_version',p->>'artifact_id',h) returning * into r;
 if kind<>'copy' then perform dv_market_private.psttg_bump_scopes(ids);end if;
 return r.event_id;
end$$;

create function dv_market_private.psttg_validate_payload(cls text,subtype text,p jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare fields text[]; k text;
begin
 fields:=case cls
 when 'process_description' then array['period','procedures','relationships','responsibilities','deadlines','applied_version','changes']
 when 'due_diligence' then array['inputs','processing','result','rule_version','reasons','processor']
 when 'reported_information' then array['reported_information','reporting_period','submission_ref','procedure','transmission_status','acceptance_status']
 when 'provider_notice' then array['content','recipient_ref','channel','notice_version','reporting_period','delivery_meaning']
 when 'cooperation_event' then array['content','reason','subject_ref','channel','case_ref','measure_ref','scope','lift_information'] end;
 if fields is null or jsonb_typeof(p)<>'object' or not(p ?& (fields||array['source_fragments'])) or p-(fields||array['source_fragments','original_fragment','correction_reason'])<>'{}'::jsonb then raise exception 'psttg_payload_schema';end if;
 if not((cls='process_description' and subtype in ('original','change')) or (cls='due_diligence' and subtype in ('collection','assessment','correction')) or
 (cls='reported_information' and subtype in ('original','correction')) or (cls='provider_notice' and subtype in ('general','annual','correction')) or
 (cls='cooperation_event' and subtype in ('request','reminder','measure','lift'))) then raise exception 'psttg_subtype';end if;
 foreach k in array fields loop
  if p->k='null'::jsonb or p->k='""'::jsonb then raise exception 'psttg_payload_incomplete';end if;
 end loop;
 if jsonb_typeof(p->'source_fragments')<>'object' or p->'source_fragments'='{}'::jsonb then raise exception 'psttg_source_fragments';end if;
 if subtype='correction' and (not(p ?& array['original_fragment','correction_reason']) or p->'original_fragment' in ('null'::jsonb,'{}'::jsonb) or nullif(p->>'correction_reason','') is null) then raise exception 'psttg_correction_content';end if;
end$$;

create function dv_market_private.seal_psttg_record(cmd jsonb,event jsonb,expected_seq bigint,evidence jsonb,payload jsonb,secret text,links jsonb default '[]') returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare o dv_market_private.psttg_origin_bindings; r dv_market_private.psttg_records; target dv_market_private.psttg_records;
 so dv_market_private.psttg_origin_bindings; src jsonb; l jsonb; ids uuid[]; req text[];
 rid uuid:=gen_random_uuid(); eid uuid; t timestamptz; y integer; ending timestamptz; basis text:=cmd->>'creation_basis'; proof jsonb;
 cipher bytea; ph bytea:=sha256(convert_to(payload::text,'UTF8')); gens jsonb; envelope jsonb;
 h bytea:=sha256(convert_to(jsonb_build_array(cmd,event,evidence,payload,links)::text,'UTF8'));
 action text:=event->>'action_kind'; cls text:=cmd->>'record_class'; subtype text:=cmd->>'record_subtype';
begin
 if not(cmd ?& array['record_class','record_subtype','schema_version','duty_holder_ref','process_version','encryption_key_ref','source_bindings','creation_basis','creation_proof','content_revision','capture_command_id']) or
 cmd-array['record_class','record_subtype','schema_version','duty_holder_ref','process_version','encryption_key_ref','source_bindings','creation_basis','creation_proof','content_revision','capture_command_id','reporting_period']<>'{}'::jsonb then raise exception 'psttg_record_shape';end if;
 if event->>'event_kind'<>'executed_evidenced' then raise exception 'psttg_execution_required';end if;
 perform pg_advisory_xact_lock(hashtextextended(event->>'operation_id',741105));
 select * into strict o from dv_market_private.psttg_origin_bindings where origin_id=(event->>'origin_id')::uuid;
 ids:=o.scope_ids;
 if jsonb_typeof(cmd->'source_bindings')<>'array' or jsonb_array_length(cmd->'source_bindings')=0 or jsonb_typeof(links)<>'array' then raise exception 'psttg_sources_missing';end if;
 -- Discover the union before acquiring any row locks. Immutable record/origin
 -- scopes cannot shrink between discovery and the ordered lock acquisition.
 for src in select value from jsonb_array_elements(cmd->'source_bindings') loop
  select * into strict so from dv_market_private.psttg_origin_bindings where origin_id=(src->>'origin_id')::uuid;ids:=ids||so.scope_ids;
 end loop;
 for l in select value from jsonb_array_elements(links) loop
  if l ? 'to_record_id' then select * into strict target from dv_market_private.psttg_records where record_id=(l->>'to_record_id')::uuid;ids:=ids||target.scope_ids;
  else select * into strict so from dv_market_private.psttg_origin_bindings where origin_id=(l->>'source_origin_id')::uuid;ids:=ids||so.scope_ids;end if;
 end loop;
 select array_agg(distinct v order by v) into ids from unnest(ids) v;
 perform dv_market_private.psttg_lock_scopes(ids);
 select * into r from dv_market_private.psttg_records where capture_command_id=(cmd->>'capture_command_id')::uuid or (operation_id=(event->>'operation_id')::uuid and subject_scope_id is not distinct from (event->>'subject_scope_id')::uuid and record_class=cls and record_subtype=subtype and content_revision=cmd->>'content_revision');
 if found then if r.command_digest<>h then raise exception 'psttg_idempotency_conflict';end if;return r.record_id;end if;
 if cls<>'process_description' and (event->>'subject_scope_id')::uuid is null then raise exception 'psttg_subject_required';end if;
 if not((cls='process_description' and action='process_document') or (cls='due_diligence' and action='diligence') or
 (cls='reported_information' and action='submission' and o.source_kind<>'tax_event') or
 (cls='provider_notice' and action in ('provider_notice_general','provider_notice_annual')) or
 (cls='cooperation_event' and action='cooperation_'||subtype) or (action='external_record_import' and o.source_kind='external_record')) then raise exception 'psttg_class_action';end if;
 perform dv_market_private.psttg_validate_payload(cls,subtype,payload);
 if ph<>decode(event->>'input_digest','hex') then raise exception 'psttg_seal_input_binding';end if;
 for src in select value from jsonb_array_elements(cmd->'source_bindings') loop
  if not(src ?& array['origin_id','source_version','field_selector','source_digest','purpose','captured_fragment_digest']) or src-array['origin_id','source_version','field_selector','source_digest','purpose','captured_fragment_digest']<>'{}'::jsonb then raise exception 'psttg_source_shape';end if;
  select * into strict so from dv_market_private.psttg_origin_bindings where origin_id=(src->>'origin_id')::uuid;
  if so.operating_mode<>o.operating_mode or so.source_version<>src->>'source_version' or so.source_digest<>decode(src->>'source_digest','hex') or
  not(payload->'source_fragments' ? (src->>'field_selector')) or sha256(convert_to((payload->'source_fragments'->(src->>'field_selector'))::text,'UTF8'))<>decode(src->>'captured_fragment_digest','hex') or
  exists(select from dv_market_private.psttg_origin_bindings where predecessor_origin_id=so.origin_id) then raise exception 'psttg_source_binding';end if;
 end loop;
 if subtype='correction' and not exists(select from jsonb_array_elements(links) x where x->>'link_kind'='corrects') then raise exception 'psttg_original_required';end if;
 for l in select value from jsonb_array_elements(links) loop
  if not(l ?& array['link_kind','target_version','required_fields','purpose_code']) or l-array['link_kind','target_version','required_fields','purpose_code','to_record_id','source_origin_id','legal_basis_ref','embedded_fragment_digest']<>'{}'::jsonb or
  num_nonnulls(l->>'to_record_id',l->>'source_origin_id')<>1 or jsonb_typeof(l->'required_fields')<>'array' or jsonb_array_length(l->'required_fields')=0 then raise exception 'psttg_link_shape';end if;
  if l ? 'to_record_id' then
   select * into strict target from dv_market_private.psttg_records where record_id=(l->>'to_record_id')::uuid;
   select * into strict so from dv_market_private.psttg_origin_bindings where origin_id=target.origin_id;
   if target.subject_scope_id is distinct from (event->>'subject_scope_id')::uuid or target.content_revision<>l->>'target_version' or so.operating_mode<>o.operating_mode then raise exception 'psttg_link_binding';end if;
   if l->>'link_kind'='corrects' and (target.record_class<>cls or subtype<>'correction') then raise exception 'psttg_correction_class';end if;
  else
   select * into strict so from dv_market_private.psttg_origin_bindings where origin_id=(l->>'source_origin_id')::uuid;
   if so.operating_mode<>o.operating_mode or so.source_version<>l->>'target_version' or not(so.scope_ids @> o.scope_ids) or l->>'link_kind'='corrects' then raise exception 'psttg_link_binding';end if;
  end if;
  if l->>'link_kind'='corrects' then
   select array_agg(value) into req from jsonb_array_elements_text(l->'required_fields');
   if not(payload->'original_fragment' ?& req) or decode(l->>'embedded_fragment_digest','hex') is distinct from sha256(convert_to((payload->'original_fragment')::text,'UTF8')) then raise exception 'psttg_fragment_binding';end if;
  end if;
 end loop;
 proof:=cmd->'creation_proof';
 if basis='native_seal' then
  if action='external_record_import' or proof<>'{}'::jsonb then raise exception 'psttg_native_time_input';end if;
 elsif basis='verified_external_original' then
  if action<>'external_record_import' or not(proof ?& array['verified_year','precision','evidence_ref','original_digest']) or proof-array['verified_year','precision','evidence_ref','original_digest','original_created_at']<>'{}'::jsonb or proof->>'original_digest'<>encode(ph,'hex') then raise exception 'psttg_external_time_proof';end if;
  y:=(proof->>'verified_year')::integer;
  if proof->>'precision' not in ('year','instant') or (proof->>'precision'='year' and proof ? 'original_created_at') or (proof->>'precision'='instant' and (proof->>'original_created_at' is null or extract(year from (proof->>'original_created_at')::timestamptz at time zone 'Europe/Berlin')<>y)) then raise exception 'psttg_external_time_conflict';end if;
 elsif basis='unresolved' then
  if not(proof ?& array['clarification_ref','reason']) or proof-array['clarification_ref','reason']<>'{}'::jsonb then raise exception 'psttg_clarification_required';end if;
 else raise exception 'psttg_creation_basis';end if;
 cipher:=dv_market_private.psttg_encrypt(payload,secret);
 eid:=dv_market_private.psttg_append_event(event,expected_seq,evidence,secret);
 gens:=dv_market_private.psttg_bump_scopes(ids);
 -- One actual clock sample after locks, validation and encryption. No caller
 -- timestamp or transaction-start time is used as the native creation anchor.
 t:=clock_timestamp();
 if basis='native_seal' then
  y:=extract(year from t at time zone 'Europe/Berlin');
  proof:=jsonb_build_object('clock','postgres_clock_timestamp','producer_version',event->>'producer_version','transaction_id',pg_current_xact_id()::text,'capture_command_id',cmd->>'capture_command_id');
 end if;
 if y is not null then ending:=make_timestamptz(y+11,1,1,0,0,0,'Europe/Berlin');end if;
 envelope:=jsonb_build_object('record_id',rid,'command_digest',encode(h,'hex'),'payload_digest',encode(ph,'hex'),'cipher_digest',encode(sha256(cipher),'hex'),'origin_id',o.origin_id,'mode',o.operating_mode,'creation_year',y,'sealed_at',t,'proof',proof,'generation',gens,'end_at',ending,'links',links);
 insert into dv_market_private.psttg_records(record_id,record_class,record_subtype,schema_version,duty_holder_ref,operation_id,execution_event_id,origin_id,subject_scope_id,scope_ids,reporting_period,process_version,payload_ciphertext,payload_digest,canonicalization_version,encryption_key_ref,source_bindings,processed_at,transmitted_at,notified_at,executed_at,source_record_created_at,ingested_at,sealed_at,creation_year,creation_zone,creation_basis,creation_proof,producer_identity,producer_version,content_revision,seal_digest,seal_envelope,seal_algorithm_version,capture_command_id,record_state,scope_generation_at_seal,end_rule_version,end_at,command_digest)
 values(rid,cls,subtype,cmd->>'schema_version',cmd->>'duty_holder_ref',(event->>'operation_id')::uuid,eid,o.origin_id,(event->>'subject_scope_id')::uuid,ids,(cmd->>'reporting_period')::integer,cmd->>'process_version',cipher,ph,'pg-jsonb-v1',cmd->>'encryption_key_ref',cmd->'source_bindings',case when cls='due_diligence' then (event->>'actual_event_at')::timestamptz end,case when cls='reported_information' then (event->>'actual_event_at')::timestamptz end,case when cls='provider_notice' then (event->>'actual_event_at')::timestamptz end,(event->>'actual_event_at')::timestamptz,(proof->>'original_created_at')::timestamptz,t,t,y,'Europe/Berlin',basis,proof,event->>'actor_ref',event->>'producer_version',cmd->>'content_revision',sha256(convert_to(envelope::text,'UTF8')),envelope,'sha256-envelope-v1',(cmd->>'capture_command_id')::uuid,case when y is null then 'clarification_required' else 'evidenced' end,gens,'K103-DE-v1',ending,h);
 for l in select value from jsonb_array_elements(links) loop
  insert into dv_market_private.psttg_record_links(from_record_id,to_record_id,source_origin_id,link_kind,target_version,required_fields,purpose_code,legal_basis_ref,embedded_fragment_digest,created_at,producer_identity)
  values(rid,(l->>'to_record_id')::uuid,(l->>'source_origin_id')::uuid,l->>'link_kind',l->>'target_version',l->'required_fields',l->>'purpose_code',l->>'legal_basis_ref',decode(l->>'embedded_fragment_digest','hex'),t,event->>'actor_ref');
 end loop;
 -- A native creation straddling a calendar boundary is retried, not backdated.
 if basis='native_seal' and extract(year from clock_timestamp() at time zone 'Europe/Berlin')<>y then raise exception 'psttg_year_boundary_retry';end if;
 return rid;
end$$;

create function dv_market_private.psttg_digest_record() returns trigger
language plpgsql set search_path='' set timezone='UTC' as $$begin
 new.seal_digest:=sha256(convert_to((to_jsonb(new)-'seal_digest')::text,'UTF8'));return new;
end$$;
create trigger psttg_record_digest before insert on dv_market_private.psttg_records
for each row execute function dv_market_private.psttg_digest_record();
create function dv_market_private.get_psttg_record_requirement(id uuid) returns jsonb
language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
declare r dv_market_private.psttg_records; result jsonb; bound_links jsonb; actual_links jsonb;
begin
 select * into strict r from dv_market_private.psttg_records where record_id=id;
 if r.seal_digest<>sha256(convert_to((to_jsonb(r)-'seal_digest')::text,'UTF8')) then raise exception 'psttg_integrity_error';end if;
 select coalesce(jsonb_agg(x order by x::text),'[]') into bound_links from jsonb_array_elements(r.seal_envelope->'links') x;
 select coalesce(jsonb_agg(x order by x::text),'[]') into actual_links from (
  select jsonb_strip_nulls(jsonb_build_object('link_kind',l.link_kind,'to_record_id',l.to_record_id,'source_origin_id',l.source_origin_id,'target_version',l.target_version,'required_fields',l.required_fields,'purpose_code',l.purpose_code,'legal_basis_ref',l.legal_basis_ref,'embedded_fragment_digest',encode(l.embedded_fragment_digest,'hex'))) x from dv_market_private.psttg_record_links l where l.from_record_id=id
 ) links;
 if bound_links<>actual_links then raise exception 'psttg_link_integrity_error';end if;
 select jsonb_build_object('record_id',r.record_id,'record_class',r.record_class,'duty_holder_ref',r.duty_holder_ref,'creation_year',r.creation_year,'creation_basis',r.creation_basis,'end_at',r.end_at,'record_state',r.record_state,'origin_mode',(select operating_mode from dv_market_private.psttg_origin_bindings where origin_id=r.origin_id),'scope_generations',(select jsonb_object_agg(g.scope_id::text,g.generation) from dv_market_private.psttg_scope_guards g where g.scope_id=any(r.scope_ids)),'links',coalesce((select jsonb_agg(jsonb_build_object('kind',l.link_kind,'target',coalesce(l.to_record_id,l.source_origin_id),'required_fields',l.required_fields,'purpose',l.purpose_code)) from dv_market_private.psttg_record_links l where l.from_record_id=r.record_id),'[]')) into result;
 return result;
end;
$$;

do $acl$
declare r record;
begin
 for r in select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='dv_market_private' and c.relname in ('psttg_scope_guards','psttg_origin_bindings','psttg_operation_events','psttg_records','psttg_record_links') loop
  execute format('alter table dv_market_private.%I owner to dv_psttg_core_owner',r.relname);
  execute format('alter table dv_market_private.%I enable row level security',r.relname);
  execute format('revoke all on dv_market_private.%I from public,anon,authenticated,service_role',r.relname);
  if r.relname<>'psttg_scope_guards' then
   execute format('create trigger psttg_immutable before update or delete on dv_market_private.%I for each row execute function dv_market_private.psttg_reject_mutation()',r.relname);
   execute format('create trigger psttg_no_truncate before truncate on dv_market_private.%I for each statement execute function dv_market_private.psttg_reject_mutation()',r.relname);
  end if;
 end loop;
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and (p.proname like 'psttg_%' or p.proname in ('seal_psttg_record','get_psttg_record_requirement')) loop
  execute format('alter function %s owner to dv_psttg_core_owner',r.signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
 end loop;
end$acl$;
commit;
