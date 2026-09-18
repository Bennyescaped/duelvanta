/* Additive player-page links/counts only. Never wraps or changes the player/WebRTC lifecycle. */
(()=>{
  'use strict';
  const byId=id=>document.getElementById(id);
  const active=new Set(['waiting','ready','live','dispute']);
  let matchId=null,revision=0,busy=false,reading=false,enabled=null,mediaBusy=false;
  const link=document.createElement('link');link.rel='stylesheet';link.href='battle-spectator.css';document.head.append(link);
  const lobbyLink=document.createElement('a');lobbyLink.className='btn ghost';lobbyLink.href='battle-spectator.html';lobbyLink.textContent='ZUSCHAUEN · OHNE VIDEO';
  document.querySelector('#lobbyView .battleTabs')?.append(lobbyLink);
  const panel=document.createElement('section');panel.id='battleSpectatorPanel';panel.hidden=true;
  panel.innerHTML='<div class="eyebrow">SPECTATOR FOUNDATION V1</div><h3 id="bspCount">Zuschauerzahl wird geprüft …</h3><p id="bspStatus" class="meta"></p><div id="bspControls" class="spectator-actions" hidden><button id="bspCreate" class="btn gold">ZUSCHAUERLINK ERSTELLEN / ERSETZEN</button><button id="bspRevoke" class="btn danger" hidden>ZUSCHAUERZUGANG WIDERRUFEN</button></div><div id="bspShare" hidden><label for="bspLink">Separater Zuschauerlink · kein Spieler-Code</label><div class="spectator-actions"><input id="bspLink" readonly autocomplete="off"><button id="bspCopy" class="btn ghost">LINK KOPIEREN</button></div></div><div id="bspMedia" hidden><div class="eyebrow">SPECTATOR MEDIA V1 · STAGING</div><p class="meta">Nur wenn Host und Gast separat zustimmen, dürfen autorisierte Zuschauer Kamera und Audio live empfangen. DUELVANTA führt in Media V1 keine dauerhafte Webcam-Aufzeichnung ein. Die Zustimmung kann jederzeit zurückgenommen werden; das Spieler-Match läuft weiter.</p><button id="bspMediaConsent" class="btn ghost">LIVE-ZUSCHAUERÜBERTRAGUNG ERLAUBEN</button><p id="bspMediaStatus" class="meta"></p></div><p id="bspMessage" class="meta" role="status" aria-live="polite"></p>';
  byId('arenaView')?.append(panel);
  const shareURL=(id,code)=>{const url=new URL('battle-spectator.html',location.href);url.searchParams.set('match',id);if(code)url.hash='spectator='+encodeURIComponent(code);return url.href;};
  function reset(){revision++;matchId=null;enabled=null;panel.hidden=true;byId('bspLink').value='';byId('bspShare').hidden=true;byId('bspMessage').textContent='';}
  function sync(){
    if(typeof currentMatch==='undefined'||!currentMatch||typeof user==='undefined'||!user){if(matchId)reset();return null;}
    const m=currentMatch;
    if(![m.host_id,m.guest_id,m.moderator_id].includes(user.id)){reset();return null;}
    if(matchId!==m.id){reset();matchId=m.id;byId('bspCount').textContent='Zuschauerzahl wird geprüft …';byId('bspStatus').textContent='';}
    panel.hidden=false;
    const player=[m.host_id,m.guest_id].includes(user.id)&&['waiting','ready','live'].includes(m.status);byId('bspMedia').hidden=!player;
    const privateHost=m.visibility==='private'&&m.host_id===user.id&&active.has(m.status);
    byId('bspControls').hidden=!privateHost;
    byId('bspCreate').disabled=busy||enabled===null;byId('bspRevoke').disabled=busy||enabled===null;
    if(m.visibility==='private'&&!privateHost){byId('bspShare').hidden=true;byId('bspLink').value='';}
    if(m.visibility==='public'&&active.has(m.status)){byId('bspShare').hidden=false;byId('bspLink').value=shareURL(m.id);}
    if(!active.has(m.status)){byId('bspShare').hidden=true;byId('bspLink').value='';}
    return m;
  }
  async function tick(){
    const m=sync();if(!m||document.hidden||reading||busy)return;
    const id=m.id,ticket=revision;reading=true;
    try{
      const {data,error}=await db.rpc('get_battle_spectator_status',{p_match_id:id});
      if(ticket!==revision||currentMatch?.id!==id)return;
      if(error)throw error;
      enabled=!!data?.link_enabled;byId('bspCreate').disabled=false;byId('bspRevoke').disabled=false;
      byId('bspCount').textContent=(Number(data?.spectator_count)||0)+' Zuschauer';
      byId('bspStatus').textContent=m.visibility==='public'?'Öffentlich: berechtigte BATTLE-Nutzer können den Matchstatus verfolgen.':enabled?'Separater Zuschauerlink aktiv. Ersetzen oder Widerrufen beendet bestehende Zuschauerberechtigungen.':'Privater Zuschauerzugang geschlossen. Der Spieler-Einladungscode gilt hier nicht.';
      byId('bspRevoke').hidden=!enabled;
      if([m.host_id,m.guest_id].includes(user.id)&&['waiting','ready','live'].includes(m.status)){const media=await db.rpc('get_battle_spectator_media_status',{p_match_id:id});if(media.error)throw media.error;const s=media.data||{},mine=!!s.my_consent;byId('bspMediaConsent').textContent=mine?'LIVE-ZUSCHAUERÜBERTRAGUNG STOPPEN':'LIVE-ZUSCHAUERÜBERTRAGUNG ERLAUBEN';byId('bspMediaConsent').className=mine?'btn danger':'btn ghost';byId('bspMediaConsent').disabled=mediaBusy;byId('bspMediaStatus').textContent=s.media_open?'Beide Spieler haben zugestimmt. Media bleibt bis zur serverseitigen Staging-Freigabe geschlossen, falls der globale Schalter aus ist.':mine?'Deine Zustimmung ist gespeichert. Warte auf die Zustimmung des anderen Spielers bzw. die Staging-Freigabe.':'Keine Zustimmung für dieses Match erteilt.';}

    }catch{
      if(ticket===revision&&currentMatch?.id===id){enabled=null;byId('bspCreate').disabled=true;byId('bspRevoke').disabled=true;byId('bspCount').textContent='Zuschauerzahl nicht verfügbar';byId('bspStatus').textContent='Zuschauerstatus konnte nicht bestätigt werden.';}
    }finally{reading=false;}
  }
  async function setLink(on){
    const m=sync();if(!m||busy||enabled===null||m.host_id!==user.id||m.visibility!=='private'||!active.has(m.status))return;
    if((!on||enabled)&&!confirm(on?'Bisherigen Zuschauerlink und alle damit erteilten Berechtigungen widerrufen und ersetzen?':'Zuschauerzugang widerrufen? Bereits beigetretene Zuschauer verlieren den Zugang.'))return;
    const id=m.id,ticket=++revision;busy=true;byId('bspCreate').disabled=true;byId('bspRevoke').disabled=true;
    byId('bspLink').value='';byId('bspShare').hidden=true;byId('bspMessage').textContent='Zuschauerberechtigung wird gespeichert …';
    try{
      const {data,error}=await db.rpc('set_battle_spectator_link',{p_match_id:id,p_enabled:on});
      if(ticket!==revision||currentMatch?.id!==id)return;
      if(error)throw error;
      enabled=!!data.enabled;byId('bspRevoke').hidden=!enabled;
      if(on&&data.code){byId('bspLink').value=shareURL(id,data.code);byId('bspShare').hidden=false;}
      byId('bspMessage').textContent=on?'Dieser Link wird nur jetzt angezeigt. Bitte kopieren. Er vergibt ausschließlich Zuschauerzugang.':'Zuschauerlink und bestehende Berechtigungen wurden widerrufen. Der Spieler-Code bleibt unverändert.';
    }catch{if(ticket===revision&&currentMatch?.id===id)byId('bspMessage').textContent='Speichern fehlgeschlagen. Bitte den Status erneut prüfen.';}
    finally{busy=false;byId('bspCreate').disabled=false;byId('bspRevoke').disabled=false;void tick();}
  }
  byId('bspMediaConsent').onclick=async()=>{const m=sync();if(!m||mediaBusy||![m.host_id,m.guest_id].includes(user.id)||!['waiting','ready','live'].includes(m.status))return;mediaBusy=true;byId('bspMediaConsent').disabled=true;try{const status=await db.rpc('get_battle_spectator_media_status',{p_match_id:m.id});if(status.error)throw status.error;const next=!status.data?.my_consent;if(!next&&!confirm('Live-Zuschauerübertragung für dieses Match stoppen? Das Spieler-Match läuft weiter.'))return;const result=await db.rpc('set_battle_spectator_media_consent',{p_match_id:m.id,p_granted:next});if(result.error)throw result.error;byId('bspMessage').textContent=next?'Zustimmung für dieses Match gespeichert. Medien starten erst nach Zustimmung beider Spieler und serverseitiger Freigabe.':'Zustimmung zurückgenommen. Zuschauer-Medien werden geschlossen; das Spieler-Match läuft weiter.';}catch{byId('bspMessage').textContent='Media-Zustimmung konnte nicht gespeichert werden.';}finally{mediaBusy=false;void tick();}};
  byId('bspCreate').onclick=()=>void setLink(true);
  byId('bspRevoke').onclick=()=>void setLink(false);
  byId('bspCopy').onclick=async()=>{
    const value=byId('bspLink').value;if(!value)return;
    try{await navigator.clipboard.writeText(value);byId('bspMessage').textContent='Zuschauerlink kopiert.';}
    catch{byId('bspLink').focus();byId('bspLink').select();byId('bspMessage').textContent='Bitte den markierten Zuschauerlink kopieren.';}
  };
  window.addEventListener('pagehide',reset);
  setInterval(tick,5000);void tick();
})();
