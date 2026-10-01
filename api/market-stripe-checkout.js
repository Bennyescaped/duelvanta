'use strict';

const {authenticatedUser,json,required,rpc,stripeGetRequest,stripeMode,stripeRequest}=require('./market-stripe-lib');

const UUID=/^[0-9a-f-]{36}$/i;
const ACCOUNT=/^acct_[A-Za-z0-9_]+$/;
const sessionPrefix=live=>live?'cs_live_':'cs_test_';

function fixedPrepared(data,liveMode){
  if(!data||typeof data!=='object')throw new Error('fixed_checkout_prepare_invalid');
  if(data.live_mode!==liveMode)throw new Error('stripe_database_mode_mismatch');
  if(!UUID.test(String(data.offer_id||''))||!UUID.test(String(data.payment_attempt_id||''))||
     !ACCOUNT.test(String(data.stripe_account_id||''))||data.currency!=='EUR'||
     !Number.isInteger(data.amount_due_cents)||data.amount_due_cents<=0||
     !Number.isInteger(data.platform_fee_cents)||data.platform_fee_cents<0||
     data.platform_fee_cents>data.amount_due_cents)throw new Error('fixed_checkout_prepare_invalid');
  if(data.accepted===true){
    if(!String(data.stripe_checkout_session_id||'').startsWith(sessionPrefix(liveMode))||
       !UUID.test(String(data.order_id||'')))throw new Error('fixed_checkout_prepare_invalid');
  }else if(data.accepted!==false){
    throw new Error('fixed_checkout_prepare_invalid');
  }
  return data;
}

function fixedSession(session,prepared,liveMode,expectedId=null){
  if(!session||typeof session!=='object')throw new Error('stripe_checkout_session_invalid');
  if(!String(session.id||'').startsWith(sessionPrefix(liveMode))||
     (expectedId&&session.id!==expectedId)||
     !Number.isInteger(Number(session.amount_total))||Number(session.amount_total)!==prepared.amount_due_cents||
     String(session.currency||'').toLowerCase()!=='eur'||
     String(session.client_reference_id||'')!==prepared.payment_attempt_id||
     session.metadata?.duelvanta_attempt_id!==prepared.payment_attempt_id||
     session.metadata?.duelvanta_fixed_offer_id!==prepared.offer_id||
     !Number.isFinite(Number(session.created))||Number(session.created)<=0)throw new Error('stripe_checkout_session_invalid');
  let url=null;
  if(session.url){
    const target=new URL(session.url);
    if(target.protocol!=='https:'||target.hostname!=='checkout.stripe.com')throw new Error('stripe_checkout_url_invalid');
    url=target.href;
  }
  const status=String(session.status||'');
  return {url,created:Number(session.created),status,expired:status==='expired',complete:status==='complete'};
}

function samePrepared(a,b){
  return !!a&&!!b&&a.accepted===false&&b.accepted===false&&
    a.offer_id===b.offer_id&&a.payment_attempt_id===b.payment_attempt_id&&
    a.stripe_account_id===b.stripe_account_id&&a.amount_due_cents===b.amount_due_cents&&
    a.platform_fee_cents===b.platform_fee_cents&&a.live_mode===b.live_mode;
}

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
  let prepared=fixedPrepared(await rpc('prepare_fixed_price_market_offer_v1',prepareBody,accessToken),mode.liveMode);

  if(prepared.accepted===true){
    let existing;
    try{
      existing=await stripeGetRequest(`checkout/sessions/${encodeURIComponent(prepared.stripe_checkout_session_id)}`,{},{
        account:prepared.stripe_account_id
      });
    }catch(error){
      return json(res,503,{error:'fixed_checkout_payment_recovery_unknown',retryable:true,contract_formed:true,
        attempt_id:prepared.payment_attempt_id,order_id:prepared.order_id,live_mode:mode.liveMode,replayed:true});
    }
    let checked;
    try{checked=fixedSession(existing,prepared,mode.liveMode,prepared.stripe_checkout_session_id)}
    catch(error){
      return json(res,503,{error:'fixed_checkout_payment_recovery_unknown',retryable:true,contract_formed:true,
        attempt_id:prepared.payment_attempt_id,order_id:prepared.order_id,live_mode:mode.liveMode,replayed:true});
    }
    if(checked.complete){
      return json(res,200,{status:'contract_formed_payment_processing',checkout_url:null,
        attempt_id:prepared.payment_attempt_id,order_id:prepared.order_id,live_mode:mode.liveMode,
        replayed:true,contract_formed:true,payment_retry_required:false});
    }
    if(checked.expired){
      return json(res,200,{status:'contract_formed_payment_retry_required',checkout_url:null,
        attempt_id:prepared.payment_attempt_id,order_id:prepared.order_id,live_mode:mode.liveMode,
        replayed:true,contract_formed:true,payment_retry_required:true});
    }
    if(!checked.url){
      return json(res,503,{error:'fixed_checkout_payment_recovery_unknown',retryable:true,contract_formed:true,
        attempt_id:prepared.payment_attempt_id,order_id:prepared.order_id,live_mode:mode.liveMode,replayed:true});
    }
    return json(res,200,{
      status:mode.liveMode?'live_checkout_created':'sandbox_checkout_created',
      checkout_url:checked.url,attempt_id:prepared.payment_attempt_id,
      order_id:prepared.order_id,live_mode:mode.liveMode,replayed:true,contract_formed:true
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

  let session;
  try{
    session=await stripeRequest('checkout/sessions',{
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
  }catch(error){
    throw new Error('fixed_checkout_outcome_unknown');
  }

  let checked;
  try{checked=fixedSession(session,prepared,mode.liveMode)}
  catch(error){throw new Error('fixed_checkout_outcome_unknown')}
  if(checked.expired||checked.complete||!checked.url)throw new Error('fixed_checkout_outcome_unknown');

  const acceptBody={
    p_offer_id:prepared.offer_id,p_attempt_id:prepared.payment_attempt_id,p_session_id:session.id,
    p_payment_requested_at:new Date(checked.created*1000).toISOString(),p_live_mode:mode.liveMode
  };

  let accepted;
  try{
    accepted=await rpc('accept_fixed_price_market_offer_v1',acceptBody);
  }catch(firstError){
    let state=null;
    try{state=fixedPrepared(await rpc('prepare_fixed_price_market_offer_v1',prepareBody,accessToken),mode.liveMode)}catch(_){}
    if(state?.accepted===true&&state.stripe_checkout_session_id===session.id){
      accepted={order_id:state.order_id,replayed:true};
    }else if(samePrepared(prepared,state)){
      try{
        accepted=await rpc('accept_fixed_price_market_offer_v1',acceptBody);
      }catch(secondError){
        let finalState=null;
        try{finalState=fixedPrepared(await rpc('prepare_fixed_price_market_offer_v1',prepareBody,accessToken),mode.liveMode)}catch(_){}
        if(finalState?.accepted===true&&finalState.stripe_checkout_session_id===session.id){
          accepted={order_id:finalState.order_id,replayed:true};
        }else{
          throw new Error('fixed_checkout_outcome_unknown');
        }
      }
    }else{
      throw new Error('fixed_checkout_outcome_unknown');
    }
  }

  return json(res,200,{
    status:mode.liveMode?'live_checkout_created':'sandbox_checkout_created',
    checkout_url:checked.url,attempt_id:prepared.payment_attempt_id,order_id:accepted?.order_id||null,
    live_mode:mode.liveMode,replayed:accepted?.replayed===true,contract_formed:true
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
  const offProbe=req.method==='GET'&&String(req.query?.off_probe||'')==='1';
  if(offProbe){
    if(process.env.VERCEL_ENV!=='preview')return json(res,404,{error:'not_found'});
    try{
      stripeMode('payments');
      return json(res,409,{status:'fail',error:'stripe_mode_enabled',provider_call_possible:false});
    }catch(error){
      const code=String(error.message||error);
      const pass=code==='stripe_sandbox_disabled';
      return json(res,pass?200:409,{status:pass?'pass':'fail',error:code,provider_call_possible:false});
    }
  }
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  let mode;try{mode=stripeMode('payments')}catch(error){const code=String(error.message||error);return json(res,code==='stripe_sandbox_disabled'?409:503,{error:code})}
  const user=await authenticatedUser(req);if(!user)return json(res,401,{error:'authentication_required'});
  const header=String(req.headers.authorization||''),accessToken=header.startsWith('Bearer ')?header.slice(7):'';
  try{
    if(req.body?.listing_id)return await fixedPriceCheckout(req,res,mode,user,accessToken);
    return await existingOrderCheckout(req,res,mode,user);
  }catch(error){
    const code=String(error.message||error).slice(0,180);
    if(code==='fixed_checkout_outcome_unknown')return json(res,503,{error:code,retryable:true,contract_formed:false});
    return json(res,409,{error:code});
  }
};
