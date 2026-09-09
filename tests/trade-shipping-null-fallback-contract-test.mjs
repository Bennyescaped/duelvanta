// Regression for the Combined Shipping NULL fallback bug.
// No network or production data.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const fix=await readFile(new URL('../database/trade-shipping-profiles-v1-null-fallback-fix.sql',import.meta.url),'utf8');
const must=(needle,label)=>assert.ok(fix.includes(needle),label+': '+needle);

must('v_fallback_cost:=coalesce(v_auto_cost,0)','preliminary shipping cost must be preserved');
must('v_candidate_method','profile candidate must not overwrite fallback method on no row');
must('v_candidate_cost','profile candidate must not overwrite fallback cost on no row');
must('v_method:=v_fallback_method','missing profile must restore fallback method');
must('v_auto_cost:=v_fallback_cost','missing profile must restore fallback cost');
must("v_method:=coalesce(v_method,'custom')",'shipping method must never remain NULL');
must('v_auto_cost:=coalesce(v_auto_cost,0)','shipping cost must never remain NULL');
must("revoke all on function public.recalculate_market_order(uuid) from public, anon, authenticated",'recalculate helper must remain internal');

console.log('PASS: Combined Shipping missing-profile fallback cannot write NULL shipping values');
