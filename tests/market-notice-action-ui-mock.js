(() => {
  const calls=[];let appealed=false;
  const db={rpc:async(name,args)=>{
    calls.push({name,args});
    if(name==='submit_marketplace_listing_notice')return {data:{case_reference:'DVN-UI-TEST',access_code:'A1B2C3D4E5F6',status:'submitted',received_at:new Date().toISOString()},error:null};
    if(name==='get_marketplace_notice_status')return {data:{case_reference:'DVN-UI-TEST',status:appealed?'appealed':'decided_removed',listing:{id:'30000000-0000-4000-8000-000000000001',title:'Lokale Testkarte'},decision:{action:'remove_listing',reason:'Die lokale Testentscheidung ist ausreichend konkret und nachvollziehbar begründet.',reference:'§ 14 MarkenG',automated_means_used:false,redress:'Interner Einspruch und weitere gesetzliche Rechtsbehelfe.'},appeals:appealed?[{status:'submitted'}]:[]},error:null};
    if(name==='submit_marketplace_notice_appeal'){appealed=true;return {data:{status:'submitted'},error:null}}
    return {data:null,error:{message:'unexpected_rpc'}};
  }};
  window.supabase={createClient:()=>db};window.NOTICE_UI_FIXTURE={calls,get appealed(){return appealed}};
})();
