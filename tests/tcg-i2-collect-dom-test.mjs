// Real COLLECT manual handler, fixture-only DOM. No browser/network dependency.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const require=createRequire(import.meta.url),tcgConsumer=require('../tcg-v1-consumers.js');
const base='c597cc1c324fe0f018a17a822ed10e8160922514',current=readFileSync(new URL('../collect.html',import.meta.url),'utf8'),old=execFileSync('git',['show',base+':collect.html'],{encoding:'utf8'});
async function run(source,tcg,editing=false){const {window,document}=parseHTML(source),values=new WeakMap(),optionValue=o=>o?.hasAttribute('value')?o.getAttribute('value'):o?.textContent||'';Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return values.has(this)?values.get(this):optionValue(this.querySelector('option[selected]')||this.options[0])},set(v){const found=[...this.options].find(o=>optionValue(o)===v);values.set(this,found?v:'');for(const option of this.options)option.toggleAttribute('selected',option===found)}});
 const $=id=>document.getElementById(id);$('tcg').innerHTML=tcgConsumer.options('collection')+'<option value="other">Andere</option>';const fields={tcg,cardName:' Old name ',setName:' Old set ',cardNumber:'007A',language:'OTHER',variant:'Old Variant Text',condition:'NM',quantity:'2',purchaseDate:'2020-01-02',purchasePrice:'3.40',gradingCompany:'',grade:'',certNumber:'',marketPrice:'',folderId:'',notes:'old notes'};for(const [key,v] of Object.entries(fields))$(key).value=v;let written,loads=0;
 $('cardDialog').close=()=>{};const q={eq(){return q},select(){return q},single:async()=>({data:{id:'stable-item-id'},error:null}),then(fn){return Promise.resolve({error:null}).then(fn)}};
 const c=vm.createContext({document,$,tcgConsumer,currentUser:{id:'own-user'},items:editing?[{id:'stable-item-id',tcg}]:[],editingId:editing?'stable-item-id':null,pendingScanBlob:null,pendingScanFolder:null,db:{from:()=>({insert(payload){written=payload;return q},update(payload){written=payload;return q}})},loadItems:async()=>{loads++}});
 vm.runInContext(source.match(/function val\(id\)[\s\S]*?(?=function openNew|function openEdit)/)?.[0]||"function val(id){return $(id).value.trim()||null}function numOrNull(id){return $(id).value===''?null:Number($(id).value)}",c);
 vm.runInContext(source.match(/\$\('cardForm'\)\.onsubmit=[\s\S]*?(?=;\$\('logout'\))/)[0],c);await $('cardForm').onsubmit({preventDefault(){}});return{written:written?JSON.parse(JSON.stringify(written)):null,loads,message:$('formMsg').textContent};}
for(const game of tcgConsumer.games('collection')){assert.deepEqual(await run(current,game.game_key),await run(old,game.game_key));assert.deepEqual(await run(current,game.game_key,true),await run(old,game.game_key,true));}
assert.deepEqual(await run(current,'other',true),await run(old,'other',true));assert.equal((await run(current,'other')).written,null);
for(const game of ['magic','yugioh','naruto','unknown'])assert.equal((await run(current,game)).written,null);
console.log('PASS 10 COLLECT DOM writer fixtures: P/OP insert/edit, legacy other edit, planned/unknown fail-closed; identical payloads and IDs');
