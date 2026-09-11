import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../trade.html',import.meta.url),'utf8');
const ux=await readFile(new URL('../trade-marketplace-ux.js',import.meta.url),'utf8');
const css=await readFile(new URL('../trade-marketplace-ux.css',import.meta.url),'utf8');
const checkout=await readFile(new URL('../trade-checkout.js',import.meta.url),'utf8');
const shippingOptions=await readFile(new URL('../trade-shipping-options.js',import.meta.url),'utf8');
const must=(source,text,message)=>assert.ok(source.includes(text),message);

must(html,'trade-marketplace-ux.css?v=1.1','Marketplace UX stylesheet is not loaded');
must(html,'trade-marketplace-ux.js?v=1.1','Marketplace UX module is not loaded');
must(html,'trade-checkout.js?v=1.1','Checkout cache version is stale');
must(html,'trade-orders.js?v=1.3','Orders cache version is stale');
must(html,'trade-shipping-options.js?v=1.2','Shipping options cache version is stale');
for(const label of ['MARKT','MEINE INSERATE','PREISANGEBOTE','BESTELLUNGEN','BEWERTUNGEN','VERSAND'])must(ux,`'${label}'`,'Missing simplified navigation label '+label);
for(const view of ['market','mine','offers','orders','deals','shipping_profiles'])must(ux,`${view}:`,'Missing contextual Marketplace view '+view);
must(ux,"app.dataset.tradeView = view",'Marketplace view state is not exposed to responsive CSS');
must(ux,"hero.after(tabs)",'Primary Marketplace navigation must precede secondary content');
must(ux,"tabs.after(automation)",'Required actions must stay directly below primary navigation');
must(ux,'Bei Annahme entsteht automatisch eine Bestellung.','Offer acceptance flow is not explained');
must(ux,"buildAdvanced(form,'dvSingleAdvanced',['listingType','dvShippingNote','note'])",'Single and graded optional fields are not grouped');
must(ux,"buildAdvanced(form,'dvSealedAdvanced',['dvSUnits','dvSContents','dvSWeight','dvSL','dvSListingType','dvSMinQty','dvSTier1Qty','dvSShippingNote','dvSNote'])",'Sealed optional fields are not grouped');
must(ux,'Name, Set, Nummer, Sprache, Zustand, Variante, Grading und Bild kommen aus deiner Collection.','Automatic Collection data reuse is not explained');
must(ux,"applyRecentShipping('single'",'Single shipping reuse is missing');
must(ux,"applyRecentShipping('sealed'",'Sealed shipping reuse is missing');
must(ux,"version:'1.1'",'Marketplace UX module version mismatch');
assert.ok(!ux.includes('createClient('),'Marketplace UX must reuse the existing authenticated client');
assert.ok(!ux.includes('db.rpc('),'Navigation and copy simplification must not mutate Marketplace data');

must(checkout,'id="dvBuyMinus"','Mobile quantity decrement is missing');
must(checkout,'id="dvBuyPlus"','Mobile quantity increment is missing');
must(checkout,'JETZT BESTELLEN','Simplified checkout action is missing');
must(checkout,'Noch keine Onlinezahlung.','Beta payment wording is missing');
must(checkout,"version:'1.1'",'Checkout module version mismatch');
must(shippingOptions,'Bitte Versandkosten ergänzen.','An empty shipping price must not appear as free shipping');
must(shippingOptions,"version:'1.2'",'Shipping options module version mismatch');
must(css,'.dvTradePrimary','Primary Marketplace navigation styles are missing');
must(css,'@media(max-width:760px)','Mobile Marketplace styles are missing');
must(css,'.dvQuantityPicker','Touch quantity control styles are missing');
must(css,'.dvSellAdvanced','Collapsed optional selling fields are not styled');
must(css,'.dvAdvancedGrid','Advanced selling grid is missing');
must(css,'.dvShippingReuse','Reused shipping feedback is missing');
must(css,'.wrap:not([data-trade-view="market"]) .daily','Daily Deal must only occupy the Marketplace view');

const orders=await readFile(new URL('../trade-orders.js',import.meta.url),'utf8');
must(orders,"version:'1.3'",'Orders module version mismatch');
must(orders,'DV_TRADE_MARKETPLACE_UX?.sync()','Direct order navigation must synchronize the simplified Marketplace UI');

console.log('PASS: simplified Marketplace navigation, fast selling forms, offer wording and checkout controls');
