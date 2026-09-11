(()=>{
  'use strict';
  const root=globalThis;
  root.DV_SCAN_V16_STANDALONE=true;
  root.DV_V16_E2E=new URLSearchParams(location.search).get('e2e')==='1';
  root.selectedScanTcg=localStorage.getItem('duelvanta_scan_tcg')||'pokemon';
  root.currentUser=null;root.folders=[];root.items=[];root.activeFolder='';
  const status=message=>{const el=document.getElementById('routeStatus');if(el)el.textContent=message};
  const loadScript=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error(`Abhängigkeit konnte nicht geladen werden: ${src}`));document.head.appendChild(script)});
  root.catalogLookup=(id,context={})=>root.DV_SCAN_V16_CATALOG.lookup(id,{tcg:context.tcg||root.selectedScanTcg});
  root.loadItems=async()=>{if(!root.db||!root.currentUser)return[];const {data,error}=await root.db.from('collection_items').select('*').eq('user_id',root.currentUser.id).order('created_at',{ascending:false});if(error)throw error;root.items=data||[];return root.items};
  async function loadFolders(){if(!root.db||!root.currentUser)return[];const {data,error}=await root.db.from('collection_folders').select('*').eq('user_id',root.currentUser.id).order('sort_order').order('created_at');if(error)throw error;root.folders=data||[];const requested=new URLSearchParams(location.search).get('folder');root.activeFolder=root.folders.some(f=>f.id===requested)?requested:'';return root.folders}
  async function boot(){
    if(root.DV_V16_E2E){status('E2E · echte lokale OCR · Katalogantworten durch Testserver isoliert');return}
    if(!root.supabase){status('Scanner lokal bereit · Anmeldung/Import derzeit nicht verfügbar');return}
    if(!root.db)root.db=root.supabase.createClient('https://enifiaqsnqtbzylnfrpi.supabase.co','sb_publishable_pk2szDe_g7fJLUdAMEUevw_odrDmnuM',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    try{const {data:{session}}=await root.db.auth.getSession();if(!session){status('Scanner bereit · für Collection-Import anmelden');document.getElementById('routeLogin')?.classList.remove('hidden');return}root.currentUser=session.user;await Promise.all([loadFolders(),root.loadItems()]);status('Scanner bereit · Collection verbunden')}catch(error){console.warn('V16 host boot',error);status('Scanner bereit · Collection konnte nicht verbunden werden')}
  }
  root.DV_V16_DEPS_READY=Promise.all([
    root.DV_V16_E2E||root.supabase?Promise.resolve():loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'),
    root.Tesseract?Promise.resolve():loadScript(root.DV_V16_E2E?'node_modules/tesseract.js/dist/tesseract.min.js':'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js')
  ]).then(boot).catch(error=>{console.warn('V16 dependencies',error);status('Scanner bereit · OCR/Collection-Abhängigkeit konnte nicht geladen werden');throw error});
})();
