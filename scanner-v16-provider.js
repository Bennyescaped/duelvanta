(()=>{
  'use strict';
  const root=globalThis,MODEL='gpt-5.4-mini';
  const text=value=>typeof value==='string'?value.slice(0,300):null;
  function printedCode(value,tcg){
    const source=String(value||'').toUpperCase().replace(/[—–−]/g,'-');
    const matches=tcg==='pokemon'?[...source.matchAll(/\b(\d{1,3}\s*\/\s*\d{2,3})\b/g)].map(x=>x[1]):[...source.matchAll(/\b((?:(?:OP|ST|EB|PRB)\s*\d{1,2}|P)\s*-\s*\d{2,3})\b/g)].map(x=>x[1]);
    const unique=[...new Set(matches.map(x=>x.replace(/\s/g,'')))];
    return unique.length===1?unique[0]:text(value);
  }
  function read(proposal,tcg){
    if(!proposal||proposal.model!==MODEL)throw new Error('Unbekannte KI-Antwort.');
    const o=proposal.observed;
    if(proposal.selectedTcg!==tcg||!o||(!['unknown',tcg].includes(o.tcg)))throw new Error('KI-Antwort und ausgewähltes Kartenspiel stimmen nicht überein.');
    const code=printedCode(o.printed_code,tcg),id=root.DV_SCAN_V16_RECOVERY.parse(code,tcg);
    const conflict=proposal.status==='tcg_conflict';
    const language=root.DV_SCAN_V16_QUALITY.languageOf({language:o.language});
    return{id:conflict?null:id,language,evidence:{provider:'openai',model:MODEL,
      name:text(o.name),printedCode:code,language,set:text(o.set_name),
      printingId:null,rarity:text(o.rarity),variant:text(o.variant),finish:text(o.variant),
      identifierConflict:conflict,elapsedMs:Number.isFinite(proposal.elapsedMs)?proposal.elapsedMs:null,
      usage:proposal.usage||null,estimatedCostUsd:Number.isFinite(proposal.estimatedCostUsd)?proposal.estimatedCostUsd:null,
      status:conflict?'tcg_conflict':!id?'identifier_failure':proposal.status,
      reviewRequired:true,exactPrintingVerified:false}};
  }
  async function verifyPhoto(file,proposal){
    if(!file?.arrayBuffer||!/^([a-f0-9]{64})$/.test(proposal?.sha256||''))throw new Error('Originalfoto und KI-Messdaten werden benötigt.');
    const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
    const actual=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
    if(actual!==proposal.sha256)throw new Error('Diese KI-Antwort gehört zu einem anderen Foto.');
    return true;
  }
  async function request(database,body){
    const {data,error}=await database?.auth?.getSession?.()||{};
    const token=data?.session?.access_token;
    if(error||!token)throw new Error('Für den KI-Scan bitte über DUELVANTA anmelden.');
    let response;
    try{response=await fetch('/api/scanner-v16-recognize',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(95000)})}
    catch{throw new Error('KI-Antwort nicht angekommen. Es wird kein automatischer zweiter Scan gestartet. Bitte den Verbrauch prüfen.');}
    let result;try{result=await response.json()}catch{throw new Error('Die KI-Antwort war nicht lesbar. Es wird nicht automatisch erneut berechnet.');}
    if(!response.ok)throw new Error(({scanner_closed:'KI-Scans sind noch nicht freigeschaltet.',scan_global_limit_reached:'Das gemeinsame Beta-Kontingent ist aufgebraucht. Der lokale Scan bleibt verfügbar.',scan_limit_reached:'Dein wöchentliches KI-Scan-Kontingent ist aufgebraucht.',scan_already_reserved:'Dieses Foto wurde bereits eingereicht. Kein weiterer KI-Aufruf.',sign_in_required:'Bitte erneut bei DUELVANTA anmelden.',accounting_unavailable:'Das Scan-Kontingent kann gerade nicht geprüft werden.',provider_unavailable:'OpenAI ist für dieses Deployment nicht eingerichtet.'})[result.error]||'KI-Scan fehlgeschlagen. Kein automatischer Wiederholungsversuch.');
    return result;
  }
  async function recognize(source,tcg,database,kind='raw'){
    const w=source.videoWidth||source.naturalWidth||source.width,h=source.videoHeight||source.naturalHeight||source.height;
    if(!w||!h)throw new Error('Bildquelle ist nicht bereit.');
    const scale=Math.min(1,1600/Math.max(w,h)),canvas=document.createElement('canvas');
    canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);canvas.getContext('2d').drawImage(source,0,0,canvas.width,canvas.height);
    const file=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));
    if(!file||file.size>1600000)throw new Error('Das Foto ist für den KI-Scan zu groß.');
    const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
    const proposal=await request(database,{imageBase64:btoa(binary),tcg,kind,requestId:crypto.randomUUID()});
    await verifyPhoto(file,proposal);if(proposal.model!==MODEL||proposal.selectedTcg!==tcg)throw new Error('Ungültige OpenAI-Antwort.');return proposal;
  }
  root.DV_SCAN_V16_PROVIDER={read,verifyPhoto,recognize,budget:database=>request(database),model:MODEL,name:'OpenAI'};
})();
