/* R21: full printing images only; no catalog requests, proxy or credentials. */
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.DV_MAGIC_IMAGES=factory();
})(globalThis,function(){
 'use strict';
 const MAX_BYTES=5*1024*1024;
 function reference(value,printingId){
  if(typeof value!=='string'||typeof printingId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(printingId))return null;
  try{
   const u=new URL(value);
   if(u.protocol!=='https:'||u.hostname!=='cards.scryfall.io'||u.port||u.username||u.password||u.hash)return null;
   const m=u.pathname.match(/^\/(normal|large|png)\/front\/([a-f0-9])\/([a-f0-9])\/([a-f0-9-]+)\.(jpg|png)$/);
   if(!m||m[4]!==printingId||m[2]!==printingId[0]||m[3]!==printingId[1]||((m[1]==='png')!==(m[5]==='png'))||!/^\??[0-9]*$/.test(u.search))return null;
   return u.href;
  }catch{return null;}
 }
 async function download(candidate,{fetch:fetcher=globalThis.fetch,decode=globalThis.createImageBitmap}={}){
  const url=reference(candidate?.image_url,candidate?.provider_ref?.external_id);
  if(!url)throw Error('image_reference_invalid');
  const response=await fetcher(url,{method:'GET',mode:'cors',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});
  if(!response.ok||response.redirected||response.type==='opaque'||(response.url&&response.url!==url))throw Error('image_transfer_failed');
  const type=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if(!['image/jpeg','image/png'].includes(type))throw Error('image_type_invalid');
  const declared=response.headers.get('content-length');
  if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BYTES))throw Error('image_size_invalid');
  const reader=response.body?.getReader();if(!reader)throw Error('image_transfer_failed');
  const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)throw Error('image_size_invalid');chunks.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}
  finally{reader.releaseLock();}
  const blob=new Blob(chunks,{type}),head=new Uint8Array(await blob.slice(0,8).arrayBuffer());
  const valid=type==='image/png'?[137,80,78,71,13,10,26,10].every((x,i)=>head[i]===x):head[0]===255&&head[1]===216&&head[2]===255;
  if(!size||!valid||typeof decode!=='function')throw Error('image_data_invalid');
  const bitmap=await decode(blob);
  try{if(!bitmap.width||!bitmap.height||bitmap.width>4096||bitmap.height>4096)throw Error('image_dimensions_invalid');}finally{bitmap.close();}
  return blob;
 }
 async function attach(db,userId,itemId,blob,existingPath,identity){
  if(existingPath)return {status:'preserved'};
  if(!/^[a-f0-9-]{36}$/i.test(userId)||!/^[a-f0-9-]{36}$/i.test(itemId)||!blob||!['image/jpeg','image/png'].includes(blob.type)||blob.size>MAX_BYTES)throw Error('image_attachment_invalid');
  if(!identity||typeof identity.card_name!=='string'||typeof identity.card_number!=='string')throw Error('image_identity_invalid');
  const path=`${userId}/${itemId}/${crypto.randomUUID()}.${blob.type==='image/png'?'png':'jpg'}`;
  const upload=await db.storage.from('collection-cards').upload(path,blob,{contentType:blob.type,upsert:false});
  if(upload.error)throw Error('image_upload_failed');
  // A concurrent own-photo change wins. Never replace an existing image.
  let query=db.from('collection_items').update({image_path:path,image_captured_at:new Date().toISOString()}).eq('id',itemId).eq('user_id',userId).eq('tcg','magic').is('image_path',null);
  for(const key of ['card_name','set_name','card_number','language','variant'])query=identity[key]===null?query.is(key,null):query.eq(key,identity[key]);
  const update=await query.select('id');
  if(update.error||update.data?.length!==1)throw Error('image_link_failed');
  return {status:'stored',path};
 }
 return Object.freeze({MAX_BYTES,reference,download,attach});
});
