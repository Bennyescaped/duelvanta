(()=>{
  'use strict';
  const endpoint='/api/scanner-v16-gemini',key='duelvanta_gemini_pilot_v1';
  const $=id=>document.getElementById(id);
  let bundle=null,running=false,stop=false,connection=null;
  let entries=[];
  try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))entries=saved}catch{}
  const setStatus=text=>{$('status').textContent=text};
  function render(){
    $('report').textContent=JSON.stringify(entries,null,2);$('results').replaceChildren();
    for(const entry of entries){const article=document.createElement('article'),title=document.createElement('strong'),info=document.createElement('p');
      title.textContent=`${entry.photoId} · ${entry.result?.observed?.name||entry.error||'Kein Ergebnis'}`;
      info.textContent=entry.result?`${entry.result.observed.printed_code||'Nummer nicht erkannt'} · ${entry.result.observed.language||'Sprache offen'} · ${entry.result.observed.variant||'Variante offen'} · ${entry.result.elapsedMs} ms · Katalog noch ungeprüft`:'Kein erfolgreicher Erkennungsnachweis.';
      article.append(title,info);$('results').append(article)}
    $('start').disabled=running||!connection?.active||!connection?.configured||!bundle;
    $('bundle').disabled=running;$('check').disabled=running;$('stop').disabled=!running;
  }
  function persist(){localStorage.setItem(key,JSON.stringify(entries));render()}
  async function check(){
    try{const r=await fetch(endpoint,{cache:'no-store',signal:AbortSignal.timeout(15000)});const d=await r.json();if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);connection=d;
      setStatus(!d.configured?'Gemini-Schlüssel fehlt in dieser V16-Vorschau.':!d.active?'Gemini-Schlüssel vorhanden · Fototest geschlossen.':`Gemini-Schlüssel vorhanden · ${d.model} · Test bereit.`)
    }catch{connection=null;setStatus('Testverbindung nicht verfügbar. Es wurde kein Foto an Gemini gesendet.')}render();
  }
  $('check').addEventListener('click',check);
  $('bundle').addEventListener('change',async event=>{
    bundle=null;
    try{const file=event.target.files?.[0];if(!file)return;if(file.size>36000000)throw Error('Testpaket zu groß.');
      const value=JSON.parse(await file.text());if(value.schema!=='duelvanta.signed-photo-pilot.v1'||!Array.isArray(value.photos)||value.photos.length<1||value.photos.length>16)throw Error('Ungültiges Testpaket.');
      const hashes=new Set();
      for(const p of value.photos){const t=JSON.parse(p.ticket);if(!p.photoId||typeof p.signature!=='string'||typeof p.imageBase64!=='string'||hashes.has(t.sha256))throw Error('Ungültige oder doppelte Fotos.');hashes.add(t.sha256)}
      bundle=value;$('selection').textContent=`${value.photos.length} Fotos ausgewählt. Modell: ${connection?.model||'wird geprüft'}.`;setStatus('Testpaket geladen · noch keine Fotos gesendet.');
    }catch(e){setStatus(e.message)}render();
  });
  $('stop').addEventListener('click',()=>{stop=true;setStatus('Stoppt nach dem laufenden Foto.')});
  $('start').addEventListener('click',async()=>{
    if(running||!bundle||!connection?.active||!connection?.configured)return;
    running=true;stop=false;render();let sent=0;
    try{
      for(const photo of bundle.photos){
        if(stop)break;
        const ticket=JSON.parse(photo.ticket),runKey=`${ticket.dataset}:${ticket.model}:${ticket.sha256}`;
        if(entries.some(e=>e.runKey===runKey))continue;
        // Save the attempt BEFORE the request. A reload must never silently resend an uncertain call.
        const entry={runKey,photoId:photo.photoId,sha256:ticket.sha256,at:new Date().toISOString(),error:'attempt_started'};entries.push(entry);persist();
        setStatus(`Foto ${++sent}/${bundle.photos.length} wird analysiert …`);
        try{const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ticket:photo.ticket,signature:photo.signature,imageBase64:photo.imageBase64}),signal:AbortSignal.timeout(60000)});
          const result=await response.json();if(!response.ok)throw Error(result.error||`HTTP ${response.status}`);entry.result=result;delete entry.error;persist();
        }catch(e){entry.error=e.message;persist();throw e}
        if(!stop && bundle.photos.some(p=>!entries.some(e=>e.sha256===JSON.parse(p.ticket).sha256)))await new Promise(r=>setTimeout(r,15000));
      }
      setStatus(stop?'Fototest gestoppt · bisherige Ergebnisse gespeichert.':'Fototest abgeschlossen · Ergebnisse gespeichert.');
    }catch(e){setStatus(`Fototest gestoppt: ${e.message}. Kein automatischer Wiederholungsversuch.`)}
    finally{running=false;render()}
  });
  render();check();
})();
