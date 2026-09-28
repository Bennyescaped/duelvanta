// D4-V1 only. Native PG17 is mandatory for final acceptance.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {read} from './helpers/security-schema-fixture.mjs';
import {storageFixture} from './helpers/publication-storage-fixture.mjs';
import {publicationFixture,uid,O,J,A,B,C,D,claim,admin} from './helpers/publication-hold-fixture.mjs';
const native=process.argv.includes('--native');let db;
if(native){const {createDatabase}=await import('./helpers/f3-native-db.mjs');db=await createDatabase();}
else{const {PGlite}=await import('@electric-sql/pglite');const {pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}});}
const out={native,version:db.version||'PGlite',passed:false,acceptance:false,cases:[],races:[]};
let seq=1000,fingerprintSQL;const q=(s,p=[])=>(db.query(s,p));
async function snap(){await admin(db);return (await q(fingerprintSQL)).rows;}
async function tx(fn){await admin(db);await db.exec('begin');try{await fn();}finally{await db.exec('rollback');await admin(db);}}
async function state(u,s){await admin(db);if(s==='processing')await q('update profiles set data_processing_restricted_at=now() where id=$1',[u]);if(s==='closure'){await claim(db,u);assert.equal((await q("select request_my_account_deletion('KONTO LÖSCHEN',$1) v",[uid(seq++)])).rows[0].v.accepted,true);await admin(db);}}
async function call(label,u,sql,params=[],{role='authenticated',denied=false,count,changes=[]}={}){
 const before=await snap();await claim(db,u,role);await db.exec('savepoint probe');let rows,error;
 try{rows=(await q(sql,params)).rows;}catch(e){error=e.message;await db.exec('rollback to savepoint probe');}
 await db.exec('release savepoint probe');assert.equal(!!error,denied,label+': '+(error||'unexpected success'));
 if(error)assert.match(error,/processing_restricted|publication_processing_restricted|permission denied|privileged_session|owner access|spectator_|row-level security|collection_private|Username change locked/);
 if(count!==undefined)assert.equal(rows?.length,count,label);
 const after=await snap(),changed=after.filter((r,i)=>r.digest!==before[i].digest).map(r=>r.relation);
 assert.deepEqual(changed,changes,label+' changes');out.cases.push({label,u,role,rows,error,changed});return rows;
}
const complete=uid(100),waiting=uid(101),live=uid(102),privateMatch=uid(103),otherMatch=uid(104),dispute=uid(105),item=uid(110),folder=uid(111);
try{
 await publicationFixture(db);await admin(db);await storageFixture(db);
 const oldFunctions=(await q("select n.nspname,p.proname,p.oid,p.prosrc,p.proacl::text,p.proowner,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_market_private','battle_spectator_private','battle_spectator_media_private','dv_v16_private') order by p.oid")).rows;
 await db.exec(await read('database/publication-processing-hold-v1.sql'));await db.exec(await read('database/publication-processing-hold-v1.sql'));
 assert.equal((await q('select get_security_schema_readiness_v1() v')).rows[0].v.compatible,false);
 await db.exec(await read('database/publication-processing-hold-readiness-v1.sql'));
 if(process.argv.includes('--b1-safety')){await db.exec(await read('database/battle-safety-sanctions-v1.sql'));await db.exec(await read('database/battle-safety-sanctions-readiness-v1.sql'));}

 const oldStorage=(await q("select policyname,cmd,qual,with_check from pg_policies where schemaname='storage' order by policyname")).rows;
 await db.exec(await read('database/publication-image-write-hold-v1.sql'));await db.exec(await read('database/publication-image-write-hold-v1.sql'));
 const newStorage=(await q("select policyname,cmd,qual,with_check from pg_policies where schemaname='storage' and policyname not like 'd4_%' order by policyname")).rows;assert.deepEqual(newStorage,oldStorage);
 for(const u of [A,B])for(const bucket of ['profile-avatars','collection-cards'])await q("insert into storage.objects(bucket_id,name) values($1,$2)",[bucket,u+'/existing.webp']);
 for(const name of ['get_security_schema_readiness_v1','get_market_legal_schema_readiness_v1'])assert.equal((await q('select '+name+'() v')).rows[0].v.compatible,true);
 const changedAllowed=new Set(['get_public_battle_ratings','get_public_battle_ranked_profile','get_battle_leaderboard','get_public_battle_recent','get_public_battle_stats','list_battle_spectator_matches','snapshot','get_security_schema_readiness_v1','get_market_legal_schema_readiness_v1']);
 if(process.argv.includes('--b1-safety'))for(const name of ['moderate_battle_report','request_my_account_deletion'])changedAllowed.add(name);
 const nowFunctions=(await q("select n.nspname,p.proname,p.oid,p.prosrc,p.proacl::text,p.proowner,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_market_private','battle_spectator_private','battle_spectator_media_private','dv_v16_private') order by p.oid")).rows;
 for(const old of oldFunctions){const now=nowFunctions.find(x=>x.oid===old.oid);assert.ok(now);if(changedAllowed.has(old.proname))assert.deepEqual({...now,prosrc:old.prosrc},old);else assert.deepEqual(now,old,'unchanged '+old.proname);}
 for(const [u,n] of [[A,0],[B,10]]){
  await q("insert into collection_folders(id,user_id,name,is_public) values($1,$2,'binder',true)",[uid(111+n),u]);
  await q("insert into collection_items(id,user_id,folder_id,tcg,card_name,image_path) values($1,$2,$3,'pokemon','card',$4)",[uid(110+n),u,uid(111+n),u+'/existing.jpg']);
  await q("insert into battle_ratings(user_id,tcg,rating,games,wins) values($1,'pokemon',$2,1,1)",[u,u===A?1500:1100]);
 }
 for(const [m,h,g,status,vis] of [[complete,A,B,'completed','private'],[waiting,A,B,'waiting','public'],[live,A,B,'live','public'],[privateMatch,A,B,'live','private'],[otherMatch,C,D,'waiting','public'],[dispute,A,B,'dispute','private']])await q("insert into battle_matches(id,host_id,guest_id,tcg,status,visibility,mode,completed_at,host_display_name,guest_display_name,moderator_id) values($1,$2,$3,'pokemon',$4,$5,'ranked',case when $4='completed' then now() else null end,'HOST SNAPSHOT','GUEST SNAPSHOT',null)",[m,h,g,status,vis]);
 await q("insert into battle_reports(id,match_id,reporter_id,reported_user_id,category) values($1,$2,$3,$4,'other')",[uid(130),dispute,A,B]);
 await q("insert into staff_applications(id,applicant_id,requested_role,motivation) values($1,$2,'judge','synthetic')",[uid(131),A]);
 const tables=(await q("select schemaname,tablename from pg_tables where schemaname not in ('pg_catalog','information_schema') and schemaname not like 'pg_%' order by 1,2")).rows;
 fingerprintSQL=tables.map(t=>`select '${t.schemaname}.${t.tablename}' relation,md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) digest from "${t.schemaname}"."${t.tablename}" t`).join(' union all ')+' order by relation';
 const baseline=await snap();out.tableCount=tables.length;
 for(const s of ['normal','processing','closure'])await tx(async()=>{
  await state(A,s);const held=s!=='normal';
  for(const [actor,role,kind] of [[A,'authenticated','self'],[C,'authenticated','foreign'],[null,'anon','anon'],[J,'authenticated','judge'],[O,'authenticated','owner']]){
   for(const name of ['get_public_battle_ratings','get_public_battle_ranked_profile','get_public_battle_stats','get_public_battle_recent'])await call(s+'/'+kind+'/'+name,actor,`select * from ${name}($1)`,['alpha'],{role,count:held?0:1});
   const lb=await call(s+'/'+kind+'/leaderboard',actor,"select * from get_battle_leaderboard('pokemon',100)",[],{role,count:held?1:2});if(held){assert.equal(lb[0].username,'bravo');assert.equal(Number(lb[0].place),1);}
   const br=await call(s+'/'+kind+'/ranked-other',actor,'select * from get_public_battle_ranked_profile($1)',['bravo'],{role,count:1});assert.equal(Number(br[0].global_rank),held?1:2);
   for(const n of ['get_public_battle_recent','get_public_battle_stats'])await call(s+'/'+kind+'/indirect/'+n,actor,`select * from ${n}($1)`,['bravo'],{role,count:held?0:1});
   await call(s+'/'+kind+'/collection',actor,'select * from get_public_duelvanta_collection($1)',['alpha'],{role,count:s==='closure'?0:1});
   await call(s+'/'+kind+'/identity',actor,'select * from get_public_duelvanta_identity($1)',[A],{role,count:1});
   await call(s+'/'+kind+'/profile',actor,'select * from get_public_duelvanta_profile($1)',['alpha'],{role,count:1});
  }
  await call(s+'/anon/matches',null,'select * from battle_matches',[],{role:'anon',denied:true});
  await call(s+'/foreign/ratings',C,'select * from battle_ratings where user_id=$1',[A],{count:0});
  for(const table of ['collection_items','collection_folders']){
   await call(s+'/own/'+table,A,'select * from '+table+' where user_id=$1',[A],{count:1});
   await call(s+'/foreign/'+table,C,'select * from '+table+' where user_id=$1',[A],{count:0});
   await call(s+'/anon/'+table,null,'select * from '+table,[],{role:'anon',denied:true});
  }
  for(const name of ['get_my_battle_history','get_my_battle_ratings'])await call(s+'/own/'+name,A,'select * from '+name+'()',[],{count:1});
  await call(s+'/own/report',A,'select * from battle_reports',[],{count:1});
  await call(s+'/own/application',A,'select * from staff_applications',[],{count:1});
  await call(s+'/own/profile',A,'select * from profiles where id=$1',[A],{count:1});
  await call(s+'/export',A,'select export_my_duelvanta_data() v',[],{changes:['dv_market_private.user_data_export_events']});
  for(const actor of [A,B,J,O])await call(s+'/evidence-match/'+actor,actor,'select * from battle_matches where id=$1',[privateMatch],{count:1});
  await call(s+'/foreign-lobby',C,'select * from battle_matches where id=$1',[waiting],{count:held?0:1});
  await call(s+'/unaffected-lobby',A,'select * from battle_matches where id=$1',[otherMatch],{count:1});
  await call(s+'/staff-desk',J,'select * from get_battle_disputes_for_moderation()',[],{count:1});
  const list=await call(s+'/spectator-list',C,"select list_battle_spectator_matches('pokemon') v");assert.equal(list[0].v.some(x=>x.id===live),!held);
  await call(s+'/snapshot',null,'select battle_spectator_private.snapshot($1) v',[live],{role:'postgres'}).then(rows=>assert.equal(rows[0].v===null,held));
 });
 // Reader H alone is no block for normal public target B or unrelated lobby.
 await tx(async()=>{await state(C,'processing');await call('reader-only',C,'select * from get_public_battle_ratings($1)',['bravo'],{count:1});await call('reader-only/lobby',C,'select * from battle_matches where id=$1',[waiting],{count:1});});
 for(const actor of [J,O])await tx(async()=>{await state(actor,'processing');await call('staff-held/'+actor,actor,'select * from get_battle_disputes_for_moderation()',[],{count:1});await call('staff-held/reports/'+actor,actor,'select * from battle_reports',[],{count:1});});
 // Every indirect identity column carried by a public match is covered.
 for(const column of ['host_id','guest_id','moderator_id','paused_by','winner_id'])await tx(async()=>{
  await q('update battle_matches set '+column+'=$1 where id=$2',[A,otherMatch]);await state(A,'processing');
  await call('indirect-column/'+column,B,'select * from battle_matches where id=$1',[otherMatch],{count:0});
 });
 // Profile writes: same RPC/DML, no new endpoint. Public->custom/private narrows.
 for(const s of ['normal','processing','closure'])for(const op of ['display','avatar','username','visibility-public','visibility-custom','private-field'])await tx(async()=>{
  await state(A,s);let sql,params=[A];
  if(op==='display')sql="update profiles set display_name='changed' where id=$1";
  if(op==='avatar')sql="select set_my_public_profile(null,null,'changed.jpg')";
  if(op==='username')sql="select set_my_public_profile('newalpha',null,null)";
  if(op==='visibility-public')sql="select set_my_public_profile(null,'public',null)";
  if(op==='visibility-custom')sql="select set_my_public_profile(null,'custom',null)";
  if(op==='private-field')sql="update profiles set locale='en' where id=$1";
  if(sql.startsWith('select'))params=[];
  const denied=s!=='normal'&&(['display','avatar','username'].includes(op)||(s==='closure'&&op.startsWith('visibility')));
  // A repeated public RPC only changes profile_updated_at (normal operation).
  const changes=denied?[]:['public.profiles'];if(op==='username'&&!denied)changes.unshift('public.username_reservations');changes.sort();
  await call(s+'/profile-write/'+op,A,sql,params,{denied,changes});
 });
 for(const vis of ['private','custom'])await tx(async()=>{await q('update profiles set collection_visibility=$2 where id=$1',[A,vis]);await state(A,'processing');await call('no-expand/'+vis,A,"select set_my_public_profile(null,'public',null)",[],{denied:true});});
 for(const u of [A,B])await tx(async()=>{await q("update profiles set collection_visibility='custom' where id=$1",[u]);await state(u,'processing');await call('custom-held/public-collection',null,'select * from get_public_duelvanta_collection($1)',[u===A?'alpha':'bravo'],{role:'anon',count:1});});
 // Bind actual collection owner even in trusted no-subject maintenance context.
 for(const s of ['processing','closure'])for(const table of ['collection_items','collection_folders'])await tx(async()=>{await state(A,s);await call('target-owner/'+s+'/'+table,null,`update ${table} set ${table==='collection_items'?"card_name='expanded'":"is_public=true"} where user_id=$1`,[A],{role:'postgres',denied:true});});
 await tx(async()=>{await state(A,'processing');await call('cross-owner-insert',null,"insert into collection_items(user_id,tcg,card_name) values($1,'pokemon','new')",[A],{role:'postgres',denied:true});});

 for(const target of [A,B])for(const s of ['normal','processing','closure'])await tx(async()=>{
  await state(target,s);
  for(const bucket of ['profile-avatars','collection-cards']){
   await call(s+'/image-own-read/'+bucket,target,'select * from storage.objects where bucket_id=$1 and name=$2',[bucket,target+'/existing.webp'],{count:1});
   await call(s+'/image-foreign-read/'+bucket,C,'select * from storage.objects where bucket_id=$1 and name=$2',[bucket,target+'/existing.webp'],{count:0});
   await call(s+'/image-anon/'+bucket,null,'select * from storage.objects',[],{role:'anon',denied:true});
   await call(s+'/image-insert/'+bucket,target,'insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,target+'/new.webp'],{denied:s!=='normal',changes:s==='normal'?['storage.objects']:[]});
   await call(s+'/image-overwrite/'+bucket,target,"update storage.objects set metadata='{\"new\":true}' where bucket_id=$1 and name=$2 returning id",[bucket,target+'/existing.webp'],{count:s==='normal'?1:0,changes:s==='normal'?['storage.objects']:[]});
   await call(s+'/image-upsert/'+bucket,target,"insert into storage.objects(bucket_id,name) values($1,$2) on conflict(bucket_id,name) do update set metadata='{\"upsert\":true}'",[bucket,target+'/existing.webp'],{denied:s!=='normal',changes:s==='normal'?['storage.objects']:[]});
  }
 });
 // Direct profile update cannot combine Hold onset with identity expansion.
 await tx(async()=>{await call('atomic-hold-and-expand',null,"update profiles set data_processing_restricted_at=now(),display_name='new' where id=$1",[A],{role:'postgres',denied:true});});
 assert.deepEqual(await snap(),baseline,'all scenarios rollback');
 if(native){
  for(const mode of ['profile','collection','image']){
   const held=mode==='profile'?A:mode==='collection'?B:C;
   const holder=await db.connect(),writer=await db.connect(),observer=await db.connect();
   await claim(holder,held);await claim(writer,null,'postgres');await holder.query('begin');await writer.query('begin');
   await holder.query("select request_my_account_deletion('KONTO LÖSCHEN',$1)",[uid(seq++)]);
   const pid=(await writer.query('select pg_backend_pid() pid')).rows[0].pid;
   if(mode==='image'){await claim(writer,held);}
   const pending=writer.query(mode==='profile'?"update profiles set display_name='late' where id=$1":mode==='collection'?"insert into collection_items(user_id,tcg,card_name) values($1,'pokemon','late')":"insert into storage.objects(bucket_id,name) values('profile-avatars',$1 || '/late.webp')",[held]).then(()=>null,e=>e.message);
   let locks;for(let i=0;i<150;i++){const b=(await observer.query('select pg_blocking_pids($1) blockers',[pid])).rows[0].blockers;if(b.length){locks=(await observer.query('select locktype,mode,granted from pg_locks where pid=$1',[pid])).rows;break;}await delay(20);}
   assert.ok(locks?.some(x=>!x.granted),'actual wait');await holder.query('commit');assert.match(await pending,/publication_processing_restricted|row-level security/);await writer.query('rollback');out.races.push({mode,pid,locks});

  }
 }
 out.passed=true;out.acceptance=native;
}catch(e){out.failure=e.stack;console.error(e);process.exitCode=1;}
finally{await mkdir('test-results',{recursive:true});await writeFile('test-results/publication-processing-hold-'+(native?'native':'preparation')+'.json',JSON.stringify(out,null,2));console.log(JSON.stringify({passed:out.passed,native,cases:out.cases.length,races:out.races.length,failure:out.failure}));await db.close();}
