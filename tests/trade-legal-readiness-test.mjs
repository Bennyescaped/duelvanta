import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const guard=require('../trade-legal-readiness.js');
let assertions=0;
const equal=(a,b,message)=>{assert.equal(a,b,message);assertions++};
const valid=compatible=>({data:{compatible,revision:guard.SCHEMA_VERSION},error:null});
for(const [name,value] of Object.entries({
  missing:null,empty:{},array:{data:[]},missingData:{data:null},
  nonBoolean:{data:{compatible:'true',revision:guard.SCHEMA_VERSION}},
  legacyShape:{data:{configured:false}},
  partialSchema:{data:{compatible:true,revision:'other-version'}},
  malformedVersion:{data:{compatible:true,revision:1}},
  providerError:{...valid(true),error:{message:'permission denied'}}
}))equal(guard.supportsCandidate(value),false,name+' must fail closed');
for(const compatible of [true,false])equal(guard.supportsCandidate(valid(compatible)),compatible,'real catalog compatibility required');
equal(await guard.probe(null),false,'missing client');
equal(await guard.probe({rpc:()=>{throw Error('sync failure')}}),false,'sync failure');
equal(await guard.probe({rpc:async()=>{throw Error('network failure')}}),false,'network failure');
let calls=0;
equal(await guard.probe({rpc:async(name,args,options)=>{
  equal(name,'get_market_legal_schema_readiness_v1','only catalog read RPC');
  assert.deepEqual(args,{});assert.deepEqual(options,{get:true});assertions+=2;
  calls++;return valid(true);
}}),true,'read probe');
equal(calls,1,'only one read probe');
let expire,resolve,cleared=0;
const delayed=new Promise(r=>{resolve=r});
const timed=guard.probe({rpc:()=>delayed},{schedule:fn=>{expire=fn;return 10},cancel:id=>{equal(id,10);cleared++}});
await Promise.resolve();expire();equal(await timed,false,'unanswered probe times out');
resolve(valid(true));await Promise.resolve();equal(await timed,false,'late response cannot reverse a timeout');
equal(cleared,1,'deadline cleaned up');

// No Response global exists in this VM, as in the original project DOM runner.
const sandbox={window:{}};vm.createContext(sandbox);
equal(vm.runInContext('typeof Response',sandbox),'undefined','missing Response reproduced');
vm.runInContext(await readFile(new URL('./trade-ui-mock.js',import.meta.url),'utf8'),sandbox);
const response=await sandbox.window.fetch('/api/market-stripe-checkout',{body:'{"listing_id":"ui-fixed"}'});
equal(response.ok,false,'mock HTTP failure');equal(response.status,503,'ambiguous checkout must be retryable service-unavailable');
const mockBody=await response.json();equal(mockBody.error,'fixed_checkout_outcome_unknown','specific ambiguous outcome, not ReferenceError');
equal(mockBody.retryable,true,'ambiguous checkout is explicitly retryable');equal(mockBody.contract_formed,false,'mock does not invent a contract');
equal(sandbox.window.TRADE_UI_FIXTURE.purchases,0,'no contract on failed request');
equal(await guard.probe(sandbox.window.supabase.createClient()),true,'full UI fixture explicitly advertises synthetic compatibility');
const loadedGuard=await readFile(new URL('../trade-legal-readiness.js',import.meta.url),'utf8');
assert.doesNotMatch(loadedGuard,/createClient\(|\.supabase\.co|stripe\.com|\.from\(/);assertions++;
const loader=await readFile(new URL('../trade-release-gate.js',import.meta.url),'utf8');
const diagnostics=await readFile(new URL('../trade-legal-live-diagnostics.js',import.meta.url),'utf8');
for(const forbidden of ['.insert(','.update(','.delete(','.upsert(','signInWith','signUp(','resetPassword'])assert.ok(!diagnostics.includes(forbidden),'live diagnostics must stay read-only: '+forbidden);
assert.match(diagnostics,/method:'GET'/);assertions++;
assert.match(diagnostics,/'accept-profile':'dv_market_private'/);assertions++;
assert.match(diagnostics,/DENIED_CODES=new Set\(\['42501','PGRST106','PGRST205'\]\)/);assertions++;
assert.match(loader,/waitForLegalSchema/);assertions++;
assert.ok(loader.indexOf('await waitForLegalSchema()')<loader.indexOf('await loadTradeStack()'));assertions++;
assert.match(loadedGuard,/probe-start/);assert.match(loadedGuard,/probe-result/);assertions+=2;
assert.match(loader,/loader-start/);assert.match(loader,/runtime-ready/);assertions+=2;
assert.match(loader,/guard_version!=='1\.2'/);assertions++;
for(const asset of ['trade-orders.js?v=1.9','trade-offer-details.js?v=2.1','trade-checkout.js?v=2.2']){
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
