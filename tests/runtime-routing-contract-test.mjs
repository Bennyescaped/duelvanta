import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import {relative} from 'node:path';
import {createContext,runInContext} from 'node:vm';

const require=createRequire(import.meta.url);
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');
const {PRODUCTION_URL,STAGING_URL,resolveSupabaseEnvironment,resolveSupabaseRuntimeConfig}=require('../supabase-environment.js');
const runtimeHandler=require('../api/compliance-message-dispatch.js');
const {createHandler}=require('../benchmark/scanner-pilot/recognize-server.cjs');

assert.deepEqual(resolveSupabaseEnvironment({VERCEL_ENV:'preview'}),{environment:'preview',url:STAGING_URL});
assert.deepEqual(resolveSupabaseEnvironment({VERCEL_ENV:'production'}),{environment:'production',url:PRODUCTION_URL});
assert.deepEqual(resolveSupabaseEnvironment({VERCEL_ENV:'development'}),{environment:'development',url:STAGING_URL});
assert.throws(()=>resolveSupabaseEnvironment({VERCEL_ENV:'preview',SUPABASE_URL:PRODUCTION_URL}),/supabase_environment_mismatch/);
assert.throws(()=>resolveSupabaseEnvironment({VERCEL_ENV:'production',SUPABASE_URL:STAGING_URL}),/supabase_environment_mismatch/);
assert.throws(()=>resolveSupabaseEnvironment({VERCEL_ENV:'development',SUPABASE_URL:PRODUCTION_URL}),/supabase_environment_mismatch/);
assert.equal(resolveSupabaseRuntimeConfig({VERCEL_ENV:'preview'}).url,STAGING_URL);
assert.equal(resolveSupabaseRuntimeConfig({VERCEL_ENV:'production'}).url,PRODUCTION_URL);

const originalEnv={...process.env};
function response(){return {statusCode:200,headers:{},body:'',status(code){this.statusCode=code;return this},setHeader(name,value){this.headers[name.toLowerCase()]=value},send(body){this.body=body;return this},json(body){this.body=body;return this}}}
async function runtime(environment,url){
  process.env.VERCEL_ENV=environment;
  if(url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=url;
  const res=response();await runtimeHandler({method:'GET',query:{runtime_config:'1'}},res);return res;
}
function configFrom(script){const context=createContext({window:{}});runInContext(script,context);return context.window.DV_SUPABASE}

try{
  let res=await runtime('preview');assert.equal(res.statusCode,200);assert.equal(configFrom(res.body).url,STAGING_URL);
  res=await runtime('production');assert.equal(res.statusCode,200);assert.equal(configFrom(res.body).url,PRODUCTION_URL);
  res=await runtime('preview',PRODUCTION_URL);assert.equal(res.statusCode,503);
  res=await runtime('production',STAGING_URL);assert.equal(res.statusCode,503);
}finally{
  for(const key of Object.keys(process.env))if(!(key in originalEnv))delete process.env[key];
  Object.assign(process.env,originalEnv);
}

const pages={
  'collect.html':'site-nav.js?v=16.27.0',
  'battle.html':'battle.js',
  'battle-spectator.html':'battle-spectator.js'
};
for(const [file,consumer] of Object.entries(pages)){
  const source=await read(file),runtime='/api/compliance-message-dispatch?runtime_config=1';
  assert.ok(source.includes(runtime),`${file} must load the central runtime config`);
  assert.ok(source.indexOf(runtime)<source.indexOf(consumer),`${file} must resolve its environment before ${consumer}`);
}

const routedClients={
  'collect.html':['DV_SUPABASE','createClient(SB_URL,SB_KEY,'],
  'battle.js':['DV_SUPABASE','createClient(SB_URL,SB_KEY,'],
  'battle-spectator.js':['DV_SUPABASE','createClient(config.url,config.key,'],
  'battle-spectator-media-publisher.js':['DV_SUPABASE.url','battle-spectator-media-broker'],
  'battle-spectator-media-viewer.js':['DV_SUPABASE.url','battle-spectator-media-broker','window.__dvAppDb'],
  'control-center.js':['window.__dvAppDb'],
  'control-center-auth-preflight.js':['DV_SUPABASE','window.__dvAppDb=preflight']
};
for(const [file,markers] of Object.entries(routedClients)){
  const source=await read(file);
  for(const marker of markers)assert.ok(source.includes(marker),`${file} must use ${marker}`);
  assert.ok(!source.includes(PRODUCTION_URL)&&!source.includes(STAGING_URL),`${file} must not own an environment target`);
}

const spectatorViewer=await read('battle-spectator-media-viewer.js');
assert.ok(!spectatorViewer.includes('async function broker(a){const {data:{session}}=await db.auth.getSession()'),'spectator viewer must not reference the spectator client outside its private scope');

const routedServerPaths={
  'api/compliance-message-dispatch.js':'resolveSupabaseEnvironment',
  'api/account-data-erasure.js':'resolveSupabaseEnvironment',
  'api/market-stripe-lib.js':'resolveSupabaseEnvironment',
  'market-tracking-aftership.js':'resolveSupabaseRuntimeConfig',
  'benchmark/scanner-pilot/recognize-server.cjs':'resolveSupabaseRuntimeConfig'
};
for(const [file,resolver] of Object.entries(routedServerPaths)){
  const source=await read(file);
  assert.ok(source.includes(resolver),`${file} must use the central resolver`);
  assert.ok(!source.includes(PRODUCTION_URL)&&!source.includes(STAGING_URL),`${file} must not own an environment target`);
}

const scannerUrls=[];
const scanner=createHandler({
  env:{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'scanner-v16',OPENAI_API_KEY:'test-only',DV_OPENAI_ACCOUNTING_KEY:'x'.repeat(32)},
  config:{enabled:true},
  fetchImpl:async url=>{
    scannerUrls.push(String(url));
    if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'10000000-0000-4000-8000-000000000001'}),{status:200});
    if(String(url).includes('/rpc/dv_v16_openai_scan_budget'))return new Response(JSON.stringify({enabled:true,remaining:50,slabRemaining:10}),{status:200});
    throw new Error('unexpected scanner request');
  }
});
let scannerResponse=response();
await scanner({method:'GET',headers:{authorization:'Bearer test.preview.token'}},scannerResponse);
assert.equal(scannerResponse.statusCode,200);
assert.ok(scannerUrls.length===2&&scannerUrls.every(url=>url.startsWith(STAGING_URL)),'Preview scanner quota/auth must use staging only');
assert.ok(scannerUrls.every(url=>!url.startsWith(PRODUCTION_URL)));

let blockedFetches=0;
const blockedScanner=createHandler({
  env:{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'scanner-v16',SUPABASE_URL:PRODUCTION_URL,OPENAI_API_KEY:'test-only',DV_OPENAI_ACCOUNTING_KEY:'x'.repeat(32)},
  config:{enabled:true},fetchImpl:async()=>{blockedFetches++;throw new Error('must not fetch')}
});
scannerResponse=response();await blockedScanner({method:'GET',headers:{authorization:'Bearer test.preview.token'}},scannerResponse);
assert.equal(scannerResponse.statusCode,503);assert.equal(blockedFetches,0,'mismatched scanner routing must fail before network access');

async function runtimeFiles(dir=root){
  const paths=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(entry.name==='.git'||entry.name==='node_modules'||entry.name==='tests'||entry.name==='test-results')continue;
    const url=new URL(entry.name+(entry.isDirectory()?'/':''),dir);
    if(entry.isDirectory())paths.push(...await runtimeFiles(url));
    else if(/\.(?:js|cjs|html)$/.test(entry.name))paths.push(url);
  }
  return paths;
}
const targetOwners=[],keyOwners=[];
for(const url of await runtimeFiles()){
  const source=await readFile(url,'utf8'),name=relative(root.pathname,url.pathname);
  if(source.includes('enifiaqsnqtbzylnfrpi')||source.includes('xhmjxrcskfhbovhitdej'))targetOwners.push(name);
  if(/(?:eyJ[A-Za-z0-9_-]{20,}|sb_(?:publishable|secret)_[A-Za-z0-9_-]{10,})/.test(source))keyOwners.push(name);
}
assert.deepEqual(targetOwners,['supabase-environment.js'],'only the central resolver may own Supabase project targets');
assert.deepEqual(keyOwners,['supabase-environment.js'],'only the central resolver may own static public Supabase keys');

console.log('PASS: centralized Production/Preview Supabase routing, COLLECT/BATTLE/Spectator adoption, scanner quota isolation and runtime hardcoding scan');
