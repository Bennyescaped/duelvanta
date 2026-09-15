/* B07 / L07-01 Release-1 eligibility gate. No payment or legal-terms activation. */
(() => {
  'use strict';
  let installed=false,busy=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function install(){
    if(installed||typeof db==='undefined'||typeof user==='undefined'||!user)return false;
    installed=true;
    const cover=document.createElement('div');
    cover.id='dvB07EligibilityCover';
    cover.setAttribute('aria-live','polite');
    cover.style.cssText='position:fixed;inset:0;z-index:9997;background:#07090dcc;backdrop-filter:blur(3px);display:grid;place-items:center;color:#c8cdd5;font:12px system-ui';
    cover.textContent='TRADE-Berechtigung wird geprüft …';
    document.body.appendChild(cover);
    check(cover);
    return true;
  }
  async function check(cover){
    const {data,error}=await db.rpc('get_my_market_trade_eligibility');
    if(error){
      cover.remove();
      if(/Could not find the function|schema cache/i.test(error.message||'')){
        console.warn('B07 eligibility migration not applied in this environment; gate remains inactive.');
        window.DV_B07_ELIGIBILITY={version:'1.0',available:false};
        return;
      }
      showFailure(cover,error.message||'Berechtigung konnte nicht geprüft werden.');
      return;
    }
    if(data?.buyer_eligible){cover.remove();window.DV_B07_ELIGIBILITY={version:'1.0',available:true,eligible:true};return}
    showForm(cover,data||{});
  }
  function showFailure(cover,text){
    cover.innerHTML=`<div style="max-width:520px;margin:20px;padding:22px;border:1px solid #3a404a;border-radius:14px;background:#0b0f14"><b style="color:#efd18c">TRADE NICHT VERFÜGBAR</b><p>${esc(text)}</p></div>`;
  }
  function showForm(cover,state){
    const today=new Date(),adult=new Date(Date.UTC(today.getUTCFullYear()-18,today.getUTCMonth(),today.getUTCDate())).toISOString().slice(0,10);
    cover.innerHTML=`<div style="width:min(560px,calc(100vw - 32px));box-sizing:border-box;padding:22px;border:1px solid #3a404a;border-radius:14px;background:#0b0f14"><div style="font-size:10px;letter-spacing:.12em;color:#c7a45d">TRADE · RELEASE 1</div><h2 style="margin:8px 0;color:#f1ece4">Berechtigung bestätigen</h2><p style="line-height:1.6">TRADE ist in Release 1 nur für registrierte Nutzer ab 18 Jahren mit Wohnsitz in Deutschland verfügbar. Käufe sind ausschließlich als private Verbraucher vorgesehen.</p><label style="display:block;margin:14px 0 5px">Geburtsdatum</label><input id="dvB07Dob" type="date" max="${adult}" autocomplete="bday" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #333a44;border-radius:8px;background:#080b10;color:#eee"><label style="display:flex;gap:9px;align-items:flex-start;margin:15px 0;line-height:1.5"><input id="dvB07PrivateBuyer" type="checkbox" style="margin-top:3px"><span>Ich bestätige, dass ich bei Käufen über TRADE als private Person und Verbraucher handle.</span></label><div style="padding:10px;border:1px solid #2d333c;border-radius:9px;color:#9da5b0">Wohnsitz/Liefermarkt Release 1: <b style="color:#ddd">Deutschland</b></div><button id="dvB07Confirm" type="button" style="width:100%;margin-top:16px;padding:12px;border:1px solid #c7a45d;border-radius:9px;background:#c7a45d;color:#111;font-weight:700">BESTÄTIGEN</button><div id="dvB07Msg" style="min-height:18px;margin-top:10px;color:#d9a6a6"></div></div>`;
    document.getElementById('dvB07Confirm').onclick=()=>confirmEligibility(cover);
  }
  async function confirmEligibility(cover){
    if(busy)return;
    const dob=document.getElementById('dvB07Dob').value,privateBuyer=document.getElementById('dvB07PrivateBuyer').checked,msg=document.getElementById('dvB07Msg'),button=document.getElementById('dvB07Confirm');
    if(!dob){msg.textContent='Bitte Geburtsdatum angeben.';return}
    if(!privateBuyer){msg.textContent='Für Käufe muss die private Verbrauchereigenschaft bestätigt werden.';return}
    busy=true;button.disabled=true;msg.textContent='Wird geprüft …';
    const {data,error}=await db.rpc('confirm_my_market_trade_eligibility',{p_date_of_birth:dob,p_residence_country_code:'DE',p_confirm_private_buyer:true});
    busy=false;button.disabled=false;
    if(error){const text=error.message||'';msg.textContent=/trade_must_be_adult/.test(text)?'TRADE ist erst ab 18 Jahren verfügbar.':/germany_only/.test(text)?'TRADE Release 1 ist auf Deutschland begrenzt.':/private_consumer/.test(text)?'Die private Verbrauchereigenschaft muss bestätigt werden.':text;return}
    if(!data?.buyer_eligible){msg.textContent='Berechtigung konnte nicht bestätigt werden.';return}
    window.DV_B07_ELIGIBILITY={version:'1.0',available:true,eligible:true};cover.remove();
  }
  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>150)clearInterval(timer)},80);
})();
