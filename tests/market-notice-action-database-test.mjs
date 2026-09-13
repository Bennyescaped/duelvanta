import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const pgliteUrl=process.argv[2]?pathToFileURL(process.argv[2]).href:import.meta.resolve('@electric-sql/pglite');
const {PGlite}=await import(pgliteUrl);
const {pgcrypto}=await import(new URL('./contrib/pgcrypto.js',pgliteUrl).href);
const db=new PGlite({extensions:{pgcrypto}});
const SELLER='20000000-0000-4000-8000-000000000001';
const REPORTER='20000000-0000-4000-8000-000000000002';
const OWNER='20000000-0000-4000-8000-000000000003';
const OUTSIDER='20000000-0000-4000-8000-000000000004';
const LISTING='30000000-0000-4000-8000-000000000001';
const migration=await readFile(new URL('../database/market-notice-action-v1.sql',import.meta.url),'utf8');
const json=value=>typeof value==='string'?JSON.parse(value):value;
const claim=async(uid,role='authenticated')=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${uid||''}',false);set role ${role};`);

try{
  await db.exec(`
    create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
    create table public.profiles(id uuid primary key references auth.users(id),role text,account_status text);
    create table public.market_listings(id uuid primary key,seller_id uuid not null references auth.users(id),status text not null,card_name text,updated_at timestamptz not null default now());
    insert into auth.users(id) values('${SELLER}'),('${REPORTER}'),('${OWNER}'),('${OUTSIDER}');
    insert into public.profiles(id,role,account_status) values('${OWNER}','owner','active');
    insert into public.market_listings(id,seller_id,status,card_name) values('${LISTING}','${SELLER}','active','Testkarte');
  `);
  await db.exec(migration);

  await claim(null,'anon');
  const submitted=json((await db.query(`select public.submit_marketplace_listing_notice(
    '${LISTING}','counterfeit','Die abgebildete Karte weist konkrete Merkmale einer Fälschung auf.',
    'Markenrecht','Hinweis Person','notice@example.test','https://duelvanta.de/trade.html?listing=${LISTING}',true
  ) value`)).rows[0].value);
  assert.match(submitted.case_reference,/^DVN-/);assert.equal(submitted.status,'submitted');assert.ok(submitted.access_code.length>=18);
  await assert.rejects(()=>db.query(`select * from dv_market_private.listing_notices`),/permission denied/);
  await assert.rejects(()=>db.query(`select public.get_marketplace_notice_status('${submitted.case_reference}','WRONG')`),/notice_access_denied/);
  const status=json((await db.query(`select public.get_marketplace_notice_status('${submitted.case_reference}','${submitted.access_code}') value`)).rows[0].value);
  assert.equal(status.listing.title,'Testkarte');assert.equal(status.decision,null);

  await claim(OUTSIDER);
  await assert.rejects(()=>db.query(`select public.get_owner_marketplace_notices(null)`),/owner_access_required/);
  await assert.rejects(()=>db.query(`select public.decide_marketplace_listing_notice((select id from dv_market_private.listing_notices limit 1),'remove_listing','law','MarkenG','Ausführliche und konkrete Begründung der Maßnahme.')`),/permission denied|owner_access_required/);

  await claim(OWNER);
  const ownerRows=json((await db.query(`select public.get_owner_marketplace_notices(null) value`)).rows[0].value);
  assert.equal(ownerRows.length,1);assert.equal(ownerRows[0].reporter_email,'notice@example.test');
  const noticeId=ownerRows[0].id;
  await db.query(`select public.decide_marketplace_listing_notice('${noticeId}','remove_listing','law','§ 14 MarkenG','Die konkreten Abbildungen und Merkmale begründen den Fälschungsverdacht ausreichend.')`);
  await db.exec('reset role;');
  assert.equal((await db.query(`select status from public.market_listings where id='${LISTING}'`)).rows[0].status,'paused');
  assert.equal(Number((await db.query(`select count(*) count from dv_market_private.marketplace_message_outbox where notice_id='${noticeId}'`)).rows[0].count),3);

  await claim(null,'anon');
  const decided=json((await db.query(`select public.get_marketplace_notice_status('${submitted.case_reference}','${submitted.access_code}') value`)).rows[0].value);
  assert.equal(decided.decision.action,'remove_listing');assert.equal(decided.decision.automated_means_used,false);
  const appeal=json((await db.query(`select public.submit_marketplace_notice_appeal('${submitted.case_reference}','${submitted.access_code}','Die Entscheidung berücksichtigt die beigefügten Echtheitsmerkmale noch nicht vollständig.') value`)).rows[0].value);
  assert.equal(appeal.status,'submitted');

  await claim(OWNER);
  await db.query(`select public.review_marketplace_notice_appeal('${appeal.appeal_id}','reversed','Die erneute menschliche Prüfung entkräftet den ursprünglich angenommenen Rechtsverstoß.')`);
  await db.exec('reset role;');
  assert.equal((await db.query(`select status from public.market_listings where id='${LISTING}'`)).rows[0].status,'active');
  await assert.rejects(()=>db.query(`update dv_market_private.listing_notice_events set event_type='changed'`),/notice_audit_is_immutable/);

  await claim(REPORTER);
  const second=json((await db.query(`select public.submit_marketplace_listing_notice(
    '${LISTING}','consumer_deception','Das Angebot macht eine nachprüfbar falsche Angabe zum Zustand der Karte.',null,
    'Zweite Person','second@example.test','https://duelvanta.de/trade.html?listing=${LISTING}',true
  ) value`)).rows[0].value);
  await claim(OWNER);
  const secondNotice=json((await db.query(`select public.get_owner_marketplace_notices('submitted') value`)).rows[0].value)[0];
  await db.query(`select public.decide_marketplace_listing_notice('${secondNotice.id}','restrict_visibility','terms','Marketplace-Regel 4','Die konkrete Zustandsangabe ist nach der dokumentierten Prüfung objektiv irreführend.')`);
  await claim(SELLER);
  const sellerCases=json((await db.query(`select public.get_my_marketplace_moderation_cases() value`)).rows[0].value);
  assert.ok(sellerCases.some(item=>item.case_reference===second.case_reference));
  const sellerAppeal=json((await db.query(`select public.submit_my_marketplace_moderation_appeal('${secondNotice.id}','Die Zustandsbewertung soll anhand der Originalbilder erneut menschlich geprüft werden.') value`)).rows[0].value);
  await claim(OWNER);
  const upheld=json((await db.query(`select public.review_marketplace_notice_appeal('${sellerAppeal.appeal_id}','upheld','Die erneute menschliche Prüfung bestätigt die dokumentierte irreführende Zustandsangabe.') value`)).rows[0].value);
  assert.equal(upheld.outcome,'upheld');

  console.log('PASS: private notice intake, owner decision, seller statement, reporter/seller appeals and immutable audit');
}finally{await db.close()}
