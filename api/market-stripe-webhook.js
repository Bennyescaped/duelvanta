'use strict';

const crypto=require('node:crypto');
const {json,rawBody,required,rpc,verifyStripeSignature}=require('./market-stripe-lib');

function normalized(event){
  const o=event.data?.object||{},type=event.type,data={attempt_id:o.metadata?.duelvanta_attempt_id||null};
  if(type.startsWith('checkout.session.')){data.payment_intent_id=typeof o.payment_intent==='string'?o.payment_intent:null;data.amount_cents=o.amount_total||0;data.currency=o.currency}
  if(type.startsWith('payment_intent.')){data.amount_cents=o.amount_received||o.amount||0;data.currency=o.currency;data.charge_id=typeof o.latest_charge==='string'?o.latest_charge:null}
  if(type==='charge.refunded'){data.amount_cents=o.amount_refunded||0;data.currency=o.currency;data.refund_id=o.refunds?.data?.find(item=>item.status==='succeeded')?.id||null}
  if(type==='account.updated'){
    data.charges_enabled=o.charges_enabled===true;data.payouts_enabled=o.payouts_enabled===true;data.details_submitted=o.details_submitted===true;
    data.requirements_due_count=Array.isArray(o.requirements?.currently_due)?o.requirements.currently_due.length:0;
    data.past_due_count=Array.isArray(o.requirements?.past_due)?o.requirements.past_due.length:0;
    data.disabled_reason=o.requirements?.disabled_reason||null;
  }
  return data;
}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  if(process.env.STRIPE_CONNECT_SANDBOX_ENABLED!=='true')return json(res,409,{error:'stripe_sandbox_disabled'});
  try{
    const bytes=await rawBody(req),secret=required('STRIPE_WEBHOOK_SECRET');
    if(!verifyStripeSignature(bytes,req.headers['stripe-signature'],secret))return json(res,400,{error:'invalid_signature'});
    const event=JSON.parse(bytes.toString('utf8'));
    if(!event.id||!event.type||event.livemode!==false||!event.account)return json(res,400,{error:'invalid_connect_test_event'});
    const supported=['account.updated','checkout.session.completed','checkout.session.async_payment_succeeded','payment_intent.succeeded','payment_intent.payment_failed','charge.refunded'];
    const data=normalized(event),objectId=event.data?.object?.id||null;
    const result=await rpc('apply_market_stripe_event',{p_event_id:event.id,p_event_type:event.type,p_account_id:event.account,
      p_live_mode:event.livemode,p_object_id:objectId,p_payload_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
      p_provider_created_at:event.created?new Date(event.created*1000).toISOString():null,p_data:data});
    return json(res,200,{received:true,supported:supported.includes(event.type),result});
  }catch(error){const message=String(error.message||error).slice(0,180);console.error('MARKET_STRIPE_WEBHOOK',message);return json(res,400,{error:message})}
};
