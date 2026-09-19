'use strict';

const crypto=require('node:crypto');

const STAGING_URL='https://xhmjxrcskfhbovhitdej.supabase.co';
const STAGING_KEY='sb_publishable_KNlm6LzvSxCaGwLc_1mPbA_-z1we46N';
const AFTERSHIP_BASE='https://api.aftership.com/tracking/2026-07';
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json=(res,status,body)=>res.status(status).json(body);
const required=name=>{const value=process.env[name];if(!value)throw new Error(`missing_${name.toLowerCase()}`);return value};
const same=(a,b)=>{
  const left=Buffer.from(String(a||'')),right=Buffer.from(String(b||''));
  return left.length===right.length&&crypto.timingSafeEqual(left,right);
};
const parseBody=req=>{
  if(req.body&&typeof req.body==='object'&&!Buffer.isBuffer(req.body))return req.body;
  const raw=Buffer.isBuffer(req.body)?req.body.toString('utf8'):String(req.body||'');
  if(!raw)return {};
  try{return JSON.parse(raw)}catch(_){return null}
};
const rawBody=req=>{
  if(Buffer.isBuffer(req.rawBody))return req.rawBody.toString('utf8');
  if(typeof req.rawBody==='string')return req.rawBody;
  if(Buffer.isBuffer(req.body))return req.body.toString('utf8');
  if(typeof req.body==='string')return req.body;
  return null;
};

function baseConfig(){
  if(process.env.VERCEL_ENV!=='preview'||process.env.MARKET_TRACKING_ENABLED!=='true')return null;
  const base=process.env.SUPABASE_URL||STAGING_URL;
  if(base!==STAGING_URL)throw new Error('tracking_preview_database_mismatch');
  return {
    base,
    publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY||STAGING_KEY,
    serviceKey:required('SUPABASE_SERVICE_ROLE_KEY')
  };
}

async function fetchUser(config,authorization){
  if(!/^Bearer\s+\S+$/i.test(String(authorization||'')))return null;
  const response=await fetch(`${config.base}/auth/v1/user`,{
    headers:{apikey:config.publishableKey,authorization}
  });
  if(!response.ok)return null;
  const data=await response.json().catch(()=>null);
  return data?.id?data:null;
}

async function fetchOrder(config,orderId){
  const select='id,order_number,seller_id,fulfillment_group,status,carrier,tracking_code,shipped_at,delivery_evidence_at,closure_eligible_at';
  const response=await fetch(`${config.base}/rest/v1/market_orders?select=${encodeURIComponent(select)}&id=eq.${encodeURIComponent(orderId)}&limit=1`,{
    headers:{apikey:config.serviceKey,authorization:`Bearer ${config.serviceKey}`}
  });
  if(!response.ok)throw new Error(`database_market_order_${response.status}`);
  const rows=await response.json().catch(()=>[]);
  return rows?.[0]||null;
}

async function serviceRpc(config,name,body){
  const response=await fetch(`${config.base}/rest/v1/rpc/${name}`,{
    method:'POST',
    headers:{apikey:config.serviceKey,authorization:`Bearer ${config.serviceKey}`,'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!response.ok)throw new Error(`database_${name}_${response.status}`);
  const text=await response.text();
  return text?JSON.parse(text):null;
}

function providerTrackingId(orderId){return `duelvanta-${orderId}`}

async function createAfterShipTracking(apiKey,order){
  const tracking={
    id:providerTrackingId(order.id),
    tracking_number:String(order.tracking_code).trim(),
    title:String(order.order_number||order.id).slice(0,128),
    order_id:order.id,
    language:'de'
  };
  const response=await fetch(`${AFTERSHIP_BASE}/trackings`,{
    method:'POST',
    headers:{'as-api-key':apiKey,'content-type':'application/json'},
    body:JSON.stringify({tracking})
  });
  const payload=await response.json().catch(()=>({}));
  if(response.ok)return {status:'registered',provider_tracking_id:payload?.data?.tracking?.id||tracking.id};
  if(response.status!==409)throw new Error(`aftership_create_${response.status}`);

  const existing=await fetch(`${AFTERSHIP_BASE}/trackings/${encodeURIComponent(tracking.id)}`,{
    headers:{'as-api-key':apiKey}
  });
  const existingPayload=await existing.json().catch(()=>({}));
  const row=existingPayload?.data?.tracking;
  if(existing.ok&&row&&String(row.tracking_number||'').trim()===tracking.tracking_number&&String(row.order_id||'')===order.id){
    return {status:'already_registered',provider_tracking_id:row.id||tracking.id};
  }
  throw new Error('aftership_tracking_conflict');
}

async function handleRegister(req,res){
  let config;
  try{config=baseConfig()}catch(error){return json(res,503,{error:error.message})}
  if(!config)return json(res,200,{status:'disabled'});
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  const body=parseBody(req);
  if(!body)return json(res,400,{error:'invalid_json'});
  const orderId=String(body.order_id||'').trim();
  if(!UUID_RE.test(orderId))return json(res,400,{error:'invalid_order_id'});
  const user=await fetchUser(config,req.headers?.authorization);
  if(!user)return json(res,401,{error:'unauthorized'});
  const order=await fetchOrder(config,orderId);
  if(!order)return json(res,404,{error:'order_not_found'});
  if(order.seller_id!==user.id)return json(res,403,{error:'seller_required'});
  if(order.fulfillment_group!=='shipping')return json(res,200,{status:'not_trackable'});
  if(!order.tracking_code)return json(res,200,{status:'not_trackable'});
  if(!['shipped','received','completed'].includes(order.status)||!order.shipped_at)return json(res,409,{error:'order_not_shipped'});
  if(order.status==='completed')return json(res,200,{status:'already_completed'});
  try{
    const result=await createAfterShipTracking(required('AFTERSHIP_API_KEY'),order);
    return json(res,200,result);
  }catch(error){
    console.warn('AfterShip tracking registration',error);
    return json(res,502,{error:String(error.message||error).slice(0,120)});
  }
}

function verifyWebhook(req,webhookSecret,headerSecret){
  if(!same(req.headers?.['x-duelvanta-tracking-secret'],headerSecret))return {ok:false,error:'invalid_tracking_webhook_secret'};
  if(String(req.headers?.['as-webhook-version']||'')!=='2026-07')return {ok:false,error:'unsupported_aftership_webhook_version'};
  const raw=rawBody(req);
  if(!raw)return {ok:true,hmac:false};
  const provided=String(req.headers?.['aftership-hmac-sha256']||'');
  const expected=crypto.createHmac('sha256',webhookSecret).update(raw,'utf8').digest('base64');
  if(!same(provided,expected))return {ok:false,error:'invalid_aftership_hmac'};
  return {ok:true,hmac:true};
}

function carrierDeliveredCheckpoint(msg){
  const checkpoints=Array.isArray(msg?.checkpoints)?msg.checkpoints:[];
  return [...checkpoints].reverse().find(cp=>cp?.tag==='Delivered'&&cp?.source==='carrier'&&cp?.checkpoint_time)||null;
}

function orderIdFromMessage(msg){
  const direct=String(msg?.order_id||'').trim();
  if(UUID_RE.test(direct))return direct;
  const id=String(msg?.id||'');
  if(id.startsWith('duelvanta-')){
    const candidate=id.slice('duelvanta-'.length);
    if(UUID_RE.test(candidate))return candidate;
  }
  return null;
}

async function handleWebhook(req,res){
  let config;
  try{config=baseConfig()}catch(error){return json(res,503,{error:error.message})}
  if(!config)return json(res,200,{status:'disabled'});
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  let verified;
  try{verified=verifyWebhook(req,required('AFTERSHIP_WEBHOOK_SECRET'),required('AFTERSHIP_WEBHOOK_HEADER_SECRET'))}catch(error){return json(res,503,{error:error.message})}
  if(!verified.ok)return json(res,401,{error:verified.error});
  const body=parseBody(req);
  if(!body)return json(res,400,{error:'invalid_json'});
  if(body.event!=='tracking_update'||body.msg?.tag!=='Delivered')return json(res,200,{status:'ignored',reason:'not_delivered'});
  const checkpoint=carrierDeliveredCheckpoint(body.msg);
  if(!checkpoint)return json(res,200,{status:'ignored',reason:'no_carrier_delivery_checkpoint'});
  const orderId=orderIdFromMessage(body.msg);
  if(!orderId)return json(res,200,{status:'ignored',reason:'unknown_order'});
  const eventId=String(body.event_id||'').trim();
  if(!UUID_RE.test(eventId))return json(res,400,{error:'invalid_event_id'});

  let order;
  try{order=await fetchOrder(config,orderId)}catch(error){return json(res,503,{error:error.message})}
  if(!order)return json(res,200,{status:'ignored',reason:'unknown_order'});
  if(order.fulfillment_group!=='shipping')return json(res,200,{status:'ignored',reason:'not_shipping'});
  if(String(order.tracking_code||'').trim()!==String(body.msg?.tracking_number||'').trim())return json(res,200,{status:'ignored',reason:'tracking_mismatch'});
  if(order.status==='completed')return json(res,200,{status:'already_completed'});
  if(!['shipped','received'].includes(order.status))return json(res,200,{status:'ignored',reason:'order_not_eligible'});

  const deliveredAt=new Date(checkpoint.checkpoint_time);
  if(Number.isNaN(deliveredAt.getTime()))return json(res,400,{error:'invalid_delivery_time'});
  const reference=`aftership:${eventId}:${String(checkpoint.hash||'nohash')}`.slice(0,160);
  const source=`aftership:${String(body.msg?.slug||'carrier')}`.slice(0,80);
  try{
    await serviceRpc(config,'record_market_order_delivery_evidence_b07',{
      p_order_id:orderId,
      p_delivered_at:deliveredAt.toISOString(),
      p_source:source,
      p_reference:reference
    });
    return json(res,200,{status:order.delivery_evidence_at?'duplicate_or_existing':'delivery_recorded',order_id:orderId,hmac_verified:verified.hmac});
  }catch(error){
    console.warn('AfterShip delivery evidence',error);
    return json(res,503,{error:String(error.message||error).slice(0,120)});
  }
}

module.exports={handleRegister,handleWebhook,providerTrackingId,verifyWebhook,carrierDeliveredCheckpoint,orderIdFromMessage};
