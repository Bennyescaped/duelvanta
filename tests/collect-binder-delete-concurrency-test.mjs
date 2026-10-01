import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {createDatabase} from './helpers/f3-native-db.mjs';
const migrationPath='supabase/migrations/20260921144947_collect_empty_binder_delete.sql';
const migration=await readFile(new URL('../'+migrationPath,import.meta.url),'utf8');
const report={commit:process.env.F3_HEAD_SHA,checkoutCommit:process.env.GITHUB_SHA,migrationPath,migrationSha256:createHash('sha256').update(migration).digest('hex'),cases:[],passed:false};
assert.ok(report.commit,'CI head commit is required');
const db=await createDatabase(),observer=db.client;
const USER='91000000-0000-4000-8000-000000000001';
const rpc="select public.dv_collect_delete_empty_binder($1) as result";
let writer,deleter,wpid,dpid;
const transaction=async c=>{await c.query('begin');await c.query('set local role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[USER,JSON.stringify({sub:USER,role:'authenticated',is_anonymous:false})]);assert.equal((await c.query('select current_user')).rows[0].current_user,'authenticated')};
const launch=fn=>{const task={settled:false};task.promise=fn().then(value=>{task.settled=true;return{ok:true,value}},error=>{task.settled=true;return{ok:false,code:error.code,message:error.message}});return task};
async function blocked(waiter,holder,task){
 const deadline=Date.now()+6000;
 while(Date.now()<deadline){
  const row=(await observer.query(`select pid,wait_event_type,pg_blocking_pids(pid) blockers,
    exists(select 1 from pg_locks l where l.pid=a.pid and not granted) waiting_lock
    from pg_stat_activity a where pid=$1`,[waiter])).rows[0];
  if(row?.blockers.includes(holder)&&row.wait_event_type==='Lock'&&row.waiting_lock)return row;
  assert.equal(task.settled,false,'Operation completed without the required observed interconnection block');
  await new Promise(r=>setTimeout(r,30));
 }
 assert.fail('Required blocking edge was not observed within bounded wait');
}
const snapshot=async(folder,card)=>({folder:(await observer.query('select id from public.collection_folders where id=$1',[folder])).rows,card:(await observer.query('select * from public.collection_items where id=$1',[card])).rows});
async function race(kind,first,ending){
 const folder=randomUUID(),source=randomUUID(),card=randomUUID();
 await observer.query("insert into public.collection_folders(id,user_id,name) values($1,$3,'F3 target'),($2,$3,'F3 source')",[folder,source,USER]);
 if(kind==='assign')await observer.query('insert into public.collection_items(id,user_id,folder_id,binder_page,binder_slot) values($1,$2,$3,3,4)',[card,USER,source]);
 const initial=await snapshot(folder,card);
 const write=()=>kind==='insert'?writer.query('insert into public.collection_items(id,user_id,folder_id,binder_page,binder_slot) values($1,$2,$3,2,5) returning *',[card,USER,folder]):writer.query('update public.collection_items set folder_id=$1 where id=$2 returning *',[folder,card]);
 await transaction(writer);await transaction(deleter);
 const record={case:`${first==='writer'?(kind==='insert'?'A':'B'):(kind==='insert'?'C':'D')}-${ending}`,kind,first,ending,initial};
 let expected;
 if(first==='writer'){
  const result=await write();assert.equal(result.rows.length,1);record.writeResult=result.rows;
  const task=launch(()=>deleter.query(rpc,[folder]));record.block=await blocked(dpid,wpid,task);
  const winnerCommit=ending==='commit';await writer.query(winnerCommit?'commit':'rollback');record.writerTransaction=winnerCommit?'commit':'rollback';
  const deletion=await task.promise;record.deleteResult=deletion.ok?deletion.value.rows:{code:deletion.code,message:deletion.message};
  if(winnerCommit){assert.equal(deletion.ok,false);assert.equal(deletion.code,'P0001');assert.equal(deletion.message,'binder_not_empty');await deleter.query('rollback');record.deleteTransaction='rollback';expected={folder:initial.folder,card:result.rows}}
  else{
   assert.equal(deletion.ok,true);assert.deepEqual(deletion.value.rows[0].result,{status:'deleted'});
   const loserCommit=ending!=='rollback-both';await deleter.query(loserCommit?'commit':'rollback');record.deleteTransaction=loserCommit?'commit':'rollback';expected={folder:loserCommit?[]:initial.folder,card:initial.card};
  }
 }else{
  record.deleteResult=(await deleter.query(rpc,[folder])).rows;assert.deepEqual(record.deleteResult[0].result,{status:'deleted'});
  const task=launch(write);record.block=await blocked(wpid,dpid,task);
  const winnerCommit=ending==='commit';await deleter.query(winnerCommit?'commit':'rollback');record.deleteTransaction=winnerCommit?'commit':'rollback';
  const written=await task.promise;record.writeResult=written.ok?written.value.rows:{code:written.code,message:written.message};
  if(winnerCommit){assert.equal(written.ok,false);assert.equal(written.code,'23503');await writer.query('rollback');record.writerTransaction='rollback';expected={folder:[],card:initial.card}}
  else{
   assert.equal(written.ok,true);assert.equal(written.value.rows.length,1);
   const loserCommit=ending!=='rollback-both';await writer.query(loserCommit?'commit':'rollback');record.writerTransaction=loserCommit?'commit':'rollback';expected={folder:initial.folder,card:loserCommit?written.value.rows:initial.card};
  }
 }
 record.final=await snapshot(folder,card);assert.deepEqual(record.final,expected);record.passed=true;report.cases.push(record);console.log('PASS',record.case);
}
try{
 await db.exec(await readFile(new URL('./fixtures/collect-f3-baseline.sql',import.meta.url),'utf8'));
 await db.exec(migration); // Exact file bytes: no replacement or reimplemented deletion function.
 writer=await db.connect();deleter=await db.connect();
 wpid=(await writer.query('select pg_backend_pid() pid')).rows[0].pid;dpid=(await deleter.query('select pg_backend_pid() pid')).rows[0].pid;
 report.connections={writer:wpid,deleter:dpid,observer:(await observer.query('select pg_backend_pid() pid')).rows[0].pid};assert.equal(new Set(Object.values(report.connections)).size,3);
 report.postgresql=(await observer.query('select version() version,current_setting(\'transaction_isolation\') isolation')).rows[0];
 for(const kind of ['insert','assign'])for(const first of ['writer','deleter'])for(const ending of ['commit','rollback-winner','rollback-both'])await race(kind,first,ending);
 for(const ending of ['commit','rollback-winner','rollback-both']){
  const id=randomUUID();await observer.query("insert into public.collection_folders(id,user_id,name) values($1,$2,'F3 double')",[id,USER]);
  await transaction(writer);await transaction(deleter);const first=(await writer.query(rpc,[id])).rows[0].result;assert.deepEqual(first,{status:'deleted'});
  const task=launch(()=>deleter.query(rpc,[id]));const lock=await blocked(dpid,wpid,task);
  await writer.query(ending==='commit'?'commit':'rollback');const second=await task.promise;assert.equal(second.ok,true);assert.deepEqual(second.value.rows[0].result,{status:ending==='commit'?'unavailable':'deleted'});
  await deleter.query(ending==='rollback-both'?'rollback':'commit');const rows=(await observer.query('select id from public.collection_folders where id=$1',[id])).rows;assert.equal(rows.length,ending==='rollback-both'?1:0);
  await transaction(writer);const repeat=(await writer.query(rpc,[id])).rows[0].result;assert.deepEqual(repeat,{status:ending==='rollback-both'?'deleted':'unavailable'});await writer.query('rollback');
  report.cases.push({case:'F-'+ending,first,second:second.value.rows,block:lock,writerTransaction:ending==='commit'?'commit':'rollback',deleteTransaction:ending==='rollback-both'?'rollback':'commit',final:rows,repeat,repeatTransaction:'rollback',passed:true});
 }
 assert.equal(report.cases.length,15);assert.ok(report.cases.every(c=>c.passed&&c.block.waiting_lock));report.passed=true;
 console.log('PASS',JSON.stringify(report));
}catch(error){report.failure=String(error);throw error}
finally{
 await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await writeFile(new URL('../test-results/collect-f3-postgres.json',import.meta.url),JSON.stringify(report,null,2));
 if(writer)await writer.query('rollback').catch(()=>{});if(deleter)await deleter.query('rollback').catch(()=>{});await db.close();
}
