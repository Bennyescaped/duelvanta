// Isolated UI contract; not a genuine MFA or live-session result.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const {resolveSupabaseRuntimeConfig}=createRequire(import.meta.url)('../supabase-environment.js');
assert.throws(()=>resolveSupabaseRuntimeConfig({VERCEL_ENV:'preview',SUPABASE_URL:'https://enifiaqsnqtbzylnfrpi.supabase.co'}),/supabase_environment_mismatch/);
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../security-live-acceptance.js',import.meta.url),'utf8');
async function fixture(config,{aal2=false,revoked=false}={}){
 const nodes=Object.fromEntries(['state','links','run','logout','results'].map(id=>[id,{disabled:true,hidden:true,textContent:''}]));
 const calls=[];let clients=0;
 const db={schema:schema=>({rpc:async(name,args)=>{
  calls.push({schema,name,args});
  if(name==='get_my_privileged_access_v1')return{status:200,data:{owner:aal2&&!revoked,privileged:aal2&&!revoked}};
  if(name.includes('schema_readiness'))return{status:200,data:{compatible:true,revision:'isolated-fixture'}};
  if(name.startsWith('dv_core_'))return{status:404,error:{code:'PGRST202',message:'fixture secret never display'}};
  if(!aal2||revoked)return{status:403,error:{code:'42501',message:revoked?'privileged_session_required':'mfa_step_up_required'}};
  if(name==='review_staff_application'){assert.equal(args.p_application_id,null);return{status:400,error:{code:'P0001',message:'Application unavailable'}}}
  if(name==='join_battle_as_moderator'){assert.equal(args.p_match_id,null);return{status:400,error:{code:'P0001',message:'Match not found'}}}
  return{status:200,data:{private:'fixture secret never display'}};
 },from:()=>({select:()=>({limit:async()=>({status:406,error:{code:'PGRST106',message:'fixture secret never display'}})})})}),
 functions:{invoke:async(name,{body})=>{calls.push({edge:name,body});assert.equal(body.email,'');return{error:{context:{status:aal2&&!revoked?400:403,json:async()=>({error:aal2&&!revoked?'invalid_email':'owner_mfa_session_required'})}}}}},
 auth:{signOut:async()=>({})}};
 vm.runInNewContext(src,{window:{DV_SUPABASE:config,supabase:{createClient:(_url,_key,options)=>{clients++;assert.equal(options.auth.autoRefreshToken,false);return db}}},document:{getElementById:id=>nodes[id]},Date,Set,JSON});
 return{nodes,calls,clients};
}
const staging={environment:'preview',url:'https://xhmjxrcskfhbovhitdej.supabase.co',key:'sb_publishable_isolatedfixture'};
for(const config of [null,{...staging,environment:'production'},{...staging,environment:'development'},{...staging,url:'https://invalid.example'},{...staging,key:'not-a-publishable-key'}]){
 const f=await fixture(config);assert.equal(f.clients,0);assert.equal(f.nodes.run.disabled,true);assert.equal(f.nodes.links.hidden,true);
}
for(const options of [{},{aal2:true},{aal2:true,revoked:true}]){
 const f=await fixture(staging,options);await f.nodes.run.onclick();
 const out=JSON.parse(f.nodes.results.textContent);assert.equal(out.results.length,19);assert.ok(!f.nodes.results.textContent.includes('fixture secret'));
 assert.equal(out.results.find(r=>r.test==='public.dv_v16_owner_openai_scan_settings').ok,!!options.aal2&&!options.revoked);
 assert.equal(f.calls.filter(r=>r.edge).length,2);
 assert.ok(f.calls.every(r=>r.edge||r.name.startsWith('get_')||r.name.startsWith('dv_')||r.name==='review_staff_application'||r.name==='join_battle_as_moderator'));
 await f.nodes.logout.onclick();assert.equal(f.nodes.state.textContent,'Regulär abgemeldet.');
}
console.log('PASS: isolated preview gating, direct AAL1/AAL2/revoked probes, NULL targets, empty invites, redaction; no live MFA claim');
