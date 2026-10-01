import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=process.env.F3_NATIVE_PG==='1'?await (await import('./helpers/f3-native-db.mjs')).createDatabase():new PGlite();
const USER='91000000-0000-4000-8000-000000000001',OTHER='91000000-0000-4000-8000-000000000002';
const migration=await readFile(new URL('../supabase/migrations/20260921144947_collect_empty_binder_delete.sql',import.meta.url),'utf8');
const claim=async(uid=USER,role='authenticated',anonymous=false)=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${uid||''}',false);select set_config('request.jwt.claims','{"is_anonymous":${anonymous}}',false);set role ${role}`);
const scalar=async sql=>(await db.query(sql)).rows[0].value;
const rpc=id=>scalar(`select public.dv_collect_delete_empty_binder('${id}') value`);
const folder=async(user=USER)=>{await claim(null,'service_role');return scalar(`insert into public.collection_folders(user_id,name) values('${user}','F3 isolated') returning id value`)};
try{
 await db.exec(await readFile(new URL('./fixtures/collect-f3-baseline.sql',import.meta.url),'utf8'));
 await db.exec(migration);
 let id=await folder();await claim();assert.equal(await scalar('select current_user value'),'authenticated');
 assert.deepEqual(await rpc(id),{status:'deleted'});assert.deepEqual(await rpc(id),{status:'unavailable'});
 id=await folder(OTHER);await claim();assert.deepEqual(await rpc(id),{status:'unavailable'});
 assert.deepEqual(await rpc('99000000-0000-4000-8000-000000000000'),{status:'unavailable'});
 id=await folder();await claim(null,'anon');await assert.rejects(()=>rpc(id),/permission denied/);
 await claim(null);await assert.rejects(()=>rpc(id),/authentication_required/);
 await claim(USER,'authenticated',true);await assert.rejects(()=>rpc(id),/authentication_required/);
 await db.exec(`reset role;update public.profiles set data_processing_restricted_at=now() where id='${USER}'`);
 await claim();await assert.rejects(()=>rpc(id),/account_data_processing_restricted/);
 await db.exec(`reset role;update public.profiles set data_processing_restricted_at=null`);
 await claim();await assert.rejects(()=>db.exec(`delete from public.collection_folders where id='${id}'`),/permission denied/);
 await assert.rejects(()=>db.exec('truncate public.collection_folders cascade'),/permission denied/);
 for(const owner of [USER,OTHER]){
  id=await folder();await claim(null,'service_role');
  await db.exec(`insert into public.collection_items(user_id,folder_id,binder_page,binder_slot) values('${owner}','${id}',2,5)`);
  const before=await scalar(`select row_to_json(i) value from public.collection_items i where folder_id='${id}'`);
  await claim();assert.equal(Number(await scalar(`select count(*) value from public.collection_items where folder_id='${id}'`)),owner===USER?1:0);
  await assert.rejects(()=>rpc(id),/binder_not_empty/);
  await claim(null,'service_role');assert.deepEqual(await scalar(`select row_to_json(i) value from public.collection_items i where folder_id='${id}'`),before);
  assert.equal(Number(await scalar(`select count(*) value from public.collection_folders where id='${id}'`)),1);
 }
 // Existing privileged erasure order and auth.users cascades remain possible.
 await claim(null,'service_role');await db.exec(`delete from public.collection_items where user_id='${OTHER}';delete from public.collection_folders where user_id='${OTHER}'`);
 await db.exec(`reset role;delete from auth.users where id='${USER}'`);
 assert.equal(Number(await scalar('select count(*) value from public.collection_items')),0);
 assert.equal(Number(await scalar('select count(*) value from public.collection_folders')),0);
 console.log('PASS F3 isolated PostgreSQL/PGlite SQL-role tests: owner, nonempty, invisible reference, anonymous, restricted, direct DELETE/TRUNCATE denied, repeat, erasure and auth cascade.');
 console.log(process.env.F3_NATIVE_PG==='1'?'PASS real PostgreSQL role regressions; concurrency is a separate mandatory job step.':'PGlite role tests only; no independent-connection evidence.');
}finally{await db.close()}
