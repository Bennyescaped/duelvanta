import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),M=require('../tcg-magic-on-demand.js');
const html=readFileSync(new URL('../collect.html',import.meta.url),'utf8'),source=html.match(/<script>\s*(const tcgConsumer=[\s\S]*?)<\/script>/)[1];
const fixture=JSON.parse(readFileSync(new URL('./fixtures/tcg-i3-magic/contract-v1.json',import.meta.url))),time='2026-10-07T12:00:00.000Z';
const candidate=M.translatePrinting(fixture.raw,{set_code:fixture.raw.set,collector_number:fixture.raw.collector_number,language:'EN'},time);
const I=require('../tcg-magic-images.js');
const uuid='10000000-0000-4000-8000-000000000001',cardId='20000000-0000-4000-8000-000000000002';
const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const imageURL=id=>`https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg?123`;
const response=()=>new Response(png,{headers:{'content-type':'image/png'}});
const json=x=>JSON.parse(JSON.stringify(x));
async function app({beta=true,initial=[],uploadError=false,fetch=async()=>({ok:true,status:200,json:async()=>candidate})}={}){
 const {window,document}=parseHTML(html),values=new WeakMap(),optionValue=o=>o?.hasAttribute('value')?o.getAttribute('value'):o?.textContent||'';
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return values.has(this)?values.get(this):optionValue(this.querySelector('option[selected]')||this.options[0]);},set(value){values.set(this,[...this.options].some(o=>optionValue(o)===value)?value:'');}});
 const $=id=>document.getElementById(id),user=uuid,rows=initial.map(x=>({...x})),calls=[];
 for(const dialog of document.querySelectorAll('dialog')){dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>dialog.removeAttribute('open');}
 $('cardForm').reset=()=>{for(const element of $('cardForm').querySelectorAll('input,textarea'))element.value=element.getAttribute('value')||'';for(const select of $('cardForm').querySelectorAll('select'))select.value=optionValue(select.querySelector('option[selected]')||select.options[0]);};
 const db={auth:{getSession:async()=>({data:{session:{access_token:'SYNTHETIC-R9-TOKEN',user:{id:user}}}}),onAuthStateChange(){},signOut:async()=>{}},storage:{from:()=>({createSignedUrl:async path=>{calls.push({signed:path});return {data:{signedUrl:'https://private.invalid/'+path}}},upload:async(path,blob,opts)=>{calls.push({upload:path,blob,opts});return {error:uploadError?{message:'bucket missing'}:null}}})},rpc:async(name,args)=>{
  calls.push({name,args:args?json(args):null});
  if(name==='get_magic_on_demand_collection_beta_v1')return {data:{contract:'magic-on-demand-collect-beta/1',user_id:user,magic_on_demand_collection_beta:beta,checked_at:new Date().toISOString()},error:null};
  if(name==='save_my_tcg_collection_item_v1'){if(!beta&&!args.p_item_id)return {error:{message:'magic_beta_unavailable'}};const id=args.p_item_id||cardId,item={...args.p_item,id,tcg:'magic',user_id:user};const at=rows.findIndex(x=>x.id===id);if(at<0)rows.push(item);else rows[at]={...rows[at],...item};return {data:id,error:null};}
  throw Error('Unexpected RPC '+name);
 },from(table){const filters={};let operation='select',payload;const q={select(){return q;},eq(k,v){filters[k]=v;return q;},is(k,v){filters[k]=v;return q;},order(){return q;},limit(){return q;},insert(p){operation='insert';payload=p;return q;},update(p){operation='update';payload=p;return q;},delete(){operation='delete';return q;},single(){return q;},then(resolve,reject){
   if(operation==='select')return Promise.resolve({data:table==='collection_items'?rows.slice():[],count:table==='collection_items'?rows.length:0,error:null}).then(resolve,reject);
   calls.push({table,operation,payload:payload?json(payload):null,filters});
   if(operation==='insert'){const item={id:'legacy-own-id',...payload};rows.push(item);return Promise.resolve({data:{id:item.id},error:null}).then(resolve,reject);}
   if(operation==='update')for(const item of rows.filter(x=>Object.entries(filters).every(([k,v])=>(x[k]??null)===v)))Object.assign(item,payload);
   if(operation==='delete')for(let i=rows.length-1;i>=0;i--)if(Object.entries(filters).every(([k,v])=>rows[i][k]===v))rows.splice(i,1);
   return Promise.resolve({data:rows.filter(x=>x.id===filters.id&&x.user_id===filters.user_id).map(x=>({id:x.id})),error:null}).then(resolve,reject);
  }};return q;}};
 const c=vm.createContext({window,document,console,requestAnimationFrame:fn=>fn(),URL,URLSearchParams,Intl,AbortSignal,setTimeout,clearTimeout,localStorage:{getItem:()=>null,setItem(){}},location:{search:'',replace(){}},confirm:()=>true,alert:message=>calls.push({alert:message}),navigator:{},fetch,Blob,crypto:globalThis.crypto,createImageBitmap:async()=>({width:488,height:680,close(){}})});
 for(const file of ['tcg-v1-contracts.js','tcg-v1-game-adapters.js','tcg-v1-catalog-providers.js','tcg-v1-registry.js','tcg-v1-consumers.js','collect-ux.js','tcg-magic-images.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);
 c.DV_COLLECT_UX=window.DV_COLLECT_UX;window.DV_TCG_V1_CONSUMERS=c.DV_TCG_V1_CONSUMERS;window.DV_SUPABASE={url:'https://example.invalid',key:'synthetic-only'};window.supabase={createClient:()=>db};
 vm.runInContext(source,c);await window.DV_COLLECT_READY;
 return {$,c,window,rows,calls,document,selectMagic(){ $('addCard').onclick();$('tcg').value='magic';$('tcg').onchange();},query(){ $('magicSetCode').value=fixture.raw.set;$('magicCollector').value=fixture.raw.collector_number;$('magicLanguage').value='EN';$('magicLanguage').onchange();},submit:()=>$('cardForm').onsubmit({preventDefault(){}})};
}

const cases=[{set:'dsk',number:'344',printed:'0344',id:'40000000-0000-4000-8000-000000000001',border_color:'borderless',frame_effects:[]},{set:'ecl',number:'373',printed:'0373',id:'50000000-0000-4000-8000-000000000002',border_color:'black',frame_effects:['extendedart']}];
function printing(c){return M.translatePrinting({...structuredClone(fixture.raw),id:c.id,set:c.set,collector_number:c.number,border_color:c.border_color,frame_effects:c.frame_effects,image_status:'highres_scan',image_uris:{normal:imageURL(c.id)}},{set_code:c.set,collector_number:c.printed,language:'EN'},time);}
for(const c of cases)test(`${c.set}/${c.printed} preserves exact full printing image and identity`,()=>{
 const out=printing(c);assert.equal(out.candidate.image_url,imageURL(c.id));assert.equal(out.candidate.number,c.number);assert.equal(out.candidate.provider_ref.external_id,c.id);
 assert.equal(I.reference(imageURL(cases.find(x=>x!==c).id),c.id),null);
});
test('untrusted, cropped, credentialed and other-printing image references fail closed',()=>{
 const id=cases[0].id,u=imageURL(id);
 for(const bad of [u.replace('https:','http:'),u.replace('cards.scryfall.io','evil.invalid'),u.replace('cards.scryfall.io','cards.scryfall.io.evil.invalid'),u.replace('https://','https://user:pass@'),u.replace('/normal/','/art_crop/'),u.replace('/front/','/back/'),u+'#x',u+'&redirect=evil',u.replace('.jpg','.svg'),u.replace('/4/0/','/0/4/')])assert.equal(I.reference(bad,id),null);
});
test('missing or disallowed image does not remove a valid card candidate',()=>{
 const c=cases[0],raw={...structuredClone(fixture.raw),id:c.id,set:c.set,collector_number:c.number,image_uris:{normal:'https://evil.invalid/x.jpg'}};
 for(const image_uris of [raw.image_uris,{}]){const out=M.translatePrinting({...raw,image_uris},{set_code:c.set,collector_number:c.printed,language:'EN'},time);assert.equal(out.status,'candidates');assert.equal(out.candidate.image_url,undefined);}
});
test('download has one CORS-only credential-free request, bounded bytes and real decoder gate',async()=>{
 let calls=0;const blob=await I.download(printing(cases[0]).candidate,{fetch:async(url,o)=>{calls++;assert.equal(o.mode,'cors');assert.equal(o.credentials,'omit');assert.equal(o.redirect,'error');assert.equal(o.referrerPolicy,'no-referrer');assert.equal(o.headers,undefined);return response();},decode:async()=>({width:488,height:680,close(){}})});assert.equal(calls,1);assert.equal(blob.size,png.length);
});
for(const [name,make] of [
 ['SVG',()=>new Response('<svg/>',{headers:{'content-type':'image/svg+xml'}})],
 ['HTML disguised as PNG',()=>new Response('<html/>',{headers:{'content-type':'image/png'}})],
 ['declared oversize',()=>new Response(png,{headers:{'content-type':'image/png','content-length':String(I.MAX_BYTES+1)}})],
 ['stream oversize',()=>new Response(new Uint8Array(I.MAX_BYTES+1),{headers:{'content-type':'image/png'}})],
 ['HTTP error',()=>new Response('',{status:500})],
 ['redirect',()=>({ok:true,redirected:true})]
])test(name+' rejected without fallback',async()=>{let calls=0;await assert.rejects(I.download(printing(cases[0]).candidate,{fetch:async()=>{calls++;return make();},decode:async()=>({width:488,height:680,close(){}})}));assert.equal(calls,1);});
test('CORS rejection and malformed decoder result fail without retry',async()=>{
 await assert.rejects(I.download(printing(cases[0]).candidate,{fetch:async()=>{throw Error('CORS');}}));
 await assert.rejects(I.download(printing(cases[0]).candidate,{fetch:async()=>response(),decode:async()=>{throw Error('invalid raster');}}));
 await assert.rejects(I.download(printing(cases[0]).candidate,{fetch:async()=>response(),decode:async()=>({width:99999,height:99999,close(){}})}));
});
async function lookedUp(options={}){
 const calls=[];const a=await app({...options,fetch:async(url,o)=>{calls.push({url,o});if(url.startsWith('/api/'))return {ok:true,json:async()=>printing(cases[0])};return response();}});
 if(options.initial?.length)vm.runInContext('openEdit(items[0])',a.c);else a.selectMagic();a.query();await a.$('magicSearch').onclick();return {...a,requests:calls};
}
test('explicit image choice persists private path; binder/list/cover/reload use same image',async()=>{
 const a=await lookedUp();assert.equal(a.requests.length,1);assert.equal(a.$('magicImagePreview').children.length,0);
 await a.$('magicImageLoad').onclick();assert.equal(a.requests.length,2);assert.match(a.$('magicImagePreview').innerHTML,/blob:/);await a.submit();
 assert.equal(a.rows.length,1);const p=a.rows[0].image_path;assert.ok(p.startsWith(uuid+'/'+cardId+'/'));assert.ok(!p.includes('https:'));
 assert.equal(a.calls.filter(x=>x.upload).length,1);const update=a.calls.find(x=>x.operation==='update');assert.equal(update.filters.user_id,uuid);assert.equal(update.filters.image_path,null);
 for(const id of ['slots','rows','binderShelf'])assert.ok(a.$(id).innerHTML.includes(p));
 const reloaded=await app({initial:a.rows});for(const id of ['slots','rows','binderShelf'])assert.ok(reloaded.$(id).innerHTML.includes(p));
});
test('existing card receives image via same item id, no duplicate',async()=>{
 const a=await lookedUp({initial:[{id:cardId,user_id:uuid,tcg:'magic',card_name:'Old',language:'EN',quantity:1,condition:'NM'}]});await a.$('magicImageLoad').onclick();await a.submit();assert.equal(a.rows.length,1);assert.equal(a.calls.find(x=>x.name==='save_my_tcg_collection_item_v1').args.p_item_id,cardId);assert.ok(a.rows[0].image_path);
});
test('existing own photograph remains unchanged and makes no image request',async()=>{
 const own=uuid+'/'+cardId+'/own.jpg',a=await lookedUp({initial:[{id:cardId,user_id:uuid,tcg:'magic',card_name:'Old',language:'EN',quantity:1,condition:'NM',image_path:own}]});assert.equal(a.$('magicImageLoad').disabled,true);await a.$('magicImageLoad').onclick();await a.submit();assert.equal(a.requests.length,1);assert.equal(a.rows[0].image_path,own);assert.equal(a.calls.filter(x=>x.upload).length,0);
});
test('storage failure reports saved card, closes create form and keeps one existing id',async()=>{
 const a=await lookedUp({uploadError:true});await a.$('magicImageLoad').onclick();await a.submit();assert.equal(a.rows.length,1);assert.equal(a.$('cardDialog').hasAttribute('open'),false);assert.match(a.calls.find(x=>x.alert).alert,/Karte gespeichert/);assert.equal(vm.runInContext('editingId',a.c),cardId);
});
test('identity edits discard downloaded image; image is optional',async()=>{
 const a=await lookedUp();await a.$('magicImageLoad').onclick();a.$('cardNumber').value='different';a.$('cardNumber').dispatchEvent(new a.window.Event('input'));await a.submit();assert.equal(a.rows.length,1);assert.equal(a.calls.filter(x=>x.upload).length,0);
});
test('concurrent existing photograph cannot be overwritten',async()=>{
 let constrained=false;const q={eq(){return q},is(k,v){assert.equal(k,'image_path');assert.equal(v,null);constrained=true;return q},select:async()=>({data:[],error:null})};
 const db={storage:{from:()=>({upload:async()=>({error:null})})},from:()=>({update:()=>q})};await assert.rejects(I.attach(db,uuid,cardId,new Blob([png],{type:'image/png'}),null,{card_name:'Synthetic',card_number:'344'}),/image_link_failed/);assert.equal(constrained,true);
});
test('installed legacy binder renderer retains move control outside full Magic image and cached rerender',async()=>{
 const a=await lookedUp();await a.$('magicImageLoad').onclick();await a.submit();
 a.c.setInterval=fn=>{a.c.installBinder=fn;return 1;};a.c.clearInterval=()=>{};
 vm.runInContext(readFileSync(new URL('../scanner-v16-binder.js',import.meta.url),'utf8'),a.c);a.c.installBinder();
 vm.runInContext("folders=[{id:'binder',name:'Magic',binder_pages:2}];activeFolder='binder';items[0].folder_id='binder';renderBinder()",a.c);
 for(let i=0;i<2;i++){assert.ok(a.$('slots').querySelector('.magicCard img.magicFullImage'));assert.ok(a.$('slots').querySelector('.magicCard .slotMove'));vm.runInContext('renderBinder()',a.c);}
 assert.match(html,/\.cardSlot\.magicCard:has\(img\) img\{height:calc\(100% - 42px\)\}/);
 assert.match(html,/\.cardSlot\.magicCard img\{object-fit:contain!important/);
});
