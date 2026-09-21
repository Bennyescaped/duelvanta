import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {setImmediate as flushMicrotasks} from 'node:timers/promises';

const require=createRequire(import.meta.url);
const handler=require('../api/compliance-message-dispatch.js');
const original={VERCEL_ENV:process.env.VERCEL_ENV,SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY};
const originalFetch=globalThis.fetch;
// Focused local mode skips only the unchanged legacy page source scans; CI always runs all scans.
const profileOnly=process.argv.includes('--profile-only');
assert.ok(process.env.GITHUB_ACTIONS!=='true'||!profileOnly,'CI must run the complete runtime configuration test');
globalThis.fetch=()=>{throw new Error('Network access is forbidden in runtime configuration tests')};
const STAGING_URL='https://xhmjxrcskfhbovhitdej.supabase.co';
const PRODUCTION_URL='https://enifiaqsnqtbzylnfrpi.supabase.co';
const PREVIEW_HOST='duelvantav5vision-b01-test-bennyescaped-3783.vercel.app';
const publicTestKey='sb_publishable_profile_test_only';
const validPreview={url:STAGING_URL,key:publicTestKey,environment:'preview'};

function invoke(method='GET',runtime=true){
  const response={statusCode:200,headers:{},body:'',status(code){this.statusCode=code;return this},setHeader(name,value){this.headers[name.toLowerCase()]=value},send(body){this.body=body;return this},json(body){this.body=body;return this}};
  handler({method,query:runtime?{runtime_config:'1'}:{}},response);return response;
}

// The actual profile scripts run here; every client/DOM/storage/network operation is a local mock.
function browser(config,hostname=PREVIEW_HOST,protocol='https:'){
  const clients=[],rpcCalls=[],signOuts=[],redirects=[],nodes=new Map();let sessionReads=0;
  function node(id){
    if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',className:'',listeners:{},addEventListener(type,callback){this.listeners[type]=callback},click(){},remove(){}});
    return nodes.get(id);
  }
  const db={
    auth:{getSession:async()=>{sessionReads++;return {data:{session:null}}},signOut:async options=>{signOuts.push(options)}},
    rpc:async(name,args)=>{rpcCalls.push({name,args});return {data:name==='request_my_account_deletion'?{accepted:true}:{test_only:true},error:null}},
    from(){throw new Error('No profile database reads are expected in this unauthenticated mock')}
  };
  const location={hostname,protocol,replace:target=>redirects.push(target)};
  const window={location,DV_SUPABASE:config,__dvAppDb:{unsafe_old_client:true},supabase:{createClient:(url,key,options)=>{clients.push({url,key,options});return db}}};
  const document={getElementById:node,querySelectorAll:()=>[],createElement:()=>node('mock-download'),body:{append(){}}};
  const context=createContext({window,document,location,console,fetch:globalThis.fetch,
    Blob:class MockBlob{},URL:{createObjectURL:()=> 'blob:local-mock',revokeObjectURL(){}},
    crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},setTimeout:()=>0,clearTimeout(){}});
  return {window,context,clients,rpcCalls,signOuts,redirects,nodes,node,db,get sessionReads(){return sessionReads}};
}

try{
  process.env.VERCEL_ENV='preview';delete process.env.SUPABASE_URL;delete process.env.SUPABASE_PUBLISHABLE_KEY;
  let response=invoke();
  assert.equal(response.statusCode,200,'preview must use its embedded public staging configuration');
  assert.match(response.body,/xhmjxrcskfhbovhitdej/);
  const previewScript=response.body;

  process.env.SUPABASE_URL=PRODUCTION_URL;process.env.SUPABASE_PUBLISHABLE_KEY=publicTestKey;
  response=invoke();
  assert.equal(response.statusCode,503,'preview must reject the production project');
  const rejectedRuntimeScript=response.body;

  process.env.SUPABASE_URL='https://unapproved.supabase.co';
  response=invoke();
  assert.equal(response.statusCode,503,'preview must reject every project except the isolated staging project');

  process.env.SUPABASE_URL=STAGING_URL;process.env.SUPABASE_PUBLISHABLE_KEY=publicTestKey;
  response=invoke();
  assert.equal(response.statusCode,200);
  assert.match(response.body,/xhmjxrcskfhbovhitdej/);
  assert.doesNotMatch(response.body,/SERVICE_ROLE|secret/i,'runtime response must not expose server authority');
  assert.equal(response.headers['cache-control'],'private, no-store, max-age=0');

  process.env.VERCEL_ENV='production';delete process.env.SUPABASE_URL;delete process.env.SUPABASE_PUBLISHABLE_KEY;
  response=invoke();
  assert.equal(response.statusCode,200,'production keeps its existing public configuration');
  assert.match(response.body,/enifiaqsnqtbzylnfrpi/);
  const productionScript=response.body;

  assert.equal(invoke('GET',false).statusCode,405);

  for(const file of [...(profileOnly?[]:['trade.html','login.html','reset-password.html','app.html','seller-onboarding.html','listing-report.html','admin.html','mfa.html','control-center.html']),'profile.html']){
    const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
    assert.ok(source.includes('/api/compliance-message-dispatch?runtime_config=1'),`${file} does not load the guarded runtime configuration`);
  }
  for(const file of [...(profileOnly?[]:['trade.js','login.html','reset-password.html','app.html','seller-onboarding.js','listing-report.js','admin.html','mfa.js','control-center-auth-preflight.js']),'profile.js']){
    const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
    assert.ok(source.includes('DV_SUPABASE'),`${file} does not consume the guarded runtime configuration`);
    assert.ok(!source.includes(PRODUCTION_URL),`${file} still hardcodes production Supabase`);
  }

  const profileHtml=await readFile(new URL('../profile.html',import.meta.url),'utf8');
  const profileSource=await readFile(new URL('../profile.js',import.meta.url),'utf8');
  const rightsSource=await readFile(new URL('../profile-data-rights.js',import.meta.url),'utf8');
  const scripts=[...profileHtml.matchAll(/<script\b([^>]*)>\s*<\/script>/gi)].map(match=>({attributes:match[1],src:match[1].match(/\bsrc="([^"]+)"/)?.[1]}));
  const runtimeIndex=scripts.findIndex(script=>script.src==='/api/compliance-message-dispatch?runtime_config=1');
  const profileIndex=scripts.findIndex(script=>script.src?.startsWith('profile.js?'));
  const rightsIndex=scripts.findIndex(script=>script.src?.startsWith('profile-data-rights.js?'));
  assert.equal(scripts.filter(script=>script.src==='/api/compliance-message-dispatch?runtime_config=1').length,1);
  assert.ok(runtimeIndex>=0&&runtimeIndex<profileIndex&&profileIndex<rightsIndex,'runtime must execute before PROFILE and its dependent modules');
  for(const index of [runtimeIndex,profileIndex,rightsIndex])assert.doesNotMatch(scripts[index].attributes,/\b(?:async|defer|type)\s*(?:=|\s|$)/i,'PROFILE bootstrap scripts must remain parser-blocking classic scripts');
  assert.equal(scripts[profileIndex].src,'profile.js?v=1.3','the changed profile resource needs its new cache version');
  assert.equal(scripts[rightsIndex].src,'profile-data-rights.js?v=2','the changed data-rights resource needs its new cache version');
  assert.match(profileHtml,/profile\.css\?v=1\.1/,'unchanged CSS must keep its cache version');
  assert.equal((profileSource.match(/createClient\(/g)||[]).length,1,'PROFILE must have exactly one guarded client factory');
  assert.match(rightsSource,/db=window\.__dvAppDb/);
  assert.doesNotMatch(rightsSource,/createClient|supabase\.co/,'data-rights must not create a second or fallback client');

  const good=browser();
  runInContext(previewScript,good.context);
  assert.ok(Object.isFrozen(good.window.DV_SUPABASE));
  runInContext(profileSource,good.context);
  await flushMicrotasks();
  assert.equal(good.clients.length,1);
  assert.equal(good.clients[0].url,STAGING_URL);
  assert.equal(good.clients[0].key,good.window.DV_SUPABASE.key);
  assert.deepEqual(JSON.parse(JSON.stringify(good.clients[0].options)),{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  assert.equal(good.window.__dvAppDb,good.db,'dependent modules must receive the exact guarded client');
  assert.equal(good.sessionReads,1);
  assert.deepEqual(good.redirects,['login.html?next=profile.html']);

  // Only local spies: no export, deletion, sign-out or other request reaches Supabase.
  runInContext(rightsSource,good.context);
  await good.node('exportMyData').listeners.click({currentTarget:good.node('exportMyData')});
  good.node('deleteAccountConfirmation').value='KONTO LÖSCHEN';
  await good.node('requestAccountDeletion').listeners.click({currentTarget:good.node('requestAccountDeletion')});
  assert.deepEqual(good.rpcCalls.map(call=>call.name),['export_my_duelvanta_data','request_my_account_deletion']);
  assert.equal(good.signOuts.length,1);
  assert.equal(good.signOuts[0].scope,'global');
  assert.equal(good.clients.length,1,'data-rights must reuse the PROFILE client, not instantiate another');

  const invalidConfigs=[
    ['missing',undefined],['null',null],['empty',{}],['wrong type','invalid'],
    ['missing URL',{...validPreview,url:undefined}],['non-string URL',{...validPreview,url:42}],
    ['HTTP URL',{...validPreview,url:STAGING_URL.replace('https:','http:')}],
    ['lookalike hostname',{...validPreview,url:STAGING_URL+'.invalid'}],
    ['URL path',{...validPreview,url:STAGING_URL+'/rest/v1'}],
    ['missing key',{...validPreview,key:undefined}],['empty key',{...validPreview,key:''}],
    ['whitespace key',{...validPreview,key:' '}],['newline key',{...validPreview,key:publicTestKey+'\n'}],['non-string key',{...validPreview,key:{}}],
    ['secret-shaped key',{...validPreview,key:'sb_secret_mock_only'}],
    ['malformed public key',{...validPreview,key:'sb_publishable_'}],
    ['missing environment',{...validPreview,environment:undefined}],['unknown environment',{...validPreview,environment:'live'}]
  ];
  for(const [label,config] of invalidConfigs){
    const bad=browser(config);
    assert.throws(()=>runInContext(profileSource,bad.context),/profile database is not safely configured/,label);
    assert.equal(bad.clients.length,0,`${label}: must not call createClient`);
    assert.equal(bad.sessionReads,0,`${label}: must not inspect a session`);
    assert.equal(bad.window.__dvAppDb,null,`${label}: must not leave a stale client available`);
    runInContext(rightsSource,bad.context);
    assert.equal(bad.nodes.size,0,`${label}: no profile or data-rights handlers may be bound`);
  }

  const failedRuntime=browser(validPreview);
  assert.throws(()=>runInContext(rejectedRuntimeScript,failedRuntime.context),/not safely configured/);
  assert.equal(failedRuntime.window.DV_SUPABASE,null);
  assert.throws(()=>runInContext(profileSource,failedRuntime.context),/not safely configured/);
  assert.equal(failedRuntime.clients.length,0);
  assert.equal(failedRuntime.window.__dvAppDb,null);

  const production=browser(undefined,'duelvanta.de');
  runInContext(productionScript,production.context);
  runInContext(profileSource,production.context);
  await flushMicrotasks();
  assert.equal(production.clients.length,1,'the server-selected production runtime must remain functional');
  assert.equal(production.clients[0].url,PRODUCTION_URL);
  assert.equal(production.clients[0].key,production.window.DV_SUPABASE.key);
  assert.equal(production.window.__dvAppDb,production.db);
  assert.deepEqual(production.redirects,['login.html?next=profile.html']);
  const local=browser({...validPreview,environment:'development'},'localhost','http:');
  runInContext(profileSource,local.context);await flushMicrotasks();
  assert.equal(local.clients[0].url,STAGING_URL,'local development stays staging-only');

  const mfaHtml=await readFile(new URL('../mfa.html',import.meta.url),'utf8');
  const mfaSource=await readFile(new URL('../mfa.js',import.meta.url),'utf8');
  const controlHtml=await readFile(new URL('../control-center.html',import.meta.url),'utf8');
  const controlPreflight=await readFile(new URL('../control-center-auth-preflight.js',import.meta.url),'utf8');
  const resetSource=await readFile(new URL('../reset-password.html',import.meta.url),'utf8');
  assert.doesNotThrow(()=>new Function(mfaSource),'MFA script must parse');
  assert.doesNotThrow(()=>new Function(controlPreflight),'control-center auth preflight must parse');
  assert.match(mfaSource,/getAuthenticatorAssuranceLevel/);
  assert.match(mfaSource,/mfa\.enroll/);
  assert.match(mfaSource,/mfa\.challenge/);
  assert.match(mfaSource,/mfa\.verify/);
  assert.match(mfaSource,/\['owner','admin','moderator','judge'\]/,'MFA enrollment must stay limited to privileged roles');
  assert.ok(mfaHtml.indexOf('/api/compliance-message-dispatch?runtime_config=1')<mfaHtml.indexOf('mfa.js?v=1'),'MFA runtime config must load before MFA logic');
  assert.ok(controlHtml.indexOf('/api/compliance-message-dispatch?runtime_config=1')<controlHtml.indexOf('control-center-auth-preflight.js?v=1'),'control-center runtime config must load before its auth gate');
  assert.match(controlPreflight,/aal\.currentLevel!==['"]aal2['"]/,'control center must require AAL2 before loading its legacy management scripts');
  assert.ok(!controlPreflight.includes(PRODUCTION_URL),'control center preflight must not contain a direct production URL fallback');
  assert.match(resetSource,/signOut\(\{scope:'global'\}\)/,'password recovery must revoke all refresh sessions');
  assert.match(rightsSource,/\['owner','admin','moderator','judge'\]/,'profile MFA management must be limited to privileged roles');
  assert.match(rightsSource,/getAuthenticatorAssuranceLevel/,'password changes must honor an enrolled MFA factor');

  const workflow=await readFile(new URL('../.github/workflows/scanner-v16-check.yml',import.meta.url),'utf8');
  const paths=workflow.split('  pull_request:')[1]?.split('  workflow_dispatch:')[0]||'';
  for(const file of ['profile.html','profile.js','profile-data-rights.js','supabase-environment.js','api/compliance-message-dispatch.js','tests/supabase-runtime-config-test.mjs','mfa.html','mfa.js','reset-password.html','control-center.html','control-center-auth-preflight.js','database/auth-*.sql','DUELVANTA_MASTERHANDOUT_V*.md'])assert.ok(paths.includes(`- '${file}'`),`${file} must trigger the existing CI workflow`);
  assert.match(workflow,/^\s+node --check mfa\.js\s*$/m,'CI must syntax-check MFA logic');
  assert.match(workflow,/^\s+node --check control-center-auth-preflight\.js\s*$/m,'CI must syntax-check the control-center auth gate');
  assert.match(workflow,/^\s+node tests\/supabase-runtime-config-test\.mjs\s*$/m,'CI must execute the full test without --profile-only');
  console.log(`PASS: PROFILE/runtime isolation plus privileged MFA, AAL2 control-center gate and recovery session revocation; ${invalidConfigs.length} invalid runtime configurations rejected`);
}finally{
  for(const [name,value] of Object.entries(original))value===undefined?delete process.env[name]:process.env[name]=value;
  globalThis.fetch=originalFetch;
}

console.log(profileOnly?'PASS: focused PROFILE/runtime checks (legacy page source scans reserved for full CI)':'PASS: marketplace and PROFILE previews are locked to the isolated staging Supabase project');
