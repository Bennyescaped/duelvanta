// Regression for ARCHIV -> ORDER ÖFFNEN using the actual render/filter functions.
// Synthetic fixture only; no network, database mutation or live session.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const ordersSource=await readFile(new URL('../trade-orders.js',import.meta.url),'utf8');
const archiveSource=await readFile(new URL('../trade-search-archive.js',import.meta.url),'utf8');
const rStart=ordersSource.indexOf('async function renderOrders(target)');
const rEnd=ordersSource.indexOf('function show(',rStart);
const aStart=archiveSource.indexOf('function applyActiveFilters()');
const aEnd=archiveSource.indexOf('function queueActiveFilter()',aStart);
assert.ok(rStart>=0&&rEnd>rStart,'actual renderOrders function missing');
assert.ok(aStart>=0&&aEnd>aStart,'actual archive active-filter function missing');
const renderOrdersSource=ordersSource.slice(rStart,rEnd);
const applyActiveFiltersSource=archiveSource.slice(aStart,aEnd);

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const results=[];
try{
  for(const width of [390,1363]){
    const context=await browser.newContext({viewport:{width,height:844}});
    const page=await context.newPage();
    const errors=[],requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    await context.route('**/*',route=>{requests.push(route.request().url());return route.abort()});
    await page.setContent('<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="app" data-trade-view="orders"><div id="mineStats"></div><section id="grid"></section></main></body></html>');
    const harness=`
      let tab='orders',renderRequest=0,orders=[],items=new Map(),withdrawals=new Map(),filterQueued=false;
      const text=value=>String(value??'').trim().toLowerCase();
      function ensureActiveEmpty(){}
      async function load(){return {
        orders:[
          {order_id:'archived-order',order_number:'DV-ARCHIVED',status:'completed'},
          {order_id:'active-order',order_number:'DV-ACTIVE',status:'open'}
        ],
        items:new Map([['archived-order',[]],['active-order',[]]]),
        withdrawals:new Map()
      }}
      function card(o){return '<article id="order-'+o.order_id+'" class="dvOrderCard"><span class="dvOrderNumber">'+o.order_number+'</span><span class="dvOrderStatus '+o.status+'">'+o.status+'</span></article>'}
      ${renderOrdersSource}
      ${applyActiveFiltersSource}
      window.runArchived=async()=>{await renderOrders('archived-order');applyActiveFilters();const target=document.getElementById('order-archived-order'),active=document.getElementById('order-active-order');return {targetHidden:target.hidden,targetMarker:target.dataset.archiveOpenTarget,targetClass:target.classList.contains('target'),activeHidden:active.hidden}};
      window.rerunFilter=()=>{applyActiveFilters();const target=document.getElementById('order-archived-order');return {targetHidden:target.hidden,targetMarker:target.dataset.archiveOpenTarget,targetClass:target.classList.contains('target')}};
      window.runNormal=async()=>{await renderOrders();applyActiveFilters();const target=document.getElementById('order-archived-order'),active=document.getElementById('order-active-order');return {targetHidden:target.hidden,targetMarker:target.dataset.archiveOpenTarget||null,activeHidden:active.hidden}};
    `;
    await page.addScriptTag({content:harness});
    const opened=await page.evaluate(()=>runArchived());
    assert.equal(opened.targetHidden,false,'explicitly opened archived order must stay visible');
    assert.equal(opened.targetMarker,'1','archived target marker must exist before filtering');
    assert.equal(opened.targetClass,true,'opened archived order should receive target highlight');
    assert.equal(opened.activeHidden,false,'active order must stay visible');
    await page.waitForTimeout(1700);
    const filteredAgain=await page.evaluate(()=>rerunFilter());
    assert.equal(filteredAgain.targetClass,false,'temporary highlight should be removed');
    assert.equal(filteredAgain.targetMarker,'1','visibility marker must survive highlight removal');
    assert.equal(filteredAgain.targetHidden,false,'later active filtering must not hide the opened archived order');
    const normal=await page.evaluate(()=>runNormal());
    assert.equal(normal.targetMarker,null,'normal order render must not mark archived rows');
    assert.equal(normal.targetHidden,true,'completed order must remain hidden in normal active-order view');
    assert.equal(normal.activeHidden,false,'active order remains visible in normal view');
    assert.deepEqual(errors,[]);
    assert.deepEqual(requests,[]);
    results.push({width,status:'PASS'});
    await context.close();
  }
  await mkdir(new URL('../test-results/trade-archive-order/',import.meta.url),{recursive:true});
  await writeFile(new URL('../test-results/trade-archive-order/browser-results.json',import.meta.url),JSON.stringify({scope:'actual renderOrders and archive active-filter functions; synthetic data only',results},null,2)+'\n');
  console.log('PASS: archived ORDER ÖFFNEN stays visible on mobile and desktop while normal completed-order filtering remains intact');
}finally{await browser.close()}
