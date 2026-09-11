(()=>{
  'use strict';
  const root=globalThis;
  function parse(code,tcg){
    const api=root.DV_SCAN_V16_TCG,text=String(code||'').trim().toUpperCase();
    if(tcg==='pokemon'&&!/^\d{1,3}\s*\/\s*\d{2,3}$/.test(text))return null;
    if(tcg==='one_piece'&&!/^(?:(?:OP|ST|EB|PRB)\s*\d{1,2}\s*-\s*\d{2,3}|P\s*-\s*\d{2,3})$/.test(text))return null;
    return(tcg==='pokemon'?api.pokemonIds(text):tcg==='one_piece'?api.onePieceIds(text):[])[0]||null;
  }
  const folded=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  function nameConflict(row,card){
    const observed=folded(row?.providerEvidence?.name),catalog=folded(card?.name);if(!observed||!catalog)return false;
    const language=String(row?.providerEvidence?.language||row?.observedLanguage||'').toUpperCase(),candidateLanguage=String(card?.language||'').toUpperCase();
    if((language&&candidateLanguage&&language!==candidateLanguage)||!/^[a-z0-9 ]+$/.test(observed+catalog))return false;
    return observed!==catalog&&!observed.includes(catalog)&&!catalog.includes(observed);
  }
  function canConfirm(row,card){
    const api=root.DV_SCAN_V16_TCG;
    return !!(!row?.providerReplay&&row?.id&&card?.catalogVerified&&card.tcg===row.tcg&&api.candidateCode(card,row.tcg)===api.idCode(row.id,row.tcg)&&!nameConflict(row,card));
  }
  async function search(row,code,analyze){
    const id=parse(code,row.tcg);if(!id)throw new Error(row.tcg==='one_piece'?'Code im Format OP05-119 oder P-001 eingeben.':'Nummer im Format 074/084 eingeben.');
    if(!row.crop)throw new Error('Das ursprüngliche Foto ist nicht mehr verfügbar.');
    const pack=await analyze(row.crop,{mode:'single',tcg:row.tcg,identifierOverride:id,sourcePrepared:true,manualRecovery:true,providerReplay:!!row.providerReplay});
    const result=pack.results?.[0];if(!result)throw new Error('Die Katalogsuche hat kein Ergebnis zurückgegeben.');
    return{...result,...(row.slab?{slab:row.slab,slabConfirmed:row.slabConfirmed,captureKind:'slab'}:{}),capturePhoto:row.capturePhoto,storageSource:row.storageSource,captureMode:row.captureMode,providerEvidence:row.providerEvidence,index:row.index,slot:row.slot,row:row.row,col:row.col,chosen:0,selected:false,manualRecovery:true,manualConfirmed:false,providerReplay:!!row.providerReplay};
  }
  function confirm(row,index){
    const card=row.candidates?.[index];if(!canConfirm(row,card))throw new Error('Nur ein passender, verifizierter Katalogkandidat kann bestätigt werden.');
    row.chosen=index;row.manualConfirmed=true;row.selected=true;return row;
  }
  root.DV_SCAN_V16_RECOVERY={parse,search,confirm,canConfirm,nameConflict};
})();
