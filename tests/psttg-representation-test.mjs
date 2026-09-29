// Disposable synthetic representation only. No real end effect or authorization.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {publicationFixture} from './helpers/publication-hold-fixture.mjs';
const native=process.argv.includes('--native');
const connected=process.argv.includes('--connection');
const db=native?await(await import('./helpers/f3-native-db.mjs')).createDatabase():new(await import('@electric-sql/pglite')).PGlite({extensions:{pgcrypto:(await import('@electric-sql/pglite/contrib/pgcrypto')).pgcrypto}});
const key=randomBytes(48).toString('base64');
const out={native,passed:false,cases:[],locks:[],boundary:'representation_only; prepared end fixtures are not end execution'};
const q=(s,a=[],c=db)=>c.query(s,a),val=async(s,a=[],c=db)=>(await q(s,a,c)).rows[0]?.v;
const call=(f,a,c=db)=>val(`select dv_market_private.${f}(${a.map((_,i)=>'$'+(i+1)).join(',')}) v`,a,c);
const check=async(n,f)=>{await f();out.cases.push(n);console.log('PASS',n)};
const deny=async(f,re=/v2_|psttg_|permission denied|violates|duplicate/)=>{let e;try{await f()}catch(x){e=x}assert.ok(e,'expected rejection');assert.match(e.message,re)};
const sql=await readFile(new URL('../database/psttg-representation-v2.sql',import.meta.url),'utf8');
const tables=['psttg_object_anchor','psttg_unit_guard','psttg_content_unit','psttg_unit_binding','psttg_unit_end_receipt'];
const snapshot=async()=>Object.fromEntries(await Promise.all([...tables,'psttg_scope_guards'].map(async t=>[t,await val(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') v from dv_market_private.${t} t`)])));
const unchanged=async f=>{const a=await snapshot();await f();assert.deepEqual(await snapshot(),a)};
const scope=()=>call('psttg_ensure_scope',['subject',randomBytes(32),null,null]);
const body=()=>({amount:120,currency:'EUR',period:2026,position:randomUUID(),other_attributes:{synthetic_secret:'not-for-fragment'},correction_reason:''});
const project=b=>Object.fromEntries(['amount','currency','period','position'].map(k=>[k,b[k]]));
const command=(s,kind='O3')=>({command_id:randomUUID(),object_id:randomUUID(),incarnation:randomUUID(),version:1,kind,scopes:[s],dependencies:[],decision_ref:randomUUID(),original:{}});
const fixture=async(s)=>{s??=await scope();const cmd=command(s),b=body();return {cmd,content:{body:b,source_fragment:project(b),original_fragment:{}}}};
const capture=(x,c=db)=>call('psttg_v2_capture',[x.cmd,x.content,key],c);
const read=(id,c=db)=>call('psttg_v2_read',[id,key,2],c);
const units=id=>q('select * from dv_market_private.psttg_content_unit where object_id=$1 order by slot',[id]).then(r=>r.rows);
try{
 await publicationFixture(db);
 for(const f of ['psttg-capture-core-v1','psttg-removal-evaluation-v1','psttg-k5-synthetic-control-v1'])await db.exec(await readFile(new URL('../database/'+f+'.sql',import.meta.url),'utf8'));
 const before=await q("select p.oid,p.prosrc,p.proacl::text,p.proowner,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' order by p.oid");
 // Controlled fixture construction BEFORE protection installation, in this
 // disposable database only. No setter, DML bypass or end routine is installed.
 const protectionStart=sql.indexOf('do $$declare t text;r record;begin');
 await db.exec(sql.slice(0,protectionStart)+'commit;');
 const prepared={};
 async function prepareEnd(xid,{keep=false,mismatch=false,kind=null}={}){
  await q(`insert into dv_market_private.psttg_unit_end_receipt
   select u.unit_id,u.object_id,u.incarnation,u.content_version,u.slot,gen_random_uuid(),1,gen_random_uuid(),1,gen_random_uuid(),gen_random_uuid(),1,'active_db_unit_removed',gen_random_uuid(),gen_random_uuid(),u.unit_seal,b.manifest_seal,'synthetic_prepared_state_only',gen_random_uuid(),decode(repeat('00',32),'hex')
   from dv_market_private.psttg_content_unit u join dv_market_private.psttg_unit_binding b using(object_id) where u.object_id=$1 and ($2::text is null or u.unit_kind=$2)`,[xid,kind]);
  await q(`update dv_market_private.psttg_unit_guard g set phase='ended',revision=2,manifest_id=r.manifest_id,manifest_revision=r.manifest_revision,authorization_id=r.authorization_id,attempt_id=r.attempt_id,result_id=r.result_id from dv_market_private.psttg_unit_end_receipt r where r.unit_id=g.unit_id and r.object_id=$1`,[xid]);
  if(mismatch)await q('update dv_market_private.psttg_unit_end_receipt set authorization_id=gen_random_uuid() where object_id=$1',[xid]);
  await q("update dv_market_private.psttg_unit_end_receipt r set receipt_seal=dv_market_private.psttg_v2_hash(to_jsonb(r)-'receipt_seal') where object_id=$1",[xid]);
  if(!keep)await q('delete from dv_market_private.psttg_content_unit where object_id=$1 and unit_id in(select unit_id from dv_market_private.psttg_unit_end_receipt where object_id=$1)',[xid]);
 }
 for(const state of ['ended','missing','contradictory','content_despite_end','bad_binding','bad_cipher','envelope_swap','bad_key','fenced']){
  const x=await fixture();const id=await capture(x);prepared[state]={x,id};
  if(state==='ended'){
   const c=await fixture(x.cmd.scopes[0]);c.cmd.original={id,incarnation:x.cmd.incarnation,version:1};c.content.body.amount=99;c.content.body.correction_reason='fixture';c.content.source_fragment=project(c.content.body);c.content.original_fragment=project(x.content.body);
   prepared.correction={x:c,id:await capture(c)};
   await prepareEnd(id);
  }else if(state==='missing')await q("delete from dv_market_private.psttg_content_unit where object_id=$1 and unit_kind='body'",[id]);
  else if(state==='contradictory')await prepareEnd(id,{mismatch:true});
  else if(state==='content_despite_end')await prepareEnd(id,{keep:true});
  else if(state==='bad_binding')await q("update dv_market_private.psttg_unit_binding set slots=jsonb_set(slots,'{0,slot}','999') where object_id=$1",[id]);
  else if(state==='bad_cipher')await q("update dv_market_private.psttg_content_unit set ciphertext=decode('0000','hex') where object_id=$1 and unit_kind='body'",[id]);
  else if(['envelope_swap','bad_key'].includes(state)){
   const us=await units(id),column=state==='bad_key'?'wrapped_key':'ciphertext';
   await q(`update dv_market_private.psttg_content_unit set ${column}=$2 where unit_id=$1`,[us[0].unit_id,us[1][column]]);
   await q("update dv_market_private.psttg_content_unit u set unit_seal=dv_market_private.psttg_v2_hash(to_jsonb(u)-'unit_seal') where unit_id=$1",[us[0].unit_id]);
   await q("update dv_market_private.psttg_unit_binding b set slots=jsonb_set(slots,'{0,seal}',to_jsonb((select encode(unit_seal,'hex') from dv_market_private.psttg_content_unit where unit_id=$2))) where object_id=$1",[id,us[0].unit_id]);
   await q("update dv_market_private.psttg_unit_binding b set manifest_seal=dv_market_private.psttg_v2_hash(jsonb_build_array((select to_jsonb(a) from dv_market_private.psttg_object_anchor a where a.object_id=b.object_id),to_jsonb(b)-'manifest_seal')) where object_id=$1",[id]);
  }
  else if(state==='fenced')await q("update dv_market_private.psttg_unit_guard set phase='fenced',revision=2,manifest_id=gen_random_uuid(),manifest_revision=1,authorization_id=gen_random_uuid(),attempt_id=gen_random_uuid() where object_id=$1",[id]);
 }

 const po=await fixture(),poid=await capture(po),pc=await fixture(po.cmd.scopes[0]);pc.cmd.original={id:poid,incarnation:po.cmd.incarnation,version:1};pc.content.body.correction_reason='fixture';pc.content.original_fragment=project(po.content.body);prepared.partial_correction={id:await capture(pc)};await prepareEnd(prepared.partial_correction.id,{kind:'original_fragment'});
 // Native controlled guard counterparts run as fixture preparation, BEFORE
 // immutable protections are installed. No trigger is disabled or replaced.
 if(native){
  const a=await db.connect(),b=await db.connect();
  const ap=await val('select pg_backend_pid() v',[],a),bp=await val('select pg_backend_pid() v',[],b);
  for(const writerFirst of [true,false]){
   const f=await fixture(),fid=await capture(f),c=await fixture(f.cmd.scopes[0]);c.cmd.dependencies=(await units(fid)).map(u=>u.unit_id).sort();
   const controlledFence=async client=>{
    await q('select dv_market_private.psttg_v2_lock($1)',[f.cmd.scopes],client);
    await q('select unit_id from dv_market_private.psttg_unit_guard where object_id=$1 order by unit_id for update',[fid],client);
    await q("update dv_market_private.psttg_unit_guard set phase='fenced',revision=revision+1,manifest_id=gen_random_uuid(),manifest_revision=1,authorization_id=gen_random_uuid(),attempt_id=gen_random_uuid() where object_id=$1",[fid],client);
   };
   await q('begin',[],a);if(writerFirst)await capture(c,a);else await controlledFence(a);
   let settled=false;const waiting=(writerFirst?(async()=>{await q('begin',[],b);try{await controlledFence(b);await q('commit',[],b)}catch(e){await q('rollback',[],b);throw e}})():capture(c,b)).then(v=>({v}),e=>({error:e.message,code:e.code})).finally(()=>settled=true);
   let seen=false;for(let i=0;i<100&&!settled;i++){const pids=await val('select pg_blocking_pids($1) v',[bp]);if(pids.includes(ap)){out.locks.push({label:'fixture-preparation-capture-fence-'+writerFirst,waiting:bp,blocker:ap});seen=true;break}await new Promise(r=>setTimeout(r,20))}
   assert.ok(seen);await q('commit',[],a);const r=await waiting;
   if(writerFirst){assert.ok(!r.error,r.error);assert.ok((await read(c.cmd.object_id)).states.includes('copy_or_dependency_unresolved'))}else assert.match(r.error??'',/v2_target_guard/);
  }
  out.cases.push('ER08 controlled guard fixture preparation: capture/fence both orders; no end authorization');
 }
 await db.exec('begin;'+sql.slice(protectionStart));
 if(connected)await db.exec(await readFile(new URL('../database/psttg-v2-writer-unitmanifest-v1.sql',import.meta.url),'utf8'));

 assert.deepEqual((await q("select p.oid,p.prosrc,p.proacl::text,p.proowner,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and p.proname not like 'psttg_v2_%' order by p.oid")).rows,before.rows);

 const existingTables=(await q("select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname not in ('pg_catalog','information_schema') and n.nspname not like 'pg_%' and c.relname not in ('psttg_object_anchor','psttg_unit_guard','psttg_unit_binding','psttg_content_unit','psttg_unit_end_receipt','psttg_scope_guards') order by 1,2")).rows;
 const protectedSnapshot=async()=>({rows:await Promise.all(existingTables.map(async t=>[t.nspname+'.'+t.relname,await val(`select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),'[]')::text,'UTF8')),'hex') v from "${t.nspname}"."${t.relname}" r`)])),functions:(await q("select oid,prosrc,proacl::text,proowner,proconfig from pg_proc order by oid")).rows,relations:(await q("select oid,relacl::text,relowner,relrowsecurity from pg_class order by oid")).rows});
 const protectedBefore=await protectedSnapshot();
 let x,id,corr,cid;
 await check('ER01 slot, unit, owner, envelope and manifest verification',async()=>{x=await fixture();id=await capture(x);assert.deepEqual((await read(id)).states,['present_verified']);assert.equal((await units(id)).length,3)});
 await check('ER05 exact server original extraction and own correction group',async()=>{corr=await fixture(x.cmd.scopes[0]);corr.cmd.original={id,incarnation:x.cmd.incarnation,version:1};corr.content.body.amount=100;corr.content.body.correction_reason='synthetic correction';corr.content.source_fragment=project(corr.content.body);corr.content.original_fragment=project(x.content.body);cid=await capture(corr);assert.ok((await read(cid)).states.includes('required_correction_fragment'));assert.equal((await units(cid)).length,5);assert.equal(await val('select related_object_id v from dv_market_private.psttg_unit_binding where object_id=$1',[cid]),id)});
 await check('ER05 missing extra wrong fields and foreign version rejected without mutation',async()=>{for(const change of [z=>delete z.content.original_fragment.amount,z=>z.content.original_fragment.extra=1,z=>z.content.original_fragment.amount=999,z=>z.cmd.original.version=2,z=>z.cmd.original.incarnation=randomUUID()]){const z=structuredClone(corr);z.cmd.command_id=randomUUID();z.cmd.object_id=randomUUID();change(z);await unchanged(()=>deny(()=>capture(z)))}});
 await check('ER17 independent random data keys and independently removable envelopes',async()=>{const us=[...await units(id),...await units(cid)],ks=[];for(const u of us){const k=await call('psttg_v2_decrypt',[u.wrapped_key,key]);ks.push(k.key);assert.equal(k.unit,u.unit_id);assert.equal(k.key_ref,u.key_ref)}assert.equal(new Set(ks).size,us.length);for(let i=1;i<us.length;i++)await deny(()=>call('psttg_v2_decrypt',[us[i].ciphertext,ks[0]]));assert.ok((await read(cid)).states.includes('required_correction_fragment'))});
 await check('ER19 no full inputs or low-entropy plaintext digests in new metadata',async()=>{for(const t of tables.filter(t=>t!=='psttg_content_unit')){const rows=await val(`select coalesce(jsonb_agg(to_jsonb(t)),'[]') v from dv_market_private.${t} t`);assert.ok(!JSON.stringify(rows).includes('synthetic_secret'));assert.ok(!JSON.stringify(rows).includes('not-for-fragment'));assert.ok(!JSON.stringify(rows).includes('original_fragment\":{'))}const proof=(await units(id)).find(u=>u.unit_kind==='proof');const p=await call('psttg_v2_plain',[proof.unit_id,key]);assert.deepEqual(Object.keys(p.request),['digest']);assert.ok(!JSON.stringify(p).includes('not-for-fragment'))});
 await check('ER12 idempotent same request, conflicting values and reads invariant',async()=>{await unchanged(async()=>{assert.equal(await capture(x),id);const z=structuredClone(x);z.content.body.amount=121;z.content.source_fragment=project(z.content.body);await deny(()=>capture(z));await read(id);await read(id);await deny(()=>call('psttg_v2_read',[id,key,3]));await deny(()=>call('get_psttg_record_requirement',[id]),/no rows/);});});
 await check('ER07 O1 O2 O4 and unknown copy have closed schemas',async()=>{for(const kind of ['O1','O2','O4','COPY']){const cmd=command(x.cmd.scopes[0],kind);let content;if(kind==='O1')content={source_ref:randomUUID(),source_version:1,mode:'synthetic_test',attestation_ref:randomUUID()};if(kind==='O2')content={input:{operation_ref:randomUUID(),input_revision:1,body:body()},event:{operation_ref:randomUUID(),event_ref:randomUUID(),meaning:'performed',evidence_ref:randomUUID()}};if(kind==='O4')content={target:id,incarnation:x.cmd.incarnation,version:1,purpose_ref:randomUUID(),relation:'uses_information_from'};if(kind==='COPY')content={target:id,artifact:randomUUID(),artifact_version:1,coverage:'unresolved'};if(kind==='O2')content.event.operation_ref=content.input.operation_ref;if(['O4','COPY'].includes(kind))cmd.dependencies=(await units(id)).map(u=>u.unit_id).sort();const k=await capture({cmd,content});assert.equal((await read(k)).states.includes('copy_or_dependency_unresolved'),kind==='COPY');}});
 await check('ER16 all application DML and EXECUTE denied; immutable owner DML',async()=>{for(const role of (await q("select rolname from pg_roles where not rolsuper and rolname<>'dv_psttg_core_owner' and rolname not like 'pg_%'")).rows.map(r=>r.rolname)){for(const t of tables)for(const perm of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal(await val('select has_table_privilege($1,$2,$3) v',[role,'dv_market_private.'+t,perm]),false);assert.equal(await val("select count(*)::int v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and p.proname like 'psttg_v2_%' and has_function_privilege($1,p.oid,'EXECUTE')",[role]),0)}await unchanged(async()=>{await deny(()=>q('delete from dv_market_private.psttg_content_unit where object_id=$1',[id]));await deny(()=>q("update dv_market_private.psttg_unit_guard set phase='ended' where object_id=$1",[id]));for(const t of tables)await deny(()=>q(`truncate dv_market_private.${t} cascade`));});});

 await check('ER01 ER02 ER06 ER15 prepared end and corrupt states, no end execution',async()=>{
  await unchanged(async()=>{
   assert.deepEqual((await read(prepared.ended.id)).states,['authorized_end_verified']);
   const cr=await read(prepared.correction.id);assert.ok(cr.states.includes('required_correction_fragment'));assert.equal(cr.original_full_rechecked,false);
   assert.equal((await units(prepared.ended.id)).length,0);assert.equal((await units(prepared.correction.id)).length,5);
   assert.ok((await read(prepared.missing.id)).states.includes('missing_unexplained'));
   for(const state of ['contradictory','content_despite_end','bad_binding','bad_cipher','envelope_swap','bad_key'])assert.ok((await read(prepared[state].id)).states.includes('integrity_violation'),state);
   assert.ok((await read(prepared.fenced.id)).states.includes('copy_or_dependency_unresolved'));
   assert.deepEqual((await read(randomUUID())).states,['missing_unexplained']);
  });
 });
 await check('ER06 ER15 valid individual end receipt does not resolve partial preservation group',async()=>{await unchanged(async()=>{const r=await read(prepared.partial_correction.id);assert.ok(r.states.includes('authorized_end_verified'));assert.ok(r.states.includes('present_verified'));assert.ok(r.states.includes('copy_or_dependency_unresolved'));assert.ok(!r.states.includes('required_correction_fragment'));});});
 await check('ER08 ER12 complete group requirements and persistent fenced targets',async()=>{
  const f=await fixture(),fid=await capture(f),us=(await units(fid)).map(u=>u.unit_id).sort();
  const c=await fixture(f.cmd.scopes[0]);c.cmd.dependencies=us.slice(0,1);await unchanged(()=>deny(()=>capture(c)));
  c.cmd.dependencies=us;const beforeRead=await read(fid),generation=await val('select generation::int v from dv_market_private.psttg_scope_guards where scope_id=$1',[f.cmd.scopes[0]]);await capture(c);assert.notEqual((await read(fid)).snapshot_fingerprint,beforeRead.snapshot_fingerprint);assert.equal(await val('select generation::int v from dv_market_private.psttg_scope_guards where scope_id=$1',[f.cmd.scopes[0]]),generation);
  for(const state of ['fenced','ended']){
   const c=await fixture(prepared[state].x.cmd.scopes[0]);c.cmd.dependencies=(await q('select unit_id from dv_market_private.psttg_unit_guard where object_id=$1 order by unit_id',[prepared[state].id])).rows.map(u=>u.unit_id);
   await unchanged(()=>deny(()=>capture(c)));
  }
 });
 if(native){
  const a=await db.connect(),b=await db.connect();
  const pid=async c=>val('select pg_backend_pid() v',[],c),ap=await pid(a),bp=await pid(b);
  async function blocked(label,action,release,expected){
   let settled=false;const waiting=action().then(v=>({v}),e=>({error:e.message,code:e.code})).finally(()=>settled=true);
   let seen=false;for(let i=0;i<100&&!settled;i++){const pids=await val('select pg_blocking_pids($1) v',[bp]);if(pids.includes(ap)){out.locks.push({label,waiting:bp,blocker:ap});seen=true;break}await new Promise(r=>setTimeout(r,20))}
   assert.ok(seen,label+' actual pg_blocking_pids');await release();let result=await waiting;if(connected&&!expected&&result.code==='40001'){out.connectionRetries=(out.connectionRetries??0)+1;result=await action().then(v=>({v}),e=>({error:e.message,code:e.code}));}if(expected)assert.match(result.error??'',expected);else assert.ok(!result.error,result.error);return result.v;
  }
  await check('ER08 ER10 native parallel capture and idempotency conflict both orders',async()=>{
   for(const conflict of [false,true])for(const reverse of [false,true]){
    const f=await fixture(),z=structuredClone(f);if(conflict){z.content.body.amount=121;z.content.source_fragment=project(z.content.body);}
    const first=reverse?z:f,second=reverse?f:z;
    await q('begin',[],a);await capture(first,a);
    await blocked('idempotency-'+conflict+'-'+reverse,()=>capture(second,b),()=>q('commit',[],a),conflict?/v2_idempotency_conflict/:null);
   }
  });
  await check('ER03 ER08 ER09 native shared requirements and controlled guards both orders',async()=>{
   for(const phase of ['present'])for(const writerFirst of [false,true]){
    const base=phase==='present'?await fixture():prepared.fenced.x;
    const fid=phase==='present'?await capture(base):prepared.fenced.id;
    const us=(await q('select unit_id from dv_market_private.psttg_unit_guard where object_id=$1 order by unit_id',[fid])).rows.map(u=>u.unit_id);
    const c=await fixture(base.cmd.scopes[0]);c.cmd.dependencies=us;
    await q('begin',[],a);
    if(writerFirst&&phase==='present')await capture(c,a);
    else {await q('select dv_market_private.psttg_v2_lock($1)',[base.cmd.scopes],a);await q('select unit_id from dv_market_private.psttg_unit_guard where object_id=$1 order by unit_id for update',[fid],a)}
    if(writerFirst&&phase==='present')await blocked('writer-before-observer-'+phase,()=>q('select dv_market_private.psttg_v2_lock($1)',[base.cmd.scopes],b),()=>q('commit',[],a));
    else await blocked('controlled-guard-before-capture-'+phase+'-'+writerFirst,()=>capture(c,b),()=>q('commit',[],a),phase==='fenced'?/v2_target_guard/:null);
   }
   // Two independent captures sharing required evidence both increment the same
   // demand revision under the same O5/target locks, without losing either edge.
   const f=await fixture(),fid=await capture(f),us=(await units(fid)).map(u=>u.unit_id).sort();
   const c=await fixture(f.cmd.scopes[0]),d=await fixture(f.cmd.scopes[0]);c.cmd.dependencies=us;d.cmd.dependencies=us;
   await q('begin',[],a);await capture(c,a);await blocked('shared-demand',()=>capture(d,b),()=>q('commit',[],a));
   assert.equal(await val('select min(demand_revision)::int v from dv_market_private.psttg_unit_guard where object_id=$1',[fid]),3);
  });
  await check('ER08 reader capture both orders and scope growth retry',async()=>{
   for(const writerFirst of [false,true]){
    const f=await fixture(),fid=await capture(f),z=await fixture(f.cmd.scopes[0]);
    await q('begin',[],a);
    if(writerFirst)await capture(z,a);else await read(fid,a);
    await blocked('reader-capture-'+writerFirst,()=>writerFirst?read(fid,b):capture(z,b),()=>q('commit',[],a));
   }
   const s=await scope(),t=await scope(),f=await fixture(s),z=await fixture(s);f.cmd.scopes=[s,t];
   await q('begin',[],a);await capture(f,a);
   await blocked('scope-growth',()=>capture(z,b),()=>q('commit',[],a),/v2_scope_growth_retry/);
  });
  await check('ER12 old snapshot closed',async()=>{await q('begin isolation level repeatable read',[],a);await deny(()=>read(id,a),/v2_snapshot_retry/);await q('rollback',[],a)});
 }

 await check('ER12 global fences closed recovery remain additional blocks',async()=>{
  for(const phase of ['fenced','closed']){
   const f=await fixture();await q('begin');
   try{await q("update dv_market_private.psttg_scope_guards set phase=$2,fence_token=gen_random_uuid(),fence_target_digest=sha256('fixture'),fence_generation=generation,recovery_state='pending' where scope_id=$1",[f.cmd.scopes[0],phase]);await deny(()=>capture(f));}finally{await q('rollback')}
  }
 });
 await check('ER02 anchor version FK retains correction reference without original payload',async()=>{
  assert.ok((await read(prepared.correction.id)).states.includes('required_correction_fragment'));
  assert.equal(await val("select count(*)::int v from pg_constraint where conrelid='dv_market_private.psttg_unit_binding'::regclass and contype='f' and confrelid='dv_market_private.psttg_object_anchor'::regclass"),2);
  await unchanged(()=>deny(()=>q('delete from dv_market_private.psttg_object_anchor where object_id=$1',[prepared.ended.id])));
 });
 await check('ER16 no end receipt insertion and no incomplete commits',async()=>{
  await unchanged(()=>deny(()=>q("insert into dv_market_private.psttg_unit_end_receipt select * from dv_market_private.psttg_unit_end_receipt limit 1")));
  await q('begin');try{await q("insert into dv_market_private.psttg_object_anchor values($1,$2,1,'O3',2)",[randomUUID(),randomUUID()]);await deny(()=>q('commit'),/no rows|v2_/);}finally{await q('rollback')}
 });
 assert.deepEqual(await protectedSnapshot(),protectedBefore);out.existingTablesUnchanged=existingTables.length;out.functionsAndRightsUnchanged=true;
 out.passed=true;
}catch(e){throw new Error(String(e.message).split('\n')[0]);}finally{await mkdir('test-results',{recursive:true});await writeFile(`test-results/psttg-representation-${connected?'connection-':''}${native?'native':'local'}.json`,JSON.stringify(out,null,2));await db.close()}
