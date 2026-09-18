/* Independent spectator client. No player runtime, signaling or media APIs. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const message=text=>{$('spMessage').textContent=text;};
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const CODE=/^SP-[0-9A-F]{64}$/;
  const activeStatuses=new Set(['waiting','ready','live','dispute']);
  const statusText={waiting:'WARTET AUF GEGNER',ready:'SPIELER VERBUNDEN',live:'MATCH LÄUFT',dispute:'ERGEBNIS WIRD GEPRÜFT',completed:'MATCH ABGESCHLOSSEN',cancelled:'MATCH BEENDET'};
  if(!window.supabase?.__dvRuntimeGuard){message('Sicherer Umgebungszugang fehlt. Bitte die Seite neu laden.');return;}
  const db=window.supabase.createClient('https://xhmjxrcskfhbovhitdej.supabase.co','sb_publishable_KNlm6LzvSxCaGwLc_1mPbA_-z1we46N',{auth:{persistSession:true,autoRefreshToken:true}});
  let actor=null,attempt=null,version=0,listVersion=0,tcg='pokemon',timer=null,watchdog=null,resumeId=null;
  function errorText(error){
    const text=String(error?.message||'');
    if(text.includes('battle_access_required'))return 'Bitte bestätige zuerst die BATTLE-Safety-Regeln in der Spieler-Lobby. Ein eingeschränkter Account kann nicht zuschauen.';
    if(/not_authenticated|session_unavailable/.test(text))return 'Deine Sitzung ist nicht mehr gültig. Bitte melde dich erneut an.';
    if(text.includes('role_conflict')||text.includes('read_only'))return 'Du bist in diesem Match Spieler oder Judge. Zuschauer- und Spielerrollen bleiben getrennt.';
    if(text.includes('tab_limit'))return 'Zu viele Zuschaueransichten geöffnet. Bitte schließe eine andere Ansicht.';
    if(text.includes('unavailable'))return 'Kein Zuschauerzugang: Match beendet, Code ungültig oder Berechtigung widerrufen.';
    if(text.includes('presence_expired'))return 'Deine Zuschaueranwesenheit ist abgelaufen. Bitte tritt erneut bei.';
    return 'Der Zuschauerstatus konnte nicht bestätigt werden. Bitte prüfe die Verbindung und versuche es erneut.';
  }
  // A timed-out mutation may still finish server-side: clean up a late success, never revive the UI.
  async function request(name,args,onLate){
    let timeout,expired=false;
    const raw=Promise.resolve(db.rpc(name,args));
    raw.then(result=>{if(expired)onLate?.(result);},()=>{});
    try{return await Promise.race([raw,new Promise((_,reject)=>{timeout=setTimeout(()=>{expired=true;reject(new Error('spectator_network_timeout'));},12000);})]);}
    finally{clearTimeout(timeout);}
  }
  function clearTimers(){clearTimeout(timer);clearTimeout(watchdog);timer=null;watchdog=null;}
  function clearView(){
    $('spView').hidden=true;
    for(const id of ['spTitle','spMeta','spHost','spGuest','spHostReady','spGuestReady','spStatus','spModeration','spResult','spFreshness'])$(id).textContent='';
    $('spCount').textContent='—';
  }
  async function release(a,id=a?.id){
    if(!a||!id)return;
    try{await db.rpc('leave_battle_spectator',{p_match_id:id,p_tab_id:a.tab});}catch{/* The server lease is the disconnect fallback. */}
  }
  function stop({keepResume=true}={}){
    const old=attempt;version++;listVersion++;attempt=null;clearTimers();clearView();
    if(keepResume&&old?.id)resumeId=old.id;
    if(!keepResume)resumeId=null;
    $('spLeave').hidden=true;$('spDirectory').hidden=!actor;$('spReconnect').hidden=!resumeId||!actor;
    if(old)void release(old);
  }
  function fail(error,a){
    if(a&&attempt!==a)return;
    stop();message(errorText(error));
    if(/not_authenticated|session_unavailable/.test(String(error?.message||'')))$('spLogin').hidden=false;
  }
  function render(envelope,a){
    const m=envelope?.match;
    if(!m||!UUID.test(m.id)||m.id!==a.id)throw new Error('spectator_invalid_response');
    $('spTitle').textContent=m.title||'BATTLE Match';
    $('spMeta').textContent=(m.tcg==='pokemon'?'Pokémon':'One Piece')+' · '+(m.mode==='ranked'?'Ranked':'Casual')+' · '+(m.visibility==='private'?'Privat':'Öffentlich');
    $('spHost').textContent=m.host_name||'Host';$('spGuest').textContent=m.guest_name||'Gastplatz noch frei';
    $('spHostReady').textContent=m.host_ready?'Bereit ✓':'Noch nicht bereit';$('spGuestReady').textContent=m.guest_ready?'Bereit ✓':'Noch nicht bereit';
    $('spCount').textContent=String(Math.max(0,Number(m.spectator_count)||0));
    $('spStatus').textContent=m.paused?'MATCH DURCH MODERATION PAUSIERT':statusText[m.status]||'MATCHSTATUS';
    $('spModeration').textContent=m.moderator_present?'Ein Judge ist dem Match sichtbar beigetreten.':'';
    $('spResult').textContent=m.status==='completed'?({host:'Ergebnis: Host gewinnt.',guest:'Ergebnis: Gast gewinnt.',draw:'Ergebnis: Unentschieden.'}[m.result]||''):'';
    $('spFreshness').textContent='Serverseitig bestätigt · automatischer Abgleich alle 20 Sekunden';
    $('spDirectory').hidden=true;$('spView').hidden=false;$('spLeave').hidden=false;$('spReconnect').hidden=true;
    const live=activeStatuses.has(m.status)&&!!envelope.lease_expires_at;
    a.live=live;$('spRefreshMatch').hidden=!live;
    clearTimers();
    if(live){
      timer=setTimeout(()=>void heartbeat(a),20000);
      watchdog=setTimeout(()=>fail(new Error('spectator_presence_expired'),a),70000);
      message('Du schaust zu. Du belegst keinen Spielerplatz und hast keine Spiel- oder Moderationsrechte.');
    }else{
      $('spFreshness').textContent='Abschlussstand · Zuschaueranwesenheit beendet';
      message('Dieses Match ist beendet. Deine Zuschaueranwesenheit wurde geschlossen.');
    }
  }
  async function heartbeat(a=attempt){
    if(!a||attempt!==a||!a.live||a.busy)return;
    a.busy=true;
    try{
      const result=await request('heartbeat_battle_spectator',{p_match_id:a.id,p_tab_id:a.tab},()=>void release(a));
      if(attempt!==a){void release(a);return;}
      if(result.error)throw result.error;
      render(result.data,a);
    }catch(error){fail(error,a);}finally{a.busy=false;}
  }
  async function watch(id=null,code=null){
    if(!actor)return;
    stop({keepResume:false});
    const a={id,tab:crypto.randomUUID(),version:++version,live:false,busy:false};
    attempt=a;listVersion++;$('spDirectory').hidden=true;$('spLeave').hidden=false;
    message('Zuschauerberechtigung wird geprüft …');
    try{
      const result=await request('join_battle_spectator',{p_match_id:id,p_tab_id:a.tab,p_code:code},late=>{if(late.data?.match?.id)void release(a,late.data.match.id);});
      if(attempt!==a||version!==a.version){if(result.data?.match?.id)void release(a,result.data.match.id);return;}
      if(result.error)throw result.error;
      if(!UUID.test(result.data?.match?.id||''))throw new Error('spectator_invalid_response');
      a.id=result.data.match.id;resumeId=a.id;
      // The secret is never put in query parameters or persistent client storage.
      history.replaceState(null,'','battle-spectator.html?match='+encodeURIComponent(a.id));
      $('spCode').value='';
      render(result.data,a);
    }catch(error){fail(error,a);}
  }
  function parseInvitation(value){
    const raw=value.trim();
    if(CODE.test(raw.toUpperCase()))return {id:null,code:raw.toUpperCase()};
    const url=new URL(raw,location.href);
    if(url.origin!==location.origin||!url.pathname.endsWith('/battle-spectator.html'))throw new Error('spectator_unavailable');
    const id=url.searchParams.get('match'),code=new URLSearchParams(url.hash.slice(1)).get('spectator')?.toUpperCase()||null;
    if((id&&!UUID.test(id))||(code&&!CODE.test(code))||(!id&&!code))throw new Error('spectator_unavailable');
    return {id,code};
  }
  async function loadDirectory(){
    if(!actor||attempt)return;
    const revision=++listVersion,selected=tcg;$('spMatches').textContent='Öffentliche Matches werden geladen …';
    try{
      const {data,error}=await request('list_battle_spectator_matches',{p_tcg:selected});
      if(revision!==listVersion||attempt||selected!==tcg)return;
      if(error)throw error;
      if(!Array.isArray(data))throw new Error('spectator_invalid_response');
      $('spMatches').replaceChildren();
      for(const m of data){
        if(!UUID.test(m.id)||m.visibility!=='public')continue;
        const card=document.createElement('article');card.className='matchCard';
        const title=document.createElement('h3');title.textContent=m.title||'BATTLE Match';
        const players=document.createElement('p');players.className='meta';players.textContent=(m.host_name||'Host')+' · '+(m.guest_name||'Wartet auf Gegner');
        const meta=document.createElement('p');meta.className='meta';meta.textContent=(m.mode==='ranked'?'Ranked':'Casual')+' · '+(statusText[m.status]||'Match')+' · '+(Number(m.spectator_count)||0)+' Zuschauer';
        const button=document.createElement('button');button.className='btn gold';button.type='button';button.textContent='ZUSCHAUEN · OHNE VIDEO';button.dataset.watch=m.id;
        card.append(title,players,meta,button);$('spMatches').append(card);
      }
      if(!$('spMatches').children.length)$('spMatches').textContent='Aktuell sind keine öffentlichen Matches zum Zuschauen verfügbar.';
    }catch(error){if(revision===listVersion&&!attempt){$('spMatches').textContent='';message(errorText(error));}}
  }
  $('spLeave').onclick=()=>{stop({keepResume:false});message('Zuschauen beendet.');void loadDirectory();};
  $('spReconnect').onclick=()=>void watch(resumeId);
  $('spRefresh').onclick=()=>void loadDirectory();
  $('spRefreshMatch').onclick=()=>void heartbeat();
  $('spMatches').onclick=event=>{const id=event.target.closest('[data-watch]')?.dataset.watch;if(id)void watch(id);};
  document.querySelectorAll('[data-spectator-tcg]').forEach(button=>button.addEventListener('click',()=>{
    tcg=button.dataset.spectatorTcg;
    document.querySelectorAll('[data-spectator-tcg]').forEach(other=>{other.classList.toggle('active',other===button);other.setAttribute('aria-pressed',String(other===button));});
    void loadDirectory();
  }));
  $('spCodeForm').onsubmit=event=>{event.preventDefault();try{const invitation=parseInvitation($('spCode').value);void watch(invitation.id,invitation.code);}catch(error){message(errorText(error));}};
  $('spLogout').onclick=async()=>{stop({keepResume:false});await db.auth.signOut();location.replace('login.html');};
  window.addEventListener('pagehide',()=>stop());
  window.addEventListener('pageshow',event=>{if(event.persisted&&resumeId&&actor)void watch(resumeId);});
  db.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'||(actor&&session?.user?.id&&session.user.id!==actor)){
      actor=null;stop({keepResume:false});$('spLogin').hidden=false;$('spLogout').hidden=true;message('Bitte melde dich an, um zuzuschauen.');
    }
  });
  async function boot(){
    const revision=version;
    try{
      const {data,error}=await db.auth.getSession();if(revision!==version)return;if(error)throw error;
      actor=data?.session?.user?.id||null;
      const query=new URLSearchParams(location.search),id=query.get('match');
      $('spLogin').href='login.html?next='+encodeURIComponent('battle-spectator.html'+(id&&UUID.test(id)?'?match='+id:''));
      if(!actor){$('spLogin').hidden=false;message('Bitte melde dich an. Einen privaten Zuschauerlink danach erneut öffnen.');return;}
      $('spLogout').hidden=false;$('spDirectory').hidden=false;
      const code=new URLSearchParams(location.hash.slice(1)).get('spectator')?.toUpperCase()||null;
      if(id||code){
        if((id&&!UUID.test(id))||(code&&!CODE.test(code))){message(errorText(new Error('spectator_unavailable')));return;}
        await watch(id,code);
      }else{message('Wähle ein öffentliches Match oder nutze einen separaten Zuschauerlink.');await loadDirectory();}
    }catch(error){message(errorText(error));}
  }
  void boot();
})();
