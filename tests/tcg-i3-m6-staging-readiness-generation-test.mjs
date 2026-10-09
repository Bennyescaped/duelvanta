// PGlite offline candidate verification; not a native PG17 acceptance test.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {generate,verifySources,OUTPUTS,sha256} from './generate-tcg-staging-readiness.mjs';

// A small SQL statement scanner recognizes only top-level statements, skipping
// comments, quoted strings and dollar-quoted authored bodies/inventories.
function statements(sql){
 const result=[];let chunk='',quote=null;
 for(let i=0;i<sql.length;i++){
  const c=sql[i];
  if(quote){
   chunk+=c;
   if(quote.startsWith('$')&&sql.startsWith(quote,i)){chunk+=sql.slice(i+1,i+quote.length);i+=quote.length-1;quote=null;}
   else if(c===quote){if(sql[i+1]===quote){chunk+=sql[++i];}else quote=null;}
   continue;
  }
  if(c==='-'&&sql[i+1]==='-'){while(i<sql.length&&sql[i]!=='\n')i++;chunk+='\n';continue;}
  if(c==="'"||c==='"'){quote=c;chunk+=c;continue;}
  if(c==='$'){const tag=sql.slice(i).match(/^\$[A-Za-z_0-9]*\$/)?.[0];if(tag){quote=tag;chunk+=tag;i+=tag.length-1;continue;}}
  if(c===';'){if(chunk.trim())result.push(chunk.trim());chunk='';}else chunk+=c;
 }
 assert.equal(quote,null,'unterminated quoted SQL');assert.equal(chunk.trim(),'');return result;
}
const before=await verifySources(),run1=await generate(),run2=await generate();
const registry=createRequire(import.meta.url)('../tcg-v1-registry.js'),magic=registry.get('magic');
for(const capability of ['scanner','marketplace','pricing','battle'])assert.notEqual(magic.capabilities[capability].status,'ready');
assert.deepEqual(magic.supported_languages.scanner,[]);assert.deepEqual(magic.supported_languages.pricing,[]);
assert.deepEqual(Object.keys(run1.files),OUTPUTS);assert.deepEqual(run2.files,run1.files,'STOP_GENERATOR_NONDETERMINISTIC');
assert.deepEqual(run2.report,run1.report,'offline report drift');
const files={};
for(const [index,path] of OUTPUTS.entries()){
 const sql=run1.files[path],bytes=await readFile(new URL('../'+path,import.meta.url));
 assert.equal(bytes.toString('utf8'),sql,'generated output manually modified or stale: '+path);
 assert.doesNotMatch(sql,/reject_new_trade_while_locked_v1|a00_production_trade_lock_v1/);
 assert.doesNotMatch(sql,/supabase\.co|enifiaqsnqtbzylnfrpi|xhmjxrcskfhbovhitdej|postgres(?:ql)?:\/\/|service[_-]role[_-]key|sb_secret_|eyJ[A-Za-z0-9_-]+\.eyJ/);
 const ss=statements(sql),allowed=new Set(['public.get_security_schema_readiness_v1','public.get_market_legal_schema_readiness_v1',...(index===1?['dv_collect_private.tcg_catalog_schema_readiness_v1']:index===2?['dv_collect_private.tcg_magic_on_demand_schema_v1']:[])]);
 assert.equal(ss.at(-1).toLowerCase(),'commit');
 assert.equal(ss.filter(s=>s.toLowerCase()==='begin').length,index===0?1:0);
 const authored=[];
 for(const s of ss){
  if(/^(begin|commit)$/i.test(s))continue;
  const creation=s.match(/^create (?:or replace )?function ([a-z_0-9.]+)\(\) returns jsonb/i);
  if(creation){assert.ok(allowed.has(creation[1]));authored.push(creation[1]);continue;}
  const acl=s.match(/^(?:revoke all on function|grant execute on function) ([a-z_0-9.]+)\(\)/i);
  assert.ok(acl&&allowed.has(acl[1]),'STOP_READINESS_TEMPLATE_UNSAFE '+s.slice(0,120));
 }
 assert.deepEqual(new Set(authored),allowed);
 files[path]={generator_run1_sha256:sha256(sql),generator_run2_sha256:sha256(run2.files[path]),final_file_sha256:sha256(bytes),top_level_statements:ss.length,transaction_begin:index===0,transaction_commit:true};
}
assert.deepEqual(await verifySources(),before,'existing source changed');
for(const phase of ['I2','M4','M6']){
 const r=run1.report.phases[phase];assert.equal(r.readiness.s.compatible,true);assert.equal(r.readiness.l.compatible,true);
 assert.deepEqual(r.lock,{f:null,n:0});
 const wrong=run1.report.negative['production_'+phase];assert.equal(wrong.s.compatible,false);assert.equal(wrong.l.compatible,false);
 const injected=run1.report.negative['lock_injection_'+phase];assert.notEqual(injected.fingerprint_before,injected.fingerprint_injected);
 assert.equal(injected.staging_profile_rejected.s.compatible,false);assert.equal(injected.staging_profile_rejected.l.compatible,false);
}
assert.equal(run1.report.phases.M6.beta[0].enabled,false);
console.log(JSON.stringify({status:'M6_STAGING_READINESS_GENERATOR_CANDIDATE_PASS',deterministic_regeneration:'PASS',native_acceptance:false,capabilities:magic.capabilities,files,run1:run1.report,run2:run2.report},null,2));
