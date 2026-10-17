import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const native=process.argv.includes('--native');
const db=native?await (await import('./helpers/f3-native-db.mjs')).createDatabase():new PGlite();
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',F='20000000-0000-4000-8000-000000000001',G='20000000-0000-4000-8000-000000000002';
const id=n=>'30000000-0000-4000-8000-'+String(n).padStart(12,'0');
const claim=async(uid=A,c=db)=>{await c.query('reset role');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);await c.query('set role authenticated');};
const place=(n,page,slot,f=F,c=db)=>c.query('select public.place_my_magic_scan_item_v1($1,$2,$3,$4::smallint) value',[id(n),f,page,slot]);
const deny=(fn,re)=>assert.rejects(fn,re);
const cases=[];
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select '{}'::jsonb$$;
 grant usage on schema auth to authenticated;
 create table public.collection_folders(id uuid primary key,user_id uuid,binder_pages integer);
 create table public.collection_items(id uuid primary key,user_id uuid,folder_id uuid,tcg text,binder_page integer,binder_slot smallint,image_path text);
 create unique index collection_items_binder_position_unique on public.collection_items(user_id,folder_id,binder_page,binder_slot) where binder_page is not null and binder_slot is not null;
 alter table public.collection_folders enable row level security;alter table public.collection_items enable row level security;
 create policy own_folder on public.collection_folders to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 create policy own_item on public.collection_items to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
 grant select,update on public.collection_folders,public.collection_items to authenticated;
 create table public.test_gate(ready boolean);insert into public.test_gate values(true);grant select on public.test_gate to authenticated;
 create function public.get_magic_on_demand_collection_beta_v1() returns jsonb language sql as $$select jsonb_build_object('magic_on_demand_collection_beta',ready) from public.test_gate$$;
 insert into public.collection_folders values('${F}','${A}',2),('${G}','${B}',2);
 insert into public.collection_items values('${id(1)}','${A}','${F}','magic',null,null,'protected.jpg'),('${id(2)}','${A}','${F}','magic',1,2,null),('${id(3)}','${B}','${G}','magic',null,null,null),('${id(4)}','${A}','${F}','pokemon',1,4,null);`);
 await db.exec(await readFile(new URL('../database/local-candidates/magic-scanner-r22-r3/placement.sql',import.meta.url),'utf8'));
 await claim();await place(1,1,3);await place(1,1,3);
 assert.equal((await db.query(`select image_path from public.collection_items where id='${id(1)}'`)).rows[0].image_path,'protected.jpg');
 await deny(()=>place(1,1,1),/already_placed/);await deny(()=>place(3,1,1,G),/binder_not_owned/);await deny(()=>place(3,1,1),/item_not_owned/);await deny(()=>place(4,1,1),/item_not_owned/);
 await deny(()=>place(1,3,1),/page_invalid/);await deny(()=>place(1,1,0),/destination_invalid/);await deny(()=>place(1,1,null),/destination_invalid/);
 cases.push('owner RLS, Magic-only, page/slot validation, exact position idempotence, existing image preserved');
 await db.exec(`reset role;insert into public.collection_items values('${id(5)}','${A}','${F}','magic',null,null,null);`);await claim();await deny(()=>place(5,1,2),/slot_occupied/);
 await db.exec('reset role;update public.test_gate set ready=false');await claim();await deny(()=>place(5,1,1),/not_admitted/);
 await db.exec('reset role;update public.test_gate set ready=true');await claim('');await deny(()=>place(5,1,1),/not_admitted/);
 await db.exec('reset role;set role anon');await deny(()=>place(5,1,1),/permission denied/);
 await db.exec(`reset role;insert into public.collection_items values('${id(6)}','${A}','${F}','magic',null,null,null)`);await claim();await deny(()=>place(5,1,1),/occupied_by_legacy/);
 await place(5,1,5);cases.push('occupied explicit and implicit slots rejected, admission/hold unavailable, anonymous and missing user denied');
 if(native){
  // Observe a real unique-index conflict with an independent writer: a preflight
  // SELECT alone is insufficient. No existing row is unplaced or swapped.
  await db.exec(`reset role;insert into public.collection_items values('${id(7)}','${A}','${F}','magic',null,null,null),('${id(8)}','${A}','${F}','magic',null,null,null)`);
  const writer=await db.connect(),reader=await db.connect();await claim(A,writer);await claim(A,reader);
  await writer.query('begin');await writer.query(`update public.collection_items set binder_page=2,binder_slot=9 where id='${id(8)}'`);
  const pid=(await reader.query('select pg_backend_pid() pid')).rows[0].pid;let settled=false;
  const pending=place(7,2,9,F,reader).then(()=>({ok:true}),e=>({error:e.message})).finally(()=>settled=true);
  let blocked=false;for(let i=0;i<50;i++){const q=await db.query('select cardinality(pg_blocking_pids($1)) n',[pid]);if(q.rows[0].n>0){blocked=true;break;}await new Promise(r=>setTimeout(r,20));}
  assert.equal(blocked,true);assert.equal(settled,false);await writer.query('commit');assert.match((await pending).error,/duplicate key/);
  assert.equal((await db.query(`select binder_slot from public.collection_items where id='${id(7)}'`)).rows[0].binder_slot,null);
  cases.push('native PG17: independently observed racing writer lock; unique index rejects collision without overwriting target');
 }
 const report={candidate_only:true,staging_applied:false,engine:native?'native PostgreSQL17':'PGlite',cases};
 await mkdir(new URL('../test-results/tcg-i3-m6-r22-r3/',import.meta.url),{recursive:true});await writeFile(new URL('../test-results/tcg-i3-m6-r22-r3/placement.json',import.meta.url),JSON.stringify(report,null,2));
 console.log('PASS R22-R3 isolated placement candidate',JSON.stringify(report));
}finally{await db.close()}
