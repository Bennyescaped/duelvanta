'use strict';

const {resolveSupabaseEnvironment}=require('../supabase-environment.js');
const json=(res,status,body)=>res.status(status).json(body);
const required=name=>{const value=process.env[name];if(!value)throw new Error(`missing_${name.toLowerCase()}`);return value};

async function request(url,key,options={}){
  const response=await fetch(url,{...options,headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json',...(options.headers||{})}});
  const text=await response.text();
  if(options.allowMissing&&response.status===404)return null;
  if(!response.ok)throw new Error(`supabase_${response.status}_${text.slice(0,200)}`);
  return text?JSON.parse(text):null;
}

const rpc=(base,key,name,body)=>request(`${base.replace(/\/$/,'')}/rest/v1/rpc/${name}`,key,{method:'POST',body:JSON.stringify(body)});

async function removeStorageObject(base,key,item){
  if(!item?.bucket||!item?.path)return;
  const bucket=encodeURIComponent(item.bucket);
  const path=String(item.path).split('/').map(encodeURIComponent).join('/');
  await request(`${base.replace(/\/$/,'')}/storage/v1/object/${bucket}/${path}`,key,{method:'DELETE',allowMissing:true});
}

async function applyAuthAction(base,key,userId,action){
  const url=`${base.replace(/\/$/,'')}/auth/v1/admin/users/${encodeURIComponent(userId)}`;
  if(action==='delete')return request(url,key,{method:'DELETE',allowMissing:true});
  if(action==='disable_and_retain')return request(url,key,{method:'PUT',body:JSON.stringify({ban_duration:'876000h'})});
  throw new Error('unsupported_auth_action');
}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  if(process.env.ACCOUNT_DATA_ERASURE_ENABLED!=='true')return json(res,200,{status:'disabled',claimed:0,completed:0,failed:0});
  const secret=required('ACCOUNT_DATA_ERASURE_SECRET');
  if(req.headers.authorization!==`Bearer ${secret}`)return json(res,401,{error:'unauthorized'});
  const {url:base}=resolveSupabaseEnvironment(process.env),key=required('SUPABASE_SERVICE_ROLE_KEY'),lock=crypto.randomUUID();
  const rows=await rpc(base,key,'claim_account_deletion_requests',{p_limit:5,p_lock_token:lock});
  let completed=0,failed=0;
  for(const row of rows||[]){
    try{
      const plan=await rpc(base,key,'prepare_account_deletion_data',{p_request_id:row.request_id,p_lock_token:row.delivery_lock_token});
      for(const item of row.storage_manifest||[])await removeStorageObject(base,key,item);
      await applyAuthAction(base,key,row.user_id,plan.auth_action);
      await rpc(base,key,'finish_account_deletion_request',{p_request_id:row.request_id,p_lock_token:row.delivery_lock_token,p_success:true,p_error:null});
      completed++;
    }catch(error){
      await rpc(base,key,'finish_account_deletion_request',{p_request_id:row.request_id,p_lock_token:row.delivery_lock_token,p_success:false,p_error:String(error.message||error).slice(0,500)}).catch(()=>null);
      failed++;
    }
  }
  return json(res,200,{status:'processed',claimed:(rows||[]).length,completed,failed});
};

module.exports.removeStorageObject=removeStorageObject;
module.exports.applyAuthAction=applyAuthAction;
