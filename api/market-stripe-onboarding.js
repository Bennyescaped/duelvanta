'use strict';

const {authenticatedUser,json,required,rpc,stripeRequest,stripeV2Request}=require('./market-stripe-lib');

module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  if(process.env.STRIPE_CONNECT_SANDBOX_ENABLED!=='true')return json(res,409,{error:'stripe_sandbox_disabled'});
  if(!String(required('STRIPE_SECRET_KEY')).startsWith('sk_test_'))return json(res,503,{error:'stripe_test_key_required'});
  const user=await authenticatedUser(req);if(!user)return json(res,401,{error:'authentication_required'});
  const requestKey=String(req.body?.request_key||'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey))return json(res,400,{error:'invalid_request'});
  try{
    const prepared=await rpc('prepare_market_stripe_onboarding',{p_seller_id:user.id,p_request_key:requestKey});
    if(prepared.onboarding_state==='completed')return json(res,200,{status:'stripe_test_onboarding_complete',live_mode:false});
    let accountId=prepared.stripe_account_id;
    if(!accountId){
      const account=await stripeV2Request('core/accounts',{
        contact_email:user.email,display_name:prepared.seller_type==='trader'?'DUELVANTA Händler':'DUELVANTA Privatverkäufer',dashboard:'full',
        configuration:{merchant:{capabilities:{card_payments:{requested:true}}}},
        defaults:{currency:'eur',responsibilities:{fees_collector:'stripe',losses_collector:'stripe'},locales:['de-DE']},
        include:['configuration.merchant','requirements']
      },{idempotencyKey:`duelvanta-account-${requestKey}`});
      accountId=account.id;
      if(!/^acct_[A-Za-z0-9]+$/.test(accountId||''))throw new Error('stripe_test_account_invalid');
      await rpc('register_market_stripe_test_account',{p_onboarding_request_id:prepared.onboarding_request_id,p_seller_id:user.id,p_account_id:accountId});
    }
    const origin=required('DUELVANTA_PUBLIC_ORIGIN').replace(/\/$/,'');
    if(!/^https:\/\//.test(origin))throw new Error('secure_public_origin_required');
    const link=await stripeRequest('account_links',{account:accountId,refresh_url:`${origin}/seller-onboarding.html?stripe=refresh`,
      return_url:`${origin}/seller-onboarding.html?stripe=return`,type:'account_onboarding',collection_options:{fields:'eventually_due',future_requirements:'include'}},
      {idempotencyKey:`duelvanta-account-link-${requestKey}`});
    if(!link.url||link.object!=='account_link')throw new Error('stripe_account_link_invalid');
    await rpc('mark_market_stripe_onboarding_link_created',{p_onboarding_request_id:prepared.onboarding_request_id,p_account_id:accountId});
    return json(res,200,{status:'stripe_test_onboarding_ready',onboarding_url:link.url,live_mode:false});
  }catch(error){return json(res,409,{error:String(error.message||error).slice(0,180)})}
};
