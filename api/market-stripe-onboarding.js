'use strict';

const {authenticatedUser,json,required,rpc,stripeV2Request}=require('./market-stripe-lib');

module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  if(process.env.STRIPE_CONNECT_SANDBOX_ENABLED!=='true')return json(res,409,{error:'stripe_sandbox_disabled'});
  const missing=['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','STRIPE_SECRET_KEY','STRIPE_ACCOUNTS_V2_VERSION','DUELVANTA_PUBLIC_ORIGIN'].filter(name=>!String(process.env[name]||'').trim());
  if(missing.length)return json(res,503,{error:'stripe_configuration_missing',missing});
  if(!String(required('STRIPE_SECRET_KEY')).startsWith('sk_test_'))return json(res,503,{error:'stripe_test_key_required'});
  const origin=required('DUELVANTA_PUBLIC_ORIGIN').replace(/\/$/,'');
  try{const parsed=new URL(origin);if(parsed.protocol!=='https:'||parsed.origin!==origin)throw new Error()}catch{return json(res,503,{error:'secure_public_origin_required'})}
  if(!/^\d{4}-\d{2}-\d{2}\.[a-z][a-z0-9_-]*$/.test(required('STRIPE_ACCOUNTS_V2_VERSION')))return json(res,503,{error:'stripe_accounts_v2_version_required'});
  try{
  const user=await authenticatedUser(req);if(!user)return json(res,401,{error:'authentication_required'});
  const requestKey=String(req.body?.request_key||'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey))return json(res,400,{error:'invalid_request'});
    const prepare=()=>rpc('prepare_market_stripe_onboarding',{p_seller_id:user.id,p_request_key:requestKey});
    let prepared;
    try{prepared=await prepare()}catch(error){
      if(!/^database_prepare_market_stripe_onboarding_(502|503|504)$/.test(error.message))throw error;
      prepared=await prepare();
    }
    if(prepared.onboarding_state==='completed')return json(res,200,{status:'stripe_test_onboarding_complete',live_mode:false});
    let accountId=prepared.stripe_account_id;
    if(!accountId){
      const country=String(prepared.country_code||'');
      if(!/^[A-Z]{2}$/.test(country))throw new Error('seller_country_required');
      const account=await stripeV2Request('core/accounts',{
        contact_email:user.email,display_name:prepared.seller_type==='trader'?'DUELVANTA Händler':'DUELVANTA Privatverkäufer',dashboard:'full',
        identity:{country},
        configuration:{merchant:{capabilities:{card_payments:{requested:true}}}},
        defaults:{currency:'eur',responsibilities:{fees_collector:'stripe',losses_collector:'stripe'},locales:['de-DE']},
        include:['configuration.merchant','requirements']
      },{idempotencyKey:`duelvanta-account-${prepared.onboarding_request_id}`});
      accountId=account.id;
      if(account.livemode!==false)throw new Error('stripe_live_account_forbidden');
      if(!/^acct_[A-Za-z0-9]+$/.test(accountId||''))throw new Error('stripe_test_account_invalid');
      await rpc('register_market_stripe_test_account',{p_onboarding_request_id:prepared.onboarding_request_id,p_seller_id:user.id,p_account_id:accountId});
    }
    const link=await stripeV2Request('core/account_links',{account:accountId,use_case:{type:'account_onboarding',account_onboarding:{configurations:['merchant'],
      refresh_url:`${origin}/seller-onboarding.html?stripe=refresh`,return_url:`${origin}/seller-onboarding.html?stripe=return`}}},
      {idempotencyKey:`duelvanta-account-link-${requestKey}`});
    if(link.livemode!==false||link.object!=='v2.core.account_link'||!/^https:\/\/(connect|accounts)\.stripe\.com\//.test(link.url||''))throw new Error('stripe_account_link_invalid');
    await rpc('mark_market_stripe_onboarding_link_created',{p_onboarding_request_id:prepared.onboarding_request_id,p_account_id:accountId});
    return json(res,200,{status:'stripe_test_onboarding_ready',onboarding_url:link.url,live_mode:false});
  }catch(error){return json(res,409,{error:String(error.message||error).slice(0,180)})}
};
