import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const gate=await readFile(new URL('../trade-release-gate.js',import.meta.url),'utf8');
const html=await readFile(new URL('../trade.html',import.meta.url),'utf8');
const dispatcher=await readFile(new URL('../api/compliance-message-dispatch.js',import.meta.url),'utf8');

assert.match(html,/trade-release-gate\.css\?v=1\.0/);
assert.match(html,/trade-release-gate\.js\?v=1\.0/);
assert.doesNotMatch(html,/<script src="trade\.js"><\/script>/);
assert.match(dispatcher,/config\.environment==='production'/);
assert.match(dispatcher,/status\(423\)/);
assert.match(dispatcher,/COMING SOON 2027/);

const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function runGate({environment,role=null,session=true}){
  const{window,document}=parseHTML('<!doctype html><html><head></head><body><div id="app" class="wrap hidden"><header class="top"><nav class="dv-global-nav"><div class="dv-nav-links"></div></nav><button id="logout">Abmelden</button></header><section class="hero"></section><section class="daily"></section><div class="tabs"></div><div class="toolbar"></div><section class="marketGrid"></section></div></body></html>');
  const loaded=[];
  let holdObserved=false;
  const originalAppend=document.body.appendChild.bind(document.body);
  document.body.appendChild=node=>{
    if(String(node.tagName).toLowerCase()==='script'){
      const src=node.getAttribute('src')||node.src||'';
      loaded.push(src);
      if(document.documentElement.getAttribute('data-dv-trade-runtime-hold')==='1')holdObserved=true;
      queueMicrotask(()=>{
        if(src.includes('trade-orders.js'))window.DV_TRADE_ORDERS={version:'test'};
        if(src.includes('trade-marketplace-ux.js'))window.DV_TRADE_MARKETPLACE_UX={version:'test'};
        if(src.includes('trade-search-archive.js'))window.DV_TRADE_SEARCH_ARCHIVE={version:'test'};
        node.onload?.();
      });
      return node;
    }
    return originalAppend(node);
  };
  const db={
    auth:{
      getSession:async()=>({data:{session:session?{user:{id:'95000000-0000-4000-8000-000000000001'}}:null}}),
      signOut:async()=>{}
    },
    from:()=>({select:()=>({eq:()=>({single:async()=>({data:{role},error:null})})})})
  };
  window.supabase={createClient:()=>db};
  window.DV_SUPABASE={url:'https://example.supabase.co',key:'sb_publishable_test',environment};
  const context=vm.createContext({window,document,location:{href:'https://example.test/trade.html'},console,queueMicrotask,setTimeout,clearTimeout,Object,Error,Promise,Date});
  vm.runInContext(gate,context,{filename:'trade-release-gate.js'});
  await wait(60);
  return{window,document,loaded,holdObserved};
}

const locked=await runGate({environment:'production',role:'player'});
assert.equal(locked.window.DV_TRADE_RELEASE.state,'locked');
assert.equal(locked.loaded.length,0);
assert.equal(locked.document.getElementById('app').classList.contains('hidden'),false);
assert.equal(locked.document.documentElement.hasAttribute('data-dv-trade-runtime-hold'),false);
assert.match(locked.document.getElementById('tradeReleaseLockScreen').textContent,/COMING SOON 2027/);

const anonymous=await runGate({environment:'production',session:false});
assert.equal(anonymous.window.DV_TRADE_RELEASE.state,'locked');
assert.equal(anonymous.loaded.length,0);

const owner=await runGate({environment:'production',role:'owner'});
assert.equal(owner.window.DV_TRADE_RELEASE.state,'owner-bypass');
assert.ok(owner.loaded.some(src=>src.includes('trade.js')));
assert.ok(owner.loaded.some(src=>src.includes('trade-search-archive.js')));
assert.ok(owner.document.querySelector('.dv-nav-links [href="control-center.html"]'));
assert.equal(owner.holdObserved,true);
assert.equal(owner.document.documentElement.hasAttribute('data-dv-trade-runtime-hold'),false);
assert.equal(owner.document.getElementById('app').classList.contains('hidden'),false);

const preview=await runGate({environment:'preview',role:'player'});
assert.equal(preview.window.DV_TRADE_RELEASE.state,'internal-preview');
assert.ok(preview.loaded.some(src=>src.includes('trade.js')));
assert.ok(preview.loaded.some(src=>src.includes('trade-pickup-messages.js')));
assert.equal(preview.holdObserved,true);
assert.equal(preview.document.documentElement.hasAttribute('data-dv-trade-runtime-hold'),false);
assert.equal(preview.document.getElementById('app').classList.contains('hidden'),false);

console.log('PASS: TRADE is production-locked for normal users, owner-bypassed, preview-open, runtime-held until core UI is ready, and public listing shares are production-locked');