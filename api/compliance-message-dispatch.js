'use strict';

const json=(res,status,body)=>res.status(status).json(body);
const required=name=>{const value=process.env[name];if(!value)throw new Error(`missing_${name.toLowerCase()}`);return value};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const PRODUCTION_URL='https://enifiaqsnqtbzylnfrpi.supabase.co';
const PRODUCTION_KEY='sb_publishable_pk2szDe_g7fJLUdAMEUevw_odrDmnuM';
const STAGING_URL='https://xhmjxrcskfhbovhitdej.supabase.co';
const STAGING_KEY='sb_publishable_KNlm6LzvSxCaGwLc_1mPbA_-z1we46N';

function runtimeConfig(res){
  const environment=process.env.VERCEL_ENV||'development',production=environment==='production';
  const url=production?PRODUCTION_URL:(environment==='preview'?(process.env.SUPABASE_URL||STAGING_URL):process.env.SUPABASE_URL);
  const key=production?PRODUCTION_KEY:(environment==='preview'?(process.env.SUPABASE_PUBLISHABLE_KEY||STAGING_KEY):process.env.SUPABASE_PUBLISHABLE_KEY);
  res.setHeader('Content-Type','application/javascript; charset=utf-8');
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!url||!key||(!production&&url.includes('enifiaqsnqtbzylnfrpi'))||(environment==='preview'&&url!==STAGING_URL)){
    return res.status(503).send("window.DV_SUPABASE=null;throw new Error('DUELVANTA preview database is not safely configured');");
  }
  return res.status(200).send(`window.DV_SUPABASE=Object.freeze(${JSON.stringify({url,key,environment})});`);
}

function renderMessage(row){
  const p=row.payload||{};
  if(row.message_kind==='order_confirmation')return {
    subject:`DUELVANTA Bestellbestätigung ${p.order_number||''}`.trim(),
    text:row.confirmation_text||'Die Bestellbestätigung konnte nicht gerendert werden.'
  };
  const reference=p.case_reference||'DUELVANTA Meldung';
  if(row.message_kind==='notice_received')return {subject:`DUELVANTA · Meldung ${reference} eingegangen`,text:`Deine Meldung ${reference} ist eingegangen. Bewahre den bei der Einreichung einmalig angezeigten Zugangscode sicher auf.`};
  if(row.message_kind==='notice_decided')return {subject:`DUELVANTA · Entscheidung zu ${reference}`,text:`Entscheidung: ${p.action||'—'}\nBegründung: ${p.reason||'—'}\nRechtsbehelf: ${p.redress||'—'}`};
  if(row.message_kind==='seller_statement_of_reasons')return {subject:`DUELVANTA · Begründung zu ${reference}`,text:`Maßnahme: ${p.action||'—'}\nTatsachen: ${p.facts||'—'}\nGrundlage: ${p.basis_kind||'—'} ${p.reference||''}\nUmfang: ${p.scope||'—'}\nDauer: ${p.duration||'—'}\nAutomatisierte Mittel: ${p.automated_means_used?'Ja':'Nein'}\nRechtsbehelf: ${p.redress||'—'}`};
  if(row.message_kind==='appeal_received')return {subject:`DUELVANTA · Einspruch zu ${reference} eingegangen`,text:`Der Einspruch zu ${reference} ist eingegangen und wird menschlich geprüft.`};
  if(row.message_kind==='appeal_decided')return {subject:`DUELVANTA · Einspruch zu ${reference} entschieden`,text:`Ergebnis: ${p.outcome||'—'}\nBegründung: ${p.reason||'—'}`};
  throw new Error('unsupported_message_kind');
}

async function supabaseRpc(base,key,name,body){
  const response=await fetch(`${base.replace(/\/$/,'')}/rest/v1/rpc/${name}`,{
    method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(body)
  });
  if(!response.ok)throw new Error(`database_${name}_${response.status}`);
  const text=await response.text();return text?JSON.parse(text):null;
}

async function sendEmail(row){
  const apiKey=required('RESEND_API_KEY'),from=required('COMPLIANCE_EMAIL_FROM');
  if(!row.recipient_email)throw new Error('missing_recipient_email');
  const message=renderMessage(row);
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json','idempotency-key':row.idempotency_key},
    body:JSON.stringify({from,to:[row.recipient_email],subject:message.subject,text:message.text,html:`<pre style="white-space:pre-wrap;font-family:Arial,sans-serif">${escapeHtml(message.text)}</pre>`})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`provider_${response.status}_${result.name||'send_failed'}`);
  return result.id||null;
}

module.exports=async function handler(req,res){
  if(req.method==='GET'&&String(req.query?.runtime_config||'')==='1')return runtimeConfig(res);
  if(req.method!=='POST')return json(res,405,{error:'method_not_allowed'});
  if(process.env.COMPLIANCE_EMAIL_DELIVERY_ENABLED!=='true')return json(res,200,{status:'disabled',claimed:0,sent:0,failed:0});
  const secret=required('COMPLIANCE_DISPATCH_SECRET');
  if(req.headers.authorization!==`Bearer ${secret}`)return json(res,401,{error:'unauthorized'});
  const base=required('SUPABASE_URL'),key=required('SUPABASE_SERVICE_ROLE_KEY'),lock=crypto.randomUUID();
  const rows=await supabaseRpc(base,key,'claim_marketplace_message_delivery',{p_limit:10,p_lock_token:lock});
  let sent=0,failed=0;
  for(const row of rows||[]){
    try{
      const providerId=await sendEmail(row);
      await supabaseRpc(base,key,'finish_marketplace_message_delivery',{p_message_id:row.message_id,p_lock_token:row.delivery_lock_token,p_success:true,p_provider_message_id:providerId,p_error:null});
      sent++;
    }catch(error){
      await supabaseRpc(base,key,'finish_marketplace_message_delivery',{p_message_id:row.message_id,p_lock_token:row.delivery_lock_token,p_success:false,p_provider_message_id:null,p_error:String(error.message||error).slice(0,500)});
      failed++;
    }
  }
  return json(res,200,{status:'processed',claimed:(rows||[]).length,sent,failed});
};

module.exports.renderMessage=renderMessage;
