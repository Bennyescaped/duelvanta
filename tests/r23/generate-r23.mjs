import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {setup,read,sha,scalar,capture,inventoryDiff,ROOTS,quote,FUNCTIONS} from './fixture.mjs';
export const BASE='database/target-upgrades/staging-magic-battle-r23-v1/';
export const NAME='dv_staging_magic_battle_r23_v1';
export const CHANGED=['public.create_battle_match_v2','public.join_battle_match','public.set_battle_ready','public.start_battle_match','battle_spectator_private.authorized','battle_spectator_media_private.sync_epoch','public.set_battle_spectator_link','public.set_battle_spectator_media_consent'];
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,'unique exact replacement: '+a);return s.replace(a,b)};
export function candidate(before){
 const f=n=>before.functions.find(x=>x.signature.startsWith(n+'(')).definition;
 const edited=[];
 let s=f(CHANGED[0]);s=replace(s,"p_tcg not in ('pokemon','one_piece')","p_tcg not in ('pokemon','one_piece','magic')");
 s=replace(s,"  select * into v_profile", "  if p_tcg='magic' and p_mode is distinct from 'casual' then raise exception 'magic_battle_casual_only'; end if;\n\n  select * into v_profile");
 s=replace(s,"  if exists(select 1 from public.battle_matches", "  if p_tcg='magic' and not battle_spectator_private.eligible(auth.uid()) then raise exception 'magic_battle_access_required' using errcode='42501'; end if;\n\n  if exists(select 1 from public.battle_matches");edited.push(s);
 s=f(CHANGED[1]);s=replace(s," if v_match.host_id=auth.uid()", " if v_match.tcg='magic' and not battle_spectator_private.eligible(auth.uid()) then raise exception 'magic_battle_access_required' using errcode='42501'; end if;\n if v_match.host_id=auth.uid()");edited.push(s);
 for(const name of CHANGED.slice(2,4)){
  s=f(name);s=replace(s,"if v.moderation_state='paused'", "if v.tcg='magic' and not battle_spectator_private.eligible(auth.uid()) then raise exception 'magic_battle_access_required' using errcode='42501'; end if; if v.moderation_state='paused'");
  if(name.endsWith('start_battle_match'))s=replace(s,"update public.battle_matches set status='live'", "if v.tcg='magic' and (not battle_spectator_private.eligible(v.host_id) or not battle_spectator_private.eligible(v.guest_id)) then raise exception 'magic_battle_access_required' using errcode='42501'; end if; update public.battle_matches set status='live'");edited.push(s);
 }
 s=f(CHANGED[4]);s=replace(s,'where m.id=p_match','where m.id=p_match and m.tcg in (\'pokemon\',\'one_piece\')');edited.push(s);
 s=f(CHANGED[5]);s=replace(s,'o:=c.media_enabled','o:=m.tcg in (\'pokemon\',\'one_piece\') and c.media_enabled');edited.push(s);
 for(const [name,param] of [[CHANGED[6],'p_enabled'],[CHANGED[7],'p_granted']]){
  s=f(name);s=replace(s,'  if '+param+' then',"  if m.tcg='magic' and "+param+" then raise exception 'magic_battle_spectators_disabled' using errcode='42501'; end if;\n  if "+param+' then');edited.push(s);
 }
 return `-- R23 isolated candidate: no hosted apply authorized. No data/config/ACL writes.\nalter table public.battle_matches drop constraint battle_matches_tcg_check;\nalter table public.battle_matches add constraint battle_matches_tcg_check check (tcg in ('pokemon','one_piece','magic'));\nalter table public.battle_matches add constraint battle_matches_magic_casual_check check (tcg <> 'magic' or mode = 'casual');\n`+edited.map(s=>s+';\n').join('\n');
}
export function assertDelta(b,a){
 const d=inventoryDiff(b,a);assert.deepEqual(d.legal_inventory,{added:[],removed:[],changed:[]});
 assert.deepEqual(d.security_inventory.removed,[]);
 assert.deepEqual(d.security_inventory.added.map(x=>x.slice(0,2)),[['catalog_constraint','public.battle_matches.battle_matches_magic_casual_check']]);
 const expected=[...CHANGED,'public.battle_matches.battle_matches_tcg_check'].sort();
 assert.deepEqual(d.security_inventory.changed.map(x=>x.before[1].split('(')[0]).sort(),expected);return d;
}
export async function generate(db){
 const before=await capture(db);assert.equal(before.history.length,75);
 const staged=JSON.parse(await read('tests/r23/staging-baseline.json'));assert.deepEqual(before.inventory,staged.inventory);assert.deepEqual(before.history,staged.history);
 const sql=candidate(before),rootRow=(state,n)=>state.functions.find(f=>f.signature==='public.'+n+'()');
 const fnHash=async()=>scalar(db,`select md5(jsonb_agg(to_jsonb(f) order by signature collate "C")::text) v from (${FUNCTIONS}) f`);
 const beforeHash=await fnHash();await db.exec('begin');try{
  await db.exec(sql);const target=await capture(db),diff=assertDelta(before.inventory,target.inventory);
  const roots=ROOTS.map((n,i)=>rootRow(before,n).definition.replace(/\$target\$[\s\S]*?\$target\$/,()=>'$target$'+JSON.stringify(target.inventory[i?'legal_inventory':'security_inventory'])+'$target$')+';\n').join('');
  await db.exec(roots);const after=await capture(db),afterHash=await fnHash();assert.deepEqual(after.inventory,target.inventory);
  assert.equal(after.readiness.security.compatible,true);assert.equal(after.readiness.legal.compatible,true);
  for(const f of after.functions){const old=before.functions.find(x=>x.signature===f.signature);assert.ok(old);assert.deepEqual({...f,definition:null},{...old,definition:null});if(ROOTS.some(n=>f.signature==='public.'+n+'()'))assert.equal(f.definition.replace(/\$target\$[\s\S]*?\$target\$/,'TARGET'),old.definition.replace(/\$target\$[\s\S]*?\$target\$/,'TARGET'));else if(!CHANGED.some(n=>f.signature.startsWith(n+'(')))assert.deepEqual(f,old);}
  const hashSQL=`select md5(jsonb_agg(to_jsonb(f) order by signature collate "C")::text) v from (${FUNCTIONS}) f`;
  const core=(s,h)=>`current_setting('server_version_num')::int/10000=17 and current_user='postgres' and (${hashSQL})=${quote(h)} and dv_collect_private.magic_collect_admission_schema_v1()=${quote(JSON.stringify(s.inventory))}::jsonb and coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false) and coalesce((public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean,false)`;
  const history=`(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations)=${quote(JSON.stringify(before.history))}::jsonb`;
  const pre=`select coalesce(${history} and ${core(before,beforeHash)},false) as "PRECHECK_PASS"`,inside=`select coalesce(${core(after,afterHash)},false) as "SCHEMA_POSTCHECK_PASS"`;
  const post=`select coalesce((${inside}) and (select count(*)=76 from supabase_migrations.schema_migrations) and (select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from (select version,name from supabase_migrations.schema_migrations order by version limit 75) h)=${quote(JSON.stringify(before.history))}::jsonb and (select count(*)=1 from supabase_migrations.schema_migrations where name='${NAME}' and version>'20261018125255'),false) as "POSTCHECK_PASS"`;
  const guard=(q,label)=>`do $guard$ begin if not coalesce((${q}),false) then raise exception '${label}'; end if; end $guard$;\n`;
  const unit='-- CANDIDATE ONLY: one registrar transaction, no embedded transaction control.\n'+guard(pre,'R23_PRECHECK_STOP')+sql+roots+guard(inside,'R23_POSTCHECK_STOP');
  const files={'candidate.sql':sql,'precheck.sql':pre+';\n','schema-postcheck.sql':inside+';\n','postcheck.sql':post+';\n','migration.sql':unit,'readiness-diff.json':JSON.stringify(diff,null,2)+'\n','inventories.json':JSON.stringify({before:before.inventory,after:after.inventory})+'\n'};
  files['manifest.json']=JSON.stringify({contract:'magic-battle-casual-r23/1',package_version:1,target_project:'xhmjxrcskfhbovhitdej',source_head:'b7109a0d76dc1787c35287aa33224f58bc9568db',real_apply_authorized:false,preview_authorized:false,required_history:before.history,expected_history_count:76,unit:{name:NAME,path:'migration.sql',sha256:sha(unit),transaction:'SINGLE_REGISTRAR_TRANSACTION_NO_EMBEDDED_CONTROL'},changed_functions:CHANGED,readiness:'only frozen target inventories; legal inventory unchanged, existing Security dependency preserved',runtime_learning:false,files:Object.entries(files).map(([path,s])=>({path,sha256:sha(s),bytes:Buffer.byteLength(s)}))},null,2)+'\n';
  return {files,before,after,diff};
 }finally{await db.exec('rollback');}
}
if(process.argv[1]?.endsWith('/r23/generate-r23.mjs')){const db=await setup(process.argv.includes('--native'));try{const a=await generate(db);await mkdir(BASE,{recursive:true});for(const [p,s] of Object.entries(a.files))await writeFile(BASE+p,s);console.log('PASS R23 frozen candidate',JSON.stringify(a.diff));}finally{await db.close();}}
