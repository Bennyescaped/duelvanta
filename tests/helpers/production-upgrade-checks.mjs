import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../../'+p,import.meta.url),'utf8');
const qi=s=>'"'+s.replaceAll('"','""')+'"';
const schemas="'public','dv_market_private','dv_v16_private','dv_collect_private','battle_spectator_private','battle_spectator_media_private'";
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const stable=x=>JSON.stringify(x,Object.keys(x).sort());
export async function baselineChecks(db,catalog,functions,native){
 const expected=JSON.parse(await read('evidence/production-upgrade-p0-01-20260925/production-catalog-fresh.json'));
 const sections={};
 for(const [k,rows] of Object.entries(expected)){
  let actual=catalog[k];
  // PGlite 0.5.8 uses PG18, which additionally exposes NOT NULL constraints in pg_constraint.
  // Native PostgreSQL17 is the required gate and has no such normalization.
  if(!native&&k==='constraints')actual=actual.filter(x=>!x.definition.startsWith('NOT NULL'));
  const normalize=rows=>rows.map(x=>({...x,...(x.acl?{acl:[...x.acl].sort()}:{})})).map(stable).sort();
  assert.deepEqual(normalize(actual),normalize(rows),'Production baseline '+k);sections[k]=rows.length;
 }
 const source=JSON.parse(await read('evidence/production-upgrade-p0-01-20260925/source-fresh.json'))[0].inventory;
 assert.deepEqual(functions.map(stable).sort(),source.functions.map(stable).sort(),'All Production function definitions must match historical replay');
 sections.functions=functions.length;return sections;
}
export async function snapshotOriginal(db,catalog){
 const result={};
 for(const r of catalog.relations.filter(x=>x.kind==='r')){
  const cols=catalog.columns.filter(x=>x.schema===r.schema&&x.table===r.name).map(x=>qi(x.name)).join(',');
  const sql=`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') rows from (select ${cols} from ${qi(r.schema)}.${qi(r.name)})t`;
  const rows=(await db.query(sql)).rows[0].rows;result[r.schema+'.'+r.name]={sql,count:rows.length,sha256:sha(rows)};
 }
 return result;
}
export async function unchangedOriginal(db,before){
 const results=[];
 for(const [name,b] of Object.entries(before)){
  const rows=(await db.query(b.sql)).rows[0].rows;assert.equal(rows.length,b.count,name+' count changed');assert.equal(sha(rows),b.sha256,name+' original columns changed');
  results.push({table:name,count:rows.length,sha256:b.sha256});
 }
 return results;
}
export async function foreignKeys(db){
 const fks=(await db.query(`select ns.nspname schema,c.relname tab,nt.nspname target_schema,t.relname target_table,k.conname,
 (select array_agg(a.attname order by u.ord) from unnest(k.conkey) with ordinality u(attnum,ord) join pg_attribute a on a.attrelid=c.oid and a.attnum=u.attnum) cols,
 (select array_agg(a.attname order by u.ord) from unnest(k.confkey) with ordinality u(attnum,ord) join pg_attribute a on a.attrelid=t.oid and a.attnum=u.attnum) target_cols
 from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace ns on ns.oid=c.relnamespace join pg_class t on t.oid=k.confrelid join pg_namespace nt on nt.oid=t.relnamespace where k.contype='f' and ns.nspname in (${schemas})`)).rows;
 for(const f of fks){
  const match=f.cols.map((c,i)=>`s.${qi(c)}=t.${qi(f.target_cols[i])}`).join(' and ');
  const populated=f.cols.map(c=>`s.${qi(c)} is not null`).join(' and ');
  const n=(await db.query(`select count(*)::int n from ${qi(f.schema)}.${qi(f.tab)} s where ${populated} and not exists(select 1 from ${qi(f.target_schema)}.${qi(f.target_table)} t where ${match})`)).rows[0].n;
  assert.equal(n,0,'FK orphan '+f.conname);
 }
 return {checked:fks.length,orphans:0};
}
export async function beforeUpgradeAbort(db,before){
 await db.exec('begin;alter table public.market_orders add column p001_abort_probe boolean;');
 await assert.rejects(()=>db.query('select 1/0'),/division by zero/);
 await db.exec('rollback');
 assert.equal((await db.query("select count(*)::int n from information_schema.columns where table_schema='public' and table_name='market_orders' and column_name='p001_abort_probe'")).rows[0].n,0);
 await unchangedOriginal(db,before);return 'PASS: failed transaction rolls back schema and original rows';
}
export async function finalChecks(db,before,empty){
 const originals=await unchangedOriginal(db,before),fks=await foreignKeys(db);
 const cfg=(await db.query('select sandbox_enabled,live_mode from dv_market_private.market_payment_configuration')).rows[0];
 assert.deepEqual(cfg,{sandbox_enabled:false,live_mode:false});
 assert.equal((await db.query('select media_enabled from battle_spectator_media_private.config')).rows[0].media_enabled,false);
 assert.equal((await db.query("select count(*)::int n from pg_extension where extname in ('pg_cron','pg_net')")).rows[0].n,0);
 const noBackfill=['market_contract_snapshots','market_withdrawals','marketplace_message_outbox','market_tax_events','market_payment_attempts','seller_legal_profiles','trade_user_eligibility'];
 for(const t of noBackfill)assert.equal((await db.query(`select count(*)::int n from dv_market_private.${qi(t)}`)).rows[0].n,0,'Unintended business backfill '+t);
 const sellers=(await db.query('select seller_type,onboarding_status from public.market_seller_accounts')).rows;
 assert.equal(sellers.length,empty?0:1);for(const s of sellers)assert.deepEqual(s,{seller_type:'unclassified',onboarding_status:'legacy_beta'});
 const binding=(await db.query('select user_id from dv_v16_private.operator_identity_v1')).rows;
 assert.equal(binding.length,empty?0:1);if(!empty)assert.equal(binding[0].user_id,'10000000-0000-4000-8000-000000000001');
 const sessions=(await db.query('select count(*)::int n from auth.sessions')).rows[0].n;assert.equal(sessions,0);
 // Ordinary legacy buyers must retain order reads; a foreign user must see no rows.
 const reads=[];
 if(!empty){
  for(const [id,want] of [['10000000-0000-4000-8000-000000000003',7],['10000000-0000-4000-8000-000000000004',0]]){
   await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');
   try{const n=(await db.query('select count(*)::int n from public.market_orders')).rows[0].n;assert.equal(n,want);reads.push({role:'authenticated',own_orders:n});
    await db.query('select * from public.get_my_trade_actions()');await db.query('select * from public.get_my_market_order_b07_status()');
   }finally{await db.exec('reset role');}
  }
  // Human owner administration remains fail-closed without MFA, including during fallback.
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:'10000000-0000-4000-8000-000000000001',role:'authenticated',aal:'aal1'})]);
  await db.exec('set role authenticated');try{await assert.rejects(()=>db.query('select public.require_duelvanta_privileged_session()'),/mfa_step_up_required|privileged_session_required/);}finally{await db.exec('reset role');}
 }
 return {originals,fks,seller_backfill:sellers,forbidden_business_backfills:0,stripe:cfg,media_enabled:false,schedulers:0,legacy_reads:reads,owner_without_mfa:empty?'not applicable':'denied',sessions};
}
export async function assertReviewedActionsSource(){
 const source=await read('database/trade-order-lifecycle-payment-hardening-v1.sql');
 const target=await read('database/production-upgrade/trade-actions-reviewed-source.sql');
 const body=s=>s.match(/create or replace function public.get_my_trade_actions\(.*?\bas\s*(\$\w*\$)([\s\S]*?)\1/is)?.[2];
 const token=/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|[A-Za-z_][A-Za-z_0-9$]*|\d+(?:\.\d+)?|\S/g;
 const tokens=s=>s.match(token).filter(x=>!x.startsWith('--')&&!x.startsWith('/*')).map(x=>/^['"]/.test(x)?x:x.toLowerCase());
 assert.ok(body(source)&&body(target));assert.deepEqual(tokens(body(source)),tokens(body(target)),'Reviewed payment predicates must remain source-equivalent');
}
