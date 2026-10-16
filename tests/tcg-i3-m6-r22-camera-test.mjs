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
 for(const file of ['tcg-v1-contracts.js','tcg-v1-game-adapters.js','tcg-v1-catalog-providers.js','tcg-v1-registry.js','tcg-v1-consumers.js','collect-ux.js','tcg-magic-images.js','tcg-magic-camera.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),c);
 c.DV_COLLECT_UX=window.DV_COLLECT_UX;window.DV_TCG_V1_CONSUMERS=c.DV_TCG_V1_CONSUMERS;window.DV_SUPABASE={url:'https://example.invalid',key:'synthetic-only'};window.supabase={createClient:()=>db};
 vm.runInContext(source,c);await window.DV_COLLECT_READY;for(const d of document.querySelectorAll('dialog')){Object.defineProperty(d,'open',{get(){return d.hasAttribute('open')}});d.showModal=()=>d.setAttribute('open','');d.close=()=>d.removeAttribute('open');}
 return {$,c,window,rows,calls,document,selectMagic(){ $('addCard').onclick();$('tcg').value='magic';$('tcg').onchange();},query(){ $('magicSetCode').value=fixture.raw.set;$('magicCollector').value=fixture.raw.collector_number;$('magicLanguage').value='EN';$('magicLanguage').onchange();},submit:()=>$('cardForm').onsubmit({preventDefault(){}})};
}

const C=require('../tcg-magic-camera.js');
function modules(a,text='0344 R\nDSK • EN'){
 a.c.DV_SCAN_V16_NATIVE_CAMERA={open:(input,kind)=>a.calls.push({picker:kind,id:input.id})};
 a.c.DV_SCAN_V16_RUNTIME={decodeFile:async()=>({width:1400,height:1955,close(){}})};
 a.c.DV_SCAN_V16_CORE={fitCenteredRect:()=>({}),canvasFrom:()=>{const c=a.document.createElement('canvas');c.width=1400;c.height=1955;return c;}};
 a.c.DV_SCAN_V16_OCR={create:()=>({read:async()=>text,reset(){}})};
}
async function scan(a,text){modules(a,text);await a.$('magicCameraLaunch').onclick();await a.$('magicCameraFile').onchange();}
for(const [raw,set,num] of [['0344 R\nDSK • EN','DSK','0344'],['0373 R\nECL • EN','ECL','0373']])test('local footer '+set+' preserves printed number and raw observation',()=>{
 const x=C.parse(raw);assert.equal(x.raw,raw);assert.equal(x.collector_number,num);assert.equal(x.set_code,set);assert.equal(x.language,'EN');assert.equal(C.validate(x).collector_number,num);
});
test('ambiguity, invalid text and alphanumeric values do not silently normalize',()=>{
 assert.equal(C.parse('0344\n0373\nDSK • EN\nECL • DE').ambiguous,true);
 assert.equal(C.parse('copyright 2026 Wizards').collector_number,'');
 assert.equal(C.validate({set_code:'DSK',collector_number:'0344a',language:'EN'}).collector_number,'0344a');
 for(const v of [{set_code:'',collector_number:'0344',language:'EN'},{set_code:'DSK',collector_number:'../',language:'EN'},{set_code:'DSK',collector_number:'0344',language:''}])assert.throws(()=>C.validate(v));
});
test('camera and gallery use V16 native selectors and never fetch or upload',async()=>{
 let external=0;const a=await app({fetch:async()=>{external++;throw Error('forbidden')}});modules(a);
 await a.$('magicCameraLaunch').onclick();a.$('magicCameraPhoto').onclick();a.$('magicCameraGallery').onclick();
 assert.deepEqual(a.calls.filter(x=>x.picker).map(x=>x.picker),['camera','gallery']);assert.equal(external,0);assert.equal(a.calls.filter(x=>x.upload).length,0);
 a.$('magicCameraCancel').onclick();await a.$('magicCameraLaunch').onclick();assert(a.$('magicCameraDialog').hasAttribute('open'));
});
test('account/admission/hold denied readiness cannot open the pilot',async()=>{
 const a=await app({beta:false});modules(a);await a.$('magicCameraLaunch').onclick();assert(!a.$('magicCameraDialog').hasAttribute('open'));assert.equal(a.calls.filter(x=>x.picker).length,0);
});
test('explicit confirmation transfers only fields; a separate search makes one request; no retry',async()=>{
 let external=0,release;const a=await app({fetch:async()=>{external++;await new Promise(r=>release=r);return {ok:false,status:503,json:async()=>({status:'error'})};}});modules(a);
 await a.$('magicCameraLaunch').onclick();a.$('magicCameraSet').value='DSK';a.$('magicCameraNumber').value='0344';a.$('magicCameraLanguage').value='EN';
 assert.equal(external,0);await a.$('magicCameraConfirm').onclick();assert.equal(external,0);assert.equal(a.$('magicCollector').value,'0344');assert.equal(a.$('magicSetCode').value,'DSK');
 const first=a.$('magicSearch').onclick();await new Promise(r=>setTimeout(r,0));await a.$('magicSearch').onclick();assert.equal(external,1);release();await first;assert.equal(external,1);assert.equal(a.rows.length,0);
});
test('invalid confirmation leaves provider and form untouched; correction is explicit',async()=>{
 const a=await app({fetch:async()=>{throw Error('forbidden')}});modules(a);await a.$('magicCameraLaunch').onclick();a.$('magicCameraSet').value='ECL';a.$('magicCameraNumber').value='?';a.$('magicCameraLanguage').value='EN';
 await a.$('magicCameraConfirm').onclick();assert(a.$('magicCameraDialog').hasAttribute('open'));a.$('magicCameraNumber').value='0373';await a.$('magicCameraConfirm').onclick();assert.equal(a.$('magicCollector').value,'0373');
});
test('double submission saves one new Magic item through gated RPC; no raw photo upload',async()=>{
 const a=await app();a.selectMagic();a.$('cardName').value='Synthetic';a.$('language').value='EN';
 await Promise.all([a.submit(),a.submit()]);assert.equal(a.calls.filter(x=>x.name==='save_my_tcg_collection_item_v1').length,1);assert.equal(a.rows.length,1);assert.equal(a.calls.filter(x=>x.upload||x.operation==='insert').length,0);
});
test('edit camera preserves consciously selected existing id, no duplicate',async()=>{
 const a=await app({initial:[{id:cardId,user_id:uuid,tcg:'magic',card_name:'Existing',quantity:1,language:'EN',image_path:'own/photo.jpg'}]});modules(a);
 a.$('rows').onclick({target:{dataset:{edit:cardId}}});await a.$('magicCameraEdit').onclick();a.$('magicCameraSet').value='ECL';a.$('magicCameraNumber').value='0373';a.$('magicCameraLanguage').value='EN';await a.$('magicCameraConfirm').onclick();await a.submit();
 assert.equal(a.rows.length,1);assert.equal(a.calls.find(x=>x.name==='save_my_tcg_collection_item_v1').args.p_item_id,cardId);assert.equal(a.rows[0].image_path,'own/photo.jpg');
});

// R22-R1: real operator excerpt plus explicitly labelled full screenshot transcription.
const ocrFixture=name=>readFileSync(new URL('./fixtures/tcg-i3-magic/r22-r1/'+name,import.meta.url),'utf8');
test('R22-R1 operator OCR excerpt preserves raw text and resolves ECL 0373 EN',()=>{
 const raw=ocrFixture('operator-excerpt.txt');
 assert.deepEqual(C.parse(raw),{raw,set_code:'ECL',collector_number:'0373',language:'EN',ambiguous:false});
});
for(const [footer,set,num,rarity] of [
 ['ECL *EN','ECL','0373','R'],['ECL * EN','ECL','0373','R'],['ECL*EN','ECL','0373','R'],['ECL EN','ECL','0373','R'],
 ['DSK •EN','DSK','0344','M'],['DSK • EN','DSK','0344','M'],['DSK·EN','DSK','0344','M'],['DSK .EN','DSK','0344','M']
])test('R22-R1 noisy multiline footer '+footer,()=>{
 const raw=`» A – y Li\nZz 1/4 ¢\n${rarity} ${num}\n${footer} » Victor ADAME MINGULZ MEE\n© 2026 Wizards of the Coast\n`;
 assert.deepEqual(C.parse(raw),{raw,set_code:set,collector_number:num,language:'EN',ambiguous:false});
});
test('R22-R1 complete screenshot transcription retains conflicting standalone number',()=>{
 const raw=ocrFixture('screenshot-transcription.txt'),x=C.parse(raw);
 assert.equal(x.raw,raw);assert.equal(x.set_code,'ECL');assert.equal(x.language,'EN');
 assert.equal(x.collector_number,'');assert.equal(x.ambiguous,true);
});
for(const footer of ['ECLEN','DSKEN','ECL*ENGLISH','ECL_EN','ECL/EN'])test('R22-R1 rejects glued or invalid footer '+footer,()=>{
 const x=C.parse('R 0373\n'+footer);assert.equal(x.set_code,'');assert.equal(x.language,'');assert.equal(x.ambiguous,true);
});
for(const [raw,key] of [
 ['R 0373\nECL*EN\nDSK •EN','set_code'],
 ['R 0373\nECL*EN\nECL *DE','language'],
 ['R 0373\nM 0344\nECL*EN','collector_number']
])test('R22-R1 conflicting '+key+' stays ambiguous',()=>{
 const x=C.parse(raw);assert.equal(x[key],'');assert.equal(x.ambiguous,true);assert.equal(x.raw,raw);
});
test('R22-R1 repeated same footer is not a conflict and alphanumeric zeroes survive',()=>{
 const x=C.parse('M 0344A\nDSK•EN\nDSK • EN');assert.equal(x.collector_number,'0344A');assert.equal(x.ambiguous,false);
});
