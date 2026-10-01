// Executes the actual branch Edge handler; all database/signing operations are synthetic.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const source=readFileSync('supabase/functions/public-card-image/index.ts','utf8');
let handler,current,reads,signs;
const context={Request,Response,console,Deno:{serve:f=>handler=f,env:{get:()=> 'synthetic'}},createClient:()=>({
 from(table){return {select(){return this},eq(){return this},async single(){
  if(table==='collection_items')return {data:{id:'card',user_id:'target',folder_id:'binder',image_path:'target/card.webp'}};
  if(table==='collection_folders')return {data:{is_public:current.folderPublic!==false}};
  reads++;return {data:current.missing?null:{collection_visibility:current.visibility||'public',account_status:current.closed?'deleted':'active',data_processing_restricted_at:current.holdAt&&reads>=current.holdAt?'hold':null},error:current.error?'synthetic error':null};
 }}},storage:{from(){return {async createSignedUrl(path,ttl){signs++;assert.equal(path,'target/card.webp');assert.equal(ttl,900);return {data:{signedUrl:'https://synthetic.invalid/signed'}}}}}}
})};
vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*\n/gm,'')),context);
const cases=[{name:'normal anon',ok:true},{name:'reader Hold only',readerHold:true,ok:true},{name:'custom public',visibility:'custom',ok:true},{name:'custom private',visibility:'custom',folderPublic:false},{name:'private',visibility:'private'},{name:'processing target',holdAt:1},{name:'closure',closed:true,holdAt:1},{name:'own auth cannot use public exception',auth:true,holdAt:1},{name:'foreign auth',auth:true,ok:true},{name:'pre-sign Hold',holdAt:2},{name:'in-flight Hold',holdAt:3,signed:true},{name:'missing target',missing:true},{name:'query error',error:true}];
for(current of cases){reads=0;signs=0;const r=await handler(new Request('https://synthetic.invalid/public-card-image',{method:'POST',headers:current.auth?{Authorization:'Bearer synthetic'}:{},body:JSON.stringify({item_id:'card'})}));assert.equal(r.status,current.ok?200:404,current.name);assert.equal(signs,current.ok||current.signed?1:0,current.name);assert.deepEqual(await r.json(),{url:current.ok?'https://synthetic.invalid/signed':null},current.name);if(current.ok)assert.equal(r.headers.get('cache-control'),'private, max-age=600');}
console.log('PASS actual public-card-image handler: '+cases.length+' synthetic contracts; no external calls/signing');
