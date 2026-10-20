// Disposable synthetic fixtures. Never connects to a hosted/user database.
import assert from 'node:assert/strict';
import {readFile,cp,mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join,basename} from 'node:path';
import {createRequire,syncBuiltinESMExports} from 'node:module';
import {gzipSync} from 'node:zlib';
import {randomUUID} from 'node:crypto';
import {prepareSyntheticSnapshot} from '../../tcg-catalog-persistence-v1.mjs';
import {baseline,install as installI2} from './tcg-i2-fixture.mjs';
import {admin,claim,A} from './publication-hold-fixture.mjs';
export const fixture=JSON.parse(await readFile(new URL('../fixtures/tcg-i3-magic/persistence-v1.json',import.meta.url),'utf8'));
// Every M4 test entrypoint shares this fail-closed process boundary. Only an
// explicitly native harness may connect to the configured local PG port.
const ioKey=Symbol.for('DUELVANTA_M4_FORBIDDEN_IO');
if(!globalThis[ioKey]){
 const require=createRequire(import.meta.url),boundary=globalThis[ioKey]={attempts:[],local_pg_connections:0};
 const deny=kind=>function(){boundary.attempts.push(kind);throw new Error('FORBIDDEN_IO '+kind);};
 for(const key of ['fetch','WebSocket','XMLHttpRequest'])Object.defineProperty(globalThis,key,{value:deny(key),configurable:true,writable:true});
 for(const name of ['http','https'])for(const key of ['request','get'])require('node:'+name)[key]=deny(name+'.'+key);
 require('node:tls').connect=deny('TLS');
 const net=require('node:net'),connect=net.Socket.prototype.connect;
 net.Socket.prototype.connect=function(...args){const options=typeof args[0]==='object'?args[0]:{port:args[0],host:args[1]};if((process.argv.includes('--native')||process.env.F3_NATIVE_PG==='1')&&options.host==='127.0.0.1'&&Number(options.port)===Number(process.env.PGPORT||5432)){boundary.local_pg_connections++;return connect.apply(this,args);}return deny('TCP').apply(this,args);};
 const dns=require('node:dns');for(const object of [dns,dns.promises,dns.Resolver.prototype,dns.promises.Resolver.prototype])for(const key of Object.getOwnPropertyNames(object))if(/^(lookup|resolve|reverse)/.test(key)&&typeof object[key]==='function')object[key]=deny('DNS.'+key);
 syncBuiltinESMExports();process.on('exit',()=>{process.stderr.write(JSON.stringify({forbidden_io_attempts:boundary.attempts,local_pg_connections:boundary.local_pg_connections})+'\n');if(boundary.attempts.length)process.exitCode=1;});
}
export const clone=x=>structuredClone(x),uuid=n=>'85000000-0000-4000-8000-'+String(n).padStart(12,'0');
export function card(overrides={}){return {...clone(fixture.card),...overrides};}
export function syntheticSnapshot({cards=[card()],sets=[clone(fixture.set)],time='2026-10-01T00:00:00Z',snapshot_id=randomUUID(),manifest_overrides={}}={}){
 const bytes=gzipSync(Buffer.from(cards.map(x=>JSON.stringify(x)).join('\n')+'\n'));
 const manifest={object:'bulk_data',id:uuid(1),type:'all_cards',updated_at:time,uri:'https://api.scryfall.com/bulk-data/'+uuid(1),jsonl_download_uri:'https://data.scryfall.io/all-cards/all-cards-20261001000000.jsonl.gz',compressed_size:bytes.length,...manifest_overrides};
 return prepareSyntheticSnapshot({snapshot_id,manifest,compressed_bytes:bytes,sets_response_bytes:Buffer.from(JSON.stringify({object:'list',has_more:false,data:sets})),retrieved_at:'2026-10-04T00:00:00Z'});
}
export const tempSQL=String.raw`
 create temporary table tcg_catalog_stage_header(
 id uuid,game_key text,provider_key text,provider_version text,bulk_id uuid,bulk_type text,bulk_updated_at timestamptz,download_uri text,format text,compressed_size bigint,compressed_sha256 text,jsonl_sha256 text,sets_response_sha256 text,manifest_sha256 text,raw_manifest jsonb,scope_contract text,scope_sha256 text,retrieved_at timestamptz,record_count bigint,accepted_cards bigint,accepted_variants bigint,accepted_sets bigint,sealed_at timestamptz) on commit drop;
 create temporary table tcg_catalog_stage_sets(external_id uuid primary key,name text not null,record_version text not null) on commit drop;
 create temporary table tcg_catalog_stage_cards(external_id uuid primary key,set_external_id uuid not null references tcg_catalog_stage_sets,provider_lang text not null,language_code text not null,locale text not null,collector_number text not null,name text not null,rarity text not null,record_version text not null) on commit drop;
 create temporary table tcg_catalog_stage_variants(card_external_id uuid not null references tcg_catalog_stage_cards,locale text not null,finish text not null,artwork text not null,treatment text not null,edition text,validated_evidence jsonb not null,evidence_sha256 text not null,reference_external_id uuid not null references tcg_catalog_stage_cards,reference_record_version text not null,primary key(card_external_id,locale,finish)) on commit drop;
 create temporary table tcg_catalog_stage_records(entity_kind text not null check(entity_kind in ('set','card')),external_id uuid not null,locale text,raw_record jsonb not null,canonical_utf8 bytea not null,content_sha256 text not null,record_version text not null,source_path text not null,retrieved_at timestamptz not null,unique nulls not distinct(entity_kind,external_id,locale)) on commit drop;
 `;
export async function stage(db,input){
 await db.exec(tempSQL);
 const groups=[['header',[input.stage_header]],['sets',input.stage_sets],['cards',input.stage_cards],['variants',input.stage_variants],['records',input.stage_records]];
 for(const [group,rows] of groups)for(const row of rows){
  const keys=Object.keys(row);assert.ok(keys.every(k=>/^[a-z_][a-z0-9_]*$/.test(k)));
  const values=keys.map(k=>k==='canonical_utf8'?Buffer.from(row[k],'utf8'):row[k]!==null&&typeof row[k]==='object'?JSON.stringify(row[k]):row[k]);
  await db.query('insert into pg_temp.tcg_catalog_stage_'+group+'('+keys.join(',')+') values('+keys.map((k,i)=>'$'+(i+1)).join(',')+')',values);
 }
}
export async function publish(db,input,generation,{transaction=true}={}){
 if(transaction)await db.exec('begin');
 try{await stage(db,input);const result=(await db.query('select dv_collect_private.tcg_publish_catalog_snapshot_v1($1,$2) id',[input.stage_header.id,generation])).rows[0].id;if(transaction)await db.exec('commit');return result;}
 catch(e){if(transaction)await db.exec('rollback');throw e;}
}
export async function install(db){await db.exec(await readFile(new URL('../../database/tcg-i3-magic-persistence-v1.sql',import.meta.url),'utf8'));await db.exec(await readFile(new URL('../../database/tcg-i3-magic-readiness-v1.sql',import.meta.url),'utf8'));}
export async function database(native=false){
 if(native){
  assert.ok(['localhost','127.0.0.1'].includes(process.env.PGHOST));assert.equal(process.env.PGDATABASE,'postgres');
  const {default:pg}=await import('pg');const local={host:'127.0.0.1',ssl:false,connectionTimeoutMillis:5000};const owner=new pg.Client(local);await owner.connect();
  const version=(await owner.query('show server_version_num')).rows[0].server_version_num;assert.equal(Math.floor(Number(version)/10000),17);
  assert.equal((await owner.query('select current_user')).rows[0].current_user,'postgres');
  const name='tcg_m4_'+randomUUID().replaceAll('-',''),connections=[];await owner.query('create database '+name);
  const createdRoles=[];
  const connect=async()=>{const c=new pg.Client({...local,database:name});await c.connect();await c.query("set statement_timeout='12s';set idle_in_transaction_session_timeout='30s'");c.exec=sql=>c.query(sql);connections.push(c);return c;},client=await connect();
  const exec=async sql=>{
   const preamble='create role anon;create role authenticated;create role service_role bypassrls;';
   if(sql.includes(preamble)){
    for(const role of ['anon','authenticated','service_role']){
     const row=(await client.query('select rolcanlogin,rolbypassrls,rolsuper from pg_roles where rolname=$1',[role])).rows[0];
     if(row){assert.equal(row.rolcanlogin,false);assert.equal(row.rolsuper,false);assert.equal(row.rolbypassrls,role==='service_role');}
     else{await client.query('create role '+role+(role==='service_role'?' bypassrls':''));createdRoles.push(role);}
    }
    sql=sql.replace(preamble,'');
   }
   return client.query(sql);
  };
  return {name,version,native:true,connect,client,query:(...args)=>client.query(...args),exec,close:async()=>{for(const c of connections)await c.end();await owner.query('drop database '+name);for(const role of createdRoles)await owner.query('drop role '+role);await owner.end();}};
 }
 const {PGlite}=await import('@electric-sql/pglite'),{pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');return new PGlite({extensions:{pgcrypto}});
}
export async function setup(db){await baseline(db);await installI2(db);await install(db);await admin(db);}
export const scalar=async(db,sql,params=[])=>(await db.query(sql,params)).rows[0]?.v;
export async function rollbackCase(db,fn){await admin(db);await db.exec('begin');try{return await fn();}finally{await db.exec('rollback');await admin(db);}}
export const copyInput=()=>({folder_id:null,card_name:fixture.card.name,set_name:fixture.set.name,card_number:fixture.card.collector_number,language:'EN',variant:null,condition:'NM',quantity:1,grading_company:null,grade:null,cert_number:null,purchase_price:null,purchase_date:null,market_price:null,currency:'EUR',notes:null,contract_version:'1'});
export const save=(db,id,input=copyInput())=>scalar(db,'select public.save_my_tcg_collection_item_v1($1,$2,$3) v',[id,'magic',JSON.stringify(input)]);

// Historical native suites run before M4 roles exist. Their exact sources and
// reports live in a separate temporary checkout; no eleventh candidate path.
export const nativeRegressions=Object.freeze([
 {id:'X05',entry:'tests/tcg-i2-database-test.mjs',args:['--native'],report:'tcg-i2-database-native.json'},
 {id:'X06',entry:'tests/account-erasure-l1-test.mjs',args:['--native'],report:'account-erasure-l1-native.json'},
 {id:'X06',entry:'tests/publication-processing-hold-test.mjs',args:['--native'],report:'publication-processing-hold-native.json'},
 {id:'X06',entry:'tests/account-deletion-withdrawal-test.mjs',args:['--native'],report:'account-deletion-withdrawal-native.json'},
 {id:'X06',entry:'tests/account-data-export-collect-battle-test.mjs',args:['--native','--trade-lock'],report:'account-data-export-native-lock.json'},
 {id:'X06',entry:'tests/account-data-erasure-username-guard-test.mjs',args:[],report:null},
 {id:'X06',entry:'tests/account-data-erasure-worker-test.mjs',args:[],report:null},
 {id:'X07',entry:'tests/collect-binder-delete-database-test.mjs',args:[],report:null},
 {id:'X07',entry:'tests/collect-binder-delete-concurrency-test.mjs',args:[],report:'collect-f3-postgres.json'},
]);
export async function runNativeRegressions(){
 assert.ok(['localhost','127.0.0.1'].includes(process.env.PGHOST));assert.equal(process.env.PGDATABASE,'postgres');
 const root=fileURLToPath(new URL('../../',import.meta.url));const sandbox=await mkdtemp(join(dirname(root.replace(/\/$/,'')),'m4-native-regressions-'));const results=[];
 try{
  await cp(root,sandbox,{recursive:true,filter:path=>!['.git','node_modules','test-results'].includes(basename(path))});
  for(const spec of nativeRegressions){
   const child=spawnSync(process.execPath,[spec.entry,...spec.args],{cwd:sandbox,encoding:'utf8',env:{...process.env,PGHOST:'127.0.0.1',F3_NATIVE_PG:'1',F3_HEAD_SHA:'70db8cde7b7ce244d10800eb0ffd1e0cfd44eaf4',NODE_OPTIONS:(process.env.NODE_OPTIONS||'')+' --import '+join(sandbox,'tests/helpers/tcg-i3-magic-fixture.mjs')},maxBuffer:32*1024*1024});assert.equal(child.error,undefined);assert.equal(child.status,0,child.stderr);const log=child.stdout+'\n'+child.stderr;
   let report=null;
   if(spec.report){report=JSON.parse(await readFile(join(sandbox,'test-results',spec.report),'utf8'));assert.ok(report.passed===true||report.status==='PASS');assert.ok(report.cases.length>0);if(Object.hasOwn(report,'acceptance'))assert.equal(report.acceptance,true);if(spec.id==='X05'){assert.equal(report.cases.length,32);assert.equal(report.engine,'native-PG17');}if(spec.entry.includes('concurrency')){assert.equal(report.cases.length,15);assert.ok(report.cases.every(c=>c.passed&&c.block.waiting_lock));}}
   else assert.match(log,/PASS/);
   const result={...spec,status:'PASS',report};results.push(result);
   if(process.env.TCG_M4_EVIDENCE_DIR){await mkdir(process.env.TCG_M4_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.TCG_M4_EVIDENCE_DIR,basename(spec.entry)+'.native.log'),log);if(report)await writeFile(join(process.env.TCG_M4_EVIDENCE_DIR,spec.report),JSON.stringify(report,null,2)+'\n');}
  }
  return results;
 }finally{await rm(sandbox,{recursive:true,force:true});}
}
// Classification follows executable callback requirements, not a claimed count.
export function executionRequirements(fn){
 const source=Function.prototype.toString.call(fn);
 const sql=/\bdb\b|\b(tx|v|count|badPublish|drift|state|generation|active|rollbackCase|ownRef|save|search|receipt|ready|publish|database|nativePublicationRace|upgradeRehearsal)\s*\(/.test(source);
 const regression=/\bnativeRegressionReports\b/.test(source);
 const connections=/\bnativePublicationRace\s*\(/.test(source);
 return {classification:sql||regression?'REQUIRES_NATIVE_PG17':'NON_NATIVE_EXECUTABLE',requirements:[...(sql?['native PostgreSQL 17 SQL/ACL/RLS/SECURITY DEFINER contract']:[]),...(regression?['unchanged native legacy regression entrypoints']:[]),...(connections?['independent connections and observed lock blocking']:[])],pglite_precheck_executable:!connections&&!/assert\.equal\(native,true\)/.test(source)};
}

export async function upgradeRehearsal(native){
 const reports=[];
 for(const existing of [false,true]){
  const db=await database(native);
  try{
   await baseline(db);await installI2(db);await admin(db);
   if(existing)for(const [i,game] of [[950,'pokemon'],[951,'one_piece']])await db.query("insert into public.collection_items(id,user_id,tcg,card_name,card_number,notes) values($1,$2,$3,'Legacy rehearsal','001★','preserve')",[uuid(i),A,game]);
   const fks=()=>db.query("select conrelid::regclass::text relation,conname,pg_get_constraintdef(oid) definition from pg_constraint where contype='f' order by 1,2");
   const oldFKs=(await fks()).rows;
   const legacy=await scalar(db,"select coalesce(jsonb_agg(to_jsonb(i) order by id),'[]') v from public.collection_items i");
   const protectedBodies=await scalar(db,"select jsonb_agg(jsonb_build_array(oid::regprocedure::text,pg_get_functiondef(oid)) order by oid::regprocedure::text) v from pg_proc where oid in ('public.export_my_duelvanta_data()'::regprocedure,'public.prepare_account_deletion_data(uuid,uuid)'::regprocedure,'dv_market_private.reject_new_trade_while_locked_v1()'::regprocedure)");
   assert.equal((await scalar(db,'select public.get_security_schema_readiness_v1() v')).compatible,true);
   await install(db);await admin(db);
   const afterFKs=(await fks()).rows;for(const old of oldFKs)assert.deepEqual(afterFKs.find(r=>r.relation===old.relation&&r.conname===old.conname),old);
   assert.deepEqual(await scalar(db,"select coalesce(jsonb_agg(to_jsonb(i) order by id),'[]') v from public.collection_items i"),legacy);
   assert.deepEqual(await scalar(db,"select jsonb_agg(jsonb_build_array(oid::regprocedure::text,pg_get_functiondef(oid)) order by oid::regprocedure::text) v from pg_proc where oid in ('public.export_my_duelvanta_data()'::regprocedure,'public.prepare_account_deletion_data(uuid,uuid)'::regprocedure,'dv_market_private.reject_new_trade_while_locked_v1()'::regprocedure)"),protectedBodies);
   assert.equal((await scalar(db,'select public.get_market_legal_schema_readiness_v1() v')).compatible,true);
   assert.ok(!(await scalar(db,"select pg_get_constraintdef(oid) v from pg_constraint where conname='market_listings_tcg_check'")).includes('magic'));
   await claim(db,A);const readiness=await scalar(db,'select public.get_tcg_catalog_readiness_v1() v');assert.equal(readiness.schema_compatible,true);assert.equal(readiness.activation_compatible,false);
   reports.push({existing,legacy_rows:legacy.length,protected_fks:oldFKs.length});
  }finally{await db.close();}
 }
 return reports;
}
