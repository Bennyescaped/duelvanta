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
must(html,'duelvanta-beta.css?v=1','shared design system missing');
must(html,'beta-trade.css?v=1','Trade beta skin missing');
must(html,'beta-shell.css?v=1','shared beta app shell missing');
must(html,'beta-product-visuals.css?v=1','cinematic Trade visuals missing');
must(html,'beta-shell.js?v=1','mobile app dock runtime missing');
must(html,'TRADE. BUY. SELL.','Trade beta hero missing');
must(html,'trade-hero-cards','Trade cinematic card stack missing');
assert.ok(!html.includes('scanner-v16-'),'Trade visual refresh must stay isolated from Scanner V16 work');
assert.ok(!html.includes('service_role')&&!css.includes('service_role')&&!shell.includes('service_role')&&!visuals.includes('service_role'),'frontend must not contain service role');
assert.ok(!html.includes('<svg'),'Trade must use fixed logo asset rather than redraw it');
for(const component of ['.trade-beta .marketGrid','.trade-beta .listing','.trade-beta .toolbar','.trade-beta dialog','.trade-beta .dv-site-header'])must(css,component,'Trade skin component missing');
for(const component of ['.trade-beta .trade-hero-cards','.trade-beta .tabs'])must(visuals,component,'Trade cinematic component missing');
console.log('PASS: DUELVANTA cinematic Trade surface preserves DOM contracts and stable script chain');
