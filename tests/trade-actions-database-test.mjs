import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'@electric-sql/pglite');
const db=new PGlite();
const uid=n=>`91000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const buyer=uid(1),seller=uid(2),outsider=uid(3);
const files=['trade-order-resolution-v1.sql','trade-order-resolution-v1-hardening.sql','trade-actions-column-aliases-v1.sql'];
const functions=await Promise.all(files.map(async file=>{
  const sql=await readFile(new URL('../database/'+file,import.meta.url),'utf8');
  const fn=sql.match(/create or replace function public\.get_my_trade_actions\(\)[\s\S]*?\$\$;/i)?.[0];
  assert.ok(fn,`missing function in ${file}`);return fn;
}));
const alias=') actions(action_key,action_type,priority,title,subject,quantity,amount,order_id,offer_id,created_at)';
async function actions(user){
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  return (await db.query('select * from public.get_my_trade_actions()')).rows;
}
try{
  await db.exec(`
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create role anon; create role authenticated;
    create table public.market_listings(id uuid,card_name text);
    create table public.market_offers(id uuid,listing_id uuid,listing_snapshot jsonb,requested_quantity integer,amount numeric,seller_id uuid,status text,created_at timestamptz);
    create table public.market_orders(id uuid,order_number text,item_count integer,total_amount numeric,buyer_id uuid,seller_id uuid,fulfillment_group text,status text,shipping_quote_status text,payment_status text,shipped_at timestamptz,created_at timestamptz);
    create table public.market_order_cases(id uuid,order_id uuid,case_type text,status text,opened_by uuid,responded_at timestamptz,created_at timestamptz);
    create table public.market_order_shipping_addresses(order_id uuid);
    insert into public.market_offers values
      ('${uid(10)}',null,'{"card_name":"older"}',2,4,'${seller}','pending','2026-09-13'),
      ('${uid(11)}',null,'{"card_name":"newer"}',3,6,'${seller}','pending','2026-09-14');
    insert into public.market_orders values
      ('${uid(20)}','ADDRESS',1,4,'${buyer}','${seller}','shipping','open','confirmed','paid',null,'2026-09-14'),
      ('${uid(21)}','SHIP',1,4,'${buyer}','${seller}','pickup','open','confirmed','paid',null,'2026-09-14'),
      ('${uid(22)}','QUOTE',1,4,'${buyer}','${seller}','pickup','open','review_required','pending',null,'2026-09-14');
    insert into public.market_order_cases values ('${uid(30)}','${uid(21)}','problem','open','${buyer}',null,'2026-09-14');
  `);
  // Prove this fixture detects the original runtime failure, not just SQL text.
  await db.exec(functions[1].replace(alias,') actions'));
  await assert.rejects(()=>actions(buyer),/column actions.priority does not exist/);
  for(let i=0;i<functions.length;i++){
    await db.exec(functions[i]);
    assert.deepEqual((await actions(buyer)).map(r=>[r.action_type,r.subject]),[['add_address','ADDRESS']],files[i]);
    const rows=await actions(seller);
    assert.deepEqual(rows.map(r=>r.priority),[10,10,18,30,40],files[i]);
    assert.deepEqual(rows.slice(0,2).map(r=>[r.subject,r.quantity,Number(r.amount)]),[['newer',3,6],['older',2,4]]);
    assert.deepEqual(await actions(outsider),[]);
    await assert.rejects(()=>actions(''),/Nicht angemeldet/);
  }
  const upgrade=await readFile(new URL('../database/trade-actions-column-aliases-v1.sql',import.meta.url),'utf8');
  await db.exec(upgrade);await db.exec(upgrade); // repeatable upgrade including grants
  await db.exec('set role anon');
  await assert.rejects(()=>actions(buyer),/permission denied/);
  await db.exec('reset role; set role authenticated');
  assert.equal((await actions(buyer)).length,1);
  assert.deepEqual(await actions(outsider),[]);
  console.log('PASS: real SQL action queries, priority/date ordering, ownership, anonymous denial and repeatable upgrade');
}finally{await db.close();}
