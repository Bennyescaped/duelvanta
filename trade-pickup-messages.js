/* B07 / L07-01 participant-only pickup coordination for swaps and orders. */
(()=>{
  'use strict';
  let installed=false,current=null,retryTimer=null,retryMs=100;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const lines=s=>esc(s).replace(/\n/g,'<br>');
  const fmt=d=>d?new Date(d).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
  const typeLabel=t=>t==='swap'?'TAUSCH':'BESTELLUNG';
  const statusLabel=s=>({bound:'VERBINDLICH',completed:'ABGESCHLOSSEN',disputed:'STRITTIG',open:'OFFEN',in_progress:'IN ABWICKLUNG',shipped:'ÜBERGABE BESTÄTIGT',received:'ERHALTEN',cancelled:'ABGEBROCHEN'}[s]||String(s||'').toUpperCase());
  const partyName=p=>p?.display_name||p?.username&&`@${p.username}`||'DUELVANTA Member';

  function ensureStyle(){
    if(document.getElementById('dvPickupMessagesStyle'))return;
    const s=document.createElement('style');s.id='dvPickupMessagesStyle';s.textContent='.dvPickupMsgHero{grid-column:1/-1;border:1px solid rgba(199,164,93,.28);background:rgba(199,164,93,.05);border-radius:14px;padding:14px;color:#aaa39a;font-size:11px;line-height:1.55}.dvPickupMsgHero b{color:#efd18c}.dvPickupMsgGrid{grid-column:1/-1;display:grid;gap:10px}.dvPickupMsgCard{border:1px solid #292f38;background:#0d1116;border-radius:14px;padding:13px}.dvPickupMsgHead{display:flex;justify-content:space-between;gap:10px}.dvPickupMsgHead b{color:#eee7dc}.dvPickupMsgStatus{font-size:9px;color:#d8c28f}.dvPickupMsgMeta{margin-top:4px;color:#858e9a;font-size:10px}.dvPickupMsgPreview{margin-top:10px;border:1px solid #252b34;background:#090c10;border-radius:9px;padding:9px;color:#aab0ba;font-size:10px;line-height:1.45}.dvPickupMsgActions{margin-top:10px}.dvPickupDialog .modal{max-width:650px}.dvPickupPartner{color:#9aa2ad;font-size:11px;margin:5px 0 12px}.dvPickupThread{display:flex;flex-direction:column;gap:8px;max-height:min(48vh,480px);overflow:auto;border:1px solid #292f38;background:#090c10;border-radius:12px;padding:11px}.dvPickupBubble{max-width:86%;border:1px solid #303640;border-radius:12px;padding:9px 10px;color:#ddd6cc;font-size:11px;line-height:1.5;overflow-wrap:anywhere}.dvPickupBubble.mine{align-self:flex-end;border-color:rgba(199,164,93,.42);background:rgba(199,164,93,.08)}.dvPickupBubble.other{align-self:flex-start;background:#0d1116}.dvPickupBubble small{display:block;margin-top:5px;color:#727b86;font-size:8px}.dvPickupComposer{margin-top:10px}.dvPickupComposer textarea{width:100%;min-height:82px;resize:vertical;border:1px solid #303640;background:#090c10;color:#f3eee4;border-radius:9px;padding:10px}.dvPickupComposer .btn{width:100%;margin-top:8px}.dvPickupReadOnly{margin-top:10px;border:1px solid #303640;border-radius:9px;padding:9px;color:#8f98a3;font-size:10px}@media(max-width:620px){.dvPickupMsgHead{display:block}.dvPickupMsgStatus{display:block;margin-top:5px}.dvPickupBubble{max-width:92%}}';document.head.appendChild(s);
  }

  function ensureDialog(){
    let d=document.getElementById('dvPickupMessagesDialog');if(d)return d;
    d=document.createElement('dialog');d.id='dvPickupMessagesDialog';d.className='dvPickupDialog';d.innerHTML='<div class="modal"><div class="modalHead"><h2 id="dvPickupTitle">ABHOLUNG CHAT</h2><button id="dvPickupClose" class="close" type="button">✕</button></div><div id="dvPickupPartner" class="dvPickupPartner"></div><div id="dvPickupThread" class="dvPickupThread"></div><div id="dvPickupComposer" class="dvPickupComposer hidden"><textarea id="dvPickupBody" maxlength="1000" rows="3" placeholder="Treffpunkt oder Uhrzeit abstimmen …"></textarea><button id="dvPickupSend" class="btn gold" type="button">NACHRICHT SENDEN</button></div><div id="dvPickupReadOnly" class="dvPickupReadOnly hidden">Dieser Vorgang ist abgeschlossen oder gesperrt. Der Verlauf bleibt lesbar.</div><div id="dvPickupMsg" class="msg"></div><div class="msg" style="margin-top:8px">Teile nur Daten, die für die persönliche Übergabe nötig sind.</div></div>';document.body.appendChild(d);
    document.getElementById('dvPickupClose').onclick=()=>d.close();d.addEventListener('close',()=>{current=null});document.getElementById('dvPickupSend').onclick=sendCurrent;return d;
  }

  async function fetchConversation(type,id){
    const {data,error}=await db.rpc('get_market_pickup_conversation_v1',{p_context_type:type,p_context_id:id});if(error)throw error;return data;
  }

  function renderConversation(data){
    const thread=document.getElementById('dvPickupThread'),partner=document.getElementById('dvPickupPartner'),composer=document.getElementById('dvPickupComposer'),readOnly=document.getElementById('dvPickupReadOnly'),msg=document.getElementById('dvPickupMsg');
    document.getElementById('dvPickupTitle').textContent=`ABHOLUNG CHAT · ${typeLabel(data.context_type)}`;partner.textContent=`Mit ${partyName(data.other_party)}`;msg.textContent='';
    const rows=Array.isArray(data.messages)?data.messages:[];thread.innerHTML=rows.length?rows.map(m=>`<div class="dvPickupBubble ${m.is_mine?'mine':'other'}">${lines(m.body)}<small>${m.is_mine?'DU':esc(partyName(data.other_party))} · ${fmt(m.created_at)}</small></div>`).join(''):'<div class="msg">Noch keine Nachrichten. Stimmt hier Treffpunkt und Uhrzeit ab.</div>';
    composer.classList.toggle('hidden',!data.can_send);readOnly.classList.toggle('hidden',!!data.can_send);if(data.can_send)document.getElementById('dvPickupBody').value='';thread.scrollTop=thread.scrollHeight;
  }

  async function openConversation(type,id){
    if(type!=='order')return;
    current={type,id};const d=ensureDialog();document.getElementById('dvPickupTitle').textContent='ABHOLUNG CHAT';document.getElementById('dvPickupPartner').textContent='Wird geladen …';document.getElementById('dvPickupThread').innerHTML='<div class="msg">Nachrichten werden geladen …</div>';document.getElementById('dvPickupComposer').classList.add('hidden');document.getElementById('dvPickupReadOnly').classList.add('hidden');document.getElementById('dvPickupMsg').textContent='';d.showModal();
    try{const data=await fetchConversation(type,id);if(!current||current.type!==type||current.id!==id)return;renderConversation(data)}catch(error){document.getElementById('dvPickupThread').innerHTML=`<div class="msg">${esc(error.message||'Chat konnte nicht geladen werden.')}</div>`}
  }

  async function sendCurrent(){
    if(!current)return;const body=document.getElementById('dvPickupBody').value.trim(),button=document.getElementById('dvPickupSend'),msg=document.getElementById('dvPickupMsg');if(!body){msg.textContent='Bitte eine Nachricht eingeben.';return}button.disabled=true;msg.textContent='Wird gesendet …';
    try{const {error}=await db.rpc('send_market_pickup_message_v1',{p_context_type:current.type,p_context_id:current.id,p_body:body});if(error)throw error;const data=await fetchConversation(current.type,current.id);renderConversation(data);if(typeof tab!=='undefined'&&tab==='pickup_messages')await renderList()}catch(error){msg.textContent=error.message||'Nachricht konnte nicht gesendet werden.'}finally{button.disabled=false}
  }

  async function renderList(){
    if(typeof tab!=='undefined'&&tab!=='pickup_messages')return;const app=document.querySelector('.wrap'),grid=document.getElementById('grid'),toolbar=document.querySelector('.toolbar');if(!grid)return;if(app)app.dataset.tradeView='pickup_messages';if(toolbar)toolbar.style.display='none';document.getElementById('mineStats')?.classList.add('hidden');grid.innerHTML='<div class="empty">Abholungen werden geladen …</div>';
    try{const {data,error}=await db.rpc('list_my_market_pickup_conversations_v1');if(error)throw error;const rows=Array.isArray(data)?data.filter(x=>x.context_type==='order'):[];grid.innerHTML='<div class="dvPickupMsgHero"><b>ABHOLUNG CHAT</b><br>Private Abstimmung für persönliche Übergaben bei Käufen. Nur die beiden Beteiligten können den jeweiligen Verlauf lesen.</div>'+(rows.length?`<div class="dvPickupMsgGrid">${rows.map(x=>{const p=partyName(x.other_party),preview=x.last_message_body?lines(x.last_message_body):'Noch keine Nachricht · Treffpunkt und Uhrzeit abstimmen';return `<article class="dvPickupMsgCard"><div class="dvPickupMsgHead"><b>${typeLabel(x.context_type)} · ${esc(p)}</b><span class="dvPickupMsgStatus">${esc(statusLabel(x.status))}${x.can_send?' · CHAT OFFEN':' · NUR LESEN'}</span></div><div class="dvPickupMsgMeta">${x.last_message_at?`Letzte Nachricht ${fmt(x.last_message_at)}`:`Vorgang seit ${fmt(x.created_at)}`}</div><div class="dvPickupMsgPreview">${preview}</div><div class="dvPickupMsgActions"><button class="btn ghost" data-pickup-chat-open="${esc(x.context_id)}" data-pickup-chat-type="${esc(x.context_type)}">CHAT ÖFFNEN</button></div></article>`}).join('')}</div>`:'<div class="empty">Keine Abholvorgänge vorhanden.</div>')
    }catch(error){grid.innerHTML=`<div class="empty">${esc(error.message||'Abholung-Chats konnten nicht geladen werden.')}</div>`}
  }

  function install(){
    if(installed||typeof db==='undefined'||typeof user==='undefined'||!user||!window.DV_TRADE_MARKETPLACE_UX)return false;const tabs=document.querySelector('.tabs'),secondary=tabs?.querySelector('.dvTradeSecondary'),grid=document.getElementById('grid');if(!tabs||!secondary||!grid)return false;ensureStyle();ensureDialog();
    let button=document.getElementById('dvPickupMessagesTab');if(!button){button=document.createElement('button');button.id='dvPickupMessagesTab';button.className='btn';button.textContent='ABHOLUNG CHAT';secondary.appendChild(button)}
    button.onclick=()=>{if(typeof tab!=='undefined')tab='pickup_messages';tabs.querySelectorAll('.btn').forEach(x=>x.classList.remove('active'));button.classList.add('active');renderList()};
    tabs.addEventListener('click',e=>{const target=e.target.closest('button');if(target&&target!==button){button.classList.remove('active');const toolbar=document.querySelector('.toolbar');if(toolbar)toolbar.style.display=''}},true);
    grid.addEventListener('click',e=>{const x=e.target.closest('[data-pickup-chat-open]');if(x)openConversation(x.dataset.pickupChatType,x.dataset.pickupChatOpen)});
    window.DV_PICKUP_MESSAGES={version:'1.0',render:renderList,open:openConversation};installed=true;return true;
  }

  function schedule(delay=0){if(installed||retryTimer!==null)return;retryTimer=setTimeout(()=>{retryTimer=null;if(install())return;retryMs=Math.min(Math.round(retryMs*1.5),2000);schedule(retryMs)},delay)}
  window.addEventListener('pageshow',()=>schedule(0));document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(0)});schedule();
})();
