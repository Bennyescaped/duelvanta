/* R22-R3: admitted local Magic adapter for the existing V16 controller and results.
 * No RecognitionProfile activation, provider replay, raw-photo upload or automatic search. */
(()=>{
  'use strict';
  const root=globalThis,esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const languages=['EN','DE','FR','IT','ES','JP','KR','CN'];
  async function authorize({db,user}){
    if(!user?.id||!await root.DV_TCG_V1_CONSUMERS.refreshMagicReadiness(db,user.id))throw Error('Magic-Beta derzeit nicht zugelassen. Ergebnisse bleiben lokal erhalten.');
    root.DV_TCG_V1_CONSUMERS.requireGame('magic','collection');
    return true;
  }
  async function analyze(source,options,context){
    await authorize(context);
    const core=root.DV_SCAN_V16_CORE,geometry=root.DV_SCAN_V16_GEOMETRY;
    let regions,geometryInfo=null;
    if(options.mode==='binder'){
      const corrected=geometry.correctBinder(source);source=corrected.source;
      regions=core.regionsFor(source,'binder','3x3');geometryInfo={corrected:corrected.corrected,confidence:corrected.confidence};
    }else if(options.mode==='multi'&&options.layout==='auto'){
      regions=geometry.detectCardRects(source,{maxCards:12});
      if(regions.length<2)throw Error('Weniger als zwei Karten sicher abgegrenzt. Festes Raster wählen; keine Plätze werden geraten.');
    }else if(options.sourcePrepared||['single','continuous'].includes(options.mode)&&Math.abs(source.width/source.height-63/88)<.08){
      regions=[{x:0,y:0,w:source.width,h:source.height,index:0,slot:1,row:0,col:0}];
    }else regions=core.regionsFor(source,options.mode,options.layout);
    const results=[],ocr=root.DV_SCAN_V16_OCR.create({timeoutMs:30000});
    try{for(let i=0;i<regions.length;i++){
      await authorize(context);
      if(options.isCurrent&&!options.isCurrent())throw Error('Analyse verworfen.');
      const region=regions[i],crop=core.canvasFrom(source,region,1400);
      const footer=core.canvasFrom(crop,{x:0,y:Math.round(crop.height*.82),w:crop.width,h:Math.round(crop.height*.18)},1800);
      options.onProgress?.({index:i,total:regions.length,phase:'ocr'});
      let raw='',error='';try{raw=await ocr.read(footer,'6')}catch(e){error=e.message||'OCR nicht lesbar';}
      if(options.isCurrent&&!options.isCurrent())throw Error('Analyse verworfen.');
      const observation=Object.freeze({...root.DV_MAGIC_CAMERA.parse(raw)});
      results.push({tcg:'magic',id:crypto.randomUUID(),index:i,slot:region.slot||i+1,row:region.row,col:region.col,
        crop,photo:crop.toDataURL('image/jpeg',.8),quality:core.quality(crop),observation,
        values:{set_code:observation.set_code,collector_number:observation.collector_number,language:observation.language},
        checks:{},status:'review',selected:false,action:'',captureMode:options.mode,
        message:error||'Kennung prüfen und alle drei Werte bestätigen.',folder:context.folder||null,page:context.page||1});
    }await authorize(context);}finally{await ocr.reset()}
    return {mode:options.mode,tcg:'magic',results,ready:0,review:results.length,empty:results.filter(r=>r.observation.ambiguous).length,geometryInfo};
  }
  function invalidate(row){
    if(row.savedId||row.saveAttempted)return;
    row.action='';row.confirmed=null;row.printingConfirmed=false;row.best=null;row.selected=false;row.status='review';row.checks={};row.imageBlob=null;row.imageWarning='';
    if(row.imageURL)URL.revokeObjectURL(row.imageURL);row.imageURL='';row.message='Geänderte Kennung erneut bestätigen und bewusst suchen.';
  }
  const canSave=row=>!!(row.printingConfirmed&&row.best&&row.action&&!row.busy&&!row.savedId&&!row.saveAttempted);
  const matchingItems=(row,items)=>items.filter(x=>x.tcg==='magic'&&row.best&&x.card_name===row.best.name&&x.card_number===row.best.number&&x.language===row.best.language);
  function prepareSave(row,items){
    if(row.busy||row.savedId||row.saveAttempted)return false;
    if(!row.best||!row.confirmed){row.message='Zuerst Set, Nummer und Sprache bestätigen und die Karte suchen.';return false;}
    if(!row.action){
      if(matchingItems(row,items).length){row.message='Karte bereits vorhanden: Aktualisieren oder weitere Kopie auswählen.';return false;}
      row.action='new';
    }
    row.printingConfirmed=true;row.status='ready';row.selected=true;
    row.message='Karte bestätigt und zum Speichern ausgewählt.';return true;
  }
  function html(row,index,items){
    const locked=row.busy||row.savedId||row.saveAttempted,c=row.best;
    const own=items.filter(x=>x.tcg==='magic');
    const duplicates=c?own.filter(x=>x.card_name===c.name&&x.card_number===c.number&&x.language===c.language):[];
    const preserved=own.find(x=>x.id===row.action)?.image_path;
    const imageStatus=row.imageWarning|| (preserved?'Dein vorhandenes Collection-Bild bleibt erhalten.':row.imageBlob?(row.savedId?'Mit diesem Kartenbild gespeichert.':'Dieses Kartenbild wird in deiner Collection gespeichert.'):'Noch kein Collection-Bild geladen. Die Aufnahme dient nur der Erkennung.');
    return `<article class="dvV16Result ${canSave(row)?'ready':'review'}" data-magic-row="${index}">
      <img class="dvV16Thumb" src="${esc(row.imageURL||row.photo)}" alt="Aufnahme ${index+1}, Position ${row.slot}">
      <div class="dvV16MagicContent"><div class="dvV16ResultTitle">${esc(c?.name||'Magic · Kennung prüfen')}</div>
      <div class="dvV16Meta">Aufnahme ${index+1} · ${esc(row.captureMode)} · Position ${row.slot}${row.captureMode==='binder'?' · Zielseite '+row.page:''}${row.savedId?'<br>Gespeicherte ID: '+esc(row.savedId):''}</div>
      <div class="dvV16Meta">Bildqualität ${Math.round(row.quality?.score||0)} % · lokale V16-Prüfung</div>
      <strong class="dvV16Badge">${row.savedId?(row.placed||row.captureMode!=='binder'?'GESPEICHERT':'GESPEICHERT · PLATZ OFFEN'):row.saveAttempted?'SPEICHERSTATUS UNKLAR':row.selected?'AUSGEWÄHLT':c?'KARTE GEFUNDEN':'ANGABEN PRÜFEN'}</strong>
      <div class="dvV16Settings">${[['set_code','Set'],['collector_number','Originale Nummer'],['language','Sprache']].map(([key,label])=>`<div class="full"><label>${label}${key==='language'?`<select data-magic-field="${key}" ${locked?'disabled':''}><option value="">Bitte wählen</option>${languages.map(l=>`<option ${row.values[key]===l?'selected':''}>${l}</option>`).join('')}</select>`:`<input data-magic-field="${key}" value="${esc(row.values[key])}" ${locked?'disabled':''}>`}</label></div>`).join('')}</div>
      <div class="dvV16Actions"><button type="button" class="btn" data-magic-action="confirm-search" ${c?'hidden':''} ${locked||c?'disabled':''}>BESTÄTIGEN & KARTE MIT BILD LADEN</button></div>
      <p class="dvV16Meta" data-magic-next-step>${c?'Gefundene Karte und Druckvariante prüfen.': 'Set, Nummer und Sprache prüfen. Dieser Klick bestätigt alle drei Angaben, sucht einmal und lädt das passende Kartenbild von Scryfall.'}</p>
      ${c?`<div data-magic-printing><p class="dvV16Meta">${esc([c.set,c.number,c.language,c.variant,c.rarity].filter(Boolean).join(' · '))}</p><p class="dvV16Meta" data-magic-image-status>${esc(imageStatus)}</p>${!row.imageBlob&&!preserved&&!locked?`<button type="button" class="btn secondary" data-magic-action="image" ${!c.image_url?'disabled':''}>NUR KARTENBILD ERNEUT LADEN</button>`:''}<p class="dvV16Meta">Kartenbild: Scryfall. Dein Aufnahmefoto wird nicht hochgeladen.</p></div>`:''}
      ${duplicates.length?'<p class="dvV16Meta" data-magic-duplicate>Bereits in deiner Collection vorhanden. '+(row.captureMode==='binder'?'Eine zusätzliche Kopie nur bewusst anlegen.':'Bewusst den vorhandenen Eintrag oder eine zusätzliche Kopie auswählen.')+'</p>':''}
      ${row.captureMode==='binder'?'<p class="dvV16Meta">Bestehende Karte zum Aktualisieren im Einzelkartenmodus bearbeiten.</p>':''}
      ${c&&duplicates.length?`<label class="dvV16Meta" data-magic-choice>Diese Karte ist bereits vorhanden<select class="dvV16Choice" data-magic-save-action ${locked?'disabled':''}><option value="">Bitte auswählen</option><option value="new" ${row.action==='new'?'selected':''}>Weitere Kopie hinzufügen</option>${(row.captureMode==='binder'?[]:duplicates).map(x=>`<option value="${esc(x.id)}" ${row.action===x.id?'selected':''}>Vorhandene Karte aktualisieren: ${esc([x.card_name,x.set_name,x.card_number,x.language].join(' · '))}</option>`).join('')}</select></label>`:''}
      ${c&&!locked?`<p class="dvV16Meta" data-magic-save-help>Mit dem folgenden Knopf bestätigst du die angezeigte Karte und Druckvariante.${duplicates.length&&!row.action?' Bitte zuerst Aktualisieren oder weitere Kopie wählen.':''}</p><button type="button" class="btn" data-magic-action="${row.captureMode==='single'?'save':'select'}">${row.captureMode==='single'?'DIESE KARTE SPEICHERN':row.selected?'AUSWAHL AUFHEBEN':'KARTE BESTÄTIGEN & AUSWÄHLEN'}</button>`:''}
      ${row.captureMode==='binder'&&!locked?'<button type="button" class="btn secondary" data-magic-action="destination">GEWÄHLTEN ZIELBINDER UND SEITE ZUORDNEN</button>':''}
      ${row.savedId&&row.captureMode==='binder'&&!row.placed?'<button type="button" class="btn secondary" data-magic-action="place">NUR PLATZZUORDNUNG ERNEUT VERSUCHEN</button>':''}
      <p class="dvV16Meta" role="status">${esc(row.message)}</p></div>
      <details class="dvV16Details"><summary>Unveränderte OCR-Beobachtung</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(row.observation.raw)}</pre></details>
    </article>`;
  }
  async function action(row,kind,context){
    if(row.busy)return;row.busy=true;
    try{
      await authorize(context);
      if(kind==='place'){await place(row,context);return;}
      if(row.savedId||row.saveAttempted)return;
      if(kind==='confirm-search'){
        row.confirmed=Object.freeze(root.DV_MAGIC_CAMERA.validate(row.values));
        kind='search';
        row.loadImageWithSearch=true;
      }
      if(kind==='select'){
        if(row.selected){row.selected=false;row.message='Auswahl aufgehoben.';return;}
        // prepareSave checks busy to protect independent callers; this action
        // already holds the row lock and performs no async work in this block.
        row.busy=false;prepareSave(row,context.items);row.busy=true;return;
      }
      if(kind==='destination'){
        if(!context.folder||!context.folders.some(f=>f.id===context.folder&&context.page>=1&&context.page<=f.binder_pages)||!Number.isInteger(context.page))throw Error('Zielbinder und gültige Seite wählen.');
        row.folder=context.folder;row.page=context.page;row.message='Zielbinder und Seite zugeordnet; die ursprüngliche Bildposition bleibt '+row.slot+'.';
      }else if(kind==='confirm'){
        if(!['set_code','collector_number','language'].every(k=>row.checks[k]))throw Error('Set, originale Nummer und Sprache einzeln prüfen.');
        row.confirmed=Object.freeze(root.DV_MAGIC_CAMERA.validate(row.values));row.message='Kennung bestätigt. Jetzt MAGIC-KARTE SUCHEN antippen (eine Anfrage).';
      }else if(kind==='search'){
        if(!row.confirmed)throw Error('Kennung zuerst bestätigen.');
        row.best=null;row.printingConfirmed=false;row.selected=false;row.action='';
        if(row.imageURL)URL.revokeObjectURL(row.imageURL);row.imageURL='';row.imageBlob=null;row.imageWarning='';
        root.DV_TCG_V1_CONSUMERS.requireGame('magic','catalog');
        const {data:{session},error}=await context.db.auth.getSession();
        if(error||session?.user?.id!==context.user.id||!session.access_token)throw Error('Anmeldung nicht gültig.');
        const response=await fetch('/api/tcg-magic-scryfall?'+new URLSearchParams(row.confirmed),{method:'GET',credentials:'same-origin',headers:{Accept:'application/json',Authorization:'Bearer '+session.access_token},signal:AbortSignal.timeout(10000)});
        const result=await response.json();await authorize(context);
        if(!response.ok||result.status!=='candidates'||!result.candidate)throw Error(response.status===429?'Tageskontingent oder Providerlimit erreicht. Lokale Ergebnisse bleiben erhalten.':'Kein eindeutiges unterstütztes Printing. Eingaben prüfen; keine automatische Wiederholung.');
        row.best=result.candidate;row.message='Karte gefunden. Druckvariante prüfen und anschließend speichern oder auswählen.';
        if(row.loadImageWithSearch){
          try{row.imageBlob=await root.DV_MAGIC_IMAGES.download(row.best);row.imageURL=URL.createObjectURL(row.imageBlob);}
          catch{row.imageWarning='Kartenbild konnte nicht geladen werden. Ohne vorhandenes Bild wird nur die Karte gespeichert.';}
        }
      }else if(kind==='printing'){
        if(!row.best||!row.confirmed)throw Error('Zuerst bewusst nach der bestätigten Kennung suchen.');
        row.printingConfirmed=true;row.status='ready';row.message='Druckvariante bestätigt. Speicherentscheidung und Auswahl bleiben erforderlich.';
      }else if(kind==='image'){
        if(!row.best||row.imageBlob)return;
        row.imageBlob=await root.DV_MAGIC_IMAGES.download(row.best);row.imageURL=URL.createObjectURL(row.imageBlob);
        row.imageWarning='';
        row.message='Printing-Bild ausgewählt. Ein vorhandenes eigenes Bild bleibt geschützt.';
      }
    }catch(e){row.message=e.message||'Aktion fehlgeschlagen. Keine automatische Wiederholung.';}finally{row.loadImageWithSearch=false;row.busy=false}
  }
  async function place(row,context){
    const {data,error}=await context.db.rpc('place_my_magic_scan_item_v1',{p_item_id:row.savedId,p_folder_id:row.savedFolder,p_page:row.savedPage,p_slot:row.slot});
    if(error||data!==true)throw Error('Karte gespeichert; Platzzuordnung offen: '+(error?.message||'keine Bestätigung'));
    row.placed=true;row.message='Gespeichert und dem bestätigten freien Binderplatz zugeordnet.'+(row.imageWarning||'');
  }
  async function save(row,context){
    if(!canSave(row))return false;
    row.busy=true;
    try{
      await authorize(context);
      const {db,user,folder,page,items,folders}=context,c=row.best;
      if(folder&&!folders.some(f=>f.id===folder&&(!f.user_id||f.user_id===user.id)))throw Error('Zielbinder nicht verfügbar.');
      if(row.captureMode==='binder'){
        if(!folder||!Number.isInteger(page)||page<1||page>Number(folders.find(f=>f.id===folder)?.binder_pages||0))throw Error('Gültigen Zielbinder und eine vorhandene Seite auswählen.');
        if(page!==row.page||folder!==row.folder)throw Error('Zielbinder oder Seite geändert. Aufnahme erneut zuordnen, bevor sie gespeichert wird.');
        const latest=await db.from('collection_items').select('id,binder_page,binder_slot').eq('user_id',user.id).eq('folder_id',folder);
        if(latest.error)throw latest.error;
        const placed=(latest.data||[]).filter(x=>x.binder_page&&x.binder_slot),unplaced=(latest.data||[]).filter(x=>!x.binder_page||!x.binder_slot);
        const slots=root.DV_SCAN_V16_BINDER_LAYOUT.composeSlots(placed,unplaced,Number(folders.find(f=>f.id===folder).binder_pages));
        if(slots[(page-1)*9+row.slot-1])throw Error('Zielplatz ist belegt. Kein Eintrag wurde angelegt.');
        // Capability check is read-only; no save before the separately approved candidate is installed.
        const readiness=await db.rpc('get_magic_scan_placement_ready_v1');
        if(readiness.error||readiness.data!==true)throw Error('Sichere Binder-Platzierung noch nicht freigegeben. Lokale Ergebnisse bleiben erhalten.');
      }
      const previous=row.action==='new'?null:items.find(x=>x.id===row.action&&x.tcg==='magic'&&x.user_id===user.id);
      if(row.action!=='new'&&!previous)throw Error('Ausgewählter eigener Eintrag nicht verfügbar.');
      // Unplaced legacy rows are auto-filled by the binder renderer. Keep a
      // pending binder item outside that binder until the atomic placement RPC.
      const payload={folder_id:row.captureMode==='binder'?null:folder||null,card_name:c.name,set_name:c.set,card_number:c.number,language:c.language,variant:c.variant||null,
        condition:previous?.condition||'NM',quantity:previous?.quantity||1,grading_company:previous?.grading_company||null,grade:previous?.grade??null,cert_number:previous?.cert_number||null,
        purchase_price:previous?.purchase_price??null,purchase_date:previous?.purchase_date||null,market_price:previous?.market_price??null,currency:previous?.currency||'EUR',
        notes:(previous?.notes?previous.notes+' · ':'')+'V16 Magic '+row.id+' · '+row.confirmed.set_code+'/'+row.confirmed.collector_number+'/'+row.confirmed.language+' · Printing '+c.provider_ref.external_id,contract_version:'1'};
      if(payload.notes.length>2000)throw Error('Bestehende Notiz ist zu lang für die zusätzliche Printing-Zuordnung. Eintrag zuerst bewusst bearbeiten.');
      // Independent of the rendered choices: never detach an existing binder
      // card through the save RPC before a separate placement could fail.
      if(row.captureMode==='binder'&&(row.action!=='new'||previous))throw Error('Bestehende Karte zum Aktualisieren im Einzelkartenmodus bearbeiten.');
      row.saveAttempted=true;row.selected=false;
      const result=await db.rpc('save_my_tcg_collection_item_v1',{p_item_id:previous?.id||null,p_game_key:'magic',p_item:payload});
      if(result.error||!result.data)throw Error('Speicherantwort nicht erfolgreich. Bestand vor einem neuen Versuch prüfen; dieser Kandidat wird nicht erneut importiert.');
      row.savedId=result.data;row.savedFolder=folder;row.savedPage=page;row.message='Karte gespeichert.';
      if(previous?.image_path){row.imageWarning='';row.message+=' Vorhandenes Bild erhalten.';}
      else if(row.imageBlob){try{await root.DV_MAGIC_IMAGES.attach(db,user.id,row.savedId,row.imageBlob,previous?.image_path,payload);row.imageWarning='';row.message+=' Mit Kartenbild gespeichert.';}catch{row.imageWarning='Bild nicht angehängt; Karte nicht erneut importieren.';row.message+=' '+row.imageWarning;}}
      else{row.imageWarning='Ohne Kartenbild gespeichert.';row.message+=' '+row.imageWarning;}
      if(row.captureMode==='binder')await place(row,context);
      return true;
    }catch(e){row.message=e.message;return false;}finally{row.busy=false}
  }
  root.DV_SCAN_V16_MAGIC=Object.freeze({authorize,analyze,html,invalidate,canSave,prepareSave,action,save});
})();
