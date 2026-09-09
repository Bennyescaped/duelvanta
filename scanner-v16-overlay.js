(()=>{
  'use strict';
  function install(){
    const layout=document.getElementById('dvV16Layout'),overlay=document.getElementById('dvV16Overlay');
    if(!layout||!overlay||!window.DV_SCAN_V16)return false;
    function paint(){
      const mode=window.DV_SCAN_V16.mode;
      if(mode==='binder'){
        overlay.style.gridTemplateColumns='repeat(3,1fr)';
        overlay.style.gridTemplateRows='repeat(3,1fr)';
        overlay.innerHTML='<i></i>'.repeat(9);
        return;
      }
      if(mode!=='multi'){
        overlay.style.removeProperty('grid-template-columns');
        overlay.style.removeProperty('grid-template-rows');
        if(mode!=='binder')overlay.innerHTML='';
        return;
      }
      const m=String(layout.value||'2x2').match(/^(\d)x(\d)$/),cols=Number(m?.[1]||2),rows=Number(m?.[2]||2);
      overlay.style.gridTemplateColumns=`repeat(${cols},1fr)`;
      overlay.style.gridTemplateRows=`repeat(${rows},1fr)`;
      overlay.innerHTML='<i></i>'.repeat(cols*rows);
    }
    layout.addEventListener('change',paint);
    document.querySelectorAll('[data-v16-mode]').forEach(b=>b.addEventListener('click',()=>setTimeout(paint,0)));
    paint();
    window.DV_SCAN_V16_OVERLAY={version:'16.0.0-lab',paint};
    return true;
  }
  let tries=0;const timer=setInterval(()=>{tries++;if(install()||tries>180)clearInterval(timer)},100);
})();
