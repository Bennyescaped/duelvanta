import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const guard=require('../trade-legal-readiness.js');
let assertions=0;
const equal=(a,b,message)=>{assert.equal(a,b,message);assertions++};
const valid=configured=>({data:{configured,schema_version:guard.SCHEMA_VERSION},error:null});
for(const [name,value] of Object.entries({
  missing:null,empty:{},array:{data:[]},missingData:{data:null},
  nonBoolean:{data:{configured:'true',schema_version:guard.SCHEMA_VERSION}},
  legacyShape:{data:{configured:false}},
  partialSchema:{data:{configured:true,schema_version:'other-version'}},
  malformedVersion:{data:{configured:true,schema_version:1}},
  providerError:{...valid(true),error:{message:'permission denied'}}
}))equal(guard.supportsCandidate(value),false,name+' must fail closed');
for(const configured of [true,false])equal(guard.supportsCandidate(valid(configured)),true,'versioned compatibility marker');
equal(await guard.probe(null),false,'missing client');
equal(await guard.probe({rpc:()=>{throw Error('sync failure')}}),false,'sync failure');
equal(await guard.probe({rpc:async()=>{throw Error('network failure')}}),false,'network failure');
let calls=0;
equal(await guard.probe({rpc:async(name,args,options)=>{
  equal(name,'get_my_market_buyer_profile','only existing read RPC');
  assert.deepEqual(args,{});assert.deepEqual(options,{get:true});assertions+=2;
  calls++;return valid(false);
}}),true,'read probe');
equal(calls,1,'only one read probe');
let expire,resolve,cleared=0;
const delayed=new Promise(r=>{resolve=r});
const timed=guard.probe({rpc:()=>delayed},{schedule:fn=>{expire=fn;return 10},cancel:id=>{equal(id,10);cleared++}});
await Promise.resolve();expire();equal(await timed,false,'unanswered probe times out');
resolve(valid(false));await Promise.resolve();equal(await timed,false,'late response cannot reverse a timeout');
equal(cleared,1,'deadline cleaned up');

// No Response global exists in this VM, as in the original project DOM runner.
const sandbox={window:{}};vm.createContext(sandbox);
equal(vm.runInContext('typeof Response',sandbox),'undefined','missing Response reproduced');
vm.runInContext(await readFile(new URL('./trade-ui-mock.js',import.meta.url),'utf8'),sandbox);
const response=await sandbox.window.fetch('/api/market-stripe-checkout',{body:'{"listing_id":"ui-fixed"}'});
equal(response.ok,false,'mock HTTP failure');equal(response.status,409,'mock HTTP status');
equal((await response.json()).error,'Lokaler simulierter Verbindungsabbruch','specific failure, not ReferenceError');
equal(sandbox.window.TRADE_UI_FIXTURE.purchases,0,'no contract on failed request');
equal(await guard.probe(sandbox.window.supabase.createClient()),true,'full UI fixture explicitly advertises synthetic compatibility');
const loadedGuard=await readFile(new URL('../trade-legal-readiness.js',import.meta.url),'utf8');
assert.doesNotMatch(loadedGuard,/createClient\(|\.supabase\.co|stripe\.com|\.from\(/);assertions++;
const loader=await readFile(new URL('../trade-release-gate.js',import.meta.url),'utf8');
assert.match(loader,/guard_version!=='1\.1'/);assertions++;
for(const asset of ['trade-orders.js?v=1.7','trade-offer-details.js?v=2.1','trade-checkout.js?v=2.1']){
 assert.ok(loader.includes("'"+asset+"'"));assertions++;
}
// A not-yet-initialized global client must neither throw nor poll forever.
const tasks=[],listeners=[],elements=new Map();let attempts=0;
const fake={document:{
 body:{appendChild:el=>elements.set(el.id,el)},querySelector:()=>null,
 getElementById:id=>elements.get(id)||null,
 createElement:()=>({setAttribute(){},focus(){},textContent:''}),
 addEventListener:(type,fn,capture)=>listeners.push({type,fn,capture})
},setTimeout:fn=>{tasks.push(fn);return tasks.length},clearTimeout(){}};
Object.defineProperty(fake,'__dvAppDb',{get(){attempts++;throw new ReferenceError('client in temporal dead zone')}});
guard.install(fake);guard.install(fake);
equal(listeners.length,2,'one installation only: click + submit');
for(let n=0;n<150;n++){const task=tasks.shift();assert.equal(typeof task,'function');await task()}
equal(attempts,150,'bounded client discovery');equal(tasks.length,0,'no unbounded polling');
equal(fake.DV_TRADE_LEGAL_SCHEMA.state,'schema-unavailable','TDZ/missing client fails closed');
let blocked=false;
listeners[0].fn({type:'click',target:{closest:()=>null},preventDefault(){blocked=true},stopImmediatePropagation(){}});
equal(blocked,false,'ordinary navigation is not intercepted');
listeners[0].fn({type:'click',target:{closest:()=>({id:'dvBuyNow'})},preventDefault(){blocked=true},stopImmediatePropagation(){}});
equal(blocked,true,'contract click stays blocked after client timeout');
console.log(`PASS: ${assertions} assertions; strict versioned, GET-only probe, timeout, correct mock error and executed loader revisions`);
