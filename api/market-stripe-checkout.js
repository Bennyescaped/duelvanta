'use strict';

const {authenticatedUser,json,required,rpc,stripeGetRequest,stripeMode,stripeRequest}=require('./market-stripe-lib');

const UUID=/^[0-9a-f-]{36}$/i;
const sessionPrefix=live=>live?'cs_live_':'cs_test_';

function checkoutUrl(session,liveMode){
  const prefix=sessionPrefix(liveMode);
  if(!session?.id?.startsWith(prefix)||!session?.url)throw new Error('stripe_checkout_session_invalid');
  const target=new URL(session.url);
  if(target.protocol!=='https:'||target.hostname!=='checkout.stripe.com')throw new Error('stripe_checkout_url_invalid');
  return target.href;
}

async function fixedPriceCheckout(req,res,mode,user,accessToken){
  const listingId=String(req.body?.listing_id||''),requestKey=String(req.body?.request_key||'');
  const quantity=Number(req.body?.quantity),expected=String(req.body?.expected_updated_at||''),checkoutHash=String(req.body?.checkout_hash||'').toLowerCase();
  if(!UUID.test(listingId)||!UUID.test(requestKey)||!Number.isInteger(quantity)||quantity<1||quantity>1000||
     !expected||!/^[a-f0-9]{64}$/.test(checkoutHash))return json(res,400,{error:'invalid_request'});
  const prepareBody={
    p_listing_id:listingId,p_quantity:quantity,p_request_id:requestKey,
    p_expected_updated_at:expected,p_checkout_hash:checkoutHash,p_live_mode:mode.liveMode
  };
  let prepared=await rpc('prepare_fixed_price_market_offer_v1',prepareBody,accessToken);
  if(mode.liveMode?prepared?.live_mode!==true:prepared?.live_mode===true)throw new Error('stripe_database_mode_mismatch');

  if(prepared.accepted===true&&prepared.stripe_checkout_session_id){
    const existing=await stripeGetRequest(`checkout/sessions/${encodeURIComponent(prepared.stripe_checkout_session_id)}`,{},{
      account:prepared.stripe_account_id
    });
    return json(res,200,{
      status:mode.liveMode?'live_checkout_created':'sandbox_checkout_created',
      checkout_url:checkoutUrl(existing,mode.liveMode),attempt_id:prepared.payment_attempt_id,
      order_id:prepared.order_id,live_mode:mode.liveMode,replayed:true
    });
  }

  const origin=required('DUELVANTA_PUBLIC_ORIGIN').replace(/\/$/,'');
  if(!/^https:\/\//.test(origin))throw new Error('secure_public_origin_required');
  const metadata={
    duelvanta_attempt_id:prepared.payment_attempt_id,
    duelvanta_fixed_offer_id:prepared.offer_id
  };
  const intentData={metadata};
  if(prepared.platform_fee_cents>0)intentData.application_fee_amount=prepared.platform_fee_cents;
  const session=await stripeRequest('checkout/sessions',{
    mode:'payment',
    success_url:`${origin}/trade.html?payment=return`,
    cancel_url:`${origin}/trade.html?payment=cancelled`,
    client_reference_id:prepared.payment_attempt_id,
    line_items:[{quantity:1,price_data:{
      currency:'eur',unit_amount:prepared.amount_due_cents,
      product_data:{name:'DUELVANTA Marketplace-Bestellung'}
    }}],
    payment_intent_data:intentData,
    metadata
  },{account:prepared.stripe_account_id,idempotencyKey:`duelvanta-fixed-${requestKey}`});
  const url=checkoutUrl(session,mode.liveMode);
  const acceptBody={
    p_offer_id:prepared.offer_id,p_attempt_id:prepared.payment_attempt_id,p_session_id:session.id,
    p_payment_requested_at:new Date(Number(session.created)*1000).toISOString(),p_live_mode:mode.liveMode
  };

  let accepted;
  try{
    accepted=await rpc('accept_fixed_price_market_offer_v1',acceptBody);
  }catch(firstError){
    // Resolve an ambiguous DB response before expiring a payment request that may already have formed the contract.
    const state=await rpc('prepare_fixed_price_market_offer_v1',prepareBody,accessToken).catch(()=>null);
    if(state?.accepted===true&&state?.stripe_checkout_session_id===session.id){
      accepted={order_id:state.order_id,replayed:true};
    }else{
      try{await stripeRequest(`checkout/sessions/${encodeURIComponent(session.id)}/expire`,{},{
        account:prepared.stripe_account_id,idempotencyKey:`duelvanta-fixed-expire-${requestKey}`
      })}catch(expireError){console.warn('MARKET_FIXED_CHECKOUT_EXPIRE',String(expireError.message||expireError).slice(0,160))}
      await rpc('release_fixed_price_market_offer_v1',{p_offer_id:prepared.offer_id,p_reason:'payment_request_finalize_failed'}).catch(()=>null);
      throw firstError;
    }
  }
  return json(res,200,{
    status:mode.liveMode?'live_checkout_created':'sandbox_checkout_created',
    checkout_url:url,attempt_id:prepared.payment_attempt_id,order_id:accepted?.order_id||null,
    live_mode:mode.liveMode,replayed:accepted?.replayed===true
  });
}

async function existingOrderCheckout(req,res,mode,user){
  const orderId=String(req.body?.order_id||''),requestKey=String(req.body?.request_key||'');
  if(!UUID.test(orderId)||!UUID.test(requestKey))return json(res,400,{error:'invalid_request'});
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
    payment_intent_data:intentData,metadata:{duelvanta_attempt_id:prepared.attempt_id}
  },{account:prepared.stripe_account_id,idempotencyKey:`duelvanta-checkout-${requestKey}`});
  const url=checkoutUrl(session,mode.liveMode);
  await rpc('bind_market_stripe_checkout_session',{p_attempt_id:prepared.attempt_id,p_session_id:session.id});
  return json(res,200,{
    status:mode.liveMode?'live_checkout_created':'sandbox_checkout_created',
    checkout_url:url,attempt_id:prepared.attempt_id,live_mode:mode.liveMode
  });
}

module.exports=async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  let mode;try{mode=stripeMode('payments')}catch(error){const code=String(error.message||error);return json(res,code==='stripe_sandbox_disabled'?409:503,{error:code})}
  const user=await authenticatedUser(req);if(!user)return json(res,401,{error:'authentication_required'});
  const header=String(req.headers.authorization||''),accessToken=header.startsWith('Bearer ')?header.slice(7):'';
  try{
    if(req.body?.listing_id)return await fixedPriceCheckout(req,res,mode,user,accessToken);
    return await existingOrderCheckout(req,res,mode,user);
  }catch(error){
    return json(res,409,{error:String(error.message||error).slice(0,180)});
  }
};
