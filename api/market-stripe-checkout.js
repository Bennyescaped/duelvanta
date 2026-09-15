'use strict';

const {authenticatedUser,json,required,rpc,stripeMode,stripeRequest}=require('./market-stripe-lib');

module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  let mode;try{mode=stripeMode('payments')}catch(error){const code=String(error.message||error);return json(res,code==='stripe_sandbox_disabled'?409:503,{error:code})}
  const user=await authenticatedUser(req);if(!user)return json(res,401,{error:'authentication_required'});
  const orderId=String(req.body?.order_id||''),requestKey=String(req.body?.request_key||'');
  if(!/^[0-9a-f-]{36}$/i.test(orderId)||!/^[0-9a-f-]{36}$/i.test(requestKey))return json(res,400,{error:'invalid_request'});
  try{
    const prepared=await rpc('prepare_market_stripe_payment',{p_order_id:orderId,p_buyer_id:user.id,p_idempotency_key:requestKey});
    if(mode.liveMode?prepared?.live_mode!==true:prepared?.live_mode===true)throw new Error('stripe_database_mode_mismatch');
    const origin=required('DUELVANTA_PUBLIC_ORIGIN').replace(/\/$/,'');
    if(!/^https:\/\//.test(origin))throw new Error('secure_public_origin_required');
    const intentData={metadata:{duelvanta_attempt_id:prepared.attempt_id}};
    if(prepared.platform_fee_cents>0)intentData.application_fee_amount=prepared.platform_fee_cents;
    const session=await stripeRequest('checkout/sessions',{
      mode:'payment',success_url:`${origin}/trade.html?payment=return`,cancel_url:`${origin}/trade.html?payment=cancelled`,
      client_reference_id:prepared.attempt_id,
      line_items:[{quantity:1,price_data:{currency:'eur',unit_amount:prepared.amount_due_cents,product_data:{name:'DUELVANTA Marketplace-Bestellung'}}}],
      payment_intent_data:intentData,
      metadata:{duelvanta_attempt_id:prepared.attempt_id}
    },{account:prepared.stripe_account_id,idempotencyKey:`duelvanta-checkout-${requestKey}`});
    const sessionPrefix=mode.liveMode?'cs_live_':'cs_test_';
    if(!session.id?.startsWith(sessionPrefix)||!session.url)throw new Error('stripe_checkout_session_invalid');
    await rpc('bind_market_stripe_checkout_session',{p_attempt_id:prepared.attempt_id,p_session_id:session.id});
    return json(res,200,{status:mode.liveMode?'live_checkout_created':'sandbox_checkout_created',checkout_url:session.url,attempt_id:prepared.attempt_id,live_mode:mode.liveMode});
  }catch(error){return json(res,409,{error:String(error.message||error).slice(0,180)})}
};