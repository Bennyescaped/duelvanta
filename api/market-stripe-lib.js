'use strict';

const crypto=require('node:crypto');
const {resolveSupabaseEnvironment}=require('../supabase-environment.js');
const required=name=>{const value=process.env[name];if(!value)throw new Error(`missing_${name.toLowerCase()}`);return value};
const json=(res,status,body)=>res.status(status).json(body);
const liveActionEnv={onboarding:'STRIPE_CONNECT_LIVE_ONBOARDING_ENABLED',payments:'STRIPE_CONNECT_LIVE_PAYMENTS_ENABLED',refunds:'STRIPE_CONNECT_LIVE_REFUNDS_ENABLED',webhooks:'STRIPE_CONNECT_LIVE_WEBHOOKS_ENABLED'};

function stripeMode(action){
  const sandbox=process.env.STRIPE_CONNECT_SANDBOX_ENABLED==='true';
  const live=process.env.STRIPE_CONNECT_LIVE_ENABLED==='true';
  if(sandbox&&live)throw new Error('stripe_mode_conflict');
  if(!sandbox&&!live)throw new Error('stripe_sandbox_disabled');
  if(live){
    const gate=liveActionEnv[action];
    if(!gate)throw new Error('stripe_live_action_invalid');
    if(process.env[gate]!=='true')throw new Error(`stripe_live_${action}_disabled`);
  }
  const key=required('STRIPE_SECRET_KEY');
  if(live?!String(key).startsWith('sk_live_'):!String(key).startsWith('sk_test_'))throw new Error(live?'stripe_live_key_required':'stripe_test_key_required');
  return {liveMode:live,mode:live?'live':'sandbox'};
}

async function rpc(name,body,accessToken){
  const base=resolveSupabaseEnvironment(process.env).url;
  const service=required('SUPABASE_SERVICE_ROLE_KEY');
  const token=accessToken||service;
  const response=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:service,authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
  const text=await response.text();
  if(!response.ok)throw new Error(`database_${name}_${response.status}`);
  return text?JSON.parse(text):null;
}

async function authenticatedUser(req){
  const header=String(req.headers.authorization||'');
  if(!header.startsWith('Bearer '))return null;
  const base=resolveSupabaseEnvironment(process.env).url;
  const anon=required('SUPABASE_ANON_KEY');
  const response=await fetch(`${base}/auth/v1/user`,{headers:{apikey:anon,authorization:header}});
  if(!response.ok)return null;
  const user=await response.json();return user&&user.id?user:null;
}

function encodeForm(value,prefix,params=new URLSearchParams()){
  for(const [key,item] of Object.entries(value||{})){
    if(item===undefined||item===null)continue;
    const name=prefix?`${prefix}[${key}]`:key;
    if(typeof item==='object'&&!Array.isArray(item))encodeForm(item,name,params);
    else if(Array.isArray(item))item.forEach((entry,index)=>typeof entry==='object'?encodeForm(entry,`${name}[${index}]`,params):params.append(`${name}[${index}]`,String(entry)));
    else params.append(name,String(item));
  }
  return params;
}

async function stripeRequest(path,body,{account,idempotencyKey}={}){
  const headers={authorization:`Bearer ${required('STRIPE_SECRET_KEY')}`,'content-type':'application/x-www-form-urlencoded'};
  if(account)headers['stripe-account']=account;
  if(idempotencyKey)headers['idempotency-key']=idempotencyKey;
  const response=await fetch(`https://api.stripe.com/v1/${path}`,{method:'POST',headers,body:encodeForm(body).toString()});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`stripe_${response.status}_${result.error?.code||'request_failed'}`);
  return result;
}

async function stripeGetRequest(path,query,{account}={}){
  const headers={authorization:`Bearer ${required('STRIPE_SECRET_KEY')}`};
  if(account)headers['stripe-account']=account;
  const params=encodeForm(query).toString();
  const response=await fetch(`https://api.stripe.com/v1/${path}${params?`?${params}`:''}`,{method:'GET',headers});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`stripe_${response.status}_${result.error?.code||'request_failed'}`);
  return result;
}

async function stripeV2Request(path,body,{idempotencyKey}={}){
  const version=required('STRIPE_ACCOUNTS_V2_VERSION');
  if(!/^\d{4}-\d{2}-\d{2}\.[a-z][a-z0-9_-]*$/.test(version))throw new Error('stripe_accounts_v2_version_required');
  const headers={authorization:`Bearer ${required('STRIPE_SECRET_KEY')}`,'content-type':'application/json','stripe-version':version};
  if(idempotencyKey)headers['idempotency-key']=idempotencyKey;
  const response=await fetch(`https://api.stripe.com/v2/${path}`,{method:'POST',headers,body:JSON.stringify(body)});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`stripe_v2_${response.status}_${result.error?.code||'request_failed'}`);
  return result;
}

async function rawBody(req){
  if(Buffer.isBuffer(req.rawBody))return req.rawBody;
  if(typeof req.rawBody==='string')return Buffer.from(req.rawBody,'utf8');
  if(Buffer.isBuffer(req.body))return req.body;
  if(typeof req.body==='string')return Buffer.from(req.body,'utf8');
  if(req.readable&&!req.readableEnded){const parts=[];for await(const part of req)parts.push(Buffer.from(part));return Buffer.concat(parts)}
  throw new Error('raw_body_unavailable');
}

function verifyStripeSignature(payload,header,secret,nowSeconds=Math.floor(Date.now()/1000)){
  const parts=String(header||'').split(',').map(part=>part.trim().split('='));
  const timestamp=Number(parts.find(([key])=>key==='t')?.[1]);
  const signatures=parts.filter(([key])=>key==='v1').map(([,value])=>value).filter(Boolean);
  if(!Number.isFinite(timestamp)||Math.abs(nowSeconds-timestamp)>300||!signatures.length)return false;
  const expected=crypto.createHmac('sha256',secret).update(`${timestamp}.`).update(payload).digest('hex');
  return signatures.some(value=>{if(!/^[a-f0-9]{64}$/i.test(value))return false;return crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(value,'hex'))});
}

module.exports={authenticatedUser,encodeForm,json,rawBody,required,rpc,stripeGetRequest,stripeMode,stripeRequest,stripeV2Request,verifyStripeSignature};
