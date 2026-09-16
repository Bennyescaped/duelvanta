/* B07 / L07-01 dedicated C2C swap problem flow. No payment or payout effect. */
(() => {
  'use strict';
  let installed=false,swaps=[],cases=[],activeThread=null;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const fmt=d=>d?new Date(d).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
  const fulfillment=(t,sender)=>t.fulfillments?.find(f=>f.sender_id===sender)||null;
  const otherId=t=>t.party_a_id===user.id?t.party_b_id:t.party_a_id;
  const incoming=t=>fulfillment(t,otherId(t));
  const openCase=t=>cases.find(c=>c.thread_id===t.thread_id&&c.status==='open')||null;
  const eligible=t=>['bound','disputed'].includes(t.status)&&incoming(t)?.shipped_at&&!incoming(t)?.received_at;

  async function load(){
    const [s,c]=await Promise.all([db.rpc('get_my_market_swaps_v1'),db.rpc('get_my_market_swap_cases_v1')]);
    if(s.error)throw s.error;if(c.error)throw c.error;
    swaps=Array.isArray(s.data)?s.data:[];cases=Array.isArray(c.data)?c.data:[];
  }

  function problemDialog(){
    let d=document.getElementById('dvSwapProblemDialog');if(d)return d;
    d=document.createElement('dialog');d.id='dvSwapProblemDialog';d.innerHTML='<div class="modal dvSwapProblemModal"><div class="modalHead"><h2>TAUSCH-PROBLEM MELDEN</h2><button id="dvSwapProblemClose" class="close" type="button">✕</button></div><div id="dvSwapProblemHint" class="msg"></div><div class="field"><label>Kategorie</label><select id="dvSwapProblemCategory"><option value="not_received">Nicht erhalten</option><option value="damaged">Beschädigt</option><option value="not_as_described">Nicht wie beschrieben</option><option value="shipping">Versandproblem</option><option value="other">Sonstiges</option></select></div><div class="field"><label>Beschreibung</label><textarea id="dvSwapProblemReason" maxlength="1200" rows="5"></textarea></div><button id="dvSwapProblemSave" class="btn danger" type="button" style="width:100%;margin-top:12px">PROBLEM ERÖFFNEN</button><div id="dvSwapProblemMsg" class="msg"></div></div>';document.body.appendChild(d);
    document.getElementById('dvSwapProblemClose').onclick=()=>d.close();document.getElementById('dvSwapProblemSave').onclick=saveProblem;return d;
  }

  function openProblem(threadId){
    const t=swaps.find(x=>x.thread_id===threadId),f=t&&incoming(t);if(!t||!f)return;activeThread=t;
    const d=problemDialog(),select=document.getElementById('dvSwapProblemCategory'),notReceived=select.querySelector('option[value="not_received"]');
    const floor=f.tracking_code?null:new Date(new Date(f.shipped_at).getTime()+14*86400000),blocked=floor&&Date.now()<floor.getTime();
    notReceived.disabled=!!blocked;select.value=blocked?'shipping':'not_received';document.getElementById('dvSwapProblemReason').value='';
    document.getElementById('dvSwapProblemHint').textContent=blocked?`Ungetrackter Versand: „Nicht erhalten“ ist erst ab ${fmt(floor)} möglich. Andere konkrete Probleme können bereits gemeldet werden.`:'Ein offener Problemfall setzt den Tauschstatus auf STRITTIG und stoppt den normalen Abschluss.';
    document.getElementById('dvSwapProblemMsg').textContent='';d.showModal();
  }

  async function saveProblem(){
    if(!activeThread)return;const button=document.getElementById('dvSwapProblemSave'),msg=document.getElementById('dvSwapProblemMsg'),f=incoming(activeThread);button.disabled=true;
    const {error}=await db.rpc('open_market_swap_problem_v1',{p_thread_id:activeThread.thread_id,p_fulfillment_sender_id:f.sender_id,p_category:document.getElementById('dvSwapProblemCategory').value,p_reason:document.getElementById('dvSwapProblemReason').value.trim()});button.disabled=false;
    if(error){msg.textContent=error.message;return}problemDialog().close();activeThread=null;await render();
  }

  async function respond(caseId){const note=prompt('Antwort / Nachweis zum Problemfall:');if(!note?.trim())return;const {error}=await db.rpc('respond_market_swap_problem_v1',{p_case_id:caseId,p_note:note.trim()});if(error)return alert(error.message);await render()}
  async function withdraw(caseId){if(!confirm('Diesen C2C-Problemfall zurückziehen? Der Tausch wird wieder fortgesetzt, sofern kein weiterer Problemfall offen ist.'))return;const note=prompt('Optionaler Hinweis zur Rücknahme:')||null;const {error}=await db.rpc('withdraw_market_swap_problem_v1',{p_case_id:caseId,p_note:note?.trim()||null});if(error)return alert(error.message);await render()}

  function caseHtml(c){return `<article class="dvSwapProblemCase"><div class="eyebrow">${esc(c.category)} · ${esc(c.status)}</div><b>${esc(c.reason)}</b><div class="msg">Eröffnet ${fmt(c.created_at)} · Antwortfrist ${fmt(c.response_due_at)} · Nachweisfrist ${fmt(c.evidence_due_at)}</div>${c.response_note?`<div class="dvSwapProblemResponse"><b>Antwort</b><br>${esc(c.response_note)} · ${fmt(c.responded_at)}</div>`:''}<div class="dvSwapProblemActions">${c.can_respond?`<button class="btn gold" data-swap-problem-respond="${c.case_id}">ANTWORTEN</button>`:''}${c.can_withdraw?`<button class="btn ghost" data-swap-problem-withdraw="${c.case_id}">ZURÜCKZIEHEN</button>`:''}</div></article>`}

  async function render(){
    const grid=document.getElementById('grid');if(!grid)return;grid.innerHTML='<div class="empty">C2C-Problemfälle werden geladen …</div>';
    try{await load()}catch(error){grid.innerHTML=`<div class="empty">${esc(error.message||'C2C-Problemfälle konnten nicht geladen werden.')}</div>`;return}
    const threads=swaps.filter(eligible);
    grid.innerHTML=`<div class="dvSwapProblemIntro"><b>C2C-TAUSCH · PROBLEME</b><br>Probleme gehören immer zu einer konkreten eingehenden Tauschsendung. Bei ungetracktem Versand ist „Nicht erhalten“ erst 14 Tage nach Versand möglich. Antwort- und Nachweisfrist: 7 Tage.</div><div class="dvSwapProblemGrid">${threads.map(t=>{const f=incoming(t),c=openCase(t);return `<article class="dvSwapProblemShipment"><div class="eyebrow">TAUSCH ${esc(t.thread_id.slice(0,8))} · ${esc(t.status)}</div><b>Eingehende Sendung</b><div class="msg">Versendet ${fmt(f.shipped_at)}${f.tracking_code?` · Tracking ${esc(f.tracking_code)}`:' · ungetrackt'}</div>${c?'<div class="msg">Für diesen Tausch ist bereits ein Problemfall offen.</div>':`<button class="btn danger" data-swap-problem-open="${t.thread_id}" type="button">PROBLEM MELDEN</button>`}</article>`}).join('')||'<div class="empty">Keine offene eingehende Tauschsendung.</div>'}</div><div class="dvSwapProblemGrid">${cases.map(caseHtml).join('')||'<div class="empty">Noch keine C2C-Problemfälle.</div>'}</div>`;
  }

  function install(){
    if(installed||typeof db==='undefined'||typeof user==='undefined'||!user)return false;const swapTab=document.getElementById('dvSwapsTab'),tabs=swapTab?.parentElement,grid=document.getElementById('grid');if(!swapTab||!tabs||!grid)return false;installed=true;
    const button=document.createElement('button');button.id='dvSwapProblemsTab';button.className='btn';button.textContent='TAUSCH-PROBLEME';tabs.insertBefore(button,swapTab.nextSibling);
    button.onclick=()=>{if(typeof tab!=='undefined')tab='swap_cases';tabs.querySelectorAll('.btn').forEach(x=>x.classList.remove('active'));button.classList.add('active');render()};
    tabs.addEventListener('click',e=>{if(e.target!==button&&e.target.closest('[data-tab],#dvSwapsTab,#sell'))button.classList.remove('active')},true);
    grid.addEventListener('click',e=>{const open=e.target.closest('[data-swap-problem-open]');if(open){openProblem(open.dataset.swapProblemOpen);return}const respondBtn=e.target.closest('[data-swap-problem-respond]');if(respondBtn){respond(respondBtn.dataset.swapProblemRespond);return}const withdrawBtn=e.target.closest('[data-swap-problem-withdraw]');if(withdrawBtn)withdraw(withdrawBtn.dataset.swapProblemWithdraw)});
    const style=document.createElement('style');style.id='dvSwapProblemStyle';style.textContent='.dvSwapProblemIntro{grid-column:1/-1;border:1px solid rgba(199,164,93,.25);border-radius:14px;padding:14px;color:#aaa39a;font-size:12px;line-height:1.55}.dvSwapProblemGrid{grid-column:1/-1;display:grid;gap:10px;margin-top:10px}.dvSwapProblemShipment,.dvSwapProblemCase{border:1px solid #2b313a;border-radius:13px;background:#10141a;padding:14px}.dvSwapProblemShipment>.btn{margin-top:10px}.dvSwapProblemResponse{margin-top:10px;border:1px solid #303640;border-radius:9px;padding:9px;color:#aab0ba;font-size:11px}.dvSwapProblemActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.dvSwapProblemModal{max-width:560px}.dvSwapProblemModal select,.dvSwapProblemModal textarea{width:100%;box-sizing:border-box;background:#090c10;color:#f3eee4;border:1px solid #303640;border-radius:9px;padding:10px}';document.head.appendChild(style);
    window.DV_C2C_SWAP_PROBLEMS={version:'1.0',render};return true;
  }
  let tries=0;const wait=setInterval(()=>{tries++;if(install()||tries>150)clearInterval(wait)},80);
})();
