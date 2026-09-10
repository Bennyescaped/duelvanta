(()=>{
  'use strict';
  const root=globalThis,MODEL='ximilar-collectibles-v2-slab-id';
  function fields(value){
    const company=String(value?.company||'').trim().toUpperCase(),rawGrade=String(value?.grade??'').trim(),grade=rawGrade===''?NaN:Number(rawGrade),cert=String(value?.certificateNumber||'').trim();
    if(!/^[A-Z][A-Z0-9 .&-]{1,39}$/.test(company)||company==='OTHER'||!Number.isFinite(grade)||grade<1||grade>10||!/^\d+(?:\.\d+)?$/.test(rawGrade)||!/^[A-Za-z0-9-]{3,60}$/.test(cert))return null;
    return{grading_company:company==='BECKETT'?'BGS':['PSA','BGS','CGC','ACE'].includes(company)?company:'OTHER',grade,cert_number:cert};
  }
  function canSave(row){return !row.slab||(row.slabConfirmed===true&&row.manualConfirmed===true&&!!fields(row.slab))}
  function confirm(row,value){const parsed=fields(value);if(!row?.slab||!parsed)throw new Error('Grading-Firma, Grade (1–10) und Zertifikatsnummer vollständig prüfen.');row.slab={...row.slab,company:String(value.company).trim().toUpperCase(),grade:String(parsed.grade),certificateNumber:parsed.cert_number};row.slabConfirmed=true;return parsed}
  function rect(source,proposal){
    const r=proposal.cardRect,w=source.videoWidth||source.naturalWidth||source.width,h=source.videoHeight||source.naturalHeight||source.height;
    if(!r||![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.x<0||r.y<0||r.w<=0||r.h<=0||r.x+r.w>1.00001||r.y+r.h>1.00001)throw new Error('Kartenbereich im Slab nicht gefunden. Ganzes Gehäuse und Label aufnehmen.');
    return{x:r.x*w,y:r.y*h,w:r.w*w,h:r.h*h};
  }
  async function analyze(source,opts,base){
    const p=opts.slabObservation;
    if(p.model!==MODEL||p.selectedTcg!==opts.tcg||p.status==='tcg_conflict')throw new Error('Slab und gewähltes Kartenspiel stimmen nicht überein.');
    if(!['single','continuous'].includes(opts.mode||'single'))throw new Error('Ein Slab pro Aufnahme.');
    if(p.status==='slab_label_missing'||!p.slab)throw new Error('Slab-Label nicht erkannt.');
    const core=root.DV_SCAN_V16_CORE,crop=core.canvasFrom(source,rect(source,p),1000),photo=core.canvasFrom(source,null,1200);
    const pack=await base(crop,{...opts,slabObservation:undefined,sourcePrepared:true});
    for(const row of pack.results){
      row.slab={...p.slab};row.slabConfirmed=false;row.capturePhoto=photo;row.status='review';row.selected=false;row.manualConfirmed=false;
      row.captureKind='slab';row.providerEvidence={provider:'ximilar',model:MODEL,reviewRequired:true,elapsedMs:p.elapsedMs,printingId:null};
      row.captureGuidance={code:'slab_review',title:'SLAB PRÜFEN',text:'Katalogkarte bestätigen und Grading-Firma, Grade sowie Zertifikatsnummer am Label prüfen.'};
      row.failureType=row.best?'slab_review':row.failureType;
      // Slab ID reads the label, local OCR/catalog verifies the card. Neither
      // label language nor a bare label number may override card evidence.
    }
    pack.ready=0;pack.review=pack.results.filter(r=>r.best).length;return pack;
  }
  root.DV_SCAN_V16_SLAB={fields,canSave,confirm,rect,analyze,model:MODEL};
  const core=root.DV_SCAN_V16_CORE;if(core){const base=core.analyze.bind(core);core.analyze=(source,opts={})=>opts.slabObservation?analyze(source,opts,base):base(source,opts)}
})();
