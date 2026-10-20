import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {database} from '../helpers/tcg-i3-magic-fixture.mjs';
import {history73} from '../r13/fixture.mjs';
export const BASE='database/target-upgrades/staging-magic-scanner-r22-r3-v1/';
export const NAME='dv_staging_magic_scanner_r22_r3_v1';
export const SOURCE='database/local-candidates/magic-scanner-r22-r3/placement.sql';
export const ROOTS=['get_security_schema_readiness_v1','get_market_legal_schema_readiness_v1'];
export const NEW=['get_magic_scan_placement_ready_v1','place_my_magic_scan_item_v1'];
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const read=p=>readFile(p,'utf8');
export const scalar=async(d,s,p=[])=>(await d.query(s,p)).rows[0].v;
export const quote=s=>"'"+s.replaceAll("'","''")+"'";
export const INVENTORY='select dv_collect_private.magic_collect_admission_schema_v1() v';
export const FUNCS=`select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' signature,pg_get_functiondef(p.oid) definition,p.proacl::text acl,pg_get_userbyid(p.proowner) owner,p.prosecdef definer,p.proconfig config,p.provolatile volatility,p.proisstrict strict,p.proleakproof leakproof,p.proparallel parallel from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_collect_private','dv_market_private','dv_v16_private','battle_spectator_private','battle_spectator_media_private') and p.prokind='f' order by 1 collate "C"`;
// ORDER BY a text expression rather than an engine-dependent collation/default order.
export const FUNCTIONS=FUNCS.replace('order by 1 collate "C"',`order by (n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')') collate "C"`);
export const ready=async d=>(await d.query('select public.get_security_schema_readiness_v1() security,public.get_market_legal_schema_readiness_v1() legal')).rows[0];
export async function setup(native){
 const db=native?await database(true):new (await import('@electric-sql/pglite')).PGlite({extensions:{pgcrypto:(await import('@electric-sql/pglite/contrib/pgcrypto')).pgcrypto}});if(!native){const u=await scalar(db,'select current_user v');if(u!=='postgres')await db.exec('create role postgres superuser;set role postgres');}await history73(db);
 const old='database/target-upgrades/staging-m6-r5-v1/',m=JSON.parse(await read(old+'manifest.json'));
 const unit=await read(old+m.units[0].query_path);assert.equal(sha(unit),m.units[0].query_sha256);await db.exec(unit);
 await db.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)',['20261015074650','dv_staging_m6r5_01_magic_operations']);
 assert.equal((await db.query(await read(old+'postcheck.sql'))).rows[0].POSTCHECK_PASS,true);
 return db;
}
export async function capture(db){return {inventory:await scalar(db,INVENTORY),functions:(await db.query(FUNCTIONS)).rows,history:(await db.query('select version,name from supabase_migrations.schema_migrations order by version')).rows,readiness:await ready(db)};}
export function inventoryDiff(before,after){const result={};for(const key of ['security_inventory','legal_inventory']){const b=new Map(before[key].map(x=>[JSON.stringify(x.slice(0,2)),x]));const a=new Map(after[key].map(x=>[JSON.stringify(x.slice(0,2)),x]));result[key]={added:[...a].filter(([k])=>!b.has(k)).map(([,v])=>v),removed:[...b].filter(([k])=>!a.has(k)).map(([,v])=>v),changed:[...b].filter(([k,v])=>a.has(k)&&JSON.stringify(a.get(k))!==JSON.stringify(v)).map(([k,v])=>({before:v,after:a.get(k)}))};}return result;}
export function assertDelta(before,after){const diff=inventoryDiff(before,after);for(const d of Object.values(diff)){assert.deepEqual(d.removed,[]);assert.deepEqual(d.changed,[]);}assert.deepEqual(diff.security_inventory.added.map(x=>x[1].split('(')[0]).sort(),NEW.map(x=>'public.'+x).sort());assert.deepEqual(diff.legal_inventory.added,[]);return diff;}
const rootRow=(s,n)=>s.functions.find(f=>f.signature==='public.'+n+'()');
const fnSnapshotSQL=`select md5(jsonb_agg(to_jsonb(f) order by signature collate "C")::text) v from (${FUNCTIONS}) f`;
export async function generate(db){
 const before=await capture(db);assert.equal(before.history.length,74);assert.equal(before.readiness.security.compatible,true);assert.equal(before.readiness.legal.compatible,true);
 const approved=JSON.parse(await read(BASE+'baseline-reference.json'));assert.deepEqual(before.history,approved.history);for(const n of ROOTS)assert.equal(rootRow(before,n).definition,approved.roots[n]);
 const original=await read(SOURCE);assert.equal(createHash('sha1').update('blob '+Buffer.byteLength(original)+'\0').update(original).digest('hex'),'1c7a162193f206455190385ae3e54710284a772a');
 const placement=original.replace(/^begin;\n/m,'').replace(/^commit;\n/m,'');
 assert.equal(placement.length,original.length-'begin;\ncommit;\n'.length);
 const beforeHash=await scalar(db,fnSnapshotSQL);
 await db.exec('begin');try{
  await db.exec(placement);
  const target=await capture(db),diff=assertDelta(before.inventory,target.inventory);
  const roots=ROOTS.map((n,i)=>rootRow(before,n).definition.replace(/\$target\$[\s\S]*?\$target\$/,()=>'$target$'+JSON.stringify(target.inventory[i?'legal_inventory':'security_inventory'])+'$target$')+';\n').join('');
  await db.exec(roots);const after=await capture(db);assert.deepEqual(after.inventory,target.inventory);assert.equal(after.readiness.security.compatible,true);assert.equal(after.readiness.legal.compatible,true);
  for(const n of ROOTS){const b=rootRow(before,n),a=rootRow(after,n);assert.equal(b.definition.replace(/\$target\$[\s\S]*?\$target\$/,'TARGET'),a.definition.replace(/\$target\$[\s\S]*?\$target\$/,'TARGET'));assert.deepEqual({...b,definition:null},{...a,definition:null});}
  const expectedNew=after.functions.filter(f=>NEW.some(n=>f.signature.startsWith('public.'+n+'(')));
  assert.equal(expectedNew.length,2);for(const f of expectedNew){assert.equal(f.owner,'postgres');assert.equal(f.definer,false);assert.equal(f.acl,'{postgres=X/postgres,authenticated=X/postgres}');}
  const afterHash=await scalar(db,fnSnapshotSQL);
  const core=(state,hash)=>`current_setting('server_version_num')::int/10000=17 and current_user='postgres' and (${fnSnapshotSQL})=${quote(hash)} and dv_collect_private.magic_collect_admission_schema_v1()=${quote(JSON.stringify(state.inventory))}::jsonb and coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false) and coalesce((public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean,false)`;
  const history=`(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations)=${quote(JSON.stringify(before.history))}::jsonb`;
  const pre=`select coalesce(${history} and ${core(before,beforeHash)} and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('${NEW.join("','")}')),false) as "PRECHECK_PASS"`;
  const inside=`select coalesce(${core(after,afterHash)},false) as "SCHEMA_POSTCHECK_PASS"`;
  const post=`select coalesce((${inside}) and (select count(*)=75 from supabase_migrations.schema_migrations) and (select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from (select version,name from supabase_migrations.schema_migrations order by version limit 74) h)=${quote(JSON.stringify(before.history))}::jsonb and (select count(*)=1 from supabase_migrations.schema_migrations where name='${NAME}' and version>'20261015074650'),false) as "POSTCHECK_PASS"`;
  const assertion=(q,label)=>`do $guard$ begin if not coalesce((${q}),false) then raise exception '${label}'; end if; end $guard$;\n`;
  const unit='-- NOT_AUTO_APPLY. One registrar-managed transaction; no embedded BEGIN/COMMIT.\n'+assertion(pre,'R22_R3_PRECHECK_STOP')+placement+roots+assertion(inside,'R22_R3_POSTCHECK_STOP');
  const files={'precheck.sql':pre+';\n','schema-postcheck.sql':inside+';\n','postcheck.sql':post+';\n','migration.sql':unit,'inventories.json':JSON.stringify({before:before.inventory,after:after.inventory},null,2)+'\n','readiness-diff.json':JSON.stringify(diff,null,2)+'\n','functions.json':JSON.stringify({before:before.functions,after:after.functions},null,2)+'\n'};
  const manifest={contract:'magic-scanner-r22-r3-atomic/1',package_version:1,target_project_ref:'xhmjxrcskfhbovhitdej',real_apply_authorized:false,source_head:'1f5b5fc361dd3413238ade5e622f761a9e74f221',source_tree:'4efb9f10f430ccf5c9bdfbf43f9f17ebea07d963',placement_source:SOURCE,placement_git_blob:'1c7a162193f206455190385ae3e54710284a772a',placement_sha256:sha(original),postgres_major:17,required_history:before.history,expected_history_count:75,unit:{name:NAME,version:null,path:'migration.sql',sha256:sha(unit),bytes:Buffer.byteLength(unit),transaction:'SINGLE_REGISTRAR_TRANSACTION_NO_EMBEDDED_CONTROL',on_error:'ROLLBACK_ALL_NO_RETRY'},security_inventory_added:diff.security_inventory.added,legal_inventory_change:'NONE: unchanged required-functions set; existing Security dependency enforces the new bindings',runtime_learning:false,files:[...Object.entries(files).map(([path,s])=>({path,sha256:sha(s),bytes:Buffer.byteLength(s)})),{path:'baseline-reference.json',sha256:sha(await read(BASE+'baseline-reference.json')),bytes:Buffer.byteLength(await read(BASE+'baseline-reference.json'))}]};
  files['manifest.json']=JSON.stringify(manifest,null,2)+'\n';return {files,before,after,diff};
 }finally{await db.exec('rollback');}
}
if(process.argv[1]?.endsWith('/package.mjs')){const native=process.argv.includes('--native');assert.ok(native||process.argv.includes('--embedded'));const db=await setup(native);try{const a=await generate(db);await mkdir(BASE,{recursive:true});for(const [p,s] of Object.entries(a.files))await writeFile(BASE+p,s);console.log(JSON.stringify({generated:true,native,version:db.version||await scalar(db,"select current_setting('server_version_num') v"),diff:a.diff}));}finally{await db.close();}}
