'use strict';

const checkout=require('./market-stripe-checkout.js');

function json(res,status,body){return res.status(status).json(body)}

module.exports=async function handler(req,res){
  if(req.method!=='GET')return json(res,405,{error:'method_not_allowed'});
  if(process.env.VERCEL_ENV!=='preview')return json(res,404,{error:'not_found'});

  const captured={
    statusCode:200,
    body:null,
    status(code){this.statusCode=code;return this},
    json(body){this.body=body;return body}
  };

  try{
    await checkout({method:'POST',headers:{},body:{}},captured);
  }catch(error){
    return json(res,500,{status:'fail',error:'probe_exception',detail:String(error?.message||error).slice(0,120)});
  }

  const checkoutError=String(captured.body?.error||'');
  const pass=captured.statusCode===409&&checkoutError==='stripe_sandbox_disabled';

  return json(res,pass?200:409,{
    status:pass?'pass':'fail',
    proof:'market-stripe-checkout anonymous POST reached application',
    checkout_status:captured.statusCode,
    checkout_error:checkoutError||null,
    provider_call_possible:false
  });
};
