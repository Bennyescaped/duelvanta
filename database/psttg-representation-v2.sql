-- V110 isolated synthetic representation/reader. Never included in live migrations.
-- No end adapter, phase setter, K5 issuer, producer, application grant or V1 rewrite.
begin;
create table dv_market_private.psttg_object_anchor(
 object_id uuid primary key, incarnation uuid not null, content_version bigint not null check(content_version>0),
 object_kind text not null check(object_kind in ('O1','O2','O3','O4','COPY')),
 representation_version integer not null check(representation_version=2),
 unique(object_id,incarnation,content_version)
);
create table dv_market_private.psttg_unit_guard(
 unit_id uuid primary key, object_id uuid not null, incarnation uuid not null, content_version bigint not null,
 slot integer not null check(slot>0), phase text not null check(phase in ('present','fenced','ended')),
 revision bigint not null check(revision>0), demand_revision bigint not null check(demand_revision>0),
 manifest_id uuid, manifest_revision bigint, authorization_id uuid, attempt_id uuid, result_id uuid,
 foreign key(object_id,incarnation,content_version) references dv_market_private.psttg_object_anchor(object_id,incarnation,content_version),
 unique(object_id,slot),unique(unit_id,object_id,incarnation,content_version,slot),
 check((phase='present' and num_nonnulls(manifest_id,manifest_revision,authorization_id,attempt_id,result_id)=0)
 or (phase='fenced' and num_nonnulls(manifest_id,manifest_revision,authorization_id,attempt_id)=4 and result_id is null)
 or (phase='ended' and num_nonnulls(manifest_id,manifest_revision,authorization_id,attempt_id,result_id)=5))
);
create table dv_market_private.psttg_content_unit(
 unit_id uuid primary key, object_id uuid not null, incarnation uuid not null, content_version bigint not null, slot integer not null,
 unit_kind text not null check(unit_kind in ('origin','input','event','body','source_fragment','original_fragment','proof','relationship','copy')),
 schema_version text not null check(schema_version='psttg-unit-v2'), key_ref uuid not null unique,
 wrapped_key bytea not null, ciphertext bytea not null, unit_seal bytea not null check(octet_length(unit_seal)=32),
 foreign key(unit_id,object_id,incarnation,content_version,slot) references dv_market_private.psttg_unit_guard(unit_id,object_id,incarnation,content_version,slot)
);
create table dv_market_private.psttg_unit_binding(
 object_id uuid primary key references dv_market_private.psttg_object_anchor,
 command_id uuid not null unique, scope_ids uuid[] not null check(cardinality(scope_ids)>0),
 slots jsonb not null check(jsonb_typeof(slots)='array'),
 dependencies uuid[] not null, decision_ref uuid not null,
 related_object_id uuid, related_incarnation uuid, related_version bigint,
 foreign key(related_object_id,related_incarnation,related_version) references dv_market_private.psttg_object_anchor(object_id,incarnation,content_version),
 check(num_nonnulls(related_object_id,related_incarnation,related_version) in (0,3)),
 manifest_seal bytea not null check(octet_length(manifest_seal)=32)
);
create table dv_market_private.psttg_unit_end_receipt(
 unit_id uuid primary key, object_id uuid not null, incarnation uuid not null, content_version bigint not null, slot integer not null,
 manifest_id uuid not null, manifest_revision bigint not null check(manifest_revision>0),
 authorization_id uuid not null, adapter_version integer not null check(adapter_version=1),
 attempt_id uuid not null, operating_incarnation uuid not null, execution_epoch bigint not null check(execution_epoch>0),
 result_kind text not null check(result_kind='active_db_unit_removed'), result_id uuid not null,
 commit_ref uuid not null, prior_unit_seal bytea not null, manifest_seal bytea not null,
 proof_scope text not null check(proof_scope='synthetic_prepared_state_only'),
 purpose_end_ref uuid not null, receipt_seal bytea not null,
 foreign key(unit_id,object_id,incarnation,content_version,slot) references dv_market_private.psttg_unit_guard(unit_id,object_id,incarnation,content_version,slot)
);
create function dv_market_private.psttg_v2_hash(p jsonb) returns bytea language sql immutable set search_path='' as $$select sha256(convert_to(p::text,'UTF8'))$$;
create function dv_market_private.psttg_v2_decrypt(c bytea,k text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare ns text; p jsonb;begin
 if k is null or length(k)<32 then raise exception 'v2_key_missing';end if;
 select n.nspname into strict ns from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
 execute format('select %I.pgp_sym_decrypt($1,$2)::jsonb',ns) into p using c,k;return p;
 exception when others then raise exception 'v2_decryption_failed';
end$$;
create function dv_market_private.psttg_v2_shape(p jsonb,fields text[]) returns void language plpgsql immutable set search_path='' as $$begin
 if p is null or jsonb_typeof(p)<>'object' or not(p ?& fields) or p-fields<>'{}'::jsonb or exists(select from jsonb_each(p) x where x.value='null'::jsonb) then raise exception 'v2_schema';end if;
end$$;
-- Closed synthetic reporting schema. No arbitrary field selector or real producer.
-- The exact correction projection is amount/currency/period/position, never the
-- other_attributes object. Other V1 classes require their own reviewed mapping.
create function dv_market_private.psttg_v2_validate(kind text,p jsonb) returns void language plpgsql immutable set search_path='' as $$begin
 if kind='body' then
  perform dv_market_private.psttg_v2_shape(p,array['amount','currency','period','position','other_attributes','correction_reason']);
  if jsonb_typeof(p->'amount')<>'number' or p->>'currency'!~'^[A-Z]{3}$' or jsonb_typeof(p->'period')<>'number' or (p->>'period')::numeric<>trunc((p->>'period')::numeric) or (p->>'period')::int not between 1900 and 9990 or (p->>'position')::uuid is null or jsonb_typeof(p->'other_attributes')<>'object' or jsonb_typeof(p->'correction_reason')<>'string' then raise exception 'v2_body_schema';end if;
 elsif kind in ('source_fragment','original_fragment') then
  perform dv_market_private.psttg_v2_shape(p,array['amount','currency','period','position']);
  if jsonb_typeof(p->'amount')<>'number' or p->>'currency'!~'^[A-Z]{3}$' or jsonb_typeof(p->'period')<>'number' or (p->>'position')::uuid is null then raise exception 'v2_fragment_schema';end if;
 elsif kind='origin' then
  perform dv_market_private.psttg_v2_shape(p,array['source_ref','source_version','mode','attestation_ref']);
  if (p->>'source_ref')::uuid is null or (p->>'attestation_ref')::uuid is null or (p->>'source_version')::bigint<1 or p->>'mode'<>'synthetic_test' then raise exception 'v2_origin_schema';end if;
 elsif kind='input' then
  perform dv_market_private.psttg_v2_shape(p,array['operation_ref','input_revision','body']);
  if (p->>'operation_ref')::uuid is null or (p->>'input_revision')::bigint<1 then raise exception 'v2_input_schema';end if;
  perform dv_market_private.psttg_v2_validate('body',p->'body');
 elsif kind='event' then
  perform dv_market_private.psttg_v2_shape(p,array['operation_ref','event_ref','meaning','evidence_ref']);
  if (p->>'operation_ref')::uuid is null or (p->>'event_ref')::uuid is null or (p->>'evidence_ref')::uuid is null or p->>'meaning' not in ('performed','transmitted','accepted','delivered','unknown') then raise exception 'v2_event_schema';end if;
 elsif kind='relationship' then
  perform dv_market_private.psttg_v2_shape(p,array['target','incarnation','version','purpose_ref','relation']);
  if (p->>'target')::uuid is null or (p->>'incarnation')::uuid is null or (p->>'purpose_ref')::uuid is null or (p->>'version')::bigint<1 or p->>'relation' not in ('corrects','uses_information_from') then raise exception 'v2_relationship_schema';end if;
 elsif kind='copy' then
  perform dv_market_private.psttg_v2_shape(p,array['target','artifact','artifact_version','coverage']);
  if (p->>'target')::uuid is null or (p->>'artifact')::uuid is null or (p->>'artifact_version')::bigint<1 or p->>'coverage'<>'unresolved' then raise exception 'v2_copy_schema';end if;
 elsif kind='proof' then
  perform dv_market_private.psttg_v2_shape(p,array['mode','captured_at','command','request','original_binding','extraction']);
  if p->>'mode'<>'synthetic_test' or (p->>'captured_at')::timestamptz is null or (p->>'command')::uuid is null then raise exception 'v2_proof_schema';end if;
 else raise exception 'v2_unit_kind';end if;
end$$;
create function dv_market_private.psttg_v2_scopes(seed uuid[]) returns uuid[] language sql stable security definer set search_path='' as $$
 with recursive edges(ids) as(
 select scope_ids from dv_market_private.psttg_unit_binding union select scope_ids from dv_market_private.psttg_origin_bindings
 union select scope_ids from dv_market_private.psttg_records union select scope_ids from dv_market_private.psttg_operation_events
 ),walk(id) as(select unnest(seed) union select v from walk w join edges e on w.id=any(e.ids) cross join lateral unnest(e.ids) v)
 select array_agg(id order by id) from walk
$$;
-- No generation writes on read. Existing global fences remain additional blocks.
create function dv_market_private.psttg_v2_lock(seed uuid[]) returns uuid[] language plpgsql volatile security definer set search_path='' as $$
declare ids uuid[]; g record;begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='40001',message='v2_snapshot_retry';end if;
 ids:=dv_market_private.psttg_v2_scopes(seed);
 if ids is null or cardinality(ids)>4096 or array_position(ids,null) is not null then raise exception 'v2_scopes';end if;
 for g in select * from dv_market_private.psttg_scope_guards where scope_id=any(ids) order by scope_id for update loop
  if g.phase<>'open' or g.recovery_state<>'none' then raise exception 'v2_global_guard';end if;
 end loop;
 if (select count(*) from dv_market_private.psttg_scope_guards where scope_id=any(ids))<>cardinality(ids) then raise exception 'v2_scope_missing';end if;
 if ids is distinct from dv_market_private.psttg_v2_scopes(seed) then raise exception using errcode='40001',message='v2_scope_growth_retry';end if;
 return ids;
end$$;
create function dv_market_private.psttg_v2_plain(id uuid,secret text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare u dv_market_private.psttg_content_unit;k jsonb;p jsonb;begin
 select * into strict u from dv_market_private.psttg_content_unit where unit_id=id;
 if u.unit_seal is distinct from dv_market_private.psttg_v2_hash(to_jsonb(u)-'unit_seal') then raise exception 'v2_unit_integrity';end if;
 k:=dv_market_private.psttg_v2_decrypt(u.wrapped_key,secret);
 perform dv_market_private.psttg_v2_shape(k,array['key','unit','key_ref']);
 if k->>'unit'<>id::text or k->>'key_ref'<>u.key_ref::text then raise exception 'v2_key_binding';end if;
 p:=dv_market_private.psttg_v2_decrypt(u.ciphertext,k->>'key');
 perform dv_market_private.psttg_v2_shape(p,array['target','kind','content']);
 if p->'target'<>jsonb_build_array(u.object_id,u.incarnation,u.content_version,u.slot,u.unit_id) or p->>'kind'<>u.unit_kind then raise exception 'v2_cipher_binding';end if;
 perform dv_market_private.psttg_v2_validate(u.unit_kind,p->'content');return p->'content';
end$$;
create function dv_market_private.psttg_v2_read(id uuid,secret text,representation integer default 2) returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare a dv_market_private.psttg_object_anchor;b dv_market_private.psttg_unit_binding;g dv_market_private.psttg_unit_guard;
 u dv_market_private.psttg_content_unit;r dv_market_private.psttg_unit_end_receipt;s jsonb;p jsonb;states jsonb:='[]'; units jsonb:='[]'; st text;ids uuid[];actual jsonb;hasu boolean;hasr boolean;bad boolean:=false;body jsonb;frag jsonb;proof jsonb;rel jsonb;d uuid;
begin
 if representation<>2 or representation is null then raise exception 'v2_representation_rejected';end if;
 select * into a from dv_market_private.psttg_object_anchor where object_id=id;
 if not found then return jsonb_build_object('object_id',id,'states',jsonb_build_array('missing_unexplained'),'removal_authorized',false,'external_coverage_complete',false,'other_obligations','not_evaluated');end if;
 if a.representation_version<>2 then raise exception 'v2_representation_rejected';end if;
 select * into strict b from dv_market_private.psttg_unit_binding where object_id=id;
 ids:=dv_market_private.psttg_v2_lock(b.scope_ids);
 perform 1 from dv_market_private.psttg_unit_guard where object_id=id or unit_id=any(b.dependencies) order by unit_id for update;
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
create function dv_market_private.psttg_v2_capture(cmd jsonb,content jsonb,secret text) returns uuid language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare id uuid;inc uuid;kind text;ver bigint;scopes uuid[];deps uuid[];original uuid;oa dv_market_private.psttg_object_anchor;ob dv_market_private.psttg_unit_binding;
 old dv_market_private.psttg_unit_binding;group_data jsonb:='[]';item jsonb;slots jsonb:='[]';projection jsonb;op jsonb;proof jsonb;g record;u dv_market_private.psttg_content_unit;
 keyval text;ns text;uid uuid;keyref uuid;n integer:=0;result jsonb;request jsonb;oldproof jsonb;dep uuid;depobj uuid;expected_deps uuid[];binding dv_market_private.psttg_unit_binding;anchor dv_market_private.psttg_object_anchor;
begin
 perform dv_market_private.psttg_v2_shape(cmd,array['command_id','object_id','incarnation','version','kind','scopes','dependencies','decision_ref','original']);
 id:=(cmd->>'object_id')::uuid;inc:=(cmd->>'incarnation')::uuid;ver:=(cmd->>'version')::bigint;kind:=cmd->>'kind';
 if ver<1 or kind not in ('O1','O2','O3','O4','COPY') or jsonb_typeof(cmd->'scopes')<>'array' or jsonb_typeof(cmd->'dependencies')<>'array' then raise exception 'v2_capture_shape';end if;
 select coalesce(array_agg(distinct x::uuid order by x::uuid),'{}') into scopes from jsonb_array_elements_text(cmd->'scopes') x;
 select coalesce(array_agg(distinct x::uuid order by x::uuid),'{}') into deps from jsonb_array_elements_text(cmd->'dependencies') x;
 perform pg_advisory_xact_lock(hashtextextended(cmd->>'command_id',741112));
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
 scopes:=dv_market_private.psttg_v2_lock(scopes);
 perform 1 from dv_market_private.psttg_unit_guard where object_id=original or unit_id=any(deps) order by unit_id for update;
 if (select count(*) from dv_market_private.psttg_unit_guard where unit_id=any(deps))<>cardinality(deps) or exists(select from dv_market_private.psttg_unit_guard where (object_id=original or unit_id=any(deps)) and phase<>'present') then raise exception 'v2_target_guard';end if;
 for dep in select unnest(deps) loop perform dv_market_private.psttg_v2_plain(dep,secret);end loop;
 for depobj in select distinct object_id from dv_market_private.psttg_unit_guard where unit_id=any(deps) loop
  result:=dv_market_private.psttg_v2_read(depobj,secret);
  if result->'states' ?| array['integrity_violation','missing_unexplained','authorized_end_verified','copy_or_dependency_unresolved'] then raise exception 'v2_dependency_integrity';end if;
 end loop;
 request:=jsonb_build_object('cmd',cmd,'content',content);
 select * into old from dv_market_private.psttg_unit_binding where command_id=(cmd->>'command_id')::uuid;
 if found then
  result:=dv_market_private.psttg_v2_read(old.object_id,secret);
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
   result:=dv_market_private.psttg_v2_read(original,secret);
   if result->'states'<> '["present_verified"]'::jsonb then raise exception 'v2_original_integrity';end if;
   select dv_market_private.psttg_v2_plain(unit_id,secret) into strict op from dv_market_private.psttg_content_unit where object_id=original and unit_kind='body';
   select dv_market_private.psttg_v2_plain(unit_id,secret) into strict oldproof from dv_market_private.psttg_content_unit where object_id=original and unit_kind='proof';
   projection:=op-array['other_attributes','correction_reason'];
   if content->'original_fragment' is distinct from projection or nullif(content->'body'->>'correction_reason','') is null then raise exception 'v2_original_values';end if;
   group_data:=group_data||jsonb_build_array(jsonb_build_object('kind','original_fragment','content',projection),jsonb_build_object('kind','relationship','content',jsonb_build_object('target',original,'incarnation',oa.incarnation,'version',oa.content_version,'purpose_ref',cmd->'decision_ref','relation','corrects')));
  elsif content->'original_fragment'<>'{}'::jsonb or content->'body'->>'correction_reason'<>'' then raise exception 'v2_original_required';end if;
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
 proof:=jsonb_set(proof,'{request}',jsonb_build_object('digest',encode(dv_market_private.psttg_v2_hash(request),'hex')));
 group_data:=group_data||jsonb_build_array(jsonb_build_object('kind','proof','content',proof));
 insert into dv_market_private.psttg_object_anchor values(id,inc,ver,kind,2) returning * into anchor;
 for item in select value from jsonb_array_elements(group_data) loop
  perform dv_market_private.psttg_v2_validate(item->>'kind',item->'content');
  n:=n+1;uid:=gen_random_uuid();keyref:=gen_random_uuid();
  execute format('select encode(%I.gen_random_bytes(32),''hex'')',ns) into keyval;
  insert into dv_market_private.psttg_unit_guard(unit_id,object_id,incarnation,content_version,slot,phase,revision,demand_revision) values(uid,id,inc,ver,n,'present',1,1);
  u.unit_id:=uid;u.object_id:=id;u.incarnation:=inc;u.content_version:=ver;u.slot:=n;u.unit_kind:=item->>'kind';u.schema_version:='psttg-unit-v2';u.key_ref:=keyref;
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
-- Only monotonically registering new demand is supported. Phase/end transitions
-- are absent; even the owner cannot use DML as an end-path shortcut.
create function dv_market_private.psttg_v2_guard_immutable() returns trigger language plpgsql set search_path='' as $$begin
 if TG_OP<>'UPDATE' or (to_jsonb(new)-'demand_revision') is distinct from (to_jsonb(old)-'demand_revision') or new.demand_revision<>old.demand_revision+1 or old.phase<>'present' or new.demand_revision<>(select 1+count(*) from dv_market_private.psttg_unit_binding where old.unit_id=any(dependencies)) then raise exception 'v2_guard_immutable';end if;return new;
end$$;
create function dv_market_private.psttg_v2_commit_check() returns trigger language plpgsql security definer set search_path='' as $$
declare id uuid:=new.object_id;b dv_market_private.psttg_unit_binding;a dv_market_private.psttg_object_anchor;s jsonb;g dv_market_private.psttg_unit_guard;u dv_market_private.psttg_content_unit;expected text[];actual text[];
begin
 select * into strict a from dv_market_private.psttg_object_anchor where object_id=id;
 select * into strict b from dv_market_private.psttg_unit_binding where object_id=id;
 if b.manifest_seal is distinct from dv_market_private.psttg_v2_hash(jsonb_build_array(to_jsonb(a),to_jsonb(b)-'manifest_seal')) then raise exception 'v2_manifest_integrity';end if;
 expected:=case a.object_kind when 'O1' then array['origin','proof'] when 'O2' then array['input','event','proof'] when 'O4' then array['relationship','proof'] when 'COPY' then array['copy','proof'] else case when jsonb_array_length(b.slots)=5 then array['body','source_fragment','original_fragment','relationship','proof'] else array['body','source_fragment','proof'] end end;
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
do $$declare t text;r record;begin
 foreach t in array array['psttg_object_anchor','psttg_content_unit','psttg_unit_binding','psttg_unit_guard','psttg_unit_end_receipt'] loop
  execute format('alter table dv_market_private.%I owner to dv_psttg_core_owner',t);
  execute format('alter table dv_market_private.%I enable row level security',t);
  execute format('revoke all on dv_market_private.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger v2_immutable before update or delete on dv_market_private.%I for each row execute function dv_market_private.%I()',t,case when t='psttg_unit_guard' then 'psttg_v2_guard_immutable' else 'psttg_reject_mutation' end);
  if t<>'psttg_unit_end_receipt' then execute format('create constraint trigger v2_capture_complete after insert on dv_market_private.%I deferrable initially deferred for each row execute function dv_market_private.psttg_v2_commit_check()',t);end if;
  execute format('create trigger v2_no_truncate before truncate on dv_market_private.%I for each statement execute function dv_market_private.psttg_reject_mutation()',t);
 end loop;
 revoke insert on dv_market_private.psttg_unit_end_receipt from dv_psttg_core_owner;
 for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and p.proname like 'psttg_v2_%' loop
  execute format('alter function %s owner to dv_psttg_core_owner',r.sig);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);
 end loop;
end$$;
create trigger v2_no_end_issuer before insert on dv_market_private.psttg_unit_end_receipt for each row execute function dv_market_private.psttg_reject_mutation();
commit;
