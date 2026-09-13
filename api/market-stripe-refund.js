'use strict';

const {json,required,rpc,stripeRequest}=require('./market-stripe-lib');

module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  if(process.env.STRIPE_CONNECT_SANDBOX_ENABLED!=='true')return json(res,409,{error:'stripe_sandbox_disabled'});
  if(req.headers.authorization!==`Bearer ${required('STRIPE_REFUND_WORKER_SECRET')}`)return json(res,401,{error:'unauthorized'});
  if(!String(required('STRIPE_SECRET_KEY')).startsWith('sk_test_'))return json(res,503,{error:'stripe_test_key_required'});
  const orderId=String(req.body?.order_id||''),requestKey=String(req.body?.request_key||''),reason=String(req.body?.reason||'');
  if(!/^[0-9a-f-]{36}$/i.test(orderId)||!/^[0-9a-f-]{36}$/i.test(requestKey))return json(res,400,{error:'invalid_request'});
  try{
    const prepared=await rpc('prepare_market_stripe_full_refund',{p_order_id:orderId,p_request_key:requestKey,p_reason:reason});
    const refund=await stripeRequest('refunds',{payment_intent:prepared.payment_intent_id,reason:'requested_by_customer',metadata:{duelvanta_refund_request_id:prepared.request_id}},
      {account:prepared.stripe_account_id,idempotencyKey:`duelvanta-refund-${requestKey}`});
    await rpc('mark_market_stripe_refund_submitted',{p_request_id:prepared.request_id,p_refund_id:refund.id});
    return json(res,202,{status:'refund_submitted_to_provider',refund_id:refund.id,confirmed:false,live_mode:false});
  }catch(error){return json(res,409,{error:String(error.message||error).slice(0,180)})}
};
