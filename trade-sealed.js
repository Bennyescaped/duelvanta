(()=>{
  'use strict';

  const METHODS={
    standard_letter:'Standardbrief',tracked_letter:'Brief mit Tracking',parcel:'Paket mit Tracking',pickup:'Abholung',custom:'Individuell / nach Absprache'
  };
  const CATS={booster:'BOOSTER',display:'DISPLAY',promo_pack:'PROMO PACK',etb_collection:'ETB / COLLECTION',deck:'DECK',tin:'TIN',box:'BOX',case:'CASE',other:'SONSTIGES'};
  const CONDITIONS={factory_sealed:'FACTORY SEALED',sealed_minor_wear:'SEALED · LEICHTE LAGERSPUREN',sealed_damage:'SEALED · BESCHÄDIGUNG',opened_case_sealed_units:'CASE GEÖFFNET · EINHEITEN SEALED'};
  const BUCKET='market-listing-images';
  const MAX_FILES=6;
  const MAX_BYTES=8*1024*1024;

  let installed=false, mode='create', editListing=null, editManifest=[], renderBusy=false, renderTimer=null;

  function htmlEscape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function numberOrNull(v){const x=String(v??'').trim();if(!x)return null;const n=Number(x);return Number.isFinite(n)?n:null}
  function productKindLabel(k){return k==='sealed'?'SEALED':k==='graded'?'GRADED':'SINGLE'}
  function unitPriceFor(l,qty){let price=Number(l.asking_price||0);const tiers=Array.isArray(l.quantity_pricing)?l.quantity_pricing:[];for(const t of tiers)if(qty>=Number(t.min_quantity||0))price=Number(t.unit_price||price);return price}
  function sealedLine(l){
    if(l.product_kind!=='sealed')return '';
    const q=Number(l.bundle_quantity||1);
    const bits=[CATS[l.sealed_category]||'SEALED',CONDITIONS[l.sealed_condition]||'',q>1?`${q}× IM ANGEBOT`:'',l.package_contents||''].filter(Boolean);
    return bits.join(' · ');
  }
  function listingId(card){
    const el=card.querySelector('[data-offer],[data-edit],[data-pause],[data-finish],[data-renew],[data-complete]');
    if(!el)return null;
    return el.dataset.offer||el.dataset.edit||el.dataset.pause||el.dataset.finish||el.dataset.renew||el.dataset.complete||null;
  }
  async function manifest(ids){
    if(!ids.length)return [];
    const {data,error}=await db.rpc('get_market_listing_image_manifest',{p_listing_ids:ids});
    if(error)throw error;
    return data||[];
  }
  async function signed(path,seconds=1800){
    const {data,error}=await db.storage.from(BUCKET).createSignedUrl(path,seconds);
    if(error)throw error;
    return data?.signedUrl||null;
  }
  function injectStyle(){
    if(document.getElementById('dvSealedStyle'))return;
    const s=document.createElement('style');
    s.id='dvSealedStyle';
    s.textContent=`
      .dvProductTypeGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.dvTypeCard{border:1px solid #303640;background:#0a0d12;color:#e8e0d4;border-radius:13px;padding:16px;text-align:left;cursor:pointer}.dvTypeCard:hover{border-color:#c7a45d}.dvTypeCard b{display:block;color:#efd18c;letter-spacing:.06em;margin-bottom:6px}.dvTypeCard span{font-size:11px;color:#8f97a2;line-height:1.45}.dvSealedGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.dvSealedGrid .full{grid-column:1/-1}.dvSealedGrid input,.dvSealedGrid select,.dvSealedGrid textarea{width:100%;box-sizing:border-box}.dvSealedHint{border:1px solid rgba(199,164,93,.25);background:rgba(199,164,93,.045);border-radius:11px;padding:10px;color:#a69d90;font-size:10px;line-height:1.55}.dvPhotoDrop{border:1px dashed #404854;border-radius:12px;padding:13px;background:#090c10}.dvPhotoDrop input{margin-top:8px}.dvPhotoRule{font-size:10px;color:#8f97a2;line-height:1.5}.dvPhotoGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.dvPhoto{position:relative;border:1px solid #2c333d;border-radius:10px;overflow:hidden;aspect-ratio:4/3;background:#080a0e}.dvPhoto img{width:100%;height:100%;object-fit:cover}.dvPhoto button{position:absolute;top:5px;right:5px;border:1px solid rgba(0,0,0,.4);background:rgba(8,10,14,.86);color:#fff;border-radius:7px;padding:5px 7px;cursor:pointer}.dvSealedMeta{margin:8px 0 0;padding:8px 9px;border:1px solid rgba(199,164,93,.27);border-radius:9px;background:rgba(199,164,93,.045);font-size:9px;line-height:1.55;color:#aaa39a}.dvSealedMeta b{color:#efd18c}.dvProductKindBadge{display:inline-flex;border:1px solid rgba(199,164,93,.4);border-radius:999px;padding:4px 7px;color:#efd18c;font-size:8px;letter-spacing:.09em;margin-bottom:5px}.dvSealedPhotoCount{color:#8f97a2;font-size:9px;margin-top:4px}.dvSealedDealMeta{margin:7px 0;color:#d4bd85;font-size:10px;letter-spacing:.03em}.dvProductFilter{min-width:135px}.dvSealedLoading{opacity:.7;pointer-events:none}.dvCaseAlert{color:#d8c28f;font-size:10px;line-height:1.5;margin-top:5px}@media(max-width:680px){.dvProductTypeGrid,.dvSealedGrid{grid-template-columns:1fr}.dvSealedGrid .full{grid-column:auto}.dvPhotoGrid{grid-template-columns:repeat(2,1fr)}}`;
    document.head.appendChild(s);
  }

  function buildDialogs(){
    if(!document.getElementById('dvProductTypeDialog')){
      const d=document.createElement('dialog');
      d.id='dvProductTypeDialog';
      d.innerHTML=`<div class="modal"><div class="modalHead"><h2>Produkt anbieten</h2><button class="close" type="button" data-dv-type-close>✕</button></div><div class="dvProductTypeGrid"><button class="dvTypeCard" type="button" data-dv-kind="single"><b>SINGLE</b><span>Ungradete Einzelkarte aus deiner Collection.</span></button><button class="dvTypeCard" type="button" data-dv-kind="graded"><b>GRADED</b><span>PSA, BGS, CGC & andere Slabs aus deiner Collection.</span></button><button class="dvTypeCard" type="button" data-dv-kind="sealed"><b>SEALED</b><span>Booster, Displays, Promo Packs, Boxen, Decks und Cases.</span></button></div></div>`;
      document.body.appendChild(d);
      d.querySelector('[data-dv-type-close]').onclick=()=>d.close();
    }
    if(!document.getElementById('dvSealedDialog')){
      const d=document.createElement('dialog');
      d.id='dvSealedDialog';
      d.innerHTML=`<div class="modal" style="max-width:760px"><div class="modalHead"><h2 id="dvSealedHeading">Sealed anbieten</h2><button class="close" type="button" data-dv-sealed-close>✕</button></div>
        <div class="dvSealedGrid">
          <div class="field"><label>TCG</label><select id="dvSTcg"><option value="pokemon">Pokémon</option><option value="one_piece">One Piece</option><option value="other">Andere</option></select></div>
          <div class="field"><label>Produktart</label><select id="dvSCat"><option value="booster">Booster</option><option value="display">Display</option><option value="promo_pack">Promo Pack</option><option value="etb_collection">ETB / Collection</option><option value="deck">Deck</option><option value="tin">Tin</option><option value="box">Box</option><option value="case">Case</option><option value="other">Sonstiges</option></select></div>
          <div class="field full"><label>Produktname</label><input id="dvSName" maxlength="180" placeholder="z. B. One Piece OP-13 Carrying On His Will Display"></div>
          <div class="field"><label>Set / Produktcode</label><input id="dvSSet" maxlength="120" placeholder="z. B. OP-13"></div>
          <div class="field"><label>Sprache</label><select id="dvSLang"><option value="Deutsch">Deutsch</option><option value="Englisch">Englisch</option><option value="Japanisch">Japanisch</option><option value="Koreanisch">Koreanisch</option><option value="Chinesisch">Chinesisch</option><option value="">Andere / keine</option></select></div>
          <div class="field full"><label>Versiegelungszustand</label><select id="dvSCondition"><option value="factory_sealed">Factory Sealed</option><option value="sealed_minor_wear">Sealed · leichte Lagerspuren</option><option value="sealed_damage">Sealed · Verpackung beschädigt</option><option value="opened_case_sealed_units">Case geöffnet · enthaltene Einheiten sealed</option></select><div id="dvSConditionHint" class="dvCaseAlert"></div></div>
          <div class="field"><label>Verfügbare Menge</label><input id="dvSQty" type="number" min="1" max="1000" step="1" value="1"></div>
          <div class="field"><label id="dvSUnitsLabel">Einheiten pro Container optional</label><input id="dvSUnits" type="number" min="1" max="1000" step="1" placeholder="z. B. 12"></div>
          <div class="field full"><label>Inhalt / Konfiguration optional</label><input id="dvSContents" maxlength="240" placeholder="z. B. 24 Booster pro Display"></div>
          <div class="field"><label>Gewicht pro Angebot (g) optional</label><input id="dvSWeight" type="number" min="1" max="50000" step="1"></div>
          <div class="field"><label>Maße L × B × H (mm) optional</label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px"><input id="dvSL" type="number" min="1" max="2000" placeholder="L"><input id="dvSW" type="number" min="1" max="2000" placeholder="B"><input id="dvSH" type="number" min="1" max="2000" placeholder="H"></div></div>
          <div class="field"><label>Angebotsart</label><select id="dvSListingType"><option value="sale">Verkauf</option><option value="sale_or_trade">Verkauf oder Tausch</option><option value="trade">Nur Tausch</option></select></div>
          <div class="field"><label>Preis pro Stück €</label><input id="dvSPrice" type="number" min="0" step="0.01"></div>
          <div class="field"><label>Mindestabnahme</label><input id="dvSMinQty" type="number" min="1" max="1000" step="1" value="1"></div>
          <div class="field full"><label>Mengenpreise optional</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><input id="dvSTier1Qty" type="number" min="2" max="1000" placeholder="ab Menge, z. B. 3"><input id="dvSTier1Price" type="number" min="0.01" step="0.01" placeholder="Preis/Stück, z. B. 139"><input id="dvSTier2Qty" type="number" min="2" max="1000" placeholder="ab Menge, z. B. 6"><input id="dvSTier2Price" type="number" min="0.01" step="0.01" placeholder="Preis/Stück, z. B. 135"></div></div>
          <div class="field"><label>Versandart</label><select id="dvSShipping"><option value="parcel">Paket mit Tracking</option><option value="tracked_letter">Brief mit Tracking</option><option value="standard_letter">Standardbrief</option><option value="pickup">Abholung</option><option value="custom">Individuell / nach Absprache</option></select></div>
          <div class="field"><label>Versandkosten €</label><input id="dvSShippingCost" type="number" min="0" max="500" step="0.01"></div>
          <div class="field full"><label>Versandhinweis optional</label><input id="dvSShippingNote" maxlength="240" placeholder="z. B. DHL Paket / versichert"></div>
          <div class="field full"><label>Hinweis zum Produkt optional</label><textarea id="dvSNote" rows="3" maxlength="800" placeholder="Zustand der Folie, Druckstellen, Case-Tape usw."></textarea></div>
          <div class="full dvPhotoDrop"><b>Echte Produktfotos</b><div id="dvSPhotoRule" class="dvPhotoRule">Mindestens 1 Foto · maximal 6 · JPG, PNG oder WebP · max. 8 MB je Foto.</div><input id="dvSFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple><div id="dvSPhotos" class="dvPhotoGrid"></div></div>
          <div class="full dvSealedHint">Käufer wählen die gewünschte Stückzahl aus dem Lagerbestand. Mengenpreise werden automatisch berücksichtigt; mehrere Käufe beim selben Verkäufer laufen anschließend in einer DUELVANTA Order zusammen.</div>
        </div>
        <button id="dvSSave" class="btn gold" type="button" style="width:100%;margin-top:14px">SEALED ANGEBOT VERÖFFENTLICHEN</button><div id="dvSMsg" class="msg"></div>
      </div>`;
      document.body.appendChild(d);
      d.querySelector('[data-dv-sealed-close]').onclick=()=>d.close();
    }
    if(!document.getElementById('dvOfferQuantity')){
      const amount=document.getElementById('offerAmount')?.closest('.field');
      if(amount){const q=document.createElement('div');q.className='field';q.id='dvOfferQuantity';q.style.display='none';q.innerHTML='<label>Menge</label><input id="dvOfferQty" type="number" min="1" step="1" value="1"><div id="dvOfferQtyHint" class="msg"></div>';amount.parentNode.insertBefore(q,amount)}
    }
  }

  function formEls(){
    return {
      dlg:document.getElementById('dvSealedDialog'),tcg:document.getElementById('dvSTcg'),cat:document.getElementById('dvSCat'),name:document.getElementById('dvSName'),set:document.getElementById('dvSSet'),lang:document.getElementById('dvSLang'),cond:document.getElementById('dvSCondition'),qty:document.getElementById('dvSQty'),minQty:document.getElementById('dvSMinQty'),tier1Qty:document.getElementById('dvSTier1Qty'),tier1Price:document.getElementById('dvSTier1Price'),tier2Qty:document.getElementById('dvSTier2Qty'),tier2Price:document.getElementById('dvSTier2Price'),units:document.getElementById('dvSUnits'),contents:document.getElementById('dvSContents'),weight:document.getElementById('dvSWeight'),l:document.getElementById('dvSL'),w:document.getElementById('dvSW'),h:document.getElementById('dvSH'),listingType:document.getElementById('dvSListingType'),price:document.getElementById('dvSPrice'),shipping:document.getElementById('dvSShipping'),shippingCost:document.getElementById('dvSShippingCost'),shippingNote:document.getElementById('dvSShippingNote'),note:document.getElementById('dvSNote'),files:document.getElementById('dvSFiles'),photos:document.getElementById('dvSPhotos'),msg:document.getElementById('dvSMsg'),save:document.getElementById('dvSSave')
    };
  }
  function refreshFormRules(){
    const e=formEls(),isCase=e.cat.value==='case',pickup=e.shipping.value==='pickup';
    document.getElementById('dvSPhotoRule').textContent=`Mindestens ${isCase?3:1} echte Produktfoto${isCase?'s':''} · maximal 6 · JPG, PNG oder WebP · max. 8 MB je Foto.`;
    document.getElementById('dvSUnitsLabel').textContent=isCase?'Displays / Einheiten pro Case':'Einheiten pro Container optional';
    document.getElementById('dvSConditionHint').textContent=isCase?'Ein original verschlossenes Case bitte als „Factory Sealed“ angeben. Für ein geöffnetes Case mit sealed Displays die eigene Option wählen.':'';
    if(pickup){e.shippingCost.value='0';e.shippingCost.disabled=true}else e.shippingCost.disabled=false;
  }
  function resetForm(){
    const e=formEls();
    e.tcg.value='pokemon';e.cat.value='display';e.name.value='';e.set.value='';e.lang.value='Deutsch';e.cond.value='factory_sealed';e.qty.value='1';e.minQty.value='1';e.tier1Qty.value='';e.tier1Price.value='';e.tier2Qty.value='';e.tier2Price.value='';e.units.value='';e.contents.value='';e.weight.value='';e.l.value='';e.w.value='';e.h.value='';e.listingType.value='sale';e.price.value='';e.shipping.value='parcel';e.shippingCost.value='';e.shippingNote.value='';e.note.value='';e.files.value='';e.photos.innerHTML='';e.msg.textContent='';
    refreshFormRules();
  }
  function fillForm(l){
    const e=formEls();
    const tiers=Array.isArray(l.quantity_pricing)?l.quantity_pricing:[];e.tcg.value=l.tcg||'pokemon';e.cat.value=l.sealed_category||'display';e.name.value=l.card_name||'';e.set.value=l.set_name||'';e.lang.value=l.language||'';e.cond.value=l.sealed_condition||'factory_sealed';e.qty.value=l.quantity_available??l.stock_quantity??l.bundle_quantity??1;e.minQty.value=l.minimum_purchase_quantity||1;e.tier1Qty.value=tiers[0]?.min_quantity||'';e.tier1Price.value=tiers[0]?.unit_price||'';e.tier2Qty.value=tiers[1]?.min_quantity||'';e.tier2Price.value=tiers[1]?.unit_price||'';e.units.value=l.units_per_container||'';e.contents.value=l.package_contents||'';e.weight.value=l.weight_grams||'';e.l.value=l.length_mm||'';e.w.value=l.width_mm||'';e.h.value=l.height_mm||'';e.listingType.value=l.listing_type||'sale';e.price.value=l.asking_price??'';e.shipping.value=l.shipping_method||'parcel';e.shippingCost.value=l.shipping_cost??'';e.shippingNote.value=l.shipping_note||'';e.note.value=l.seller_note||'';e.files.value='';e.msg.textContent='';
    refreshFormRules();
  }
  function validateForm(existingCount=0){
    const e=formEls(),name=e.name.value.trim(),qty=Number(e.qty.value),minQty=Number(e.minQty.value),price=numberOrNull(e.price.value),ship=numberOrNull(e.shippingCost.value),files=[...e.files.files];
    if(!name)throw new Error('Bitte Produktname angeben.');
    if(!Number.isInteger(qty)||qty<1||qty>1000)throw new Error('Bitte gültige Anzahl angeben.');
    if(!Number.isInteger(minQty)||minQty<1||minQty>qty)throw new Error('Die Mindestabnahme muss zwischen 1 und dem Lagerbestand liegen.');
    if(e.listingType.value==='sale'&&(!price||price<=0))throw new Error('Für Verkauf bitte einen positiven Preis angeben.');
    if(e.shipping.value!=='pickup'&&(ship===null||ship<0||ship>500))throw new Error('Bitte gültige Versandkosten angeben. 0 € ist für kostenlosen Versand möglich.');
    if(e.shipping.value==='custom'&&!e.shippingNote.value.trim())throw new Error('Bitte individuelle Versandart kurz beschreiben.');
    const min=e.cat.value==='case'?3:1;
    if(mode==='create'&&files.length<min)throw new Error(`Bitte mindestens ${min} echte Produktfoto${min>1?'s':''} auswählen.`);
    if(mode==='edit'&&existingCount+files.length<min)throw new Error(`Mindestens ${min} Produktfoto${min>1?'s':''} erforderlich.`);
    if(existingCount+files.length>MAX_FILES)throw new Error('Maximal 6 Produktfotos erlaubt.');
    for(const f of files){
      if(!['image/jpeg','image/png','image/webp'].includes(f.type))throw new Error('Fotos bitte als JPG, PNG oder WebP hochladen.');
      if(f.size>MAX_BYTES)throw new Error(`${f.name}: maximal 8 MB pro Foto.`);
    }
    const tiers=[[e.tier1Qty,e.tier1Price],[e.tier2Qty,e.tier2Price]].map(([q,p])=>({min_quantity:numberOrNull(q.value),unit_price:numberOrNull(p.value)})).filter(x=>x.min_quantity!==null||x.unit_price!==null);
    for(const t of tiers)if(!Number.isInteger(t.min_quantity)||t.min_quantity<=minQty||t.min_quantity>qty||!t.unit_price||t.unit_price<=0||t.unit_price>=price)throw new Error('Mengenpreise brauchen eine gültige Menge und einen Stückpreis unter dem Basispreis.');
    tiers.sort((a,b)=>a.min_quantity-b.min_quantity);if(new Set(tiers.map(t=>t.min_quantity)).size!==tiers.length)throw new Error('Mengenpreis-Mengen dürfen nicht identisch sein.');
    return {files,name,qty,minQty,tiers,price,ship:e.shipping.value==='pickup'?0:(ship??0)};
  }
  function rpcPayload(v){
    const e=formEls();
    return {
      p_tcg:e.tcg.value,p_product_name:v.name,p_set_code:e.set.value.trim()||null,p_language:e.lang.value||null,p_sealed_category:e.cat.value,p_sealed_condition:e.cond.value,
      p_stock_quantity:v.qty,p_minimum_purchase_quantity:v.minQty,p_quantity_pricing:v.tiers,p_package_contents:e.contents.value.trim()||null,p_units_per_container:numberOrNull(e.units.value),p_weight_grams:numberOrNull(e.weight.value),p_length_mm:numberOrNull(e.l.value),p_width_mm:numberOrNull(e.w.value),p_height_mm:numberOrNull(e.h.value),
      p_listing_type:e.listingType.value,p_asking_price:v.price,p_seller_note:e.note.value.trim()||null,p_shipping_method:e.shipping.value,p_shipping_cost:v.ship,p_shipping_note:e.shippingNote.value.trim()||null
    };
  }
  function fileExt(f){return f.type==='image/png'?'png':f.type==='image/webp'?'webp':'jpg'}
  async function uploadFiles(listingId,files,usedOrders=[]){
    const paths=[];
    const free=[0,1,2,3,4,5].filter(x=>!usedOrders.includes(x));
    for(let i=0;i<files.length;i++){
      const f=files[i],order=free[i],path=`${user.id}/${listingId}/${crypto.randomUUID()}.${fileExt(f)}`;
      const {error:upErr}=await db.storage.from(BUCKET).upload(path,f,{cacheControl:'3600',upsert:false,contentType:f.type});
      if(upErr)throw upErr;
      paths.push(path);
      const {error:metaErr}=await db.rpc('add_my_market_listing_image',{p_listing_id:listingId,p_storage_path:path,p_sort_order:order});
      if(metaErr){await db.storage.from(BUCKET).remove([path]);throw metaErr;}
    }
    return paths;
  }
  async function renderEditPhotos(){
    const e=formEls();
    if(!editListing){e.photos.innerHTML='';return}
    try{
      editManifest=await manifest([editListing.id]);
      const rows=await Promise.all(editManifest.map(async x=>({x,url:await signed(x.storage_path)})));
      e.photos.innerHTML=rows.map(({x,url})=>`<div class="dvPhoto" data-image-id="${x.image_id}"><img src="${htmlEscape(url)}" alt="Produktfoto"><button type="button" data-remove-sealed-photo="${x.image_id}">✕</button></div>`).join('');
    }catch(err){e.photos.innerHTML=`<div class="msg">${htmlEscape(err.message||'Fotos konnten nicht geladen werden.')}</div>`}
  }
  async function openCreate(){
    mode='create';editListing=null;editManifest=[];resetForm();
    document.getElementById('dvSealedHeading').textContent='Sealed anbieten';formEls().save.textContent='SEALED ANGEBOT VERÖFFENTLICHEN';formEls().dlg.showModal();
  }
  async function openEdit(l){
    mode='edit';editListing=l;fillForm(l);document.getElementById('dvSealedHeading').textContent='Sealed Angebot bearbeiten';formEls().save.textContent='ÄNDERUNGEN SPEICHERN';formEls().dlg.showModal();await renderEditPhotos();
  }
  async function saveSealed(){
    const e=formEls();e.msg.textContent='';e.save.disabled=true;e.dlg.classList.add('dvSealedLoading');
    let draftId=null,uploaded=[];
    try{
      const v=validateForm(editManifest.length),payload=rpcPayload(v);
      if(mode==='create'){
        const {data,error}=await db.rpc('create_sealed_market_listing_draft_v2',payload);if(error)throw error;draftId=data;
        uploaded=await uploadFiles(draftId,v.files,[]);
        const {error:pubErr}=await db.rpc('publish_my_sealed_market_listing',{p_listing_id:draftId});if(pubErr)throw pubErr;
        e.msg.textContent='Sealed-Angebot veröffentlicht.';
      }else{
        const editPayload={p_listing_id:editListing.id,...payload};
        const {error}=await db.rpc('edit_my_sealed_market_listing_v2',editPayload);if(error)throw error;
        if(v.files.length)await uploadFiles(editListing.id,v.files,editManifest.map(x=>Number(x.sort_order)));
        e.msg.textContent='Änderungen gespeichert.';
      }
      await loadListings();scheduleDecorate();setTimeout(()=>e.dlg.close(),350);
    }catch(err){
      if(mode==='create'&&draftId){
        try{const {data:paths}=await db.rpc('delete_my_sealed_market_listing_draft',{p_listing_id:draftId});const all=[...(paths||[]),...uploaded];if(all.length)await db.storage.from(BUCKET).remove([...new Set(all)]);}catch{}
      }
      e.msg.textContent=err.message||'Sealed-Angebot konnte nicht gespeichert werden.';
    }finally{e.save.disabled=false;e.dlg.classList.remove('dvSealedLoading')}
  }

  async function chooseCollection(kind,originalSell,typeDlg){
    typeDlg.close();
    await originalSell.call(document.getElementById('sell'));
    const wantGraded=kind==='graded';
    const title=document.querySelector('#pickDialog .modalHead h2');if(title)title.textContent=wantGraded?'Graded Card auswählen':'Single auswählen';
    document.querySelectorAll('#collectionList [data-pick]').forEach(btn=>{
      const x=items.find(i=>i.id===btn.dataset.pick),graded=!!(x?.grading_company||x?.grade);
      const row=btn.closest('.pick');if(row)row.style.display=(graded===wantGraded)?'':'none';
    });
  }

  function addProductFilter(){
    const toolbar=document.querySelector('.toolbar');if(!toolbar||document.getElementById('dvProductFilter'))return;
    const s=document.createElement('select');s.id='dvProductFilter';s.className='dvProductFilter';s.innerHTML='<option value="">Alle Produkte</option><option value="single">Singles</option><option value="graded">Graded</option><option value="sealed">Sealed</option>';
    const sort=document.getElementById('sort');toolbar.insertBefore(s,sort||null);s.onchange=scheduleDecorate;
  }
  async function decorateListings(){
    const cards=[...document.querySelectorAll('#grid .listing')];
    if(!cards.length)return;
    const mapped=cards.map(card=>({card,id:listingId(card)})).filter(x=>x.id);
    const ids=[...new Set(mapped.map(x=>x.id))];
    let mf=[];try{mf=await manifest(ids)}catch{}
    const byListing=new Map();for(const i of mf){if(!byListing.has(i.listing_id))byListing.set(i.listing_id,[]);byListing.get(i.listing_id).push(i)}
    const filter=document.getElementById('dvProductFilter')?.value||'';
    await Promise.all(mapped.map(async ({card,id})=>{
      const l=listings.find(x=>x.id===id);if(!l)return;
      card.style.display=filter&&l.product_kind!==filter?'none':'';
      card.querySelector('.dvSealedMeta')?.remove();
      if(l.product_kind==='sealed'){
        const meta=card.querySelector('.meta');
        if(meta)meta.insertAdjacentHTML('afterend',`<div class="dvSealedMeta"><span class="dvProductKindBadge">SEALED</span><br><b>${htmlEscape(CATS[l.sealed_category]||'SEALED')}</b> · ${htmlEscape(CONDITIONS[l.sealed_condition]||'')} · ${Number(l.quantity_available??l.stock_quantity??l.bundle_quantity??1)} VERFÜGBAR${l.package_contents?`<br>${htmlEscape(l.package_contents)}`:''}<div class="dvSealedPhotoCount">Echte Produktfotos · ${byListing.get(id)?.length||0}/6</div></div>`);
        const first=byListing.get(id)?.[0];
        if(first){try{const url=await signed(first.storage_path);const photo=card.querySelector('.photo');if(photo){let img=photo.querySelector('img');if(!img){img=document.createElement('img');photo.prepend(img)}img.classList.remove('v');img.src=url;img.style.objectFit='contain';}}catch{}}
        const tiers=Array.isArray(l.quantity_pricing)?l.quantity_pricing:[];if(tiers.length)card.querySelector('.dvSealedMeta')?.insertAdjacentHTML('beforeend',`<br>Mengenpreis: ${tiers.map(t=>`ab ${Number(t.min_quantity)} × ${Number(t.unit_price).toLocaleString('de-DE',{style:'currency',currency:'EUR'})}`).join(' · ')}`);
      }
    }));
  }
  async function decorateDeals(){
    const cards=[...document.querySelectorAll('#grid .dvDealCard')];if(!cards.length)return;
    try{
      const {data,error}=await db.rpc('get_my_market_deals');if(error)throw error;const rows=data||[];
      cards.forEach((card,i)=>{const d=rows[i];if(!d)return;card.querySelector('.dvSealedDealMeta')?.remove();if(d.product_kind==='sealed'){const price=card.querySelector('.dvDealPrice');price?.insertAdjacentHTML('afterend',`<div class="dvSealedDealMeta">SEALED · ${htmlEscape(CATS[d.sealed_category]||'PRODUKT')} · ${Number(d.item_quantity||1)}×${d.package_contents?' · '+htmlEscape(d.package_contents):''}</div>`)}});
    }catch(e){console.warn('Sealed deal decoration',e)}
  }
  async function decorateDaily(){
    const root=document.getElementById('dailyContent'),img=root?.querySelector('.dailyImg img');if(!img)return;
    const deals=listings.filter(l=>l.status==='active'&&l.asking_price&&l.market_price_snapshot).sort((a,b)=>{const da=((a.asking_price/a.market_price_snapshot)-1)*100,dbb=((b.asking_price/b.market_price_snapshot)-1)*100;return da-dbb}).slice(0,5);
    const l=deals[Number(typeof dailyIndex!=='undefined'?dailyIndex:0)];if(!l||l.product_kind!=='sealed')return;
    try{const mf=await manifest([l.id]),first=mf[0];if(first){img.src=await signed(first.storage_path);img.className='card';img.style.objectFit='contain'}}catch{}
  }
  async function decorate(){
    if(renderBusy)return;renderBusy=true;try{await decorateListings();await decorateDeals();await decorateDaily()}finally{renderBusy=false}
  }
  function scheduleDecorate(){clearTimeout(renderTimer);renderTimer=setTimeout(decorate,110)}

  function install(){
    if(installed)return true;
    if(typeof db==='undefined'||typeof user==='undefined'||!user||typeof listings==='undefined'||typeof items==='undefined'||typeof loadListings!=='function')return false;
    const sell=document.getElementById('sell'),grid=document.getElementById('grid');if(!sell||!grid)return false;
    installed=true;injectStyle();buildDialogs();addProductFilter();
    sell.textContent='+ PRODUKT ANBIETEN';
    const search=document.getElementById('search');if(search)search.placeholder='Karte, Produkt, Set oder Nummer suchen';
    const originalSell=sell.onclick,typeDlg=document.getElementById('dvProductTypeDialog');
    sell.onclick=e=>{e?.preventDefault();typeDlg.showModal()};
    typeDlg.addEventListener('click',async e=>{const b=e.target.closest('[data-dv-kind]');if(!b)return;const kind=b.dataset.dvKind;if(kind==='sealed'){typeDlg.close();await openCreate();return}await chooseCollection(kind,originalSell,typeDlg)});
    const e=formEls();e.cat.onchange=refreshFormRules;e.shipping.onchange=refreshFormRules;e.save.onclick=saveSealed;
    const offerQtyBox=document.getElementById('dvOfferQuantity'),offerQty=document.getElementById('dvOfferQty'),offerHint=document.getElementById('dvOfferQtyHint'),sendOffer=document.getElementById('sendOffer'),originalSendOffer=sendOffer?.onclick;
    function refreshOfferQuantity(){const l=typeof offerTarget!=='undefined'?offerTarget:null,isSealed=l?.product_kind==='sealed';if(!offerQtyBox)return;offerQtyBox.style.display=isSealed?'':'none';if(!isSealed)return;const available=Number(l.quantity_available??l.stock_quantity??l.bundle_quantity??1),min=Number(l.minimum_purchase_quantity||1),qty=Math.max(min,Math.min(available,Number(offerQty.value)||min));offerQty.min=String(min);offerQty.max=String(available);offerQty.value=String(qty);const unit=unitPriceFor(l,qty),total=unit*qty;offerHint.textContent=`${available} verfügbar · Richtpreis ${total.toLocaleString('de-DE',{style:'currency',currency:'EUR'})} (${unit.toLocaleString('de-DE',{style:'currency',currency:'EUR'})}/Stück)`;document.getElementById('offerAmount').value=total.toFixed(2)}
    offerQty?.addEventListener('input',refreshOfferQuantity);
    grid.addEventListener('click',ev=>{const b=ev.target.closest('[data-offer]');if(!b)return;setTimeout(refreshOfferQuantity,0)},true);
    if(sendOffer)sendOffer.onclick=async()=>{const l=typeof offerTarget!=='undefined'?offerTarget:null;if(!l)return originalSendOffer?.call(sendOffer);const sealed=l.product_kind==='sealed',qty=sealed?Number(offerQty.value):1,amount=Number(document.getElementById('offerAmount').value),available=sealed?Number(l.quantity_available??l.stock_quantity??l.bundle_quantity??1):1,min=sealed?Number(l.minimum_purchase_quantity||1):1;if(!Number.isInteger(qty)||qty<min||qty>available||!amount||amount<=0){document.getElementById('offerMsg').textContent='Bitte gültige Menge und Angebotssumme eingeben.';return}const {error}=await db.rpc('create_market_offer_v2',{p_listing_id:l.id,p_requested_quantity:qty,p_amount:amount,p_message:document.getElementById('offerMessage').value.trim()||null});document.getElementById('offerMsg').textContent=error?error.message:'Angebot gesendet.';if(!error){setTimeout(()=>document.getElementById('offerDialog').close(),700);await loadListings()}};
    e.files.onchange=()=>{
      if(mode==='edit'){const newFiles=[...e.files.files];const placeholders=newFiles.map(f=>`<div class="dvPhoto"><img src="${URL.createObjectURL(f)}" alt="Neues Produktfoto"></div>`).join('');renderEditPhotos().then(()=>{e.photos.insertAdjacentHTML('beforeend',placeholders)});return}
      e.photos.innerHTML=[...e.files.files].slice(0,MAX_FILES).map(f=>`<div class="dvPhoto"><img src="${URL.createObjectURL(f)}" alt="Produktfoto"></div>`).join('');
    };
    e.photos.addEventListener('click',async ev=>{const b=ev.target.closest('[data-remove-sealed-photo]');if(!b)return;const row=editManifest.find(x=>x.image_id===b.dataset.removeSealedPhoto);if(!row)return;if(!confirm('Dieses Produktfoto entfernen?'))return;b.disabled=true;const {data:path,error}=await db.rpc('remove_my_market_listing_image',{p_image_id:row.image_id});if(error){alert(error.message);b.disabled=false;return}if(path)await db.storage.from(BUCKET).remove([path]);await renderEditPhotos();scheduleDecorate()});
    grid.addEventListener('click',ev=>{const b=ev.target.closest('[data-edit]');if(!b)return;const l=listings.find(x=>x.id===b.dataset.edit);if(!l||l.product_kind!=='sealed')return;ev.preventDefault();ev.stopImmediatePropagation();openEdit(l)},true);
    const obs=new MutationObserver(scheduleDecorate);obs.observe(grid,{childList:true});const daily=document.getElementById('dailyContent');if(daily)new MutationObserver(scheduleDecorate).observe(daily,{childList:true});
    scheduleDecorate();window.DV_TRADE_SEALED={version:'1.1.1',refresh:scheduleDecorate,openCreate};return true;
  }
  let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>140)clearInterval(t)},100);
})();
