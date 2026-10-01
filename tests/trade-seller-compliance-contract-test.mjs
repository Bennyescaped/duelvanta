import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const js=await readFile(new URL('../trade-seller-compliance.js',import.meta.url),'utf8');
const ux=await readFile(new URL('../trade-marketplace-ux.js',import.meta.url),'utf8');
const sql=await readFile(new URL('../database/market-seller-compliance-v1.sql',import.meta.url),'utf8');
const must=(source,text,message)=>assert.ok(source.includes(text),message);

must(ux,"compliance.src = 'trade-seller-compliance.js?v=1.0'",'seller classification module is not loaded by TRADE');
must(js,'PRIVATER VERKÄUFER','private seller label is missing');
must(js,'GEWERBLICHER VERKÄUFER · ANGABEN','trader seller label is missing');
must(js,'EINSTUFUNG AUSSTEHEND','legacy seller state is missing');
must(js,"db.rpc('get_market_seller_disclosures'",'batched seller disclosure RPC is not used');
must(js,"item.seller_type !== 'trader' || item.onboarding_status !== 'active'",'trader details are not status guarded');
must(js,'Private Geburts-, Steuer- und Zahlungsdaten werden nicht veröffentlicht.','private-data boundary is not explained');
for(const forbidden of ['date_of_birth','tax_residence_country_code','identifier_ciphertext','IBAN'])assert.ok(!js.includes(forbidden),'public module references private field '+forbidden);

must(sql,'create or replace function public.get_market_seller_disclosures(p_seller_ids uuid[])','batch disclosure RPC is missing');
must(sql,"raise exception 'too_many_sellers'",'batch disclosure input is not bounded');
const disclosureSql=sql.slice(sql.indexOf('create or replace function public.get_market_seller_disclosure'),sql.indexOf('create or replace function public.get_market_seller_disclosures'));
assert.ok(!disclosureSql.includes('date_of_birth'),'public trader disclosure exposes birth data');
assert.ok(!disclosureSql.includes('tax_residence_country_code'),'public trader disclosure exposes tax residence');

console.log('PASS: private/trader listing labels, restricted trader details and bounded public disclosure batch');
