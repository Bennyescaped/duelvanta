/* Staging-only observation surface. Backend guards, grants and policies remain
   authoritative. No token/seed access, caller impersonation or session fabrication.
   The client does not auto-refresh: a revoked session can be checked while its
   original SDK state remains in this page. Never label mocked tests as live MFA. */
(()=>{'use strict';
const $=id=>document.getElementById(id),config=window.DV_SUPABASE;
if(config?.environment!=='preview'||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url||'')||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.key||'')){
  $('state').textContent='GESPERRT: Nur DUELVANTA-STAGING Preview ist zugelassen.';return;
}
const db=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
$('links').hidden=false;$('run').disabled=false;$('logout').disabled=false;
$('state').textContent='Staging bestätigt. AAL1 wird bewusst nicht im Browser vorab abgefangen; das Backend muss ablehnen.';
const safeMessages=new Set(['mfa_step_up_required','privileged_session_required','human_session_required','not_authenticated','owner_access_required','battle_moderate permission required','Owner approval required during beta','Application unavailable','Match not found','owner_mfa_session_required','invalid_email','Invalid JWT']);
const cleanError=e=>({code:/^[A-Z0-9_]{1,24}$/.test(e?.code||'')?e.code:null,reason:safeMessages.has(e?.message)?e.message:'backend_error_redacted'});
const rows=[];const render=()=>{$('results').textContent=JSON.stringify({environment:config.environment,supabase_url:config.url,source:'real_browser_sdk',at:new Date().toISOString(),results:rows},null,2)};
async function rpc(name,args={},schema='public'){
  const result=await db.schema(schema).rpc(name,args);
  const row={test:schema+'.'+name,http:result.status,ok:!result.error};
  if(result.error)Object.assign(row,cleanError(result.error));
  else if(name==='get_my_privileged_access_v1')row.access={owner:result.data?.owner===true,privileged:result.data?.privileged===true};
  else if(name.includes('schema_readiness'))row.readiness={compatible:result.data?.compatible===true,revision:result.data?.revision};
  rows.push(row);render();
}
$('run').onclick=async()=>{
  $('run').disabled=true;rows.length=0;render();
  try{
    // These RPCs are reads, except the two NULL-target probes which always raise
    // before mutation. NULL cannot match a primary key. No arbitrary RPC editor.
    for(const [name,args] of [
      ['get_my_privileged_access_v1',{}],['get_security_schema_readiness_v1',{}],['get_market_legal_schema_readiness_v1',{}],
      ['dv_v16_owner_openai_scan_settings',{}],['get_battle_disputes_for_moderation',{}],
      ['get_owner_marketplace_notices',{p_status:null}],['get_owner_market_seller_reviews',{p_status:'pending_review'}],
      ['get_owner_market_delivery_reviews_b07',{p_status:null}],
      ['review_staff_application',{p_application_id:null,p_decision:'question',p_note:null}],
      ['join_battle_as_moderator',{p_match_id:null}],
      ['dv_core_set_staff_role',{p_user_id:null,p_role:'admin',p_reason:null}],
      ['dv_core_join_battle_as_moderator',{p_match_id:null}]
    ])await rpc(name,args);
    for(const [schema,table] of [
      ['dv_v16_private','operator_identity_v1'],['dv_market_private','market_pickup_handovers'],
      ['dv_market_private','trade_user_eligibility'],['auth','sessions'],['auth','mfa_factors']
    ]){const r=await db.schema(schema).from(table).select('id',{head:true,count:'exact'}).limit(0);rows.push({test:schema+'.'+table,http:r.status,ok:!r.error,...(r.error?cleanError(r.error):{})});render()}
    for(const name of ['owner-invite-beta-user','invite-beta-user']){
      // Empty address cannot cause a delivery, even for the true AAL2 Owner.
      const r=await db.functions.invoke(name,{body:{email:''}});
      const response=r.error?.context;let body=r.data;
      if(response?.json)try{body=await response.json()}catch{}
      rows.push({test:name,http:response?.status??(r.error?null:200),ok:!r.error,reason:safeMessages.has(body?.error)?body.error:'backend_response_redacted'});render();
    }
    $('state').textContent='Prüflauf abgeschlossen. Ergebnisse sind Beobachtungen, kein pauschales PASS.';
  }catch{rows.push({test:'transport',ok:false,reason:'unexpected_error_redacted'});render();$('state').textContent='Prüflauf unvollständig.'}
  finally{$('run').disabled=false}
};
$('logout').onclick=async()=>{const {error}=await db.auth.signOut();$('state').textContent=error?'Abmeldung fehlgeschlagen.':'Regulär abgemeldet.'};
})();
