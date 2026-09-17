// Runtime UI regressions using hostile historical mixed responses. No network or user data.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const html=await read('trade.html'), gate=await read('trade-release-gate.js');
assert.doesNotMatch(html,/<option value="(?:trade|sale_or_trade)"/);
assert.doesNotMatch(await read('trade-sealed.js'),/<option value="(?:trade|sale_or_trade)"/);
assert.doesNotMatch(gate,/['"]trade-c2c-swap|['"]trade-listing-type-rules/);
assert.doesNotMatch(await read('trade.js'),/data-swap-propose|TAUSCH VORSCHLAGEN/);
assert.doesNotMatch(await read('trade-marketplace-ux.js'),/DV_C2C_SWAP|dvSwapsTab/);
assert.doesNotMatch(await read('trade-search-archive.js'),/db\.rpc\('get_my_market_swap|data-archive-filter="(?:swap|case)"/);

const {window,document}=parseHTML('<html><body><div class="tabs"></div><div id="grid"></div><div class="wrap"><div class="toolbar"></div><div id="mineStats"></div></div></body></html>');
window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','')};
window.HTMLElement.prototype.close=function(){this.removeAttribute('open')};
const calls=[];
const db={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='get_my_trade_actions')return {data:[{action_key:'order:1',title:'ORDER',order_id:'order-1'},{action_key:'swap:1',title:'SWAP',action_type:'swap_confirm'}]};
  if(name==='get_my_market_notifications')return {data:[{notification_id:'n1',title:'ORDER',context_type:'pickup_order',context_id:'order-1',is_unread:true},{notification_id:'n2',title:'SWAP',context_type:'pickup_swap',is_unread:true},{notification_id:'n3',title:'SWAP',kind:'swap_bound',is_unread:true}]};
  if(name==='list_my_market_pickup_conversations_v1')return {data:[{context_type:'order',context_id:'order-1',other_party:{display_name:'Order person'}},{context_type:'swap',context_id:'swap-1',other_party:{display_name:'Swap person'}}]};
  if(name==='get_market_pickup_conversation_v1')return {data:{context_type:'order',messages:[],can_send:true}};
  return {data:[]};
}};
const timers=[];
const context=vm.createContext({window,document,db,user:{id:'test'},tab:'market',console,Event:window.Event,MutationObserver:window.MutationObserver,setInterval:fn=>(timers.push(fn),timers.length),clearInterval(){},setTimeout,clearTimeout,Promise,Date});
vm.runInContext(await read('trade-automation.js'),context);timers.shift()();await new Promise(r=>setTimeout(r,20));
assert.equal(window.DV_TRADE_AUTOMATION.actions.length,1);
assert.equal(window.DV_TRADE_AUTOMATION.notifications.length,1);
assert.equal(document.getElementById('dvNotifyBadge').textContent,'1');
assert.equal(calls.some(c=>/get_my_market_swap/.test(c.name)),false);
const secondary=document.createElement('div');secondary.className='dvTradeSecondary';document.querySelector('.tabs').append(secondary);
window.DV_TRADE_MARKETPLACE_UX={};
vm.runInContext(await read('trade-pickup-messages.js'),context);
// Pickup initializes via timeout; wait for its normal installer.
await new Promise(r=>setTimeout(r,150));
context.tab='pickup_messages';await window.DV_PICKUP_MESSAGES.render();
assert.match(document.getElementById('grid').textContent,/Order person/);
assert.doesNotMatch(document.getElementById('grid').textContent,/Swap person|TAUSCH/);
const before=calls.length;await window.DV_PICKUP_MESSAGES.open('swap','swap-1');assert.equal(calls.length,before);
await window.DV_PICKUP_MESSAGES.open('order','order-1');
assert.equal(calls.at(-1).name,'get_market_pickup_conversation_v1');
console.log('PASS: sale-only forms/runtime; no swap actions, notifications, archives or pickup entry; order chat retained');
