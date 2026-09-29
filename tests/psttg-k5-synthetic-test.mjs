// Synthetic controlled contract adapters. Never import this file into an API.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHmac} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {publicationFixture} from './helpers/publication-hold-fixture.mjs';
import {read} from './helpers/security-schema-fixture.mjs';
const native=process.argv.includes('--native');
const db=native?await(await import('./helpers/f3-native-db.mjs')).createDatabase():new(await import('@electric-sql/pglite')).PGlite({extensions:{pgcrypto:(await import('@electric-sql/pglite/contrib/pgcrypto')).pgcrypto}});
const key=randomBytes(48).toString('base64'); // ephemeral; never emitted or persisted
const out={native,acceptance:false,passed:false,cases:[],simulation:'All channel, origin-mode and external-original evidence is a controlled synthetic contract peer; no live integration.'};
const q=(sql,args=[],c=db)=>c.query(sql,args);
const value=async(sql,args=[],c=db)=>(await q(sql,args,c)).rows[0]?.v;
const hash=async x=>value("select encode(sha256(convert_to($1::jsonb::text,'UTF8')),'hex') v",[JSON.stringify(x)]);
const check=async(name,f)=>{await f();out.cases.push(name);console.log('PASS',name)};
const deny=async(f,re=/k5_|psttg_|scope_granularity|permission denied/)=>{let e;try{await f()}catch(x){e=x}assert.ok(e,'expected rejection');assert.match(e.message,re)};
const call=(fn,args,c=db)=>value(`select dv_market_private.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) v`,args,c);
const scope=async(label=randomUUID(),c=db)=>call('psttg_ensure_scope',['subject',Buffer.from(await hash(label),'hex'),null,null],c);
const bind=async(s,mode='synthetic_test',options={})=>{
 const p={source_system:'isolated-contract-fixture',environment_id:'disposable-only',source_kind:'review',source_id:randomUUID(),source_version:'v1',source_digest:await hash({fixture:'selected-v1'}),operating_mode:mode,classification_basis:'isolated_fixture',attestation_payload:{contract_version:'fixture-v1',evidence_ref:'synthetic:'+randomUUID(),scope_digest:await hash(s)},attested_by:'controlled-fixture',producer_version:'fixture-v1',...options};
 return {id:await call('psttg_bind_origin',[p,[s],null]),p};
};
const append=(e,n,proof=null,c=db)=>call('psttg_append_event',[e,n,proof,key],c);
const payloadFor=cls=>({
 process_description:{period:'2026',procedures:['synthetic'],relationships:[],responsibilities:['fixture'],deadlines:['fixture'],applied_version:'v1',changes:[]},
 due_diligence:{inputs:{necessary_value:'synthetic-v1'},processing:'assessment',result:'synthetic-result',rule_version:'v1',reasons:['fixture'],processor:'fixture'},
 reported_information:{reported_information:{necessary_value:'synthetic-v1'},reporting_period:2026,submission_ref:'synthetic-submission',procedure:'fixture',transmission_status:'transmitted',acceptance_status:'not_yet_known'},
 provider_notice:{content:'synthetic complete notice',recipient_ref:'synthetic-recipient',channel:'contract-peer',notice_version:'v1',reporting_period:2026,delivery_meaning:'notified'},
 cooperation_event:{content:'synthetic complete request',reason:'fixture',subject_ref:'synthetic-subject',channel:'contract-peer',case_ref:'synthetic-case',measure_ref:'none',scope:'synthetic',lift_information:'not_applicable'}
}[cls]);
async function operation({s,origin,cls='due_diligence',subtype='assessment',basis='native_seal',year,instant,fragment,action,payloadOverride={}}={}){
 s??=await scope();origin??=await bind(s);
 action??={process_description:'process_document',due_diligence:'diligence',reported_information:'submission',provider_notice:'provider_notice_annual',cooperation_event:'cooperation_request'}[cls];
 const payload={...payloadFor(cls),source_fragments:{selected:{necessary_value:'synthetic-v1'}},...payloadOverride};
 if(fragment){payload.original_fragment=fragment;payload.correction_reason='synthetic correction';}
 const e={operation_id:randomUUID(),event_kind:'draft',action_kind:action,origin_id:origin.id,input_revision:'v1',input_digest:await hash(payload),input_ref:'synthetic-target',idempotency_key:randomUUID(),actor_ref:'controlled-fixture',producer_version:'fixture-v1',subject_scope_id:s};
 await append(e,0);e.event_kind='ready';await append(e,1,{input_snapshot:payload});e.event_kind='attempting';e.attempt_id=randomUUID();await append(e,2);
 const actual='2026-09-29T08:00:00.000Z';
 e.event_kind='executed_evidenced';e.actual_event_at=actual;
 const evidence={contract_version:'synthetic-channel-v1',operation_id:e.operation_id,input_digest:e.input_digest,target_ref:e.input_ref,meaning:action==='submission'?'transmitted':action.startsWith('provider_notice')?'notified':'performed',source_ref:'synthetic-receipt',actual_event_at:actual};
 let proof={};
 if(basis==='verified_external_original')proof={verified_year:year,precision:instant?'instant':'year',evidence_ref:'synthetic-original-proof',original_digest:e.input_digest,...(instant?{original_created_at:instant}:{})};
 if(basis==='unresolved')proof={clarification_ref:'synthetic-open-case',reason:'original creation unknown'};
 const cmd={record_class:cls,record_subtype:subtype,schema_version:'psttg-payload-v1',duty_holder_ref:'synthetic-operator',process_version:'v1',encryption_key_ref:'ephemeral-test-key',source_bindings:[{origin_id:origin.id,source_version:'v1',field_selector:'selected',source_digest:origin.p.source_digest,purpose:'required synthetic input',captured_fragment_digest:await hash(payload.source_fragments.selected)}],creation_basis:basis,creation_proof:proof,content_revision:'v1',capture_command_id:randomUUID(),reporting_period:2026};
 return {s,origin,payload,e,evidence,cmd,links:[],seq:3};
}
const seal=(x,c=db)=>call('seal_psttg_record',[x.cmd,x.e,x.seq,x.evidence,x.payload,key,JSON.stringify(x.links)],c);
const record=id=>value('select to_jsonb(r) v from dv_market_private.psttg_records r where record_id=$1',[id]);
const gen=s=>value('select generation::int v from dv_market_private.psttg_scope_guards where scope_id=$1',[s]);
async function external(year,opts={}){const s=opts.s??await scope(),origin=await bind(s,'synthetic_test',{source_kind:'external_record'});return operation({s,origin,action:'external_record_import',basis:'verified_external_original',year,...opts})}
const tables=['psttg_origin_bindings','psttg_operation_events','psttg_records','psttg_record_links','psttg_scope_guards','psttg_k5_channel_gate','psttg_k5_end_intent','psttg_k5_end_attempt','psttg_k5_evidence_receipt'];
const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,await value(`select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]')::text,'UTF8')),'hex') v from dv_market_private.${t} x`)])));
const unchangedDeny=async(f,re)=>{const before=await snapshot();await deny(f,re);assert.deepEqual(await snapshot(),before)};
const canonical=async(x,c=db)=>value('select $1::jsonb::text v',[JSON.stringify(x)],c);
const target=id=>({kind:'record',id,version:'v1',segments:['whole']});
const evaluate=(s,t,c=db)=>call('evaluate_psttg_removal',[[s],JSON.stringify(t)],c);
const intent=id=>value('select to_jsonb(i) v from dv_market_private.psttg_k5_end_intent i where intent_id=$1',[id]);
const peers=new Map();
const stable=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
// The peer remains OUTSIDE rollback/restore of the acceptance DB. It only
// appends simulated effects. Neither an object deletion nor a provider call
// exists. Its secret is random per run and is never emitted in evidence.
class Peer {
 constructor(channel,account,incarnation,secret){Object.assign(this,{channel,account,incarnation,secret});this.revoked=new Set();this.effects=new Map();this.receipts=new Map();this.quarantine=false;this.retired=new Set();this.targets=new Map();}
 async sign(body,c=db){return createHmac('sha256',this.secret).update(await canonical(body,c)).digest();}
 async ticket(command,c){if(this.quarantine)throw Error('k5_peer_restore_quarantine');const ticket={challenge:await call('psttg_k5_challenge',[],c),command_digest:await hashAt(command,c),incarnation:this.incarnation,channel:this.channel,contract:'synthetic-atomic-v1'};return [ticket,await this.sign(ticket,c)];}
 async dispatch(attempt,observer){
  // Read a committed registration using another connection; an uncommitted
  // RETURNING/SQL value does not authorize the controlled effect.
  const row=(await observer.query("select * from dv_market_private.psttg_k5_end_attempt where attempt_id=$1 and kind='DISPATCH_RECORDED'",[attempt])).rows[0];
  if(!row)throw Error('k5_uncommitted_dispatch');return row;
 }
 effect(token){
  // Final check and append execute synchronously as one atomic peer operation.
  const id=token.attempt_id;
  if(stable(this.targets.get(token.target.target.id))!==stable(token.target))throw Error('k5_peer_target_reused');
  if(this.quarantine||token.incarnation!==this.incarnation||this.revoked.has(id)||this.retired.has(JSON.stringify(token.target)))throw Error('k5_peer_stale_at_effect');
  if(this.effects.has(id))return this.effects.get(id);
  const effect={attempt:id,target:token.target,incarnation:token.incarnation,execution_epoch:Number(token.execution_epoch),operation:token.intent_id,result:'APPLIED_SIMULATED'};
  this.effects.set(id,effect);return effect;
 }
 async result(token,apply=true){
  let result;if(apply)result=this.effect(token);else {if(this.effects.has(token.attempt_id))throw Error('k5_already_applied');this.revoked.add(token.attempt_id);result={attempt:token.attempt_id,target:token.target,incarnation:token.incarnation,execution_epoch:Number(token.execution_epoch),operation:token.intent_id,result:'DEFINITELY_NOT_APPLIED'};}
  const body={source:'synthetic-atomic-v1',environment:'disposable-only',account:this.account,event_id:'result:'+token.attempt_id,...result,payload:{minimal:'synthetic-sensitive-result'},actual_event_at:new Date().toISOString()};
  if(this.receipts.has(body.event_id))return this.receipts.get(body.event_id);
  this.receipts.set(body.event_id,body);return body;
 }
 restore(){this.quarantine=true;this.incarnation=randomUUID();}
}
const hashAt=async(x,c)=>value("select encode(dv_market_private.psttg_k5_digest($1),'hex') v",[JSON.stringify(x)],c);
async function invoke(fn,command,c=db,{open=false,rollback=false}={}){
 if(!open)await c.query('begin');
 try{const [ticket,signature]=await peers.get(command.channel).ticket(command,c);const result=await call(fn,[command,ticket,signature,...(fn==='psttg_k5_admit'?[key]:[])],c);if(!open)await c.query(rollback?'rollback':'commit');return result;}
 catch(e){if(!open)await c.query('rollback');throw e;}
}
async function fixture({count=1,shared=false}={}){
 const x=await external(2000);const ids=[await seal(x)];for(let n=1;n<count;n++)ids.push(await seal(await external(2000,{s:x.s})));
 const channel=randomUUID(),account=randomUUID(),incarnation=randomUUID(),secret=randomBytes(48);
 await q("insert into dv_market_private.psttg_k5_channel_gate(channel_id,environment,account_ref,scope_ids,exclusive_scope,incarnation,verification_key,contract) values($1,'disposable-only',$2,$3,$4,$5,$6,'synthetic-atomic-v1')",[channel,account,[x.s],!shared,incarnation,secret]);
 const peer=new Peer(channel,account,incarnation,secret);peers.set(channel,peer);
 const assessment=await evaluate(x.s,ids.map(target));
 const manifest=[];for(const id of ids)manifest.push({target:target(id),incarnation:randomUUID(),action:'SIMULATE_ONLY',channel,version_digest:''});
 // pg bytea is a Buffer on native and Uint8Array in PGlite, not textual hex.
 for(let n=0;n<ids.length;n++)manifest[n].version_digest=await value("select encode(payload_digest,'hex') v from dv_market_private.psttg_records where record_id=$1",[ids[n]]);
 for(const m of manifest)peer.targets.set(m.target.id,m);
 const command={channel,intent_id:randomUUID(),command_id:randomUUID(),revision:1,scopes:[x.s],binding:assessment.binding,manifest,evidence:{coverage:'synthetic_manifest_only',other_obligations:'synthetic_fixture_only',channel:'synthetic-atomic-v1',purpose:'non_destructive_simulation'}};
 return {x,ids,channel,peer,command};
}
const authorize=f=>invoke('psttg_k5_authorize',f.command);
async function begin(f,n=0){const i=await intent(f.command.intent_id);const command={channel:f.channel,command_id:randomUUID(),intent_id:i.intent_id,revision:i.revision,state_revision:i.state_revision,attempt_id:randomUUID(),target:f.command.manifest[n]};await invoke('psttg_k5_begin',command);return command.attempt_id;}
async function transition(f,action,receipt_id=null){const i=await intent(f.command.intent_id);return invoke('psttg_k5_transition',{channel:f.channel,command_id:randomUUID(),intent_id:i.intent_id,revision:i.revision,state_revision:i.state_revision,action,receipt_id});}
async function receive(f,body,c=db,{open=false,rollback=false}={}){if(!open)await c.query('begin');try{const id=await call('psttg_k5_receive',[f.channel,body,await f.peer.sign(body,c),key],c);if(!open)await c.query(rollback?'rollback':'commit');return id;}catch(e){if(!open)await c.query('rollback');throw e;}}
const token=async id=>(await q("select * from dv_market_private.psttg_k5_end_attempt where attempt_id=$1 and kind='DISPATCH_RECORDED'",[id])).rows[0];
async function admission(f,copy=false){const x=f.x;let e;
 if(copy){e={...x.e,operation_id:randomUUID(),event_kind:'copy',action_kind:'copy',idempotency_key:randomUUID(),original_record_id:f.ids[0],original_version:'v1',artifact_id:'synthetic-copy'};delete e.actual_event_at;delete e.attempt_id;}
 else {e={...x.e,operation_id:randomUUID(),event_kind:'draft',idempotency_key:randomUUID()};delete e.actual_event_at;delete e.attempt_id;await append(e,0);e.event_kind='ready';}
 return {channel:f.channel,command_id:randomUUID(),scopes:[x.s],event:e,expected_sequence:copy?0:1,input:x.payload,requirements:[{kind:'origin',id:x.origin.id,version:'v1'},{kind:'record',id:f.ids[0],version:'v1'}]};
}
try{
 await publicationFixture(db);
 for(const f of ['publication-processing-hold-v1','battle-safety-sanctions-v1','account-deletion-withdrawal-v1','account-erasure-l1-v1'])await db.exec(await read('database/'+f+'.sql'));
 for(const f of ['psttg-capture-core-v1','psttg-removal-evaluation-v1','psttg-k5-synthetic-control-v1'])await db.exec(await readFile(new URL('../database/'+f+'.sql',import.meta.url),'utf8'));
 const protectedTables=(await q("select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname not in ('pg_catalog','information_schema') and n.nspname not like 'pg_%' and c.relname not like 'psttg_%' order by 1,2")).rows;
 const protectedSnapshot=async()=>({rows:await Promise.all(protectedTables.map(async t=>[t.nspname+'.'+t.relname,await value(`select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]')::text,'UTF8')),'hex') v from "${t.nspname}"."${t.relname}" x`)])),functions:(await q("select p.oid,prosrc,proacl::text,proowner,prosecdef,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname not in ('pg_catalog','information_schema') order by p.oid")).rows,rights:(await q("select c.oid,relacl::text,relowner,relrowsecurity,relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname not in ('pg_catalog','information_schema') order by c.oid")).rows});
 const protectedBefore=await protectedSnapshot();
 await check('K5-E20 private no-login owner, no application grants, no evidence cascades',async()=>{
  assert.equal(await value("select rolcanlogin v from pg_roles where rolname='dv_psttg_core_owner'"),false);
  for(const role of ['anon','authenticated','service_role']){assert.equal(await value("select count(*)::int v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and p.proname like 'psttg_%' and has_function_privilege($1,p.oid,'EXECUTE')",[role]),0);for(const t of tables)for(const p of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE'])assert.equal(await value('select has_table_privilege($1,$2,$3) v',[role,'dv_market_private.'+t,p]),false);}
  assert.equal(await value("select count(*)::int v from pg_constraint where contype='f' and conrelid='dv_market_private.psttg_k5_evidence_receipt'::regclass"),0);
 });
 await check('K5-E06 exact own fence transition, unchanged false reader and immutable core',async()=>{
  const f=await fixture();const before=await snapshot();await authorize(f);const after=await snapshot();for(const t of tables.slice(0,4))assert.equal(after[t],before[t]);
  const i=await intent(f.command.intent_id);assert.equal(i.state,'FENCED_READY');assert.equal(await gen(f.x.s),Number(i.before_binding.scope_states[0].generation)+1);
  const a=await evaluate(f.x.s,f.ids.map(target));assert.equal(a.removal_authorized,false);assert.equal(a.external_coverage_complete,false);assert.equal(a.other_obligations,'not_evaluated');assert.equal(a.core_coverage_complete,false);
  assert.equal(await authorize(f),i.intent_id);await begin(f);
  await unchangedDeny(()=>begin(f),/k5_unknown_no_retry/);
 });
 await check('K5-E20 shared scope, other obligations, segments, missing provenance and real action rejected invariantly',async()=>{
  const f=await fixture({shared:true});await unchangedDeny(()=>authorize(f),/scope_granularity/);
  for(const mutate of [c=>delete c.evidence.other_obligations,c=>c.manifest[0].action='DELETE',c=>c.manifest[0].target.segments=['field:'+'a'.repeat(64)],c=>c.binding.core_fingerprint='a'.repeat(64)]){const z=await fixture();mutate(z.command);await unchangedDeny(()=>authorize(z));}
  const z=await fixture();await unchangedDeny(()=>q('delete from dv_market_private.psttg_records where record_id=$1',[z.ids[0]]),/psttg_immutable/);
 });
 await check('K5-E01 E02 E03 admission and copy bind full need; generation alone insufficient',async()=>{
  for(const copy of [false,true]){const f=await fixture();const command=await admission(f,copy);f.command.binding=(await evaluate(f.x.s,f.ids.map(target))).binding;const g=await gen(f.x.s);await invoke('psttg_k5_admit',command);if(copy)assert.equal(await gen(f.x.s),g);await unchangedDeny(()=>authorize(f),/k5_stale_assessment/);}
  for(const copy of [false,true]){const f=await fixture();const command=await admission(f,copy);f.command.binding=(await evaluate(f.x.s,f.ids.map(target))).binding;await authorize(f);await unchangedDeny(()=>invoke('psttg_k5_admit',command),/psttg_scope_fenced/);}
 });
 await check('K5-E06 additional foreign O5 revision stops exact own-transition checker',async()=>{
  const f=await fixture();await authorize(f);await q('update dv_market_private.psttg_scope_guards set generation=generation+1 where scope_id=$1',[f.x.s]);await unchangedDeny(()=>begin(f),/k5_foreign_scope_change/);
 });
 await check('K5-E08 admission rollback and conflicting command are invariant',async()=>{
  const f=await fixture(),cmd=await admission(f);const before=await snapshot();await invoke('psttg_k5_admit',cmd,db,{rollback:true});assert.deepEqual(await snapshot(),before);const id=await invoke('psttg_k5_admit',cmd);assert.equal(await invoke('psttg_k5_admit',cmd),id);await unchangedDeny(()=>invoke('psttg_k5_admit',{...cmd,input:{changed:true}}),/k5_idempotency_conflict/);
 });
 await check('K5-E07 overlapping end intents cannot overwrite fence holder',async()=>{
  const f=await fixture();await authorize(f);const g={...f,command:{...f.command,intent_id:randomUUID(),command_id:randomUUID()}};await unchangedDeny(()=>authorize(g),/k5_stale_assessment/);
 });
 await check('K5-E08 E09 dispatch unknown and late result never permit blind retry',async()=>{
  const f=await fixture();await authorize(f);const id=await begin(f);await transition(f,'OUTCOME_UNKNOWN');await unchangedDeny(()=>begin(f),/k5_unknown_no_retry/);await unchangedDeny(()=>transition(f,'CANCELLED_SAFE'),/k5_unknown_no_retry/);
  const t=await token(id);f.peer.effect(t);const body=await f.peer.result(t);const receipt=await receive(f,body);await transition(f,'RECONCILE',receipt);assert.equal((await intent(f.command.intent_id)).state,'PARTIAL');await unchangedDeny(()=>transition(f,'CANCELLED_SAFE'),/k5_partial_no_reopen/);await transition(f,'CLOSED_VERIFIED');assert.equal((await intent(f.command.intent_id)).state,'CLOSED_VERIFIED');assert.equal(f.peer.effects.size,1);
 });
 await check('K5-E13 fully evidenced two-target synthetic manifest has exact O5 and journal changes',async()=>{
  const f=await fixture({count:2}),before=await snapshot();const original=await value('select to_jsonb(s) v from dv_market_private.psttg_scope_guards s where scope_id=$1',[f.x.s]);await authorize(f);
  for(let n=0;n<2;n++){const id=await begin(f,n);const receipt=await receive(f,await f.peer.result(await token(id)));await transition(f,'RECONCILE',receipt);}
  await transition(f,'CLOSED_VERIFIED');const i=await intent(f.command.intent_id);assert.equal(i.state_revision,6);assert.equal(i.state,'CLOSED_VERIFIED');
  const expected={...original,generation:original.generation+4,phase:'closed',fence_token:i.intent_id,fence_target_digest:'\\x'+await hash(f.command.manifest),fence_generation:original.generation+1,recovery_state:'none'};
  assert.deepEqual(await value('select to_jsonb(s) v from dv_market_private.psttg_scope_guards s where scope_id=$1',[f.x.s]),expected);
  assert.equal(await value('select count(*)::int v from dv_market_private.psttg_k5_end_attempt where intent_id=$1',[i.intent_id]),5);assert.equal(await value('select receipt_revision::int v from dv_market_private.psttg_k5_channel_gate where channel_id=$1',[f.channel]),2);
  const after=await snapshot();for(const t of tables.slice(0,4))assert.equal(after[t],before[t]);assert.equal(f.peer.effects.size,2);out.exact_transition_changes='O1-O4 unchanged; authorize +1 O5 generation, each applied reconciliation +1, close +1; expected full O5 row; two immutable receipts; five journal entries; intent state revision 6';
 });
 await check('K5-E11 E12 encrypted receipt rollback, committed replay and event conflict',async()=>{
  const f=await fixture();await authorize(f);const id=await begin(f),body=await f.peer.result(await token(id));const before=await snapshot();await receive(f,body,db,{rollback:true});assert.deepEqual(await snapshot(),before);
  const receipt=await receive(f,body);const snap=await snapshot();assert.equal(await receive(f,body),receipt);assert.deepEqual(await snapshot(),snap);
  assert.deepEqual(JSON.parse(await value('select extensions.pgp_sym_decrypt(payload_ciphertext,$2) v from dv_market_private.psttg_k5_evidence_receipt where receipt_id=$1',[receipt,key])),body.payload);
  assert.ok(!JSON.stringify(await value('select header v from dv_market_private.psttg_k5_evidence_receipt where receipt_id=$1',[receipt])).includes(body.payload.minimal));
  for(const b of [{...body,account:randomUUID()},{...body,environment:'live'},{...body,event_id:''}])await unchangedDeny(()=>receive(f,b),/k5_evidence_binding/);
  await unchangedDeny(()=>call('psttg_k5_receive',[f.channel,body,randomBytes(32),key]),/k5_unauthentic/);
  const conflict=await receive(f,{...body,payload:{minimal:'conflicting'}});assert.notEqual(conflict,receipt);await unchangedDeny(()=>transition(f,'RECONCILE',conflict),/k5_receipt_conflict/);await transition(f,'RECONCILE',receipt);assert.equal((await intent(f.command.intent_id)).state,'RECOVERY_REQUIRED');
 });
 await check('K5-E10 E13 partial manifest plus unmapped evidence stops only affected channel',async()=>{
  const f=await fixture({count:2});await authorize(f);const id=await begin(f);const receipt=await receive(f,await f.peer.result(await token(id)));await transition(f,'RECONCILE',receipt);await unchangedDeny(()=>transition(f,'CLOSED_VERIFIED'),/k5_manifest_incomplete/);
  const extra={source:'synthetic-atomic-v1',environment:'disposable-only',account:f.peer.account,event_id:randomUUID(),operation:null,attempt:null,target:null,incarnation:f.peer.incarnation,execution_epoch:0,result:'UNMAPPED',payload:{minimal:'new evidence'},actual_event_at:new Date().toISOString()};await receive(f,extra);await unchangedDeny(()=>begin(f,1),/k5_channel_stopped/);await transition(f,'RECOVERY_REQUIRED');
  const z=await fixture();await authorize(z);await begin(z);await unchangedDeny(()=>seal(f.x),/psttg_scope_fenced/);
 });
 await check('K5-E17 safe cancel requires definitive nonexecution and peer revocation',async()=>{
  const f=await fixture();await authorize(f);const id=await begin(f),t=await token(id);const receipt=await receive(f,await f.peer.result(t,false));await transition(f,'RECONCILE',receipt);await transition(f,'CANCELLED_SAFE');assert.equal(await value('select phase v from dv_market_private.psttg_scope_guards where scope_id=$1',[f.x.s]),'open');await deny(async()=>f.peer.effect(t),/k5_peer_stale_at_effect/);
 });
 await check('K5-E14 E15 E16 atomic simulated finalizer and unsafe precheck negative control',async()=>{
  const f=await fixture();await authorize(f);const id=await begin(f),t=await token(id);const precheck=!f.peer.revoked.has(id);assert.equal(precheck,true);await f.peer.result(t,false);await deny(async()=>f.peer.effect(t),/k5_peer_stale_at_effect/);
  const z2=await fixture();await authorize(z2);const id2=await begin(z2),t2=await token(id2);z2.peer.targets.set(t2.target.target.id,{...t2.target,incarnation:randomUUID()});await deny(async()=>z2.peer.effect(t2),/k5_peer_target_reused/);
  const unsafeEffects=[];if(precheck)unsafeEffects.push('unguarded-late-simulated-effect');assert.equal(unsafeEffects.length,1);out.unsafe_precheck_negative_control='a stale precheck permits an unguarded simulated effect; not a valid adapter';
  const z=await fixture();await q("update dv_market_private.psttg_k5_channel_gate set contract='unsupported' where channel_id=$1",[z.channel]);await unchangedDeny(()=>authorize(z),/k5_not_authorizable_channel/);
 });
 await check('K5-E18 restore quarantine survives DB rollback; ingress remains available',async()=>{
  const f=await fixture();await authorize(f);const id=await begin(f),t=await token(id),body=await f.peer.result(t);const receipt=await receive(f,body);f.peer.restore();await unchangedDeny(()=>begin(f),/k5_peer_restore_quarantine/);await deny(async()=>f.peer.effect(t),/k5_peer_stale_at_effect/);
  const notice={action:'RESTORE_QUARANTINE',channel:f.channel,external_incarnation:f.peer.incarnation};await db.exec('begin');await call('psttg_k5_quarantine',[f.channel,notice,await f.peer.sign(notice)]);await db.exec('rollback');assert.equal(f.peer.quarantine,true);await unchangedDeny(async()=>invoke('psttg_k5_admit',{...(await admission(f,true))}),/k5_peer_restore_quarantine/);
  await call('psttg_k5_quarantine',[f.channel,notice,await f.peer.sign(notice)]);assert.equal((await intent(f.command.intent_id)).state,'RESTORE_QUARANTINE');assert.equal(await receive(f,body),receipt);
 });
 await check('K5-E19 ingress purpose is explicit; time alone performs no deletion or extension',async()=>{
  assert.equal(await value("select count(*)::int v from dv_market_private.psttg_k5_evidence_receipt where purpose<>'synthetic_result_reconciliation' or end_condition<>'verified_transfer_and_no_remaining_dependency'"),0);
  await unchangedDeny(()=>db.exec('delete from dv_market_private.psttg_k5_evidence_receipt'),/psttg_immutable/);out.ingress_physical_minimization='OPEN: no deletion function implemented; purpose condition only';
 });
 if(native){
  async function race(name,first,second,verify){await check(name,async()=>{const c1=await db.connect(),c2=await db.connect();const p1=await value('select pg_backend_pid() v',[],c1),p2=await value('select pg_backend_pid() v',[],c2);await c1.query('begin');await first(c1);let done=false;const pending=second(c2).then(v=>({v}),error=>({error})).finally(()=>done=true);let blockers=[];for(let n=0;n<150;n++){blockers=await value('select pg_blocking_pids($1) v',[p2]);if(blockers.includes(p1))break;await new Promise(r=>setTimeout(r,10));}assert.ok(blockers.includes(p1));assert.equal(done,false);await c1.query('commit');await verify(await pending);out.locks??=[];out.locks.push({name,holder:p1,waiter:p2,blockers});});}
  for(const copy of [false,true])for(const first of ['writer','fence']){const f=await fixture(),a=await admission(f,copy);f.command.binding=(await evaluate(f.x.s,f.ids.map(target))).binding;
   await race('K5-E01 E02 E03 '+(copy?'copy':'admission')+' '+first+' first',c=>first==='writer'?invoke('psttg_k5_admit',a,c,{open:true}):invoke('psttg_k5_authorize',f.command,c,{open:true}),c=>first==='writer'?invoke('psttg_k5_authorize',f.command,c):invoke('psttg_k5_admit',a,c),r=>assert.match(r.error?.message??'',first==='writer'?/k5_stale_assessment/:/psttg_scope_fenced/));
  }
  for(const kind of ['seal','origin','link','operation'])for(const first of ['writer','fence']){
   const f=await fixture();let writer;
   if(kind==='origin')writer=c=>call('psttg_bind_origin',[{...f.x.origin.p,classification_reason:'synthetic revision'},[f.x.s],f.x.origin.id],c);
   else if(kind==='operation'){const e={...f.x.e,event_kind:'accepted',external_event_id:randomUUID()};writer=c=>append(e,4,{...f.x.evidence,meaning:'accepted'},c);}
   else {const x=structuredClone(f.x);x.e.operation_id=randomUUID();x.e.idempotency_key=randomUUID();x.e.attempt_id=randomUUID();x.cmd.capture_command_id=randomUUID();
    if(kind==='link'){x.cmd.record_subtype='correction';x.payload.original_fragment={necessary_value:'synthetic-v1'};x.payload.correction_reason='synthetic';x.e.input_digest=await hash(x.payload);x.cmd.creation_proof.original_digest=x.e.input_digest;x.evidence.input_digest=x.e.input_digest;x.links=[{link_kind:'corrects',to_record_id:f.ids[0],target_version:'v1',required_fields:['necessary_value'],purpose_code:'synthetic',embedded_fragment_digest:await hash(x.payload.original_fragment)}];}
    x.evidence.operation_id=x.e.operation_id;
    writer=async c=>{const draft={...x.e,event_kind:'draft'};delete draft.attempt_id;delete draft.actual_event_at;await append(draft,0,null,c);await append({...draft,event_kind:'ready'},1,{input_snapshot:x.payload},c);await append({...draft,event_kind:'attempting',attempt_id:x.e.attempt_id},2,null,c);return seal(x,c);};
   }
   const writeTx=async c=>{await c.query('begin');try{const r=await writer(c);await c.query('commit');return r;}catch(e){await c.query('rollback');throw e;}};
   await race('K5-E04 '+kind+' '+first+' first',c=>first==='writer'?writer(c):invoke('psttg_k5_authorize',f.command,c,{open:true}),c=>first==='writer'?invoke('psttg_k5_authorize',f.command,c):writeTx(c),r=>assert.match(r.error?.message??'',first==='writer'?/k5_stale_assessment/:/psttg_scope_fenced/));
  }
  {const f=await fixture(),extra=await scope();await race('K5-E05 scope grows while waiting',c=>call('psttg_bind_origin',[{...f.x.origin.p,source_id:randomUUID()},[f.x.s,extra].sort(),null],c),c=>invoke('psttg_k5_authorize',f.command,c),r=>{assert.equal(r.error?.code,'40001');assert.match(r.error.message,/scope_growth_retry/);});}
  for(const first of ['ingress','dispatch']){
   const f=await fixture();await authorize(f);const i=await intent(f.command.intent_id);const cmd={channel:f.channel,command_id:randomUUID(),intent_id:i.intent_id,revision:i.revision,state_revision:i.state_revision,attempt_id:randomUUID(),target:f.command.manifest[0]};
   const body={source:'synthetic-atomic-v1',environment:'disposable-only',account:f.peer.account,event_id:randomUUID(),operation:null,attempt:null,target:null,incarnation:f.peer.incarnation,execution_epoch:0,result:'UNMAPPED',payload:{minimal:'race-evidence'},actual_event_at:new Date().toISOString()};
   await race('K5-E10 '+first+' first',c=>first==='ingress'?receive(f,body,c,{open:true}):invoke('psttg_k5_begin',cmd,c,{open:true}),c=>first==='ingress'?invoke('psttg_k5_begin',cmd,c):receive(f,body,c),r=>first==='ingress'?assert.match(r.error?.message??'',/k5_channel_stopped/):assert.ifError(r.error));
   if(first==='dispatch'){await transition(f,'OUTCOME_UNKNOWN');assert.equal((await intent(i.intent_id)).state,'OUTCOME_UNKNOWN');}
  }
  const f=await fixture(),other={...f.command,intent_id:randomUUID(),command_id:randomUUID()};await race('K5-E07 overlapping authors',c=>invoke('psttg_k5_authorize',f.command,c,{open:true}),c=>invoke('psttg_k5_authorize',other,c),r=>assert.match(r.error?.message??'',/k5_stale_assessment/));
  await check('K5-E05 old repeatable-read snapshot rejected with full invariance',async()=>{const f=await fixture(),c=await db.connect();await c.query('begin isolation level repeatable read');await unchangedDeny(()=>invoke('psttg_k5_authorize',f.command,c,{open:true}),/k5_snapshot_retry/);await c.query('rollback');});
  await check('K5-E08 E12 commit-before-artifact and durable receipt-before-ack boundaries',async()=>{
   const f=await fixture(),cmd=await admission(f,true),c=await db.connect(),observer=await db.connect();await c.query('begin');const entry=await invoke('psttg_k5_admit',cmd,c,{open:true});assert.equal(await value('select count(*)::int v from dv_market_private.psttg_k5_end_attempt where entry_id=$1',[entry],observer),0);await c.query('rollback');assert.equal(await value('select count(*)::int v from dv_market_private.psttg_k5_end_attempt where entry_id=$1',[entry],observer),0);
   const body={source:'synthetic-atomic-v1',environment:'disposable-only',account:f.peer.account,event_id:randomUUID(),operation:null,attempt:null,target:null,incarnation:f.peer.incarnation,execution_epoch:0,result:'UNMAPPED',payload:{minimal:'sensitive-fixture'},actual_event_at:new Date().toISOString()};
   await unchangedDeny(async()=>call('psttg_k5_receive',[f.channel,body,await f.peer.sign(body),'short']),/psttg_key_invalid/);
   await c.query('begin');const receipt=await receive(f,body,c,{open:true});assert.equal(await value('select count(*)::int v from dv_market_private.psttg_k5_evidence_receipt where receipt_id=$1',[receipt],observer),0);await c.query('rollback');assert.equal(await value('select count(*)::int v from dv_market_private.psttg_k5_evidence_receipt where receipt_id=$1',[receipt],observer),0);
   const committed=await receive(f,body);assert.equal(await value('select count(*)::int v from dv_market_private.psttg_k5_evidence_receipt where receipt_id=$1',[committed],observer),1);assert.equal(await receive(f,body),committed);
  });
  await check('K5-E18 independent native restored database refuses old tickets and preserves external evidence',async()=>{
   const f=await fixture();await authorize(f);
   const image={};for(const t of tables)image[t]=await value(`select coalesce(jsonb_agg(to_jsonb(x)),'[]') v from dv_market_private.${t} x`);
   const i=await intent(f.command.intent_id),cmd={channel:f.channel,command_id:randomUUID(),intent_id:i.intent_id,revision:i.revision,state_revision:i.state_revision,attempt_id:randomUUID(),target:f.command.manifest[0]};
   await db.exec('begin');const [oldTicket,oldSignature]=await f.peer.ticket(cmd,db);await db.exec('commit');
   const id=await begin(f),t=await token(id),body=await f.peer.result(t);await receive(f,body);f.peer.restore();
   const {default:pg}=await import('pg');const admin=new pg.Client();await admin.connect();const restoredName='k5_restore_'+randomUUID().replaceAll('-','');await admin.query('create database '+restoredName);const c=new pg.Client({database:restoredName});await c.connect();
   try{
    await c.query('create extension pgcrypto');for(const file of ['psttg-capture-core-v1','psttg-removal-evaluation-v1','psttg-k5-synthetic-control-v1'])await c.query(await readFile(new URL('../database/'+file+'.sql',import.meta.url),'utf8'));
    for(const table of ['psttg_scope_guards',...tables.filter(t=>t!=='psttg_scope_guards')])await c.query(`insert into dv_market_private.${table} select * from jsonb_populate_recordset(null::dv_market_private.${table},$1::jsonb)`,[JSON.stringify(image[table])]);
    assert.equal(await value('select receipt_revision::int v from dv_market_private.psttg_k5_channel_gate where channel_id=$1',[f.channel],c),0);
    await deny(()=>call('psttg_k5_begin',[cmd,oldTicket,oldSignature],c),/k5_restore_quarantine/);
    await deny(()=>invoke('psttg_k5_authorize',f.command,c),/k5_peer_restore_quarantine/);
    const notice={action:'RESTORE_QUARANTINE',channel:f.channel,external_incarnation:f.peer.incarnation};await call('psttg_k5_quarantine',[f.channel,notice,await f.peer.sign(notice,c)],c);
    const receipt=await receive(f,body,c);assert.ok(receipt);assert.equal(await receive(f,body,c),receipt);assert.equal(f.peer.effects.size,1);
    await deny(async()=>f.peer.effect(t),/k5_peer_stale_at_effect/);out.restore_boundary='native second database restored from pre-effect logical image; independent peer incarnation, effects and receipt journal did not roll back';
   }finally{await c.end();await admin.query('drop database '+restoredName);await admin.end();}
  });
  await check('K5-E08 uncommitted dispatch is invisible to independent peer',async()=>{const f=await fixture();await authorize(f);const i=await intent(f.command.intent_id),c=await db.connect(),observer=await db.connect();const cmd={channel:f.channel,command_id:randomUUID(),intent_id:i.intent_id,revision:i.revision,state_revision:i.state_revision,attempt_id:randomUUID(),target:f.command.manifest[0]};await c.query('begin');await invoke('psttg_k5_begin',cmd,c,{open:true});await deny(()=>f.peer.dispatch(cmd.attempt_id,observer),/k5_uncommitted_dispatch/);await c.query('rollback');await deny(()=>f.peer.dispatch(cmd.attempt_id,observer),/k5_uncommitted_dispatch/);await invoke('psttg_k5_begin',cmd);assert.equal((await f.peer.dispatch(cmd.attempt_id,observer)).attempt_id,cmd.attempt_id);});
 }
 assert.deepEqual(await protectedSnapshot(),protectedBefore);out.protected_table_count=protectedTables.length;out.functions_rights_and_holds_unchanged=true;
 out.passed=true;out.acceptance=native;
}catch(e){out.failure={message:e.message,code:e.code??null};console.error('FAIL',e.message,e.where??'');process.exitCode=1}
finally{await mkdir('test-results',{recursive:true});await writeFile('test-results/psttg-k5-synthetic-'+(native?'native':'preparation')+'.json',JSON.stringify(out,null,2));await db.close();}
