(()=>{
  'use strict';
  let pickedId=null,dragId=null,moving=false;
  const imageUrls=new Map();
  function pageCount(total,placed,configured){const physical=(placed||[]).length?Math.max(...placed.map(x=>Number(x.binder_page)||0)):0;return Math.max(2,physical,Math.ceil(Number(total||0)/9),Number(configured)||0)}
  function composeSlots(placed,unplaced,pages){
    const slots=Array.from({length:Math.max(1,pages)*9},()=>null);
    for(const item of placed||[]){const p=Number(item.binder_page),s=Number(item.binder_slot),at=(p-1)*9+s-1;if(p>=1&&s>=1&&s<=9&&at<slots.length&&!slots[at])slots[at]=item}
    let next=0;for(let i=0;i<slots.length&&next<(unplaced||[]).length;i++)if(!slots[i])slots[i]=unplaced[next++];return slots
  }
  function install(){
    if(typeof renderBinder!=='function'||typeof filtered!=='function'||typeof folderItems!=='function'||typeof loadPrivateImages!=='function'||typeof items==='undefined')return false;
    const oldRender=renderBinder,prev=document.getElementById('prevPage'),next=document.getElementById('nextPage'),slotsHost=document.getElementById('slots'),pageDots=document.getElementById('pageDots');
    const hasFilters=()=>!!(document.getElementById('search')?.value.trim()||document.getElementById('tcgFilter')?.value||document.getElementById('gradeFilter')?.value);
    const announce=message=>{let el=document.getElementById('binderMoveStatus');if(!el){el=document.createElement('div');el.id='binderMoveStatus';el.className='binderMoveStatus';el.setAttribute('aria-live','polite');document.getElementById('binderPage').insertAdjacentElement('beforebegin',el)}el.textContent=message};
    const activeBinder=()=>folders.find(x=>x.id===activeFolder)||null;
    const rememberImages=()=>{for(const img of slotsHost.querySelectorAll('img[data-imgpath]'))if(img.src)imageUrls.set(img.dataset.imgpath,img.src)};
    function model(){
      if(!activeFolder||activeFolder==='__graded__'||hasFilters())return null;const xs=folderItems(activeFolder),placed=xs.filter(x=>Number(x.binder_page)>=1&&Number(x.binder_slot)>=1),unplaced=xs.filter(x=>!(Number(x.binder_page)>=1&&Number(x.binder_slot)>=1)),physical=placed.length?Math.max(...placed.map(x=>Number(x.binder_page))):0,configured=Number(activeBinder()?.binder_pages)||2,pages=pageCount(xs.length,placed,configured);return{xs,placed,unplaced,physical,configured,pages,slots:composeSlots(placed,unplaced,pages)}
    }
    const card=(x,p,s)=>{const known=x?.image_path&&imageUrls.get(x.image_path);return x?`<div class="cardSlot hasCard${pickedId===x.id?' moveSelected':''}" draggable="true" data-edit="${x.id}" data-card-id="${x.id}" data-page="${p}" data-slot="${s}">${x.image_path?`<img data-imgpath="${esc(x.image_path)}"${known?` src="${esc(known)}" data-loaded="1"`:''} alt="${esc(x.card_name)}">`:''}${x.market_price!=null?`<span class="slotPrice">≈ ${money.format(n(x.market_price))}</span>`:''}<button class="slotMove" type="button" data-move="${x.id}" aria-label="${esc(x.card_name)} verschieben">↔</button><div class="slotMeta"><strong>${esc(x.card_name)}</strong>${esc(x.card_number||'')}</div></div>`:`<div class="cardSlot emptySlot" data-page="${p}" data-slot="${s}"></div>`};
    renderBinder=function(){
      const m=model();if(!m){pickedId=null;oldRender();syncPageControl();announce(activeFolder==='__graded__'?'Die Graded Collection ist eine Übersicht. Feste Plätze verwaltest du in einem eigenen Binder.':hasFilters()?'Für feste Plätze zuerst Suche und Filter zurücksetzen.':'Zum Verschieben oben einen eigenen Binder öffnen. Karten ohne Binder liegen in der Master Collection.');return}page=Math.max(0,Math.min(page,m.pages-1));const targetPage=page+1,visible=m.slots.slice(page*9,page*9+9);rememberImages();pageDots.textContent=`Seite ${targetPage} / ${m.pages} · feste Binderplätze · verschiebbar`;
      slotsHost.innerHTML=visible.map((x,i)=>card(x,targetPage,i+1)).join('');prev.disabled=page===0;next.disabled=page>=m.pages-1;const bp=document.getElementById('binderPage');bp.classList.remove('turning');requestAnimationFrame(()=>bp.classList.add('turning'));loadPrivateImages();announce(pickedId?'Zielplatz antippen. Belegte Plätze werden getauscht.':'↔ unten wählen · Karte antippen zum Bearbeiten · Desktop: ziehen.');
    };
    function syncPageControl(){let button=document.getElementById('binderPages');if(!button){button=document.createElement('button');button.id='binderPages';button.className='btn secondary binderPages';button.type='button';button.textContent='SEITEN';pageDots.insertAdjacentElement('afterend',button);button.onclick=configurePages}button.classList.toggle('hidden',!activeBinder()||hasFilters())}
    async function configurePages(){const binder=activeBinder(),m=model();if(!binder||!m)return;const minimum=Math.max(2,m.physical,Math.ceil(m.xs.length/9)),raw=prompt(`Wie viele Seiten soll „${binder.name}“ haben? (${minimum}–100)`,String(m.pages));if(raw===null)return;const requested=Number(raw);if(!Number.isInteger(requested)||requested<minimum||requested>100){alert(`Bitte eine ganze Zahl zwischen ${minimum} und 100 eingeben. Bereits belegte Seiten bleiben erhalten.`);return}const {data,error}=await db.from('collection_folders').update({binder_pages:requested}).eq('id',binder.id).eq('user_id',currentUser.id).select('binder_pages').single();if(error){alert('Seitenzahl konnte nicht gespeichert werden: '+error.message);return}binder.binder_pages=Number(data?.binder_pages)||requested;page=Math.min(page,binder.binder_pages-1);renderBinder();renderShelf();announce(`Binder auf ${binder.binder_pages} Seiten eingestellt.`)}
    async function move(itemId,targetPage,targetSlot){
      if(moving||!activeFolder)return;moving=true;announce('Binderplatz wird gespeichert …');
      try{const source=items.find(x=>x.id===itemId),destination=items.find(x=>x.folder_id===activeFolder&&Number(x.binder_page)===Number(targetPage)&&Number(x.binder_slot)===Number(targetSlot));if(!source)throw new Error('Karte wurde nicht gefunden.');const oldPage=source.binder_page,oldSlot=source.binder_slot,{error}=await db.rpc('dv_collect_move_card',{p_item_id:itemId,p_folder_id:activeFolder,p_page:Number(targetPage),p_slot:Number(targetSlot)});if(error)throw error;source.binder_page=Number(targetPage);source.binder_slot=Number(targetSlot);if(destination){destination.binder_page=oldPage??null;destination.binder_slot=oldSlot??null}pickedId=null;renderBinder();announce('Binderplatz gespeichert.')}
      catch(error){announce('Verschieben nicht möglich: '+String(error?.message||error))}
      finally{moving=false}
    }
    slotsHost.addEventListener('click',event=>{const moveButton=event.target.closest('[data-move]'),slot=event.target.closest('[data-page][data-slot]');if(moveButton){event.preventDefault();event.stopPropagation();pickedId=moveButton.dataset.move;renderBinder();return}if(pickedId&&slot){event.preventDefault();event.stopPropagation();const id=pickedId;if(slot.dataset.cardId===id){pickedId=null;renderBinder();return}void move(id,slot.dataset.page,slot.dataset.slot)}},true);
    slotsHost.addEventListener('dragstart',event=>{const cardEl=event.target.closest('[data-card-id]');if(!cardEl||!activeFolder)return;dragId=cardEl.dataset.cardId;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',dragId)});
    slotsHost.addEventListener('dragover',event=>{if(dragId&&event.target.closest('[data-page][data-slot]')){event.preventDefault();event.dataTransfer.dropEffect='move'}});
    slotsHost.addEventListener('drop',event=>{const slot=event.target.closest('[data-page][data-slot]');if(!dragId||!slot)return;event.preventDefault();const id=dragId;dragId=null;if(slot.dataset.cardId!==id)void move(id,slot.dataset.page,slot.dataset.slot)});
    slotsHost.addEventListener('dragend',()=>{dragId=null});
    const style=document.createElement('style');style.textContent='.binderMoveStatus{padding:0 2px 12px;color:#9ba2ad;font-size:12px}.slotMove{position:absolute;left:50%;bottom:7px;top:auto;right:auto;transform:translateX(-50%);z-index:3;width:34px;height:34px;border:1px solid rgba(239,209,140,.6);border-radius:999px;background:rgba(7,9,12,.9);color:#efd18c;font-size:17px}.binderPages{min-width:auto!important;padding:7px 10px!important;font-size:10px}.cardSlot.moveSelected{outline:2px solid #efd18c;outline-offset:2px}.cardSlot[draggable=true]{touch-action:pan-y}@media(pointer:fine){.cardSlot[draggable=true]{cursor:grab}.cardSlot[draggable=true]:active{cursor:grabbing}}';document.head.appendChild(style);
    prev.onclick=()=>{if(page>0){page--;renderBinder()}};next.onclick=()=>{const m=model(),pages=m?.pages||Math.max(1,Math.ceil(filtered().length/9));if(page<pages-1){page++;renderBinder()}};
    const previousRender=render;render=function(){previousRender();syncPageControl()};syncPageControl();
    window.DV_SCAN_V16_BINDER={version:'16.24.0-lab',positionAware:true,interactive:true,persistentPages:true,model,move,configurePages,composeSlots,pageCount};
    return true;
  }
  let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>160)clearInterval(t)},100);
  window.DV_SCAN_V16_BINDER_LAYOUT={composeSlots,pageCount};
})();
