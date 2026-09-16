/* B07 / L07-01 5-star blind reviews for completed sales and C2C swaps. */
(() => {
  'use strict';
  let installed=false,available=false,busy=false,states=[],current=null,stars=5;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=d=>d?new Date(d).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
  const starText=n=>'★'.repeat(Number(n||0))+'☆'.repeat(Math.max(0,5-Number(n||0)));
  const state=(kind,id)=>states.find(x=>x.transaction_kind===kind&&x.transaction_id===id)||null;

  async function load(){
    if(busy)return;busy=true;
    try{
      const {data,error}=await db.rpc('get_my_market_review_state_v1');
      if(error){
        if(/Could not find the function|schema cache|permission denied/i.test(error.message||'')){available=false;return}
        throw error;
      }
      available=true;states=Array.isArray(data)?data:[];
    }catch(error){console.warn('B07 reviews',error)}finally{busy=false;decorate()}
  }

  function dialog(){
    let d=document.getElementById('dvB07ReviewDialog');if(d)return d;
    d=document.createElement('dialog');d.id='dvB07ReviewDialog';d.className='dvReviewDlg';
    d.innerHTML='<div class="modal"><div class="modalHead"><h2>Bewertung abgeben</h2><button id="dvB07ReviewClose" class="close" type="button">✕</button></div><div id="dvB07ReviewTarget" class="summary"></div><div class="dvB07Stars" role="group" aria-label="Sternebewertung"><button type="button" data-b07-star="1">★</button><button type="button" data-b07-star="2">★</button><button type="button" data-b07-star="3">★</button><button type="button" data-b07-star="4">★</button><button type="button" data-b07-star="5">★</button></div><div class="field"><label>Kommentar optional</label><textarea id="dvB07ReviewComment" maxlength="500" rows="4" placeholder="Wie lief die Transaktion?"></textarea></div><div class="msg">Blind Review: Die Gegenseite sieht deine Bewertung erst, wenn sie ebenfalls bewertet hat oder die 30-Tage-Frist abläuft.</div><button id="dvB07ReviewSend" class="btn gold" type="button" style="width:100%;margin-top:14px">BEWERTUNG VERBINDLICH ABSENDEN</button><div id="dvB07ReviewMsg" class="msg"></div></div>';
    document.body.appendChild(d);
    document.getElementById('dvB07ReviewClose').onclick=()=>d.close();
    d.querySelectorAll('[data-b07-star]').forEach(b=>b.onclick=()=>setStars(Number(b.dataset.b07Star)));
    document.getElementById('dvB07ReviewSend').onclick=submit;
    return d;
  }

  function setStars(value){
    stars=value;dialog().querySelectorAll('[data-b07-star]').forEach(b=>{const on=Number(b.dataset.b07Star)<=stars;b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on))});
  }

  function openReview(kind,id){
    const s=state(kind,id);if(!s||!s.can_review||s.my_review_submitted)return;
    current=s;stars=5;const d=dialog();setStars(5);
    document.getElementById('dvB07ReviewTarget').innerHTML=`<b>${esc(s.subject||'Transaktion')}</b><br><span class="msg">Bewertung für ${esc(s.other_display_name||'Transaktionspartner')} · Frist bis ${fmt(s.review_deadline_at)}</span>`;
    document.getElementById('dvB07ReviewComment').value='';document.getElementById('dvB07ReviewMsg').textContent='';d.showModal();
  }

  async function submit(){
    if(!current)return;const b=document.getElementById('dvB07ReviewSend'),m=document.getElementById('dvB07ReviewMsg');b.disabled=true;m.textContent='Wird gespeichert …';
    const {error}=await db.rpc('submit_market_transaction_review_v1',{p_transaction_kind:current.transaction_kind,p_transaction_id:current.transaction_id,p_stars:stars,p_comment:document.getElementById('dvB07ReviewComment').value.trim()||null});
    b.disabled=false;if(error){m.textContent=error.message||'Bewertung konnte nicht gespeichert werden.';return}
    dialog().close();current=null;await load();
  }

  async function report(reviewId){
    const reason=prompt('Warum möchtest du diese Bewertung melden?');if(!reason?.trim())return;
    const {error}=await db.rpc('report_market_transaction_review_v1',{p_review_id:reviewId,p_reason:reason.trim()});
    if(error){alert(error.message);return}await load();
  }

  function row(s){
    const mine=s.my_review_submitted?`<div class="dvB07ReviewMine"><b>DEINE BEWERTUNG</b> <span>${starText(s.my_stars)}</span>${s.my_comment?`<small>${esc(s.my_comment)}</small>`:''}</div>`:'';
    let action='';
    if(s.can_review&&!s.my_review_submitted)action=`<button class="btn gold" data-b07-review-kind="${s.transaction_kind}" data-b07-review-id="${s.transaction_id}">JETZT BEWERTEN</button>`;
    else if(!s.my_review_submitted)action='<span class="msg">Bewertungsfrist abgelaufen.</span>';
    else if(!s.other_review_visible)action='<span class="msg">Deine Bewertung bleibt verborgen, bis die Gegenseite bewertet oder die 30-Tage-Frist endet.</span>';
    const other=s.other_review_visible?`<div class="dvB07ReviewOther"><b>BEWERTUNG DER GEGENSeite</b> <span>${starText(s.other_stars)}</span>${s.other_comment?`<small>${esc(s.other_comment)}</small>`:''}<button class="btn ghost" type="button" data-b07-report-review="${s.other_review_id}" ${s.other_reported_by_me?'disabled':''}>${s.other_reported_by_me?'GEMELDET ✓':'BEWERTUNG MELDEN'}</button></div>`:'';
    return `<article class="dvB07ReviewCard"><div><span class="eyebrow">${s.transaction_kind==='swap'?'C2C-TAUSCH':'KAUF / VERKAUF'} · ABGESCHLOSSEN ${fmt(s.completed_at)}</span><h3>${esc(s.subject||'Transaktion')}</h3><div class="msg">Mit ${esc(s.other_display_name||'DUELVANTA Member')} · Bewertungsfrist ${fmt(s.review_deadline_at)}</div></div>${mine}${other}<div class="dvB07ReviewActions">${action}</div></article>`;
  }

  function decorate(){
    if(!available)return;
    document.querySelectorAll('[data-deal-review]').forEach(button=>{const s=state('deal',button.dataset.dealReview);if(!s)return;if(s.my_review_submitted){button.disabled=true;button.textContent='BEWERTET ✓'}else if(!s.can_review){button.disabled=true;button.textContent='BEWERTUNGSFRIST ABGELAUFEN'}});
    const dealsTab=document.getElementById('dvDealsTab'),grid=document.getElementById('grid');if(!dealsTab?.classList.contains('active')||!grid)return;
    let center=document.getElementById('dvB07ReviewCenter');if(!center){center=document.createElement('section');center.id='dvB07ReviewCenter';center.className='dvB07ReviewCenter';grid.prepend(center)}
    const sig=states.map(s=>[s.transaction_kind,s.transaction_id,s.my_review_submitted,s.my_stars,s.other_review_visible,s.other_stars,s.other_reported_by_me,s.can_review].join(':')).join('|');
    if(center.dataset.sig===sig)return;center.dataset.sig=sig;
    center.innerHTML=`<div class="dvB07ReviewIntro"><b>BEWERTUNGEN · RELEASE 1</b><br>5 Sterne · eine Bewertung je Person und Transaktion · 30 Tage · Blind Review.</div>${states.length?states.map(row).join(''):'<div class="empty">Noch keine abgeschlossenen Transaktionen zum Bewerten.</div>'}`;
  }

  function install(){
    if(installed||typeof db==='undefined'||typeof user==='undefined'||!user)return false;installed=true;
    const style=document.createElement('style');style.id='dvB07ReviewStyle';style.textContent='.dvB07ReviewCenter{grid-column:1/-1;display:grid;gap:10px;margin-bottom:12px}.dvB07ReviewIntro,.dvB07ReviewCard{border:1px solid rgba(199,164,93,.25);border-radius:13px;padding:13px;background:rgba(199,164,93,.04)}.dvB07ReviewCard h3{margin:5px 0}.dvB07ReviewMine,.dvB07ReviewOther{margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.08);display:grid;gap:5px}.dvB07ReviewMine span,.dvB07ReviewOther span{color:#efd18c;letter-spacing:.08em}.dvB07ReviewMine small,.dvB07ReviewOther small{color:#aab0ba}.dvB07ReviewActions{margin-top:10px}.dvB07Stars{display:flex;justify-content:center;gap:5px;margin:16px 0}.dvB07Stars button{border:0;background:transparent;color:#555;font-size:31px;cursor:pointer;padding:3px}.dvB07Stars button.on{color:#efd18c}';document.head.appendChild(style);
    dialog();
    document.addEventListener('click',event=>{
      const legacy=event.target.closest?.('[data-deal-review]');if(available&&legacy){event.preventDefault();event.stopImmediatePropagation();openReview('deal',legacy.dataset.dealReview);return}
      const review=event.target.closest?.('[data-b07-review-id]');if(review){event.preventDefault();openReview(review.dataset.b07ReviewKind,review.dataset.b07ReviewId);return}
      const reportButton=event.target.closest?.('[data-b07-report-review]');if(reportButton){event.preventDefault();if(!reportButton.disabled)report(reportButton.dataset.b07ReportReview);return}
      if(event.target.closest?.('#dvDealsTab'))setTimeout(load,0);
    },true);
    const grid=document.getElementById('grid');if(grid)new MutationObserver(()=>decorate()).observe(grid,{childList:true,subtree:true});
    load();window.DV_B07_REVIEWS={version:'1.0',refresh:load};return true;
  }

  let tries=0;const wait=setInterval(()=>{tries++;if(install()||tries>150)clearInterval(wait)},80);
})();
