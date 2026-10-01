/* B07 / L07-01 Release-1 eligibility gate. No payment or legal-terms activation. */
(() => {
  'use strict';
  let installed=false,busy=false,state={available:false,eligible:false,buyerEligible:false},buyerPromise=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  function publish(){window.DV_B07_ELIGIBILITY={version:'1.1',available:state.available,eligible:state.eligible,buyerEligible:state.buyerEligible,ensureBuyer}}
  function apply(data){state={available:true,eligible:!!data?.eligible,buyerEligible:!!data?.buyer_eligible};publish()}
  function install(){
    if(installed||typeof db==='undefined'||typeof user==='undefined'||!user)return false;
    installed=true;publish();
    const cover=document.createElement('div');cover.id='dvB07EligibilityCover';cover.setAttribute('aria-live','polite');cover.style.cssText='position:fixed;inset:0;z-index:9997;background:#07090dcc;backdrop-filter:blur(3px);display:grid;place-items:center;color:#c8cdd5;font:12px system-ui';cover.textContent='TRADE-Berechtigung wird geprüft …';document.body.appendChild(cover);
    check(cover);
    document.addEventListener('click',interceptBuyerIntent,true);
    return true;
  }
  async function check(cover){
    const {data,error}=await db.rpc('get_my_market_trade_eligibility');
    if(error){
      cover.remove();
      if(/Could not find the function|schema cache/i.test(error.message||'')){console.warn('B07 eligibility migration not applied in this environment; gate remains inactive.');state={available:false,eligible:false,buyerEligible:false};publish();return}
      showFailure(cover,error.message||'Berechtigung konnte nicht geprüft werden.');return;
    }
    apply(data||{});
    if(state.eligible){cover.remove();return}
    showForm(cover);
  }
  function showFailure(cover,text){cover.innerHTML=`<div style="max-width:520px;margin:20px;padding:22px;border:1px solid #3a404a;border-radius:14px;background:#0b0f14"><b style="color:#efd18c">TRADE NICHT VERFÜGBAR</b><p>${esc(text)}</p></div>`}
  function showForm(cover){
    const today=new Date(),adult=new Date(Date.UTC(today.getUTCFullYear()-18,today.getUTCMonth(),today.getUTCDate())).toISOString().slice(0,10);
    cover.innerHTML=`<div style="width:min(560px,calc(100vw - 32px));box-sizing:border-box;padding:22px;border:1px solid #3a404a;border-radius:14px;background:#0b0f14"><div style="font-size:10px;letter-spacing:.12em;color:#c7a45d">TRADE · RELEASE 1</div><h2 style="margin:8px 0;color:#f1ece4">Berechtigung bestätigen</h2><p style="line-height:1.6">TRADE ist in Release 1 nur für registrierte Nutzer ab 18 Jahren mit Wohnsitz in Deutschland verfügbar.</p><label style="display:block;margin:14px 0 5px">Geburtsdatum</label><input id="dvB07Dob" type="date" max="${adult}" autocomplete="bday" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #333a44;border-radius:8px;background:#080b10;color:#eee"><div style="padding:10px;margin-top:14px;border:1px solid #2d333c;border-radius:9px;color:#9da5b0">Wohnsitz/Liefermarkt Release 1: <b style="color:#ddd">Deutschland</b></div><label style="display:flex;gap:9px;align-items:flex-start;margin:15px 0;line-height:1.5"><input id="dvB07PrivateBuyer" type="checkbox" style="margin-top:3px"><span>Optional jetzt bestätigen: Wenn ich über TRADE kaufe, handle ich als private Person und Verbraucher. Für reines Verkaufen ist diese Käufererklärung nicht erforderlich.</span></label><button id="dvB07Confirm" type="button" style="width:100%;margin-top:6px;padding:12px;border:1px solid #c7a45d;border-radius:9px;background:#c7a45d;color:#111;font-weight:700">TRADE FREISCHALTEN</button><div id="dvB07Msg" style="min-height:18px;margin-top:10px;color:#d9a6a6"></div></div>`;
    document.getElementById('dvB07Confirm').onclick=()=>confirmEligibility(cover);
  }
  async function confirmEligibility(cover){
    if(busy)return;const dob=document.getElementById('dvB07Dob').value,buyer=document.getElementById('dvB07PrivateBuyer').checked,msg=document.getElementById('dvB07Msg'),button=document.getElementById('dvB07Confirm');
    if(!dob){msg.textContent='Bitte Geburtsdatum angeben.';return}
    busy=true;button.disabled=true;msg.textContent='Wird geprüft …';
    const {data,error}=await db.rpc('confirm_my_market_trade_eligibility',{p_date_of_birth:dob,p_residence_country_code:'DE',p_confirm_private_buyer:buyer});busy=false;button.disabled=false;
    if(error){const text=error.message||'';msg.textContent=/trade_must_be_adult/.test(text)?'TRADE ist erst ab 18 Jahren verfügbar.':/germany_only/.test(text)?'TRADE Release 1 ist auf Deutschland begrenzt.':text;return}
    apply(data||{});if(!state.eligible){msg.textContent='Berechtigung konnte nicht bestätigt werden.';return}cover.remove();
  }
  async function refresh(){if(!state.available)return state;const {data,error}=await db.rpc('get_my_market_trade_eligibility');if(!error)apply(data||{});return state}
  async function ensureBuyer(){
    await refresh();if(!state.available)return true;if(state.buyerEligible)return true;if(buyerPromise)return buyerPromise;
    buyerPromise=new Promise(resolve=>{
      let dialog=document.getElementById('dvB07BuyerDialog');if(dialog)dialog.remove();dialog=document.createElement('dialog');dialog.id='dvB07BuyerDialog';dialog.style.cssText='max-width:520px;width:calc(100% - 32px);border:1px solid #3a404a;border-radius:14px;background:#0b0f14;color:#dfe3e8;padding:0';dialog.innerHTML='<div style="padding:22px;font:12px system-ui;line-height:1.6"><div style="font-size:10px;letter-spacing:.12em;color:#c7a45d">KAUF · RELEASE 1</div><h2 style="color:#f1ece4">Private Käufereigenschaft bestätigen</h2><p>Käufe über TRADE sind in Release 1 ausschließlich für private Verbraucher vorgesehen.</p><label style="display:flex;gap:9px;align-items:flex-start"><input id="dvB07BuyerCheck" type="checkbox" style="margin-top:4px"><span>Ich bestätige, dass ich bei diesem und weiteren Käufen über TRADE als private Person und Verbraucher handle.</span></label><div style="display:flex;gap:9px;margin-top:18px"><button id="dvB07BuyerCancel" type="button" style="flex:1;padding:11px;border:1px solid #3a404a;border-radius:8px;background:#11161d;color:#ddd">ABBRECHEN</button><button id="dvB07BuyerConfirm" type="button" style="flex:1;padding:11px;border:1px solid #c7a45d;border-radius:8px;background:#c7a45d;color:#111;font-weight:700">BESTÄTIGEN</button></div><div id="dvB07BuyerMsg" style="min-height:18px;margin-top:10px;color:#d9a6a6"></div></div>';document.body.appendChild(dialog);
      const finish=value=>{dialog.close();dialog.remove();buyerPromise=null;resolve(value)};document.getElementById('dvB07BuyerCancel').onclick=()=>finish(false);document.getElementById('dvB07BuyerConfirm').onclick=async()=>{const check=document.getElementById('dvB07BuyerCheck'),msg=document.getElementById('dvB07BuyerMsg'),button=document.getElementById('dvB07BuyerConfirm');if(!check.checked){msg.textContent='Bitte die private Käufereigenschaft aktiv bestätigen.';return}button.disabled=true;const {data,error}=await db.rpc('confirm_my_market_private_buyer');button.disabled=false;if(error){msg.textContent=error.message||'Bestätigung fehlgeschlagen.';return}apply(data||{});finish(state.buyerEligible)};dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false)});dialog.showModal();
    });return buyerPromise;
  }
  async function interceptBuyerIntent(event){
    if(!state.available||state.buyerEligible)return;const target=event.target.closest?.('[data-offer],[data-checkout-offer],#sendOffer');if(!target)return;event.preventDefault();event.stopImmediatePropagation();const ok=await ensureBuyer();if(ok)setTimeout(()=>target.click(),0);
  }
  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>150)clearInterval(timer)},80);
})();
