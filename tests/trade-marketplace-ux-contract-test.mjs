import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../trade.html',import.meta.url),'utf8');
const releaseGate=await readFile(new URL('../trade-release-gate.js',import.meta.url),'utf8');
const ux=await readFile(new URL('../trade-marketplace-ux.js',import.meta.url),'utf8');
const archive=await readFile(new URL('../trade-search-archive.js',import.meta.url),'utf8');
const css=await readFile(new URL('../trade-marketplace-ux.css',import.meta.url),'utf8');
const checkout=await readFile(new URL('../trade-checkout.js',import.meta.url),'utf8');
const shippingOptions=await readFile(new URL('../trade-shipping-options.js',import.meta.url),'utf8');
const listingRules=await readFile(new URL('../trade-listing-type-rules.js',import.meta.url),'utf8');
const tradeOnlySql=await readFile(new URL('../database/b07-trade-only-no-money-v1.sql',import.meta.url),'utf8');
const sealedSaleOnly=await readFile(new URL('../trade-sealed-sale-only.js',import.meta.url),'utf8');
const sealedSaleOnlySql=await readFile(new URL('../database/b07-sealed-sale-only-v1.sql',import.meta.url),'utf8');
const must=(source,text,message)=>assert.ok(source.includes(text),message);

must(html,'trade-marketplace-ux.css?v=1.1','Marketplace UX stylesheet is not loaded');
must(html,'trade-release-gate.js?v=1.0','TRADE release gate is not loaded');
must(releaseGate,'trade-marketplace-ux.js?v=1.1','Marketplace UX module is not routed through the release gate');
must(releaseGate,'trade-search-archive.js?v=1.1','Search/archive cache version is stale');
must(releaseGate,'trade-checkout.js?v=1.1','Checkout cache version is stale');
must(releaseGate,'trade-orders.js?v=1.5','Orders cache version is stale');
must(releaseGate,'trade-shipping-options.js?v=1.2','Shipping options cache version is stale');
must(releaseGate,'trade-sealed-sale-only.js?v=1.0','Sealed sale-only guard is not loaded');
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
must(ux,"version:'1.2'",'Marketplace UX module version mismatch');
assert.ok(!ux.includes('createClient('),'Marketplace UX must reuse the existing authenticated client');
assert.ok(!ux.includes('db.rpc('),'Navigation and copy simplification must not mutate Marketplace data');

must(archive,"search.placeholder = 'Karten, Graded, Sealed, Sets oder Nummern suchen'",'Prominent Marketplace product search is missing');
must(archive,"button.textContent = 'ARCHIV'",'Archive navigation is missing');
must(archive,"app.dataset.tradeView = 'archive'",'Archive view state is missing');
must(archive,"terminalListingStatus",'Terminal listing separation is missing');
must(archive,"terminalOrderStatus",'Terminal order separation is missing');
must(archive,"terminalSwapStatus",'Terminal swap separation is missing');
must(archive,'Abgeschlossene und beendete Vorgänge werden hier nur aus der aktiven Ansicht ausgeblendet.','Non-destructive archive explanation is missing');
must(archive,'Keine aktiven Vorgänge. Abgeschlossene Einträge findest du im Archiv.','Active/archive empty-state handoff is missing');
must(archive,"new MutationObserver(queueActiveFilter).observe(grid, {childList: true, subtree: true})",'Active archive filtering must refresh after real browser renders');
assert.ok(!archive.includes('.delete('),'Archive UI must not delete retained records');

must(listingRules,"type.value === 'trade'",'Trade-only mode is not detected');
must(listingRules,'stashAndClear(asking)','Single/graded trade-only price is not cleared');
must(listingRules,"pricing.value = 'negotiable'",'Trade-only pricing mode is not normalized');
must(listingRules,"['dvSTier1Qty','dvSTier1Price','dvSTier2Qty','dvSTier2Price']",'Sealed trade-only quantity prices are not cleared');
must(listingRules,'Nur Tausch: Es wird kein Geldbetrag vereinbart.','Trade-only no-money rule is not explained in the UI');
must(tradeOnlySql,'market_listings_trade_only_no_money_ck','Database invariant for trade-only listings is missing');
must(tradeOnlySql,"asking_price is null",'Database does not require NULL asking price for trade-only listings');
must(tradeOnlySql,"pricing_mode = 'negotiable'",'Database does not normalize trade-only pricing mode');
must(tradeOnlySql,"coalesce(quantity_pricing,'[]'::jsonb) = '[]'::jsonb",'Database does not block quantity prices on trade-only listings');
must(tradeOnlySql,'trade_only_listing_price_offer_forbidden','Money offers are not blocked server-side for trade-only listings');

must(sealedSaleOnly,"saleOption.value = 'sale'",'Sealed form still exposes trade listing types');
must(sealedSaleOnly,"select.value = 'sale'",'Sealed listing type is not normalized to sale');
must(sealedSaleOnly,'field.hidden = true','Sealed listing-type field is still visible');
must(sealedSaleOnlySql,'market_listings_sealed_sale_only_ck','Database invariant for sealed sale-only listings is missing');
must(sealedSaleOnlySql,"product_kind is distinct from 'sealed' or listing_type = 'sale'",'Database does not reject sealed trade listings');

must(checkout,'id="dvBuyMinus"','Mobile quantity decrement is missing');
must(checkout,'id="dvBuyPlus"','Mobile quantity increment is missing');
must(checkout,'Zahlungspflichtig bestellen','Legally explicit checkout action is missing');
must(checkout,'Keine integrierte Onlinezahlung oder Auszahlung.','Truthful beta payment wording is missing');
must(checkout,"db.rpc('review_market_checkout'",'Server-side seller and checkout review is missing');
must(checkout,"db.rpc('buy_market_listing_v3'",'Hash-bound immutable checkout entrypoint is missing');
must(checkout,"version:'1.2'",'Checkout module version mismatch');
must(shippingOptions,'Bitte Versandkosten ergänzen.','An empty shipping price must not appear as free shipping');
must(shippingOptions,"version:'1.2'",'Shipping options module version mismatch');
must(css,'.dvTradePrimary','Primary Marketplace navigation styles are missing');
must(css,'@media(max-width:760px)','Mobile Marketplace styles are missing');
must(css,'.dvQuantityPicker','Touch quantity control styles are missing');
must(css,'.dvSellAdvanced','Collapsed optional selling fields are not styled');
must(css,'.dvAdvancedGrid','Advanced selling grid is missing');
must(css,'.dvShippingReuse','Reused shipping feedback is missing');
must(css,'.wrap:not([data-trade-view="market"]) .daily','Daily Deal must only occupy the Marketplace view');
must(css,'#dvSwapEditor .dvSwapCandidates label{display:grid;grid-template-columns:20px minmax(0,1fr)','Swap candidate rows must keep checkbox and text inside the mobile dialog');
must(css,'overflow-wrap:anywhere','Swap candidate text must wrap instead of overflowing the dialog');

const orders=await readFile(new URL('../trade-orders.js',import.meta.url),'utf8');
must(orders,"version:'1.5'",'Orders module version mismatch');
must(orders,'DV_TRADE_MARKETPLACE_UX?.sync()','Direct order navigation must synchronize the simplified Marketplace UI');
must(orders,"db.rpc('get_my_market_order_contract_documents'",'Immutable order confirmation download is missing');

await import('./trade-release-gate-test.mjs');
console.log('PASS: simplified Marketplace navigation, search/archive separation, release gate, trade-only no-money invariant, sealed sale-only invariant, C2C integration, mobile swap layout, fast selling forms, offer wording and checkout controls');

assert.ok(!releaseGate.includes('trade-listing-type-rules.js'),'retired money rules must stay unloaded');
