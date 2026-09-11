'use strict';
// Public catalog transport only: fixed host/paths, no cookies, keys or uploads.
function allowed(value){
  try{const u=new URL(value);if(u.origin!=='https://optcgapi.com'||u.search||u.hash||u.username||u.password)return null;
    const catalog=/^\/api\/(sets|decks|promos)\/card\/(?:(?:OP|ST|EB|PRB)\d{2}-\d{3}|P-\d{3})\/$/.test(u.pathname);
    const image=/^\/media\/static\/Card_Images\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(u.pathname);
    return catalog||image?{url:u.href,image}:null;
  }catch{return null}
}
function createHandler({fetchImpl=fetch,env=process.env}={}){return async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!=='scanner-v16')return res.status(404).end();
  if(req.method!=='GET')return res.status(405).end();
  const target=allowed(req.query?.url);if(!target)return res.status(400).json({error:'invalid_reference'});
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),6000);
  try{
    const upstream=await fetchImpl(target.url,{signal:abort.signal,redirect:'error',headers:{Accept:target.image?'image/jpeg,image/png,image/webp':'application/json'}});
    if(!upstream.ok)return res.status(upstream.status===404?404:502).json({error:'reference_upstream',status:upstream.status});
    const type=(upstream.headers.get('content-type')||'').split(';')[0].trim();
    if(!(target.image?['image/jpeg','image/png','image/webp'].includes(type):type==='application/json'))throw new Error('invalid_type');
    const max=target.image?3000000:1000000;if(Number(upstream.headers.get('content-length'))>max)throw new Error('too_large');
    const chunks=[];let size=0;for await(const chunk of upstream.body){size+=chunk.length;if(size>max){abort.abort();throw new Error('too_large')}chunks.push(Buffer.from(chunk));}
    const bytes=Buffer.concat(chunks);if(!target.image)JSON.parse(bytes.toString('utf8'));
    res.setHeader('Content-Type',type);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','public, max-age=300, s-maxage=3600');return res.status(200).send(bytes);
  }catch{return res.status(502).json({error:'reference_unavailable'})}finally{clearTimeout(timer)}
};}
module.exports=createHandler();module.exports.createHandler=createHandler;module.exports.allowed=allowed;
