import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sql=await readFile(new URL('../database/market-seller-compliance-v1.sql',import.meta.url),'utf8');
const js=await readFile(new URL('../trade-seller-compliance.js',import.meta.url),'utf8');
const must=(source,text,message)=>assert.ok(source.includes(text),message);

must(sql,'seller_onboarding_enforced boolean not null default false','seller rollout must default to disabled');
must(sql,'tax_identifier_required_for_activation boolean not null default true','tax identity must default to required');
must(sql,'create or replace function public.review_market_seller_onboarding','owner review RPC is missing');
must(sql,"raise exception 'owner_access_required'",'owner-only review guard is missing');
must(sql,"raise exception 'seller_tax_identifier_required'",'activation lacks tax-identifier gate');
must(sql,'create or replace function public.set_marketplace_seller_onboarding_enforcement','controlled enforcement RPC is missing');
must(sql,"set status='paused',updated_at=now()",'legacy or restricted listings are not paused');
must(sql,'pause_listings_after_seller_restriction_trigger','seller restriction does not automatically pause listings');
must(sql,"raise exception 'seller_onboarding_required'",'active-listing server guard is missing');
must(sql,"new.status := 'paused'",'internal listing restoration is not safely downgraded to paused');

must(js,"db.rpc('get_my_market_seller_onboarding'",'Marketplace does not load the current seller gate');
must(js,"event.target.closest('#sell')",'sell action is not intercepted for onboarding');
must(js,'!mySellerAccount?.onboarding_enforced','frontend gate does not follow the server rollout flag');
must(js,"mySellerAccount.onboarding_status === 'active'",'active sellers are not exempted from the UI gate');
must(js,'href="seller-onboarding.html"','seller gate does not route to onboarding');
must(js,"state==='suspended'",'suspended sellers are not handled separately');

console.log('PASS: owner-reviewed seller activation, tax gate, automatic listing pause and onboarding redirect');
