/* R22: local still-image OCR only. No catalog, auth token, upload or save API. */
(()=>{
 'use strict';
 const root=globalThis, languages=['EN','DE','FR','IT','ES','JP','KR','CN'];
 function validate(input){
  const set_code=String(input.set_code||'').trim().toUpperCase(),collector_number=String(input.collector_number||'').trim(),language=String(input.language||'').trim().toUpperCase();
  if(!/^[A-Z0-9]{2,8}$/.test(set_code)||!/^[0-9]{1,6}[a-zA-Z]?$/.test(collector_number)||!languages.includes(language))throw Error('Bitte Set-Code, gedruckte Nummer und Sprache vollständig prüfen und korrigieren.');
  return {set_code,collector_number,language};
 }
 function parse(raw){
  raw=String(raw||'').slice(0,12000);
  const originalLines=raw.split(/\r?\n/).map(s=>s.trim()),lines=originalLines.map(s=>s.toUpperCase()),sets=new Set(),numbers=new Set(),langs=new Set();
  for(const [index,line] of lines.entries()){
   for(const m of line.matchAll(/\b([A-Z0-9]{2,8})(?:\s*[•·*|.\-]\s*|\s+)(EN|DE|FR|IT|ES|JP|KR|CN)\b/g)){sets.add(m[1]);langs.add(m[2]);}
   if(!/[©®]|COPYRIGHT|WIZARDS|20\d\d\s+/.test(line)){
    // A leading rarity binds the collector token; later power/toughness is noise.
    // Without rarity, accept only a clean token, never a fraction or bare year.
    const observed=originalLines[index];
    const prefixed=observed.match(/^[CMRU]\s+(\d{1,6}[A-Z]?)(?=$|\s)(?!\s*\/)/i);
    const clean=observed.match(/^(\d{1,6}[A-Z]?)(?:\s+[CMRU])?$/i);
    const m=prefixed||(clean&&!/^(?:19|20)\d{2}$/.test(clean[1])?clean:null);
    if(m)numbers.add(m[1]);
   }
  }
  return {raw,set_code:sets.size===1?[...sets][0]:'',collector_number:numbers.size===1?[...numbers][0]:'',language:langs.size===1?[...langs][0]:'',ambiguous:sets.size!==1||numbers.size!==1||langs.size!==1};
 }
 function mount({document,anchor,editAnchor,authorize,onConfirm}){
  const dialog=document.createElement('dialog');dialog.id='magicCameraDialog';
  dialog.innerHTML=`<section class="modal"><h3>Magic Kamera Beta</h3><p id="magicCameraMode"></p><p>Genau eine Karte aufrecht, vollständig und möglichst bildfüllend fotografieren. Nur lokale OCR; kein automatischer Upload oder Scryfall-Aufruf.</p><div class="rowActions"><button type="button" id="magicCameraPhoto" class="btn">KARTE FOTOGRAFIEREN</button><button type="button" id="magicCameraGallery" class="btn secondary">FOTO AUSWÄHLEN</button></div><input id="magicCameraFile" type="file" accept="image/*" capture="environment" hidden><input id="magicGalleryFile" type="file" accept="image/*" hidden><div id="magicCameraPreview"></div><p id="magicCameraStatus" role="status"></p><details><summary>Originale OCR-Beobachtung</summary><pre id="magicCameraRaw" style="white-space:pre-wrap"></pre></details><div class="formGrid"><label>Set-Code<input id="magicCameraSet" maxlength="8" autocomplete="off"></label><label>Gedruckte Kartennummer<input id="magicCameraNumber" maxlength="7" autocomplete="off"></label><label>Sprache<select id="magicCameraLanguage"><option value="">Bitte wählen</option>${languages.map(x=>'<option>'+x+'</option>').join('')}</select></label></div><p>Erkennung kann falsch sein. Alle drei Werte mit der physischen Karte vergleichen. Bestätigen übernimmt nur die Kennung; danach separat „MAGIC-KARTE SUCHEN“ drücken.</p><div class="rowActions"><button id="magicCameraConfirm" type="button" class="btn">KENNUNG GEPRÜFT – ÜBERNEHMEN</button><button id="magicCameraCancel" type="button" class="btn secondary">ABBRECHEN</button></div></section>`;
  document.body.appendChild(dialog);
  const $=id=>document.getElementById(id),launch=document.createElement('button'),edit=document.createElement('button');
  launch.id='magicCameraLaunch';launch.type='button';launch.className='btn secondary';launch.textContent='MAGIC KAMERA BETA';anchor.insertAdjacentElement('afterend',launch);
  edit.id='magicCameraEdit';edit.type='button';edit.className='btn secondary';edit.textContent='KENNUNG MIT KAMERA ERFASSEN';editAnchor.appendChild(edit);
  let epoch=0,busy=false,opening=false,context=null,ocr=null;
  function status(s){$('magicCameraStatus').textContent=s;}
  function reset(){epoch++;busy=false;context=null;ocr?.reset();ocr=null;$('magicCameraConfirm').disabled=false;$('magicCameraPreview').replaceChildren();$('magicCameraRaw').textContent='';for(const id of ['magicCameraSet','magicCameraNumber','magicCameraLanguage','magicCameraFile','magicGalleryFile'])$(id).value='';}
  function close(){reset();dialog.close();}
  function modules(){if(!root.DV_SCAN_V16_NATIVE_CAMERA||!root.DV_SCAN_V16_RUNTIME||!root.DV_SCAN_V16_CORE||!root.DV_SCAN_V16_OCR)throw Error('Kameramodule noch nicht bereit. Bitte kurz warten und erneut öffnen.');}
  async function open(editing=false){
   if(opening||dialog.open)return;opening=true;
   try{if(!await authorize())throw Error('Magic ist für dieses Konto derzeit nicht freigegeben.');modules();reset();context={editing};$('magicCameraMode').textContent=editing?'Kennung für das bewusst geöffnete Formular. Bestehende Karte wird nur beim Speichern aktualisiert.':'NEUER EINTRAG: Beim späteren Speichern entsteht eine neue Karte. Zum Ergänzen einer vorhandenen Karte zuerst deren Bearbeiten-Dialog öffnen.';status('Bereit. Foto aufnehmen, auswählen oder Kennung manuell prüfen.');dialog.showModal();}
   catch(e){launch.textContent=e.message;}
   finally{opening=false;}
  }
  async function process(file){
   if(!file||!dialog.open||busy)return;busy=true;const token=++epoch;let decoded;
   $('magicCameraConfirm').disabled=true;status('Foto wird lokal gelesen …');
   $('magicCameraRaw').textContent='';for(const id of ['magicCameraSet','magicCameraNumber','magicCameraLanguage'])$(id).value='';
   try{
    if(!await authorize())throw Error('Magic ist für dieses Konto derzeit nicht freigegeben.');
    if(token!==epoch)return;
    if(!/^image\//.test(file.type)||file.size>20*1024*1024)throw Error('Bitte ein Foto bis 20 MiB auswählen.');
    decoded=await root.DV_SCAN_V16_RUNTIME.decodeFile(file);if(token!==epoch)return;
    const core=root.DV_SCAN_V16_CORE,card=core.canvasFrom(decoded,core.fitCenteredRect(decoded,63/88,0),1400);
    card.style.cssText='max-width:100%;max-height:38vh;object-fit:contain';$('magicCameraPreview').replaceChildren(card);
    const footer=core.canvasFrom(card,{x:0,y:card.height*.82,w:card.width,h:card.height*.18},1800);
    ocr=root.DV_SCAN_V16_OCR.create({timeoutMs:30000});const result=parse(await ocr.read(footer,'6'));
    if(token!==epoch)return;$('magicCameraRaw').textContent=result.raw;
    $('magicCameraSet').value=result.set_code;$('magicCameraNumber').value=result.collector_number;$('magicCameraLanguage').value=result.language;
    status(result.ambiguous?'Nicht eindeutig gelesen. Fehlende oder widersprüchliche Werte manuell korrigieren; noch keine Suche.':'Vorschlag lokal gelesen. Alle Werte ausdrücklich kontrollieren; noch keine Suche.');
   }catch(e){if(token===epoch)status(e.message+' Kennung manuell eingeben oder ein neues Foto aufnehmen.');}
   finally{decoded?.close?.();if(token===epoch){busy=false;$('magicCameraConfirm').disabled=false;ocr?.reset();ocr=null;}}
  }
  function pick(kind){if(busy||!dialog.open)return;try{modules();root.DV_SCAN_V16_NATIVE_CAMERA.open($(kind==='camera'?'magicCameraFile':'magicGalleryFile'),kind);}catch(e){status('Fotoaufnahme nicht verfügbar. Bitte Foto auswählen oder Kennung manuell eingeben.');}}
  launch.onclick=()=>open(false);edit.onclick=()=>open(true);
  $('magicCameraPhoto').onclick=()=>pick('camera');$('magicCameraGallery').onclick=()=>pick('gallery');
  for(const id of ['magicCameraFile','magicGalleryFile']){$(id).onchange=()=>process($(id).files?.[0]);$(id).addEventListener('cancel',()=>status('Fotoauswahl abgebrochen. Du kannst sie erneut öffnen.'));}
  $('magicCameraCancel').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',reset);
  $('magicCameraConfirm').onclick=async()=>{
   if(busy||!context||!dialog.open)return;busy=true;const token=epoch;
   try{const value=validate({set_code:$('magicCameraSet').value,collector_number:$('magicCameraNumber').value,language:$('magicCameraLanguage').value});if(!await authorize())throw Error('Magic-Freigabe nicht mehr gültig.');if(token!==epoch)return;const chosen={...context};close();onConfirm(value,chosen);}
   catch(e){if(token===epoch)status(e.message);}
   finally{if(token===epoch)busy=false;}
  };
  return {open,close,process};
 }
 const api={parse,validate,mount};if(typeof module==='object'&&module.exports)module.exports=api;root.DV_MAGIC_CAMERA=api;
})();
