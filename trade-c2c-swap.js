/* B07 / L07-01 private C2C swap flow. No payment, fee, wallet or tax-reporting activation. */
(() => {
  'use strict';
  let installed=false,available=false,swaps=[],baseRender=null,editor=null,shippingThread=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const eur=n=>n==null?'—':new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n));
  const fmt=d=>d?new Date(d).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
  const tradeCapable=l=>['trade','sale_or_trade'].includes(l?.listing_type);
  const items=(t,side)=>t?.current_revision?.[`party_${side}_items`]||[];
  const party=(t,side)=>t?.[`party_${side}`]||{};
  const mineSide=t=>t.party_a_id===user.id?'a':'b';
  const otherSide=t=>mineSide(t)==='a'?'b':'a';
  const valuation=(t,owner)=>t.value_snapshots?.find(v=>v.owner_id===owner)||null;
  const fulfillment=(t,sender)=>t.fulfillments?.find(f=>f.sender_id===sender)||null;
  const label=t=>({negotiating:'VERHANDLUNG',bound:'VERBINDLICH BESTÄTIGT',completed:'ABGESCHLOSSEN',withdrawn:'ZURÜCKGEZOGEN',declined:'ABGELEHNT',disputed:'STRITTIG'}[t.status]||String(t.status||'').toUpperCase());
  const cardLine=x=>`${esc(x.card_name||'Produkt')}${x.set_name?` · ${esc(x.set_name)}`:''}${x.card_number?` · ${esc(x.card_number)}`:''}`;

  async function loadSwaps(){
    const {data,error}=await db.rpc('get_my_market_swaps_v1');
    if(error){
      if(/Could not find the function|schema cache/i.test(error.message||'')){available=false;return false}
      throw error;
    }
    available=true;swaps=Array.isArray(data)?data:[];return true;
  }

  function boundListingMap(){
    const map=new Map();
    for(const t of swaps){
      if(t.status!=='bound')continue;
      for(const x of [...items(t,'a'),...items(t,'b')])map.set(x.listing_id,t.thread_id);
    }
    return map;
  }

  function decorateListings(){
    if(!available||typeof listings==='undefined')return;
    document.querySelectorAll('[data-offer]').forEach(button=>{
      const id=button.dataset.offer,l=listings.find(x=>x.id===id);
      if(!l||l.seller_id===user.id||!tradeCapable(l)||l.status!=='active')return;
      const actions=button.parentElement;if(!actions||actions.querySelector(`[data-swap-propose="${CSS.escape(id)}"]`))return;
      const swap=document.createElement('button');swap.type='button';swap.className='btn ghost';swap.dataset.swapPropose=id;swap.textContent='TAUSCH VORSCHLAGEN';actions.appendChild(swap);
      if(l.listing_type==='trade')button.remove();
    });
    const bound=boundListingMap();
    document.querySelectorAll('[data-complete]').forEach(button=>{
      const id=button.dataset.complete,threadId=bound.get(id);if(!threadId)return;
      delete button.dataset.complete;button.dataset.swapOpen=threadId;button.textContent='TAUSCH ÖFFNEN';
    });
  }

  function renderItemList(rows){
    return rows.map(x=>`<li>${cardLine(x)}${x.market_price_snapshot!=null?` <span>· Ref. ${eur(x.market_price_snapshot)}</span>`:''}</li>`).join('')||'<li>—</li>';
  }

  function fulfillmentHtml(t){
    if(t.status!=='bound'&&t.status!=='completed')return '';
    const my=fulfillment(t,user.id),other=fulfillment(t,t.party_a_id===user.id?t.party_b_id:t.party_a_id),myValue=valuation(t,user.id),otherId=t.party_a_id===user.id?t.party_b_id:t.party_a_id,otherValue=valuation(t,otherId);
    const value=v=>v?.valuation_status==='reference_only_unapproved'?eur(v.reference_value_eur):'nicht vollständig verfügbar';
    let actions='';
    if(t.status==='bound'&&my&&!my.shipped_at)actions+=`<button class="btn gold" data-swap-ship="${t.thread_id}">VERSAND BESTÄTIGEN</button>`;
    if(t.status==='bound'&&other?.shipped_at&&!other.received_at)actions+=`<button class="btn gold" data-swap-received="${t.thread_id}" data-swap-sender="${other.sender_id}">ERHALTEN – ALLES IN ORDNUNG</button>`;
    return `<div class="dvSwapAudit"><b>TECHNISCHER REFERENZWERT</b><br>Deine abgegebenen Waren: ${value(myValue)} · Gegenseite: ${value(otherValue)}<br><small>Unveränderbarer B07-Referenzsnapshot. Keine steuerliche Einordnung; PStTG-Zählung ist hier nicht aktiviert.</small></div><div class="dvSwapShip"><div><b>DEIN VERSAND</b><br>Frist ${fmt(my?.shipping_due_at)} · ${my?.tracking_required?'Tracking erforderlich':'Tracking optional'}${my?.ship_to?`<br>An: ${esc(my.ship_to.recipient_name)} · ${esc(my.ship_to.street_line1)}${my.ship_to.street_line2?` · ${esc(my.ship_to.street_line2)}`:''} · ${esc(my.ship_to.postal_code)} ${esc(my.ship_to.city)} · DE`:''}${my?.shipped_at?` · versendet ${fmt(my.shipped_at)}`:''}${my?.overdue?' · ÜBERFÄLLIG':''}</div><div><b>GEGENSEITE</b><br>${other?.shipped_at?`versendet ${fmt(other.shipped_at)}${other.tracking_code?` · Tracking ${esc(other.tracking_code)}`:''}`:'noch nicht versendet'}${other?.received_at?` · Erhalt bestätigt ${fmt(other.received_at)}`:''}</div></div><div class="dvSwapActions">${actions}</div>`;
  }

  async function renderSwaps(reload=true){
    const grid=document.getElementById('grid');document.getElementById('mineStats')?.classList.add('hidden');
    if(!grid)return;
    grid.innerHTML='<div class="empty">Tauschvorgänge werden geladen …</div>';
    try{if(reload)await loadSwaps()}catch(error){grid.innerHTML=`<div class="empty">${esc(error.message||'Tauschvorgänge konnten nicht geladen werden.')}</div>`;return}
    if(!available){grid.innerHTML='<div class="empty">C2C-Tausch ist in dieser Umgebung noch nicht aktiviert.</div>';return}
    if(!swaps.length){grid.innerHTML='<div class="dvSwapIntro"><b>C2C-TAUSCH</b><br>Ein Tausch wird erst verbindlich, wenn beide Seiten exakt denselben finalen Tauschstand bestätigen.</div>';return}
    grid.innerHTML='<div class="dvSwapIntro"><b>C2C-TAUSCH · RELEASE 1</b><br>Entwurf und Gegenvorschlag sind unverbindlich. Jede Änderung erzeugt einen neuen revisionsfesten Stand; beide Seiten müssen denselben Stand erneut bestätigen.</div><div class="dvSwapGrid">'+swaps.map(t=>{
      const me=mineSide(t),other=otherSide(t),otherPerson=party(t,other),rev=t.current_revision||{},mineConfirmed=me==='a'?t.party_a_confirmed:t.party_b_confirmed,otherConfirmed=me==='a'?t.party_b_confirmed:t.party_a_confirmed;
      let actions='';
      if(t.status==='negotiating'){
        actions=`<button class="btn gold" data-swap-confirm="${t.thread_id}" data-swap-revision="${rev.revision_id||''}" ${mineConfirmed?'disabled':''}>${mineConfirmed?'FINALER STAND BESTÄTIGT ✓':'FINALEN TAUSCHSTAND BESTÄTIGEN'}</button><button class="btn ghost" data-swap-revise="${t.thread_id}">GEGENVORSCHLAG / ÄNDERN</button><button class="btn danger" data-swap-close="${t.thread_id}">${t.party_a_id===user.id?'ZURÜCKZIEHEN':'ABLEHNEN'}</button>`;
      }
      return `<article class="dvSwapCard"><div class="dvSwapTop"><div><div class="eyebrow">REVISION ${esc(rev.revision_no||'—')} · ${esc(otherPerson.display_name||otherPerson.username||'Tauschpartner')}</div><h3>C2C-Tausch</h3></div><span class="dvSwapStatus ${esc(t.status)}">${esc(label(t))}</span></div><div class="dvSwapSides"><section><b>DEINE SEITE</b><ul>${renderItemList(items(t,me))}</ul></section><section><b>GEGENSEITE</b><ul>${renderItemList(items(t,other))}</ul></section></div><div class="dvSwapConfirm"><span class="${mineConfirmed?'ok':''}">DU ${mineConfirmed?'✓':'OFFEN'}</span><span class="${otherConfirmed?'ok':''}">GEGENSEITE ${otherConfirmed?'✓':'OFFEN'}</span>${t.binding_at?`<span class="ok">GEBUNDEN ${fmt(t.binding_at)}</span>`:''}</div>${fulfillmentHtml(t)}<div class="dvSwapActions">${actions}</div></article>`;
    }).join('')+'</div>';
    decorateListings();
  }

  function candidateRows(ownerId,selected){
    return (typeof listings==='undefined'?[]:listings).filter(l=>l.seller_id===ownerId&&tradeCapable(l)&&(l.status==='active'||selected.has(l.id))).sort((a,b)=>String(a.card_name||'').localeCompare(String(b.card_name||''),'de'));
  }

  function candidateHtml(ownerId,selected,name){
    const rows=candidateRows(ownerId,selected);
    return `<fieldset class="dvSwapCandidates"><legend>${esc(name)}</legend>${rows.map(l=>{const active=l.status==='active'&&Number(l.quantity_available||0)>0;return `<label class="${active?'':'disabled'}"><input type="checkbox" value="${l.id}" data-swap-owner="${ownerId}" ${selected.has(l.id)?'checked':''} ${active?'':'disabled'}><span><b>${esc(l.card_name)}</b><small>${esc([l.set_name,l.card_number].filter(Boolean).join(' · '))}${l.market_price_snapshot!=null?` · Ref. ${eur(l.market_price_snapshot)}`:''}${active?'':' · nicht mehr verfügbar'}</small></span></label>`}).join('')||'<div class="msg">Keine aktiven Tausch-Inserate verfügbar.</div>'}</fieldset>`;
  }

  function editorDialog(){
    let d=document.getElementById('dvSwapEditor');if(d)return d;
    d=document.createElement('dialog');d.id='dvSwapEditor';d.innerHTML='<div class="modal dvSwapModal"><div class="modalHead"><h2 id="dvSwapEditorTitle">Tausch</h2><button id="dvSwapEditorClose" class="close" type="button">✕</button></div><div id="dvSwapEditorBody"></div><button id="dvSwapEditorSave" class="btn gold" type="button" style="width:100%;margin-top:14px">VORSCHLAG SPEICHERN</button><div id="dvSwapEditorMsg" class="msg"></div></div>';document.body.appendChild(d);document.getElementById('dvSwapEditorClose').onclick=()=>d.close();document.getElementById('dvSwapEditorSave').onclick=saveEditor;return d;
  }

  function openInitial(listingId){
    const target=listings.find(x=>x.id===listingId);if(!target)return;
    const ownSelected=new Set();editor={mode:'create',target,partyA:user.id,partyB:target.seller_id,aSelected:ownSelected,bSelected:new Set([target.id])};
    const d=editorDialog();document.getElementById('dvSwapEditorTitle').textContent='TAUSCH VORSCHLAGEN';document.getElementById('dvSwapEditorBody').innerHTML=`<div class="dvSwapFixed"><b>GEWÜNSCHT</b><br>${cardLine(target)}</div>${candidateHtml(user.id,ownSelected,'DEINE TAUSCHKARTEN')}`;document.getElementById('dvSwapEditorMsg').textContent='';d.showModal();
  }

  function openRevision(threadId){
    const t=swaps.find(x=>x.thread_id===threadId);if(!t)return;
    const aSelected=new Set(items(t,'a').map(x=>x.listing_id)),bSelected=new Set(items(t,'b').map(x=>x.listing_id));editor={mode:'revise',thread:t,partyA:t.party_a_id,partyB:t.party_b_id,aSelected,bSelected};
    const d=editorDialog();document.getElementById('dvSwapEditorTitle').textContent='TAUSCHSTAND ÄNDERN';document.getElementById('dvSwapEditorBody').innerHTML='<div class="msg">Jede Änderung erzeugt eine neue Revision. Frühere Bestätigungen gelten danach nicht mehr.</div>'+candidateHtml(t.party_a_id,aSelected,t.party_a_id===user.id?'DEINE SEITE':'SEITE DER GEGENPARTEI')+candidateHtml(t.party_b_id,bSelected,t.party_b_id===user.id?'DEINE SEITE':'SEITE DER GEGENPARTEI');document.getElementById('dvSwapEditorMsg').textContent='';d.showModal();
  }

  function selectedFor(ownerId){return [...document.querySelectorAll(`#dvSwapEditor input[data-swap-owner="${CSS.escape(ownerId)}"]:checked`)].map(x=>x.value)}
  async function saveEditor(){
    if(!editor)return;const msg=document.getElementById('dvSwapEditorMsg'),button=document.getElementById('dvSwapEditorSave');button.disabled=true;msg.textContent='Wird gespeichert …';
    try{
      let error;
      if(editor.mode==='create'){
        const offered=selectedFor(editor.partyA);if(!offered.length)throw new Error('Wähle mindestens ein eigenes Tausch-Inserat.');
        ({error}=await db.rpc('create_market_swap_proposal_v1',{p_target_listing_id:editor.target.id,p_offered_listing_ids:offered}));
      }else{
        const a=selectedFor(editor.partyA),b=selectedFor(editor.partyB);if(!a.length||!b.length)throw new Error('Beide Tauschseiten benötigen mindestens ein Produkt.');
        ({error}=await db.rpc('propose_market_swap_revision_v1',{p_thread_id:editor.thread.thread_id,p_party_a_listing_ids:a,p_party_b_listing_ids:b}));
      }
      if(error)throw error;editorDialog().close();editor=null;await refreshAll(true);
    }catch(error){msg.textContent=error.message||'Tauschvorschlag konnte nicht gespeichert werden.'}finally{button.disabled=false}
  }

  function shippingDialog(){
    let d=document.getElementById('dvSwapShipping');if(d)return d;
    d=document.createElement('dialog');d.id='dvSwapShipping';d.innerHTML='<div class="modal dvSwapModal"><div class="modalHead"><h2>VERSAND BESTÄTIGEN</h2><button id="dvSwapShippingClose" class="close" type="button">✕</button></div><div id="dvSwapShippingHint" class="msg"></div><div class="field"><label>Versanddienst</label><input id="dvSwapCarrier" maxlength="80" autocomplete="off"></div><div class="field"><label>Trackingnummer</label><input id="dvSwapTracking" maxlength="160" autocomplete="off"></div><button id="dvSwapShippingSave" class="btn gold" type="button" style="width:100%;margin-top:14px">ALS VERSENDET MARKIEREN</button><div id="dvSwapShippingMsg" class="msg"></div></div>';document.body.appendChild(d);document.getElementById('dvSwapShippingClose').onclick=()=>d.close();document.getElementById('dvSwapShippingSave').onclick=saveShipping;return d;
  }

  function openShipping(threadId){
    const t=swaps.find(x=>x.thread_id===threadId),f=t&&fulfillment(t,user.id);if(!t||!f)return;shippingThread=t;
    const d=shippingDialog();document.getElementById('dvSwapCarrier').value='';document.getElementById('dvSwapTracking').value='';document.getElementById('dvSwapShippingHint').textContent=f.tracking_required?'Für diese Tauschseite ist Tracking verpflichtend.':'Bis einschließlich 25 € Referenzwert ist ungetrackter Versand technisch zulässig; Tracking kann freiwillig angegeben werden.';document.getElementById('dvSwapShippingMsg').textContent='';d.showModal();
  }

  async function saveShipping(){
    if(!shippingThread)return;const button=document.getElementById('dvSwapShippingSave'),msg=document.getElementById('dvSwapShippingMsg');button.disabled=true;
    const carrier=document.getElementById('dvSwapCarrier').value.trim()||null,tracking=document.getElementById('dvSwapTracking').value.trim()||null;
    const {error}=await db.rpc('mark_market_swap_shipped_v1',{p_thread_id:shippingThread.thread_id,p_carrier:carrier,p_tracking_code:tracking});button.disabled=false;
    if(error){msg.textContent=error.message;return}shippingDialog().close();shippingThread=null;await refreshAll(false);
  }

  async function refreshAll(reloadListingsToo){
    await loadSwaps();if(reloadListingsToo&&typeof loadListings==='function')await loadListings();if(typeof tab!=='undefined'&&tab==='swaps')await renderSwaps(false);else decorateListings();
  }

  async function act(name,args){const {data,error}=await db.rpc(name,args);if(error)throw error;await refreshAll(name==='confirm_market_swap_revision_v1'||name==='confirm_market_swap_received_v1');return data}

  function setupUi(){
    const tabs=document.querySelector('.tabs'),sell=document.getElementById('sell');if(!tabs)return false;
    const button=document.createElement('button');button.id='dvSwapsTab';button.className='btn';button.textContent='TAUSCH';sell?tabs.insertBefore(button,sell):tabs.appendChild(button);
    baseRender=render;render=async function(){if(typeof tab!=='undefined'&&tab==='swaps')return renderSwaps();const out=await baseRender();decorateListings();return out};
    button.onclick=()=>{if(typeof tab!=='undefined')tab='swaps';tabs.querySelectorAll('.btn').forEach(x=>x.classList.remove('active'));button.classList.add('active');renderSwaps()};
    tabs.addEventListener('click',e=>{if(e.target.closest('[data-tab]'))button.classList.remove('active')},true);
    document.getElementById('grid').addEventListener('click',async e=>{
      const propose=e.target.closest('[data-swap-propose]');if(propose){openInitial(propose.dataset.swapPropose);return}
      const open=e.target.closest('[data-swap-open]');if(open){if(typeof tab!=='undefined')tab='swaps';button.click();return}
      const revise=e.target.closest('[data-swap-revise]');if(revise){openRevision(revise.dataset.swapRevise);return}
      const confirmBtn=e.target.closest('[data-swap-confirm]');if(confirmBtn){if(!confirm('Bestätigst du exakt diesen finalen Tauschstand? Erst wenn beide Seiten denselben Stand bestätigt haben, wird der Tausch verbindlich.'))return;try{await act('confirm_market_swap_revision_v1',{p_thread_id:confirmBtn.dataset.swapConfirm,p_revision_id:confirmBtn.dataset.swapRevision})}catch(error){alert(error.message)}return}
      const close=e.target.closest('[data-swap-close]');if(close){const t=swaps.find(x=>x.thread_id===close.dataset.swapClose);if(!t)return;const action=t.party_a_id===user.id?'withdrawn':'declined';if(!confirm(action==='withdrawn'?'Tauschvorschlag zurückziehen?':'Tauschvorschlag ablehnen?'))return;try{await act('close_market_swap_thread_v1',{p_thread_id:t.thread_id,p_action:action})}catch(error){alert(error.message)}return}
      const ship=e.target.closest('[data-swap-ship]');if(ship){openShipping(ship.dataset.swapShip);return}
      const received=e.target.closest('[data-swap-received]');if(received){if(!confirm('Bestätigst du, dass die Waren dieser Tauschseite vollständig angekommen und in Ordnung sind?'))return;try{await act('confirm_market_swap_received_v1',{p_thread_id:received.dataset.swapReceived,p_sender_id:received.dataset.swapSender})}catch(error){alert(error.message)}return}
    });
    const style=document.createElement('style');style.id='dvSwapStyle';style.textContent='.dvSwapGrid{display:grid;gap:12px;grid-column:1/-1}.dvSwapIntro{grid-column:1/-1;border:1px solid rgba(199,164,93,.25);border-radius:14px;padding:14px;color:#aaa39a;font-size:12px;line-height:1.55}.dvSwapCard{border:1px solid #252b34;background:#10141a;border-radius:16px;padding:16px}.dvSwapTop{display:flex;justify-content:space-between;gap:12px}.dvSwapTop h3{margin:5px 0;font:400 23px Georgia,serif}.dvSwapStatus{height:max-content;border:1px solid #4a4230;border-radius:999px;padding:6px 9px;font-size:9px;color:#d8c28f}.dvSwapStatus.completed{color:#87d7a5}.dvSwapSides{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.dvSwapSides section,.dvSwapAudit,.dvSwapShip{border:1px solid #2c323b;border-radius:10px;padding:11px;color:#aab0ba;font-size:11px;line-height:1.55}.dvSwapSides ul{margin:7px 0 0;padding-left:18px}.dvSwapSides li span{color:#858d98}.dvSwapConfirm,.dvSwapActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.dvSwapConfirm span{border:1px solid #303640;border-radius:999px;padding:5px 8px;font-size:9px;color:#969eaa}.dvSwapConfirm span.ok{color:#87d7a5;border-color:rgba(89,190,126,.35)}.dvSwapAudit{margin-top:10px;border-color:rgba(199,164,93,.28)}.dvSwapAudit b{color:#d8c28f}.dvSwapShip{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.dvSwapCandidates{border:1px solid #303640;border-radius:11px;margin:12px 0;padding:10px}.dvSwapCandidates legend{color:#d8c28f;font-size:10px;letter-spacing:.08em;padding:0 6px}.dvSwapCandidates label{display:flex;gap:9px;padding:9px;border-bottom:1px solid #222831}.dvSwapCandidates label:last-child{border-bottom:0}.dvSwapCandidates label.disabled{opacity:.5}.dvSwapCandidates small{display:block;color:#929aa5;margin-top:3px}.dvSwapFixed{border:1px solid #4a4230;border-radius:10px;padding:11px;color:#d8c28f}.dvSwapModal{max-width:650px}.dvSwapModal .field{margin-top:10px}.dvSwapModal input[type=text],.dvSwapModal input:not([type]){width:100%}@media(max-width:620px){.dvSwapSides,.dvSwapShip{grid-template-columns:1fr}.dvSwapTop{display:block}}';document.head.appendChild(style);
    if(!document.querySelector('script[data-dv-swap-problems]')){const problems=document.createElement('script');problems.src='trade-c2c-swap-problems.js?v=1.0';problems.dataset.dvSwapProblems='1';document.body.appendChild(problems)}
    decorateListings();window.DV_C2C_SWAP={version:'1.0',render:renderSwaps,refresh:refreshAll};return true;
  }

  async function install(){
    if(installed||typeof db==='undefined'||typeof user==='undefined'||!user||typeof render!=='function')return false;installed=true;
    try{if(!await loadSwaps())return true}catch(error){console.warn('B07 C2C swap unavailable',error);return true}
    return setupUi();
  }
  let tries=0;const wait=setInterval(async()=>{tries++;if(await install()||tries>150)clearInterval(wait)},80);
})();
