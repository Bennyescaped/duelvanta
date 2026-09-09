// Browser-native integration assertions against local mocks only.
(async()=>{
  if(!new URLSearchParams(location.search).has('selftest'))return;
  const output=document.createElement('pre');output.id='uiTestResults';output.style='white-space:pre-wrap;color:#eee;background:#171b21;padding:16px;margin:16px;font:13px monospace';document.body.prepend(output);
  const wait=async(predicate)=>{for(let n=0;n<80;n++){if(predicate())return;await new Promise(r=>setTimeout(r,50))}throw Error('Timeout waiting for UI')};
  const assert=(test,message)=>{if(!test)throw Error(message);output.textContent+='PASS '+message+'\n'};
  const amountInput=value=>{const q=document.getElementById('dvBuyQty');q.value=value;q.dispatchEvent(new Event('input',{bubbles:true}))};
  try{
    await wait(()=>window.DV_TRADE_CHECKOUT&&document.querySelector('[data-offer="ui-fixed"]'));
    document.querySelector('[data-offer="ui-fixed"]').click();
    assert(document.getElementById('dvBuyDialog').open,'Festpreis öffnet eigenen Kaufdialog');
    amountInput('');assert(document.getElementById('dvBuyQty').value==='','Menge darf zum Bearbeiten leer sein');assert(document.getElementById('dvBuyNow').disabled,'Leere Menge kann nicht bestellt werden');
    amountInput('3');assert(document.getElementById('dvBuyTotals').textContent.includes('660,00'),'3 Stück verwenden Staffelpreis 220 €');
    amountInput('5');assert(document.getElementById('dvBuyTotals').textContent.includes('1.075,00'),'5 Stück verwenden Staffelpreis 215 €');
    amountInput('11');assert(document.getElementById('dvBuyNow').disabled,'Menge über Bestand gesperrt');
    amountInput('1.5');assert(document.getElementById('dvBuyNow').disabled,'Bruchmenge gesperrt');
    amountInput('3');document.getElementById('dvBuyNow').click();document.getElementById('dvBuyNow').click();
    await wait(()=>!document.getElementById('dvBuyNow').disabled);
    assert(TRADE_UI_FIXTURE.calls.filter(x=>x.name==='buy_market_listing_v2').length===1,'Doppelklick sendet nur eine Anfrage');
    assert(document.getElementById('dvBuyMsg').textContent.includes('Verbindungsabbruch'),'Netzwerkfehler sichtbar und erneut versuchbar');
    document.getElementById('dvBuyNow').click();await wait(()=>document.getElementById('dvBuyGoOrder'));
    const attempts=TRADE_UI_FIXTURE.calls.filter(x=>x.name==='buy_market_listing_v2');
    assert(attempts[0].args.p_request_id===attempts[1].args.p_request_id,'Wiederholung verwendet identische Request-ID');
    assert(attempts[1].args.p_quantity===3&&attempts[1].args.p_expected_updated_at,'Menge und Angebotsversion werden gesendet');
    assert(TRADE_UI_FIXTURE.purchases===1,'Nur ein erfolgreicher lokaler Kauf');
    document.getElementById('dvBuyGoOrder').click();await wait(()=>document.querySelector('.dvOrderItemTitle'));
    assert(document.querySelector('.dvOrderItemTitle').textContent.includes('3 ×'),'Order zeigt Stückzahl');
    assert(document.querySelector('.dvOrderItemMeta').textContent.includes('220,00'),'Order zeigt Stückpreis');
    assert(document.querySelector('.dvOrderSummary').textContent.includes('VORLÄUFIGE SUMME'),'Ungeprüfter Versand als vorläufig gekennzeichnet');
    TRADE_UI_FIXTURE.order.status='shipped';TRADE_UI_FIXTURE.order.shipped_at='2026-09-09T10:00:00Z';
    await DV_TRADE_ORDERS.render();
    assert(!!document.querySelector('[data-o-received]')&&!document.querySelector('[data-o-complete]'),'Ein Erhalts-/Abschlussbutton statt doppelter Bestätigung');
    document.querySelector('[data-tab="offers"]').click();await wait(()=>document.querySelector('.dvOfferDetail'));
    assert(document.querySelector('.dvOfferQuantity').textContent.includes('3 × Display'),'Angebot zeigt gewünschte Menge und Produktart');
    assert(document.querySelector('.dvOfferDifference').textContent.includes('60,00')&&document.querySelector('.dvOfferDifference').textContent.includes('9,1'),'60 € / 9,1 % Nachlass gegenüber Mengenpreis');
    assert(!document.querySelector('.dvOfferMessage img'),'Angebotsnachricht wird als Text escaped');
    assert(document.querySelectorAll('.dvOfferDetail')[1].textContent.includes('kein damaliger Inseratspreis'),'Alte Angebote erhalten keinen erfundenen Vergleichspreis');
    assert(!document.querySelector('.dvOfferDetail [data-complete]'),'Kein alter direkter Deal-Abschluss in Angeboten');
    document.querySelector('[data-tab="market"]').click();await wait(()=>document.querySelector('[data-offer="ui-vb"]'));
    document.querySelector('[data-offer="ui-vb"]').click();await wait(()=>document.getElementById('offerDialog').open);
    assert(!document.getElementById('dvBuyDialog').open,'Verhandlungsbasis verwendet weiterhin Angebotsdialog');
    document.getElementById('offerDialog').close();
    output.textContent+='\nALL UI TESTS PASSED — mocks only, no live transaction.\n';
  }catch(error){output.textContent+='\nFAIL '+error.message;console.error(error)}
})();
