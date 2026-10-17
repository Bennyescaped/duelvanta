// Build-time authoring only. Runtime never manufactures expected inventories.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {baseline,install as installI2} from './helpers/tcg-i2-fixture.mjs';
import {queries as i2Queries,unchangedContract} from './generate-tcg-i2-readiness.mjs';
export const tables=['tcg_provider_evidence','tcg_catalog_derivations','tcg_catalog_snapshots','tcg_catalog_snapshot_members','tcg_catalog_releases'].map(n=>'dv_collect_private.'+n);
export const privateFunctions=['tcg_catalog_schema_readiness_v1','tcg_validate_provider_evidence_v1','tcg_validate_catalog_member_v1','tcg_immutable_catalog_evidence_v1','tcg_publish_catalog_snapshot_v1','tcg_require_current_catalog_ref_v1','tcg_require_collection_release_v1','tcg_existing_own_game_item_v1'].map(n=>'dv_collect_private.'+n);
export const publicFunctions=['get_tcg_catalog_release_v1','list_tcg_catalog_sets_v1','search_tcg_catalog_cards_v1','get_tcg_catalog_card_v1','list_tcg_catalog_variants_v1','get_tcg_catalog_readiness_v1','save_my_tcg_collection_item_v1'].map(n=>'public.'+n);
const schemas="('public','dv_market_private','dv_collect_private','dv_v16_private','battle_spectator_private','battle_spectator_media_private')";
const list=names=>names.map(n=>"('"+n+"')").join(',');
export async function queries(){
 const [sq,lq]=await i2Queries();
 const extra=String.raw`
 union all select 'all_trigger',n.nspname||'.'||c.relname||'.'||t.tgname,jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ${schemas}
 union all select 'catalog_constraint',n.nspname||'.'||c.relname||'.'||k.conname,jsonb_build_object('definition',pg_get_constraintdef(k.oid),'validated',k.convalidated,'deferrable',k.condeferrable,'deferred',k.condeferred)
 from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${schemas} and k.contype<>'n'
 union all select 'catalog_index',n.nspname||'.'||c.relname,jsonb_build_object('definition',pg_get_indexdef(c.oid),'valid',i.indisvalid,'ready',i.indisready)
 from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_index i on i.indexrelid=c.oid where n.nspname in ${schemas}
 union all select 'catalog_column',n.nspname||'.'||c.relname||'.'||a.attname,jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl::text,'collation',co.collname)
 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum left join pg_collation co on co.oid=a.attcollation
 where n.nspname in ${schemas} and a.attnum>0 and not a.attisdropped and c.relkind in ('r','p','v','m','S')
 union all select 'root_metadata',n.nspname||'.'||p.proname,jsonb_build_object('owner',r.rolname,'arguments',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),'definer',p.prosecdef,'config',p.proconfig,'volatility',p.provolatile,'language',l.lanname,'acl',p.proacl::text)
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner join pg_language l on l.oid=p.prolang where n.nspname='public' and p.proname in ('get_security_schema_readiness_v1','get_market_legal_schema_readiness_v1')
 union all select 'release_state','dv_collect_private.tcg_catalog_releases',coalesce(jsonb_agg(jsonb_build_object('game_key',r.game_key,'provider_key',r.provider_key,'provider_version',r.provider_version,'activation_contract',r.activation_contract,'scope_sha256',r.scope_sha256,'descriptor_sha256',r.descriptor_sha256,'schema_phase',r.schema_phase,'state',r.state,'source_review',r.source_terms_review_ref is not null,'attribution_review',r.attribution_review_ref is not null) order by game_key collate "C",provider_key collate "C",provider_version collate "C"),'[]'::jsonb) from dv_collect_private.tcg_catalog_releases r
 `;
 const security=sq.replace(' ) select jsonb_agg',extra+' ) select jsonb_agg');
 const legal=lq.replace('),\n required_functions',','+list(tables)+'),\n required_functions').replace('),\n checks as',','+list([...privateFunctions,...publicFunctions])+'),\n checks as');
 assert.notEqual(security,sq);assert.notEqual(legal,lq);return [security,legal];
}
export async function helperSQL(){
 const [sq,lq]=await queries();
 return String.raw`create or replace function dv_collect_private.tcg_catalog_schema_readiness_v1() returns jsonb
 language plpgsql stable security definer set search_path=pg_catalog,public,dv_collect_private as $inventory$
 declare security_inventory jsonb;legal_inventory jsonb;release_row dv_collect_private.tcg_catalog_releases%rowtype;snapshot_row dv_collect_private.tcg_catalog_snapshots%rowtype;catalog_data_ok boolean:=false;
 begin ${sq} into security_inventory;${lq} into legal_inventory;
 select * into strict release_row from dv_collect_private.tcg_catalog_releases where (game_key,provider_key,provider_version)=('magic','scryfall','1');
 if release_row.snapshot_id is not null then
  select * into strict snapshot_row from dv_collect_private.tcg_catalog_snapshots where id=release_row.snapshot_id;
  catalog_data_ok:=(snapshot_row.game_key,snapshot_row.provider_key,snapshot_row.provider_version,snapshot_row.scope_contract,snapshot_row.scope_sha256)=('magic','scryfall','1','magic-collect-catalog-v1','a53ed167751e6ac3bf288864f7991f2b70bc486ec53cb5b9d5e7f7f7440d5aaa')
   and release_row.scope_sha256=snapshot_row.scope_sha256 and release_row.descriptor_sha256='52d7223aa087a90bca1464a8e67b2fe8ae58b272c8c7993803bbad83394d1909'
   and snapshot_row.sealed_at is not null and snapshot_row.accepted_sets>0 and snapshot_row.accepted_cards>0 and snapshot_row.record_count>=snapshot_row.accepted_cards and release_row.release_generation>0
   and (release_row.state<>'active' or release_row.source_terms_review_ref is not null and release_row.attribution_review_ref is not null)
   and snapshot_row.raw_manifest->>'object'='bulk_data' and snapshot_row.raw_manifest->>'type'='all_cards'
   and snapshot_row.raw_manifest->>'id'=snapshot_row.bulk_id::text
   and (snapshot_row.raw_manifest->>'updated_at')::timestamptz=snapshot_row.bulk_updated_at
   and (snapshot_row.raw_manifest->>'compressed_size')::bigint=snapshot_row.compressed_size
   and snapshot_row.raw_manifest->>'uri'='https://api.scryfall.com/bulk-data/'||snapshot_row.bulk_id::text
   and snapshot_row.raw_manifest->>'jsonl_download_uri'=snapshot_row.download_uri
   and (select count(*) from dv_collect_private.tcg_catalog_snapshot_members m where m.snapshot_id=snapshot_row.id)=snapshot_row.accepted_sets+snapshot_row.accepted_cards+snapshot_row.accepted_variants
   and (select count(*) from dv_collect_private.tcg_catalog_snapshot_members m join dv_collect_private.tcg_provider_refs r on r.id=m.provider_ref_id where m.snapshot_id=snapshot_row.id and r.entity_kind='set')=snapshot_row.accepted_sets
   and (select count(*) from dv_collect_private.tcg_catalog_snapshot_members m join dv_collect_private.tcg_provider_refs r on r.id=m.provider_ref_id where m.snapshot_id=snapshot_row.id and r.entity_kind='card')=snapshot_row.accepted_cards
   and (select count(*) from dv_collect_private.tcg_catalog_snapshot_members m join dv_collect_private.tcg_provider_refs r on r.id=m.provider_ref_id where m.snapshot_id=snapshot_row.id and r.entity_kind='variant')=snapshot_row.accepted_variants
   and not exists(select 1 from dv_collect_private.tcg_catalog_snapshot_members m join dv_collect_private.tcg_provider_refs r on r.id=m.provider_ref_id join dv_collect_private.tcg_provider_evidence e on e.id=m.evidence_id where m.snapshot_id=snapshot_row.id
    and ((r.game_key,r.provider_key,r.provider_version) is distinct from ('magic','scryfall','1') or e.provider_ref_id<>r.id
    or (r.entity_kind='card' and not exists(select 1 from dv_collect_private.tcg_catalog_snapshot_members sm join dv_collect_private.tcg_provider_refs sr on sr.id=sm.provider_ref_id join dv_collect_private.tcg_cards c on c.id=r.card_id where sm.snapshot_id=m.snapshot_id and sr.entity_kind='set' and sr.set_id=c.set_id and sr.external_id=e.raw_record->>'set_id'))
    or (r.entity_kind='variant' and not exists(select 1 from dv_collect_private.tcg_catalog_derivations d
      join dv_collect_private.tcg_card_variants cv on cv.id=r.variant_id
      join dv_collect_private.tcg_catalog_snapshot_members cm on cm.snapshot_id=m.snapshot_id
      join dv_collect_private.tcg_provider_refs cr on cr.id=cm.provider_ref_id and cr.entity_kind='card' and cr.card_id=cv.card_id and cr.locale=r.locale
      join dv_collect_private.tcg_provider_evidence ce on ce.id=cm.evidence_id and ce.record_version=e.record_version
      join dv_collect_private.tcg_catalog_snapshot_members rm on rm.snapshot_id=m.snapshot_id and rm.evidence_id=d.reference_evidence_id
      join dv_collect_private.tcg_provider_refs rr on rr.id=rm.provider_ref_id and rr.entity_kind='card' and rr.locale=r.locale
      where d.id=m.derivation_id and d.provider_ref_id=r.id and d.evidence_id=m.evidence_id))));
 end if;
 return jsonb_build_object('security_inventory',security_inventory,'legal_inventory',legal_inventory,'state',release_row.state,'data_compatible',coalesce(catalog_data_ok,false),'snapshot_id',release_row.snapshot_id);
 end$inventory$;
 revoke all on function dv_collect_private.tcg_catalog_schema_readiness_v1() from public,anon,authenticated,service_role;
 `;
}
export const syntheticActive=String.raw`alter table public.collection_items drop constraint collection_items_tcg_check;
 alter table public.collection_items add constraint collection_items_tcg_check check(tcg in ('pokemon','one_piece','other','magic'));
 update dv_collect_private.tcg_games set available=true,collection_ready=true where game_key='magic';
 update dv_collect_private.tcg_catalog_releases set state='active',schema_phase='collect',source_terms_review_ref='sha256:'||repeat('1',64),attribution_review_ref='sha256:'||repeat('2',64) where game_key='magic';`;
export const syntheticSuspended=String.raw`update dv_collect_private.tcg_games set available=false,collection_ready=false where game_key='magic';
 update dv_collect_private.tcg_catalog_releases set state='suspended' where game_key='magic';`;
export async function generate(db){
 await baseline(db);await installI2(db);
 // Deparser qualification must match the fixed inventoryhelper search_path.
 // NOT NULL is bound by catalog_column on both PG17 and PG18.
 await db.exec('set search_path=pg_catalog,public,dv_collect_private');
 const qi=await i2Queries(),before=[];for(const q of qi)before.push((await db.query(q)).rows[0].jsonb_agg);
 const source=await readFile(new URL('../database/tcg-i3-magic-persistence-v1.sql',import.meta.url),'utf8');
 await db.exec(source);const helper=await helperSQL();await db.exec(helper);
 const q=await queries(),states=[];
 const {syntheticSnapshot,stage}=await import('./helpers/tcg-i3-magic-fixture.mjs');
 const sample=syntheticSnapshot();await stage(db,sample);
 await db.query('select dv_collect_private.tcg_publish_catalog_snapshot_v1($1,0)',[sample.stage_header.id]);
 for(let i=0;i<3;i++){
  if(i===1)await db.exec(syntheticActive);if(i===2)await db.exec(syntheticSuspended);
  const inventories=[];for(const query of q)inventories.push((await db.query(query)).rows[0].jsonb_agg);states.push(inventories);
 }
 const allowed=new Set(['seed:dv_collect_private.tcg_games','seed:dv_collect_private.tcg_providers','seed:dv_collect_private.tcg_provider_bindings','relation:public.collection_items','relation:dv_collect_private.collection_item_catalog_links','table:public.collection_items','table:dv_collect_private.collection_item_catalog_links']);
 for(let i=0;i<2;i++)unchangedContract(before[i],states[0][i],allowed);
 const bootstrap=(await db.query(String.raw`select md5(p.prosrc) body,r.rolname owner,pg_get_function_arguments(p.oid) args,pg_get_function_result(p.oid) result,p.proconfig config,p.provolatile volatility,p.prosecdef definer,p.proacl::text acl
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='dv_collect_private' and p.proname='tcg_catalog_schema_readiness_v1'`)).rows[0];
 assert.equal(bootstrap.owner,'postgres');assert.equal(bootstrap.args,'');assert.equal(bootstrap.result,'jsonb');await db.exec('rollback');
 const render=(name,revision,index)=>String.raw`create or replace function public.${name}() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $bridge$
 declare a jsonb;b jsonb;expected jsonb;compatible boolean:=false;
 begin
 select jsonb_build_object('body',md5(p.prosrc),'owner',r.rolname,'args',pg_get_function_arguments(p.oid),'result',pg_get_function_result(p.oid),'config',p.proconfig,'volatility',p.provolatile,'definer',p.prosecdef,'acl',p.proacl::text) into b
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='dv_collect_private' and p.proname='tcg_catalog_schema_readiness_v1';
 if b is distinct from $bootstrap$${JSON.stringify(bootstrap)}$bootstrap$::jsonb then return jsonb_build_object('revision','${revision}','compatible',false);end if;
 a:=dv_collect_private.tcg_catalog_schema_readiness_v1();
 expected:=case a->>'state' when 'foundation' then $foundation$${JSON.stringify(states[0][index])}$foundation$::jsonb when 'active' then $active$${JSON.stringify(states[1][index])}$active$::jsonb when 'suspended' then $suspended$${JSON.stringify(states[2][index])}$suspended$::jsonb end;
 compatible:=coalesce(a->'${index===0?'security_inventory':'legal_inventory'}'=expected,false)${index===1?" and coalesce((public.get_security_schema_readiness_v1()->>'compatible')::boolean,false)":''};
 return jsonb_build_object('revision','${revision}','compatible',compatible);
 exception when others then return jsonb_build_object('revision','${revision}','compatible',false);end$bridge$;
 revoke all on function public.${name}() from public,anon,authenticated,service_role;
 grant execute on function public.${name}() to authenticated;
 `;
 return {sql:'-- TCG-I3 authored FOUNDATION / ACTIVE / SUSPENDED, synthetic authoring only.\n-- Completes the transaction begun by the persistence delta.\n'+helper+render('get_security_schema_readiness_v1','privilege-mfa-v1',0)+render('get_market_legal_schema_readiness_v1','trade-legal-contract-model-v1.2',1)+'commit;\n',counts:states.map(s=>s.map(x=>x.length))};
}
if(process.argv[1]?.endsWith('generate-tcg-i3-magic-readiness.mjs')){
 const {PGlite}=await import('@electric-sql/pglite'),{pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');const db=new PGlite({extensions:{pgcrypto}});
 try{const r=await generate(db),path=new URL('../database/tcg-i3-magic-readiness-v1.sql',import.meta.url);if(process.argv.includes('--check'))assert.equal(await readFile(path,'utf8'),r.sql,'M4 readiness stale');else await writeFile(path,r.sql);console.log('PASS M4 authored targets',JSON.stringify(r.counts),'PGlite preparation, NOT native PG17');}finally{await db.close();}
}
