// Own AUDIT IDs; synthetic only. Source57 is unchanged.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm,readdir,symlink} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {gzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fixture,card,clone,uuid,forbidExternalIO} from './helpers/tcg-i3-magic-source-fixture.mjs';
import {canonicalJSON,sha256} from '../tcg-catalog-evidence-v1.mjs';
import {setsPageFraming} from '../tcg-catalog-scryfall-source-v1.mjs';
import {prepareAcquisition,ingestAcquisition} from '../tcg-catalog-ingest-worker-v1.mjs';
import {safeError,diagnosticFailure,diagnosticBridgeError,captureDiagnostic} from '../tcg-catalog-diagnostics-v1.mjs';
import {auditSnapshot,main as auditCLI} from './tcg-i3-magic-source-snapshot-audit.mjs';
const C=createRequire(import.meta.url)('../tcg-v1-contracts.js');
const tests=[],reports=[],add=(id,name,run)=>tests.push({id,name,run});
const sentinel=['R5','SECRET','PAYLOAD','CREDENTIAL','SENTINEL'].join('_');
async function snapshot(fn,{cards=[card()],jsonl=null,pages=clone(fixture.pages),expected=cards.length}={}){
 const parent=await mkdtemp(join(tmpdir(),'duelvanta-r5-synthetic-')),root=join(parent,'acq-'+uuid(900));await mkdir(root);
 try{
  const raw=Buffer.from(jsonl??cards.map(x=>JSON.stringify(x)).join('\n')+'\n'),gzip=gzipSync(raw),manifest={...clone(fixture.manifest),compressed_size:gzip.length};
  const mb=Buffer.from(JSON.stringify({object:'list',has_more:false,data:[manifest]}));
  const envelope={contract:'ScryfallAcquisitionEnvelope',version:'1',origin:'bulk_snapshot',sets_framing:'ScryfallSetsPages/1',manifest,bulk_url:manifest.jsonl_download_uri,completed_at:fixture.clock,record_count:expected,
   gzip_file:join(root,'cards.gz'),jsonl_file:join(root,'cards.jsonl'),manifest_file:join(root,'manifest.json'),compressed_size:gzip.length,decompressed_size:raw.length,compressed_sha256:sha256(gzip),jsonl_sha256:sha256(raw),manifest_raw_sha256:sha256(mb),manifest_sha256:sha256(Buffer.from(canonicalJSON(manifest,65536))),pages:[]};
  for(const [path,bytes] of [[envelope.gzip_file,gzip],[envelope.jsonl_file,raw],[envelope.manifest_file,mb]])await writeFile(path,bytes);
  for(const [i,page] of pages.entries()){const bytes=Buffer.from(page.raw),file=join(root,'sets-'+i+'.json');await writeFile(file,bytes);envelope.pages.push({order:i+1,url:page.url,bytes:bytes.length,raw_sha256:sha256(bytes),file});}
  envelope.sets_response_sha256=setsPageFraming(pages.map(p=>({url:p.url,bytes:Buffer.from(p.raw)})));
  return await fn(envelope,parent,root);
 }finally{await rm(parent,{recursive:true,force:true});}
}
const audit=async(e,opts)=>{const r=await auditSnapshot(e,opts);reports.push(r);assert.equal(r.first_pass.balanced,true);assert.equal(r.provider_requests,0);assert.equal(r.database_publications,0);return r;};
add('AUDIT01','Full valid snapshot, variants, EOF and balance',()=>snapshot(async e=>{const r=await audit(e);assert.equal(r.audit_complete,true);assert.equal(r.snapshot_compatible,true);assert.equal(r.first_pass.records_observed,1);assert.equal(r.second_pass.variants,3);assert.equal(r.first_pass.eof,true);assert.equal(r.cleanup.audit_index_removed,true);}));
add('AUDIT02','Errors at start, middle and end all captured',()=>snapshot(async e=>{const r=await audit(e);assert.equal(r.audit_complete,true);assert.equal(r.snapshot_compatible,false);assert.equal(r.first_pass.record_errors,3);assert.equal(r.first_pass.candidates,2);assert.deepEqual(r.examples.filter(x=>x.kind==='record_error').map(x=>x.record_ordinal),[1,3,5]);assert.equal(Object.keys(r.error_classes).length,3);},{cards:[card({id:uuid(1),name:null}),card({id:uuid(2)}),card({id:uuid(3),digital:'false'}),card({id:uuid(4)}),card({id:uuid(5),rarity:'unsupported'})]}));
add('AUDIT03','Normal preparation stops at first reject',()=>snapshot(async e=>{const events=[];await assert.rejects(prepareAcquisition(e,{onDiagnostic:v=>events.push(v)}),/invalid text/);const d=events.find(x=>x.checkpoint==='prepare_diagnostic').diagnostic;assert.equal(d.processed_count,1);assert.equal(d.contract_code,'invalid_text');assert.equal(d.exact_predicate_captured,false);assert.ok(d.record_sha256);},{cards:[card({id:uuid(1),name:null}),card({id:uuid(2)}),card({id:uuid(3),digital:'false'})]}));
add('AUDIT04','Missing printed-name policy and malformed boundaries',()=>snapshot(async e=>{const r=await audit(e);assert.equal(r.first_pass.excluded_by_reason.unresolved_missing_printed_name,1);assert.equal(r.first_pass.record_errors,3);assert.equal(r.first_pass.candidates,1);},{cards:[card(),card({id:uuid(2),lang:'de'}),card({id:uuid(3),lang:'de',printed_name:null}),card({id:uuid(4),lang:'de',card_faces:[null]}),card({id:uuid(5),lang:'de',collector_number:{bad:true}})]}));
add('AUDIT05','Duplicate equality versus identity conflict',()=>snapshot(async e=>{const r=await audit(e);assert.equal(r.first_pass.candidates,1);assert.equal(r.first_pass.identical_duplicates,1);assert.equal(r.first_pass.identity_conflicts,1);assert.equal(r.first_pass.record_errors,0);assert.equal(r.snapshot_compatible,false);},{cards:[card(),card(),card({name:'Different Synthetic'})]}));
add('AUDIT06','Production reference and variant parity',()=>snapshot(async e=>{const r=await audit(e),p=await prepareAcquisition(e);assert.equal(r.snapshot_compatible,true);assert.equal(r.second_pass.variants,p.counts.accepted_variants);assert.equal(r.second_pass.records_examined,2);},{cards:[card(),card({id:uuid(2),variation:true,variation_of:fixture.card.id,frame_effects:['showcase'],illustration_id:uuid(9)})]}));
add('AUDIT07','Rejected reference means limited coverage',()=>snapshot(async e=>{const r=await audit(e);assert.equal(r.first_pass.record_errors,1);assert.equal(r.second_pass.uncheckable_dependencies,1);assert.equal(r.second_pass.reference_variant_errors,0);assert.equal(r.coverage.reference_coverage,'LIMITED_REJECTED_DEPENDENCIES');assert.equal(r.snapshot_compatible,false);},{cards:[card({name:null}),card({id:uuid(2),variation:true,variation_of:fixture.card.id,frame_effects:['showcase'],illustration_id:uuid(9)})]}));
add('AUDIT08','Global digest mismatch fails closed',()=>snapshot(async e=>{e.jsonl_sha256='0'.repeat(64);const r=await audit(e);assert.equal(r.audit_complete,false);assert.equal(r.snapshot_compatible,false);assert.equal(r.first_pass.records_observed,0);assert.equal(r.abort.contract_code,'acquisition_digest');}));
add('AUDIT09','Late malformed framing has no fake EOF',()=>snapshot(async e=>{const r=await audit(e);assert.equal(r.audit_complete,false);assert.equal(r.first_pass.records_observed,1);assert.equal(r.first_pass.eof,false);assert.equal(r.abort.next_record_ordinal,2);},{jsonl:JSON.stringify(card())+'\n\n',expected:2}));
add('AUDIT10','Deterministic replay and input immutability',()=>snapshot(async e=>{const a=await audit(e),b=await audit(e);assert.deepEqual(a,b);assert.equal(a.input_bindings.unchanged,true);assert.deepEqual(a.input_bindings.before,a.input_bindings.after);}));
add('AUDIT11','Static spaces, categories and serializer/bridge roundtrip',async()=>{
 let error;try{C.text(null);}catch(e){error=e;}const once=safeError(error,{phase:'prepare_cards',record_ordinal:7,external_id:uuid(7),record_sha256:'a'.repeat(64),counts:{record_count:7,accepted_cards:3,excluded:3,excluded_by_reason:{language:3}}});
 assert.equal(once.contract_code,'invalid_text');assert.equal(once.error_location_captured,true);assert.equal(once.error_class_captured,true);assert.equal(once.exact_predicate_captured,false);assert.equal(once.field_path,null);
 for(const value of [once,JSON.parse(JSON.stringify(once)),diagnosticBridgeError(once)])assert.deepEqual(safeError(value),once);
 assert.equal(safeError(diagnosticFailure(once)).contract_family,'TCG contract');
 for(const message of ['unknown field '+sentinel,'unsupported value '+sentinel]){const d=safeError(new TypeError('TCG contract: '+message));assert.equal(d.contract_code_status,'CATEGORY_ONLY');assert.ok(!JSON.stringify(d).includes(sentinel));}
 const unknown=safeError({name:'TypeError',contract_family:'TCG contract'});assert.deepEqual(safeError(diagnosticBridgeError(unknown)),unknown);assert.equal(unknown.contract_code_status,'UNKNOWN');reports.push({synthetic_serializer_roundtrip:once,unknown});
});
add('AUDIT12','Secret, path, arbitrary fields and payload redaction',()=>snapshot(async(e,parent)=>{
 const out=JSON.stringify(await audit(e));assert.ok(!out.includes(sentinel));assert.ok(!out.includes(parent));assert.ok(!out.includes('Synthetic Printing'));
 const d=safeError({name:sentinel,message:'TCG contract: '+sentinel,contract_code:sentinel,stack_location:'../'+sentinel+':1:1',stack:'Error\n at /secrets/'+sentinel+':1:1',field_path:sentinel,pg_table:sentinel},{phase:sentinel,excluded_by_reason:{[sentinel]:1}});assert.ok(!JSON.stringify(d).includes(sentinel));
 let touched=false;safeError({get message(){touched=true;throw Error(sentinel);}});assert.equal(touched,false);
},{cards:[card({name:null,unconsumed:{secret:sentinel}})]}));
add('AUDIT13','Cleanup and diagnostic failures preserve primary error',()=>snapshot(async e=>{
 let original;try{C.text(null);}catch(x){original=x;}const d=await captureDiagnostic(original,{phase:'prepare_cards'},()=>{throw Error(sentinel);});assert.equal(d.primary.contract_code,'invalid_text');assert.ok(d.diagnostic_error);assert.ok(!JSON.stringify(d).includes(sentinel));
 const events=[];let caught;try{await ingestAcquisition({envelope:e,finish:async()=>{throw Error(sentinel);}},{client:{query:()=>{throw Error('DB must not run');}},onDiagnostic:x=>events.push(x)});}catch(x){caught=x;}
 assert.equal(safeError(caught).contract_code,'invalid_text');assert.equal(events.filter(x=>x.checkpoint==='cleanup_failure').length,1);assert.ok(!JSON.stringify(events).includes(sentinel));
 const r=await audit(e,{onDiagnostic:()=>{throw Error(sentinel);}});assert.equal(r.first_pass.record_errors,1);assert.equal(r.secondary_diagnostic_count,1);assert.equal(r.audit_complete,true);
},{cards:[card({name:null})]}));
add('AUDIT14','Full error counters with bounded examples',()=>snapshot(async e=>{const r=await audit(e,{limits:{max_examples:2}});assert.equal(r.first_pass.record_errors,31);assert.equal(r.examples.length,1);assert.equal(r.examples_omitted,30);assert.equal(Object.values(r.error_classes).reduce((a,b)=>a+b,0),31);assert.equal(r.first_pass.records_observed,31);},{cards:Array.from({length:31},(_,i)=>card({id:uuid(i+1),name:null}))}));
add('AUDIT15','Resource and file failures abort without deleting inputs',()=>snapshot(async e=>{
 const r=await audit(e,{limits:{max_index_bytes:1}});assert.equal(r.audit_complete,false);assert.equal(r.snapshot_compatible,false);assert.equal(r.abort.contract_code,'resource_limit');assert.equal(r.first_pass.unclassified,1);assert.equal(r.cleanup.audit_index_removed,true);assert.equal(r.input_bindings.unchanged,true);
 const missing=await audit({...e,jsonl_file:join(dirname(e.jsonl_file),'missing')});assert.equal(missing.audit_complete,false);assert.equal(missing.cleanup.audit_index_created,false);
}));
add('AUDIT16','Production pagination and path checks',()=>snapshot(async(e,parent)=>{
 const bad=clone(e);bad.pages[1].order=1;const r=await audit(bad);assert.equal(r.abort.contract_code,'sets_order');assert.equal(r.audit_complete,false);
 const link=join(parent,'alias.jsonl');await symlink(e.jsonl_file,link);const x=await audit({...e,jsonl_file:link});assert.equal(x.audit_complete,false);assert.equal(x.cleanup.audit_index_created,false);
}));
add('AUDIT17','Unused set diagnostics do not change import decision',()=>snapshot(async e=>{const r=await audit(e);assert.equal(r.sets.unused_translation_errors,1);assert.equal(r.snapshot_compatible,true);assert.equal((await prepareAcquisition(e)).counts.accepted_cards,1);},{pages:[clone(fixture.pages[0]),{...fixture.pages[1],raw:JSON.stringify({object:'list',has_more:false,data:[{...fixture.set,id:uuid(99),name:null}]})}]}));
add('AUDIT18','Executable CLI emits diagnostic files only',()=>snapshot(async(e,parent)=>{
 const envelopeFile=join(parent,'envelope.json'),output=join(parent,'report');await writeFile(envelopeFile,JSON.stringify(e));assert.equal(await auditCLI(['--envelope',envelopeFile,'--output',output]),0);
 assert.deepEqual((await readdir(output)).sort(),['audit-report.json','error-classes.json','reproduction.json']);for(const p of await readdir(output)){const text=await readFile(join(output,p),'utf8');assert.ok(!text.includes(parent));assert.ok(!text.includes(sentinel));assert.ok(!text.includes('stage_header'));}
 await assert.rejects(auditCLI(['--envelope',envelopeFile,'--output',output]),/output_exists/);
}));
add('AUDIT19','Import inertness and no client/publisher/transport calls',async()=>{
 const code=await readFile(new URL('./tcg-i3-magic-source-snapshot-audit.mjs',import.meta.url),'utf8');assert.ok(!/\b(?:fetch|runRealSourceAcceptance|ingestAcquisition|publishPrepared|createScryfallSource)\s*\(/.test(code));assert.ok(!/from ['"](?:pg|@electric-sql)/.test(code));
 const output=execFileSync(process.execPath,['--input-type=module','-e',`import {forbidExternalIO} from './tests/helpers/tcg-i3-magic-source-fixture.mjs';const io=forbidExternalIO();await import('./tcg-catalog-diagnostics-v1.mjs');await import('./tests/tcg-i3-magic-source-snapshot-audit.mjs');console.log(JSON.stringify({attempts:io.attempts(),import_only:true}));io.restore();`],{encoding:'utf8'});assert.deepEqual(JSON.parse(output),{attempts:0,import_only:true});
});
add('AUDIT20','Count mismatch incomplete, excluded-only incompatible',async()=>{
 await snapshot(async e=>{e.record_count++;const r=await audit(e);assert.equal(r.audit_complete,false);assert.equal(r.first_pass.eof,true);assert.equal(r.abort.contract_code,'record_count');});
 await snapshot(async e=>{const r=await audit(e);assert.equal(r.audit_complete,true);assert.equal(r.snapshot_compatible,false);assert.equal(r.first_pass.excluded,1);},{cards:[card({digital:true})]});
});
add('AUDIT21','UTF8, duplicate JSON keys and line resource failures are global',async()=>{
 for(const jsonl of ['{"object":"card","id":"one","id":"two"}\n','\ufeff'+JSON.stringify(card())+'\n',JSON.stringify(card())+'\n'+'x'.repeat(1048577)])await snapshot(async e=>{const r=await audit(e);assert.equal(r.audit_complete,false);assert.equal(r.snapshot_compatible,false);assert.equal(r.first_pass.eof,false);},{jsonl,expected:2});
});
add('AUDIT22','Reject-report diagnostics fail safely before cleanup',()=>snapshot(async e=>{
 const events=[],fs=createRequire(import.meta.url)('node:fs');let original;
 try{await prepareAcquisition(e,{snapshot_id:fixture.snapshot_id,onDiagnostic:event=>{events.push(event);if(event.checkpoint==='prepare_cards_start'){for(const file of ['safe-diagnostic.json','reject-report.json'])fs.mkdirSync(join(dirname(e.jsonl_file),'prepared-'+fixture.snapshot_id,file));}}});}catch(error){original=error;}
 assert.equal(safeError(original).contract_code,'invalid_text');assert.ok(events.find(e=>e.checkpoint==='prepare_diagnostic').diagnostic_error);assert.ok(events.find(e=>e.checkpoint==='diagnostic_failure'));assert.ok(!JSON.stringify(events).includes(sentinel));
},{cards:[card({name:null,unconsumed:{secret:sentinel}})]}));
add('AUDIT23','Six safe stack locations; unknown family and SQL code preserved',()=>{
 const e={name:'DatabaseError',code:'23505',contract_family:'TCG contract',stack_positions:Array.from({length:10},(_,i)=>'tcg-v1-contracts.js:'+(i+1)+':1')};
 const d=safeError(e);assert.equal(d.stack_positions.length,6);assert.equal(d.contract_code_status,'UNKNOWN');assert.deepEqual(safeError(diagnosticBridgeError(d)),d);assert.deepEqual(safeError(diagnosticFailure(d)),d);
});
add('AUDIT24','Live runner retains Before, After and After-failure evidence and imports inertly',async()=>{
 const source=await readFile(new URL('./tcg-i3-magic-source-live-acceptance.mjs',import.meta.url),'utf8');
 assert.match(source,/foundationEvidence=\{before:null,after:null,after_failure:null\}/);assert.match(source,/Object.assign\(foundationEvidence,\{before\}\)/);assert.match(source,/Object.assign\(foundationEvidence,\{after:proof.release\}\)/);assert.match(source,/Object.assign\(foundationEvidence,\{after_failure:await foundationProof/);
 const runner=await import('./tcg-i3-magic-source-live-acceptance.mjs');const d=runner.safeError(new TypeError('TCG contract: invalid text'));assert.equal(runner.safeError(runner.diagnosticBridgeError(d)).contract_code,'invalid_text');
});
add('AUDIT25','Stream failures never borrow the previous record identity or digest',async()=>{
 for(const suffix of ['\n','{broken}\n','x'.repeat(1048577)])await snapshot(async e=>{
  const r=await audit(e);assert.equal(r.first_pass.records_observed,1);assert.equal(r.first_pass.candidates,1);assert.equal(r.first_pass.eof,false);assert.equal(r.abort.next_record_ordinal,2);assert.equal(r.abort.failure_context,'STREAM_OR_GLOBAL');
  for(const k of ['record_ordinal','external_id','record_sha256'])assert.equal(r.abort[k]??null,null);
  assert.equal(r.abort.last_processed_record.record_ordinal,1);assert.equal(r.abort.last_processed_record.external_id,fixture.card.id);assert.ok(r.abort.last_processed_record.record_sha256);
  const events=[];await assert.rejects(prepareAcquisition(e,{onDiagnostic:x=>events.push(x)}));const d=events.find(x=>x.checkpoint==='prepare_diagnostic').diagnostic;
  assert.equal(d.processed_count,1);assert.equal(d.last_external_id,fixture.card.id);assert.equal(d.record_sha256??null,null);assert.equal(d.record_ordinal??null,null);
 },{jsonl:JSON.stringify(card())+'\n'+suffix,expected:2});
});
add('AUDIT26','Delivered record and processing resource failure retain their own binding',async()=>{
 await snapshot(async e=>{const r=await audit(e),d=r.examples[0];assert.equal(d.record_ordinal,2);assert.equal(d.external_id,uuid(2));assert.ok(d.record_sha256);assert.equal(r.first_pass.eof,true);},{cards:[card(),card({id:uuid(2),name:null})]});
 await snapshot(async e=>{const r=await audit(e,{limits:{max_index_bytes:1}});assert.equal(r.abort.failure_context,'DELIVERED_RECORD');assert.equal(r.abort.record_ordinal,1);assert.equal(r.abort.external_id,fixture.card.id);assert.ok(r.abort.record_sha256);assert.equal(r.abort.last_processed_record,null);assert.equal(r.abort.next_record_ordinal,2);assert.equal(r.first_pass.unclassified,1);assert.equal(r.first_pass.eof,false);});
});
add('AUDIT27','Late classes obtain deterministic representatives after many repeated failures',()=>snapshot(async e=>{
 const repeats=[];for(let i=0;i<2;i++)repeats.push(await audit(e));const [r,again]=repeats;assert.deepEqual(r,again);assert.equal(r.first_pass.record_errors,33);assert.equal(r.examples.length,3);assert.deepEqual(r.examples.map(x=>x.record_ordinal),[1,32,33]);assert.equal(r.example_coverage.complete,true);assert.equal(r.examples_omitted,30);assert.equal(Object.values(r.error_classes).reduce((a,b)=>a+b,0),33);assert.equal(r.first_pass.eof,true);
 for(const x of r.examples){assert.ok(x.external_id);assert.ok(x.record_sha256);}
 const limited=await audit(e,{limits:{max_examples:2}});assert.equal(limited.audit_complete,true);assert.equal(limited.snapshot_compatible,false);assert.equal(limited.example_coverage.classes_without_example,1);assert.equal(limited.example_coverage.complete,false);assert.equal(limited.examples.length,2);assert.deepEqual(limited.error_classes,r.error_classes);assert.equal(limited.examples_omitted,31);
},{cards:[...Array.from({length:31},(_,i)=>card({id:uuid(i+1),name:null})),card({id:uuid(32),digital:'false'}),card({id:uuid(33),rarity:'unsupported'})]}));
add('AUDIT28','Mandatory pre-invocation write failure blocks invocation',async()=>{
 const {requiredEvidenceGate}=await import('./tcg-i3-magic-source-live-acceptance.mjs');const ledger={},gate=requiredEvidenceGate(ledger,async()=>{throw Object.assign(Error(sentinel),{code:'EACCES'});});let invoked=0;
 await gate.persist('before',{});try{gate.requireEvidence(['before']);invoked++;}catch(error){assert.equal(error.evidenceFailure,true);assert.equal(safeError(error).contract_code,'required_evidence_missing');}assert.equal(invoked,0);assert.ok(!JSON.stringify(ledger).includes(sentinel));reports.push({synthetic_preinvocation_write_failure:ledger,invoked});
});
add('AUDIT29','Required snapshot foundation cleanup and final ledger writes gate acceptance',async()=>{
 const {requiredEvidenceGate}=await import('./tcg-i3-magic-source-live-acceptance.mjs');
 for(const failure of ['snapshot','foundation','cleanup','ledger',null]){
  const ledger={i18_status:'PASS'},stored={},emitted=[],gate=requiredEvidenceGate(ledger,async(p,v)=>{if(p===failure)throw Object.assign(Error(sentinel),{code:'ENOSPC'});stored[p]=JSON.parse(JSON.stringify(v));});
  for(const p of ['snapshot','foundation','cleanup'])await gate.persist(p,{synthetic:true});
  const code=await gate.finalize({path:'ledger',required:['snapshot','foundation','cleanup'],productSucceeded:true,cleanupSucceeded:true,requestCount:1,emit:v=>emitted.push(JSON.parse(JSON.stringify(v)))});
  assert.equal(code,failure?1:0);assert.equal(ledger.real_source_acceptance,!failure);assert.equal(ledger.product_operation.status,'PASS');assert.equal(emitted.length,1);assert.equal(emitted[0].real_source_acceptance,!failure);if(failure)assert.ok(!JSON.stringify(emitted).includes('M5_P1_PASS'));if(failure==='ledger')assert.equal(stored.ledger,undefined);
  reports.push({synthetic_required_write_failure:failure,code,ledger,emitted});
 }
});
add('AUDIT30','Product failure remains primary alongside write and cleanup failure',async()=>{
 const {requiredEvidenceGate}=await import('./tcg-i3-magic-source-live-acceptance.mjs');const ledger={},gate=requiredEvidenceGate(ledger,async p=>{if(p==='snapshot')throw Error(sentinel);}),product=safeError(new TypeError('TCG contract: invalid text'));
 await gate.persist('snapshot',{});await gate.persist('cleanup',{});const emitted=[];const code=await gate.finalize({path:'ledger',required:['snapshot','cleanup'],productFailure:product,cleanupSucceeded:false,requestCount:1,emit:v=>emitted.push(v)});
 assert.equal(code,1);assert.deepEqual(ledger.product_operation.failure,product);assert.equal(ledger.product_operation.status,'FAIL');assert.equal(ledger.real_source_acceptance,false);assert.equal(ledger.diagnostic_errors.length,1);assert.ok(!JSON.stringify(ledger).includes(sentinel));reports.push({synthetic_product_and_write_failure:ledger});
});
add('AUDIT31','Missing proof sticky write failure and unsuccessful cleanup cannot pass',async()=>{
 const {requiredEvidenceGate}=await import('./tcg-i3-magic-source-live-acceptance.mjs');
 for(const mode of ['missing','sticky','cleanup']){
  const ledger={},emitted=[];let writes=0;const gate=requiredEvidenceGate(ledger,async()=>{if(mode==='sticky'&&writes++===0)throw Error(sentinel);});
  if(mode!=='missing')await gate.persist('proof',{});if(mode==='sticky')await gate.persist('proof',{});
  const code=await gate.finalize({path:'ledger',required:['proof'],productSucceeded:true,cleanupSucceeded:mode!=='cleanup',requestCount:1,emit:v=>emitted.push(v)});
  assert.equal(code,1);assert.equal(ledger.real_source_acceptance,false);assert.equal(ledger.product_operation.status,'PASS');assert.equal(ledger.required_evidence_complete,mode==='cleanup');assert.equal(emitted.length,1);reports.push({synthetic_write_or_cleanup_failure:mode,ledger,code});
 }
});

// P4 subcases retain every AUDIT01–31 assertion. Fixtures are synthetic only.
const faceScopeReason='unresolved_face_count_outside_initial_scope',policySubcases=[];
const manyFaces=(count=3,extra={})=>card({id:uuid(70),layout:'split',card_faces:Array.from({length:count},(_,i)=>({name:'Synthetic face '+i})),...extra});
const extendPolicy=(id,run)=>{const t=tests.find(t=>t.id===id),original=t.run;t.run=async()=>{await original();await run();};};
async function policyCase(id,run){try{const evidence=await run();policySubcases.push({id,synthetic:true,status:'PASS',...evidence});}catch(e){policySubcases.push({id,synthetic:true,status:'FAIL',error:safeError(e)});throw e;}}
extendPolicy('AUDIT01',async()=>{
 for(const layout of ['split','flip','adventure','transform','modal_dfc'])for(const n of [3,4,5])await policyCase('P4_AUDIT_'+layout+'_'+n,()=>snapshot(async e=>{
  const r=await audit(e),p=await prepareAcquisition(e);assert.equal(r.audit_complete,true);assert.equal(r.snapshot_compatible,true);assert.equal(r.first_pass.eof,true);assert.equal(r.first_pass.records_observed,3);assert.equal(r.first_pass.candidates,2);assert.equal(r.first_pass.excluded,1);assert.equal(r.first_pass.record_errors,0);assert.deepEqual(r.first_pass.excluded_by_reason,{[faceScopeReason]:1});assert.deepEqual(r.first_pass.excluded_by_reason,p.counts.excluded_by_reason);assert.equal(r.first_pass.candidates,p.counts.accepted_cards);assert.equal(r.second_pass.records_examined,2);assert.equal(r.second_pass.variants,p.counts.accepted_variants);assert.equal(r.input_bindings.unchanged,true);assert.equal(r.cleanup.audit_index_removed,true);
  return {first_pass:r.first_pass,second_pass:r.second_pass,import_counts:p.counts};
 },{cards:[card(),manyFaces(n,{layout}),card({id:uuid(71),oracle_id:uuid(171)})]}));
});
const malformedFaceCases=[
 ...[null,42,'','bad\u0001name'].map((name,i)=>['FACE_NAME_'+i,{card_faces:[{name},{name:'b'},{name:'c'}]}]),
 ['ROOT_NAME',{name:null}],['ROOT_PRINTED',{printed_name:null}],['FACE_PRINTED',{card_faces:[{name:'a',printed_name:''},{name:'b'},{name:'c'}]}],
 ['FACE_NULL',{card_faces:[null,{name:'b'},{name:'c'}]}],['FACE_ARRAY',{card_faces:[[],{name:'b'},{name:'c'}]}],
 ['ROOT_UUID',{id:'bad'}],['SET_UUID',{set_id:'bad'}],['ORACLE_UUID',{oracle_id:'bad'}],['ILLUSTRATION_UUID',{illustration_id:'bad'}],['VARIATION_UUID',{variation_of:'bad'}],
 ['FACE_UUID',{card_faces:[{name:'a',oracle_id:'bad'},{name:'b'},{name:'c'}]}],
 ['ROOT_IMAGE',{image_uris:{normal:'http://example.invalid/a'}}],['FACE_IMAGE',{card_faces:[{name:'a',image_uris:[]},{name:'b'},{name:'c'}]}],['IMAGE_STATUS',{image_status:'bad'}],
 ['COLLECTOR_AMBIGUOUS',{collector_number:'243 244'}],['COLLECTOR_NO_MATCH',{collector_number:' 243'}],['COLLECTOR_LONG',{collector_number:'x'.repeat(129)}],
 ['MISSING_SET',{set_id:uuid(777)}],['SET_CONFLICT',{set:'wrong'}],['SET_NAME_CONFLICT',{set_name:'wrong'}],
 ['RARITY',{rarity:'invalid'}],['FINISH_EMPTY',{finishes:[]}],['FINISH_DUPLICATE',{finishes:['foil','foil']}],['FINISH_CODE',{finishes:['bad']}],['FINISH_NULL',{finishes:null}],
 ['DIGITAL_TYPE',{digital:'false'}],['OVERSIZED_TYPE',{oversized:0}],['GAMES_DUPLICATE',{games:['paper','paper']}],
 ['DATE_INVALID',{released_at:'2025-02-29'}],['DATE_TYPE',{released_at:1}],['VARIATION_TYPE',{variation:1}],['REPRINT_TYPE',{reprint:'false'}],['FULL_ART_TYPE',{full_art:0}],
 ['FRAME_CODE',{frame:'BAD'}],['BORDER_CODE',{border_color:'x'.repeat(33)}],['FRAME_EFFECTS_NULL',{frame_effects:null}],['PROMO_DUPLICATE',{promo_types:['promo','promo']}],['PROMO_LIMIT',{promo_types:Array.from({length:33},(_,i)=>'p'+i)}]
];
extendPolicy('AUDIT02',async()=>{
 for(const [name,extra] of malformedFaceCases)await policyCase('P4_AUDIT_REJECT_'+name,()=>snapshot(async e=>{
  const r=await audit(e);assert.equal(r.audit_complete,true);assert.equal(r.first_pass.eof,true);assert.equal(r.first_pass.candidates,2);assert.equal(r.first_pass.excluded,0);assert.equal(r.first_pass.record_errors,1);assert.equal(r.snapshot_compatible,false);assert.equal(r.first_pass.records_observed,3);return {first_pass:r.first_pass,error_classes:r.error_classes};
 },{cards:[card(),manyFaces(3,extra),card({id:uuid(71)})]}));
 await policyCase('P4_MIXED_CONTINUE_AND_FAIL_CLOSED',()=>snapshot(async e=>{
  const r=await audit(e);assert.equal(r.audit_complete,true);assert.equal(r.first_pass.records_observed,7);assert.equal(r.first_pass.candidates,2);assert.equal(r.first_pass.excluded,1);assert.equal(r.first_pass.record_errors,4);assert.equal(r.snapshot_compatible,false);assert.equal(r.coverage.all_predicates_per_record,false);
  const events=[];await assert.rejects(prepareAcquisition(e,{onDiagnostic:d=>events.push(d)}),/invalid text/);const d=events.find(x=>x.checkpoint==='prepare_diagnostic').diagnostic;assert.equal(d.processed_count,4);assert.equal(d.counts.excluded,1);return {first_pass:r.first_pass,first_import_reject:d};
 },{cards:[card(),manyFaces(),card({id:uuid(71)}),card({id:uuid(72),name:null}),manyFaces(4,{id:uuid(73),printed_name:null}),card({id:uuid(74),rarity:'invalid'}),card({id:uuid(75),digital:'false'})]}));
});
extendPolicy('AUDIT05',async()=>{
 await policyCase('P4_EXCLUDED_DUPLICATE_AND_CONFLICT',()=>snapshot(async e=>{const r=await audit(e);assert.equal(r.audit_complete,true);assert.equal(r.first_pass.identical_duplicates,1);assert.equal(r.first_pass.identity_conflicts,1);assert.equal(r.first_pass.excluded,1);assert.equal(r.first_pass.candidates,1);assert.equal(r.first_pass.records_observed,4);assert.equal(r.snapshot_compatible,false);await assert.rejects(prepareAcquisition(e),/identity_conflict/);return {first_pass:r.first_pass};},{cards:[card(),manyFaces(),manyFaces(),manyFaces(3,{name:'Different Synthetic'})]}));
});
extendPolicy('AUDIT07',async()=>{
 const variant=card({id:uuid(71),layout:'split',variation:true,variation_of:uuid(70),frame_effects:['showcase'],card_faces:[{name:'a',illustration_id:uuid(9)},{name:'b',illustration_id:uuid(10)}]});
 await policyCase('P4_NO_EXCLUDED_REFERENCE',()=>snapshot(async e=>{const r=await audit(e),p=await prepareAcquisition(e);assert.equal(r.first_pass.excluded,1);assert.equal(r.second_pass.without_reference,1);assert.equal(r.second_pass.variants,0);assert.equal(p.counts.accepted_variants,0);assert.equal(r.second_pass.records_examined,1);assert.ok(!(await readFile(p.files.records,'utf8')).includes(uuid(70)+'","locale"'));return {second_pass:r.second_pass,coverage:r.coverage};},{cards:[manyFaces(),variant]}));
 await policyCase('P4_REJECTED_DEPENDENCY_STILL_LIMITED',()=>snapshot(async e=>{const r=await audit(e);assert.equal(r.first_pass.record_errors,1);assert.equal(r.first_pass.excluded,1);assert.equal(r.second_pass.uncheckable_dependencies,1);assert.equal(r.coverage.reference_coverage,'LIMITED_REJECTED_DEPENDENCIES');assert.equal(r.snapshot_compatible,false);return {second_pass:r.second_pass,coverage:r.coverage};},{cards:[manyFaces(),card({id:uuid(72),name:null,layout:'split'}),variant]}));
});
extendPolicy('AUDIT20',()=>policyCase('P4_EXCLUDED_ONLY_NOT_COMPATIBLE',()=>snapshot(async e=>{const r=await audit(e);assert.equal(r.audit_complete,true);assert.equal(r.first_pass.eof,true);assert.equal(r.first_pass.excluded,1);assert.equal(r.first_pass.candidates,0);assert.equal(r.snapshot_compatible,false);await assert.rejects(prepareAcquisition(e),/record_count/);return {first_pass:r.first_pass,second_pass:r.second_pass};},{cards:[manyFaces()]})));

const io=forbidExternalIO(),ledger={policy_subcases:policySubcases,contract:'TCG-I3-M5-P1-R5-R1-AUDIT-tests',synthetic:true,cases:[],provider_requests:0,live_invocations:0,database_publications:0};
try{
 for(const t of tests){try{await t.run();ledger.cases.push({id:t.id,name:t.name,status:'PASS'});console.log('PASS '+t.id+' '+t.name);}catch(e){ledger.cases.push({id:t.id,name:t.name,status:'FAIL',error:safeError(e)});console.error('FAIL '+t.id+' '+e.stack);}}
 ledger.forbidden_external_io_attempts=io.attempts();ledger.counts={PASS:ledger.cases.filter(x=>x.status==='PASS').length,FAIL:ledger.cases.filter(x=>x.status==='FAIL').length};assert.equal(JSON.stringify(reports).includes(sentinel),false);ledger.export_redaction_pass=true;
 if(process.env.TCG_AUDIT_EVIDENCE_DIR){await mkdir(process.env.TCG_AUDIT_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.TCG_AUDIT_EVIDENCE_DIR,'audit-test-ledger.json'),JSON.stringify(ledger,null,2)+'\n');await writeFile(join(process.env.TCG_AUDIT_EVIDENCE_DIR,'synthetic-audit-reports.json'),JSON.stringify(reports,null,2)+'\n');}
 console.log(JSON.stringify(ledger));if(ledger.counts.FAIL||io.attempts())process.exitCode=1;
}finally{io.restore();}
