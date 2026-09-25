import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
const sql=p=>read(p).then(s=>s.replace(/^\\.*$/gm,''));
const B='10000000-0000-4000-8000-000000000003',S='10000000-0000-4000-8000-000000000002';
const listing=i=>'60000000-0000-4000-8000-'+String(i).padStart(12,'0');
export async function testProductionTradeLock(db){
 const cases=[];const pass=n=>{cases.push(n);console.log('P005 PASS',n)};
 const role=async(r,uid=B)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[uid,JSON.stringify({sub:uid,role:r,aal:'aal1'})]);await db.exec('set role '+r)};
 const rpc=async(q,args=[])=>{const v=(await db.query(q,args)).rows[0]?.v;return typeof v==='string'&&v.startsWith('{')?JSON.parse(v):v};
 const locked=async(q,args=[])=>assert.rejects(()=>db.query(q,args),e=>e.code==='P0001'&&e.message==='production_trade_locked');
 await db.exec(await sql('tests/market-production-trade-lock-bootstrap.sql'));
 const prepares=[];
 for(let i=1;i<=2;i++){
  await role('authenticated');const r=await rpc('select public.review_market_checkout($1,1) v',[listing(i)]);
  const args=[listing(i),1,randomUUID(),r.listing_updated_at,r.checkout_hash,false];
  const prepared=await rpc('select public.prepare_fixed_price_market_offer_v1($1,$2,$3,$4,$5,$6) v',args);prepares.push({args,prepared});
 }
 await role('service_role');const a=prepares[0].prepared;const acceptArgs=[a.offer_id,a.payment_attempt_id,'cs_test_P005Fixture',new Date().toISOString(),false];
 const accepted=await rpc('select public.accept_fixed_price_market_offer_v1($1,$2,$3,$4,$5) v',acceptArgs);
 const price=[];
 for(let i=3;i<=4;i++){
  await role('authenticated');const r=await rpc('select public.review_market_price_offer_v1($1,1,9) v',[listing(i)]);
  const id=(await db.query('select public.create_market_offer_v3($1,1,9,null,$2,$3) v',[listing(i),r.listing_updated_at,r.offer_review_hash])).rows[0].v;price.push(id);
 }
 await role('postgres');pass('unlocked controls: real fixed prepare/accept and price offers succeed');
 const contract=(await db.query('select * from dv_market_private.market_contract_snapshots where id=$1',[accepted.contract_snapshot_id])).rows[0];
 const freeze=()=>db.query(`select jsonb_build_object('offers',(select count(*) from public.market_offers),'deals',(select count(*) from public.market_deals),'orders',(select count(*) from public.market_orders),'items',(select count(*) from public.market_order_items),'snapshots',(select count(*) from dv_market_private.market_contract_snapshots)) v`);
 const before=(await freeze()).rows[0].v;
 const lock=await read('database/market-production-trade-lock-v1.sql');
 const lockReadiness=await read('database/market-production-trade-lock-readiness-v1.sql');
 const transactionBody=lock.replace(/^begin;|^commit;/gm,'')+'\n'+lockReadiness.replace(/^begin;|^commit;/gm,'');
 // Test abort/rollback first, with the real migration body in an outer transaction.
 await db.exec('begin');await db.exec(transactionBody);await db.exec('rollback');
 assert.equal((await db.query("select count(*)::int n from pg_trigger where tgname='a00_production_trade_lock_v1'")).rows[0].n,0);
 pass('installation rollback leaves original schema and permissions intact');
 await db.exec('begin;'+transactionBody+'\ncommit;');await db.exec('begin;'+transactionBody+'\ncommit;');pass('complete lock plus readiness installs atomically and reapplies idempotently');
 await db.exec(await sql('tests/market-production-trade-lock-database.sql'));
 const ready=await rpc('select public.get_market_legal_schema_readiness_v1() v');assert.equal(ready.compatible,true);pass('locked legal/security readiness passes without disabling existing-order UI');
 // Every revoked entry point is actually invoked under all three application roles.
 const entries=(await db.query(`select p.oid::regprocedure::text sig,p.proname,array(select format_type(t,null) from unnest(p.proargtypes) t) types from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname ~ '^(buy_market_listing(_v[0-9]+)?|checkout_accepted_market_offer(_v[0-9]+)?|create_market_offer(_v[0-9]+)?|create_sealed_market_listing_draft(_v[0-9]+)?|edit_my_market_listing(_v[0-9]+)?|edit_my_sealed_market_listing(_v[0-9]+)?|publish_my_sealed_market_listing|renew_my_market_listing)$'`)).rows;
 for(const r of ['anon','authenticated','service_role']){
  await role(r);
  for(const f of entries)await assert.rejects(()=>db.query(`select public.${f.proname}(${f.types.map(t=>'null::'+t).join(',')})`),e=>e.code==='42501');
  for(const t of ['market_listings','market_offers','market_deals','market_orders','market_order_items','market_listing_images']){
   await assert.rejects(()=>db.query(`insert into public.${t} default values`),e=>e.code==='42501'||e.message==='production_trade_locked');
  }
  pass(r+': all '+entries.length+' new-commerce RPCs and six direct INSERT sinks denied');
 }
 await role('postgres');
 // Exercise triggers even for future SECURITY DEFINER functions / privileged direct SQL.
 for(const t of ['market_listings','market_offers','market_deals','market_orders','market_order_items','market_listing_images'])await locked(`insert into public.${t} default values`);
 for(const t of ['market_swap_threads','market_swap_revisions','market_swap_confirmations','market_swap_revision_items','market_swap_reservations'])await locked(`insert into dv_market_private.${t} default values`);pass('all five retired swap creation sinks remain locked for privileged writes');
 await db.exec('set session_replication_role=replica');await locked('insert into public.market_orders default values');await db.exec('set session_replication_role=origin');
 await locked("update public.market_offers set status='accepted' where id=$1",[price[0]]);
 await locked("update public.market_orders set buyer_id=$1 where id=$2",[S,accepted.order_id]);
 await locked("update public.market_order_items set quantity=quantity+1 where order_id=$1",[accepted.order_id]);
 await locked("update public.market_listings set quantity_available=quantity_available-1 where id=$1",[listing(2)]);
 await locked("update public.market_listings set status='active' where id='20000000-0000-4000-8000-000000000003'");
 pass('owner/definer/replica writes, old-order grafting and republishing denied by physical triggers');
 // Defense in depth against an accidental future service_role table grant.
 await db.exec('begin;grant select,insert,update on public.market_listings,public.market_offers,public.market_deals,public.market_orders,public.market_order_items,public.market_listing_images to service_role');
 await role('service_role');
 for(const t of ['market_listings','market_offers','market_deals','market_orders','market_order_items','market_listing_images']){
  await db.exec('savepoint attack');await locked(`insert into public.${t} default values`);await db.exec('rollback to savepoint attack');
 }
 await db.exec('savepoint attack');await locked("update public.market_offers set status='accepted' where id=$1",[price[0]]);await db.exec('rollback to savepoint attack');
 await db.exec('reset role;rollback');pass('service_role BYPASSRLS with adversarial future DML grants still blocked; grants rolled back');

 await role('authenticated');
 await locked('select public.prepare_fixed_price_market_offer_v1($1,$2,$3,$4,$5,$6)',prepares[1].args);
 await locked('select public.prepare_fixed_price_market_offer_v1($1,1,$2,now(),$3,false)',[listing(2),randomUUID(),'a'.repeat(64)]);
 await role('service_role');const p=prepares[1].prepared;
 await locked('select public.accept_fixed_price_market_offer_v1($1,$2,$3,now(),false)',[p.offer_id,p.payment_attempt_id,'cs_test_Denied']);
 await role('authenticated',S);await locked("select public.respond_to_market_offer($1,'accepted')",[price[0]]);
 await role('postgres');assert.deepEqual((await freeze()).rows[0].v,before);pass('fixed fresh/prepared, service acceptance and price acceptance leave counts unchanged');
 // Real existing-order replay stays available; original validation and ownership still run.
 await role('authenticated');assert.equal((await rpc('select public.prepare_fixed_price_market_offer_v1($1,$2,$3,$4,$5,$6) v',prepares[0].args)).accepted,true);
 await role('service_role');assert.equal((await rpc('select public.accept_fixed_price_market_offer_v1($1,$2,$3,$4,$5) v',acceptArgs)).replayed,true);
 const paymentRetry=await rpc('select public.prepare_market_stripe_payment($1,$2,$3) v',[accepted.order_id,B,prepares[0].args[2]]);assert.ok(paymentRetry.attempt_id);pass('service-role payment preparation for an existing order remains allowed');
 await db.query("select public.release_fixed_price_market_offer_v1($1,'lock cleanup')",[p.offer_id]);
 await role('authenticated',S);await db.query("select public.respond_to_market_offer($1,'declined')",[price[0]]);
 await role('authenticated');await db.query('select public.withdraw_my_market_offer($1)',[price[1]]);
 pass('accepted fixed retries, reservation release, offer decline and withdrawal remain usable');
 // Execute the actual API handler with HTTP adapter backed by this database. No network.
 const checkout=require('../../api/market-stripe-checkout.js');const originalFetch=global.fetch,env={...process.env};let providers=0,mockReads=0;
 try{
  Object.assign(process.env,{SUPABASE_URL:'https://xhmjxrcskfhbovhitdej.supabase.co',SUPABASE_ANON_KEY:'fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture-service',STRIPE_SECRET_KEY:'sk_test_fixture',STRIPE_CONNECT_SANDBOX_ENABLED:'true',DUELVANTA_PUBLIC_ORIGIN:'https://isolated.invalid'});
  global.fetch=async(url,options={})=>{
   if(String(url).endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:B}),{status:200});
   if(String(url).includes('api.stripe.com')){
    if(options.method==='GET'&&String(url).includes('cs_test_P005Fixture')){mockReads++;return new Response(JSON.stringify({id:'cs_test_P005Fixture',amount_total:a.amount_due_cents,currency:'eur',client_reference_id:a.payment_attempt_id,metadata:{duelvanta_attempt_id:a.payment_attempt_id,duelvanta_fixed_offer_id:a.offer_id},created:Math.floor(Date.now()/1000),status:'open',url:'https://checkout.stripe.com/c/pay/cs_test_P005Fixture'}),{status:200});}
    providers++;throw Error('external_provider_forbidden');
   }
   const name=String(url).split('/rpc/')[1];if(name!=='prepare_fixed_price_market_offer_v1')throw Error('unexpected_rpc');
   await role('authenticated');const b=JSON.parse(options.body);try{const v=await rpc('select public.prepare_fixed_price_market_offer_v1($1,$2,$3,$4,$5,$6) v',[b.p_listing_id,b.p_quantity,b.p_request_id,b.p_expected_updated_at,b.p_checkout_hash,b.p_live_mode]);return new Response(JSON.stringify(v),{status:200});}catch(e){return new Response(JSON.stringify({message:e.message,code:e.code}),{status:400});}
  };
  const [l,q,k,at,h]=prepares[1].args;const res={status(c){this.code=c;return this},json(v){this.body=v;return this}};
  await checkout({method:'POST',headers:{authorization:'Bearer fixture'},body:{listing_id:l,quantity:q,request_key:k,expected_updated_at:at,checkout_hash:h}},res);
  assert.equal(res.code,409);assert.equal(res.body.error,'database_prepare_fixed_price_market_offer_v1_400');assert.equal(providers,0);pass('real HTTP checkout handler + real DB: locked fixed request returns 409 before any provider call');
  const [rl,rq,rk,rat,rh]=prepares[0].args;const replayRes={status(c){this.code=c;return this},json(v){this.body=v;return this}};
  await checkout({method:'POST',headers:{authorization:'Bearer fixture'},body:{listing_id:rl,quantity:rq,request_key:rk,expected_updated_at:rat,checkout_hash:rh}},replayRes);
  assert.equal(replayRes.code,200);assert.equal(replayRes.body.contract_formed,true);assert.equal(replayRes.body.replayed,true);assert.equal(mockReads,1);assert.equal(providers,0);pass('real HTTP fixed-price accepted replay recovers existing payment through mocked read only');

 }finally{global.fetch=originalFetch;for(const k of Object.keys(process.env))if(!(k in env))delete process.env[k];Object.assign(process.env,env);await role('postgres');}
 // Necessary lifecycle: problems, dispute compatibility, cancellation + inventory restore.
 const existing='40000000-0000-4000-8000-000000000006';
 await db.query("update public.market_orders set status='shipped',shipped_at=now(),fulfillment_group='shipping' where id='40000000-0000-4000-8000-000000000007'");
 await role('authenticated');await db.query('select * from public.get_my_market_orders()');await db.query('select public.export_my_duelvanta_data()');
 const problem=await rpc("select public.open_market_order_problem_v2($1,'other','Synthetic lock test problem') v",['40000000-0000-4000-8000-000000000007']);
 await db.query("select public.withdraw_market_order_problem($1,'Synthetic resolved')",[problem]);
 await db.query("select public.request_market_order_cancellation($1,'Synthetic cancellation')",[existing]);
 await role('postgres');const cancellation=(await db.query("select id from public.market_order_cases where order_id=$1 and case_type='cancellation' and status='open'",[existing])).rows[0].id;
 await role('authenticated',S);await db.query("select public.respond_market_order_cancellation($1,true,'Synthetic accepted')",[cancellation]);
 await db.query("select public.finish_my_market_listing($1,'withdrawn')",[listing(3)]);
 pass('actual own-order reads/export, problem open/withdraw, cancellation acceptance and listing closure succeed');
 // Withdrawal/receipt and full refund preparation for a pre-lock contract.
 await role('authenticated');const w=await rpc('select public.prepare_market_withdrawal_v1($1,$2,$3) v',[contract.id,'Synthetic Buyer','buyer@invalid.example']);
 await db.query('select public.confirm_market_withdrawal_v1($1)',[w.draft_id]);
 await role('postgres');
 await db.query("update dv_market_private.market_payment_attempts set state='paid',paid_cents=amount_due_cents,stripe_payment_intent_id='pi_P005Fixture' where id=$1",[a.payment_attempt_id]);
 await db.query("update public.market_orders set payment_status='paid',paid_amount=12,refund_status='provider_required' where id=$1",[accepted.order_id]);
 await role('service_role');const refund=await rpc("select public.prepare_market_stripe_full_refund($1,$2,'Synthetic refund') v",[accepted.order_id,randomUUID()]);assert.equal(refund.amount_cents,1200);
 pass('actual B2C withdrawal/receipt and service-role full-refund preparation succeed');
 await role('postgres');
 const done='40000000-0000-4000-8000-000000000007';await db.query("update public.market_orders set status='shipped',shipped_at=now(),fulfillment_group='shipping' where id=$1",[done]);
 await role('authenticated');await db.query('select public.confirm_market_order_received($1)',[done]);await role('postgres');assert.equal((await db.query('select status from public.market_orders where id=$1',[done])).rows[0].status,'completed');pass('existing manual order receipt completes under lock');
 // Actual deletion preparation touches a pre-existing withdrawn listing under lock.
 const erasureUser='10000000-0000-4000-8000-000000000005';
 await role('authenticated',erasureUser);
 const deletion=await rpc("select public.request_my_account_deletion('KONTO LÖSCHEN',$1) v",[randomUUID()]);assert.equal(deletion.accepted,true);
 await role('service_role',null);
 const claimed=(await db.query('select * from public.claim_account_deletion_requests(5,$1)',[randomUUID()])).rows.find(r=>r.request_id===deletion.request_id);assert.ok(claimed);
 const deletionPlan=await rpc('select public.prepare_account_deletion_data($1,$2) v',[claimed.request_id,claimed.delivery_lock_token]);assert.equal(deletionPlan.auth_action,'delete');
 await db.query('select public.finish_account_deletion_request($1,$2,true,null)',[claimed.request_id,claimed.delivery_lock_token]);
 await role('postgres');pass('actual data-rights request, claim, listing anonymization and DB completion succeed; external Auth/Storage not invoked');
 // Drift cannot silently unlock while reporting compatible.
 await db.exec('begin;alter table public.market_orders disable trigger a00_production_trade_lock_v1');assert.equal((await rpc('select public.get_market_legal_schema_readiness_v1() v')).compatible,false);await db.exec('rollback');pass('disabled lock trigger makes readiness fail closed');
 await db.exec('update dv_market_private.market_payment_configuration set sandbox_enabled=false');
 const report={status:'PASS',cases,revoked_rpc_signatures:entries.map(f=>f.sig),lock_sha256:createHash('sha256').update(lock).digest('hex'),provider_calls:providers,engine:(await db.query('select version() v')).rows[0].v};
 await writeFile('test-results/production-trade-lock-cases.json',JSON.stringify(report,null,2));return report;
}
