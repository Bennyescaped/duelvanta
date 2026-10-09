// Offline diagnostic inventory only. No acquisition, client, stage header or release.
import {mkdtemp,readFile,writeFile,appendFile,stat,rm,mkdir,lstat,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {verifyAcquisition,hashFile,lines,indexPath,exclusion,referenceRaw,uuid} from '../tcg-catalog-ingest-worker-v1.mjs';
import {jsonlRecords,LIMITS} from '../tcg-catalog-scryfall-source-v1.mjs';
import {prepareProviderEvidence,parseProviderJSON} from '../tcg-catalog-evidence-v1.mjs';
import {prepareRecords} from '../tcg-catalog-persistence-v1.mjs';
import {safeError,captureDiagnostic} from '../tcg-catalog-diagnostics-v1.mjs';
const P=createRequire(import.meta.url)('../tcg-v1-catalog-providers.js');
const fail=code=>{throw new TypeError('TCG audit: '+code);};
const validID=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
const defaults=Object.freeze({max_examples:24,max_index_bytes:2*LIMITS.decompressed,max_records:LIMITS.lines});
function options(input){for(const k of Object.keys(input))if(!Object.hasOwn(defaults,k))fail('options');const o={...defaults,...input};for(const [k,v] of Object.entries(o))if(!Number.isSafeInteger(v)||v<0||v>defaults[k])fail('options');return o;}
const recordFailure=error=>error instanceof TypeError&&[null,'TCG contract','TCG evidence','TCG ingest','TCG persistence'].includes(safeError(error).contract_family);
async function exists(path){try{await stat(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
function inputFiles(envelope){
 if(!envelope||!Array.isArray(envelope.pages)||envelope.pages.length>100000)fail('resource_limit');
 const files=[['gzip',envelope.gzip_file,LIMITS.compressed],['jsonl',envelope.jsonl_file,LIMITS.decompressed],['manifest',envelope.manifest_file,LIMITS.manifest],...envelope.pages.map((p,i)=>['set_page_'+(i+1),p.file,LIMITS.sets])];
 if(files.some(([,p])=>typeof p!=='string'))fail('options');return files;
}
async function bindFiles(files){const out={};let setBytes=0;for(const [key,path,max] of files){const s=await stat(path);if(!s.isFile()||s.size>max)fail('resource_limit');if(key.startsWith('set_page_')){setBytes+=s.size;if(setBytes>LIMITS.sets)fail('resource_limit');}out[key]=await hashFile(path,max);}return out;}
export async function auditSnapshot(envelope,{limits={},onDiagnostic=null}={}){
 const result={contract:'TCGSourceSnapshotDiagnosticAudit',version:'1',diagnostic_only:true,audit_complete:false,snapshot_compatible:false,status:'INCOMPLETE',
  first_pass:{records_observed:0,candidates:0,excluded:0,identical_duplicates:0,identity_conflicts:0,record_errors:0,unclassified:0,excluded_by_reason:{},eof:false,expected_records:null,balanced:false},
  second_pass:{records_examined:0,validated_records:0,variants:0,reference_variant_errors:0,uncheckable_dependencies:0,without_reference:0,complete:false},
  sets:{used:0,unused:0,unused_translation_errors:0,unused_metadata_preparation:'NOT_APPLICABLE_TO_IMPORT'},
  error_classes:{},examples:[],representative_limit:0,examples_omitted:0,secondary_diagnostics:[],secondary_diagnostic_count:0,
  input_bindings:{before:null,after:null,unchanged:false},abort:null,cleanup:{audit_index_created:false,audit_index_removed:false,input_files_deleted:false},
  provider_requests:0,live_invocations:0,database_publications:0,
  coverage:{first_failure_per_record:true,all_predicates_per_record:false,later_predicates_hidden_by_first_failure:true,reference_coverage:'NOT_RUN',unused_set_diagnostics_affect_import:false},
  reproduction:{kind:'SANITIZED_DIGEST_BOUND_EXAMPLES',raw_records_included:false,historical_raw_equality_claimed:false}};
 let root=null,phase='audit_integrity',files=null,o=null,last=null,current=null,unknownRejectedDependency=false,bytesWritten=0;
 const secondary=e=>{result.secondary_diagnostic_count++;if(result.secondary_diagnostics.length<6)result.secondary_diagnostics.push(e);};
 const note=async(error,context,kind)=>{
  const captured=await captureDiagnostic(error,context,onDiagnostic),d=captured.primary;
  if(captured.diagnostic_error)secondary(captured.diagnostic_error);
  const site=d.stack_positions.find(p=>!p.startsWith('tcg-v1-contracts.js:24:'))??d.stack_location??'UNKNOWN';
  const key=[kind,d.contract_family??'UNKNOWN',d.contract_code??'UNKNOWN',site].join('|');
  result.error_classes[key]=(result.error_classes[key]??0)+1;
  // One first-occurrence example per class/callsite, at most 24 classes.
  // Repeated occurrences never consume another class's slot.
  if(result.error_classes[key]===1&&result.examples.length<(o?.max_examples??0))result.examples.push({class_key:key,kind,...d});else result.examples_omitted++;
  return d;
 };
 const writeIndex=async(path,data,append=false)=>{const text=typeof data==='string'?data:JSON.stringify(data)+'\n';bytesWritten+=Buffer.byteLength(text);if(bytesWritten>o.max_index_bytes)fail('resource_limit');await (append?appendFile:writeFile)(path,text,{flag:append?'a':'wx',mode:0o600});};
 const context=(raw,ev,ordinal)=>({phase,record_ordinal:ordinal,external_id:validID(raw?.id)?raw.id:null,record_sha256:ev?.content_sha256,jsonl_sha256:envelope.jsonl_sha256,compressed_sha256:envelope.compressed_sha256,sets_response_sha256:envelope.sets_response_sha256,manifest_sha256:envelope.manifest_sha256,manifest_raw_sha256:envelope.manifest_raw_sha256});
 const markRejected=async raw=>{if(validID(raw?.oracle_id))await writeIndex(await indexPath(root,'rejected_groups',raw.oracle_id),'1\n',true);else unknownRejectedDependency=true;};
 try{
  o=options(limits);result.representative_limit=o.max_examples;files=inputFiles(envelope);result.input_bindings.before=await bindFiles(files);
  const {sets,setPaths}=await verifyAcquisition(envelope);
  if(!Number.isSafeInteger(envelope.record_count)||envelope.record_count<1||envelope.record_count>o.max_records)fail('resource_limit');
  result.first_pass.expected_records=envelope.record_count;
  root=await mkdtemp(join(tmpdir(),'duelvanta-snapshot-audit-'));result.cleanup.audit_index_created=true;
  const ids=join(root,'accepted.ids');await writeIndex(ids,'');const used=new Set();
  const common={source_path:envelope.bulk_url,set_source_paths:setPaths,retrieved_at:envelope.completed_at};
  phase='audit_cards';
  for await(const raw of jsonlRecords(envelope.jsonl_file)){
   const first=result.first_pass,ordinal=++first.records_observed;first.unclassified++;current=context(raw,null,ordinal);
   if(ordinal>o.max_records)fail('resource_limit');let ev=null;
   try{
    ev=prepareProviderEvidence(raw);current=context(raw,ev,ordinal);uuid(raw.id);const seen=await indexPath(root,'seen',raw.id);
    if(await exists(seen)){
     const old=JSON.parse(await readFile(seen,'utf8'));
     if(old.record_version!==ev.record_version||old.lang!==raw.lang){await markRejected(raw);await note(new TypeError('TCG ingest: catalog_identity_conflict'),current,'identity_conflict');first.identity_conflicts++;}
     else first.identical_duplicates++;
    }else{
     await writeIndex(seen,{record_version:ev.record_version,lang:raw.lang});
     const reason=exclusion(ev.raw_record,{source_path:envelope.bulk_url,retrieved_at:envelope.completed_at},sets.get(raw.set_id));
     if(reason){first.excluded++;first.excluded_by_reason[reason]=(first.excluded_by_reason[reason]??0)+1;}
     else{
      const set=sets.get(raw.set_id);if(!set)throw new TypeError('TCG ingest: missing_set');
      const prepared=prepareRecords({sets:[set],cards:[raw],...common});if(prepared.stage_cards.length!==1)throw new TypeError('TCG ingest: card_validation');
      await writeIndex(await indexPath(root,'cards',raw.id),raw);
      await writeIndex(await indexPath(root,'ordinals',raw.id),{ordinal,record_sha256:ev.content_sha256});
      await writeIndex(ids,raw.id+'\n',true);if(raw.oracle_id)await writeIndex(await indexPath(root,'groups',raw.oracle_id),raw.id+'\n',true);
      used.add(raw.set_id);first.candidates++;
     }
    }
   }catch(error){
    if(!recordFailure(error))throw error;
    await markRejected(raw);await note(error,context(raw,ev,ordinal),'record_error');first.record_errors++;
   }
   first.unclassified--;last=current;current=null;
  }
  result.first_pass.eof=true;
  if(result.first_pass.records_observed!==envelope.record_count)fail('record_count');
  result.sets.used=used.size;
  // The import ignores these sets. Translation diagnostics never turn them
  // into used sets or reinterpret an import decision; metadata remains untested.
  for(const [id,set] of sets)if(!used.has(id)){
   result.sets.unused++;
   try{P.scryfall.translate(prepareProviderEvidence(set).raw_record,{game_key:'magic',locale:null,collector:{text:'',source:'manual'},source_path:setPaths[id],retrieved_at:envelope.completed_at});}
   catch(error){if(!recordFailure(error))throw error;result.sets.unused_translation_errors++;await note(error,{phase:'prepare_sets',external_id:id,record_sha256:prepareProviderEvidence(set).content_sha256},'unused_set');}
  }
  phase='audit_variants';
  for await(const id of lines(ids)){
   const raw=JSON.parse(await readFile(await indexPath(root,'cards',id),'utf8')),meta=JSON.parse(await readFile(await indexPath(root,'ordinals',id),'utf8'));
   current={...context(raw,{content_sha256:meta.record_sha256},meta.ordinal)};
   const second=result.second_pass;second.records_examined++;
   try{
    const ref=await referenceRaw(root,raw);
    const limited=(!ref||ref.id!==raw.id)&&(unknownRejectedDependency||validID(raw.oracle_id)&&await exists(await indexPath(root,'rejected_groups',raw.oracle_id)));
    if(limited)second.uncheckable_dependencies++;
    if(!ref)second.without_reference++;
    const st=prepareRecords({sets:[sets.get(raw.set_id),...(ref&&ref.set_id!==raw.set_id?[sets.get(ref.set_id)]:[])],cards:[raw],reference_records:ref?[ref]:[],...common});
    second.validated_records++;second.variants+=st.stage_variants.length;
   }catch(error){if(!recordFailure(error))throw error;second.reference_variant_errors++;await note(error,current,'reference_variant_error');}
   current=null;
  }
  result.second_pass.complete=result.second_pass.records_examined===result.first_pass.candidates;
  result.coverage.reference_coverage=result.second_pass.uncheckable_dependencies?'LIMITED_REJECTED_DEPENDENCIES':'COMPLETE_FOR_DIAGNOSTIC_CANDIDATES';
  result.audit_complete=true;
 }catch(error){result.abort={...await note(error,{phase,...current},'global_failure'),failure_context:current?'DELIVERED_RECORD':'STREAM_OR_GLOBAL',last_processed_record:last?safeError(null,last):null,next_record_ordinal:result.first_pass.records_observed+1};}
 finally{
  if(files&&result.input_bindings.before){try{phase='audit_final_integrity';result.input_bindings.after=await bindFiles(files);result.input_bindings.unchanged=JSON.stringify(result.input_bindings.before)===JSON.stringify(result.input_bindings.after);if(!result.input_bindings.unchanged)throw new TypeError('TCG audit: input_changed');}catch(error){result.audit_complete=false;const d=await note(error,{phase},'global_failure');if(result.abort)secondary(d);else result.abort=d;}}
  if(root){try{await rm(root,{recursive:true});result.cleanup.audit_index_removed=!(await exists(root));}catch(error){result.audit_complete=false;secondary(safeError(error,{phase:'audit_cleanup'}));}}
 }
 const f=result.first_pass,s=result.second_pass;
 result.example_coverage={classes_observed:Object.keys(result.error_classes).length,classes_represented:result.examples.length,classes_without_example:Object.keys(result.error_classes).length-result.examples.length,complete:Object.keys(result.error_classes).length===result.examples.length,selection:'FIRST_OCCURRENCE_PER_CLASS_AND_CALLSITE',fixed_maximum:24};
 f.balanced=f.records_observed===f.candidates+f.excluded+f.identical_duplicates+f.identity_conflicts+f.record_errors+f.unclassified;
 if(!f.balanced||f.unclassified||!s.complete)result.audit_complete=false;
 result.snapshot_compatible=result.audit_complete&&result.input_bindings.unchanged&&f.candidates>0&&f.identity_conflicts===0&&f.record_errors===0&&s.reference_variant_errors===0&&s.uncheckable_dependencies===0;
 result.status=result.audit_complete?(result.snapshot_compatible?'COMPLETE_COMPATIBLE':'COMPLETE_REJECTED'):'INCOMPLETE';
 return result;
}
export async function main(args=process.argv.slice(2)){
 if(args.length!==4||args[0]!=='--envelope'||args[2]!=='--output')fail('cli_arguments');
 const input=resolve(args[1]),output=resolve(args[3]);
 const s=await stat(input);if(!s.isFile()||s.size>LIMITS.manifest)fail('resource_limit');
 const envelope=parseProviderJSON(await readFile(input),LIMITS.manifest);
 // A new directory only; never replace an input, existing report or symlink.
 try{await lstat(output);fail('output_exists');}catch(e){if(e.code!=='ENOENT')throw e;}
 const parent=await realpath(dirname(output));if(parent!==dirname(output))fail('options');
 const result=await auditSnapshot(envelope);
 await mkdir(output,{mode:0o700});
 for(const [name,value] of [['audit-report.json',result],['error-classes.json',{classes:result.error_classes,examples:result.examples,examples_omitted:result.examples_omitted,example_coverage:result.example_coverage}],['reproduction.json',{...result.reproduction,input_bindings:result.input_bindings.before,examples:result.examples,example_coverage:result.example_coverage}]])await writeFile(join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log(JSON.stringify({status:result.status,audit_complete:result.audit_complete,snapshot_compatible:result.snapshot_compatible}));
 return result.snapshot_compatible?0:result.audit_complete?1:2;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{process.exitCode=await main();}catch(error){console.error(JSON.stringify(safeError(error,{phase:'audit_output'})));process.exitCode=2;}
}
