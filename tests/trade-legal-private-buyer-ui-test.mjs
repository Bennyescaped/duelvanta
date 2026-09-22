// Execute the exact changed checkout predicates/review handler with local fixtures.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../trade-checkout.js',import.meta.url),'utf8');
const part=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b)};
const functions=part('  function reviewError(', '  function renderServerReview(')+part('  function scheduleReview(', '  function refresh(');
let checks=0;
for(const data of [null,{}, {buyer_type:'business',contract_classification:'b2b'},{buyer_type:'business',contract_classification:'c2b'},{buyer_type:'consumer',contract_classification:'b2b'},{buyer_type:'consumer',contract_classification:'c2c'},{buyer_type:'consumer',contract_classification:'b2c'}]){
 const allowed=data?.buyer_type==='consumer'&&['b2c','c2c'].includes(data.contract_classification);
 const nodes={dvBuyNow:{disabled:false},dvCheckoutParty:{innerHTML:''},dvBuyMsg:{textContent:''}},calls=[],rendered=[];
 let timer;
 const context=vm.createContext({current:{id:'fixture-listing'},review:{stale:true},reviewRequest:0,reviewTimer:null,busy:false,byId:id=>nodes[id],selectedQuantity:()=>1,clearTimeout(){},setTimeout:fn=>{timer=fn;return 1},renderServerReview:r=>rendered.push(r),db:{rpc:async(name,args)=>{calls.push({name,args});return {data,error:null}}}});
 vm.runInContext(functions,context);vm.runInContext('scheduleReview(1)',context);
 assert.equal(nodes.dvBuyNow.disabled,true);assert.equal(vm.runInContext('review',context),null);checks+=2;
 await timer();assert.equal(nodes.dvBuyNow.disabled,!allowed);assert.equal(rendered.length,allowed?1:0);assert.equal(calls.length,1);checks+=3;
 if(!allowed){assert.equal(vm.runInContext('review',context),null);assert.match(nodes.dvBuyMsg.textContent,/gesperrt/);checks+=2}
}
const context=vm.createContext({});vm.runInContext(part('  function reviewError(','  function renderServerReview('),context);
for(const message of ['buyer_private_consumer_required','trade_eligibility_required']){assert.match(vm.runInContext(`reviewError({message:${JSON.stringify(message)}})`,context),/bestehenden TRADE-Zugang/);checks++}
assert.match(vm.runInContext("reviewError({message:'trade_account_restricted'})",context),/gesperrt/);checks++;
assert.match(source,/if\(busy\|\|!current\|\|!privateBuyerReview\(review\)\|\|byId\('dvBuyNow'\)\.disabled\)return/);checks++;
assert.doesNotMatch(source,/b2b:|c2b:|Geschäftlich kaufen|privat als Verbraucher oder geschäftlich/);checks++;
console.log(`PASS: ${checks} private-buyer checkout fixture checks; incompatible review stays blocked; no provider requests`);
