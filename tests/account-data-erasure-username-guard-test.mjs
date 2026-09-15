import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const pgliteUrl=process.argv[2]?pathToFileURL(process.argv[2]).href:import.meta.resolve('@electric-sql/pglite');
const {PGlite}=await import(pgliteUrl);
const db=new PGlite();
const USER='94000000-0000-4000-8000-000000000001',REQ='94000000-0000-4000-8000-000000000002',LOCK='94000000-0000-4000-8000-000000000003';
const USER2='94000000-0000-4000-8000-000000000011',REQ2='94000000-0000-4000-8000-000000000012',LOCK2='94000000-0000-4000-8000-000000000013';
const patch=await readFile(new URL('../database/account-data-erasure-username-guard-v1.sql',import.meta.url),'utf8');
const blocked=async(sql,pattern)=>assert.rejects(()=>db.query(sql),pattern);
const flag=async()=>String((await db.query(`select coalesce(current_setting('duelvanta.username_rpc',true),'') value`)).rows[0].value||'');

try{
  await db.exec(`
    create role anon;create role authenticated;create role service_role;create schema auth;create schema dv_market_private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table public.profiles(id uuid primary key,email text,display_name text,username text,avatar_path text,collection_visibility text,updated_at timestamptz);
    create table public.market_notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid);
    create table public.market_default_shipping_addresses(user_id uuid primary key);
    create table public.market_listing_images(id uuid primary key default gen_random_uuid(),seller_id uuid);
    create table public.market_listings(id uuid primary key default gen_random_uuid(),seller_id uuid,collection_item_id uuid,image_path text,seller_note text,seller_display_name text,status text,updated_at timestamptz);
    create table public.collection_items(id uuid primary key default gen_random_uuid(),user_id uuid);
    create table public.collection_folders(id uuid primary key default gen_random_uuid(),user_id uuid);
    create table public.market_seller_accounts(seller_id uuid primary key,onboarding_status text,suspended_at timestamptz,trader_display_name text,updated_at timestamptz);
    create table dv_market_private.account_deletion_requests(id uuid primary key,user_id uuid,status text,lock_token uuid,auth_action text);
    create table dv_market_private.account_deletion_holds(id uuid primary key default gen_random_uuid(),request_id uuid,user_id uuid,category text,reason text,manual_review_required boolean default false,retain_until timestamptz,released_at timestamptz,unique(request_id,category));
    create table dv_market_private.market_contract_snapshots(id uuid primary key default gen_random_uuid(),seller_id uuid,buyer_id uuid);
    create table dv_market_private.market_tax_events(id uuid primary key default gen_random_uuid(),seller_id uuid,reporting_year integer);
    create table dv_market_private.listing_notices(id uuid primary key default gen_random_uuid(),reporter_user_id uuid);
    create table dv_market_private.listing_notice_appeals(id uuid primary key default gen_random_uuid(),appellant_user_id uuid);
    create table dv_market_private.seller_tax_identifiers(id uuid primary key default gen_random_uuid(),seller_id uuid);
    create table dv_market_private.seller_legal_profiles(seller_id uuid primary key);
    create table dv_market_private.account_data_rights_audit(id bigint generated always as identity primary key,user_id uuid,request_id uuid,event_type text,event_data jsonb);
    create function dv_market_private.account_deletion_blockers(uuid) returns jsonb language sql stable as $$select '[]'::jsonb$$;
    create function public.guard_profile_username_direct_update() returns trigger language plpgsql security definer set search_path='' as $$begin if new.username is distinct from old.username and coalesce(current_setting('duelvanta.username_rpc',true),'')<>'allowed' then raise exception 'Username changes must use the protected profile function'; end if;return new;end$$;
    create trigger guard_profile_username_direct_update before update of username on public.profiles for each row execute function public.guard_profile_username_direct_update();
    insert into public.profiles values
      ('${USER}','user@example.test','User','protected.name',null,'private',now()),
      ('${USER2}','user2@example.test','User 2','protected.failure',null,'private',now());
    insert into public.market_seller_accounts values
      ('${USER}','active',null,'User',now()),
      ('${USER2}','active',null,'User 2',now());
    insert into dv_market_private.account_deletion_requests values
      ('${REQ}','${USER}','processing','${LOCK}',null),
      ('${REQ2}','${USER2}','processing','${LOCK2}',null);
    grant usage on schema public to authenticated,service_role;grant select,update on public.profiles to authenticated,service_role;
  `);
  await db.exec(patch);

  const acl=(await db.query(`select
    has_function_privilege('authenticated','public.prepare_account_deletion_data(uuid,uuid)','EXECUTE') authenticated,
    has_function_privilege('service_role','public.prepare_account_deletion_data(uuid,uuid)','EXECUTE') service_role`)).rows[0];
  assert.equal(acl.authenticated,false,'authenticated must not have EXECUTE on erasure RPC');
  assert.equal(acl.service_role,true,'service_role must have EXECUTE on erasure RPC');
  const owner=(await db.query(`select pg_get_userbyid(proowner) owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='prepare_account_deletion_data'`)).rows[0].owner;
  assert.notEqual(owner,'service_role','SECURITY DEFINER owner must not be mistaken for the service_role caller');

  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${USER}',false);`);
  await blocked(`update public.profiles set username='direct.change' where id='${USER}'`,/Username changes must use the protected profile function/);
  await blocked(`select public.prepare_account_deletion_data('${REQ}','${LOCK}')`,/permission denied/);
  await db.exec('reset role');

  await db.exec(`set role service_role;select set_config('request.jwt.claim.sub','',false);`);
  const plan=(await db.query(`select public.prepare_account_deletion_data('${REQ}','${LOCK}') value`)).rows[0].value;
  assert.equal(plan.auth_action,'delete');
  assert.equal((await db.query(`select username from public.profiles where id='${USER}'`)).rows[0].username,null);
  assert.equal(await flag(),'','successful erasure must clear the transaction-local username bypass');
  await blocked(`update public.profiles set username='after.erasure' where id='${USER}'`,/Username changes must use the protected profile function/);

  await db.exec(`reset role;
    create function dv_market_private.fail_after_username_clear() returns trigger language plpgsql as $$begin raise exception 'forced_audit_failure';end$$;
    create trigger force_audit_failure before insert on dv_market_private.account_data_rights_audit for each row execute function dv_market_private.fail_after_username_clear();
    set role service_role;`);
  await blocked(`select public.prepare_account_deletion_data('${REQ2}','${LOCK2}')`,/forced_audit_failure/);
  assert.equal(await flag(),'','failed erasure must clear the transaction-local username bypass');
  await db.exec('reset role');
  assert.equal((await db.query(`select username from public.profiles where id='${USER2}'`)).rows[0].username,'protected.failure','failed erasure must roll back username clearing');
  await db.exec('set role service_role');
  await blocked(`update public.profiles set username='still.blocked' where id='${USER2}'`,/Username changes must use the protected profile function/);

  console.log('PASS: B02 real username trigger allows only locked service-role erasure and clears bypass on success/failure');
}finally{await db.close()}
