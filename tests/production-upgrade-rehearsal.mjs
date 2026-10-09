import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadProductionUpgradeSources,reconstructProductionBaseline,applyProductionUpgrade} from './helpers/production-upgrade-fixture.mjs';
import {baselineChecks,snapshotOriginal,unchangedOriginal,foreignKeys,beforeUpgradeAbort,finalChecks,assertReviewedActionsSource} from './helpers/production-upgrade-checks.mjs';
import {securityQuery} from './generate-security-readiness.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const native=process.argv.includes('--native');
let db;
if(native){const {createDatabase}=await import('./helpers/f3-native-db.mjs');db=await createDatabase();}
else{const {PGlite}=await import('@electric-sql/pglite');const {pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');db=new PGlite({extensions:{pgcrypto}});}
const report={source_head:process.env.P001_HEAD_SHA||'local candidate',runner_sha:process.env.GITHUB_SHA||null,started_at:new Date().toISOString(),engine:native?'native-postgresql17':'pglite-pg18',scenario:process.argv.includes('--empty')?'empty':'synthetic-existing',status:'RUNNING',steps:[]};
const source=await loadProductionUpgradeSources(),{manifest,history}=source;
let stage='bootstrap';
try {
 await reconstructProductionBaseline(db,source,value=>{stage=value;});
 console.log('BASELINE SQL PASS',history.length);
 const catResults=await db.exec(await read('tests/fixtures/production-upgrade/catalog-readonly.sql'));
 const localCatalog=Array.isArray(catResults)?catResults.find(x=>x.rows?.[0]?.catalog)?.rows[0].catalog:catResults.rows[0].catalog;
 await mkdir('test-results',{recursive:true});await writeFile('test-results/production-baseline-catalog.json',JSON.stringify(localCatalog,null,2));
 const counts=(await db.query(`select n.nspname,count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','dv_v16_private') and c.relkind='r' group by 1`)).rows;console.log(counts);
 const fs=(await db.query(`select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,md5(pg_get_functiondef(p.oid)) definition_md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_v16_private') order by 1,2,3`)).rows;
 await mkdir('test-results',{recursive:true});await writeFile('test-results/production-baseline-functions.json',JSON.stringify(fs,null,2));
 report.baseline=await baselineChecks(db,localCatalog,fs,native);
 if(!process.argv.includes('--baseline-only')){
 stage='synthetic legacy fixture';if(!process.argv.includes('--empty'))await db.exec(await read('tests/fixtures/production-upgrade/synthetic-existing-data.sql'));
 report.before_fks=await foreignKeys(db);const before=await snapshotOriginal(db,localCatalog);
 report.abort=await beforeUpgradeAbort(db,before);await assertReviewedActionsSource();
 const plan=JSON.parse(await read('database/production-upgrade-manifest-v1.json'));
 await applyProductionUpgrade(db,plan,{onStart:value=>{stage=value;},onApplied:step=>{report.steps.push(step);console.log('APPLIED',step.id,step.source);}});
 await db.exec('set search_path=pg_catalog,public');
 const readiness=(await db.query('select public.get_security_schema_readiness_v1() security,public.get_market_legal_schema_readiness_v1() legal')).rows[0];
 report.readiness=readiness;report.integrity=await finalChecks(db,before,process.argv.includes('--empty'));
 console.log('READINESS',readiness);
 await writeFile('test-results/production-upgrade-functions.json',JSON.stringify((await db.query("select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,p.prosrc,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_market_private','dv_v16_private','dv_collect_private','battle_spectator_private','battle_spectator_media_private')")).rows,null,2));
 const actual=(await db.query(securityQuery)).rows[0].jsonb_agg;
 const expected=JSON.parse((await read('database/security-readiness-v1.sql')).match(/\$catalog\$([\s\S]*?)\$catalog\$/)[1]);
 const map=a=>new Map(a.map(([kind,name,hash])=>[kind+':'+name,hash]));const am=map(actual),em=map(expected);
 const diff=[...new Set([...am.keys(),...em.keys()])].filter(k=>am.get(k)!==em.get(k)).map(key=>({key,actual:am.get(key),expected:em.get(key)}));
 await writeFile('test-results/production-upgrade-readiness-diff.json',JSON.stringify(diff,null,2));
 console.log('READINESS DIFF',diff.length,diff.map(x=>x.key));
 assert.equal(readiness.security.compatible,true,'Security readiness must pass unchanged');assert.equal(readiness.legal.compatible,true,'Legal readiness must pass unchanged');
 if(process.argv.includes('--trade-lock')){stage='P0-05 lock';const {testProductionTradeLock}=await import('./helpers/production-trade-lock-checks.mjs');report.trade_lock=await testProductionTradeLock(db);}
 if(process.argv.includes('--data-export')){
  stage='T2 export after reconstructed upgrade';
  await db.exec('reset role');
  await db.exec(await read('database/account-data-export-collect-battle-v1.sql'));
  await db.exec(await read('database/account-data-export'+(process.argv.includes('--trade-lock')?'-trade-lock':'')+'-readiness-v1.sql'));
  if(process.argv.includes('--processing-markers')){
   assert.ok(process.argv.includes('--trade-lock'));
   await db.exec(await read('database/account-processing-markers-v1.sql'));
   await db.exec(await read('database/account-processing-markers-readiness-v1.sql'));
  }
  if(process.argv.includes('--closure-privacy')){
   assert.ok(process.argv.includes('--processing-markers'));
   await db.exec(await read('database/account-closure-privacy-v1.sql'));
   await db.exec(await read('database/account-closure-privacy-readiness-v1.sql'));
  }
  if(process.argv.includes('--scanner-hold')){
   assert.ok(process.argv.includes('--closure-privacy'));
   await db.exec(await read('database/scanner-processing-hold-v1.sql'));
   await db.exec(await read('database/scanner-processing-hold-readiness-v1.sql'));
  }
  if(process.argv.includes('--battle-player-hold')){
   assert.ok(process.argv.includes('--scanner-hold'));
   await db.exec(await read('database/battle-player-processing-hold-v1.sql'));
   await db.exec(await read('database/battle-player-processing-hold-readiness-v1.sql'));
  }
  if(process.argv.includes('--battle-signal-hold')){
   assert.ok(process.argv.includes('--battle-player-hold'));
   await db.exec(await read('database/battle-signal-processing-hold-v1.sql'));
   await db.exec(await read('database/battle-signal-processing-hold-readiness-v1.sql'));
  }
 if(process.argv.includes('--spectator-withdrawal')){
  await db.exec(await read('database/battle-spectator-withdrawal-v1.sql'));
  await db.exec(await read('database/battle-spectator-withdrawal-readiness-v1.sql'));
 }
 if(process.argv.includes('--spectator-epoch-hold')){
  await db.exec(await read('database/battle-spectator-epoch-processing-hold-v1.sql'));
  await db.exec(await read('database/battle-spectator-epoch-processing-hold-readiness-v1.sql'));
 }
 if(process.argv.includes('--staff-hold')){
  if(!process.argv.includes('--spectator-epoch-hold'))throw Error('D3 regression requires D2');
  await db.exec(await read('database/staff-processing-hold-v1.sql'));
  await db.exec(await read('database/staff-processing-hold-readiness-v1.sql'));
 }
 if(process.argv.includes('--publication-hold')){
  if(!process.argv.includes('--staff-hold'))throw Error('D4 requires closed D3');
  await db.exec(await read('database/publication-processing-hold-v1.sql'));
  await db.exec(await read('database/publication-processing-hold-readiness-v1.sql'));
 if(process.argv.includes('--b1-safety')){await db.exec(await read('database/battle-safety-sanctions-v1.sql'));await db.exec(await read('database/battle-safety-sanctions-readiness-v1.sql'));}
 if(process.argv.includes('--c-withdrawal')){await db.exec(await read('database/account-deletion-withdrawal-v1.sql'));await db.exec(await read('database/account-deletion-withdrawal-readiness-v1.sql'));}
 if(process.argv.includes('--l1-erasure')){await db.exec(await read('database/account-erasure-l1-v1.sql'));await db.exec(await read('database/account-erasure-l1-readiness-v1.sql'));}


 }
  const r=(await db.query('select public.get_security_schema_readiness_v1() security,public.get_market_legal_schema_readiness_v1() legal')).rows[0];
  assert.equal(r.security.compatible,true);assert.equal(r.legal.compatible,true);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:'10000000-0000-4000-8000-000000000003',role:'authenticated',aal:'aal1'})]);
  await db.exec('set role authenticated');
  const exported=(await db.query('select public.export_my_duelvanta_data() payload')).rows[0].payload;
  assert.equal(exported.export_version,'duelvanta-data-export-v3');
  assert.ok(Array.isArray(exported.marketplace.pickup_messages));assert.ok(exported.scanner&&exported.battle);
  report.data_export={status:'PASS',version:exported.export_version,readiness:r};
  console.log('T2 EXPORT AFTER FULL P0-01/P0-02/P0-05 CHAIN PASS');
 }
 report.status='PASS';console.log(process.argv.includes('--trade-lock')?'P0-05 REHEARSAL COMPLETE':'P0-01 REHEARSAL COMPLETE');
 }
} catch(e){report.status='FAIL';report.failed_stage=stage;report.error=e.message;console.error('FAILED',stage,e.message,e.detail||'',e.where||'',e.hint||'',e.position||'');process.exitCode=1;}
finally{await db.close();report.cleanup='isolated database closed/deleted';report.finished_at=new Date().toISOString();await mkdir('test-results',{recursive:true});await writeFile('test-results/'+(process.argv.includes('--trade-lock')?'production-trade-lock-':'production-upgrade-')+report.scenario+'-'+(native?'native':'wasm')+(process.argv.includes('--spectator-withdrawal')?'-d1':'')+(process.argv.includes('--spectator-epoch-hold')?'-d2':'')+'.json',JSON.stringify(report,null,2));}
