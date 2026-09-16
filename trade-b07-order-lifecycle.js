/* B07 / L07-01 Release-1 order lifecycle UI. No payout/refund execution. */
(() => {
  'use strict';
  let installed=false,busy=false,reloadTimer=null,statuses=new Map();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=d=>d?new Date(d).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';

  async function load(){
    if(busy)return;
    busy=true;
    try{
      const {data,error}=await db.rpc('get_my_market_order_b07_status');
      if(error){
        if(!/Could not find the function|schema cache/i.test(error.message||''))console.warn('B07 order lifecycle',error);
        return;
      }
      statuses=new Map((data||[]).map(x=>[x.order_id,x]));
      decorate();
    } finally { busy=false; }
  }

  function completionLabel(reason){
    if(reason==='buyer_received_ok')return 'Käufer hat Erhalt bestätigt';
    if(reason==='pickup_bilateral_handover')return 'Übergabecode bestätigt';
    if(reason==='carrier_delivery_72h_elapsed')return '72 h nach verifizierter Zustellung';
    if(reason==='untracked_shipping_40d_elapsed')return '40 Tage nach ungetracktem Versand';
    return reason||'';
  }

  function note(s){
    const bits=[];
    if(s.fulfillment_group==='shipping'){
      bits.push(s.tracking_required?'TRACKING VERPFLICHTEND · Warenwert über 25 € oder Risikoregel':'Bis einschließlich 25 € ist ungetrackter Versand zulässig; Tracking bleibt wählbar.');
      if(s.shipping_due_at)bits.push(`Versandfrist: ${fmt(s.shipping_due_at)}`);
      if(s.has_tracking){
        if(s.delivery_evidence_at){
          bits.push(`Zustellung verifiziert: ${fmt(s.delivery_evidence_at)}${s.closure_eligible_at?` · technischer Abschluss ohne offenen Problemfall ab ${fmt(s.closure_eligible_at)}`:''}`);
        } else if(s.delivery_review_status==='pending'){
          bits.push('Zustellprüfung durch DUELVANTA angefordert · bis zur Verifizierung startet keine 72-Stunden-Frist.');
        } else if(s.delivery_review_status==='rejected'){
          bits.push('Letzte Zustellprüfung wurde nicht bestätigt · es läuft keine 72-Stunden-Frist.');
        } else {
          bits.push('Tracking vorhanden · bei ausbleibender Käuferreaktion kann der Verkäufer eine Zustellprüfung anfordern.');
        }
      } else {
        if(s.not_received_available_at)bits.push(`Ungetrackt · „Nicht erhalten“ kann ab ${fmt(s.not_received_available_at)} gemeldet werden.`);
        if(s.untracked_auto_close_at)bits.push(`Ohne offenen Problemfall technischer Autoabschluss nach 40 Tagen: ${fmt(s.untracked_auto_close_at)}.`);
      }
    } else if(s.pickup_code_pending) {
      bits.push(`Übergabecode aktiv bis ${fmt(s.pickup_code_expires_at)} · Käufer bestätigt mit dem einmaligen Code.`);
    }
    if(s.active_case_due_at)bits.push(`Offener Vorgang · aktuelle Antwort-/Nachweisfrist bis ${fmt(s.active_case_due_at)}`);
    if(s.technical_completed_at)bits.push(`Technisch abgeschlossen: ${fmt(s.technical_completed_at)} · ${esc(completionLabel(s.technical_completion_reason))}`);
    return bits.join('<br>');
  }

  function decorate(){
    document.querySelectorAll('.dvOrderCard').forEach(card=>{
      const id=card.id?.replace(/^order-/,'');
      if(!id)return;
      const s=statuses.get(id);
      if(!s)return;
      const signature=[s.status,s.tracking_required,s.has_tracking,s.shipping_due_at||'',s.delivery_evidence_at||'',s.closure_eligible_at||'',s.delivery_review_status||'',s.delivery_review_requested_at||'',s.not_received_available_at||'',s.untracked_auto_close_at||'',s.pickup_code_pending,s.pickup_code_expires_at||'',s.active_case_due_at||'',s.technical_completed_at||'',s.technical_completion_reason||''].join('|');
      let box=card.querySelector('.dvB07Lifecycle');
      if(!box){
        box=document.createElement('div');
        box.className='dvB07Lifecycle';
        const actions=card.querySelector('.dvOrderActions');
        (actions||card).insertAdjacentElement(actions?'beforebegin':'beforeend',box);
      }
      if(box.dataset.signature!==signature){
        box.dataset.signature=signature;
        box.innerHTML=`<b>B07 · RELEASE-1-ABLAUF</b><br>${note(s)||'Technische Fristen starten erst mit dem jeweiligen bestätigten Ereignis.'}`;
      }
      const received=card.querySelector(`[data-o-received="${CSS.escape(id)}"]`);
      if(received&&received.textContent!=='ERHALTEN – ALLES IN ORDNUNG')received.textContent='ERHALTEN – ALLES IN ORDNUNG';
      const ship=card.querySelector(`[data-o-ship="${CSS.escape(id)}"]`);
      if(ship&&s.fulfillment_group==='pickup'){
        const label=s.pickup_code_pending?'NEUEN ÜBERGABECODE ERZEUGEN':'ÜBERGABECODE ERZEUGEN';
        if(ship.textContent!==label)ship.textContent=label;
      }
      let pickup=card.querySelector(`[data-b07-pickup-confirm="${CSS.escape(id)}"]`);
      if(s.fulfillment_group==='pickup'&&s.pickup_code_pending&&!pickup){
        pickup=document.createElement('button');
        pickup.type='button';pickup.className='btn gold';pickup.dataset.b07PickupConfirm=id;pickup.textContent='ÜBERGABECODE BESTÄTIGEN';
        card.querySelector('.dvOrderActions')?.appendChild(pickup);
      }
      if((!s.pickup_code_pending||s.fulfillment_group!=='pickup')&&pickup)pickup.remove();

      let review=card.querySelector(`[data-b07-delivery-review="${CSS.escape(id)}"]`);
      const reviewApplicable=s.fulfillment_group==='shipping'&&s.has_tracking&&s.is_seller&&['shipped','received'].includes(s.status)&&!s.delivery_evidence_at;
      if(reviewApplicable&&!review){
        review=document.createElement('button');review.type='button';review.className='btn ghost';review.dataset.b07DeliveryReview=id;
        card.querySelector('.dvOrderActions')?.appendChild(review);
      }
      if(reviewApplicable&&review){
        if(s.delivery_review_status==='pending'){review.textContent='ZUSTELLPRÜFUNG OFFEN';review.disabled=true}
        else{review.textContent=s.delivery_review_status==='rejected'?'ZUSTELLPRÜFUNG ERNEUT ANFORDERN':'ZUSTELLPRÜFUNG ANFORDERN';review.disabled=false}
      }
      if(!reviewApplicable&&review)review.remove();
    });
  }

  function dialog(){
    let d=document.getElementById('dvB07LifecycleDialog');
    if(d)return d;
    d=document.createElement('dialog');d.id='dvB07LifecycleDialog';
    d.innerHTML='<div class="modal" style="max-width:560px"><div class="modalHead"><h2 id="dvB07LifeTitle">B07</h2><button id="dvB07LifeClose" class="close" type="button">✕</button></div><div id="dvB07LifeBody"></div><div id="dvB07LifeMsg" class="msg"></div></div>';
    document.body.appendChild(d);document.getElementById('dvB07LifeClose').onclick=()=>d.close();return d;
  }

  async function sellerPickup(id){
    const d=dialog();document.getElementById('dvB07LifeTitle').textContent='Persönliche Übergabe';document.getElementById('dvB07LifeBody').innerHTML='<div class="msg">Einmaliger Übergabecode wird erzeugt …</div>';document.getElementById('dvB07LifeMsg').textContent='';d.showModal();
    const {data,error}=await db.rpc('create_market_pickup_handover_code_b07',{p_order_id:id});
    if(error){document.getElementById('dvB07LifeMsg').textContent=error.message;return}
    document.getElementById('dvB07LifeBody').innerHTML=`<div class="dvB07Code"><span>EINMALIGER ÜBERGABECODE</span><strong>${esc(data.handover_code)}</strong><small>Gültig bis ${fmt(data.expires_at)}. Zeige oder nenne diesen Code erst bei tatsächlicher Übergabe. Die Käuferbestätigung verbraucht ihn endgültig.</small></div>`;
    await load();
  }

  async function buyerPickup(id){
    const code=prompt('Einmaligen Übergabecode des Verkäufers eingeben:');if(!code)return;
    const {data,error}=await db.rpc('confirm_market_pickup_handover_b07',{p_order_id:id,p_code:code.trim()});
    if(error){alert(error.message);return}if(!data?.ok){alert('Übergabecode ist ungültig.');return}
    await load();window.DV_TRADE_ORDERS?.render(id);
  }

  async function requestDeliveryReview(id){
    if(!confirm('Zustellprüfung anfordern? DUELVANTA prüft die hinterlegte Trackingnummer. Die 72-Stunden-Frist startet erst nach bestätigter Zustellung.'))return;
    const {error}=await db.rpc('request_market_order_delivery_review_b07',{p_order_id:id});
    if(error){alert(error.message);return}
    await load();
  }

  function enforceDialogHints(target){
    const id=target.dataset.oShip||target.dataset.oQuote||target.dataset.oAddressEdit;const s=statuses.get(id);if(!s)return;
    setTimeout(()=>{
      const country=document.getElementById('oCountry');if(country){[...country.options].forEach(o=>{if(o.value!=='DE')o.remove()});country.value='DE'}
      if(target.dataset.oShip&&s.tracking_required){
        const tracking=document.getElementById('oTracking'),carrier=document.getElementById('oCarrier');
        if(tracking){tracking.previousElementSibling.textContent='Trackingnummer · erforderlich';tracking.required=true}
        if(carrier){carrier.previousElementSibling.textContent='Versanddienst · erforderlich';carrier.required=true}
        const msg=document.getElementById('dvODMsg');if(msg)msg.textContent='Über 25 € Warenwert ist nachverfolgbarer Versand technisch verpflichtend.';
      }
      if(target.dataset.oQuote&&s.tracking_required){
        const method=document.getElementById('oMethod');if(method){[...method.options].forEach(o=>{if(!['tracked_letter','parcel'].includes(o.value))o.remove()});if(!['tracked_letter','parcel'].includes(method.value))method.value='tracked_letter'}
        const msg=document.getElementById('dvODMsg');if(msg)msg.textContent='Über 25 € Warenwert sind nur nachverfolgbare Versandarten zulässig.';
      }
    },0);
  }

  function mutationAddsOrderCard(mutation){return [...mutation.addedNodes].some(node=>node.nodeType===1&&(node.matches?.('.dvOrderCard')||node.querySelector?.('.dvOrderCard')))}
  function scheduleReload(){clearTimeout(reloadTimer);reloadTimer=setTimeout(load,120)}

  function install(){
    if(installed||typeof db==='undefined'||typeof user==='undefined'||!user)return false;installed=true;
    const style=document.createElement('style');style.id='dvB07LifecycleStyle';style.textContent='.dvB07Lifecycle{margin:11px 0;padding:10px 12px;border:1px solid rgba(199,164,93,.25);border-radius:10px;background:rgba(199,164,93,.04);color:#9ea6b0;font-size:10px;line-height:1.55}.dvB07Lifecycle b{color:#d8c28f;letter-spacing:.08em}.dvB07Code{padding:18px;border:1px solid #4a4230;border-radius:12px;text-align:center}.dvB07Code span,.dvB07Code small{display:block;color:#9ea6b0}.dvB07Code strong{display:block;margin:12px 0;font:600 28px monospace;letter-spacing:.14em;color:#efd18c}';document.head.appendChild(style);
    document.addEventListener('click',e=>{
      const review=e.target.closest?.('[data-b07-delivery-review]');if(review){e.preventDefault();e.stopImmediatePropagation();requestDeliveryReview(review.dataset.b07DeliveryReview);return}
      const pickup=e.target.closest?.('[data-b07-pickup-confirm]');if(pickup){e.preventDefault();e.stopImmediatePropagation();buyerPickup(pickup.dataset.b07PickupConfirm);return}
      const target=e.target.closest?.('[data-o-ship],[data-o-quote],[data-o-address-edit]');if(!target)return;
      const id=target.dataset.oShip||target.dataset.oQuote||target.dataset.oAddressEdit,s=statuses.get(id);
      if(target.dataset.oShip&&s?.fulfillment_group==='pickup'){e.preventDefault();e.stopImmediatePropagation();sellerPickup(id);return}
      enforceDialogHints(target);
    },true);
    const root=document.getElementById('grid')||document.body;const observer=new MutationObserver(mutations=>{if(!mutations.some(mutationAddsOrderCard))return;scheduleReload()});observer.observe(root,{childList:true,subtree:true});
    load();window.DV_B07_ORDER_LIFECYCLE={version:'1.2',refresh:load};return true;
  }
  let tries=0;const wait=setInterval(()=>{tries++;if(install()||tries>150)clearInterval(wait)},80);
})();
