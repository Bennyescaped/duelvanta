/* COLLECT display-only helpers. Never normalize or write stored prices. */
(function(root){
  'use strict';
  const money=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'});
  function known(value){return value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))}
  function prices(rows,key){
    const valued=rows.filter(row=>known(row[key]));
    const total=valued.reduce((sum,row)=>sum+Number(row[key])*Number(row.quantity||0),0);
    const missing=rows.length-valued.length;
    return {total,missing,text:!rows.length?'—':!valued.length?(key==='market_price'?'Nicht bewertet':'Keine Preisangaben'):money.format(total),note:!rows.length?'Keine Karten':missing?(valued.length?'Teilsumme · unvollständig':key==='market_price'?'Referenzwerte fehlen':'Kaufpreise fehlen'):''};
  }
  function summary(rows){
    const purchase=prices(rows,'purchase_price'),market=prices(rows,'market_price');
    const complete=rows.length>0&&!purchase.missing&&!market.missing;
    const profit=complete?market.total-purchase.total:null;
    return {purchase,market,profit,text:complete?money.format(profit):'—',note:!rows.length?'Keine Karten':!complete?'Kauf- oder Referenzwerte fehlen':'',tone:complete?(profit>0?'positive':profit<0?'negative':''):''};
  }
  function emptyMessage(state,scope,total,matches){
    if(state==='loading')return 'Collection wird geladen …';
    if(state==='error')return 'Collection konnte nicht vollständig geladen werden. Bitte neu laden.';
    if(matches)return '';
    if(total)return 'Keine Karten für diese Suche oder Filter gefunden. Suche und Filter zurücksetzen.';
    return scope==='__graded__'?'Noch keine gegradeten Karten in der Graded Collection.':scope?'Noch keine Karten in diesem Binder.':'Noch keine Karten in deiner Collection.';
  }
  const api={known,prices,summary,emptyMessage};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DV_COLLECT_UX=Object.freeze(api);
})(typeof window==='undefined'?globalThis:window);
