// Browser-native integration assertions against local mocks only.
(async()=>{
  if(!new URLSearchParams(location.search).has('selftest'))return;
  const output=document.createElement('pre');output.id='uiTestResults';output.style='white-space:pre-wrap;color:#eee;background:#171b21;padding:16px;margin:16px;font:13px monospace';document.body.prepend(output);
  const wait=async(predicate)=>{for(let n=0;n<80;n++){if(predicate())return;await new Promise(r=>setTimeout(r,50))}throw Error('Timeout waiting for UI')};
  const assert=(test,message)=>{if(!test)throw Error(message);output.textContent+='PASS '+message+'\n'};
  const amountInput=value=>{const q=document.getElementById('dvBuyQty');q.value=value;q.dispatchEvent(new Event('input',{bubbles:true}))};
  try{
    await wait(()=>window.DV_TRADE_CHECKOUT&&window.DV_TRADE_AUTOMATION&&document.querySelector('[data-offer="ui-fixed"]'));
    await wait(()=>document.getElementById('dvActionCount')?.textContent==='1');
    assert(document.getElementById('dvActionList').textContent.includes('LIEFERADRESSE HINTERLEGEN'),'AKTION ERFORDERLICH zeigt offene Lieferadresse');
    assert(!document.getElementById('dvNotifyBadge').hidden&&document.getElementById('dvNotifyBadge').textContent==='1','Ungelesene Benachrichtigung erscheint als Badge');
    document.getElementById('dvNotifyBtn').click();await wait(()=>document.getElementById('dvNotifyDialog').open);
    assert(document.getElementById('dvNotifyList').textContent.includes('ANGEBOT ANGENOMMEN'),'Benachrichtigungsdialog zeigt Angebotsannahme');
    document.getElementById('dvNotifyReadAll').click();await wait(()=>document.getElementById('dvNotifyBadge').hidden);
    assert(TRADE_UI_FIXTURE.calls.some(x=>x.name==='mark_all_market_notifications_read'),'Alle-gelesen Aktion nutzt Notification-RPC');
    document.getElementById('dvNotifyDialog').close();

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
    TRADE_UI_FIXTURE.addNotification({notification_id:'ui-note-shipped',kind:'order_shipped',title:'ORDER VERSENDET',body:'UI-LOCAL-ONLY · Tracking hinterlegt',order_id:'ui-order',offer_id:null,listing_id:null,is_unread:true,read_at:null,created_at:'2026-09-09T10:05:00Z'});
    await DV_TRADE_ORDERS.render();await DV_TRADE_AUTOMATION.refresh();
    assert(!!document.querySelector('[data-o-received]')&&!document.querySelector('[data-o-complete]'),'Ein Erhalts-/Abschlussbutton statt doppelter Bestätigung');
    assert(document.getElementById('dvActionList').textContent.includes('ERHALT BESTÄTIGEN'),'AKTION ERFORDERLICH wechselt nach Versand auf Erhalt');
    assert(document.getElementById('dvNotifyBadge').textContent==='1','Neue Versandbenachrichtigung wird ungelesen gezählt');
    document.getElementById('dvNotifyBtn').click();await wait(()=>document.getElementById('dvNotifyDialog').open);
    const shipped=[...document.querySelectorAll('[data-dv-note]')].find(x=>x.textContent.includes('ORDER VERSENDET'));
    assert(!!shipped,'Versandbenachrichtigung ist sichtbar');
    shipped.click();await wait(()=>!document.getElementById('dvNotifyDialog').open);
    assert(TRADE_UI_FIXTURE.calls.some(x=>x.name==='mark_market_notification_read'&&x.args.p_notification_id==='ui-note-shipped'),'Einzelne Benachrichtigung wird serverseitig als gelesen markiert');
    assert(!!document.getElementById('order-ui-order'),'Benachrichtigung führt zur passenden Order');

    document.querySelector('[data-o-received]').click();await wait(()=>TRADE_UI_FIXTURE.order.status==='completed');await DV_TRADE_AUTOMATION.refresh();
    assert(document.getElementById('dvActionCount').textContent==='0','Nach Erhaltsbestätigung bleibt keine erledigte Aktion offen');
    assert(TRADE_UI_FIXTURE.calls.filter(x=>x.name==='confirm_market_order_received').length===1,'Erhaltsbestätigung wird genau einmal ausgelöst');

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
