-- V107 isolated K2/K4 reader. No application grantee, mutation or capability.
-- Requires the unchanged V106 O1-O5 core. Apply only in disposable acceptance DBs.
begin;

-- Scope arrays on immutable core objects form the connected locking domain.
-- The caller's scope list is NOT an authoritative inventory of dependencies.
create function dv_market_private.psttg_evaluation_scopes(seed uuid[]) returns uuid[]
language sql stable security definer set search_path='' as $$
 with recursive edges(ids) as (
  select scope_ids from dv_market_private.psttg_origin_bindings
  union select scope_ids from dv_market_private.psttg_records
  union select scope_ids from dv_market_private.psttg_operation_events
 ), walk(id) as (
  select unnest(seed)
  union
  select v from walk w join edges e on w.id=any(e.ids) cross join lateral unnest(e.ids) v
 ) select coalesce(array_agg(id order by id),'{}'::uuid[]) from walk
$$;

create function dv_market_private.evaluate_psttg_removal(p_scope_ids uuid[],target_object_versions jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare
 seeds uuid[]:=p_scope_ids; locked uuid[]; discovered uuid[]; target_scopes uuid[];
 t jsonb; targets jsonb:='[]'; results jsonb:='[]'; issues jsonb:='[]'; items jsonb;
 r record; g record; o record; e record; l record; meta jsonb; item jsonb;
 tid uuid; ver text; known boolean; matched boolean; all_known boolean:=true;
 current_origin uuid; mode text; origin_problem boolean; end_valid boolean; time_state text;
 deps jsonb; ops jsonb; origins jsonb; segments jsonb; states jsonb; fingerprint text; binding jsonb;
 at_time timestamptz; core_complete boolean; target_reason text; relationship text;
begin
 -- A volatile read-committed function obtains fresh command snapshots AFTER
 -- each ordered lock wait. Old RR/serializable snapshots are never labelled fresh.
 if current_setting('transaction_isolation')<>'read committed' then
  raise exception using errcode='40001',message='psttg_evaluation_requires_read_committed_retry';
 end if;
 if p_scope_ids is null or cardinality(p_scope_ids)=0 or array_position(p_scope_ids,null) is not null
 or target_object_versions is null or jsonb_typeof(target_object_versions)<>'array'
 or jsonb_array_length(target_object_versions)=0 or jsonb_array_length(target_object_versions)>256 then
  raise exception 'psttg_evaluation_shape';
 end if;
 select array_agg(distinct x order by x) into seeds from unnest(seeds) x;
 for t in select value from jsonb_array_elements(target_object_versions) loop
  if jsonb_typeof(t)<>'object' or not(t ?& array['kind','id','version','segments'])
  or t-array['kind','id','version','segments']<>'{}'::jsonb
  or jsonb_typeof(t->'kind')<>'string' or t->>'kind' not in ('record','origin','operation_input','copy')
  or jsonb_typeof(t->'id')<>'string' or (t->>'id')!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' or jsonb_typeof(t->'version')<>'string'
  or length(t->>'version') not between 1 and 128
  or jsonb_typeof(t->'segments')<>'array' or jsonb_array_length(t->'segments')=0
  or exists(select from jsonb_array_elements(t->'segments') x where jsonb_typeof(x)<>'string' or (x#>>'{}')!~'^(whole|original_fragment|source_fragments|field:[0-9a-f]{64})$')
  then raise exception 'psttg_evaluation_target_shape';end if;
  tid:=(t->>'id')::uuid;
  select jsonb_agg(x order by x::text) into segments from (select distinct value x from jsonb_array_elements(t->'segments')) s;
  t:=t||jsonb_build_object('segments',segments);
  if exists(select from jsonb_array_elements(targets) x where x->>'kind'=t->>'kind' and x->>'id'=t->>'id') then raise exception 'psttg_evaluation_duplicate_target';end if;
  targets:=targets||jsonb_build_array(t);
  target_scopes:=null;
  if t->>'kind'='record' then select x.scope_ids into target_scopes from dv_market_private.psttg_records x where record_id=tid;
  elsif t->>'kind'='origin' then select x.scope_ids into target_scopes from dv_market_private.psttg_origin_bindings x where origin_id=tid;
  else select x.scope_ids into target_scopes from dv_market_private.psttg_operation_events x where operation_id=tid order by event_seq desc limit 1;end if;
  seeds:=seeds||coalesce(target_scopes,'{}'::uuid[]);
 end loop;
 select jsonb_agg(x order by x->>'kind',x->>'id') into targets from jsonb_array_elements(targets) x;
 locked:=dv_market_private.psttg_evaluation_scopes(seeds);
 if cardinality(locked)>4096 then raise exception 'psttg_evaluation_scope_limit';end if;
 -- Same ascending exclusive row-lock order as V106 writers, without the
 -- writer-only open-phase assertion. Fenced/recovery rows are read, never reset.
 for g in select * from dv_market_private.psttg_scope_guards x where x.scope_id=any(locked) order by x.scope_id for update loop
  null;
 end loop;
 discovered:=dv_market_private.psttg_evaluation_scopes(seeds);
 if discovered is distinct from locked then
  raise exception using errcode='40001',message='psttg_evaluation_scope_closure_retry';
 end if;
 -- Do not acquire newly discovered rows out of order; caller retries whole tx.
 at_time:=clock_timestamp();
 if not(locked<@p_scope_ids) then issues:=issues||'"omitted_relevant_scope"'::jsonb;end if;
 if exists(select from unnest(locked) s where not exists(select from dv_market_private.psttg_scope_guards x where x.scope_id=s)) then issues:=issues||'"unknown_scope"'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('scope_id',x.scope_id,'generation',x.generation,'phase',x.phase,'recovery_state',x.recovery_state,'fence_fingerprint',encode(sha256(convert_to(jsonb_build_array(x.fence_token,encode(x.fence_target_digest,'hex'),x.fence_generation)::text,'UTF8')),'hex')) order by x.scope_id),'[]') into states
 from dv_market_private.psttg_scope_guards x where x.scope_id=any(locked);
 if exists(select from dv_market_private.psttg_scope_guards x where x.scope_id=any(locked) and (phase<>'open' or recovery_state<>'none')) then issues:=issues||'"fenced_closed_or_recovery"'::jsonb;end if;
 -- Copy events deliberately do not bump V106 generations. Bind their immutable
 -- identities as well as generations. This is a snapshot digest, not a secret.
 select encode(sha256(convert_to(jsonb_build_object(
  'origins',(select coalesce(jsonb_agg(jsonb_build_array(origin_id,encode(command_digest,'hex')) order by origin_id),'[]') from dv_market_private.psttg_origin_bindings where scope_ids && locked),
  'events',(select coalesce(jsonb_agg(jsonb_build_array(event_id,encode(command_digest,'hex')) order by event_id),'[]') from dv_market_private.psttg_operation_events where scope_ids && locked),
  'records',(select coalesce(jsonb_agg(jsonb_build_array(record_id,encode(seal_digest,'hex')) order by record_id),'[]') from dv_market_private.psttg_records where scope_ids && locked),
  'links',(select coalesce(jsonb_agg(to_jsonb(x) order by link_id),'[]') from dv_market_private.psttg_record_links x where from_record_id in(select record_id from dv_market_private.psttg_records where scope_ids && locked))
 )::text,'UTF8')),'hex') into fingerprint;
 -- Validate every discovered record, so omission cannot hide a corrupt peer.
 for r in select record_id from dv_market_private.psttg_records where scope_ids && locked loop
  perform dv_market_private.get_psttg_record_requirement(r.record_id);
 end loop;
 for t in select value from jsonb_array_elements(targets) loop
  tid:=(t->>'id')::uuid; ver:=null; target_scopes:='{}'; target_reason:=null;
  if t->>'kind'='record' then select content_revision,x.scope_ids into ver,target_scopes from dv_market_private.psttg_records x where record_id=tid;
  elsif t->>'kind'='origin' then select source_version,x.scope_ids into ver,target_scopes from dv_market_private.psttg_origin_bindings x where origin_id=tid;
  else select case when t->>'kind'='copy' then original_version else input_revision end,x.scope_ids into ver,target_scopes from dv_market_private.psttg_operation_events x where operation_id=tid and (t->>'kind'<>'copy' or event_kind='copy') order by event_seq desc limit 1;end if;
  known:=ver is not null and ver=t->>'version';
  if not known then target_reason:='unknown_target_or_version';end if;
  -- The core has structural fragments, not a registry resolving arbitrary
  -- application field selectors. Unknown selectors remain explicit coverage gaps.
  if exists(select from jsonb_array_elements_text(t->'segments') s where s not in ('whole','original_fragment','source_fragments')) then known:=false;target_reason:='unmapped_information_segment';end if;
  if t->>'kind'<>'record' and t->'segments'<>'["whole"]'::jsonb then known:=false;target_reason:='unmapped_information_segment';end if;
  if t->>'kind'='record' and t->'segments' ? 'original_fragment' and not exists(select from dv_market_private.psttg_records where record_id=tid and record_subtype='correction') then known:=false;target_reason:='unmapped_information_segment';end if;
  all_known:=all_known and known;
  items:='[]';deps:='[]';ops:='[]';
  select coalesce(jsonb_agg(jsonb_build_object('origin_id',z.origin_id,'mode',z.operating_mode,'revision',z.origin_revision,
   'has_successor',exists(select from dv_market_private.psttg_origin_bindings n where n.predecessor_origin_id=z.origin_id)) order by z.origin_id),'[]') into origins
  from dv_market_private.psttg_origin_bindings z where z.scope_ids && coalesce(target_scopes,'{}');
  for r in select x.* from dv_market_private.psttg_records x where
   (t->>'kind'='record' and (x.record_id=tid or exists(select from dv_market_private.psttg_record_links z where z.to_record_id=tid and z.from_record_id=x.record_id)))
   or (t->>'kind'='origin' and (x.origin_id=tid or exists(select from jsonb_array_elements(x.source_bindings) z where z->>'origin_id'=tid::text) or exists(select from dv_market_private.psttg_record_links z where z.source_origin_id=tid and z.from_record_id=x.record_id)))
   or (t->>'kind'='copy' and x.record_id in(select original_record_id from dv_market_private.psttg_operation_events where operation_id=tid))
   or (t->>'kind'='operation_input' and x.operation_id=tid)
   order by x.record_id loop
   meta:=dv_market_private.get_psttg_record_requirement(r.record_id);
   select * into o from dv_market_private.psttg_origin_bindings where origin_id=r.origin_id;
   select origin_id,operating_mode into current_origin,mode from dv_market_private.psttg_origin_bindings z
    where (z.source_system,z.environment_id,z.source_kind,z.source_id,z.source_version)=(o.source_system,o.environment_id,o.source_kind,o.source_id,o.source_version) order by origin_revision desc limit 1;
   origin_problem:=current_origin<>r.origin_id or mode='unresolved' or o.classification_basis='conflict';
   -- A revised or unresolved source fragment is relevant even if the record's
   -- primary origin has not changed.
   if exists(select from jsonb_array_elements(r.source_bindings) b join dv_market_private.psttg_origin_bindings z on z.origin_id=(b->>'origin_id')::uuid
     where z.operating_mode='unresolved' or z.classification_basis='conflict' or exists(select from dv_market_private.psttg_origin_bindings n where n.predecessor_origin_id=z.origin_id)) then origin_problem:=true;end if;
   end_valid:=r.creation_year is not null and r.creation_basis<>'unresolved' and r.end_at=make_timestamptz(r.creation_year+11,1,1,0,0,0,'Europe/Berlin');
   time_state:=case when not coalesce(end_valid,false) then 'creation_unresolved' when at_time<r.end_at then 'still_required' else 'documented_boundary_reached' end;
   relationship:=case when t->>'kind'='record' and r.record_id=tid then 'target_record' when t->>'kind'='copy' then 'copy_original_no_restart' when t->>'kind'='operation_input' then 'operation_record' else 'dependent_record' end;
   item:=jsonb_build_object('record_id',r.record_id,'version',r.content_revision,'class',r.record_class,'relationship',relationship,
    'creation_year',r.creation_year,'creation_basis',r.creation_basis,'calendar_zone','Europe/Berlin','end_at',case when end_valid then r.end_at end,
    'time_status',time_state,'provenance_status',case when origin_problem then 'unresolved_or_revised' when mode in ('synthetic_test','provider_sandbox') then 'test_or_sandbox' else 'evidenced_operation' end,
    'special_end_regime',r.record_class<>'process_description');
   items:=items||jsonb_build_array(item);
   for l in select * from dv_market_private.psttg_record_links z where z.from_record_id=r.record_id and
    ((t->>'kind'='record' and z.to_record_id=tid) or (t->>'kind'='origin' and z.source_origin_id=tid)) order by link_id loop
    deps:=deps||jsonb_build_array(jsonb_build_object('record_id',r.record_id,'link_id',l.link_id,'kind',l.link_kind,
     'required_segments',(select jsonb_agg(encode(sha256(convert_to(x::text,'UTF8')),'hex') order by x::text) from jsonb_array_elements(l.required_fields) x),
     'status',case when time_state='documented_boundary_reached' and not origin_problem then 'dependent_boundary_reached'
      when l.link_kind='corrects' and l.embedded_fragment_digest is not null then 'required_fragment_embedded_in_dependent'
      else 'dependency_extent_unresolved' end,
     'extends_whole_original',false));
   end loop;
  end loop;
  -- A latest failed/cancelled/draft event has no assumed unknown external effect.
  -- Ready retains an admission question; attempting/unknown retains saved inputs.
  for e in select * from (select distinct on(operation_id) operation_id,event_seq,event_kind,input_revision,scope_ids
    from dv_market_private.psttg_operation_events where scope_ids && coalesce(target_scopes,'{}') order by operation_id,event_seq desc) latest
    where event_kind in ('ready','attempting','outcome_unknown') order by operation_id loop
   ops:=ops||jsonb_build_array(jsonb_build_object('operation_id',e.operation_id,'sequence',e.event_seq,'state',e.event_kind,'input_version',e.input_revision,
    'input_requirement',case when e.event_kind='ready' then 'admitted_not_yet_executed' else 'necessary_input_pending_outcome' end,'segment_mapping','unresolved'));
  end loop;
  -- Origin-only imports/copies without an original record must never disappear
  -- as an empty, apparently cleared result.
  if jsonb_array_length(items)=0 then all_known:=false;target_reason:=coalesce(target_reason,'no_record_coverage');end if;
  results:=results||jsonb_build_array(jsonb_build_object('target',t,'target_bound',known,'coverage_issue',target_reason,
   'records',items,'origins',origins,'dependencies',deps,'operations',ops,'empty_is_absence_proof',false,
   'unrecorded_target',jsonb_array_length(items)=0));
 end loop;
 core_complete:=all_known and jsonb_array_length(issues)=0;
 binding:=jsonb_build_object('rule_version','K103-DE-v1/K2K4-reader-v1','evaluated_at',at_time,
  'requested_scope_ids',(select jsonb_agg(x order by x) from (select distinct unnest(p_scope_ids) x) s),
  'targets',targets,'scope_states',states,'core_fingerprint',fingerprint,'core_coverage_complete',core_complete);
 binding:=binding||jsonb_build_object('digest',encode(sha256(convert_to(binding::text,'UTF8')),'hex'));
 return jsonb_build_object('evaluation_kind','bounded_core_assessment','targets',results,'coverage_issues',issues,
  'core_coverage_complete',core_complete,'external_coverage_complete',false,'coverage_boundary','connected_O1_O5_only_no_producer_inventory',
  'other_obligations','not_evaluated','removal_authorized',false,'lock_guarantee','current_transaction_only',
  'binding',binding);
end$$;

-- Re-evaluate under the same locks; a matching digest is NOT a deletion right.
create function dv_market_private.check_psttg_evaluation_current(previous jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare now_result jsonb; b jsonb; ids uuid[]; valid boolean;
begin
 if previous is null or jsonb_typeof(previous)<>'object' or not(previous ?& array['rule_version','evaluated_at','requested_scope_ids','targets','scope_states','core_fingerprint','core_coverage_complete','digest'])
 or previous-array['rule_version','evaluated_at','requested_scope_ids','targets','scope_states','core_fingerprint','core_coverage_complete','digest']<>'{}'::jsonb then raise exception 'psttg_evaluation_binding_shape';end if;
 if previous->>'digest' is distinct from encode(sha256(convert_to((previous-'digest')::text,'UTF8')),'hex') then raise exception 'psttg_evaluation_binding_integrity';end if;
 select array_agg(x::uuid) into ids from jsonb_array_elements_text(previous->'requested_scope_ids') x;
 now_result:=dv_market_private.evaluate_psttg_removal(ids,previous->'targets');b:=now_result->'binding';
 valid:=previous->'core_coverage_complete'='true'::jsonb and b->'core_coverage_complete'='true'::jsonb
  and previous->>'rule_version'=b->>'rule_version'
  and (previous->>'evaluated_at')::timestamptz<=(b->>'evaluated_at')::timestamptz
  and (previous-array['digest','evaluated_at'])=(b-array['digest','evaluated_at']);
 return jsonb_build_object('status',case when valid then 'current_core_snapshot' else 'stale_or_incomplete' end,
  'removal_authorized',false,'external_coverage_complete',false,'lock_guarantee','current_transaction_only','current_binding',b,'current_assessment',now_result);
end$$;

do $acl$
declare signature regprocedure;
begin
 foreach signature in array array[
  'dv_market_private.psttg_evaluation_scopes(uuid[])'::regprocedure,
  'dv_market_private.evaluate_psttg_removal(uuid[],jsonb)'::regprocedure,
  'dv_market_private.check_psttg_evaluation_current(jsonb)'::regprocedure
 ] loop
  execute format('alter function %s owner to dv_psttg_core_owner',signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);
 end loop;
end$acl$;
commit;
