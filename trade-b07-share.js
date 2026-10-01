/* B07 / L07-01 public listing share + 9:16 story card. No seller-private data. */
(() => {
  'use strict';
  let installed=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const publicUrl=id=>`${location.origin}/listing/${encodeURIComponent(id)}`;
  const listingById=id=>typeof listings==='undefined'?null:listings.find(x=>x.id===id)||null;
  const price=l=>l.asking_price!=null?new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(l.asking_price)):'Preis auf Anfrage';
  const title=l=>`${l.card_name||'TCG-Angebot'} · DUELVANTA`;
  const text=l=>[l.tcg==='pokemon'?'Pokémon':l.tcg==='one_piece'?'One Piece':l.tcg,l.set_name,l.card_number,l.language,price(l)].filter(Boolean).join(' · ');

  function listingId(card){
    const el=card.querySelector('[data-offer],[data-edit],[data-pause],[data-finish],[data-renew],[data-complete],[data-swap-propose]');if(!el)return null;
    return el.dataset.offer||el.dataset.edit||el.dataset.pause||el.dataset.finish||el.dataset.renew||el.dataset.complete||el.dataset.swapPropose||null;
  }

  function feedback(button,message){
    const old=button.textContent;button.textContent=message;setTimeout(()=>{if(button.isConnected)button.textContent=old},1400);
  }

  async function copy(value){
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return}
    const area=document.createElement('textarea');area.value=value;area.style.cssText='position:fixed;left:-9999px;top:-9999px';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
  }

  async function share(id,button){
    const l=listingById(id);if(!l||l.status!=='active')return;
    const url=publicUrl(id),payload={title:title(l),text:text(l),url};
    try{
      if(navigator.share){await navigator.share(payload);return}
      await copy(url);feedback(button,'LINK KOPIERT ✓');
    }catch(error){
      if(error?.name==='AbortError')return;
      try{await copy(url);feedback(button,'LINK KOPIERT ✓')}catch{feedback(button,'TEILEN FEHLGESCHLAGEN')}
    }
  }

  const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=reject;img.src=src});
  function wrap(ctx,value,x,y,maxWidth,lineHeight,maxLines){
    const words=String(value||'').split(/\s+/);let line='',lines=0;
    for(const word of words){const next=line?`${line} ${word}`:word;if(ctx.measureText(next).width>maxWidth&&line){ctx.fillText(line,x,y+lines*lineHeight);lines++;line=word;if(lines>=maxLines)return y+lines*lineHeight}else line=next}
    if(line&&lines<maxLines){ctx.fillText(line,x,y+lines*lineHeight);lines++}return y+lines*lineHeight;
  }

  async function story(id,button){
    const l=listingById(id);if(!l||l.status!=='active')return;
    button.disabled=true;
    try{
      const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;const ctx=canvas.getContext('2d');
      ctx.fillStyle='#07090d';ctx.fillRect(0,0,1080,1920);
      ctx.fillStyle='#c7a45d';ctx.fillRect(72,82,936,4);
      ctx.font='700 34px system-ui';ctx.letterSpacing='6px';ctx.fillStyle='#c7a45d';ctx.fillText('DUELVANTA · TRADE',72,145);
      let img=null;try{if(l.image_path&&typeof signed==='function'){const src=await signed(l.image_path);if(src)img=await loadImage(src)}}catch{}
      const box={x:130,y:245,w:820,h:900};ctx.fillStyle='#0d1117';ctx.fillRect(box.x,box.y,box.w,box.h);
      if(img){const scale=Math.min(box.w/img.width,box.h/img.height),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,box.x+(box.w-w)/2,box.y+(box.h-h)/2,w,h)}
      else{ctx.fillStyle='#c7a45d';ctx.font='700 210px Georgia,serif';ctx.textAlign='center';ctx.fillText('V',540,760);ctx.textAlign='left'}
      ctx.fillStyle='#f2eee7';ctx.font='500 62px Georgia,serif';let y=1245;y=wrap(ctx,l.card_name||'TCG-Angebot',72,y,936,76,3)+28;
      ctx.fillStyle='#9ea6b0';ctx.font='400 32px system-ui';y=wrap(ctx,[l.set_name,l.card_number,l.language,l.condition].filter(Boolean).join(' · '),72,y,936,44,3)+38;
      ctx.fillStyle='#efd18c';ctx.font='500 62px Georgia,serif';ctx.fillText(price(l),72,y);y+=110;
      ctx.fillStyle='#9ea6b0';ctx.font='400 27px system-ui';ctx.fillText('Öffentliches Angebot · Keine privaten Verkäuferdaten',72,y);y+=54;
      ctx.fillStyle='#f2eee7';ctx.font='600 28px system-ui';ctx.fillText(publicUrl(id).replace(/^https?:\/\//,''),72,y);
      ctx.fillStyle='#c7a45d';ctx.fillRect(72,1810,936,4);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',0.94));if(!blob)throw new Error('story_render_failed');
      const file=new File([blob],`duelvanta-story-${id}.png`,{type:'image/png'});
      if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({title:title(l),text:text(l),files:[file]});return}
      const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);feedback(button,'STORY ERSTELLT ✓');
    }catch(error){if(error?.name!=='AbortError')feedback(button,'STORY FEHLGESCHLAGEN')}finally{button.disabled=false}
  }

  function decorate(){
    if(typeof listings==='undefined')return;
    document.querySelectorAll('article.listing').forEach(card=>{
      const id=listingId(card),l=id&&listingById(id);if(!l||l.status!=='active')return;
      const actions=card.querySelector('.actions');if(!actions||actions.querySelector(`[data-b07-share="${CSS.escape(id)}"]`))return;
      const shareButton=document.createElement('button');shareButton.type='button';shareButton.className='btn ghost';shareButton.dataset.b07Share=id;shareButton.textContent='TEILEN';
      const storyButton=document.createElement('button');storyButton.type='button';storyButton.className='btn ghost';storyButton.dataset.b07Story=id;storyButton.textContent='STORY';
      actions.append(shareButton,storyButton);
    });
  }

  function install(){
    if(installed||typeof user==='undefined'||!user)return false;installed=true;
    document.addEventListener('click',event=>{
      const s=event.target.closest?.('[data-b07-share]');if(s){event.preventDefault();event.stopImmediatePropagation();share(s.dataset.b07Share,s);return}
      const st=event.target.closest?.('[data-b07-story]');if(st){event.preventDefault();event.stopImmediatePropagation();story(st.dataset.b07Story,st)}
    },true);
    const grid=document.getElementById('grid');if(grid)new MutationObserver(()=>decorate()).observe(grid,{childList:true,subtree:true});decorate();
    window.DV_B07_SHARE={version:'1.0',refresh:decorate};return true;
  }
  let tries=0;const wait=setInterval(()=>{tries++;if(install()||tries>150)clearInterval(wait)},80);
})();
