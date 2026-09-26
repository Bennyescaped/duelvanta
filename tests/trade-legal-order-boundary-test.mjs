// Execute the exact order-reader replacement, not an imitation of its behaviour.
// --manifest permits offline verification without pretending to have a full checkout.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
let source;
if(process.argv[2]==='--manifest'){
 const patch=JSON.parse(await readFile(process.argv[3],'utf8'));
 source=patch.changes.find(c=>c.path==='trade-orders.js').replacements.find(r=>r.find.startsWith('async function load()')).replace;
}else{
 const orders=await readFile(new URL('../trade-orders.js',import.meta.url),'utf8');
 const start=orders.indexOf('async function loadWithdrawalContracts(){'),end=orders.indexOf('function progress(',start);
 assert(start>=0&&end>start,'real order-reader boundary must exist');source=orders.slice(start,end);
}
let checks=0;
const equal=(actual,expected,label)=>{assert.equal(actual,expected,label);checks++};
function setup({guard,mode='ok',orderError=false}={}){
 const calls=[],scheduled=[],cleared=[];
 const context=vm.createContext({window:guard===undefined?{}:{DV_TRADE_LEGAL_SCHEMA:guard},Map,Promise,
  setTimeout(fn,ms){scheduled.push({fn,ms});return scheduled.length},clearTimeout(id){cleared.push(id)},
  db:{rpc(name,args,options){
   calls.push({name,args,options});
   if(name==='get_my_market_orders')return Promise.resolve({data:orderError?null:[{order_id:'existing-order'}],error:orderError?Error('order access denied'):null});
   if(name==='get_market_payment_sandbox_status')return Promise.resolve({data:{sandbox_enabled:false,live_mode:false},error:null});
   if(name==='get_market_order_items')return Promise.resolve({data:[{item_title:'Existing card'}],error:null});
   assert.equal(name,'get_my_market_withdrawable_contracts');
   if(mode==='throw')throw Error('network unavailable');
   if(mode==='reject')return Promise.reject(Error('request rejected'));
   if(mode==='never')return new Promise(()=>{});
   if(mode==='late')return new Promise(resolve=>context.resolveRead=resolve);
   if(mode==='null')return Promise.resolve(null);
   if(mode==='error')return Promise.resolve({data:null,error:{code:'PGRST202'}});
   if(mode==='malformed')return Promise.resolve({data:{},error:null});
   if(mode==='bad-row')return Promise.resolve({data:[null],error:null});
   return Promise.resolve({data:[{order_id:'existing-order',contract_snapshot_id:'existing-contract',already_submitted:false}],error:null});
  }}
 });
 vm.runInContext('let stripeSandbox;\n'+source,context);
 return{context,calls,scheduled,cleared,run:()=>vm.runInContext('load()',context)};
}
for(const guard of [undefined,{}, {available:false,guard_version:'1.2'}, {available:true,guard_version:'wrong'}, {available:true}]){
 const t=setup({guard,mode:'never'}),result=await t.run();
 equal(result.orders.length,1,'old order is readable without compatibility');
 equal(result.items.get('existing-order')[0].item_title,'Existing card','items are retained');
 equal(result.withdrawals.size,0,'no speculative withdrawal affordance');
 equal(t.calls.filter(c=>c.name==='get_my_market_withdrawable_contracts').length,0,'new RPC is not called');
 equal(t.scheduled.length,0,'no deadline needed for skipped RPC');
}
for(const mode of ['ok','throw','reject','never','late','null','error','malformed','bad-row']){
 const t=setup({guard:{available:true,guard_version:'1.2'},mode});
 const pending=t.run();await Promise.resolve();
 if(mode==='never'||mode==='late')t.scheduled[0].fn();
 const result=await pending;
 equal(result.orders.length,1,'existing order survives '+mode);
 equal(result.items.get('existing-order').length,1,'items survive '+mode);
 equal(result.withdrawals.size,mode==='ok'?1:0,'withdrawal evidence is not invented for '+mode);
 equal(t.scheduled[0].ms,5000,'bounded optional read');
 equal(t.cleared.length,1,'deadline is cleared');
 const options=t.calls.find(c=>c.name==='get_my_market_withdrawable_contracts').options;equal(options.get,true,'GET-only optional read');equal(Object.keys(options).length,1,'no additional RPC options');
 if(mode==='late'){
  t.context.resolveRead({data:[{order_id:'existing-order'}],error:null});await Promise.resolve();
  equal(result.withdrawals.size,0,'late response does not change a completed result');
 }
}
const denied=setup({guard:{available:false,guard_version:'1.2'},orderError:true});
await assert.rejects(denied.run(),/order access denied/);checks++;
equal(denied.calls.filter(c=>c.name==='get_market_order_items').length,0,'real order errors stay visible, not fake empty data');
assert.doesNotMatch(source,/\.from\(|createClient\(|\.supabase\.co|\/api\/market-stripe-checkout|set_my_|confirm_market|prepare_market/);checks++;
console.log(`PASS: ${checks} order-read boundary checks; missing schema is skipped, optional errors bounded, existing order errors preserved`);
