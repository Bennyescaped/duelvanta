// Fixed R2 targets consumed against disposable hosted PG17. No runtime authoring.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {database} from './helpers/tcg-i3-magic-fixture.mjs';
import {securitySchemaFixture} from './helpers/security-schema-fixture.mjs';

export const OUT='test-results/tcg-i3-m6-p6-r3';
export const R2={
 'tests/generate-tcg-staging-readiness.mjs':'ddc223bf147bc6d0ab96b1b5d81deefe590be2fd21158735139638b1210e3767',
 'database/tcg-i2-readiness-staging-v1.sql':'f27fb2c7d3b4dbb25de6e91506786f9fd9c9e6a9c785ceedb524451cd4df1f84',
 'database/tcg-i3-magic-readiness-staging-v1.sql':'e6b04e4e6ecdbf6c92d5a28020e813bbbd6e70fe82bc221c90a6127a65328886',
 'database/tcg-i3-magic-on-demand-readiness-staging-v1.sql':'65c5556e57dc66737086179cf76dcc01a3a50e9abd4eb53d57a80b110c502ab0',
 'tests/tcg-i3-m6-staging-readiness-generation-test.mjs':'310b039e34aa38226b41833b763d8ed6778dfa07ea88ab912fca5d109b5459aa'
};
export const SOURCES={
  "tests/helpers/security-schema-fixture.mjs": "d89a0ef62dededdb8eee6a92f95f901bbfc308d5dcd80deed89b33b75bca69d5",
  "tests/generate-legal-readiness.mjs": "c9d90a2e3152c2b8dde12b6f9f0364c81e4f55f3f66305594f4ba83a3441c027",
  "tests/helpers/legal-schema-fixture.mjs": "b531eef1986c0d188d226f412aa47b729665944bf2d805b547b52bae96f4b25a",
  "tests/generate-security-readiness.mjs": "da2bbf3b708195f673c183993a22c24fd30c76e040916e9aadeca71edf1a3b5f",
  "database/battle-spectator-media-v1.sql": "c3d3936647d63d4759f34873a5cb85cd7b0dc2b8525629862d61708f72149dec",
  "supabase/migrations/20260921144947_collect_empty_binder_delete.sql": "7ddbbf05f8d6a7e194948ed7fe7a165fced9be24d1bd5d5a87826805ef02252e",
  "evidence/production-readiness-20260924/staging-supplemental.json": "876469e6075e3a03d49951aa5fb5b956ba7ae5e5e9bc8437d66fc20c052d8d65",
  "database/battle-spectator-media-reconciler-v1.sql": "490a3e53648289d6881ba3d0aaeab69eab6ece2bcfa26ae5d22a0cf5b8f231d1",
  "database/collect-scanner-v16-weekly-quota.sql": "103075a868f72a074743a2f2b66fb0e2411c68c6a592e2a5330f851e7e08573d",
  "tests/helpers/legal-readiness-catalog.mjs": "37e5694d262a495c6d7cdcfb8c162194baec61493ded29053c1894a76d7766f3",
  "database/collect-scanner-v16-owner-control.sql": "8f3821885c9184f05cd02601221a5a022464fd7b4fbc7bd555390cbe22b89fc8",
  "database/auth-privileged-step-up-v1.sql": "fdc4339b99545a24f3f6f1c68afcb89abae32b8e16a6d0ddb3f3816ad22f44c8",
  "database/battle-spectator-foundation-v1.sql": "34ec56ee0cc8ec1b5d1793e56bd47a7e9214d99f437d0997baf66de69bbadb3c",
  "database/security-privilege-mfa-hardening-v1.sql": "d1ce7f093c521ad90022e42ab946570572556d3543470a9cfd55893e39b8b927",
  "database/account-closure-privacy-v1.sql": "021af6ac04bddc5476daf0d2c79f094fdef658cc4d71134dbabaa850f394fc78",
  "database/account-processing-markers-v1.sql": "076f2cff65745f25257b6eac124a556fcece3cc390dcb4d928c5438d4366cf2f",
  "database/publication-processing-hold-v1.sql": "0af9e2da31ec92668f3e4d47119e9c438fc2cf22f9a807bc6f334662acfb9da7",
  "tests/fixtures/legal-readiness/reviewed-default-privileges.sql": "2e86f2ac9ac7aba0c665a605a9ad5a93a25bf4dee384e00adeb3c4692134f880",
  "database/battle-player-processing-hold-v1.sql": "9b8a0a961072a84b76fea4c1b237584ecdf35e8f10cc96364f18735a44c6d293",
  "tests/fixtures/legal-readiness/staging-catalog-boundaries.json.gz": "e9c32418b52d26b5339c8027d5686313e9566fc7035621f2f811eec99b377230",
  "tests/fixtures/legal-readiness/reviewed-baseline-indexes.sql": "f7e6dd0197bd2bb33e524e4b7dca65f2df8d7bbcf1bbd7b39138550d7c1568b9",
  "database/battle-spectator-withdrawal-v1.sql": "6800a21fab229c240de7371527285ce865786ce90459fb87a0294cb45bbeaed1",
  "database/account-deletion-withdrawal-v1.sql": "a353b2ae96d4756a6362451dc4ed6e1d7d1f585951ccb907d6ecc4eb50a89351",
  "database/tcg-i3-magic-persistence-v1.sql": "29fcc3ff647a39ac3884dae9397ba4e3b20bf5de038e6e1a4159200f006e3d09",
  "database/security-readiness-v1.sql": "a75ef2472c83218de2581223ae11ee11a89951a3194a96843e8727c4d968c1d7",
  "database/tcg-i2-canonical-integration-v1.sql": "7d663bbdd9a092f9cff948dc447388140375ec06b66b44e0677861ebf9c72df9",
  "evidence/legal-step6-preflight-20260922/staging-application-schema.json.gz": "aab7cba3913f7eb133292e045a7c4abbadfa3daa572cab162fa8fde5c1fdae5c",
  "database/tcg-i3-magic-readiness-v1.sql": "df10bf929fe3e7c7958605b1d2a2dec7445bcaf630d301ff8cb9f3bfe3d8844d",
  "database/market-production-trade-lock-readiness-v1.sql": "ef27dbeddec5bac34c0989339ad73eee7705ac3474c2c431fdde60a4a5173519",
  "database/staff-processing-hold-v1.sql": "d447651070bd2b876df188c66209fbc8c9950471ca6feb3bdd1b198b87361592",
  "database/market-production-trade-lock-v1.sql": "c2e26d680b45f8e1368de32f7fd74ed0696d8e192208a15b97fdb674b4838cec",
  "database/battle-safety-sanctions-v1.sql": "4eafc71c7552ecbde7a230ad0fbf958db1cc7d31220869146bb951c75db10513",
  "database/tcg-i3-magic-on-demand-v1.sql": "b13bfde57c7647e2fd1471886ef870a65e5b6bf9608c0c4da869133f2f1303af",
  "database/scanner-processing-hold-v1.sql": "1a0363c4dda8b3170a71e7b890d81a6e8acc1b6f58bcc9053e7c5733d3c65cc8",
  "database/battle-signal-processing-hold-v1.sql": "e0e1fdeb3b7f592a026a6b02883eea145ed52d188ad8b1a2cc9cccc7bc8b0007",
  "database/battle-spectator-epoch-processing-hold-v1.sql": "894a807750b48ee5a969f2f157869fbaf4dd7cf6cf9f1c0b91b3c8f0f50c7c11",
  "database/account-data-export-collect-battle-v1.sql": "df462b2a124611439ffc559797578e2356d3df94dac7ff1f2b353f0e644797e3",
  "database/account-erasure-l1-v1.sql": "980e52c2776ac18b1c202e89ab710ee4cee83dee4887e3c3b670a9b07ce41d32",
  "evidence/production-readiness-20260924/staging-catalog.json.gz": "36972c99534b06c8f6d03d6ba1a4b7629a7c25939a67f908a5766900f01b7d2e",
  "database/tcg-i2-readiness-v1.sql": "6713ce4b7590aa0530ea90efbbeb77aaf63a8098e422832ccc9d942e06432b7b",
  "database/tcg-i3-magic-on-demand-readiness-v1.sql": "5f31e1fe864175b449bed520186a9c2ed73b46d7308c6f06ac9b6e9d764e0324",
  "supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql": "c7d061943629d692ada147ba27c9909105507929756deacc6a3a8cedb259b5c6",
  "tcg-catalog-evidence-v1.mjs": "33e9fc14ea396e16d49885698a88d4b2688c81bb779b385c39c730285988f9ec",
  "tcg-v1-catalog-providers.js": "5cd87efc9914c2906c17f5fda0b149ce3cff5b832a46f54d1785d9002421e75c",
  "tests/helpers/tcg-i3-magic-fixture.mjs": "29109447182e5749b2970d84e49cb3936e86779c38ea6cca38a357b72d739046",
  "tests/generate-tcg-i2-readiness.mjs": "cdbd894a0b3c17c7eb6e82d00c91a1369c0ce1945d16fd09ae518cb12d5f2857",
  "tcg-v1-registry.js": "675060cec5a3278e32f166324156df91b54204c7c4d8496a315ed84cd8862e33",
  "tests/generate-tcg-i3-magic-readiness.mjs": "283dc0f12e607c02ddc348d39a798d94799a75ba3acafba806ebceb1974f6deb",
  "tests/generate-tcg-i3-magic-on-demand-readiness.mjs": "26f078747b3041cb2b105b14aef60d1c6324ffce96d154e5e92d52092bf1db7e",
  "tests/helpers/tcg-i2-fixture.mjs": "15f9db3f7336a01c9678927f529d20ddf6f8e2d3722cd5c5118e487319689e94",
  "tests/helpers/publication-hold-fixture.mjs": "fef20e09cda84ded74d42f938e1a7640ef3ab49fc856e7ee5f272d116d8e9683",
  "tcg-v1-contracts.js": "92388c32ec7a5dedf356f355c67fffc7113992b897666346ace3a9d6794553af",
  "tcg-v1-game-adapters.js": "fbe25ec3bccadc942706fd84e0ac0a474a02ef67ae655dc46f5549c9e8cd2b9b",
  "tcg-catalog-persistence-v1.mjs": "082de266a11aae59839d922cc3a210d1683ec969d12d62a39b8c6f86540f92a1",
  "tests/fixtures/tcg-i3-magic/persistence-v1.json": "1ae6f2117576f2b9309bbf86ca6937ada9bf62995c9a7a7371dda7e93d20f905",
  "database/account-erasure-l1-readiness-v1.sql": "f79400c55ccf9edf7417b01cfe14c268404e86bbd78720bc0577e2b9bb5e1d27"
};
export const COMMON=['account-data-export-collect-battle-v1','account-processing-markers-v1','account-closure-privacy-v1','scanner-processing-hold-v1','battle-player-processing-hold-v1','battle-signal-processing-hold-v1','battle-spectator-withdrawal-v1','battle-spectator-epoch-processing-hold-v1','staff-processing-hold-v1','publication-processing-hold-v1','battle-safety-sanctions-v1','account-deletion-withdrawal-v1','account-erasure-l1-v1'];
export const NAMES=['TARGET_AND_SOURCE_BINDING','LOCK_FREE_LEGACY_BASELINE','COMMON_PREREQUISITE_CLOSURE','I2_STAGING_FIXED_READINESS','I2_PRODUCTION_PROFILE_REJECTED','M4_STAGING_FIXED_READINESS','M4_PRODUCTION_PROFILE_REJECTED','M6_STAGING_FIXED_READINESS','M6_PRODUCTION_PROFILE_REJECTED','ADVERSARIAL_LOCK_REJECTED','M4_ATOMIC_ROLLBACK','M6_ATOMIC_ROLLBACK','FRESH_PRODUCTION_SEMANTIC_CONVERGENCE'].map((n,i)=>'P6R3_'+String(i+1).padStart(2,'0')+' '+n);
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const json=async p=>JSON.parse(await readFile(p,'utf8'));
export async function verifySources(){
 const hashes={};for(const [path,expected] of Object.entries({...SOURCES,...R2})){const bytes=await readFile(path);assert.equal(sha(bytes),expected,'source drift '+path);hashes[path]=sha(bytes);}
 return hashes;
}
const source=async p=>{assert.ok(SOURCES[p]||R2[p]);const b=await readFile(p);assert.equal(sha(b),SOURCES[p]||R2[p]);return b.toString('utf8');};
const delta=['database/tcg-i2-canonical-integration-v1.sql','database/tcg-i3-magic-persistence-v1.sql','database/tcg-i3-magic-on-demand-v1.sql'];
const staging=['database/tcg-i2-readiness-staging-v1.sql','database/tcg-i3-magic-readiness-staging-v1.sql','database/tcg-i3-magic-on-demand-readiness-staging-v1.sql'];
const production=['database/tcg-i2-readiness-v1.sql','database/tcg-i3-magic-readiness-v1.sql','database/tcg-i3-magic-on-demand-readiness-v1.sql'];
const lock='dv_market_private.reject_new_trade_while_locked_v1()';
async function lockState(db){return (await db.query(`select to_regprocedure('${lock}')::text function,(select count(*)::int from pg_trigger where tgname='a00_production_trade_lock_v1') triggers`)).rows[0];}
async function noLock(db){const r=await lockState(db);assert.deepEqual(r,{function:null,triggers:0});return r;}
async function ready(db,want=true,m6=false){const r=(await db.query('select public.get_security_schema_readiness_v1() security,public.get_market_legal_schema_readiness_v1() legal')).rows[0];for(const [k,revision] of [['security','privilege-mfa-v1'],['legal','trade-legal-contract-model-v1.2']]){assert.equal(r[k].revision,revision);assert.equal(r[k].compatible,want,'STOP_PG17_STAGING_READINESS_CONTRACT_MISMATCH '+JSON.stringify(r));if(m6)assert.equal(r[k].tcg_beta_contract,'magic-on-demand-collect-beta/1');}return r;}
async function constraints(db){const r=(await db.query("select conname,pg_get_constraintdef(oid) definition from pg_constraint where conname in ('collection_items_tcg_check','market_listings_tcg_check') order by conname")).rows;assert.equal(r.length,2);assert.doesNotMatch(r[1].definition,/magic/i);return r;}
async function fingerprint(db){
 return {relations:(await db.query("select n.nspname||'.'||c.relname name,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','dv_collect_private','dv_market_private') order by 1")).rows,
 functions:(await db.query("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) body,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_collect_private','dv_market_private') and p.prokind='f' order by 1")).rows,
 constraints:(await db.query("select conrelid::regclass::text relation,conname,pg_get_constraintdef(oid) definition from pg_constraint where connamespace in ('public'::regnamespace,'dv_collect_private'::regnamespace,'dv_market_private'::regnamespace) order by 1,2")).rows,
 triggers:(await db.query("select n.nspname||'.'||c.relname relation,t.tgname,pg_get_triggerdef(t.oid) definition,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','dv_collect_private','dv_market_private') order by 1,2")).rows};
}
// The only engine constructor is the existing native-only admission path.
async function target(){
 assert.equal(process.env.GITHUB_ACTIONS,'true','hosted Actions service only');
 assert.equal(process.env.PGHOST,'127.0.0.1');assert.equal(process.env.PGUSER,'postgres');assert.equal(process.env.PGDATABASE,'postgres');
 assert.match(process.env.GITHUB_RUN_ID||'',/^\d+$/);
 const raw=await database(true);assert.equal(raw.native,true);assert.equal(Math.floor(Number(raw.version)/10000),17);assert.match(raw.name,/^tcg_m4_[0-9a-f]{32}$/);
 let attestations=0;
 const attest=async()=>{assert.equal(process.env.PGHOST,'127.0.0.1');const r=(await raw.query("select current_user owner,current_database() database,current_setting('server_version_num')::int version")).rows[0];assert.equal(r.owner,'postgres');assert.equal(r.database,raw.name);assert.equal(Math.floor(r.version/10000),17);attestations++;return r;};
 await attest();
 const db={name:raw.name,version:raw.version,native:true,query:async(s,p)=>{await attest();return raw.query(s,p);},exec:async s=>{
  // An aborted SQL transaction cannot run a SELECT admission check. ROLLBACK
  // only undoes writes on this already attested, immutable native connection.
  if(!/^rollback\s*;?\s*$/i.test(s))await attest();
  return raw.exec(s);
 },close:async()=>{await raw.exec('rollback');await attest();await raw.close();},attest,attestations:()=>attestations};
 return db;
}
async function legacy(db){
 await securitySchemaFixture(db);
 for(const f of ['auth-privileged-step-up-v1','security-privilege-mfa-hardening-v1','security-readiness-v1'])await db.exec(await source('database/'+f+'.sql'));
 await db.exec('set search_path=pg_catalog,public');
 const absent=(await db.query("select to_regclass('dv_collect_private.tcg_games') games,to_regclass('dv_collect_private.tcg_providers') providers,to_regclass('dv_collect_private.tcg_provider_bindings') bindings,to_regclass('dv_collect_private.tcg_catalog_releases') releases,to_regclass('dv_collect_private.tcg_magic_on_demand_beta') beta")).rows[0];
 for(const v of Object.values(absent))assert.equal(v,null);
 const r={readiness:await ready(db),lock:await noLock(db),absent,constraints:await constraints(db)};assert.doesNotMatch(r.constraints[0].definition,/magic/i);return r;
}
async function common(db){
 const generator=await source('tests/generate-tcg-staging-readiness.mjs');const m=generator.match(/export const COMMON=\[([^\]]+)\]/);assert.ok(m);assert.deepEqual([...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]),COMMON);
 for(const f of COMMON){await db.exec(await source('database/'+f+'.sql'));await noLock(db);}
 const bodies=(await db.query("select md5(pg_get_functiondef('public.export_my_duelvanta_data()'::regprocedure)) export,md5(pg_get_functiondef('public.prepare_account_deletion_data(uuid,uuid)'::regprocedure)) erasure")).rows[0];
 assert.deepEqual(bodies,{export:'b3556d2250e4a1c8e973f8e1d199dd85',erasure:'60d88f2c57874c82a7714fdee6057d37'});
 const transient=(await db.query('select public.get_security_schema_readiness_v1() security,public.get_market_legal_schema_readiness_v1() legal')).rows[0];
 assert.equal(transient.security.compatible,false);assert.equal(transient.legal.compatible,false);
 return {sources:COMMON.map(f=>'database/'+f+'.sql'),protected_pre_i2_bodies:bodies,transient_readiness:transient,bridge_installed:false};
}
async function apply(db,phase){
 const d=await source(delta[phase]),r=await source(staging[phase]);
 if(phase>0){assert.match(d,/\nbegin;/i);assert.doesNotMatch(d,/^[ \t]*commit;[ \t]*$/im);assert.doesNotMatch(r,/^[ \t]*begin;[ \t]*$/im);assert.equal((r.match(/^[ \t]*commit;[ \t]*$/gmi)||[]).length,1);}
 const first=await db.exec(d),second=await db.exec(r);
 if(phase>0){const commands=x=>(Array.isArray(x)?x:[x]).map(v=>v.command);assert.ok(!commands(first).includes('COMMIT'));assert.equal(commands(second).filter(x=>x==='COMMIT').length,1);assert.equal(commands(second).at(-1),'COMMIT');}
 return {sources:[delta[phase],staging[phase]],readiness:await ready(db,true,phase===2),lock:await noLock(db),constraints:await constraints(db),runtime_learned_expectations:0};
}
function body(sql){assert.equal((sql.match(/^[ \t]*commit;[ \t]*$/gmi)||[]).length,1);return sql.replace(/^[ \t]*begin;[ \t]*$/gmi,'').replace(/^[ \t]*commit;[ \t]*$/gmi,'');}
async function wrong(db,phase){
 const before=await fingerprint(db);await db.exec('begin;savepoint wrong_environment');let rejected;
 try{if(phase===2)await db.exec('drop function dv_collect_private.tcg_magic_on_demand_schema_v1()');await db.exec(body(await source(production[phase])));rejected=await ready(db,false,phase===2);}
 finally{await db.exec('rollback');}
 assert.deepEqual(await fingerprint(db),before);return {source:production[phase],rejected,restored:await ready(db,true,phase===2),lock:await noLock(db),before_sha256:sha(JSON.stringify(before)),after_sha256:sha(JSON.stringify(await fingerprint(db)))};
}
async function release(db){const rows=(await db.query("select game_key,provider_key,provider_version,state,schema_phase,snapshot_id from dv_collect_private.tcg_catalog_releases where game_key='magic'")).rows;assert.deepEqual(rows,[{game_key:'magic',provider_key:'scryfall',provider_version:'1',state:'foundation',schema_phase:'persistence',snapshot_id:null}]);return rows[0];}
async function tcg(db){
 const games=(await db.query('select * from dv_collect_private.tcg_games order by game_key')).rows;
 const providers=(await db.query('select * from dv_collect_private.tcg_providers order by provider_key')).rows;
 const bindings=(await db.query('select * from dv_collect_private.tcg_provider_bindings order by game_key,provider_key,provider_version')).rows;
 const rpcs=(await db.query("select p.oid::regprocedure::text signature,md5(p.prosrc) body from pg_proc p where p.oid in ('public.export_my_duelvanta_data()'::regprocedure,'public.prepare_account_deletion_data(uuid,uuid)'::regprocedure) order by 1")).rows;
 assert.deepEqual(bindings,[{game_key:'magic',provider_key:'scryfall',provider_version:'1'},{game_key:'one_piece',provider_key:'optcg',provider_version:'1'},{game_key:'pokemon',provider_key:'tcgdex',provider_version:'1'}]);
 assert.deepEqual(games.find(x=>x.game_key==='magic'),{game_key:'magic',registry_version:'1',available:false,collection_ready:false,marketplace_ready:false});
 assert.ok(providers.some(p=>p.provider_key==='scryfall'&&p.display_name==='Scryfall'));
 return {games,providers,bindings,rpcs,release:await release(db)};
}
async function beta(db){const rows=(await db.query('select * from dv_collect_private.tcg_magic_on_demand_beta')).rows;assert.deepEqual(rows,[{game_key:'magic',contract:'magic-on-demand-collect-beta/1',provider_key:'scryfall',provider_version:'1',enabled:false}]);return rows;}
async function rollbackCase(phase){
 const db=await target();try{
  await legacy(db);await common(db);await apply(db,0);if(phase===2)await apply(db,1);
  const before=await fingerprint(db),beforeRelease=phase===2?await release(db):null;
  await db.exec(await source(delta[phase]));let error;
  await assert.rejects(()=>db.exec("DO $injected$ BEGIN RAISE EXCEPTION 'p6r3_atomic_injected'; END $injected$;"),e=>{error={message:e.message,code:e.code};return /p6r3_atomic_injected/.test(e.message);});
  await db.exec('rollback');const after=await fingerprint(db);assert.deepEqual(after,before);await ready(db);
  const absent=(await db.query("select to_regclass('dv_collect_private.tcg_magic_on_demand_beta') beta,to_regprocedure('public.get_magic_on_demand_collection_beta_v1()') beta_rpc" )).rows[0];assert.deepEqual(absent,{beta:null,beta_rpc:null});
  if(phase===1){assert.deepEqual((await db.query("select to_regclass('dv_collect_private.tcg_catalog_releases') r,to_regprocedure('public.save_my_tcg_collection_item_v1(uuid,text,jsonb)') rpc")).rows[0],{r:null,rpc:null});}
  else assert.deepEqual(await release(db),beforeRelease);
  return {database:db.name,phase:phase===1?'M4':'M6',before_sha256:sha(JSON.stringify(before)),after_sha256:sha(JSON.stringify(after)),error,restored:true,absent,constraints:await constraints(db),lock:await noLock(db)};
 }finally{await db.close();}
}
async function main(){
 const report={contract:'m6-p6-r3-staging-native/1',engine:'native-PG17',postgres_major:17,passed:false,native_acceptance:false,bridge_free_execution:true,native_runtime_learned_expectations:0,cases:NAMES.map(name=>({name,status:'NOT_RUN'})),io:{production_database_queries:0,staging_database_queries:0,production_mutations:0,staging_mutations:0,provider_live_requests:0,user_data_rows_read:0,real_beta_changes:0}};let db,current;
 const check=async(index,fn)=>{current=report.cases[index];current.evidence=await fn();current.status='PASS';console.log('PASS',current.name);};
 try{
  assert.ok(process.argv.includes('--native'),'--native mandatory; no PGlite fallback');
  report.sources=await verifySources();report.ci={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),run_id:process.env.GITHUB_RUN_ID,attempt:Number(process.env.GITHUB_RUN_ATTEMPT)};
  db=await target();report.version=db.version;report.connection={host:'127.0.0.1',current_user:'postgres',database:db.name,disposable:true,production_staging_connection:false};
  await check(0,async()=>({target:await db.attest(),sources:report.sources,bridge_free_execution:true}));
  await check(1,()=>legacy(db));await check(2,()=>common(db));
  await check(3,async()=>({...await apply(db,0),relations:(await db.query("select c.relname,c.relrowsecurity,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='dv_collect_private' and c.relname like 'tcg_%' order by 1")).rows}));
  await check(4,()=>wrong(db,0));
  await check(5,async()=>({...await apply(db,1),tcg:await tcg(db)}));await check(6,()=>wrong(db,1));
  await check(7,async()=>{const r=await apply(db,2),registry=createRequire(import.meta.url)('../tcg-v1-registry.js'),magic=registry.get('magic');for(const k of ['scanner','marketplace','pricing','battle'])assert.notEqual(magic.capabilities[k].status,'ready');assert.match(r.constraints[0].definition,/magic/i);return {...r,tcg:await tcg(db),beta:await beta(db),capabilities:magic.capabilities};});
  await check(8,()=>wrong(db,2));
  await check(9,async()=>{const before=await fingerprint(db);await db.exec('begin;savepoint adversarial_lock');let injected,rejected,presence;try{await db.exec(body(await source('database/market-production-trade-lock-v1.sql')));presence=await lockState(db);assert.ok(presence.function);assert.equal(presence.triggers,11);injected=await fingerprint(db);assert.notDeepEqual(injected,before);rejected=await ready(db,false,true);}finally{await db.exec('rollback');}assert.deepEqual(await fingerprint(db),before);return {before_sha256:sha(JSON.stringify(before)),injected_sha256:sha(JSON.stringify(injected)),presence,rejected,restored:await ready(db,true,true),lock:await noLock(db),beta:await beta(db)};});
  await check(10,()=>rollbackCase(1));await check(11,()=>rollbackCase(2));
  await check(12,async()=>{const p4=await json('test-results/tcg-i3-m6-p4/native-report.json'),binding=await json('test-results/tcg-i3-m6/binding.json');assert.equal(p4.passed,true);assert.equal(p4.ci.run_id,report.ci.run_id);assert.equal(binding.head,report.ci.head);assert.equal(binding.run_id,report.ci.run_id);
   const stg=report.cases[7].evidence,prod=p4.cases[3].evidence;assert.deepEqual(stg.readiness.security,prod.security_readiness);assert.deepEqual(stg.readiness.legal,prod.legal_readiness);assert.deepEqual(stg.beta,p4.cases[2].evidence.rows);
   const prodRelease=p4.cases[0].evidence.release;for(const [k,v] of Object.entries(stg.tcg.release))assert.deepEqual(v,prodRelease[k]);assert.equal(prod.foundation,true);assert.equal(prod.provider,true);assert.equal(prod.release,true);assert.equal(prod.marketplace,true);assert.equal(prod.rpcs,true);
   // Fresh compatible=true attests the exact immutable Production inventory.
   // It includes the hard-lock function and all eleven physical lock triggers.
   const targets=[...(await source(production[2])).matchAll(/\$target\$([\s\S]*?)\$target\$::jsonb/g)].map(x=>JSON.parse(x[1]));assert.equal(targets.length,2);
   const lockFunctions=targets[0].filter(x=>x[0]==='function'&&x[1]==='dv_market_private.reject_new_trade_while_locked_v1()');
   const lockTriggers=targets[0].filter(x=>x[0]==='all_trigger'&&x[1].endsWith('.a00_production_trade_lock_v1'));assert.equal(lockFunctions.length,1);assert.equal(lockTriggers.length,11);
   return {status:'TCG_SEMANTIC_CONVERGENCE=PASS',environment_profile_divergence:'EXPECTED',staging_lock:await noLock(db),production_lock_present:true,production_lock_evidence:{fresh_security_compatible:prod.security_readiness.compatible,source_sha256:SOURCES[production[2]],authored_function:lockFunctions,authored_triggers:lockTriggers,method:'fresh strict inventory equality with immutable bootstrap/body binding'},production_contract_source:'database/market-production-trade-lock-v1.sql',production_readiness_sources:production,common_delta_sources:delta,production_report_sha256:sha(await readFile('test-results/tcg-i3-m6-p4/native-report.json')),ci:binding,public_semantics:stg.readiness,release:stg.tcg.release,beta:stg.beta,production_semantics:prod,scope:'public TCG contracts; not global inventory byte equality'};
  });
  assert.ok(report.cases.every(c=>c.status==='PASS'));await verifySources();report.attestations=db.attestations();report.passed=true;report.native_acceptance=true;
 }catch(error){if(current)current.status='FAIL';report.error={message:error.message,code:error.code,stack:error.stack};console.error(error);process.exitCode=1;}
 finally{
  if(db)try{await db.close();}catch(e){report.cleanup_error=e.message;report.passed=false;report.native_acceptance=false;process.exitCode=1;}
  const boundary=globalThis[Symbol.for('DUELVANTA_M4_FORBIDDEN_IO')];report.io.forbidden_external_io_attempts=boundary.attempts.slice();report.io.local_pg_connections=boundary.local_pg_connections;if(boundary.attempts.length){report.passed=false;report.native_acceptance=false;process.exitCode=1;}
  await mkdir(OUT,{recursive:true});await writeFile(OUT+'/native-report.json',JSON.stringify(report,null,2)+'\n');
 }
}
if(process.argv[1]?.endsWith('tcg-i3-m6-p6-staging-native-test.mjs'))await main();
