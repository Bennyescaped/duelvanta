import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../seller-onboarding.html',import.meta.url),'utf8');
const js=await readFile(new URL('../seller-onboarding.js',import.meta.url),'utf8');
const css=await readFile(new URL('../seller-onboarding.css',import.meta.url),'utf8');
const admin=await readFile(new URL('../admin.html',import.meta.url),'utf8');
const adminReview=await readFile(new URL('../admin-seller-review.js',import.meta.url),'utf8');
const sql=await readFile(new URL('../database/market-seller-compliance-v1.sql',import.meta.url),'utf8');
const must=(source,text,message)=>assert.ok(source.includes(text),message);

// Exercise the actual visibility function: both approved seller types qualify,
// while non-staging previews and unapproved accounts stay hidden.
const paintSource=js.split('\n').find(line=>line.startsWith('function paint()'));
for(const preview of [true,false])for(const seller_type of ['private','trader','unclassified'])for(const onboarding_status of ['active','draft','pending_review','rejected','suspended']){
  let hidden;
  const context={stripeSandboxPreview:preview,account:{onboarding_status},sellerType:()=>seller_type,status:()=>{},document:{querySelectorAll:()=>[]},$:id=>({classList:{toggle:(name,value)=>{if(id==='stripeSandboxPanel')hidden=value}},querySelectorAll:()=>[]})};
  vm.runInNewContext(paintSource+';paint();',context);
  assert.equal(hidden,!(preview&&['private','trader'].includes(seller_type)&&onboarding_status==='active'),`sandbox visibility: ${preview}/${seller_type}/${onboarding_status}`);
}

must(html,'data-seller-type="private"','private seller choice is missing');
must(html,'data-seller-type="trader"','trader seller choice is missing');
for(const id of ['legalFirstName','legalLastName','dateOfBirth','street1','postalCode','city','countryCode','taxCountry'])must(html,`id="${id}"`,'missing core onboarding field '+id);
for(const id of ['businessName','legalForm','publicEmail','publicPhone','registerName','registerNumber','registerCourt'])must(html,`id="${id}"`,'missing trader onboarding field '+id);
for(const id of ['acceptTerms','confirmAccuracy','confirmGoods'])must(html,`id="${id}" type="checkbox"`,'missing explicit declaration '+id);
assert.ok(!/<input[^>]+(?:checked|value=["'][^"']*(?:TIN|Steuer-ID|IBAN))/i.test(html),'consent must not be preselected and tax/bank secrets must not be ordinary form values');
must(html,'Steueridentifikatoren werden vor der endgültigen Verkaufsfreigabe in einem getrennten, verschlüsselten Schritt erfasst','secure tax step is not explained');
must(html,'src="v-logo.svg"','original DUELVANTA logo is not reused');
must(html,'id="stripeSandboxPanel"','Stripe sandbox panel is missing');
must(html,'id="startStripeSandbox"','Stripe sandbox onboarding action is missing');

for(const rpc of ['get_my_market_seller_onboarding','set_my_market_seller_type','save_my_market_seller_legal_profile','submit_my_market_seller_onboarding'])must(js,`db.rpc('${rpc}'`,'missing RPC wiring '+rpc);
assert.ok(!js.includes("db.from('profiles')"),'seller compliance must not be stored in public profiles');
assert.ok(!js.includes('user_metadata'),'authorization must not depend on editable user metadata');
must(js,"location.replace('login.html?next=seller-onboarding.html')",'login return route is missing');
must(js,"account.onboarding_status==='suspended'",'suspended seller UI guard is missing');
must(js,"db.rpc('get_my_market_seller_onboarding')",'seller data must be refreshed after a type change');
must(js,"$('dateOfBirth').max=adultDate.toISOString().slice(0,10)",'adult date limit is missing from the form');
must(js,"location.hostname.endsWith('.vercel.app')&&SB_URL.includes('xhmjxrcskfhbovhitdej')",'Stripe sandbox control must be restricted to the staging preview');
must(js,"fetch('/api/market-stripe-onboarding'",'Stripe sandbox onboarding API is not wired');
must(js,"authorization:`Bearer ${session.access_token}`",'Stripe sandbox onboarding must use the authenticated seller session');
must(js,"result.live_mode!==false",'Stripe sandbox onboarding must reject a live-mode response');
must(js,"/^https:\\/\\/connect\\.stripe\\.com\\//",'Stripe onboarding redirect must be restricted to Stripe HTTPS');

must(sql,"create schema if not exists dv_market_private",'private compliance schema is missing');
must(sql,"identifier_ciphertext bytea not null",'tax identifier ciphertext boundary is missing');
must(sql,"seller_onboarding_enforced boolean not null default false",'safe rollout flag is missing');
must(sql,"raise exception 'seller_onboarding_required'",'server-side listing guard is missing');
for(const table of ['seller_legal_profiles','seller_tax_identifiers','seller_declarations','seller_account_audit','marketplace_compliance_policy','seller_review_actions'])
  must(sql,`alter table dv_market_private.${table} enable row level security`,'private seller table lacks RLS defense in depth: '+table);
must(css,'@media(max-width:700px)','mobile onboarding layout is missing');

must(admin,"db.rpc('get_my_market_owner_access')",'admin UI must authorize through the protected owner-access RPC');
assert.ok(!admin.includes("user?.email?.toLowerCase()===OWNER_EMAIL"),'admin authorization must not be hardcoded to one email address');
must(admin,"location.hostname.endsWith('.vercel.app')&&SB_URL.includes('xhmjxrcskfhbovhitdej')",'synthetic owner fallback must be restricted to the staging preview');
must(admin,"user?.email?.toLowerCase()===PREVIEW_OWNER_EMAIL",'staging fallback must match only the synthetic owner account');
must(admin,'id="previewLoginLink"','preview admin screen must provide a path back to normal password login');
must(admin,'admin-seller-review.js?v=1.0','owner seller review module is missing');
must(adminReview,"db.rpc('get_owner_market_seller_reviews'",'owner seller review queue is not loaded through its protected RPC');
must(adminReview,"db.rpc('review_market_seller_onboarding'",'owner seller decisions are not wired');
must(sql,'create or replace function public.get_owner_market_seller_reviews','owner seller review queue RPC is missing');
must(sql,'create or replace function public.get_my_market_owner_access','protected owner-access RPC is missing');

console.log('PASS: private/trader onboarding fields, explicit declarations, secure RPC boundary and mobile layout contract');
