(()=>{
  'use strict';
  const root=globalThis;
  const VERSION='16.5.0-lab';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function panelHtml(result){
    const g=result?.captureGuidance;if(!g)return'';
    const recovered=result?.recovery?.attempted?`<span class="${result.recovery.success?'good':'neutral'}">${result.recovery.success?'MEHRPASS-OCR HAT DEN CODE GEFUNDEN':'MEHRPASS-OCR OHNE SICHEREN CODE'}</span>`:'';
    const repeat=result?.repeatCapture?'<span class="warn">MÖGLICHE DOPPELAUFNAHME</span>':'';
    const actions=(g.actions||[]).map(x=>`<div>→ ${esc(x)}</div>`).join('');
    return `<section class="dvV16CaptureAdvice ${result?.repeatCapture?'warn':''}"><div class="dvV16CaptureTitle">${esc(g.title)}</div><div class="dvV16CaptureText">${esc(g.text)}</div><div class="dvV16CaptureTags">${recovered}${repeat}</div>${actions?`<div class="dvV16CaptureActions">${actions}</div>`:''}</section>`;
  }
  function addStyles(){
    if(typeof document==='undefined'||document.getElementById('dvV16GuidanceStyle'))return;
    const s=document.createElement('style');s.id='dvV16GuidanceStyle';s.textContent=`
      .dvV16CaptureAdvice{grid-column:1/-1;margin-top:8px;border:1px solid #303640;border-radius:10px;padding:9px;background:rgba(12,15,20,.78)}
      .dvV16CaptureAdvice.warn{border-color:#745c36;background:rgba(90,64,27,.08)}
      .dvV16CaptureTitle{font-size:8px;font-weight:800;letter-spacing:.09em;color:#efd18c}
      .dvV16CaptureText{font-size:8px;color:#929ca8;line-height:1.45;margin-top:4px}
      .dvV16CaptureTags{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}
      .dvV16CaptureTags span{font-size:7px;border:1px solid #343b45;border-radius:999px;padding:3px 6px;color:#87919d}
      .dvV16CaptureTags span.good{border-color:#355d45;color:#9ed2ad}.dvV16CaptureTags span.warn{border-color:#745c36;color:#e6c989}
      .dvV16CaptureActions{margin-top:6px;font-size:8px;line-height:1.5;color:#c3c8ce}
    `;document.head.appendChild(s);
  }
  function decorate(){
    if(typeof document==='undefined')return;
    addStyles();const host=document.getElementById('dvV16Results');if(!host)return;
    const cards=[...host.querySelectorAll('.dvV16Result')],state=root.DV_SCAN_V16_RESILIENCE?.session;
    if(!cards.length){if(host.textContent?.includes('Noch keine V16-Ergebnisse'))root.DV_SCAN_V16_RESILIENCE?.resetSession?.();return}
    const rows=state?.results||[];
    cards.forEach((card,i)=>{
      const r=rows[i];if(!r)return;
      const old=card.querySelector('.dvV16CaptureAdvice'),html=panelHtml(r);
      if(!html){old?.remove();return}
      if(old)old.outerHTML=html;else card.insertAdjacentHTML('beforeend',html);
    });
  }
  function install(){
    if(typeof document==='undefined')return false;addStyles();
    const observer=new MutationObserver(()=>decorate());
    const bind=()=>{
      const host=document.getElementById('dvV16Results');
      if(host&&!host.dataset.v16GuidanceObserved){host.dataset.v16GuidanceObserved='1';observer.observe(host,{childList:true,subtree:true})}
      const reset=document.getElementById('dvV16Reset');
      if(reset&&!reset.dataset.v16GuidanceBound){reset.dataset.v16GuidanceBound='1';reset.addEventListener('click',()=>root.DV_SCAN_V16_RESILIENCE?.resetSession?.())}
      decorate();
      return !!host;
    };
    let tries=0;const t=setInterval(()=>{tries++;if(bind()||tries>160)clearInterval(t)},50);return true;
  }
  root.DV_SCAN_V16_GUIDANCE={version:VERSION,panelHtml,decorate,install};
  if(typeof document!=='undefined')install();
})();
