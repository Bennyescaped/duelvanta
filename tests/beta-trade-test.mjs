import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const [html,css,shell,visuals]=await Promise.all([
  readFile(new URL('../trade.html',import.meta.url),'utf8'),
  readFile(new URL('../beta-trade.css',import.meta.url),'utf8'),
  readFile(new URL('../beta-shell.css',import.meta.url),'utf8'),
  readFile(new URL('../beta-product-visuals.css',import.meta.url),'utf8')
]);
const must=(s,n,m)=>assert.ok(s.includes(n),`${m}: ${n}`);
for(const id of ['id="app"','id="logout"','id="daily"','id="dailyContent"','id="sell"','id="search"','id="tcg"','id="sort"','id="grid"','id="pickDialog"','id="listDialog"','id="offerDialog"','id="finishDialog"','id="sellerDialog"'])must(html,id,'required Trade DOM id missing');
for(const script of ['trade.js','offers-fix.js','seller-trust.js','trade-v2.js','trade-payment-flow.js','trade-shipping-address.js','trade-shipping-options.js','trade-sealed.js','trade-orders.js','trade-offer-details.js','trade-checkout.js','trade-automation.js','trade-shipping-profiles.js','trade-order-resolution.js'])must(html,script,'stable Trade script chain missing');
for(const asset of ['duelvanta-beta.css?v=1','beta-trade.css?v=2','beta-shell.css?v=2','beta-product-visuals.css?v=2','beta-shell.js?v=2'])must(html,asset,'Trade beta asset missing');
must(html,'TRADE. BUY. SELL.','Trade beta hero missing');
must(html,'trade-hero-cards','Trade cinematic card stack missing');
for(const action of ['market','sell','offers','mine'])must(html,`data-beta-action="${action}"`,'Trade quick tile missing');
assert.ok(visuals.includes("url('v-logo.svg')"),'decorative Trade cards must use exact v-logo.svg');
assert.ok(!visuals.includes('content:"V"'),'letter V placeholder must not remain on decorative cards');
assert.ok(!html.includes('scanner-v16-'),'Trade visual refresh must stay isolated from Scanner V16 work');
assert.ok(!html.includes('service_role')&&!css.includes('service_role')&&!shell.includes('service_role')&&!visuals.includes('service_role'),'frontend must not contain service role');
assert.ok(!html.includes('<svg'),'Trade must use fixed logo asset rather than redraw it');
for(const component of ['.trade-beta .marketGrid','.trade-beta .listing','.trade-beta .toolbar','.trade-beta dialog','.trade-beta .dv-site-header'])must(css,component,'Trade skin component missing');
must(shell,'.beta-mystic-tiles','shared mystic tile system missing');
console.log('PASS: DUELVANTA mystic Trade surface preserves DOM contracts and stable script chain');
