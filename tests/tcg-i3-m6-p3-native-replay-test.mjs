// Replay the archived browser operations against a disposable native PG17 only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {database,setup,scalar} from './helpers/tcg-i3-magic-fixture.mjs';
import {admin,claim,A,B} from './helpers/publication-hold-fixture.mjs';
const out='test-results/tcg-i3-m6-p3',cases=[];
const report={contract:'m6-p3-native-browser-replay/1',engine:'native-PG17',passed:false,native_acceptance:false,cases};let db;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const keys=['folder_id','card_name','set_name','card_number','language','variant','condition','quantity','grading_company','grade','cert_number','purchase_price','purchase_date','market_price','currency','notes','contract_version'].sort();
const check=name=>{cases.push({name,status:'PASS'});console.log('PASS',name);};
async function denied(fn,pattern){await db.exec('savepoint p3_denied');try{await assert.rejects(fn,pattern);}finally{await db.exec('rollback to savepoint p3_denied');await db.exec('release savepoint p3_denied');}}
try{
 assert.ok(process.argv.includes('--native'),'Native PG17 is mandatory; no substitute engine');
 const bytes=await readFile(out+'/browser-payload.json'),p=JSON.parse(bytes),browser=JSON.parse(await readFile(out+'/browser-report.json'));
 assert.equal(browser.passed,true);assert.equal(browser.payload.sha256,sha(bytes));
 const fixture=await readFile('tests/fixtures/tcg-i3-magic/m6-p2-r1-live-response.json');
 assert.equal(sha(fixture),p.fixture_sha256);assert.equal(p.fixture_sha256,'960df122f5c68b0a63284c75dd8e20efce8aa4bd9f208d10ac6ac2d7c734a5aa');
 assert.equal(p.owner,A);assert.deepEqual(p.rpc.map(c=>c.name),['save_my_tcg_collection_item_v1','save_my_tcg_collection_item_v1','dv_collect_move_card','save_my_tcg_collection_item_v1']);
 assert.deepEqual(p.rpc[0].args,p.insert_save_payload);assert.deepEqual(p.rpc[1].args,p.edit_save_payload);assert.deepEqual(p.rpc[2].args,p.binder_move);assert.deepEqual(p.rpc[3].args,p.beta_off_edit_payload);
 for(const c of p.rpc.filter(c=>c.name==='save_my_tcg_collection_item_v1')){assert.deepEqual(Object.keys(c.args).sort(),['p_game_key','p_item','p_item_id']);assert.deepEqual(Object.keys(c.args.p_item).sort(),keys);assert.equal(c.args.p_game_key,'magic');}
 report.browser_payload_sha256=sha(bytes);report.fixture_sha256=p.fixture_sha256;report.insert_payload=structuredClone(p.rpc[0].args);report.browser_operations=p.rpc;check('archived browser bytes and actual 17-key operation sequence bound');
 db=await database(true);await setup(db);assert.equal(Math.floor(Number(db.version)/10000),17);
 report.version=db.version;report.postgres_major=17;report.connection={host:'127.0.0.1',port:Number(process.env.PGPORT||5432),database:db.name,disposable:true,production_staging_connection:false};
 for(const name of ['tcg-i3-magic-on-demand-v1.sql','tcg-i3-magic-on-demand-readiness-v1.sql'])await db.exec(await readFile(new URL('../database/'+name,import.meta.url),'utf8'));
 await db.exec('begin');await claim(db,A);
 await db.query('insert into public.collection_folders(id,user_id,name,binder_pages) values($1,$2,$3,2)',[p.folder_id,p.owner,'M6 P3 Magic Binder']);
 const enabled=async value=>{await admin(db);await db.query('update dv_collect_private.tcg_magic_on_demand_beta set enabled=$1',[value]);await claim(db,A);};
 const replaySave=(args,id=args.p_item_id)=>scalar(db,'select public.save_my_tcg_collection_item_v1($1,$2,$3::jsonb) v',[id,args.p_game_key,JSON.stringify(args.p_item)]);
 const readback=async()=> (await db.query('select * from public.collection_items where id=$1',[report.native_item_id])).rows[0];
 const compare=async args=>{const row=await readback();for(const [key,value] of Object.entries(args.p_item))if(key!=='contract_version')assert.deepEqual(row[key],value,key);assert.equal(row.user_id,p.owner);assert.equal(row.tcg,'magic');return row;};
 await enabled(true);const id=await replaySave(p.rpc[0].args);assert.ok(id);report.native_item_id=id;report.item_id_mapping={browser:p.browser_item_id,native:id,reason:'Legacy insert RPC generates its own ID; only subsequent p_item_id references are mapped'};
 report.insert_readback=await compare(p.rpc[0].args);check('exact archived insert payload succeeds with beta ON and complete SQL readback');
 await admin(db);
 for(const table of ['dv_collect_private.collection_item_catalog_links','dv_collect_private.tcg_provider_refs','dv_collect_private.tcg_catalog_snapshots'])assert.equal(Number(await scalar(db,'select count(*) v from '+table)),0);
 assert.equal(report.insert_readback.market_price,null);assert.equal(report.insert_readback.purchase_price,null);
 for(const key of ['card_id','catalog_card_id','provider_ref_id','image_url'])if(Object.hasOwn(report.insert_readback,key))assert.equal(report.insert_readback[key],null);
 check('no automatic price canonical identity provider link image or catalog snapshot');
 await claim(db,B);assert.equal(Number(await scalar(db,'select count(*) v from public.collection_items where id=$1',[id])),0);
 await denied(()=>replaySave(p.rpc[1].args,id),/collection_folder_not_owned/);
 assert.equal((await db.query('update public.collection_items set quantity=9 where id=$1 returning id',[id])).rows.length,0);
 assert.equal((await db.query('delete from public.collection_items where id=$1 returning id',[id])).rows.length,0);
 const move=(args,itemId)=>scalar(db,'select public.dv_collect_move_card($1,$2,$3::integer,$4::smallint) v',[itemId,args.p_folder_id,args.p_page,args.p_slot]);
 await denied(()=>move(p.binder_move,id),/binder not found|card not found/);await claim(db,A);assert.equal((await readback()).quantity,1);check('owner RLS foreign read edit delete and binder move blocked');
 await denied(()=>db.query("insert into public.collection_items(user_id,tcg,card_name,language) values($1,'magic','Direct','EN')",[A]),/row-level security/);check('direct Magic insert remains blocked with beta ON');
 assert.equal(await replaySave(p.rpc[1].args,id),id);report.edit_readback=await compare(p.rpc[1].args);check('archived edit payload uses same Legacy RPC');
 assert.equal((await move(p.rpc[2].args,id)).moved,true);assert.equal((await readback()).binder_page,1);assert.equal((await readback()).binder_slot,3);check('archived binder move SQL readback page 1 slot 3');
 await enabled(false);await denied(()=>replaySave(p.rpc[0].args),/magic_beta_unavailable/);check('beta OFF rejects exact archived new-copy payload');
 assert.equal(await replaySave(p.rpc[3].args,id),id);const final=await compare(p.rpc[3].args);
 for(const [key,value] of Object.entries(p.readback))if(key!=='id')assert.deepEqual(final[key],value,'final browser/SQL field '+key);
 report.final_readback=final;check('existing item maintained with beta OFF and full final browser SQL parity');
 await denied(()=>db.query("insert into public.market_listings(seller_id,tcg,card_name) values($1,'magic','Forbidden listing')",[A]),/check constraint|trade|listing/);
 await admin(db);assert.doesNotMatch(await scalar(db,"select pg_get_constraintdef(oid) v from pg_constraint where conrelid='public.market_listings'::regclass and conname='market_listings_tcg_check'"),/magic/);check('Marketplace Magic remains impossible');
 for(const state of [false,true]){await enabled(state);for(const game of ['pokemon','one_piece']){const legacy=await scalar(db,"insert into public.collection_items(user_id,tcg,card_name,card_number,language,notes) values($1,$2,' Free text ','007A','OTHER','Legacy') returning id v",[A,game]);await db.query("update public.collection_items set quantity=2,notes='Edited legacy' where id=$1",[legacy]);const row=(await db.query('select tcg,card_name,card_number,language,quantity,notes from public.collection_items where id=$1',[legacy])).rows[0];assert.deepEqual(row,{tcg:game,card_name:' Free text ',card_number:'007A',language:'OTHER',quantity:2,notes:'Edited legacy'});await db.query('delete from public.collection_items where id=$1',[legacy]);}}
 check('Pokemon One Piece legacy parity under beta OFF and ON');
 assert.deepEqual(globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')].attempts,[]);report.passed=true;report.native_acceptance=true;
 console.log('PASS P3 native PG17 actual browser payload replay',report.browser_payload_sha256);
}catch(error){report.error={message:error.message,stack:error.stack};console.error(error);process.exitCode=1;}
finally{
 if(db){await admin(db);await db.exec('rollback');await db.close();}
 const io=globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')];report.io={forbidden_external_io_attempts:io.attempts.slice(),local_pg_connections:io.local_pg_connections,provider_live_requests:0,production_mutations:0,staging_mutations:0};
 if(io.attempts.length){report.passed=false;report.native_acceptance=false;process.exitCode=1;}
 await mkdir(out,{recursive:true});await writeFile(out+'/native-report.json',JSON.stringify(report,null,2)+'\n');
}
