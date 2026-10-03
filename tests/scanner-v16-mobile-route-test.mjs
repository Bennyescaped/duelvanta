import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [route,lab,loader,ui,host,benchmarkSession]=await Promise.all([read('scanner-v16.html'),read('scanner-v16-lab.html'),read('scanner-v16-loader.js'),read('scanner-v16-ui.js'),read('scanner-v16-host.js'),read('scanner-v16-benchmark-session.js')]);
assert.ok(route.includes('scanner-v16-host.js?v=16.26.0'));
assert.ok(route.includes('scanner-v16-loader.js?v=16.26.0'));
assert.ok(!route.includes('<iframe'),'direct mobile route must not use an iframe');
assert.ok(route.includes('COLLECT & BINDER ÖFFNEN'),'standalone scanner must expose the digital collection');
assert.ok(lab.includes("location.replace('scanner-v16.html'"),'legacy Lab URL must redirect to direct route');
assert.ok(!lab.includes('<iframe'),'legacy Lab must not retain iframe architecture');
assert.ok(loader.includes('scanner-v16-runtime.js?v=16.24.0'));
assert.ok(loader.includes('scanner-v16-camera.js?v=16.24.0'));
assert.ok(loader.includes('scanner-v16-native-camera.js?v=16.24.0'));
assert.ok(ui.includes('id="dvV16CameraFile"'));
assert.ok(ui.includes('id="dvV16GalleryFile"'));
assert.ok(ui.includes("bind($('dvV16CameraFile'),'change'"));
assert.ok(ui.includes("bind($('dvV16GalleryFile'),'change'"));
assert.ok(ui.includes("host.classList.remove('dvV16Hidden')"),'saved scans must remain visible inline');
assert.ok(!ui.includes("location.assign('collect.html'"),'saved scans must not reload COLLECT');
assert.ok(ui.includes("new CustomEvent('dv:v16:analysis-complete'"));
assert.ok(benchmarkSession.includes("addEventListener('dv:v16:analysis-complete',captureIfNew)"),'benchmark must capture the completed V16 result without polling delay');
assert.ok(host.includes('if(!root.db)root.db=root.supabase.createClient'),'standalone route must create at most one Supabase client');
assert.equal((host.match(/createClient\(/g)||[]).length,1);
for(const source of [route,lab,loader,ui,host])assert.ok(!source.includes('service_role'));
// Exercise actual browser script loading, not merely module names in source.
// Use Script directly so the isolated VM cannot inherit the I2 test preload.
const foundation=['tcg-v1-contracts.js','tcg-v1-game-adapters.js','tcg-v1-catalog-providers.js','tcg-v1-registry.js','tcg-v1-consumers.js'];
const sources=new Map(await Promise.all(foundation.map(async name=>[name,await read(name)])));
for(const scope of ['STANDALONE','COLLECT']){
  const loaded=[];let complete;
  const done=new Promise(resolve=>{complete=resolve});
  const context=vm.createContext({console,CustomEvent:class{constructor(type){this.type=type}},
    setInterval:fn=>setInterval(fn,1),clearInterval,
    DV_SCAN_V16_QUALITY:{installed:true},DV_SCAN_V16_GEOMETRY:{},DV_SCAN_V16_RESILIENCE:{installed:true},DV_SCAN_V16_BENCHMARK:{},DV_SCAN_V16_EXPLAIN:{installed:true}});
  context.window=context;context['DV_SCAN_V16_'+scope]=true;
  context.document={createElement:()=>({}),body:{appendChild(script){
    const name=script.src.split('?')[0];loaded.push(name);
    if(sources.has(name))new vm.Script(sources.get(name),{filename:name}).runInContext(context);
    else assert.ok(context.DV_TCG_V1_CONSUMERS,'foundation must be available before any scanner module');
    script.onload();
  }},dispatchEvent(event){assert.equal(event.type,'dv:v16:ready');complete()}};
  new vm.Script(loader,{filename:'scanner-v16-loader.js'}).runInContext(context);
  await done;
  assert.deepEqual(loaded.slice(0,foundation.length),foundation);
  assert.equal(context.__DV_V16_READY,true);
  assert.equal(context.__DV_V16_LOAD_ERROR,undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(context.DV_TCG_V1_CONSUMERS.games('scanner').map(game=>game.game_key))),['pokemon','one_piece']);
  assert.throws(()=>context.DV_TCG_V1_CONSUMERS.requireGame('unknown','scanner'));
  assert.throws(()=>context.DV_TCG_V1_CONSUMERS.requireGame('magic','scanner'));
}
console.log('PASS: Scanner V16.10 direct route, split photo inputs and benchmark completion integration');
