// Historical R22 UI harness only; production uses the unified V16 surface.
if(typeof DV_MAGIC_CAMERA!=='undefined')DV_MAGIC_CAMERA.mount({
 document,anchor:$('scanCard'),editAnchor:$('magicLookup'),
 authorize:async()=>{try{await tcgConsumer.refreshMagicReadiness(db,currentUser?.id);tcgConsumer.requireGame('magic','collection');return !!currentUser?.id;}catch{return false;}},
 onConfirm:(value,{editing})=>{
  // Raw camera bytes never enter pendingScanBlob or the Storage path.
  pendingScanBlob=null;
  if(!editing){pendingScanFolder=activeFolder||null;resetForm();$('tcg').value='magic';updateMagicForm(true);$('modalTitle').textContent='Neue Magic-Karte hinzufügen – neuer Eintrag';}
  $('magicSetCode').value=value.set_code;$('magicCollector').value=value.collector_number;
  $('magicLanguage').value=value.language;$('language').value=value.language;
  clearMagicImage();magicLookupEpoch++;$('magicLookupStatus').textContent='Kennung bestätigt. Für den Provideraufruf jetzt ausdrücklich MAGIC-KARTE SUCHEN drücken.';
  if(!$('cardDialog').open)$('cardDialog').showModal();
 }
});
