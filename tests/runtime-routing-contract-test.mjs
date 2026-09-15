import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const PROD='https://enifiaqsnqtbzylnfrpi.supabase.co';
const STAGING='https://xhmjxrcskfhbovhitdej.supabase.co';
const PROD_KEY='sb_publishable_pk2szDe_g7fJLUdAMEUevw_odrDmnuM';

const directRuntimePages=['index.html','welcome.html','staff.html','staff-admin.html','ranking.html','u.html'];
for(const file of directRuntimePages){
  const source=await read(file);
  assert.ok(source.includes('/api/compliance-message-dispatch?runtime_config=1'),`${file} must load guarded runtime config`);
}
for(const file of ['welcome.html','staff.html','staff-admin.html','ranking.js','u.html','public-battle-profile.js','scanner-v16-host.js']){
  const source=await read(file);
  assert.ok(!source.includes(PROD),`${file} must not hardcode production Supabase`);
}

const login=await read('login.html');
assert.match(login,/const next=\(params\.get\('next'\)\|\|'app\.html'\)\.replace\(\/\[\^a-zA-Z0-9\._-\]\/g,''\)/,'login redirect target must stay same-origin and filename-only');
for(const [file,target] of [['collect.html','collect.html'],['battle.js','battle.html'],['staff.html','staff.html'],['staff-admin.html','staff-admin.html']]){
  const source=await read(file);
  assert.ok(source.includes(`login.html?next=${target}`),`${file} must return unauthenticated users through the shared login route`);
}

const collect=await read('collect.html'),battleHtml=await read('battle.html'),siteNav=await read('site-nav.js');
assert.ok(collect.indexOf('site-nav.js')<collect.indexOf("const SB_URL='https://enifiaqsnqtbzylnfrpi.supabase.co'"),'COLLECT legacy client must be intercepted before creation');
assert.ok(battleHtml.indexOf('site-nav.js')<battleHtml.indexOf('battle.js'),'BATTLE legacy client must be intercepted before battle.js');
assert.match(siteNav,/PRODUCTION_HOSTS=new Set/);
assert.match(siteNav,/STAGING_URL='https:\/\/xhmjxrcskfhbovhitdej\.supabase\.co'/);
assert.match(siteNav,/api\.createClient=\(url,key,options\)=>/);

function executeGuard(hostname,runtime){
  const calls=[];
  const supabase={createClient:(url,key,options)=>{calls.push({url,key,options});return {auth:{}}}};
  const window={supabase,DV_SUPABASE:runtime};
  const location={hostname,pathname:'/collect.html'};
  const document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},head:{appendChild(){}},body:{appendChild(){}}};
  const context=createContext({window,location,document,console,Set,Object});
  runInContext(siteNav,context);
  return {window,calls};
}

const previewRuntime={url:STAGING,key:'sb_publishable_preview_test',environment:'preview'};
assert.throws(()=>executeGuard('preview.example.vercel.app',previewRuntime),/runtime environment mismatch/,'unknown runtime key/config must fail closed');
const preview=executeGuard('duelvantav5vision-git-marketplace-ux-v1-bennyescaped-3783.vercel.app');
preview.window.supabase.createClient(PROD,PROD_KEY,{auth:{persistSession:true}});
assert.equal(preview.calls[0].url,STAGING,'Preview must redirect legacy production client requests to staging');
assert.ok(preview.calls[0].key.startsWith('sb_publishable_'));
assert.ok(preview.window.__dvAppDb,'legacy authenticated pages must expose the guarded client to session/nav helpers');
assert.throws(()=>preview.window.supabase.createClient('https://unapproved.supabase.co','sb_publishable_x',{}),/unapproved Supabase client/);

const production=executeGuard('duelvanta.de');
production.window.supabase.createClient(PROD,PROD_KEY,{auth:{persistSession:true}});
assert.equal(production.calls[0].url,PROD,'Production host must remain on production Supabase');

const staffAdmin=await read('staff-admin.html');
assert.match(staffAdmin,/getAuthenticatorAssuranceLevel/,'staff admin must require MFA assurance');
assert.match(staffAdmin,/currentLevel!=='aal2'/,'staff admin must step up before privileged UI access');

console.log('PASS: all preview entry points use staging runtime, legacy COLLECT/BATTLE clients are intercepted before creation, redirects remain same-origin, and staff admin requires AAL2');
