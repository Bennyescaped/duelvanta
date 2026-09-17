'use strict';

const tracking=require('../market-tracking-aftership.js');
const json=(res,status,body)=>res.status(status).json(body);
const required=name=>{const value=process.env[name];if(!value)throw new Error(`missing_${name.toLowerCase()}`);return value};
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const PRODUCTION_URL='https://enifiaqsnqtbzylnfrpi.supabase.co';
const PRODUCTION_KEY='sb_publishable_pk2szDe_g7fJLUdAMEUevw_odrDmnuM';
const STAGING_URL='https://xhmjxrcskfhbovhitdej.supabase.co';
const STAGING_KEY='sb_publishable_KNlm6LzvSxCaGwLc_1mPbA_-z1we46N';
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function databaseConfig(){
  const environment=process.env.VERCEL_ENV||'development',production=environment==='production';
  const url=production?PRODUCTION_URL:(environment==='preview'?(process.env.SUPABASE_URL||STAGING_URL):process.env.SUPABASE_URL);
  const key=production?PRODUCTION_KEY:(environment==='preview'?(process.env.SUPABASE_PUBLISHABLE_KEY||STAGING_KEY):process.env.SUPABASE_PUBLISHABLE_KEY);
  if(!url||!key||(!production&&url.includes('enifiaqsnqtbzylnfrpi'))||(environment==='preview'&&url!==STAGING_URL))return null;
  return {url,key,environment};
}

function runtimeConfig(res){
  const config=databaseConfig();
  res.setHeader('Content-Type','application/javascript; charset=utf-8');
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!config)return res.status(503).send("window.DV_SUPABASE=null;throw new Error('DUELVANTA preview database is not safely configured');");
  return res.status(200).send(`window.DV_SUPABASE=Object.freeze(${JSON.stringify(config)});`);
}

function requestOrigin(req){
  const raw=String(req.headers?.['x-forwarded-host']||req.headers?.host||process.env.VERCEL_URL||'').toLowerCase();
  const host=/^[a-z0-9.-]+(?::\d{1,5})?$/.test(raw)?raw:null;
  if(!host)return 'https://duelvanta.de';
  const proto=host.includes('localhost')||host.startsWith('127.')?'http':'https';
  return `${proto}://${host}`;
}

async function publicRpc(base,key,name,body){
  const response=await fetch(`${base.replace(/\/$/,'')}/rest/v1/rpc/${name}`,{
    method:'POST',headers:{apikey:key,'content-type':'application/json'},body:JSON.stringify(body)
  });
  if(response.status===404)return null;
  if(!response.ok)throw new Error(`database_${name}_${response.status}`);
  const data=await response.json().catch(()=>null);return Array.isArray(data)?(data[0]||null):data;
}

async function publicListingImage(base,serviceKey,listingId){
  if(!serviceKey)return null;
  const response=await fetch(`${base.replace(/\/$/,'')}/rest/v1/market_listings?select=image_path&id=eq.${encodeURIComponent(listingId)}&status=eq.active&limit=1`,{
    headers:{apikey:serviceKey,authorization:`Bearer ${serviceKey}`}
  });
  if(!response.ok)return null;
  const rows=await response.json().catch(()=>[]),path=rows?.[0]?.image_path;
  if(!path||typeof path!=='string')return null;
  const encoded=path.split('/').map(encodeURIComponent).join('/');
  const signed=await fetch(`${base.replace(/\/$/,'')}/storage/v1/object/sign/collection-cards/${encoded}`,{
    method:'POST',headers:{apikey:serviceKey,authorization:`Bearer ${serviceKey}`,'content-type':'application/json'},body:JSON.stringify({expiresIn:3600})
  });
  if(!signed.ok)return null;
  const data=await signed.json().catch(()=>null),value=data?.signedURL||data?.signedUrl;
  if(!value)return null;
  return /^https:\/\//i.test(value)?value:`${base.replace(/\/$/,'')}${value.startsWith('/')?'':'/'}${value}`;
}

function listingDescription(listing){
  const parts=[listing.tcg==='pokemon'?'Pokémon':listing.tcg==='one_piece'?'One Piece':listing.tcg,listing.set_name,listing.card_number,listing.language].filter(Boolean);
  const price=listing.asking_price!=null?`${Number(listing.asking_price).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})} €`:'Tausch';
  return `${parts.join(' · ')}${parts.length?' · ':''}${price} auf DUELVANTA`;
}

async function renderPublicListing(req,res){
  const listingId=String(req.query?.public_listing||'').trim();
  if(!UUID_RE.test(listingId))return res.status(400).send('Ungültige Angebots-ID');
  const config=databaseConfig();if(!config)return res.status(503).send('Öffentliche Vorschau derzeit nicht verfügbar');
  if(config.environment==='production'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');
    res.setHeader('X-Content-Type-Options','nosniff');
    return res.status(423).send('<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>DUELVANTA · TRADE</title><style>html{color-scheme:dark}body{margin:0;background:#07090d;color:#f2eee7;font:16px system-ui;min-height:100vh;display:grid;place-items:center;text-align:center}.box{max-width:680px;padding:32px}.tag{color:#c7a45d;letter-spacing:.18em;font-size:12px;font-weight:800}h1{font:400 clamp(42px,8vw,72px) Georgia,serif;margin:12px 0}p{color:#aeb4bf;line-height:1.6}</style></head><body><main class="box"><div class="tag">DUELVANTA · TRADE · BETA</div><h1>COMING SOON 2027</h1><p>Der Marktplatz wird noch vorbereitet. Öffentliche Angebote sind während der Beta noch nicht freigeschaltet.</p></main></body></html>');
  }
  let listing;
  try{listing=await publicRpc(config.url,config.key,'get_public_market_listing_v1',{p_listing_id:listingId})}catch(error){console.warn('public listing read',error);return res.status(503).send('Öffentliche Vorschau derzeit nicht verfügbar')}
  if(!listing)return res.status(404).send('Angebot nicht verfügbar');
  const origin=requestOrigin(req),canonical=`${origin}/listing/${listingId}`;
  let image=`${origin}/v-logo.svg`;
  try{image=await publicListingImage(config.url,process.env.SUPABASE_SERVICE_ROLE_KEY,listingId)||image}catch(error){console.warn('public listing image',error)}
  const title=`${listing.card_name||'TCG-Angebot'} · DUELVANTA`,description=listingDescription(listing);
  const priceMeta=listing.asking_price!=null?`<meta property="product:price:amount" content="${escapeHtml(Number(listing.asking_price).toFixed(2))}"><meta property="product:price:currency" content="EUR">`:'';
  const bodyPrice=listing.asking_price!=null?`${Number(listing.asking_price).toLocaleString('de-DE',{style:'currency',currency:'EUR'})}`:'TAUSCH';
  const details=[listing.set_name,listing.card_number,listing.language,listing.condition,listing.grading_company&&listing.grade!=null?`${listing.grading_company} ${listing.grade}`:null].filter(Boolean).map(escapeHtml).join(' · ');
  const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>${escapeHtml(title)}</title><link rel="canonical" href="${escapeHtml(canonical)}"><meta name="description" content="${escapeHtml(description)}"><meta property="og:type" content="product"><meta property="og:site_name" content="DUELVANTA"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}">${priceMeta}<style>html{color-scheme:dark}body{margin:0;background:#07090d;color:#f2eee7;font:16px system-ui;min-height:100vh;display:grid;place-items:center}.card{width:min(520px,calc(100vw - 32px));border:1px solid #343943;border-radius:20px;background:#0e1218;overflow:hidden}.media{aspect-ratio:4/3;background:#090c11;display:grid;place-items:center}.media img{width:100%;height:100%;object-fit:contain}.body{padding:22px}.brand{font-size:11px;letter-spacing:.18em;color:#c7a45d}.body h1{font:400 30px Georgia,serif;margin:8px 0}.meta{color:#9ea6b0;line-height:1.6}.price{font:400 28px Georgia,serif;margin:18px 0;color:#efd18c}.cta{display:block;text-align:center;padding:13px;border-radius:10px;background:#c7a45d;color:#111;text-decoration:none;font-weight:800}</style></head><body><main class="card"><div class="media"><img src="${escapeHtml(image)}" alt="${escapeHtml(listing.card_name||'TCG-Angebot')}"></div><div class="body"><div class="brand">DUELVANTA · TRADE</div><h1>${escapeHtml(listing.card_name||'TCG-Angebot')}</h1><div class="meta">${details||'Trading Card Game'}</div><div class="price">${escapeHtml(bodyPrice)}</div><a class="cta" href="/trade.html">AUF DUELVANTA ANSEHEN</a></div></main></body></html>`;
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  return res.status(200).send(html);
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
  if(req.method==='GET'&&req.query?.public_listing)return renderPublicListing(req,res);
  if(req.method==='POST'&&String(req.query?.tracking_register||'')==='1')return tracking.handleRegister(req,res);
  if(req.method==='POST'&&String(req.query?.aftership_webhook||'')==='1')return tracking.handleWebhook(req,res);
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
module.exports.renderPublicListing=renderPublicListing;
