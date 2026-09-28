/* Owner correction desk. Every decision is re-authorized by the server. */
(() => {
  const button=document.createElement('button');
  button.className='tab';button.dataset.tab='safety';button.textContent='SAFETY-KORREKTUR';
  document.querySelector('.tabs').appendChild(button);
  button.onclick=()=>{tab='safety';render()};
  const original=render;
  render=function(){
    if(tab!=='safety')return original();
    document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    $('sectionTitle').textContent='Einzelne Safety-Sanktion prüfen';
    $('content').innerHTML='<p>Eine Korrektur betrifft nur die ausgewählte Ursache. Andere Sperren und offene Fälle bleiben bestehen.</p><label>Zielnutzer <select id="safetyTarget"><option value="">Bitte auswählen</option></select></label><div id="safetyCauses" aria-live="polite"></div>';
    const select=$('safetyTarget');
    for(const p of data.profiles.filter(p=>p.role!=='owner')){
      const o=document.createElement('option');o.value=p.id;o.textContent=p.display_name||p.username||p.id;select.appendChild(o);
    }
    select.onchange=()=>load(select.value);
  };
  let generation=0;
  async function load(target){
    const token=++generation,box=$('safetyCauses');if(!target){box.textContent='';return}
    box.textContent='Ursachen werden gelesen …';
    const {data:state,error}=await db.rpc('get_owner_battle_safety_causes',{p_target_id:target});
    if(token!==generation||!box.isConnected)return;
    if(error){box.textContent=error.message;return}
    box.textContent=state.data_rights_blocked?'Ziel durch Data-Rights-/Closure-Zustand geschützt. Keine Aufhebung möglich.':'';
    if(!state.causes.length){box.textContent+=' Keine dokumentierten Safety-Ursachen.';return}
    for(const cause of state.causes){
      const card=document.createElement('article'),description=document.createElement('p');
      description.textContent=`${cause.kind==='b1'?'Moderationssanktion':'Legacy / unbekannte Ursache'} · ${cause.id} · ${cause.active?'aktiv':'aufgehoben'} · Report: ${cause.report_id||'nicht zugeordnet'}`;
      card.appendChild(description);
      if(cause.active){
        const action=document.createElement('button');action.className='miniBtn';
        action.textContent=cause.kind==='b1'?'Diese Sanktion korrigieren':'Separater Legacy-Review';
        action.disabled=state.data_rights_blocked||(cause.kind==='legacy_unknown'&&state.causes.some(c=>c.id!==cause.id&&c.active));
        action.onclick=async()=>{
          const reason=prompt('Begründeter Korrekturgrund (keine automatische Freigabe anderer Ursachen):','');
          if(!reason?.trim())return;
          if(reason.trim().length>1000){alert('Maximal 1000 Zeichen.');return}
          if(!confirm('Genau diese Ursache nach Prüfung beenden? Originalbelege und andere Sperren bleiben erhalten.'))return;
          action.disabled=true;
          const legacy=cause.kind==='legacy_unknown';
          const {error,...response}=await db.rpc(legacy?'owner_review_legacy_battle_safety':'owner_unrestrict_battle_sanction',legacy?{p_cause_id:cause.id,p_reason:reason.trim()}:{p_sanction_id:cause.id,p_reason:reason.trim()});
          if(error)alert(error.message);
          else alert(response.data?.safety_restricted?'Diese Ursache ist beendet. Eine weitere Safety-Ursache bleibt wirksam.':'Diese Ursache ist beendet. Andere Zugangsvoraussetzungen bleiben unverändert.');
          if($('safetyTarget')?.value===target)await load(target);
        };
        card.appendChild(action);
      }
      box.appendChild(card);
    }
  }
})();
