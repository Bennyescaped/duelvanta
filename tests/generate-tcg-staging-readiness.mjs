// Offline authoring only. Expected inventories are never learned at application runtime.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {securitySchemaFixture,read} from './helpers/security-schema-fixture.mjs';
import {contracts,queries as i2Queries} from './generate-tcg-i2-readiness.mjs';
import {queries as m4Queries,helperSQL as m4Helper,syntheticActive,syntheticSuspended} from './generate-tcg-i3-magic-readiness.mjs';
import {queries as m6Queries,helperSQL as m6Helper} from './generate-tcg-i3-magic-on-demand-readiness.mjs';
// Importing this existing fixture installs its transport-denial guard; setup() is NOT used.
import {syntheticSnapshot,stage} from './helpers/tcg-i3-magic-fixture.mjs';

export const HEAD='daf28df42157c5db975c718a296534469750086b';
export const BOUND_BLOBS={
  "tests/helpers/security-schema-fixture.mjs": "cfb841b6824918d48414aee806f5044209652cbe",
  "tests/generate-legal-readiness.mjs": "99891c1956030001e304db0f1b1d405dfe75ea2c",
  "tests/helpers/legal-schema-fixture.mjs": "165946442dd65243a30e5744c045dfeebe029264",
  "tests/generate-security-readiness.mjs": "fa697dd51ed80c72edd3d195a1e3f761ea935451",
  "database/battle-spectator-media-v1.sql": "f3dbe985efa832729de1e4555398684ddf42837a",
  "supabase/migrations/20260921144947_collect_empty_binder_delete.sql": "b8a832f38fb021a3098d67881d09f7d03b810a58",
  "evidence/production-readiness-20260924/staging-supplemental.json": "a04cd26702f25f3abca0ae725822bb4086fe5192",
  "database/battle-spectator-media-reconciler-v1.sql": "3014a788240fadbce7f0bbe9bdaefbabdf208336",
  "database/collect-scanner-v16-weekly-quota.sql": "043105062869dac35c9d12b9455355dd9e54f78e",
  "tests/helpers/legal-readiness-catalog.mjs": "76dbaf5f066350711e1fa41cd965a0bfed145d71",
  "database/collect-scanner-v16-owner-control.sql": "e5a48488d7b3d2463b8caa8714d4906a4fc734a1",
  "database/auth-privileged-step-up-v1.sql": "c97ce94bc7fd208219f2fc8fc5d78399322d7feb",
  "database/battle-spectator-foundation-v1.sql": "f0dc0e626b2cc073d0e186c9faa6d16643083591",
  "database/security-privilege-mfa-hardening-v1.sql": "1d431be8c83bfcc6d89cad04668470a659273d52",
  "database/account-closure-privacy-v1.sql": "6c2705f2c9bc4b641f4b825ac6252f32ae00c47c",
  "database/account-processing-markers-v1.sql": "23bc2fe9773791de1e72eff817cf17a3d2e4f064",
  "database/publication-processing-hold-v1.sql": "142d180b6e176c4ed505582dcaf5ad76979a2357",
  "tests/fixtures/legal-readiness/reviewed-default-privileges.sql": "813ad1fe36cd5ec73a7344c58667622b5b78eec8",
  "database/battle-player-processing-hold-v1.sql": "c059c92f1f7d70690a6754c023e0b19acd1582d7",
  "tests/fixtures/legal-readiness/staging-catalog-boundaries.json.gz": "d35de3a61f0649dbb0a1dcade7e5a22bcce3d081",
  "tests/fixtures/legal-readiness/reviewed-baseline-indexes.sql": "bbbd757bd262c4e17f1107750c73242047c1148d",
  "database/battle-spectator-withdrawal-v1.sql": "b3c8ca7bf1610d829ab2f43d58b6288ff373fe5f",
  "database/account-deletion-withdrawal-v1.sql": "73c8d73a00be7dd56671f5b03a9dee54f18d112d",
  "database/tcg-i3-magic-persistence-v1.sql": "54f9435eabf6bfff2a71984d250de4c58bb39414",
  "database/security-readiness-v1.sql": "de3805536a1b8345a8de5de0d3e16fedd079d6c7",
  "database/tcg-i2-canonical-integration-v1.sql": "2e4ee265a1086342c844139ea5ba9834a2d2db56",
  "evidence/legal-step6-preflight-20260922/staging-application-schema.json.gz": "2e85fdbfb662f18b2925f654ff04b5f6a3227dae",
  "database/tcg-i3-magic-readiness-v1.sql": "cc5be22431f2805d4fce7f303cf82a76be3bbaeb",
  "database/market-production-trade-lock-readiness-v1.sql": "c926db06a98e57c8cb913f1dd93260e5f8037e60",
  "database/staff-processing-hold-v1.sql": "9b1ae6c4a53f0c3713c66dd7bb6e08b6c644ea78",
  "database/market-production-trade-lock-v1.sql": "3dd1af54a585604d2a020e81e91531668dd04c30",
  "database/battle-safety-sanctions-v1.sql": "b32e0e406e391de3bb79984bbb5468ec329b8ce9",
  "database/tcg-i3-magic-on-demand-v1.sql": "922319c6a9bb04572c176734a4a2c2d32da44dcf",
  "database/scanner-processing-hold-v1.sql": "2c7bcfd472e7a419413b664227d52ac5544d17f9",
  "database/battle-signal-processing-hold-v1.sql": "f1b4c8b12e40f581edfb995810a617aafc86637d",
  "database/battle-spectator-epoch-processing-hold-v1.sql": "b0c8a06430eba33650b062c153da3c5f9ad3ba19",
  "database/account-data-export-collect-battle-v1.sql": "a049ca443c29f7744683c5540237d10508f07ca5",
  "database/account-erasure-l1-v1.sql": "e3c27a4ca7da5c5a066f25113664cfb30af21492",
  "evidence/production-readiness-20260924/staging-catalog.json.gz": "58eee682a62b5b61fce999b26c9507da93f2cdf6",
  "database/tcg-i2-readiness-v1.sql": "0e00df8e348eab1e7a7967894f6cdabee45b16a3",
  "database/tcg-i3-magic-on-demand-readiness-v1.sql": "4c526eedd22f979059ab42c25aae0353ac1ee5b6",
  "supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql": "c7b5df68a6d4dd37804e0efd59f9a076957b3dc8",
  "tcg-catalog-evidence-v1.mjs": "d8a527289d1ce6889e2c867067bf421908e4b02c",
  "tcg-v1-catalog-providers.js": "7fbb77bc5a4f30d481d4e960f945c5d929d6e474",
  "tests/helpers/tcg-i3-magic-fixture.mjs": "d87354560904ea9a49c11297e19e6f0b87556aa5",
  "tests/generate-tcg-i2-readiness.mjs": "9c8ecbca5fe4b1b8b53c8a4826fd1ea45a748e93",
  "tcg-v1-registry.js": "82241a3f7a55e33302f9c14f246f3ec8e9294926",
  "tests/generate-tcg-i3-magic-readiness.mjs": "b48698160c87a72e92d2fae7185e7b4480711a78",
  "tests/generate-tcg-i3-magic-on-demand-readiness.mjs": "88943c8930b45a1043f017b5c2467744cadbb6b2",
  "tests/helpers/tcg-i2-fixture.mjs": "6a2cb178851c79bd9da52f4ea63d971f120448df",
  "tests/helpers/publication-hold-fixture.mjs": "c585b2359ccfe723718e8547541cafaf1ecc95be",
  "tcg-v1-contracts.js": "8a76050cb9377ff7aea301464819209f98f99f6e",
  "tcg-v1-game-adapters.js": "041e553360cb21243efad4d9878dda3aa359233e",
  "tcg-catalog-persistence-v1.mjs": "061f01e1d8abcea11641e10ea5215bb23df32011",
  "tests/fixtures/tcg-i3-magic/persistence-v1.json": "3314d3ae4999c5823cbb1d6c8f8d07b910c42f00",
  "database/account-erasure-l1-readiness-v1.sql": "e952af426c4ce6d80bcc2bf6bcf46a389a02c180"
};
export const OUTPUTS=['database/tcg-i2-readiness-staging-v1.sql','database/tcg-i3-magic-readiness-staging-v1.sql','database/tcg-i3-magic-on-demand-readiness-staging-v1.sql'];
export const COMMON=['account-data-export-collect-battle-v1','account-processing-markers-v1','account-closure-privacy-v1','scanner-processing-hold-v1','battle-player-processing-hold-v1','battle-signal-processing-hold-v1','battle-spectator-withdrawal-v1','battle-spectator-epoch-processing-hold-v1','staff-processing-hold-v1','publication-processing-hold-v1','battle-safety-sanctions-v1','account-deletion-withdrawal-v1','account-erasure-l1-v1'];
const LOCK='dv_market_private.reject_new_trade_while_locked_v1';
const digest=(s,algorithm='sha256')=>createHash(algorithm).update(s).digest('hex');
export const sha256=s=>digest(s);
const roots=['get_security_schema_readiness_v1','get_market_legal_schema_readiness_v1'];
const revisions=['privilege-mfa-v1','trade-legal-contract-model-v1.2'];
const guardNames=['tcg_catalog_schema_readiness_v1','tcg_magic_on_demand_schema_v1'];
const header='-- GENERATED by tests/generate-tcg-staging-readiness.mjs; DO NOT EDIT.\n-- STAGING/PREVIEW authored profile; OFFLINE CANDIDATE, NOT FOR REAL APPLY.\n';

export async function verifySources(){
 assert.ok(Object.keys(BOUND_BLOBS).length>40,'source ledger missing');
 const ledger={};
 for(const [path,blob] of Object.entries(BOUND_BLOBS)){
  const bytes=await readFile(new URL('../'+path,import.meta.url));
  assert.equal(digest(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes]),'sha1'),blob,'source drift: '+path);
  ledger[path]={git_blob:blob,sha256:digest(bytes)};
 }
 return ledger;
}
async function noLock(db){
 const r=(await db.query(`select to_regprocedure('${LOCK}()') f,(select count(*)::int from pg_trigger where tgname='a00_production_trade_lock_v1') n`)).rows[0];
 assert.equal(r.f,null);assert.equal(r.n,0);return r;
}
async function readiness(db,expected=true,beta=false){
 const r=(await db.query('select public.get_security_schema_readiness_v1() s,public.get_market_legal_schema_readiness_v1() l')).rows[0];
 for(const [i,k] of ['s','l'].entries()){
  assert.equal(r[k].revision,revisions[i]);assert.equal(r[k].compatible,expected,JSON.stringify(r));
  if(beta)assert.equal(r[k].tcg_beta_contract,'magic-on-demand-collect-beta/1');
 }
 return r;
}
// Rebind the required-function query parameter from the actual catalog, not from an
// edited expected inventory. Every missing member except the forbidden environment
// function or a precisely declared helper about to be authored is a hard failure.
async function stagingQueries(db,original,planned=[]){
 const [sq,lq]=original;
 const match=lq.match(/required_functions\(name\) as \(values ([\s\S]*?)\),\s*checks as/);
 assert.ok(match,'bound required_functions query template changed');
 const names=[...match[1].matchAll(/\('([^']+)'\)/g)].map(x=>x[1]);
 assert.equal(names.filter(n=>n===LOCK).length,1);
 const actual=[];
 for(const name of [...new Set(names)].sort()){
  const present=(await db.query('select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname||\'.\'||p.proname=$1) v',[name])).rows[0].v;
  if(name===LOCK){assert.equal(present,false);continue;}
  assert.ok(present||planned.includes(name),'STOP_STAGING_BASELINE_NOT_REPRODUCIBLE missing '+name);
  actual.push(name);
 }
 const replacement=actual.map(n=>"('"+n+"')").join(',');
 const bound=lq.replace(match[1],replacement);
 assert.ok(!bound.includes(LOCK));return [sq,bound];
}
async function inventories(db,queries){
 const out=[];for(const q of queries){const r=(await db.query(q)).rows[0].jsonb_agg;assert.ok(Array.isArray(r));out.push(r);}return out;
}
function simpleRoot(name,revision,query,expected,index){return `create or replace function public.${name}() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
 declare actual jsonb;begin ${query} into actual;
 return jsonb_build_object('revision','${revision}','compatible',coalesce(actual=$catalog$${JSON.stringify(expected)}$catalog$::jsonb,false)${index===1?" and coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)":''});
 exception when others then return jsonb_build_object('revision','${revision}','compatible',false);end$$;
 revoke all on function public.${name}() from public,anon,authenticated,service_role;
 grant execute on function public.${name}() to authenticated;
`;}
const bootstrapQuery=name=>`select md5(p.prosrc) body,r.rolname owner,pg_get_function_arguments(p.oid) args,pg_get_function_result(p.oid) result,p.proconfig config,p.provolatile volatility,p.prosecdef definer,p.proacl::text acl
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='dv_collect_private' and p.proname='${name}'`;
async function bootstrap(db,name){const b=(await db.query(bootstrapQuery(name))).rows;assert.equal(b.length,1);assert.equal(b[0].owner,'postgres');assert.equal(b[0].args,'');assert.equal(b[0].result,'jsonb');return b[0];}
function bridge(name,revision,index,phase,b,states){
 const helper=guardNames[phase===4?0:1];
 const beta=phase===6?",'tcg_beta_contract','magic-on-demand-collect-beta/1'":'';
 const target=phase===4?`case a->>'state' when 'foundation' then $foundation$${JSON.stringify(states[0][index])}$foundation$::jsonb when 'active' then $active$${JSON.stringify(states[1][index])}$active$::jsonb when 'suspended' then $suspended$${JSON.stringify(states[2][index])}$suspended$::jsonb end`:`$target$${JSON.stringify(states[0][index])}$target$::jsonb`;
 return `create or replace function public.${name}() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $bridge$
 declare a jsonb;b jsonb;expected jsonb;compatible boolean:=false;begin
 select jsonb_build_object('body',md5(p.prosrc),'owner',r.rolname,'args',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),'config',p.proconfig,'volatility',p.provolatile,'definer',p.prosecdef,'acl',p.proacl::text) into b
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='dv_collect_private' and p.proname='${helper}';
 if b is distinct from $bootstrap$${JSON.stringify(b)}$bootstrap$::jsonb then return jsonb_build_object('revision','${revision}','compatible',false${beta});end if;
 a:=dv_collect_private.${helper}();expected:=${target};
 compatible:=coalesce(a->'${index===0?'security_inventory':'legal_inventory'}'=expected,false)${index===1?" and coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)":''};
 return jsonb_build_object('revision','${revision}','compatible',compatible${beta});
 exception when others then return jsonb_build_object('revision','${revision}','compatible',false${beta});end$bridge$;
 revoke all on function public.${name}() from public,anon,authenticated,service_role;
 grant execute on function public.${name}() to authenticated;
`;
}
function rebindHelper(template,original,staging){assert.equal(template.split(original[1]).length,2);return template.replace(original[1],staging[1]);}
function transactionBody(sql){
 // Only standalone outer transaction statements, never PL/pgSQL BEGIN or SQL text.
 return sql.replace(/^[ \t]*begin;[ \t]*$/gmi,'').replace(/^[ \t]*commit;[ \t]*$/gmi,'');
}
async function wrongProfile(db,source,phase){
 await db.exec('begin;savepoint wrong_profile');
 try{
  if(phase===6)await db.exec('drop function dv_collect_private.tcg_magic_on_demand_schema_v1()');
  await db.exec(transactionBody(await read(source)));
  const r=await readiness(db,false,phase===6);return r;
 }finally{await db.exec('rollback to wrong_profile;commit');}
}
async function injectedLock(db,q){
 const before=await inventories(db,q);
 await db.exec('begin;savepoint adversarial_environment');
 try{
  await db.exec(transactionBody(await read('database/market-production-trade-lock-v1.sql')));
  const after=await inventories(db,q);assert.notDeepEqual(after,before);
  const rejected=await readiness(db,false);
  return {fingerprint_before:sha256(JSON.stringify(before)),fingerprint_injected:sha256(JSON.stringify(after)),staging_profile_rejected:rejected};
 }finally{await db.exec('rollback to adversarial_environment;commit');await noLock(db);}
}
async function metadata(db){
 const constraints=(await db.query("select conname,pg_get_constraintdef(oid) definition from pg_constraint where conname in ('collection_items_tcg_check','market_listings_tcg_check') order by conname")).rows;
 assert.equal(constraints.length,2);assert.ok(!constraints.find(c=>c.conname==='market_listings_tcg_check').definition.includes('magic'));
 return {constraints,lock:await noLock(db)};
}
export async function generate({write=false}={}){
 assert.ok(!process.argv.includes('--native')&&process.env.F3_NATIVE_PG!=='1','offline authoring refuses native target options');
 const sources=await verifySources(),db=new PGlite({extensions:{pgcrypto}}),files={},report={authoring_only:true,native_acceptance:false,sources,phases:{},negative:{},real_io:{supabase_queries:0,provider_live_requests:0,user_data_rows_read:0,real_database_writes:0}};
 try{
  await securitySchemaFixture(db);
  for(const f of ['auth-privileged-step-up-v1','security-privilege-mfa-hardening-v1','security-readiness-v1'])await db.exec(await read('database/'+f+'.sql'));
  await db.exec('set search_path=pg_catalog,public');
  report.authoring_engine=(await db.query('select version() version,current_user operator')).rows[0];
  report.baseline={readiness:await readiness(db),...await metadata(db),tcg_foundation:(await db.query("select to_regclass('dv_collect_private.tcg_games') games,to_regclass('dv_collect_private.tcg_providers') providers,to_regclass('dv_collect_private.tcg_provider_bindings') bindings,to_regclass('dv_collect_private.tcg_catalog_releases') releases,to_regclass('dv_collect_private.tcg_magic_on_demand_beta') beta,to_regprocedure('public.get_magic_on_demand_collection_beta_v1()') beta_rpc")).rows[0]};
  for(const value of Object.values(report.baseline.tcg_foundation))assert.equal(value,null);
  for(const f of COMMON)await db.exec(await read('database/'+f+'.sql'));
  // Build-only preparatory bridge, no fourth output file and no real-apply source.
  const preparatory=await stagingQueries(db,(await contracts()).map(c=>c.query));
  const prepInventory=await inventories(db,preparatory);
  await db.exec(roots.map((n,i)=>simpleRoot(n,revisions[i],preparatory[i],prepInventory[i],i)).join(''));
  report.pre_i2={readiness:await readiness(db),...await metadata(db)};
  await db.exec(await read('database/tcg-i2-canonical-integration-v1.sql'));
  // Match the I2 public root's fixed deparser context; M4 uses its private helper.
  await db.exec('set search_path=pg_catalog,public');
  const i2=await stagingQueries(db,await i2Queries()),i2Expected=await inventories(db,i2);
  files[OUTPUTS[0]]=header+'begin;\n'+roots.map((n,i)=>simpleRoot(n,revisions[i],i2[i],i2Expected[i],i)).join('')+'commit;\n';
  await db.exec(files[OUTPUTS[0]]);
  report.phases.I2={readiness:await readiness(db),...await metadata(db),inventory_counts:i2Expected.map(x=>x.length)};
  report.negative.production_I2=await wrongProfile(db,'database/tcg-i2-readiness-v1.sql',2);
  report.negative.lock_injection_I2=await injectedLock(db,i2);
  await db.exec('set search_path=pg_catalog,public,dv_collect_private');
  await db.exec(await read('database/tcg-i3-magic-persistence-v1.sql'));
  const m4Original=await m4Queries(),m4=await stagingQueries(db,m4Original,['dv_collect_private.'+guardNames[0]]);
  const h4=rebindHelper(await m4Helper(),m4Original,m4);await db.exec(h4);
  await db.exec('savepoint author_states');
  const sample=syntheticSnapshot({snapshot_id:'97000000-0000-4000-8000-000000000001'});await stage(db,sample);
  await db.query('select dv_collect_private.tcg_publish_catalog_snapshot_v1($1,0)',[sample.stage_header.id]);
  const states=[];for(let i=0;i<3;i++){if(i===1)await db.exec(syntheticActive);if(i===2)await db.exec(syntheticSuspended);states.push(await inventories(db,m4));}
  await db.exec('rollback to author_states');
  assert.deepEqual(await inventories(db,m4),states[0],'foundation inventory must not depend on synthetic snapshot');
  const b4=await bootstrap(db,guardNames[0]);
  files[OUTPUTS[1]]=header+'-- Completes the open common M4 delta transaction.\n'+h4+roots.map((n,i)=>bridge(n,revisions[i],i,4,b4,states)).join('')+'commit;\n';
  await db.exec(files[OUTPUTS[1]]);
  report.phases.M4={readiness:await readiness(db),...await metadata(db),inventory_counts:states.map(s=>s.map(x=>x.length)),release:(await db.query("select game_key,provider_key,provider_version,state,schema_phase,snapshot_id from dv_collect_private.tcg_catalog_releases where game_key='magic'")).rows};
  assert.equal(report.phases.M4.release[0].snapshot_id,null);
  assert.equal(report.phases.M4.release[0].state,'foundation');
  report.negative.production_M4=await wrongProfile(db,'database/tcg-i3-magic-readiness-v1.sql',4);
  report.negative.lock_injection_M4=await injectedLock(db,m4);
  await db.exec(await read('database/tcg-i3-magic-on-demand-v1.sql'));
  const m6Original=await m6Queries(),m6=await stagingQueries(db,m6Original);
  const h6=rebindHelper(await m6Helper(),m6Original,m6);
  await db.exec('savepoint author_m6');await db.exec(h6);
  const expected6=await inventories(db,m6),b6=await bootstrap(db,guardNames[1]);
  await db.exec('rollback to author_m6');
  files[OUTPUTS[2]]=header+'-- Completes the open common M6 delta; never activates beta.\n'+h6+roots.map((n,i)=>bridge(n,revisions[i],i,6,b6,[expected6])).join('')+'commit;\n';
  await db.exec(files[OUTPUTS[2]]);
  report.phases.M6={readiness:await readiness(db,true,true),...await metadata(db),inventory_counts:expected6.map(x=>x.length),beta:(await db.query('select * from dv_collect_private.tcg_magic_on_demand_beta')).rows};
  assert.equal(report.phases.M6.beta.length,1);assert.equal(report.phases.M6.beta[0].enabled,false);
  report.negative.production_M6=await wrongProfile(db,'database/tcg-i3-magic-on-demand-readiness-v1.sql',6);
  report.negative.lock_injection_M6=await injectedLock(db,m6);
  await readiness(db,true,true);await noLock(db);
  const boundary=globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')];
  assert.deepEqual(boundary.attempts,[]);assert.equal(boundary.local_pg_connections,0);
  report.transport_boundary=structuredClone(boundary);
  for(const [path,sql] of Object.entries(files)){
   assert.ok(!sql.includes(LOCK));assert.ok(!sql.includes('a00_production_trade_lock_v1'));
   assert.equal((sql.match(/^commit;$/gm)||[]).length,1);
   assert.equal((sql.match(/^begin;$/gm)||[]).length,path===OUTPUTS[0]?1:0);
  }
  report.output_sha256=Object.fromEntries(Object.entries(files).map(([p,s])=>[p,sha256(s)]));
  await verifySources();
  if(write)for(const [path,sql] of Object.entries(files))await writeFile(new URL('../'+path,import.meta.url),sql);
  return {files,report};
 }finally{await db.close();}
}
if(process.argv[1]?.endsWith('generate-tcg-staging-readiness.mjs')){
 const r=await generate({write:process.argv.includes('--write')});
 console.log(JSON.stringify(r.report,null,2));
}
