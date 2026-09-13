import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../seller-onboarding.html',import.meta.url),'utf8');
const js=await readFile(new URL('../seller-onboarding.js',import.meta.url),'utf8');
const css=await readFile(new URL('../seller-onboarding.css',import.meta.url),'utf8');
const sql=await readFile(new URL('../database/market-seller-compliance-v1.sql',import.meta.url),'utf8');
const must=(source,text,message)=>assert.ok(source.includes(text),message);

must(html,'data-seller-type="private"','private seller choice is missing');
must(html,'data-seller-type="trader"','trader seller choice is missing');
for(const id of ['legalFirstName','legalLastName','dateOfBirth','street1','postalCode','city','countryCode','taxCountry'])must(html,`id="${id}"`,'missing core onboarding field '+id);
for(const id of ['businessName','legalForm','publicEmail','publicPhone','registerName','registerNumber','registerCourt'])must(html,`id="${id}"`,'missing trader onboarding field '+id);
for(const id of ['acceptTerms','confirmAccuracy','confirmGoods'])must(html,`id="${id}" type="checkbox"`,'missing explicit declaration '+id);
assert.ok(!/<input[^>]+(?:checked|value=["'][^"']*(?:TIN|Steuer-ID|IBAN))/i.test(html),'consent must not be preselected and tax/bank secrets must not be ordinary form values');
must(html,'Steueridentifikatoren werden vor der endgültigen Verkaufsfreigabe in einem getrennten, verschlüsselten Schritt erfasst','secure tax step is not explained');
must(html,'src="v-logo.svg"','original DUELVANTA logo is not reused');

for(const rpc of ['get_my_market_seller_onboarding','set_my_market_seller_type','save_my_market_seller_legal_profile','submit_my_market_seller_onboarding'])must(js,`db.rpc('${rpc}'`,'missing RPC wiring '+rpc);
assert.ok(!js.includes("db.from('profiles')"),'seller compliance must not be stored in public profiles');
assert.ok(!js.includes('user_metadata'),'authorization must not depend on editable user metadata');
must(js,"location.replace('login.html?next=seller-onboarding.html')",'login return route is missing');
must(js,"account.onboarding_status==='suspended'",'suspended seller UI guard is missing');
must(js,"db.rpc('get_my_market_seller_onboarding')",'seller data must be refreshed after a type change');
must(js,"$('dateOfBirth').max=adultDate.toISOString().slice(0,10)",'adult date limit is missing from the form');

must(sql,"create schema if not exists dv_market_private",'private compliance schema is missing');
must(sql,"identifier_ciphertext bytea not null",'tax identifier ciphertext boundary is missing');
must(sql,"seller_onboarding_enforced boolean not null default false",'safe rollout flag is missing');
must(sql,"raise exception 'seller_onboarding_required'",'server-side listing guard is missing');
for(const table of ['seller_legal_profiles','seller_tax_identifiers','seller_declarations','seller_account_audit','marketplace_compliance_policy','seller_review_actions'])
  must(sql,`alter table dv_market_private.${table} enable row level security`,'private seller table lacks RLS defense in depth: '+table);
must(css,'@media(max-width:700px)','mobile onboarding layout is missing');

console.log('PASS: private/trader onboarding fields, explicit declarations, secure RPC boundary and mobile layout contract');
