// Native disposable reconstruction, not a real migration/apply entrypoint.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {loadProductionUpgradeSources,reconstructProductionBaseline,applyProductionUpgrade,productionUpgradeSQL} from './helpers/production-upgrade-fixture.mjs';
import {baselineChecks,snapshotOriginal,foreignKeys,beforeUpgradeAbort,finalChecks,assertReviewedActionsSource} from './helpers/production-upgrade-checks.mjs';
// Static immutable source checks and the existing process transport guard only.
// Importing this module does not execute its staging runner or any generator.
import {verifySources as verifyR3Sources} from './tcg-i3-m6-p6-staging-native-test.mjs';
export const OUT='test-results/tcg-i3-m6-p6-r4';
export const HASHES = {
  "database/market-seller-compliance-v1.sql": "c946ec8fa0a16dcc5187b509052d626d8077f264180d1dbb786e25f56a2d1358",
  "database/production-upgrade/notice-action-source-61404cf.sql": "e0d23a82cd6eafb5ae0b093f5cd5c6e6803990cc80043e5244ad5ca4216f9db5",
  "database/market-checkout-compliance-v1.sql": "9e99eb0764a7dea7c6827907022fbf63613abbc62ace1b6efcef7e0b7d673d13",
  "database/market-tax-transparency-v1.sql": "78704f83dab2c5f9341398fde0fe47c728b9f5ad39c64a6a41280b6c74fd7c38",
  "database/account-data-rights-v1.sql": "10fb459dd82bdb0290a9c4cb47c5fbb3389395538acd6ef51688b8521e2e1b0f",
  "database/account-data-erasure-username-guard-v1.sql": "af97444fa3c578a9d61aeff42a249739ed56b301a2e86c72524cadef08faadfa",
  "database/market-stripe-connect-sandbox-v1.sql": "0b0b229cbb4fdec7effa3b9cc39ef47706483aba5f7dd53db9e9841786498f5a",
  "database/trade-order-lifecycle-payment-hardening-v1.sql": "33ab0fb98f72a2b55ca11e87eb1f1b4ab33569279b789a71fb054412c8e5b02b",
  "database/production-upgrade/trade-actions-reviewed-source.sql": "4419a07772ba4aad2e4adc4cdf2c71a691954ef987d4e0346a673e2831f749e8",
  "database/b07-l07-01-c2c-swap-v1-pickup.sql": "ef4ea61083e41c3e2a707c16ecb8131dea315d21e104465b30affb28ec185a82",
  "tests/fixtures/production-upgrade/catalog-readonly.sql": "e2c4885065b444e346766e91de749a054d53059010adc5d3d352da39b33b69f8",
  "tests/fixtures/production-upgrade/synthetic-existing-data.sql": "7b0c51a36189d3890c70c60eb26ac2639a80368d67a526bca9c8f2704054978f",
  "evidence/production-upgrade-p0-01-20260925/production-catalog-fresh.json": "cf932bb31e0f024c01309556a810f48765c5f9a43f2a92bb35726781eabeab2f",
  "evidence/production-upgrade-p0-01-20260925/source-fresh.json": "23719e5a30b459c4dbfc1cb42c6ce12b813a43f602f92aa9ff00da1d14585884",
  "database/market-production-trade-lock-v1.sql": "c2e26d680b45f8e1368de32f7fd74ed0696d8e192208a15b97fdb674b4838cec",
  "database/market-production-trade-lock-readiness-v1.sql": "ef27dbeddec5bac34c0989339ad73eee7705ac3474c2c431fdde60a4a5173519",
  "database/account-data-export-collect-battle-v1.sql": "df462b2a124611439ffc559797578e2356d3df94dac7ff1f2b353f0e644797e3",
  "database/account-data-export-trade-lock-readiness-v1.sql": "90ef64c033d6e58e774db14c5d311851738e2127606a4eea7bdd1ed3c9d42b73",
  "database/account-processing-markers-v1.sql": "076f2cff65745f25257b6eac124a556fcece3cc390dcb4d928c5438d4366cf2f",
  "database/account-processing-markers-readiness-v1.sql": "98e9eca26f15215cb8ddad5be4d9aac3adfe5d5d3dfbdbf70db7158310286451",
  "database/account-closure-privacy-v1.sql": "021af6ac04bddc5476daf0d2c79f094fdef658cc4d71134dbabaa850f394fc78",
  "database/account-closure-privacy-readiness-v1.sql": "f612cf8949b87865d4240978daf8cf4455aa4d0cb7c7d21365b7e891fdc4a4a1",
  "database/scanner-processing-hold-v1.sql": "1a0363c4dda8b3170a71e7b890d81a6e8acc1b6f58bcc9053e7c5733d3c65cc8",
  "database/scanner-processing-hold-readiness-v1.sql": "8cc53f828e420c75ef09588143ecdc9dd9a1752bd323fc98953c08a71901205e",
  "database/battle-player-processing-hold-v1.sql": "9b8a0a961072a84b76fea4c1b237584ecdf35e8f10cc96364f18735a44c6d293",
  "database/battle-player-processing-hold-readiness-v1.sql": "ec89dea35d9cb8be224313677a7fa5c334562fceb0b17a82ecd1d27f5ba221e3",
  "database/battle-signal-processing-hold-v1.sql": "e0e1fdeb3b7f592a026a6b02883eea145ed52d188ad8b1a2cc9cccc7bc8b0007",
  "database/battle-signal-processing-hold-readiness-v1.sql": "9d4221dbd314d77259560e306e4b1d9bfac9d5418cc8fe6e939a553bbce0575b",
  "database/battle-spectator-withdrawal-v1.sql": "6800a21fab229c240de7371527285ce865786ce90459fb87a0294cb45bbeaed1",
  "database/battle-spectator-withdrawal-readiness-v1.sql": "10db3a83786c3f23cac267ef55bfff27643fa400aabe17793c7f609fc6bc4749",
  "database/battle-spectator-epoch-processing-hold-v1.sql": "894a807750b48ee5a969f2f157869fbaf4dd7cf6cf9f1c0b91b3c8f0f50c7c11",
  "database/battle-spectator-epoch-processing-hold-readiness-v1.sql": "92a815469d1b266ce0e8d9440b3d56b5f824f6ff1eb2f5ec3dea73b734c76351",
  "database/staff-processing-hold-v1.sql": "d447651070bd2b876df188c66209fbc8c9950471ca6feb3bdd1b198b87361592",
  "database/staff-processing-hold-readiness-v1.sql": "3cc3f9bbb685d44fdfbfc381c09040da56d08cb7b2a64ddeeef6a33532b537c6",
  "database/publication-processing-hold-v1.sql": "0af9e2da31ec92668f3e4d47119e9c438fc2cf22f9a807bc6f334662acfb9da7",
  "database/publication-processing-hold-readiness-v1.sql": "6f8afae85e1feec3a9b0175b3d3919d6b96de48a2f05dc43fb875b0e07294de7",
  "database/battle-safety-sanctions-v1.sql": "4eafc71c7552ecbde7a230ad0fbf958db1cc7d31220869146bb951c75db10513",
  "database/battle-safety-sanctions-readiness-v1.sql": "bde4ac1041ac297ba20e23e6cbd75225c7cf5ba6c030392973f25266476aff8e",
  "database/account-deletion-withdrawal-v1.sql": "a353b2ae96d4756a6362451dc4ed6e1d7d1f585951ccb907d6ecc4eb50a89351",
  "database/account-deletion-withdrawal-readiness-v1.sql": "e1ae26a5fd0bd94cc13cddfb3ceb12548b357a4e72896e89ba2b4e256320b009",
  "database/account-erasure-l1-v1.sql": "980e52c2776ac18b1c202e89ab710ee4cee83dee4887e3c3b670a9b07ce41d32",
  "database/account-erasure-l1-readiness-v1.sql": "f79400c55ccf9edf7417b01cfe14c268404e86bbd78720bc0577e2b9bb5e1d27",
  "database/production-upgrade-manifest-v1.json": "9244cf325b6707c14a43b32d8cc50a374a9f7fff4f7f31fef78b4a7592a49d86",
  "database/production-upgrade/source-ledger.json": "415feb6b12738a9a510dbb6964598aad47b850b592c2acb6559be9d29da89840",
  "tests/helpers/production-upgrade-checks.mjs": "0fc19c9678df30514b66b4a1faf26c7a0763e921869c360e7f8534002967f110",
  "tests/fixtures/production-upgrade/production-history-source.json.gz": "1c9435cfb3d0f12d8041f80a57f71abe017b3d01b063144b838d838c0e195977",
  "database/production-upgrade/staging-history-source.json.gz": "dca8406cf4ca0c01480b26887ddb636ec6034078c46b27a8865aa31c93b7be78"
};
export const NAMES=['P6R4_01 PRODUCTION_72_BASELINE','P6R4_02 U001_U060_PRODUCTION_UPGRADE','P6R4_03 PRODUCTION_PREREQUISITE_CLOSURE','P6R4_04 I2_PROTECTED_PRECONDITION','P6R4_05 I2_PRODUCTION','P6R4_06 M4_PRODUCTION','P6R4_07 M6_PRODUCTION_OFF','P6R4_08 M4_ATOMIC_ROLLBACK','P6R4_09 M6_ATOMIC_ROLLBACK','P6R4_10 DUAL_BASELINE_CONVERGENCE'];
export const CLOSURE=['market-production-trade-lock','account-data-export-collect-battle','account-processing-markers','account-closure-privacy','scanner-processing-hold','battle-player-processing-hold','battle-signal-processing-hold','battle-spectator-withdrawal','battle-spectator-epoch-processing-hold','staff-processing-hold','publication-processing-hold','battle-safety-sanctions','account-deletion-withdrawal','account-erasure-l1'].map((p,i)=>['database/'+p+'-v1.sql','database/'+(i===1?'account-data-export-trade-lock':p)+'-readiness-v1.sql']);
const delta=['database/tcg-i2-canonical-integration-v1.sql','database/tcg-i3-magic-persistence-v1.sql','database/tcg-i3-magic-on-demand-v1.sql'];
const readiness=['database/tcg-i2-readiness-v1.sql','database/tcg-i3-magic-readiness-v1.sql','database/tcg-i3-magic-on-demand-readiness-v1.sql'];
export const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const json=async p=>JSON.parse(await readFile(p,'utf8'));
export async function verifySources(){const found=await verifyR3Sources();for(const [p,h] of Object.entries(HASHES)){const b=await readFile(new URL('../'+p,import.meta.url));assert.equal(sha(b),h,'immutable source '+p);found[p]=h;}return found;}
async function target(){
 assert.ok(process.argv.includes('--native'),'--native mandatory before database connection');
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.PGHOST,'127.0.0.1');assert.equal(process.env.PGUSER,'postgres');assert.equal(process.env.PGDATABASE,'postgres');assert.match(process.env.GITHUB_RUN_ID||'',/^\d+$/);
 const {default:pg}=await import('pg');const cfg={host:'127.0.0.1',user:'postgres',database:'postgres',ssl:false,connectionTimeoutMillis:5000};
 const admin=new pg.Client(cfg);await admin.connect();
 const name='p6r4_ci_'+randomUUID().replaceAll('-',''),createdRoles=[];let client,created=false,count=0;
 const attest=async(c,want)=>{const r=(await c.query("select current_database() database,current_user owner,current_setting('server_version_num') version,session_user session_owner")).rows[0];assert.equal(r.database,want);assert.equal(r.owner,'postgres');assert.equal(r.session_owner,'postgres');assert.equal(Math.floor(Number(r.version)/10000),17);count++;return r;};
 try{
  const a=await attest(admin,'postgres');await admin.query('create database '+name);created=true;
  client=new pg.Client({...cfg,database:name});await client.connect();await attest(client,name);await client.query("set statement_timeout='30s';set idle_in_transaction_session_timeout='90s'");
  const exec=async sql=>{
   // Recovery in a failed transaction uses its already-admitted immutable socket.
   // ROLLBACK cannot run a fresh SELECT in PostgreSQL's aborted state.
   if(/^\s*rollback\s*;?\s*$/i.test(sql))return client.query(sql);
   await attest(client,name);
   const preamble='create role anon;create role authenticated;create role service_role bypassrls;';
   if(sql.includes(preamble)){
    for(const role of ['anon','authenticated','service_role']){
     const row=(await client.query('select rolcanlogin,rolbypassrls,rolsuper from pg_roles where rolname=$1',[role])).rows[0];
     if(row){assert.equal(row.rolcanlogin,false);assert.equal(row.rolsuper,false);assert.equal(row.rolbypassrls,role==='service_role');}
     else{await attest(client,name);await client.query('create role '+role+(role==='service_role'?' bypassrls':''));createdRoles.push(role);}
    }
    sql=sql.replace(preamble,'');
   }
   return client.query(sql);
  };
  return {name,version:a.version,native:true,exec,query:async(...args)=>{await attest(client,name);return client.query(...args);},attest:()=>attest(client,name),attestations:()=>count,close:async()=>{
   await client.query('rollback');await attest(client,name);await client.end();await attest(admin,'postgres');await admin.query('drop database '+name);
   for(const role of createdRoles){await attest(admin,'postgres');await admin.query('drop role '+role);}await admin.end();
  }};
 }catch(e){if(client)await client.end().catch(()=>{});if(created){await attest(admin,'postgres');await admin.query('drop database '+name);}await admin.end();throw e;}
}
async function constraints(db){const r=(await db.query("select conname,pg_get_constraintdef(oid) definition from pg_constraint where conname in ('collection_items_tcg_check','market_listings_tcg_check') order by 1")).rows;assert.equal(r.length,2);assert.doesNotMatch(r[1].definition,/magic/i);return r;}
async function absent(db){const names=['tcg_games','tcg_providers','tcg_provider_bindings','tcg_catalog_releases','tcg_magic_on_demand_beta'];const r={};for(const n of names)r[n]=(await db.query("select to_regclass($1) r",['dv_collect_private.'+n])).rows[0].r;assert.ok(Object.values(r).every(x=>x===null));return r;}
async function ready(db,m6=false){const r=(await db.query('select public.get_security_schema_readiness_v1() security,public.get_market_legal_schema_readiness_v1() legal')).rows[0];assert.equal(r.security.revision,'privilege-mfa-v1');assert.equal(r.legal.revision,'trade-legal-contract-model-v1.2');for(const k of ['security','legal']){assert.equal(r[k].compatible,true,'FAIL_SOURCE_SQL_CONTRACT '+JSON.stringify(r));if(m6)assert.equal(r[k].tcg_beta_contract,'magic-on-demand-collect-beta/1');}return r;}
async function lock(db,want=true){const r=(await db.query("select to_regprocedure('dv_market_private.reject_new_trade_while_locked_v1()') function,(select count(*)::int from pg_trigger where not tgisinternal and tgname='a00_production_trade_lock_v1') triggers")).rows[0];if(want){assert.ok(r.function);assert.equal(r.triggers,11);}else assert.deepEqual(r,{function:null,triggers:0});return r;}
async function baseline(db,pack){
 await reconstructProductionBaseline(db,pack);
 const cats=await db.exec(await read('tests/fixtures/production-upgrade/catalog-readonly.sql'));const catalog=Array.isArray(cats)?cats.find(x=>x.rows?.[0]?.catalog)?.rows[0].catalog:cats.rows[0].catalog;
 const funcs=(await db.query("select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,md5(pg_get_functiondef(p.oid)) definition_md5 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_v16_private') order by 1,2,3")).rows;
 const checks=await baselineChecks(db,catalog,funcs,true);
 const state=(await db.query("select to_regnamespace('dv_collect_private') collect_schema,to_regprocedure('public.get_security_schema_readiness_v1()') security,to_regprocedure('public.get_market_legal_schema_readiness_v1()') legal,to_regprocedure('public.get_magic_on_demand_collection_beta_v1()') beta_rpc,to_regclass('supabase_migrations.schema_migrations') fake_history")).rows[0];assert.ok(Object.values(state).every(v=>v===null));
 const cs=await constraints(db);assert.doesNotMatch(cs[0].definition,/magic/i);
 return {catalog,report:{history_count:pack.history.length,last_version:pack.history.at(-1).version,last_name:pack.history.at(-1).name,history_sha256:pack.manifest.baseline.sha256,checks,state,absent:await absent(db),constraints:cs,lock:await lock(db,false),synthetic_only:true,history_rows_inserted:0}};
}
async function upgrade(db,pack,catalog){
 const before=await snapshotOriginal(db,catalog),before_fks=await foreignKeys(db);const abort=await beforeUpgradeAbort(db,before);await assertReviewedActionsSource();const steps=[];
 await applyProductionUpgrade(db,pack.manifest,{onApplied:s=>{steps.push(s);console.log('APPLIED',s.id);}});
 assert.deepEqual(steps.map(s=>s.id),Array.from({length:60},(_,i)=>'U'+String(i+1).padStart(3,'0')));
 await db.exec('set search_path=pg_catalog,public');const integrity=await finalChecks(db,before,true);const r=await ready(db);
 return {steps,before_fks,abort,integrity,readiness:r,foundation:await absent(db),lock:await lock(db,false),manifest_status:pack.manifest.status,real_apply_authorized:false,synthetic_existing_data_inserted:false};
}
async function closure(db){const checkpoints=[];for(const pair of CLOSURE){for(const p of pair)await db.exec(await read(p));checkpoints.push({sources:pair,readiness:await ready(db),lock:await lock(db),foundation:await absent(db)});}return checkpoints;}
async function precondition(db){const r=(await db.query("select md5(pg_get_functiondef('public.export_my_duelvanta_data()'::regprocedure)) export,md5(pg_get_functiondef('public.prepare_account_deletion_data(uuid,uuid)'::regprocedure)) erasure")).rows[0];assert.deepEqual(r,{export:'b3556d2250e4a1c8e973f8e1d199dd85',erasure:'60d88f2c57874c82a7714fdee6057d37'},'STOP_PRODUCTION_I2_PRECONDITION_MISMATCH');return r;}
async function tcg(db){return {games:(await db.query('select * from dv_collect_private.tcg_games order by game_key')).rows,providers:(await db.query('select * from dv_collect_private.tcg_providers order by provider_key')).rows,bindings:(await db.query('select * from dv_collect_private.tcg_provider_bindings order by game_key,provider_key,provider_version')).rows,rpcs:(await db.query("select p.oid::regprocedure::text signature,md5(p.prosrc) body from pg_proc p where p.oid in ('public.export_my_duelvanta_data()'::regprocedure,'public.prepare_account_deletion_data(uuid,uuid)'::regprocedure) order by 1")).rows,release:(await db.query("select game_key,provider_key,provider_version,state,schema_phase,snapshot_id from dv_collect_private.tcg_catalog_releases where game_key='magic'")).rows[0]};}
async function apply(db,phase){
 const d=await read(delta[phase]),r=await read(readiness[phase]);assert.doesNotMatch(delta[phase]+readiness[phase],/staging/);
 if(phase>0){assert.equal((d.match(/^\s*begin;\s*$/gim)||[]).length,1);assert.equal((d.match(/^\s*commit;\s*$/gim)||[]).length,0);assert.equal((r.match(/^\s*begin;\s*$/gim)||[]).length,0);assert.equal((r.match(/^\s*commit;\s*$/gim)||[]).length,1);}
 await db.exec(d);await db.exec(r);const roots=await ready(db,phase===2);const result={sources:[delta[phase],readiness[phase]],readiness:roots,lock:await lock(db),constraints:await constraints(db),runtime_learned_expectations:0};
 if(phase===0){const e=(await db.query("select pg_get_functiondef('public.export_my_duelvanta_data()'::regprocedure) export,pg_get_functiondef('public.prepare_account_deletion_data(uuid,uuid)'::regprocedure) erasure")).rows[0];assert.match(e.export,/duelvanta-data-export-v4/);assert.match(e.export,/tcg_own_links_v1/);assert.match(e.erasure,/listing_catalog_links/);result.protected_integration={export:true,erasure:true};result.relations=(await db.query("select c.relname,c.relrowsecurity,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='dv_collect_private' and c.relname like 'tcg_%' order by 1")).rows;}
 if(phase>0){result.tcg=await tcg(db);assert.deepEqual(result.tcg.providers.find(p=>p.provider_key==='scryfall'),{provider_key:'scryfall',display_name:'Scryfall'});assert.deepEqual(result.tcg.bindings.find(p=>p.game_key==='magic'),{game_key:'magic',provider_key:'scryfall',provider_version:'1'});assert.deepEqual(result.tcg.games.find(p=>p.game_key==='magic'),{game_key:'magic',registry_version:'1',available:false,collection_ready:false,marketplace_ready:false});assert.deepEqual(result.tcg.release,{game_key:'magic',provider_key:'scryfall',provider_version:'1',state:'foundation',schema_phase:'persistence',snapshot_id:null});}
 if(phase===2){result.beta=(await db.query('select * from dv_collect_private.tcg_magic_on_demand_beta')).rows;assert.deepEqual(result.beta,[{game_key:'magic',contract:'magic-on-demand-collect-beta/1',provider_key:'scryfall',provider_version:'1',enabled:false}]);assert.match(result.constraints[0].definition,/magic/i);const registry=createRequire(import.meta.url)('../tcg-v1-registry.js');result.capabilities=registry.get('magic').capabilities;for(const k of ['scanner','marketplace','pricing','battle'])assert.notEqual(result.capabilities[k].status,'ready');}
 return result;
}
async function fingerprint(db){return {relations:(await db.query("select n.nspname||'.'||c.relname name,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','dv_collect_private','dv_market_private') order by 1")).rows,functions:(await db.query("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) body,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_collect_private','dv_market_private') and p.prokind='f' order by 1")).rows,constraints:(await db.query("select conrelid::regclass::text relation,conname,pg_get_constraintdef(oid) definition from pg_constraint where connamespace in ('public'::regnamespace,'dv_collect_private'::regnamespace,'dv_market_private'::regnamespace) order by 1,2")).rows,triggers:(await db.query("select n.nspname||'.'||c.relname relation,t.tgname,pg_get_triggerdef(t.oid) definition,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','dv_collect_private','dv_market_private') order by 1,2")).rows};}
async function rollbackCase(pack,phase){const db=await target();try{const b=await baseline(db,pack);await upgrade(db,pack,b.catalog);await closure(db);await precondition(db);await apply(db,0);if(phase===2)await apply(db,1);const before=await fingerprint(db);await db.exec(await read(delta[phase]));let error;try{await db.exec("do $$begin raise exception 'p6r4_atomic_injected';end$$;");}catch(e){error={message:e.message,code:e.code};}assert.match(error?.message||'',/p6r4_atomic_injected/);await db.exec('rollback');const after=await fingerprint(db);assert.deepEqual(after,before);const missing=(await db.query("select to_regclass('dv_collect_private.tcg_magic_on_demand_beta') beta,to_regprocedure('public.get_magic_on_demand_collection_beta_v1()') beta_rpc")).rows[0];assert.deepEqual(missing,{beta:null,beta_rpc:null});if(phase===1)assert.equal((await db.query("select to_regclass('dv_collect_private.tcg_catalog_releases') r")).rows[0].r,null);return {database:db.name,phase:phase===1?'M4':'M6',before_sha256:sha(JSON.stringify(before)),after_sha256:sha(JSON.stringify(after)),restored:true,error,missing,constraints:await constraints(db),lock:await lock(db)};}finally{await db.close();}}
async function main(){
 const report={contract:'m6-p6-r4-production-legacy-native/1',engine:'native-PG17',postgres_major:17,passed:false,native_acceptance:false,bridge_free_execution:true,runtime_learned_expectations:0,cases:NAMES.map(name=>({name,status:'NOT_RUN'})),io:Object.fromEntries(['production_database_queries','staging_database_queries','production_mutations','staging_mutations','provider_live_requests','user_data_rows_read','real_beta_changes','real_migrations'].map(k=>[k,0]))};let db,current;
 const check=async(i,fn)=>{current=report.cases[i];current.evidence=await fn();current.status='PASS';console.log('PASS',current.name);};
 try{
  assert.ok(process.argv.includes('--native'),'--native mandatory before database connection');report.sources=await verifySources();report.ci={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),run_id:process.env.GITHUB_RUN_ID,attempt:Number(process.env.GITHUB_RUN_ATTEMPT)};
  const pack=await loadProductionUpgradeSources();assert.equal(pack.manifest.status,'CANDIDATE_NOT_AUTHORIZED_FOR_PRODUCTION');assert.equal(pack.manifest.baseline.history_count,72);assert.equal(pack.manifest.baseline.last_version,'20260911181702');assert.equal(pack.history.at(-1).name,'harden_battle_and_profile_auth_boundaries');assert.equal(pack.manifest.steps.length,60);
  const ledger=JSON.parse(await read('database/production-upgrade/source-ledger.json'));assert.deepEqual(pack.history.map(h=>({version:h.version,name:h.name})),ledger.production_history.map(h=>({version:h.version,name:h.name})));for(let i=0;i<72;i++)assert.equal(sha(pack.history[i].statements.join('\n')),ledger.production_history[i].sha256);for(const s of pack.manifest.steps)await productionUpgradeSQL(s);
  db=await target();report.version=db.version;report.connection={host:'127.0.0.1',current_user:'postgres',database:db.name,disposable:true,production_staging_connection:false};let b;
  await check(0,async()=>{b=await baseline(db,pack);return {...b.report,target:await db.attest()};});await check(1,()=>upgrade(db,pack,b.catalog));
  await check(2,async()=>({checkpoints:await closure(db),bridge_installed:false,runtime_learned_expectations:0}));await check(3,()=>precondition(db));await check(4,()=>apply(db,0));await check(5,()=>apply(db,1));await check(6,()=>apply(db,2));await check(7,()=>rollbackCase(pack,1));await check(8,()=>rollbackCase(pack,2));
  await check(9,async()=>{const s=await json('test-results/tcg-i3-m6-p6-r3/native-report.json'),v=await json('test-results/tcg-i3-m6-p6-r3/evidence-verification.json'),binding=await json('test-results/tcg-i3-m6/binding.json');assert.equal(s.passed,true);assert.equal(v.passed,true);assert.equal(s.cases.length,13);assert.ok(s.cases.every(c=>c.status==='PASS'));assert.deepEqual(s.ci,report.ci);assert.equal(s.bridge_free_execution,true);assert.equal(s.native_runtime_learned_expectations,0);assert.equal(binding.head,report.ci.head);assert.equal(binding.run_id,report.ci.run_id);
   const prod=report.cases[6].evidence,stg=s.cases[7].evidence;assert.deepEqual(prod.readiness,stg.readiness);assert.deepEqual(prod.tcg,stg.tcg);assert.deepEqual(prod.beta,stg.beta);assert.deepEqual(prod.constraints,stg.constraints);assert.deepEqual(prod.capabilities,stg.capabilities);assert.deepEqual(stg.lock,{function:null,triggers:0});assert.equal(prod.lock.triggers,11);
   return {target_tcg_state_converged:true,environment_profile_divergence:'EXPECTED',production_trade_lock:'PRESENT',staging_trade_lock:'ABSENT',production:prod,staging:stg,staging_report_sha256:sha(await readFile('test-results/tcg-i3-m6-p6-r3/native-report.json')),staging_evidence_sha256:sha(await readFile('test-results/tcg-i3-m6-p6-r3/evidence-verification.json')),ci:binding,tracking_plan_required:true,production_tracking_required:true,staging_tracking_required:true,real_history_sets_disjoint:true,migration_entries_created:false,real_apply_authorized:false,beta_activation_authorized:false,production_upgrade_status:pack.manifest.status};
  });
  assert.ok(report.cases.every(c=>c.status==='PASS'));await verifySources();report.attestations=db.attestations();report.passed=true;report.native_acceptance=true;
 }catch(e){if(current)current.status='FAIL';report.error={message:e.message,code:e.code,stack:e.stack};console.error(e);process.exitCode=1;}
 finally{if(db)try{await db.close();}catch(e){report.cleanup_error=e.message;report.passed=false;report.native_acceptance=false;process.exitCode=1;}const io=globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')];report.io.forbidden_external_io_attempts=io.attempts.slice();report.io.local_pg_connections=io.local_pg_connections;if(io.attempts.length){report.passed=false;report.native_acceptance=false;process.exitCode=1;}await mkdir(OUT,{recursive:true});await writeFile(OUT+'/native-report.json',JSON.stringify(report,null,2)+'\n');}
}
if(process.argv[1]?.endsWith('tcg-i3-m6-p6-production-native-test.mjs'))await main();
