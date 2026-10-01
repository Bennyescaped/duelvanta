// Explicit own withdrawal outside the Arena. No status/admission RPC and no media API.
(()=>{
  const db=window.__dvAppDb,root=document.getElementById('spectatorWithdrawal');
  if(!db||!root)return;
  const list=root.querySelector('[data-withdrawal-list]'),message=root.querySelector('[data-withdrawal-message]');
  let revision=0;
  async function refresh(){
    const version=++revision;root.hidden=true;list.replaceChildren();message.textContent='';
    try{
      const {data:{session}}=await db.auth.getSession();if(!session)return;
      const uid=session.user.id;
      const {data:profile,error}=await db.from('profiles').select('data_processing_restricted_at').eq('id',uid).single();
      if(error)throw error;if(!profile?.data_processing_restricted_at||version!==revision)return;
      root.hidden=false;
      const {data:matches,error:matchError}=await db.from('battle_matches')
        .select('id,host_id,guest_id,visibility,status,title').or(`host_id.eq.${uid},guest_id.eq.${uid}`)
        .in('status',['waiting','ready','live','dispute']);
      if(matchError)throw matchError;if(version!==revision)return;
      for(const m of matches||[]){
        if(m.host_id!==uid&&m.guest_id!==uid)continue;
        const row=document.createElement('div'),label=document.createElement('p');
        label.textContent=(m.title||'Match')+' · '+m.id;row.append(label);
        function button(text,rpc,key){
          const b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent=text;
          b.onclick=async()=>{
            b.disabled=true;message.textContent='Rücknahme wird geprüft …';
            try{
              const {data:{session:current}}=await db.auth.getSession();
              if(version!==revision||current?.user.id!==uid)throw Error('Bitte erneut anmelden und die Seite neu laden.');
              const {data,error}=await db.rpc(rpc,{p_match_id:m.id,[key]:false});if(error)throw error;
              if(version===revision)message.textContent=data?.withdrawn?'Zurückgenommen.':'Kein bestehender aktiver Zustand zurückzunehmen.';
            }catch(e){if(version===revision)message.textContent='Rücknahme nicht möglich: '+(e.message||'Bitte erneut versuchen.');}
            finally{b.disabled=false;}
          };row.append(b);
        }
        if(['waiting','ready','live'].includes(m.status))button('Eigenes Media-Consent zurückziehen','set_battle_spectator_media_consent','p_granted');
        if(m.host_id===uid&&m.visibility==='private'&&['waiting','ready','live','dispute'].includes(m.status))button('Privaten Zuschauerlink deaktivieren','set_battle_spectator_link','p_enabled');
        if(row.children.length>1)list.append(row);
      }
      if(!list.children.length)message.textContent='Keine zuständigen Matches für diese Rücknahme vorhanden.';
    }catch(e){if(version===revision){root.hidden=false;message.textContent='Rücknahme konnte nicht geladen werden. Bitte die Seite neu laden.';}}
  }
  root.querySelector('[data-withdrawal-refresh]').onclick=refresh;
  window.addEventListener('focus',refresh);
  // Clear stale account state immediately, fetch after the auth callback has returned.
  db.auth.onAuthStateChange?.(()=>{++revision;root.hidden=true;list.replaceChildren();setTimeout(refresh,0);});
  void refresh();
})();
