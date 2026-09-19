import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const pgliteUrl=process.argv[2]?pathToFileURL(process.argv[2]).href:import.meta.resolve('@electric-sql/pglite');
const {PGlite}=await import(pgliteUrl);
const {pgcrypto}=await import(new URL('./contrib/pgcrypto.js',pgliteUrl).href);
const migration=await readFile(new URL('../database/account-data-rights-pickup-messages-hardening-v1.sql',import.meta.url),'utf8');

const USER='94000000-0000-4000-8000-000000000001';
const OTHER='94000000-0000-4000-8000-000000000002';
const DELETE_USER='94000000-0000-4000-8000-000000000003';
const EXPORT_ORDER='94100000-0000-4000-8000-000000000001';
const DELETE_ORDER='94100000-0000-4000-8000-000000000002';
const DELETE_REQUEST='94200000-0000-4000-8000-000000000001';
const LOCK_TOKEN='94300000-0000-4000-8000-000000000001';

const db=new PGlite({extensions:{pgcrypto}});
const value=async sql=>{
  const result=(await db.query(sql)).rows[0].value;
  return typeof result==='string'?JSON.parse(result):result;
};

try{
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create schema dv_market_private;
    create schema extensions;
    create extension if not exists pgcrypto with schema extensions;

    create function auth.uid() returns uuid language sql stable
    as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;

    create table public.profiles(
      id uuid primary key,
      email text,
      display_name text,
      username text,
      avatar_path text,
      collection_visibility text default 'private',
      updated_at timestamptz default now()
    );
    create table public.market_seller_accounts(
      seller_id uuid primary key,
      onboarding_status text,
      suspended_at timestamptz,
      trader_display_name text,
      updated_at timestamptz default now()
    );
    create table public.market_orders(
      id uuid primary key,
      seller_id uuid not null,
      buyer_id uuid not null,
      fulfillment_group text not null
    );
    create table public.market_notifications(recipient_id uuid);
    create table public.market_default_shipping_addresses(user_id uuid);
    create table public.market_listing_images(seller_id uuid);
    create table public.market_listings(
      seller_id uuid,
      collection_item_id uuid,
      image_path text,
      seller_note text,
      seller_display_name text,
      status text,
      updated_at timestamptz default now()
    );
    create table public.collection_items(user_id uuid);
    create table public.collection_folders(user_id uuid);

    create table dv_market_private.seller_legal_profiles(seller_id uuid primary key,legal_first_name text);
    create table dv_market_private.seller_tax_identifiers(
      seller_id uuid,
      identifier_kind text,
      issuing_country_code text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );
    create table dv_market_private.market_swap_threads(
      id uuid primary key,
      party_a_id uuid not null,
      party_b_id uuid not null,
      fulfillment_mode text not null
    );
    create table dv_market_private.market_pickup_messages(
      id uuid primary key default gen_random_uuid(),
      context_type text not null,
      context_id uuid not null,
      sender_id uuid not null,
      body text not null,
      created_at timestamptz not null default now()
    );
    create table dv_market_private.data_retention_rules(
      category text primary key,
      purpose text,
      legal_basis text,
      retention_rule text,
      automatic_until_supported boolean,
      policy_version text,
      updated_at timestamptz default now()
    );
    create table dv_market_private.account_deletion_requests(
      id uuid primary key,
      user_id uuid not null,
      status text not null,
      lock_token uuid,
      auth_action text
    );
    create table dv_market_private.account_deletion_holds(
      request_id uuid not null,
      user_id uuid not null,
      category text not null,
      reason text,
      manual_review_required boolean default false,
      retain_until timestamptz,
      released_at timestamptz,
      unique(request_id,category)
    );
    create table dv_market_private.market_contract_snapshots(seller_id uuid,buyer_id uuid);
    create table dv_market_private.market_tax_events(seller_id uuid,reporting_year int);
    create table dv_market_private.listing_notices(reporter_user_id uuid);
    create table dv_market_private.listing_notice_appeals(appellant_user_id uuid);
    create table dv_market_private.account_data_rights_audit(
      user_id uuid,
      request_id uuid,
      event_type text,
      event_data jsonb
    );
    create table dv_market_private.user_data_export_events(
      user_id_hash bytea,
      export_format text,
      export_version text,
      content_sha256 bytea
    );

    create function dv_market_private.json_rows(p_sql text)
    returns jsonb language sql stable as $$select '[]'::jsonb$$;
    create function dv_market_private.account_deletion_blockers(p_uid uuid)
    returns jsonb language sql stable as $$select '[]'::jsonb$$;
    create function dv_market_private.block_restricted_account_mutation()
    returns trigger language plpgsql as $$begin
      if tg_op='DELETE' then return old;end if;
      return new;
    end$$;

    insert into public.profiles(id,email,display_name,username) values
      ('${USER}','export@example.test','Export User','export-user'),
      ('${OTHER}','other@example.test','Other User','other-user'),
      ('${DELETE_USER}','delete@example.test','Delete User','delete-user');
  `);

  await db.exec(migration);

  await db.exec(`
    insert into public.market_orders(id,seller_id,buyer_id,fulfillment_group)
    values('${EXPORT_ORDER}','${USER}','${OTHER}','pickup');
    insert into dv_market_private.market_pickup_messages(context_type,context_id,sender_id,body) values
      ('order','${EXPORT_ORDER}','${USER}','Eigene Exportnachricht'),
      ('order','${EXPORT_ORDER}','${OTHER}','Antwort der Gegenpartei');
    select set_config('request.jwt.claim.sub','${USER}',false);
  `);

  const exported=await value(`select public.export_my_duelvanta_data() value`);
  assert.equal(exported.export_version,'duelvanta-data-export-v2');
  assert.equal(exported.marketplace.pickup_messages.length,2);
  assert.deepEqual(exported.marketplace.pickup_messages.map(message=>message.sender_role).sort(),['other','self']);
  assert.deepEqual(exported.marketplace.pickup_messages.map(message=>message.body).sort(),['Antwort der Gegenpartei','Eigene Exportnachricht']);
  assert.ok(!JSON.stringify(exported.marketplace.pickup_messages).includes(OTHER));

  const rule=(await db.query(`select legal_basis,automatic_until_supported,policy_version from dv_market_private.data_retention_rules where category='pickup_messages'`)).rows[0];
  assert.equal(rule.legal_basis,'external_review_required');
  assert.equal(rule.automatic_until_supported,false);
  assert.equal(rule.policy_version,'b07-pickup-messages-data-rights-v1');

  await db.exec(`
    insert into public.market_orders(id,seller_id,buyer_id,fulfillment_group)
    values('${DELETE_ORDER}','${DELETE_USER}','${OTHER}','pickup');
    insert into dv_market_private.market_pickup_messages(context_type,context_id,sender_id,body)
    values('order','${DELETE_ORDER}','${DELETE_USER}','Diese Nachricht muss im manuellen Hold bleiben');
    insert into dv_market_private.account_deletion_requests(id,user_id,status,lock_token)
    values('${DELETE_REQUEST}','${DELETE_USER}','processing','${LOCK_TOKEN}');
  `);

  const plan=await value(`select public.prepare_account_deletion_data('${DELETE_REQUEST}','${LOCK_TOKEN}') value`);
  assert.equal(plan.auth_action,'disable_and_retain');
  assert.equal(plan.has_retention_holds,true);

  const hold=(await db.query(`select manual_review_required,retain_until from dv_market_private.account_deletion_holds where request_id='${DELETE_REQUEST}' and category='pickup_messages'`)).rows[0];
  assert.equal(hold.manual_review_required,true);
  assert.equal(hold.retain_until,null);
  assert.equal(Number((await db.query(`select count(*) count from dv_market_private.market_pickup_messages where context_id='${DELETE_ORDER}'`)).rows[0].count),1);
  assert.equal((await db.query(`select auth_action from dv_market_private.account_deletion_requests where id='${DELETE_REQUEST}'`)).rows[0].auth_action,'disable_and_retain');
  assert.equal(Number((await db.query(`select count(*) count from pg_trigger where tgname='block_restricted_pickup_messages' and not tgisinternal`)).rows[0].count),1);

  console.log('PASS: pickup messages are exported without counterpart IDs and erasure creates a manual retention hold without inventing an automatic deadline');
}finally{
  await db.close();
}
