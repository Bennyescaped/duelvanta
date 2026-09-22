// Full, actual profile script against strict DOM/database fixtures. No network or writes.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../profile.html',import.meta.url),'utf8');
const source=await readFile(new URL('../profile.js',import.meta.url),'utf8');
assert.doesNotMatch(html,/buyerPurchaseType|saveBuyerPurchaseType|Geschäftlich kaufen/);
assert.doesNotMatch(source,/loadBuyerProfile|saveBuyerProfile|market_buyer_profile|confirm_my_market/);
assert.match(html,/trade-legal-readiness\.js\?v=1\.1/);
let checks=3;
function element(id=''){
 const classes=new Set(id==='profileApp'?['hidden']:[]);
 return {id,value:'',textContent:'',innerHTML:'',dataset:{},children:[],disabled:false,
  classList:{add:(v)=>classes.add(v),remove:(v)=>classes.delete(v),contains:(v)=>classes.has(v),toggle(v,on){const enabled=on===undefined?!classes.has(v):on;enabled?classes.add(v):classes.delete(v);return enabled}},
  addEventListener(){},append(...nodes){this.children.push(...nodes)},appendChild(node){this.children.push(node);return node}};
}
async function boot({available,session=true,profileError=false,folderError=false,addressError=false,invalidConfig=false}={}){
 const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],element(m[1])]));
 const privacy=['private','public','custom'].map(value=>Object.assign(element(),{dataset:{value}}));
 const calls=[],redirects=[],events=new Map();
 const profile={display_name:'Fixture seller',username:'fixture',email:'fixture@example.test',collection_visibility:'private'};
 const db={auth:{getSession:async()=>({data:{session:session?{user:{id:'fixture-user'}}:null}})},
  from(table){calls.push(['read',table]);
   if(table==='profiles')return {select:()=>({eq:()=>({single:async()=>({data:profileError?null:profile,error:profileError?{message:'fixture profile read failure'}:null})})})};
   if(table==='collection_folders')return {select:()=>({order:async()=>({data:[{id:'fixture-folder',name:'Fixture binder',is_public:false}],error:folderError?{message:'fixture folder read failure'}:null})})};
   throw Error('unexpected table '+table);
  },
  rpc:async name=>{calls.push(['rpc',name]);assert.equal(name,'get_my_default_shipping_address','boot must not write or request buyer profile');return {data:addressError?null:{recipient_name:'Fixture recipient',street_line1:'Fixture road',postal_code:'10115',city:'Fixture city',country_code:'DE'},error:addressError?{message:'fixture address read failure'}:null}}
 };
 const window={__dvAppDb:{stale:true},DV_SUPABASE:{environment:'preview',url:'https://fixture.supabase.co',key:invalidConfig?'invalid':'sb_publishable_fixture_key'},supabase:{createClient:()=>db},addEventListener:(name,fn)=>events.set(name,fn)};
 if(available!==undefined)window.DV_TRADE_LEGAL_SCHEMA={available};
 const document={getElementById:id=>nodes.get(id)||null,querySelectorAll:selector=>selector==='.privacyOption'?privacy:[],createElement:()=>element()};
 const context=vm.createContext({window,document,location:{replace:url=>redirects.push(url)},console,setTimeout,clearTimeout,Date,Intl,Promise,confirm:()=>{throw Error('unexpected confirmation')},fetch:()=>{throw Error('unexpected external request')}});
 if(invalidConfig){assert.throws(()=>vm.runInContext(source,context),/not safely configured/);assert.equal(window.__dvAppDb,null);checks+=2;return}
 vm.runInContext(source,context,{filename:'profile.js'});
 for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
 if(!session){assert.deepEqual(redirects,['login.html?next=profile.html']);assert.deepEqual(calls,[]);checks+=2;return}
 if(profileError){assert.deepEqual(redirects,['app.html']);checks++;return}
 assert.deepEqual(redirects,[]);assert.equal(nodes.get('profileApp').classList.contains('hidden'),false);checks+=2;
 assert.equal(nodes.get('displayName').value,profile.display_name);assert.equal(nodes.get('accountEmail').textContent,profile.email);checks+=2;
 assert.equal(nodes.has('saveBuyerPurchaseType'),false);assert.equal(events.has('dv:trade-legal-schema'),false);checks+=2;
 assert.equal(calls.filter(x=>x[0]==='rpc').length,1);assert.equal(window.__dvAppDb,db);checks+=2;
 if(addressError)assert.match(nodes.get('defaultAddressMsg').textContent,/konnte nicht geladen/);
 else assert.equal(nodes.get('defaultRecipient').value,'Fixture recipient');
 if(folderError)assert.match(nodes.get('folders').textContent,/konnten nicht geladen/);
 else assert.equal(nodes.get('folders').children.length,1);
 checks+=2;
 const before=JSON.stringify(calls);window.DV_TRADE_LEGAL_SCHEMA={available:true};events.get('dv:trade-legal-schema')?.();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(JSON.stringify(calls),before);checks++;
}
for(const available of [false,true])await boot({available});
await boot({available:undefined});await boot({folderError:true,addressError:true});
await boot({session:false});await boot({profileError:true});await boot({invalidConfig:true});
console.log(`PASS: ${checks} actual-profile fixture checks; ordinary reads retained, no second buyer profile or automatic confirmation`);
