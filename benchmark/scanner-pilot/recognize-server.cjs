'use strict';
const {createHash}=require('node:crypto');
const {provider,slabProvider}=require('./ximilar-server.cjs');
const AUTH_URL='https://enifiaqsnqtbzylnfrpi.supabase.co';
// Existing publishable key; no privileged key and no second Auth client.
const PUBLISHABLE_KEY='sb_publishable_pk2szDe_g7fJLUdAMEUevw_odrDmnuM';
const error=(status,code)=>Object.assign(new Error(code),{status,code});
const requireThat=(value,status,code)=>{if(!value)throw error(status,code)};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function createHandler({env=process.env,config,fetchImpl=fetch,now=Date.now,callProvider=provider.call,callSlabProvider=slabProvider.call}={}){
  async function json(url,options){
    let response;try{response=await fetchImpl(url,{...options,redirect:'error',signal:AbortSignal.timeout(8000)})}catch{throw error(503,'accounting_unavailable')}
    if(!response.ok)throw error(response.status===401?401:503,response.status===401?'sign_in_required':'accounting_unavailable');
    try{return await response.json()}catch{throw error(503,'accounting_unavailable')}
  }
  return async(req,res)=>{
    res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');
    try{
      requireThat(env.VERCEL_ENV==='preview'&&env.VERCEL_GIT_COMMIT_REF==='scanner-v16',404,'scanner_unavailable');
      requireThat(['GET','POST'].includes(req.method),405,'method_not_allowed');
      if(config?.enabled!==true){if(req.method==='GET')return res.status(200).json({active:false,remaining:0});throw error(403,'scanner_closed')}
      requireThat(typeof env.XIMILAR_API_TOKEN==='string'&&env.XIMILAR_API_TOKEN.trim(),503,'provider_unavailable');
      const authorization=String(req.headers.authorization||'');requireThat(/^Bearer [A-Za-z0-9_.-]+$/.test(authorization)&&authorization.length<12000,401,'sign_in_required');
      const headers={apikey:PUBLISHABLE_KEY,Authorization:authorization,'Content-Type':'application/json'};
      // Verify the supplied access token with the existing Auth service. Never trust decoded claims alone.
      const user=await json(AUTH_URL+'/auth/v1/user',{headers});requireThat(UUID.test(user?.id||''),401,'sign_in_required');
      if(req.method==='GET'){
        const budget=await json(AUTH_URL+'/rest/v1/rpc/dv_v16_scan_budget',{method:'POST',headers,body:'{}'});
        return res.status(200).json({active:budget?.enabled===true,remaining:Math.max(0,Number(budget?.remaining)||0),slabRemaining:Math.max(0,Number(budget?.slabRemaining)||0),rawLimit:budget?.rawLimit,slabLimit:budget?.slabLimit,resetsAt:budget?.resetsAt});
      }
      requireThat(String(req.headers['content-type']||'').split(';')[0]==='application/json',415,'json_required');
      requireThat(Number(req.headers['content-length']||0)<=2300000,413,'image_too_large');
      let body=req.body;if(Buffer.isBuffer(body))body=body.toString('utf8');
      if(typeof body==='string'){requireThat(body.length<=2300000,413,'image_too_large');try{body=JSON.parse(body)}catch{throw error(400,'invalid_request')}}
      requireThat(body&&['imageBase64,requestId,tcg','imageBase64,kind,requestId,tcg'].includes(Object.keys(body).sort().join(','))&&UUID.test(body.requestId),400,'invalid_request');
      requireThat(['pokemon','one_piece'].includes(body.tcg),400,'unsupported_tcg');
      const kind=body.kind??'raw';requireThat(['raw','slab'].includes(kind),400,'unsupported_scan_kind');
      requireThat(typeof body.imageBase64==='string'&&body.imageBase64.length<=2133336&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.imageBase64),400,'invalid_image');
      const image=Buffer.from(body.imageBase64,'base64');requireThat(image.length>=4&&image.length<=1600000&&image[0]===255&&image[1]===216&&image[2]===255,400,'jpeg_required');
      const sha256=createHash('sha256').update(image).digest('hex');
      // This atomic database reservation MUST commit before any paid provider call.
      // Missing RPC, timeout, duplicate, exhausted allowance or a lost reservation response all fail closed.
      const reservation=await json(AUTH_URL+'/rest/v1/rpc/dv_v16_reserve_scan',{method:'POST',headers,body:JSON.stringify({p_request_id:body.requestId,p_image_sha256:sha256,p_tcg:body.tcg,p_kind:kind})});
      const rejection={duplicate:[409,'scan_already_reserved'],closed:[403,'scanner_closed'],global_limit:[429,'scan_global_limit_reached']};
      const [status,code]=rejection[reservation?.reason]||[429,'scan_limit_reached'];requireThat(reservation?.allowed===true,status,code);
      const result=await (kind==='slab'?callSlabProvider:callProvider)({image,tcg:body.tcg,env,fetchImpl,now});
      const {raw,...compact}=result; // raw evidence belongs in the private pilot, not every mobile response.
      return res.status(200).json({...compact,selectedTcg:body.tcg,kind,sha256,slabRemaining:Math.max(0,Number(reservation.slabRemaining)||0),remaining:Math.max(0,Number(reservation.remaining)||0)});
    }catch(e){return res.status(e.status||500).json({error:e.code||'scan_failed',retryAutomatically:false})}
  };
}
module.exports={createHandler};
