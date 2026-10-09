// Closed, side-effect-free error projection. Never exports provider values/messages.
import {relative,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const repoRoot=dirname(fileURLToPath(import.meta.url));
const messages=Object.freeze({
 "TCG contract": {
  "accessor data": "accessor_data",
  "accessor not allowed": "accessor_not_allowed",
  "array required": "array_required",
  "binder without collection": "binder_without_collection",
  "card request": "card_request",
  "cardCount": "cardcount",
  "catalog without source": "catalog_without_source",
  "confidence": "confidence",
  "coverage data field": "coverage_data_field",
  "crossgame ref": "crossgame_ref",
  "crossgame request": "crossgame_request",
  "crossgame translation": "crossgame_translation",
  "crossprovider ref": "crossprovider_ref",
  "data nesting": "data_nesting",
  "duplicate value": "duplicate_value",
  "entity kind": "entity_kind",
  "evidence UUID": "evidence_uuid",
  "evidence array": "evidence_array",
  "evidence array accessor": "evidence_array_accessor",
  "evidence array field": "evidence_array_field",
  "evidence boolean": "evidence_boolean",
  "evidence date": "evidence_date",
  "evidence provider code": "evidence_provider_code",
  "game has no adapter": "game_has_no_adapter",
  "gate boolean": "gate_boolean",
  "inactive axis with codes": "inactive_axis_with_codes",
  "inactive capability profile": "inactive_capability_profile",
  "inactive profile reason": "inactive_profile_reason",
  "invalid key": "invalid_key",
  "invalid text": "invalid_text",
  "legacy UUID": "legacy_uuid",
  "legacy price scalar": "legacy_price_scalar",
  "locale mismatch": "locale_mismatch",
  "magic edition": "magic_edition",
  "magic printing ref": "magic_printing_ref",
  "magic scalar metadata": "magic_scalar_metadata",
  "magic set locale": "magic_set_locale",
  "magic set observation UUID": "magic_set_observation_uuid",
  "magic unknown variant state": "magic_unknown_variant_state",
  "magic variant state": "magic_variant_state",
  "missing OPTCG card identity": "missing_optcg_card_identity",
  "missing TCGdex card identity": "missing_tcgdex_card_identity",
  "missing adapter": "missing_adapter",
  "plain object required": "plain_object_required",
  "planned activation": "planned_activation",
  "planned ready": "planned_ready",
  "priority": "priority",
  "provider review": "provider_review",
  "provider version": "provider_version",
  "rarity namespace": "rarity_namespace",
  "rarity state": "rarity_state",
  "ratio": "ratio",
  "ready requires scoped profile": "ready_requires_scoped_profile",
  "recognition_profile_inactive": "recognition_profile_inactive",
  "reference pair": "reference_pair",
  "region": "region",
  "request locale mismatch": "request_locale_mismatch",
  "review band": "review_band",
  "review number": "review_number",
  "scanner without adapter": "scanner_without_adapter",
  "scanner without catalog": "scanner_without_catalog",
  "score": "score",
  "score band": "score_band",
  "scryfall JSON object": "scryfall_json_object",
  "scryfall UUID": "scryfall_uuid",
  "scryfall array": "scryfall_array",
  "scryfall array data": "scryfall_array_data",
  "scryfall boolean": "scryfall_boolean",
  "scryfall card locale": "scryfall_card_locale",
  "scryfall data nesting": "scryfall_data_nesting",
  "scryfall face count": "scryfall_face_count",
  "scryfall images": "scryfall_images",
  "scryfall set locale": "scryfall_set_locale",
  "scryfall source route": "scryfall_source_route",
  "scryfall sparse array": "scryfall_sparse_array",
  "search terms": "search_terms",
  "set request": "set_request",
  "set variant evidence": "set_variant_evidence",
  "source time": "source_time",
  "sparse evidence array": "sparse_evidence_array",
  "structured_variant_evidence_unsupported": "structured_variant_evidence_unsupported",
  "text enum values": "text_enum_values",
  "text facet values": "text_facet_values",
  "translate": "translate",
  "unbound adapter": "unbound_adapter",
  "unbound provider": "unbound_provider",
  "uncertain": "uncertain",
  "unknown game": "unknown_game",
  "unsafe data key": "unsafe_data_key",
  "unsafe display name": "unsafe_display_name",
  "unsafe icon": "unsafe_icon",
  "unsafe image": "unsafe_image",
  "unsafe label": "unsafe_label",
  "variant namespace": "variant_namespace"
 },
 "TCG ingest": {
  "acquisition_digest": "acquisition_digest",
  "acquisition_directory": "acquisition_directory",
  "acquisition_file": "acquisition_file",
  "card_scope_shape": "card_scope_shape",
  "card_validation": "card_validation",
  "catalog_identity_conflict": "catalog_identity_conflict",
  "catalog_snapshot_older": "catalog_snapshot_older",
  "catalog_snapshot_time_conflict": "catalog_snapshot_time_conflict",
  "daily_snapshot_limit": "daily_snapshot_limit",
  "envelope": "envelope",
  "envelope_binding": "envelope_binding",
  "file_size": "file_size",
  "manifest_binding": "manifest_binding",
  "manifest_digest": "manifest_digest",
  "missing_set": "missing_set",
  "operator_input": "operator_input",
  "owner_or_readiness": "owner_or_readiness",
  "prepared_digest": "prepared_digest",
  "provider_migration_review_required": "provider_migration_review_required",
  "record_count": "record_count",
  "release_missing": "release_missing",
  "set_shape": "set_shape",
  "sets_digest": "sets_digest",
  "sets_framing": "sets_framing",
  "sets_next_page": "sets_next_page",
  "sets_order": "sets_order",
  "snapshot_seal": "snapshot_seal",
  "stage_projection": "stage_projection",
  "uuid": "uuid",
  "rollback_failed": "rollback_failed"
 },
 "TCG evidence": {
  "accessor": "accessor",
  "array_limit": "array_limit",
  "array_shape": "array_shape",
  "bom": "bom",
  "cycle": "cycle",
  "depth_limit": "depth_limit",
  "duplicate_key": "duplicate_key",
  "json_syntax": "json_syntax",
  "json_type_invalid": "json_type_invalid",
  "nonenumerable": "nonenumerable",
  "number_invalid": "number_invalid",
  "prototype": "prototype",
  "size_limit": "size_limit",
  "sparse_array": "sparse_array",
  "symbol_key": "symbol_key",
  "unicode_nul": "unicode_nul",
  "unpaired_surrogate": "unpaired_surrogate",
  "unsafe_key": "unsafe_key",
  "utf8": "utf8"
 },
 "TCG persistence": {
  "bom": "bom",
  "bulk_manifest": "bulk_manifest",
  "bulk_origin": "bulk_origin",
  "card_scope": "card_scope",
  "card_validation": "card_validation",
  "catalog_identity_conflict": "catalog_identity_conflict",
  "catalog_set_conflict": "catalog_set_conflict",
  "compressed_size": "compressed_size",
  "empty_line": "empty_line",
  "empty_snapshot": "empty_snapshot",
  "gzip_integrity": "gzip_integrity",
  "jsonl_object": "jsonl_object",
  "line_count": "line_count",
  "provider_migration_review_required": "provider_migration_review_required",
  "record_version_mismatch": "record_version_mismatch",
  "records_shape": "records_shape",
  "reference_records": "reference_records",
  "reference_unavailable": "reference_unavailable",
  "set_date": "set_date",
  "set_metadata": "set_metadata",
  "set_provenance": "set_provenance",
  "set_scope": "set_scope",
  "sets_response": "sets_response",
  "snapshot_size": "snapshot_size",
  "source_path": "source_path",
  "utc_time": "utc_time",
  "uuid": "uuid"
 },
 "TCG source": {
  "acquisition_already_finished": "acquisition_already_finished",
  "acquisition_attempts_exhausted": "acquisition_attempts_exhausted",
  "api_origin": "api_origin",
  "bom": "bom",
  "bulk_origin": "bulk_origin",
  "cache_corrupt": "cache_corrupt",
  "clock": "clock",
  "clock_rate": "clock_rate",
  "compressed_size": "compressed_size",
  "compressed_size_mismatch": "compressed_size_mismatch",
  "daily_snapshot_limit": "daily_snapshot_limit",
  "decompressed_size": "decompressed_size",
  "depth_limit": "depth_limit",
  "empty_line": "empty_line",
  "empty_snapshot": "empty_snapshot",
  "gzip_integrity": "gzip_integrity",
  "http_status": "http_status",
  "json_syntax": "json_syntax",
  "jsonl_object": "jsonl_object",
  "limit_override": "limit_override",
  "line_count": "line_count",
  "manifest_list": "manifest_list",
  "one_all_cards": "one_all_cards",
  "operator_busy": "operator_busy",
  "operator_temp_directory": "operator_temp_directory",
  "record_size": "record_size",
  "redirect": "redirect",
  "repository_provider_data": "repository_provider_data",
  "response_body": "response_body",
  "response_size": "response_size",
  "retention_receipt": "retention_receipt",
  "sets_next_page": "sets_next_page",
  "sets_page": "sets_page",
  "sets_pagination_cycle": "sets_pagination_cycle",
  "sets_size": "sets_size",
  "source_configuration": "source_configuration",
  "source_origin": "source_origin",
  "temp_shape": "temp_shape",
  "temp_symlink": "temp_symlink",
  "utf8": "utf8"
 },
 "M5 acceptance": {
  "required_evidence_missing": "required_evidence_missing",
  "accepted_counts": "accepted_counts",
  "alternate_art": "alternate_art",
  "canonical_integrity": "canonical_integrity",
  "cleanup_incomplete": "cleanup_incomplete",
  "cleanup_scope": "cleanup_scope",
  "complete_canonical_counts": "complete_canonical_counts",
  "compressed_size": "compressed_size",
  "db_bridge_operation": "db_bridge_operation",
  "db_worker_exit": "db_worker_exit",
  "disposable_database_environment": "disposable_database_environment",
  "empty_disposable_foundation": "empty_disposable_foundation",
  "etched": "etched",
  "explicit_real_authorization_required": "explicit_real_authorization_required",
  "foundation_state": "foundation_state",
  "generation_binding": "generation_binding",
  "generation_increment": "generation_increment",
  "local_source_preflight": "local_source_preflight",
  "manifest_binding": "manifest_binding",
  "membership_counts": "membership_counts",
  "membership_integrity": "membership_integrity",
  "native_database_cleanup": "native_database_cleanup",
  "no_raw_image_price_projection": "no_raw_image_price_projection",
  "no_sealed_membership": "no_sealed_membership",
  "nonempty_catalog": "nonempty_catalog",
  "one_time_pr_environment": "one_time_pr_environment",
  "p": "p",
  "prerelease_stamp": "prerelease_stamp",
  "product_flags": "product_flags",
  "readiness": "readiness",
  "release_cardinality": "release_cardinality",
  "reviews_must_remain_open": "reviews_must_remain_open",
  "runner_temp": "runner_temp",
  "scope_binding": "scope_binding",
  "single_snapshot": "single_snapshot",
  "snapshot_binding": "snapshot_binding",
  "snapshot_cardinality": "snapshot_cardinality",
  "snapshot_digest": "snapshot_digest",
  "snapshot_sealed": "snapshot_sealed",
  "temp_scope": "temp_scope"
 },
 "TCG audit": {
  "options": "options",
  "resource_limit": "resource_limit",
  "input_changed": "input_changed",
  "record_count": "record_count",
  "empty_candidates": "empty_candidates",
  "cli_arguments": "cli_arguments",
  "output_exists": "output_exists",
  "unexpected_failure": "unexpected_failure"
 }
});
const dynamic=Object.freeze({'TCG contract':[['unknown field ','unknown_field'],['unsupported value ','unsupported_value'],['missing ','missing_field'],['unknown metadata ','unknown_metadata'],['adapter method ','adapter_method'],['scryfall variant evidence mismatch ','scryfall_variant_evidence_mismatch']]});
const paths=new Set(['tcg-v1-contracts.js','tcg-v1-catalog-providers.js','tcg-v1-game-adapters.js','tcg-catalog-evidence-v1.mjs','tcg-catalog-persistence-v1.mjs','tcg-catalog-scryfall-source-v1.mjs','tcg-catalog-ingest-worker-v1.mjs','tcg-catalog-diagnostics-v1.mjs','tests/tcg-i3-magic-source-live-acceptance.mjs','tests/tcg-i3-magic-source-snapshot-audit.mjs','tests/tcg-i3-magic-source-snapshot-audit-test.mjs']);
const phases=new Set(['unknown','prepare','prepare_integrity','prepare_sets','prepare_cards','prepare_sets_projection','prepare_variants','prepare_digests','publication_preflight','transaction_begin','stage_header','stage_sets','stage_cards','stage_variants','stage_records','publisher','commit','finish','raw_cleanup','database_cleanup','disposable_database_setup','real_source_acquisition_and_publication','post_publication_verification','audit_integrity','audit_cards','audit_variants','audit_final_integrity','audit_cleanup','audit_output']);
const exclusions=['digital','oversized','not_paper','language','layout','unresolved_missing_printed_name'];
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const digest=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const count=v=>Number.isSafeInteger(v)&&v>=0;
// Data descriptors only: hostile getters must neither run nor mask the error.
const nativeStackGetter=Object.getOwnPropertyDescriptor(new Error(),'stack')?.get;
function get(o,k){try{for(let n=0;o&&n<5;n++,o=Object.getPrototypeOf(o)){const d=Object.getOwnPropertyDescriptor(o,k);if(d){if(Object.hasOwn(d,'value'))return d.value;if(k==='stack'&&nativeStackGetter&&d.get===nativeStackGetter)return d.get.call(o);return undefined;}}}catch{}return undefined;}
function location(v){if(typeof v!=='string')return null;const m=v.match(/^([^:]+):([1-9][0-9]{0,7}):([1-9][0-9]{0,7})$/);return m&&paths.has(m[1])?v:null;}
export function safeError(error,context={}){
 const nested=get(error,'errors');if(error instanceof AggregateError&&Array.isArray(nested)&&nested.length)error=nested[0];
 const captured=get(error,'diagnostic');if(captured&&typeof captured==='object')error=captured;
 const name=get(error,'error_name')??get(error,'name');
 const out={name:/^(?:Error|TypeError|RangeError|SyntaxError|ReferenceError|EvalError|URIError|AggregateError|DatabaseError|error|AbortError|TimeoutError)$/.test(name??'')?name:'Error',contract_family:null,contract_code:null,contract_code_status:'UNKNOWN'};
 out.error_name=out.name;
 const message=get(error,'message');let category=false;
 if(typeof message==='string')for(const family of Object.keys(messages))if(message.startsWith(family+': ')){
  out.contract_family=family;const suffix=message.slice(family.length+2);
  if(Object.hasOwn(messages[family],suffix))out.contract_code=messages[family][suffix];
  else for(const [prefix,code] of dynamic[family]??[])if(suffix.startsWith(prefix)){out.contract_code=code;category=true;break;}
  break;
 }
 if(out.contract_family===null&&Object.hasOwn(messages,get(error,'contract_family')??'')){
  out.contract_family=get(error,'contract_family');const code=get(error,'contract_code');
  if(Object.values(messages[out.contract_family]).includes(code))out.contract_code=code;
  else if((dynamic[out.contract_family]??[]).some(x=>x[1]===code)){out.contract_code=code;category=true;}
 }
 if(out.contract_code)out.contract_code_status=category?'CATEGORY_ONLY':'KNOWN_STATIC';
 const positions=[];const add=v=>{const p=location(v);if(p&&!positions.includes(p)&&positions.length<6)positions.push(p);};
 add(get(error,'stack_location'));const prior=get(error,'stack_positions');if(Array.isArray(prior))for(const v of prior.slice(0,6))add(v);
 const stack=get(error,'stack');if(typeof stack==='string')for(const line of stack.slice(0,32768).split('\n').slice(1,33)){
  const m=line.match(/(?:file:\/\/)?(\/[^()\r\n]+):([1-9][0-9]*):([1-9][0-9]*)\)?$/);if(m)add(relative(repoRoot,m[1])+':'+m[2]+':'+m[3]);
 }
 out.stack_positions=positions;out.stack_location=positions[0]??null;
 const phase=get(context,'phase')??get(error,'phase')??get(error,'exact_phase');out.phase=phases.has(phase)?phase:'unknown';
 const checkpoint=get(context,'last_checkpoint')??get(error,'last_checkpoint');if(typeof checkpoint==='string'&&/^(?:prepare|publication|stage|publisher|transaction|commit|finish|acquisition)_(?:integrity_|sets_|cards_|variants_|digests_|preflight_)?(?:start|complete|failure|progress)$/.test(checkpoint))out.last_checkpoint=checkpoint;
 for(const key of ['record_ordinal','processed_count','accepted_count','excluded_count','duplicate_count','record_count','accepted_cards','accepted_sets','accepted_variants','duplicates','excluded']){const v=get(context,key)??get(error,key);if(count(v))out[key]=v;}
 for(const key of ['external_id','last_external_id']){const v=get(context,key)??get(error,key);if(uuid(v))out[key]=v;}
 for(const key of ['record_sha256','jsonl_sha256','compressed_sha256','sets_response_sha256','manifest_sha256','manifest_raw_sha256']){const v=get(context,key)??get(error,key);if(digest(v))out[key]=v;}
 const counts=get(context,'counts')??get(error,'counts');if(counts){out.counts={};for(const key of ['record_count','accepted_cards','accepted_variants','accepted_sets','duplicates','excluded'])if(count(get(counts,key)))out.counts[key]=get(counts,key);}
 const reasons=get(context,'excluded_by_reason')??get(counts,'excluded_by_reason')??get(error,'excluded_by_reason');if(reasons){out.excluded_by_reason={};for(const key of exclusions)if(count(get(reasons,key)))out.excluded_by_reason[key]=get(reasons,key);}
 const code=get(error,'code')??get(error,'error_code');if(typeof code==='string'&&(/^[0-9A-Z]{5}$/.test(code)||['ENOENT','EACCES','EPERM','EIO','ENOSPC','EMFILE','ENFILE','EISDIR','ENOTDIR','EEXIST','ELOOP'].includes(code)))out.code=code;
 // No field-level instrumentation exists in the frozen validators. A static
 // error class or fail-helper stack line is NOT an exact field predicate.
 out.field_path=null;out.error_location_captured=positions.length>0;out.error_class_captured=out.contract_code!==null;out.exact_predicate_captured=false;
 return out;
}
export const diagnosticBridgeError=envelope=>Object.assign(new Error(),{stack:''},safeError(envelope));
export function diagnosticFailure(error,context={}){const {name,code,phase,...rest}=safeError(error,context);return {exact_phase:phase,error_name:name,...(code?{error_code:code}:{}),...rest};}
// Observer rejection is evidence only. Never changes the primary operation.
export async function captureDiagnostic(error,context,observer){const primary=safeError(error,context);let secondary=null;try{if(observer)await observer(primary);}catch(e){secondary=safeError(e,{phase:primary.phase});}return {primary,diagnostic_error:secondary};}
