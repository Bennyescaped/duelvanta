(()=>{
  'use strict';
  let pickedId=null,dragId=null,moving=false;
  function pageCount(total,placed){const physical=(placed||[]).length?Math.max(...placed.map(x=>Number(x.binder_page)||0)):0;return Math.max(1,physical,Math.ceil(Number(total||0)/9))}
  function composeSlots(placed,unplaced,pages){
    const slots=Array.from({length:Math.max(1,pages)*9},()=>null);
    for(const item of placed||[]){const p=Number(item.binder_page),s=Number(item.binder_slot),at=(p-1)*9+s-1;if(p>=1&&s>=1&&s<=9&&at<slots.length&&!slots[at])slots[at]=item}
    let next=0;for(let i=0;i<slots.length&&next<(unplaced||[]).length;i++)if(!slots[i])slots[i]=unplaced[next++];return slots
  }
  function install(){
    if(typeof renderBinder!=='function'||typeof filtered!=='function'||typeof folderItems!=='function'||typeof loadPrivateImages!=='function'||typeof items==='undefined')return false;
    const oldRender=renderBinder,prev=document.getElementById('prevPage'),next=document.getElementById('nextPage'),slotsHost=document.getElementById('slots');
    const hasFilters=()=>!!(document.getElementById('search')?.value.trim()||document.getElementById('tcgFilter')?.value||document.getElementById('gradeFilter')?.value);
    const announce=message=>{let el=document.getElementById('binderMoveStatus');if(!el){el=document.createElement('div');el.id='binderMoveStatus';el.className='binderMoveStatus';el.setAttribute('aria-live','polite');document.getElementById('binderPage').insertAdjacentElement('beforebegin',el)}el.textContent=message};
    function model(){
      if(!activeFolder||activeFolder==='__graded__'||hasFilters())return null;const xs=folderItems(activeFolder),placed=xs.filter(x=>Number(x.binder_page)>=1&&Number(x.binder_slot)>=1),unplaced=xs.filter(x=>!(Number(x.binder_page)>=1&&Number(x.binder_slot)>=1)),physical=placed.length?Math.max(...placed.map(x=>Number(x.binder_page))):0,pages=pageCount(xs.length,placed);return{xs,placed,unplaced,physical,pages,slots:composeSlots(placed,unplaced,pages)}
    }
    const card=(x,p,s)=>x?`<div class="cardSlot hasCard${pickedId===x.id?' moveSelected':''}" draggable="true" data-edit="${x.id}" data-card-id="${x.id}" data-page="${p}" data-slot="${s}">${x.image_path?`<img data-imgpath="${esc(x.image_path)}" alt="${esc(x.card_name)}">`:''}${x.market_price!=null?`<span class="slotPrice">≈ ${money.format(n(x.market_price))}</span>`:''}<button class="slotMove" type="button" data-move="${x.id}" aria-label="${esc(x.card_name)} verschieben">↔</button><div class="slotMeta"><strong>${esc(x.card_name)}</strong>${esc(x.card_number||'')}</div></div>`:`<div class="cardSlot emptySlot" data-page="${p}" data-slot="${s}"></div>`;
    renderBinder=function(){
      const m=model();if(!m){pickedId=null;oldRender();announce(activeFolder==='__graded__'?'Die Graded Collection ist eine Übersicht. Feste Plätze verwaltest du in einem eigenen Binder.':hasFilters()?'Für feste Plätze zuerst Suche und Filter zurücksetzen.':'Zum Verschieben oben einen eigenen Binder öffnen. Karten ohne Binder liegen in der Master Collection.');return}page=Math.max(0,Math.min(page,m.pages-1));const targetPage=page+1,visible=m.slots.slice(page*9,page*9+9);document.getElementById('pageDots').textContent=`Seite ${targetPage} / ${m.pages} · feste Binderplätze · verschiebbar`;
      slotsHost.innerHTML=visible.map((x,i)=>card(x,targetPage,i+1)).join('');prev.disabled=page===0;next.disabled=page>=m.pages-1;const bp=document.getElementById('binderPage');bp.classList.remove('turning');requestAnimationFrame(()=>bp.classList.add('turning'));loadPrivateImages();announce(pickedId?'Zielplatz antippen. Belegte Plätze werden getauscht.':'↔ unten wählen · Karte antippen zum Bearbeiten · Desktop: ziehen.');
    };
    async function move(itemId,targetPage,targetSlot){
      if(moving||!activeFolder)return;moving=true;announce('Binderplatz wird gespeichert …');
      try{const {error}=await db.rpc('dv_collect_move_card',{p_item_id:itemId,p_folder_id:activeFolder,p_page:Number(targetPage),p_slot:Number(targetSlot)});if(error)throw error;pickedId=null;await loadItems();announce('Binderplatz gespeichert.')}
      catch(error){announce('Verschieben nicht möglich: '+String(error?.message||error))}
      finally{moving=false}
    }
    slotsHost.addEventListener('click',event=>{const moveButton=event.target.closest('[data-move]'),slot=event.target.closest('[data-page][data-slot]');if(moveButton){event.preventDefault();event.stopPropagation();pickedId=moveButton.dataset.move;renderBinder();return}if(pickedId&&slot){event.preventDefault();event.stopPropagation();const id=pickedId;if(slot.dataset.cardId===id){pickedId=null;renderBinder();return}void move(id,slot.dataset.page,slot.dataset.slot)}},true);
    slotsHost.addEventListener('dragstart',event=>{const cardEl=event.target.closest('[data-card-id]');if(!cardEl||!activeFolder)return;dragId=cardEl.dataset.cardId;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',dragId)});
    slotsHost.addEventListener('dragover',event=>{if(dragId&&event.target.closest('[data-page][data-slot]')){event.preventDefault();event.dataTransfer.dropEffect='move'}});
    slotsHost.addEventListener('drop',event=>{const slot=event.target.closest('[data-page][data-slot]');if(!dragId||!slot)return;event.preventDefault();const id=dragId;dragId=null;if(slot.dataset.cardId!==id)void move(id,slot.dataset.page,slot.dataset.slot)});
    slotsHost.addEventListener('dragend',()=>{dragId=null});
    const style=document.createElement('style');style.textContent='.binderMoveStatus{padding:0 2px 12px;color:#9ba2ad;font-size:12px}.slotMove{position:absolute;left:50%;bottom:7px;top:auto;right:auto;transform:translateX(-50%);z-index:3;width:34px;height:34px;border:1px solid rgba(239,209,140,.6);border-radius:999px;background:rgba(7,9,12,.9);color:#efd18c;font-size:17px}.cardSlot.moveSelected{outline:2px solid #efd18c;outline-offset:2px}.cardSlot[draggable=true]{touch-action:pan-y}@media(pointer:fine){.cardSlot[draggable=true]{cursor:grab}.cardSlot[draggable=true]:active{cursor:grabbing}}';document.head.appendChild(style);
    prev.onclick=()=>{if(page>0){page--;renderBinder()}};next.onclick=()=>{const m=model(),pages=m?.pages||Math.max(1,Math.ceil(filtered().length/9));if(page<pages-1){page++;renderBinder()}};
    window.DV_SCAN_V16_BINDER={version:'16.23.0-lab',positionAware:true,interactive:true,model,move,composeSlots,pageCount};
    return true;
  }
  let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>160)clearInterval(t)},100);
  window.DV_SCAN_V16_BINDER_LAYOUT={composeSlots,pageCount};
})();
