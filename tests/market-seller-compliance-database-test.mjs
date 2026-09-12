import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {PGlite}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'@electric-sql/pglite');
const db=new PGlite();
const A='10000000-0000-4000-8000-000000000001';
const B='10000000-0000-4000-8000-000000000002';
const C='10000000-0000-4000-8000-000000000003';
const migration=await readFile(new URL('../database/market-seller-compliance-v1.sql',import.meta.url),'utf8');

const claim=async(uid,role='authenticated')=>{
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${role};`);
};

const json=value=>typeof value==='string'?JSON.parse(value):value;
const denied=promise=>assert.rejects(()=>promise,/permission denied|not_authenticated/);

try{
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create table public.market_listings(
      id uuid primary key default gen_random_uuid(),
      seller_id uuid not null references auth.users(id),
      status text not null default 'active'
    );
    create table public.market_deals(
      id uuid primary key default gen_random_uuid(),
      seller_id uuid not null references auth.users(id)
    );
    insert into auth.users(id) values ('${A}'),('${B}'),('${C}');
    insert into public.market_listings(seller_id,status) values ('${A}','active');
  `);

  await db.exec(migration);

  const columns=(await db.query(`
    select column_name from information_schema.columns
    where table_schema='public' and table_name='market_seller_accounts'
    order by ordinal_position
  `)).rows.map(row=>row.column_name);
  assert.ok(columns.includes('seller_type'));
  assert.ok(columns.includes('onboarding_status'));
  assert.ok(!columns.some(name=>/tax|birth|iban|street/.test(name)),'safe public seller table contains sensitive fields');

  const seeded=(await db.query(`
    select seller_type,onboarding_status from public.market_seller_accounts where seller_id='${A}'
  `)).rows[0];
  assert.deepEqual(seeded,{seller_type:'unclassified',onboarding_status:'legacy_beta'});

  await claim(null,'anon');
  await denied(db.query(`select public.get_my_market_seller_onboarding()`));
  await denied(db.query(`select * from public.market_seller_accounts`));

  await claim(B);
  await denied(db.query(`insert into public.market_seller_accounts(seller_id) values ('${B}')`));
  const selected=json((await db.query(`select public.set_my_market_seller_type('private') as value`)).rows[0].value);
  assert.equal(selected.seller_type,'private');
  assert.equal(selected.onboarding_status,'draft');
  const mine=json((await db.query(`select public.get_my_market_seller_onboarding() as value`)).rows[0].value);
  assert.equal(mine.seller_type,'private');
  assert.equal(mine.legal_profile,null);

  await assert.rejects(
    ()=>db.query(`select public.save_my_market_seller_legal_profile(
      p_legal_first_name=>'Private',p_legal_last_name=>'Person',p_date_of_birth=>current_date,
      p_street_line1=>'Private street 1',p_street_line2=>null,p_postal_code=>'75100',
      p_city=>'Private city',p_country_code=>'DE',p_tax_residence_country_code=>'DE'
    )`),
    /seller_must_be_adult/
  );
  await db.query(`select public.save_my_market_seller_legal_profile(
    p_legal_first_name=>'Private',p_legal_last_name=>'Person',p_date_of_birth=>'1990-01-01',
    p_street_line1=>'Private street 1',p_street_line2=>null,p_postal_code=>'75100',
    p_city=>'Private city',p_country_code=>'DE',p_tax_residence_country_code=>'DE',
    p_business_name=>'Must not persist',p_public_email=>'private@example.test'
  )`);
  await assert.rejects(
    ()=>db.query(`select public.submit_my_market_seller_onboarding(true,false,true)`),
    /seller_declarations_required/
  );
  const submittedPrivate=json((await db.query(`select public.submit_my_market_seller_onboarding(true,true,true) as value`)).rows[0].value);
  assert.equal(submittedPrivate.onboarding_status,'pending_review');

  await db.exec(`reset role;
    update public.market_seller_accounts set onboarding_status='active' where seller_id='${B}';
  `);
  assert.equal((await db.query(`select business_name from dv_market_private.seller_legal_profiles where seller_id='${B}'`)).rows[0].business_name,null);
  await claim(A);
  const privateDisclosure=json((await db.query(`select public.get_market_seller_disclosure('${B}') as value`)).rows[0].value);
  assert.deepEqual(privateDisclosure,{seller_id:B,seller_type:'private',onboarding_status:'active'});
  assert.ok(!JSON.stringify(privateDisclosure).includes('Private street'));
  assert.equal(Number((await db.query(`select count(*) as count from public.market_seller_accounts where seller_id='${B}'`)).rows[0].count),0);
  await denied(db.query(`select * from dv_market_private.seller_legal_profiles`));

  await claim(C);
  await db.query(`select public.set_my_market_seller_type('trader')`);
  await assert.rejects(
    ()=>db.query(`select public.save_my_market_seller_legal_profile(
      p_legal_first_name=>'Trade',p_legal_last_name=>'Person',p_date_of_birth=>'1985-02-03',
      p_street_line1=>'Business street 2',p_street_line2=>null,p_postal_code=>'75200',
      p_city=>'Business city',p_country_code=>'DE',p_tax_residence_country_code=>'DE'
    )`),
    /trader_public_profile_incomplete/
  );
  await db.query(`select public.save_my_market_seller_legal_profile(
    p_legal_first_name=>'Trade',p_legal_last_name=>'Person',p_date_of_birth=>'1985-02-03',
    p_street_line1=>'Business street 2',p_street_line2=>null,p_postal_code=>'75200',
    p_city=>'Business city',p_country_code=>'DE',p_tax_residence_country_code=>'DE',
    p_business_name=>'Card Shop',p_legal_form=>'Einzelunternehmen',
    p_public_email=>'shop@example.test',p_public_phone=>'+4912345'
  )`);
  await db.query(`select public.submit_my_market_seller_onboarding(true,true,true)`);
  await db.exec(`reset role;
    update public.market_seller_accounts
      set onboarding_status='active',trader_display_name='Card Shop',country_code='DE'
      where seller_id='${C}';
  `);
  await claim(A);
  const traderDisclosure=json((await db.query(`select public.get_market_seller_disclosure('${C}') as value`)).rows[0].value);
  assert.equal(traderDisclosure.seller_type,'trader');
  assert.equal(traderDisclosure.business_name,'Card Shop');
  assert.equal(traderDisclosure.street_line1,'Business street 2');
  assert.ok(!Object.hasOwn(traderDisclosure,'date_of_birth'));
  assert.ok(!Object.hasOwn(traderDisclosure,'tax_residence_country_code'));

  await claim(C);
  const changedToPrivate=json((await db.query(`select public.set_my_market_seller_type('private') as value`)).rows[0].value);
  assert.equal(changedToPrivate.seller_type,'private');
  assert.equal(changedToPrivate.onboarding_status,'draft');
  assert.equal(changedToPrivate.trader_display_name,null);

  await db.exec(`reset role;
    update public.market_seller_accounts
      set seller_type='trader',onboarding_status='active',trader_display_name='Card Shop'
      where seller_id='${C}';
  `);

  await db.exec(`reset role;
    update dv_market_private.marketplace_compliance_policy set seller_onboarding_enforced=true;
  `);
  await assert.rejects(
    ()=>db.query(`insert into public.market_listings(seller_id,status) values ('${A}','active')`),
    /seller_onboarding_required/
  );
  await db.query(`insert into public.market_listings(seller_id,status) values ('${B}','active')`);

  await db.exec(`reset role;
    update public.market_seller_accounts set onboarding_status='suspended' where seller_id='${B}';
  `);
  await claim(B);
  await assert.rejects(
    ()=>db.query(`select public.set_my_market_seller_type('trader')`),
    /seller_account_suspended/
  );
  await db.exec(`reset role;`);
  await assert.rejects(
    ()=>db.query(`insert into public.market_listings(seller_id,status) values ('${B}','active')`),
    /seller_onboarding_required/
  );

  const auditCount=Number((await db.query(`select count(*) as count from dv_market_private.seller_account_audit`)).rows[0].count);
  assert.ok(auditCount>=5,'seller status changes were not audited');

  console.log('PASS: seller classification, legacy-safe backfill, private data isolation, public trader disclosure and server-side listing guard');
}finally{
  await db.close();
}
