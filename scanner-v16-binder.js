(()=>{
  'use strict';
  function install(){
    if(typeof renderBinder!=='function'||typeof filtered!=='function'||typeof folderItems!=='function'||typeof loadPrivateImages!=='function'||typeof items==='undefined')return false;
    const oldRender=renderBinder,prev=document.getElementById('prevPage'),next=document.getElementById('nextPage');
    const hasFilters=()=>!!(document.getElementById('search')?.value.trim()||document.getElementById('tcgFilter')?.value||document.getElementById('gradeFilter')?.value);
    function model(){
      if(!activeFolder||hasFilters())return null;const xs=folderItems(activeFolder),placed=xs.filter(x=>Number(x.binder_page)>=1&&Number(x.binder_slot)>=1),unplaced=xs.filter(x=>!(Number(x.binder_page)>=1&&Number(x.binder_slot)>=1));if(!placed.length)return null;const physical=Math.max(...placed.map(x=>Number(x.binder_page))),extra=Math.ceil(unplaced.length/9);return{xs,placed,unplaced,physical,pages:Math.max(1,physical+extra)}
    }
    const card=x=>x?`<div class="cardSlot hasCard" data-edit="${x.id}">${x.image_path?`<img data-imgpath="${esc(x.image_path)}" alt="${esc(x.card_name)}">`:''}${x.market_price!=null?`<span class="slotPrice">≈ ${money.format(n(x.market_price))}</span>`:''}<div class="slotMeta"><strong>${esc(x.card_name)}</strong>${esc(x.card_number||'')}</div></div>`:'<div class="cardSlot emptySlot"></div>';
    renderBinder=function(){
      const m=model();if(!m)return oldRender();page=Math.max(0,Math.min(page,m.pages-1));let slots=[];
      if(page<m.physical){const p=page+1;slots=Array.from({length:9},(_,i)=>m.placed.find(x=>Number(x.binder_page)===p&&Number(x.binder_slot)===i+1)||null);document.getElementById('pageDots').textContent=`Seite ${p} / ${m.pages} · feste Binderplätze`}
      else{const offset=(page-m.physical)*9;slots=m.unplaced.slice(offset,offset+9);while(slots.length<9)slots.push(null);document.getElementById('pageDots').textContent=`Unsortiert · Seite ${page+1} / ${m.pages}`}
      document.getElementById('slots').innerHTML=slots.map(card).join('');prev.disabled=page===0;next.disabled=page>=m.pages-1;const bp=document.getElementById('binderPage');bp.classList.remove('turning');requestAnimationFrame(()=>bp.classList.add('turning'));loadPrivateImages();
    };
    prev.onclick=()=>{if(page>0){page--;renderBinder()}};next.onclick=()=>{const m=model(),pages=m?.pages||Math.max(1,Math.ceil(filtered().length/9));if(page<pages-1){page++;renderBinder()}};
    window.DV_SCAN_V16_BINDER={version:'16.0.0-lab',positionAware:true,model};
    return true;
  }
  let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>160)clearInterval(t)},100);
})();
