// Real Chromium UI proof for Legal Step 5; fixtures only, no live transaction or provider call.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const source=await readFile(new URL('../trade-orders.js',import.meta.url),'utf8');
const start=source.indexOf('function withdrawal(id){');
const end=source.indexOf('function quote(',start);
assert.ok(start>=0&&end>start,'actual withdrawal UI function missing');
const withdrawalSource=source.slice(start,end);
const runtimeIndex=process.argv.indexOf('--playwright');
const {chromium}=await import(runtimeIndex>=0?pathToFileURL(process.argv[runtimeIndex+1]).href:'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox']});
const results=[];

async function scenario(width){
  const context=await browser.newContext({viewport:{width,height:844}});
  const page=await context.newPage();
  const requests=[],errors=[];
  page.on('request',req=>requests.push(req.url()));
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>');
  const harness=[
    "window.calls=[];window.rendered=null;",
    "let withdrawals=new Map([['order-1',[{contract_snapshot_id:'contract-1',product_title:'Frozen Testkarte',total_price:123.45,already_submitted:false}]]]);",
    "let orders=[{order_id:'order-1',buyer_name:'Buyer Test'}];",
    "let user={id:'buyer-1',email:'buyer@example.test'};",
    "const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));",
    "const cash=v=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(v||0));",
    "function show(title,html){document.body.innerHTML='<main><h1>'+title+'</h1><div id=\"dvODBody\">'+html+'</div><div id=\"dvODMsg\"></div></main>';}",
    "const db={rpc:async(name,args)=>{window.calls.push({name,args});if(name==='prepare_market_withdrawal_v1')return {data:{draft_id:'draft-1',contract_snapshot_id:'contract-1',order_id:'order-1',deal_id:'deal-1',consumer_name:'Buyer Test',confirmation_email:'buyer@example.test',seller_name:'Frozen Händler GmbH',product_title:'Frozen Testkarte',contract_formed_at:'2026-09-22T17:00:00Z',total_price:123.45,currency:'EUR'},error:null};if(name==='confirm_market_withdrawal_v1')return {data:{replayed:false,withdrawal_id:'withdrawal-1',submitted_at:'2026-09-22T18:00:00Z',contract_snapshot_id:'contract-1',confirmation_email:'buyer@example.test',receipt_sha256:'abc123hash'},error:null};throw Error('unexpected rpc '+name);}};",
    "async function renderOrders(id){window.rendered=id;}"
  ].join('\n');
  await page.addScriptTag({content:harness+'\n'+withdrawalSource+'\nwindow.runWithdrawal=withdrawal;'});
  await page.evaluate(()=>window.runWithdrawal('order-1'));
  await page.locator('#oWithdrawalPrepare').click();
  await page.waitForSelector('#oWithdrawalConfirm');
  let text=await page.locator('body').innerText();
  for(const value of ['contract-1','order-1','Frozen Testkarte','Frozen Händler GmbH','Buyer Test','buyer@example.test'])assert.ok(text.includes(value),'confirmation misses '+value);
  assert.match(text,/Gesamtpreis:/);
  await page.locator('#oWithdrawalConfirm').click();
  await page.waitForFunction(()=>document.body.innerText.includes('WIDERRUF EINGEGANGEN'));
  text=await page.locator('body').innerText();
  assert.ok(text.includes('withdrawal-1'));
  assert.ok(text.includes('abc123hash'));
  assert.match(text,/Storno, Rücksendung und Erstattung erfolgen nicht automatisch/);
  const observed=await page.evaluate(()=>({calls:window.calls,rendered:window.rendered}));
  assert.deepEqual(observed.calls.map(call=>call.name),['prepare_market_withdrawal_v1','confirm_market_withdrawal_v1']);
  assert.equal(observed.rendered,'order-1');
  assert.equal(requests.length,0);
  assert.deepEqual(errors,[]);
  results.push({width,status:'PASS',rpcs:observed.calls.map(call=>call.name)});
  await context.close();
}

try{
  await scenario(390);
  await scenario(1280);
  const out=new URL('../test-results/trade-legal-withdrawal-browser/',import.meta.url);
  await mkdir(out,{recursive:true});
  await writeFile(new URL('browser-results.json',out),JSON.stringify({scope:'actual withdrawal UI function with synthetic RPC data; no live transaction',results},null,2)+'\n');
  console.log('PASS: withdrawal UI shows the exact frozen contract before confirmation and renders immutable receipt hash without refund/cancel action');
}finally{
  await browser.close();
}
