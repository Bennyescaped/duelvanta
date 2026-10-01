(()=>{
 'use strict';
 const $=id=>document.getElementById(id),message=text=>$('message').textContent=text,key='dv-c-withdrawal-challenge-v1';
 if(!window.DV_SUPABASE||!window.supabase){message('Der Zugang ist derzeit nicht verfügbar.');return;}
 const db=window.supabase.createClient(window.DV_SUPABASE.url,window.DV_SUPABASE.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 let user,pending,reauth=false,busy=false;
 try{pending=JSON.parse(localStorage.getItem(key)||'null');}catch{localStorage.removeItem(key);}
 const save=()=>pending?localStorage.setItem(key,JSON.stringify(pending)):localStorage.removeItem(key);
 const run=async fn=>{if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){
 const m=e?.message||'';message(/c_mfa_required/.test(m)?'Bestätige deinen vorhandenen zweiten Faktor. Ohne gültige Bestätigung ist keine Rücknahme möglich.':/c_renewed_auth_required/.test(m)?'Bitte melde dich für diese Rücknahme erneut an.':/c_provenance|c_prepare_or_history/.test(m)?'Diese Löschanfrage kann nicht sicher zurückgenommen werden. Sie bleibt unverändert.':/Could not find|does not exist/.test(m)?'Die Rücknahme ist in dieser Umgebung noch nicht verfügbar.':'Die Aktion konnte nicht bestätigt werden. Es wurde keine erfolgreiche Rücknahme bestätigt.');
 }finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}};
 async function verifiedUser(){const {data,error}=await db.auth.getUser();if(error||!data?.user)throw error||Error('auth_required');return data.user;}
 async function mfa(){const {data,error}=await db.auth.mfa.getAuthenticatorAssuranceLevel();if(error)throw error;if(data?.nextLevel!=='aal2'||data.currentLevel==='aal2')return true;
 const factors=await db.auth.mfa.listFactors();if(factors.error)throw factors.error;
 $('factorId').replaceChildren();for(const f of factors.data?.totp||[])if(f.status==='verified'){const o=document.createElement('option');o.value=f.id;o.textContent=f.friendly_name||'Authenticator';$('factorId').append(o);}
 $('factor').hidden=false;message('Bestätige deinen bestehenden zweiten Faktor.');return false;}
 async function complete(){
 user=await verifiedUser();if(pending&&pending.user!==user.id){pending=null;save();throw Error('account_changed');}
 if(!await mfa())return;
 $('factor').hidden=true;
 if(pending&&(reauth||pending.returning)){
 const {data,error}=await db.rpc('withdraw_my_account_deletion',{p_request_id:pending.request,p_challenge_id:pending.challenge});if(error)throw error;
 if(!data?.withdrawn||!data.receipt_id||data.request_id!==pending.request)throw Error('withdrawal_unconfirmed');
 pending=null;save();$('signin').hidden=true;$('requests').hidden=true;message('Deine Löschanfrage wurde zurückgenommen. Quittung: '+data.receipt_id+'. Andere Sperren bleiben bestehen; deine Collection bleibt privat.');return;
 }
 if(pending){$('signin').hidden=false;$('requests').hidden=true;$('login').textContent='Erneut anmelden und Rücknahme bestätigen';message('Melde dich für diese konkrete Rücknahme erneut an.');return;}
 const {data,error}=await db.rpc('get_my_account_deletion_requests');if(error)throw error;
 $('request').replaceChildren();for(const r of data||[]){const o=document.createElement('option');o.value=r.request_id;o.textContent=r.request_id+' · '+r.status;$('request').append(o);}
 $('requests').hidden=!(data?.length);$('signin').hidden=true;message(data?.length?'Wähle deine konkrete Anfrage. Die endgültige Prüfung erfolgt nach erneuter Anmeldung.':'Es ist keine Löschanfrage für dieses Konto vorhanden.');
 }
 $('begin').onclick=()=>run(async()=>{user=await verifiedUser();const request=$('request').value;if(!request)throw Error('request_required');const {data,error}=await db.rpc('begin_my_account_deletion_withdrawal',{p_request_id:request});if(error)throw error;pending={request,challenge:data,user:user.id};save();reauth=false;$('email').value=user.email||'';await complete();});
 $('signin').onsubmit=e=>{e.preventDefault();run(async()=>{const password=$('password').value;$('password').value='';if(!password)throw Error('password_required');const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password});if(error)throw error;reauth=Boolean(pending);await complete();});};
 $('emailLink').onclick=()=>run(async()=>{if(pending){pending.returning=true;save();}const {error}=await db.auth.signInWithOtp({email:$('email').value.trim(),options:{shouldCreateUser:false,emailRedirectTo:location.origin+'/account-deletion-withdrawal.html'}});if(error)throw error;message('Bestätige den bestehenden E-Mail-Login in diesem Browser. Die Rücknahme wird danach erneut geprüft.');});
 $('verify').onclick=()=>run(async()=>{const factorId=$('factorId').value,code=$('code').value.trim();$('code').value='';const ch=await db.auth.mfa.challenge({factorId});if(ch.error)throw ch.error;const r=await db.auth.mfa.verify({factorId,challengeId:ch.data.id,code});if(r.error)throw r.error;await complete();});
 run(async()=>{const {data}=await db.auth.getSession();if(data?.session)await complete();else message('Melde dich zuerst mit dem betroffenen Konto an.');});
})();
