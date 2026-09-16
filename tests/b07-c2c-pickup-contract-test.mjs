import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sql=await readFile(new URL('../database/b07-l07-01-c2c-swap-v1-pickup.sql',import.meta.url),'utf8');
const must=(needle,label)=>assert.ok(sql.includes(needle),`${label}: ${needle}`);
const mustNot=(needle,label)=>assert.ok(!sql.includes(needle),`${label}: ${needle}`);

must("'fulfillment_mode',v_thread.fulfillment_mode",'fulfillment mode must be inside immutable revision content');
must("'schema_version','c2c-swap-revision-v2'",'pickup-aware revision schema version missing');
must('create_market_swap_proposal_v2','pickup-aware proposal RPC missing');
must('propose_market_swap_revision_v2','pickup-aware revision RPC missing');
must("v_thread.fulfillment_mode='shipping'",'shipping-only address and fulfillment branch missing');
must("v_thread.fulfillment_mode='pickup'",'pickup availability guard missing');
must("v_now+interval '2 hours'",'pickup handover code must expire after 2 hours');
must('h.attempt_count>=8','pickup brute-force limit missing');
must("raise exception 'swap_pickup_requires_other_party'",'pickup must require bilateral parties');
must("confirmation_mode','pickup_bilateral_handover'",'pickup bilateral completion evidence missing');
must('market_swap_pickup_handovers','private pickup evidence table missing');
must("'pickup',case when t.fulfillment_mode='pickup'",'participant read model must expose pickup status');
mustNot('platform_fee_collected','pickup must not introduce fees');
mustNot('record_market_tax_remuneration(','pickup must not book tax remuneration');

console.log('PASS: C2C pickup is revision-bound, bilateral, time-limited and fee/tax neutral');
