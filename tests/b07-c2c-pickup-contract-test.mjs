import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sql=await readFile(new URL('../database/b07-l07-01-c2c-swap-v1-pickup.sql',import.meta.url),'utf8');
const swapUi=await readFile(new URL('../trade-c2c-swap.js',import.meta.url),'utf8');
const marketplaceUx=await readFile(new URL('../trade-marketplace-ux.js',import.meta.url),'utf8');
const tradeHtml=await readFile(new URL('../trade.html',import.meta.url),'utf8');
const must=(needle,label)=>assert.ok(sql.includes(needle),`${label}: ${needle}`);
const mustNot=(needle,label)=>assert.ok(!sql.includes(needle),`${label}: ${needle}`);
const mustUi=(needle,label)=>assert.ok(swapUi.includes(needle),`${label}: ${needle}`);
const mustMarket=(needle,label)=>assert.ok(marketplaceUx.includes(needle),`${label}: ${needle}`);

must("'fulfillment_mode',v_thread.fulfillment_mode",'fulfillment mode must be inside immutable revision content');
must("'schema_version','c2c-swap-revision-v2'",'pickup-aware revision schema version missing');
must('create_market_swap_proposal_v2','pickup-aware proposal RPC missing');
must('propose_market_swap_revision_v2','pickup-aware revision RPC missing');
must("v_thread.fulfillment_mode='shipping'",'shipping-only address and fulfillment branch missing');
must("v_thread.fulfillment_mode<>'pickup'",'pickup availability guard missing');
must("v_now+interval '2 hours'",'pickup handover code must expire after 2 hours');
must('h.attempt_count>=8','pickup brute-force limit missing');
must("raise exception 'swap_pickup_requires_other_party'",'pickup must require bilateral parties');
must("confirmation_mode','pickup_bilateral_handover'",'pickup bilateral completion evidence missing');
must('market_swap_pickup_handovers','private pickup evidence table missing');
must("'pickup',case when t.fulfillment_mode='pickup'",'participant read model must expose pickup status');
mustNot('platform_fee_collected','pickup must not introduce fees');
mustNot('record_market_tax_remuneration(','pickup must not book tax remuneration');

assert.ok(tradeHtml.includes('trade-c2c-swap.js?v=1.0'),'TRADE page must load established C2C asset path');
assert.ok(!tradeHtml.includes('trade-b07-c2c-ux-bridge.js'),'TRADE page must not load obsolete C2C UX bridge');
mustUi("swap.dataset.swapPropose=id",'C2C module must add swap action to trade-capable listings');
mustUi("if(l.listing_type==='trade')button.remove()",'trade-only listing must not retain price-offer action');
mustUi("window.DV_C2C_SWAP={version:'1.3'",'integrated C2C UI version marker missing');
mustUi('if(!await loadSwaps()){installed=true;return true}','missing RPC must fail closed without leaving partial C2C UI');
assert.ok(!swapUi.includes('MutationObserver'),'C2C module must remain free of recursive DOM observers');
mustMarket("swaps = document.getElementById('dvSwapsTab')",'Marketplace layout must capture the existing TAUSCH tab');
mustMarket('if (swaps) secondary.append(swaps)','Marketplace layout must preserve the TAUSCH tab');
mustMarket('window.DV_C2C_SWAP?.refresh?.(false)','Marketplace layout must explicitly refresh C2C actions after navigation rebuild');

console.log('PASS: C2C pickup is revision-bound and marketplace integration is deterministic without a bridge');
