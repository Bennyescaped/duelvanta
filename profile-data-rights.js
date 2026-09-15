(()=>{
  const $=id=>document.getElementById(id),db=window.__dvAppDb;
  if(!db)return;
  const message=(id,text,kind='')=>{const node=$(id);node.textContent=text;node.className='msg '+kind};
  const blockerLabels={owner_account_requires_manual_transfer:'Der Owner-Account muss zuerst kontrolliert übertragen werden.',active_market_listings:'Aktive oder reservierte Angebote sind noch vorhanden.',open_market_offers:'Offene oder angenommene Angebote sind noch vorhanden.',open_market_orders:'Noch nicht abgeschlossene Bestellungen sind vorhanden.',open_market_cases:'Offene Bestellfälle sind vorhanden.',open_notice_appeals:'Offene Einsprüche sind vorhanden.'};
  const securityMsg=$('securityMsg'),passwordButton=$('setPassword');
  (async()=>{try{const{data:{session}}=await db.auth.getSession();if(!session||!securityMsg)return;const{data:profile,error}=await db.from('profiles').select('role').eq('id',session.user.id).single();if(error||!['owner','admin','moderator','judge'].includes(profile?.role))return;const mfaButton=document.createElement('button');mfaButton.type='button';mfaButton.className='gold';mfaButton.textContent='2FA / AUTHENTICATOR VERWALTEN';mfaButton.style.marginTop='10px';mfaButton.onclick=()=>location.assign('mfa.html?manage=1&next=profile.html');securityMsg.parentNode.insertBefore(mfaButton,securityMsg.nextSibling)}catch(error){console.warn('MFA management availability could not be checked',error)}})();
  if(passwordButton&&typeof passwordButton.onclick==='function'){const originalPasswordHandler=passwordButton.onclick;passwordButton.onclick=async event=>{try{const{data,error}=await db.auth.mfa.getAuthenticatorAssuranceLevel();if(error)throw error;if(data?.nextLevel==='aal2'&&data.currentLevel!=='aal2'){message('securityMsg','Bestätige zuerst deinen zweiten Faktor. Danach kannst du das Passwort ändern.','bad');setTimeout(()=>location.assign('mfa.html?required=1&next=profile.html'),500);return}}catch(error){message('securityMsg','Sicherheitsstatus konnte nicht geprüft werden. Passwort wurde nicht geändert.','bad');return}return originalPasswordHandler.call(passwordButton,event)}}
  $('exportMyData')?.addEventListener('click',async event=>{
    const button=event.currentTarget;button.disabled=true;message('dataExportMsg','Export wird erstellt …');
    try{const{data,error}=await db.rpc('export_my_duelvanta_data');if(error)throw error;const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`duelvanta-datenexport-${new Date().toISOString().slice(0,10)}.json`;document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);message('dataExportMsg','Export wurde lokal heruntergeladen.','ok')}
    catch(error){message('dataExportMsg',error?.message?.includes('Could not find')?'Der Datenexport ist in dieser Review-Umgebung noch nicht aktiviert.':'Export fehlgeschlagen. Bitte später erneut versuchen.','bad')}
    finally{button.disabled=false}
  });
  $('requestAccountDeletion')?.addEventListener('click',async event=>{
    const confirmation=$('deleteAccountConfirmation').value;if(confirmation!=='KONTO LÖSCHEN'){message('accountDeletionMsg','Die Bestätigung stimmt nicht exakt überein.','bad');return}
    const button=event.currentTarget;button.disabled=true;message('accountDeletionMsg','Voraussetzungen werden geprüft …');
    try{const{data,error}=await db.rpc('request_my_account_deletion',{p_confirmation:confirmation,p_request_key:crypto.randomUUID()});if(error)throw error;if(!data?.accepted){const details=(data?.blockers||[]).map(key=>blockerLabels[key]||key).join(' ');message('accountDeletionMsg',details||'Die Löschung kann derzeit nicht gestartet werden.','bad');return}message('accountDeletionMsg','Anforderung angenommen. Der Zugang wird gesperrt und die Daten werden serverseitig verarbeitet.','ok');await db.auth.signOut({scope:'global'}).catch(()=>null);setTimeout(()=>location.replace('login.html'),700)}
    catch(error){message('accountDeletionMsg',error?.message?.includes('Could not find')?'Die Kontolöschung ist in dieser Review-Umgebung noch nicht aktiviert.':'Anforderung fehlgeschlagen. Es wurden keine Daten gelöscht.','bad')}
    finally{button.disabled=false}
  });
})();
