// Full M3 ID ledger. --native requires the existing localhost PostgreSQL 17 path.
// PGlite preparation is explicitly different from native acceptance.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire,syncBuiltinESMExports} from 'node:module';
import {gzipSync} from 'node:zlib';
import {runInNewContext} from 'node:vm';
import {fixture,card,clone,uuid,syntheticSnapshot,stage,publish,scalar,rollbackCase,database,setup,runNativeRegressions,executionRequirements,upgradeRehearsal} from './helpers/tcg-i3-magic-fixture.mjs';
import {admin,claim,A} from './helpers/publication-hold-fixture.mjs';
import {canonicalJSON,parseProviderJSON,prepareProviderEvidence,sha256,detachedFrozen} from '../tcg-catalog-evidence-v1.mjs';
import {prepareRecords,variantProjection,validateManifest,languages,scope_sha256,descriptor_sha256,prepareSyntheticSnapshot} from '../tcg-catalog-persistence-v1.mjs';
import {readCases,reject,nativePublicationRace} from './tcg-i3-magic-readpath-test.mjs';
import {tables,privateFunctions,syntheticActive,syntheticSuspended,generate,queries} from './generate-tcg-i3-magic-readiness.mjs';
const require=createRequire(import.meta.url),C=require('../tcg-v1-contracts.js'),P=require('../tcg-v1-catalog-providers.js'),G=require('../tcg-v1-game-adapters.js');
const R=require('../tcg-v1-registry.js'),legacyFixture=require('./fixtures/tcg-i3-magic/contract-v1.json').before;
const native=process.argv.includes('--native');
const nativeRegressionReports=native?await runNativeRegressions():[];
const db=await database(native);
const v=(sql,p=[])=>scalar(db,sql,p),count=table=>v('select count(*)::int v from '+table);
const prep=cards=>prepareRecords({sets:[clone(fixture.set)],cards,retrieved_at:'2026-10-04T00:00:00Z'});
const tx=fn=>rollbackCase(db,fn),profile=(extra,expected)=>{const input=card({...extra,id:uuid(100)}),rows=prep([card(),input]);assert.ok(rows.stage_variants.some(v=>v.card_external_id===input.id&&v.treatment===expected));return rows;};
const output={contract:'TCG-I3-M4-test-ledger',version:'1',engine:native?'native-PG17':'PGlite-preparation',node:process.version,acceptance:false,cases:clone(fixture.matrix.cases)};
const snapshot=syntheticSnapshot(),later=(overrides={})=>syntheticSnapshot({time:'2026-10-02T00:00:00Z',...overrides});
const generation=async()=>Number(await v("select release_generation v from dv_collect_private.tcg_catalog_releases where game_key='magic'"));
const state=async()=>({release:await v("select to_jsonb(r) v from dv_collect_private.tcg_catalog_releases r where game_key='magic'"),refs:await v("select jsonb_agg(to_jsonb(r) order by id) v from dv_collect_private.tcg_provider_refs r"),evidence:await count('dv_collect_private.tcg_provider_evidence'),cards:await count('dv_collect_private.tcg_cards')});
async function badPublish(transform,pattern){await tx(async()=>{const s=clone(later());transform(s);const before=await state();await reject(db,async()=>publish(db,s,await generation(),{transaction:false}),pattern);assert.deepEqual(await state(),before);});}
async function drift(sql){await tx(async()=>{await db.exec(sql);assert.equal((await v('select public.get_security_schema_readiness_v1() v')).compatible,false);assert.equal((await v('select public.get_market_legal_schema_readiness_v1() v')).compatible,false);});}
function regression(path,expected){
 const result=execFileSync(process.execPath,['--test','--test-reporter=tap',path],{encoding:'utf8',env:{...process.env,NODE_OPTIONS:(process.env.NODE_OPTIONS||'')+' --import '+new URL('./helpers/tcg-i3-magic-fixture.mjs',import.meta.url).pathname+' --require '+new URL('./helpers/tcg-i2-preload.cjs',import.meta.url).pathname},maxBuffer:32*1024*1024});
 assert.match(result,new RegExp('# tests '+expected+'\\b'));assert.match(result,new RegExp('# pass '+expected+'\\b'));assert.match(result,/# fail 0\b/);assert.match(result,/# skipped 0\b/);return result;
}
async function tradeMagicReject(){
 const source=await readFile(new URL('../trade.js',import.meta.url),'utf8');
 const start=source.indexOf("$('publish').onclick=async()=>"),end=source.indexOf(';async function offerAction',start);
 assert.ok(start>=0&&end>start,'Exact historical publish handler must be present');
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='asking'?'10':'',textContent:''});return nodes.get(id);};let writes=0;
 const context={window:{DV_TCG_V1_CONSUMERS:require('../tcg-v1-consumers.js')},$:get,chosen:{tcg:'magic',id:uuid(999)},editTarget:null,user:{id:A},db:{rpc:()=>{writes++;assert.fail('Magic reached trade RPC');},from:()=>{writes++;assert.fail('Magic reached trade insert');}}};
 runInNewContext(source.slice(start,end),context);await get('publish').onclick();assert.match(get('publishMsg').textContent,/TCG scope unavailable/);assert.equal(writes,0);
}
function legacyParity(game){
 assert.deepEqual(clone(R.get(game)),legacyFixture.descriptors.find(d=>d.game_key===game));
 assert.deepEqual(clone(G[game].recognitionProfile),legacyFixture.profiles[game]);assert.equal(G[game].adapter_version,'1');
 for(const expected of legacyFixture.variants[game])assert.deepEqual(clone(G[game].normalizeVariant(expected.original)),expected);
 const provider=game==='pokemon'?'tcgdex':'optcg';const {provider_key,provider_version,game_key,operations}=P[provider];assert.deepEqual({provider_key,provider_version,game_key,operations},legacyFixture.providers[provider]);
}
const tests={
 S01:async()=>{assert.deepEqual(await v("select to_jsonb(g) v from dv_collect_private.tcg_games g where game_key='magic'"),{game_key:'magic',registry_version:'1',available:false,collection_ready:false,marketplace_ready:false});},
 S02:async()=>assert.deepEqual(await v("select to_jsonb(p) v from dv_collect_private.tcg_providers p where provider_key='scryfall'"),{provider_key:'scryfall',display_name:'Scryfall'}),
 S03:()=>tx(async()=>{assert.equal(await v("select count(*)::int v from dv_collect_private.tcg_provider_bindings where game_key='magic' and provider_key='scryfall' and provider_version='1'"),1);await reject(db,()=>db.exec("insert into dv_collect_private.tcg_provider_bindings values('missing','scryfall','1')"),/foreign key/);}),
 S04:async()=>{const rows=(await db.query('select language_code,locale from dv_collect_private.tcg_languages order by language_code')).rows;assert.equal(rows.length,8);assert.deepEqual(rows.map(r=>[r.language_code,r.locale]),Object.values(languages).sort((a,b)=>a[0]<b[0]?-1:1));},
 S05:async()=>{const b=await database(native);try{await setup(b);const before=await scalar(b,"select jsonb_agg(to_jsonb(g) order by game_key) v from dv_collect_private.tcg_games g");const {install}=await import('./helpers/tcg-i3-magic-fixture.mjs');await install(b);assert.deepEqual(await scalar(b,"select jsonb_agg(to_jsonb(g) order by game_key) v from dv_collect_private.tcg_games g"),before);}finally{await b.close();}},
 S06:()=>drift("update dv_collect_private.tcg_providers set display_name='wrong' where provider_key='scryfall'"),
 S07:()=>drift("update dv_collect_private.tcg_languages set locale='xx' where language_code='CN'"),
 S08:async()=>{const id=await v("select set_id v from dv_collect_private.tcg_provider_refs where game_key='magic' and entity_kind='set'");assert.match(id,/^[a-f0-9-]{36}$/);assert.notEqual(id,fixture.set.id);},
 S09:async()=>{const id=await v("select card_id v from dv_collect_private.tcg_provider_refs where game_key='magic' and entity_kind='card'");assert.notEqual(id,fixture.card.id);assert.notEqual(id,fixture.card.oracle_id);},
 S10:()=>tx(async()=>{await reject(db,()=>db.exec("insert into dv_collect_private.tcg_provider_refs select gen_random_uuid(),game_key,provider_key,provider_version,entity_kind,namespace,external_id,locale,discriminator,record_version,set_id,card_id,variant_id,sealed_product_id from dv_collect_private.tcg_provider_refs where game_key='magic' and entity_kind='set'"),/unique constraint/);assert.equal(await v("select count(*)::int v from dv_collect_private.tcg_provider_refs where game_key='magic' and entity_kind='variant'"),3);}),
 S11:()=>tx(async()=>{const setid=await v("select id v from dv_collect_private.tcg_sets where game_key='magic'");await reject(db,()=>db.query("insert into dv_collect_private.tcg_cards(game_key,set_id,language_code,collector_number,name) values('pokemon',$1,'EN','1','bad')",[setid]),/foreign key/);}),
 S12:()=>badPublish(s=>{const raw=card({collector_number:'changed'});const st=prep([raw]);Object.assign(s,st);s.stage_header.accepted_variants=st.stage_variants.length;},/catalog_identity_conflict/),
 E01:()=>{assert.equal(canonicalJSON({b:1,a:2}),'{"a":2,"b":1}');const e=prepareProviderEvidence(fixture.card),t=P.scryfall.translate(fixture.card,{game_key:'magic',locale:'en',collector:{text:fixture.card.collector_number,source:'manual'},source_path:'api/cards/'+fixture.card.id,retrieved_at:'2026-10-04T00:00:00Z'});assert.equal(t.records[0].source.record_version,e.record_version);assert.equal(canonicalJSON({'\uE000':1,'\u{10000}':2}),'{"𐀀":2,"":1}');},
 E02:()=>{assert.equal(canonicalJSON([null,1]),'[null,1]');assert.notEqual(prepareProviderEvidence({a:[null,1]}).record_version,prepareProviderEvidence({a:[1,null]}).record_version);},
 E03:()=>{assert.equal(canonicalJSON({b:true,n:null,x:-0,d:1.2}),'{"b":true,"d":1.2,"n":null,"x":0}');for(const x of [NaN,Infinity,-Infinity,1n])assert.throws(()=>canonicalJSON({x}));},
 E04:()=>{const s=canonicalJSON({x:'e\u0301'});assert.equal(s,'{"x":"é"}');assert.notEqual(s,canonicalJSON({x:'é'}));assert.ok(!s.endsWith('\n'));assert.equal(sha256(Buffer.from(s)),prepareProviderEvidence({x:'e\u0301'}).content_sha256);},
 E05:()=>{for(const s of ['{"a":1,"a":2}','{"a":{"b":1,"b":2}}','{"a":1,"\\u0061":2}'])assert.throws(()=>parseProviderJSON(s),/duplicate/);},
 E06:()=>{for(const key of ['__proto__','constructor','prototype']){assert.throws(()=>parseProviderJSON('{"x":{"'+key+'":1}}'),/unsafe/);}assert.throws(()=>canonicalJSON(Object.create({a:1})));},
 E07:()=>{let called=false;const x={get a(){called=true;return 1;}};assert.throws(()=>canonicalJSON(x));assert.equal(called,false);for(const a of [undefined,()=>1,Symbol('x')])assert.throws(()=>canonicalJSON({a}));},
 E08:()=>{const s=[];s.length=1;assert.throws(()=>canonicalJSON(s));const a=[1];a.extra=1;assert.throws(()=>canonicalJSON(a));},
 E09:()=>{assert.equal(canonicalJSON(Array(1000).fill(null)).length,5001);assert.throws(()=>canonicalJSON(Array(1001).fill(null)));assert.equal(Buffer.byteLength(canonicalJSON({s:'x'.repeat(1048568)})),1048576);assert.throws(()=>canonicalJSON({s:'x'.repeat(1048569)}));let x=0;for(let i=0;i<19;i++)x={x};canonicalJSON(x);for(let i=0;i<3;i++)x={x};assert.throws(()=>canonicalJSON(x));},
 E10:()=>{for(const x of ['\u0000','\ud800','\udc00'])assert.throws(()=>canonicalJSON({x}));assert.throws(()=>parseProviderJSON(Buffer.from([0xef,0xbb,0xbf,0x7b,0x7d])));},
 E11:()=>{assert.throws(()=>canonicalJSON({n:9007199254740992}));assert.throws(()=>parseProviderJSON('{"n":9007199254740993}'));assert.equal(parseProviderJSON('{"n":9007199254740991}').n,9007199254740991);},
 E12:()=>badPublish(s=>{s.stage_records[0].raw_record.unconsumed={label:'unbound bytes'};},/catalog_stage_evidence_invalid/),
 E13:()=>badPublish(s=>{s.stage_records[0].record_version='2026-10-04';},/catalog_stage_evidence_invalid/),
 E14:()=>tx(async()=>{const before=await count('dv_collect_private.tcg_provider_evidence');await publish(db,later(),await generation(),{transaction:false});assert.equal(await count('dv_collect_private.tcg_provider_evidence'),before);}),
 E15:()=>tx(async()=>{const before=await count('dv_collect_private.tcg_provider_evidence'),ids=await v("select jsonb_agg(id order by id) v from dv_collect_private.tcg_cards");await publish(db,later({cards:[card({unconsumed:{label:'new raw version'}})]}),await generation(),{transaction:false});assert.equal(await count('dv_collect_private.tcg_provider_evidence'),before+4);assert.deepEqual(await v("select jsonb_agg(id order by id) v from dv_collect_private.tcg_cards"),ids);}),
 E16:()=>tx(async()=>{await reject(db,()=>db.exec("insert into dv_collect_private.tcg_provider_evidence select id,provider_ref_id,provider_version,record_version,raw_record,canonical_utf8,content_sha256,source_path,retrieved_at,id from dv_collect_private.tcg_provider_evidence limit 1"),/tcg_supersession_invalid/);await reject(db,()=>db.exec("insert into dv_collect_private.tcg_provider_evidence select gen_random_uuid(),provider_ref_id,provider_version,record_version,raw_record,canonical_utf8,content_sha256,source_path,retrieved_at,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid from dv_collect_private.tcg_provider_evidence limit 1"),/tcg_supersession_invalid/);}),
 E17:()=>tx(async()=>{for(const t of tables.slice(0,4))for(const sql of ['update '+t+' set '+(t.endsWith('members')?'source_path=source_path':'id=id'),'delete from '+t,'truncate '+t])await reject(db,()=>db.exec(sql),/tcg_catalog_evidence_immutable|foreign key/);}),
 E18:()=>{const x=card(),e=prepareProviderEvidence(x);x.unconsumed.label='changed';assert.equal(e.raw_record.unconsumed.label,'raw only');assert.ok(Object.isFrozen(e.raw_record.unconsumed));const st=prep([card()]);assert.throws(()=>{st.stage_variants[0].validated_evidence.reference_printing.frame='1993';});},
 E19:async()=>{assert.equal(await v("select count(*)::int v from dv_collect_private.tcg_catalog_derivations d join dv_collect_private.tcg_provider_evidence e on e.id=d.reference_evidence_id join dv_collect_private.tcg_provider_refs r on r.id=e.provider_ref_id where r.entity_kind='card' and d.validated_evidence#>>'{reference_printing,printing_context,id}'=r.external_id"),3);},
 E20:()=>badPublish(s=>{s.stage_variants[0].validated_evidence.extra={};},/tcg_derivation_shape_invalid/),
 E21:()=>{assert.throws(()=>canonicalJSON({text:'x'.repeat(16384)},16384));assert.throws(()=>C.magicVariantEvidence({...fixture.evidence,version:'2'}));assert.throws(()=>C.magicVariantEvidence({...fixture.evidence,frame_effects:Array(33).fill('unknown')}));},
 E22:()=>tx(async()=>{const before=await v("select jsonb_agg(jsonb_build_array(id,retrieved_at) order by id) v from dv_collect_private.tcg_provider_evidence");const s=clone(later());for(const r of s.stage_records)r.retrieved_at='2026-10-04T01:00:00Z';await publish(db,s,await generation(),{transaction:false});assert.deepEqual(await v("select jsonb_agg(jsonb_build_array(id,retrieved_at) order by id) v from dv_collect_private.tcg_provider_evidence"),before);assert.equal(await v("select count(*)::int v from dv_collect_private.tcg_catalog_snapshot_members where snapshot_id=$1 and retrieved_at='2026-10-04T01:00:00Z'",[s.stage_header.id]),5);}),
 E23:async()=>{const rows=(await db.query("select a.attname from pg_attribute a where a.attrelid=any($1::regclass[]) and a.attnum>0 and not a.attisdropped",[tables])).rows;assert.ok(rows.length>60);assert.ok(rows.every(r=>!['user_id','owner_id','collection_item_id','listing_id','order_id'].includes(r.attname)));},
 E24:()=>tx(async()=>{for(const role of ['anon','authenticated','service_role']){await claim(db,A,role);for(const t of tables)await reject(db,()=>db.exec('select * from '+t),/permission denied/);for(const f of ['tcg_catalog_schema_readiness_v1()','tcg_validate_provider_evidence_v1()','tcg_immutable_catalog_evidence_v1()'])await reject(db,()=>db.exec('select dv_collect_private.'+f),/permission denied/);}}),
 C01:async()=>assert.equal(await v("select count(*)::int v from dv_collect_private.tcg_card_variants v join dv_collect_private.tcg_cards c on c.id=v.card_id join dv_collect_private.tcg_sets s on s.id=c.set_id where (s.game_key,c.game_key,v.game_key)=('magic','magic','magic') and c.language_code=v.language_code"),3),
 C02:()=>{for(const n of ['001','1★','1s','313z','S-001'])assert.equal(prep([card({collector_number:n})]).stage_cards[0].collector_number,n);},
 C03:()=>{const cards=Object.keys(languages).map((lang,i)=>card({id:uuid(200+i),lang,printed_name:'Printed '+lang}));const st=prep(cards);assert.equal(st.stage_cards.length,8);assert.equal(new Set(st.stage_cards.map(r=>r.external_id)).size,8);for(const r of st.stage_cards)assert.deepEqual([r.language_code,r.locale],languages[r.provider_lang]);},
 C04:()=>{assert.equal(prep([card({lang:'de',printed_name:'Druckname'})]).stage_cards[0].name,'Druckname');assert.throws(()=>prep([card({lang:'de'})]),/card_validation/);},
 C05:()=>assert.equal(prep([card()]).stage_variants.find(v=>v.finish==='nonfoil').treatment,'normal'),
 C06:()=>assert.equal(prep([card()]).stage_variants.find(v=>v.finish==='foil').treatment,'normal'),
 C07:()=>{assert.equal(prep([card()]).stage_variants.find(v=>v.finish==='etched').treatment,'normal');const result=G.magic.normalizeVariant({variant:'',rarity:'',name:'',set:''},variantProjection(card({frame_effects:['etched']})));assert.equal(result.finish,null);},
 C08:()=>{for(const finishes of [['nonfoil'],['nonfoil','foil']]){const result=G.magic.normalizeVariant({variant:'',rarity:'',name:'',set:''},variantProjection(card({finishes})));assert.equal(result.status,'unknown');assert.equal(result.finish,null);}},
 C09:()=>assert.ok(prep([card()]).stage_variants.every(v=>v.treatment==='normal')),
 C10:()=>profile({border_color:'borderless',full_art:true},'borderless'),
 C11:()=>profile({frame_effects:['extendedart']},'extended_art'),
 C12:()=>profile({frame_effects:['showcase']},'showcase'),
 C13:()=>{const st=profile({frame:'1993',reprint:true,released_at:'2026-01-01'},'retro_frame');assert.ok(st.stage_variants.some(v=>v.validated_evidence.reference_kind==='earlier_modern_standard'));assert.equal(prep([card({frame:'1993'})]).stage_variants.length,0);},
 C14:()=>{const st=profile({promo_types:['prerelease','datestamped']},'prerelease_stamp');assert.deepEqual(st.stage_variants.filter(v=>v.card_external_id===uuid(100)).map(v=>v.finish),['foil']);},
 C15:()=>{for(const frame_effects of [['shatteredglass'],['showcase','extendedart']]){const st=prep([card({frame_effects})]);assert.equal(st.stage_cards.length,1);assert.equal(st.stage_variants.length,0);}},
 C16:()=>{assert.ok(prep([card()]).stage_variants.every(v=>v.artwork==='normal'));const st=profile({frame_effects:['showcase'],illustration_id:uuid(77)},'showcase');assert.ok(st.stage_variants.some(v=>v.artwork==='alternate_art'));},
 C17:()=>{const st=prep([card(),card({id:uuid(2),illustration_id:uuid(3)}),card({id:uuid(4),frame_effects:['showcase']})]);assert.equal(st.stage_variants.filter(v=>v.card_external_id===uuid(4)).length,0);},
 C18:()=>{for(const layout of ['normal','split','flip','adventure','transform','modal_dfc']){const raw=card({layout});if(layout!=='normal')raw.card_faces=[{name:'Front',illustration_id:uuid(2)},{name:'Back',illustration_id:uuid(3)}];assert.equal(prep([raw]).stage_cards.length,1);}},
 C19:()=>{const raw=card({layout:'flip',card_faces:[{name:'Front',illustration_id:uuid(2)},{name:'Back',illustration_id:uuid(3)}]});assert.equal(prep([raw]).stage_variants.length,0);},
 C20:()=>{for(const layout of ['normal','transform'])assert.throws(()=>prep([card({layout,card_faces:[{name:'x'}]})]),/card_scope/);},
 C21:()=>{for(const layout of ['meld','reversible_card','token','emblem','double_faced_token','art_series','planar','scheme','vanguard','host','augment']){const st=prep([card(),card({id:uuid(12),layout})]);assert.equal(st.stage_cards.length,1);assert.equal(st.excluded.length,1);}},
 C22:()=>{for(const layout of ['saga','battle','prepare','front_card','unknown'])assert.equal(prep([card(),card({id:uuid(12),layout})]).excluded.length,1);},
 C23:()=>{for(const x of [{digital:true},{oversized:true},{games:['arena']}])assert.equal(prep([card(),card({id:uuid(12),...x})]).excluded.length,1);},
 C24:()=>{for(const set_type of ['commander','masters','secret_lair','promo','universes_beyond']){const set={...clone(fixture.set),set_type};const st=prepareRecords({sets:[set],cards:[card()],retrieved_at:'2026-10-04T00:00:00Z'});assert.equal(st.stage_sets.length,1);assert.ok(st.stage_records.every(r=>r.entity_kind!=='sealed'));}},
 C25:()=>{assert.equal(prep([card()]).stage_cards[0].rarity,'magic:mythic');assert.throws(()=>prep([card({rarity:'foil'})]),/card_scope/);},
 C26:()=>{const st=prep([card({promo_types:['serialized']})]);assert.equal(st.stage_cards[0].external_id,fixture.card.id);assert.equal(st.stage_variants.length,0);assert.equal(st.stage_records[1].raw_record.promo_types[0],'serialized');},
 C27:()=>badPublish(s=>{Object.assign(s,later({cards:[card({border_color:'borderless'}),card({id:uuid(250)})]}));},/catalog_variant_identity_conflict/),
 C28:()=>tx(async()=>{const before=await count('dv_collect_private.tcg_card_variants');const s=later({cards:[card({frame_effects:['unknown']})]});await publish(db,s,await generation(),{transaction:false});assert.equal(await count('dv_collect_private.tcg_card_variants'),before);assert.equal(await v("select count(*)::int v from dv_collect_private.tcg_catalog_snapshot_members m join dv_collect_private.tcg_provider_refs p on p.id=m.provider_ref_id where m.snapshot_id=$1 and p.entity_kind='variant'",[s.stage_header.id]),0);}),
 I01:()=>{assert.equal(snapshot.stage_header.bulk_type,'all_cards');assert.equal(snapshot.stage_header.format,'gzip_jsonl');assert.throws(()=>validateManifest({...snapshot.stage_header.raw_manifest,type:'default_cards'}));},
 I02:()=>{for(const jsonl_download_uri of ['http://data.scryfall.io/all-cards/all-cards-20261001000000.jsonl.gz','https://evil.invalid/all-cards/all-cards-20261001000000.jsonl.gz',snapshot.stage_header.download_uri+'?key=x','https://user@data.scryfall.io/all-cards/all-cards-20261001000000.jsonl.gz'])assert.throws(()=>validateManifest({...snapshot.stage_header.raw_manifest,jsonl_download_uri}));},
 I03:()=>{for(const k of ['compressed_sha256','jsonl_sha256','sets_response_sha256','manifest_sha256','scope_sha256'])assert.match(snapshot.stage_header[k],/^[0-9a-f]{64}$/);assert.equal(snapshot.stage_header.scope_sha256,scope_sha256);assert.equal(snapshot.stage_header.manifest_sha256,sha256(Buffer.from(canonicalJSON(snapshot.stage_header.raw_manifest))));},
 I04:()=>{assert.throws(()=>validateManifest({...snapshot.stage_header.raw_manifest,compressed_size:1073741825}));assert.throws(()=>canonicalJSON({data:'x'.repeat(1048576)}));const bytes=Buffer.from('bad gzip');assert.throws(()=>prepareSyntheticSnapshot({snapshot_id:uuid(4),manifest:{...snapshot.stage_header.raw_manifest,compressed_size:bytes.length},compressed_bytes:bytes,sets_response_bytes:Buffer.from('{}'),retrieved_at:'2026-10-04T00:00:00Z'}),/gzip_integrity/);},
 I05:()=>{for(const line of ['{"object":"card","object":"card"}','{"object":"card"']){const bytes=gzipSync(Buffer.from(line));assert.throws(()=>prepareSyntheticSnapshot({snapshot_id:uuid(4),manifest:{...snapshot.stage_header.raw_manifest,compressed_size:bytes.length},compressed_bytes:bytes,sets_response_bytes:Buffer.from('{}'),retrieved_at:'2026-10-04T00:00:00Z'}));}},
 I06:()=>tx(async()=>{const before=await state();assert.equal(await publish(db,snapshot,await generation(),{transaction:false}),snapshot.stage_header.id);assert.deepEqual(await state(),before);}),
 I07:()=>tx(async()=>{await reject(db,async()=>publish(db,syntheticSnapshot({time:'2026-09-30T00:00:00Z'}),await generation(),{transaction:false}),/catalog_snapshot_older/);}),
 I08:()=>tx(async()=>{await reject(db,async()=>publish(db,syntheticSnapshot({cards:[card({name:'changed'})]}),await generation(),{transaction:false}),/catalog_snapshot_time_conflict/);}),
 I09:()=>badPublish(s=>{s.stage_variants.at(-1).validated_evidence.extra=true;},/tcg_derivation_shape_invalid/),
 I10:()=>nativePublicationRace(db),
 I11:()=>tx(async()=>{await reject(db,()=>publish(db,later(),0,{transaction:false}),/catalog_generation_stale/);}),
 I12:()=>{const st=prep([card(),card()]);assert.equal(st.duplicates.length,1);assert.equal(st.stage_cards.length,1);assert.throws(()=>prep([card(),card({lang:'de',printed_name:'Druckname'})]),/catalog_identity_conflict/);},
 I13:()=>{assert.throws(()=>prepareRecords({sets:[],cards:[card()],retrieved_at:'2026-10-04T00:00:00Z'}),/catalog_set_conflict/);},
 I14:()=>tx(async()=>{const before=await count('dv_collect_private.tcg_provider_refs');const s=later({cards:[card({id:uuid(300),oracle_id:uuid(301)})]});await publish(db,s,await generation(),{transaction:false});assert.equal(await count('dv_collect_private.tcg_provider_refs'),before+4);assert.equal(await v("select count(*)::int v from dv_collect_private.tcg_catalog_snapshot_members m join dv_collect_private.tcg_provider_refs p on p.id=m.provider_ref_id where m.snapshot_id=$1 and p.external_id=$2",[s.stage_header.id,fixture.card.id]),0);}),
 I15:()=>{for(const kind of ['merge','deleted','replaced'])assert.throws(()=>prepareRecords({sets:[fixture.set],cards:[card()],retrieved_at:'2026-10-04T00:00:00Z',migrations:[{kind}]}),/provider_migration_review_required/);},
 I16:async()=>{const before=await state();assert.throws(()=>prep([]),/empty_snapshot/);assert.deepEqual(await state(),before);},
 I17:async()=>{
  let requests=0;const fail=()=>{requests++;throw Error('FORBIDDEN_IO');},originals=[];
  const set=(obj,key)=>{originals.push([obj,key,obj[key]]);obj[key]=fail;};
  set(globalThis,'fetch');for(const [name,keys] of Object.entries({'node:http':['request','get'],'node:https':['request','get'],'node:net':['connect','createConnection'],'node:tls':['connect'],'node:dns':['lookup','resolve']})){const m=require(name);for(const key of keys)set(m,key);}
  for(const key of ['WebSocket','XMLHttpRequest'])set(globalThis,key);
  syncBuiltinESMExports();
  try{const e=await import('../tcg-catalog-evidence-v1.mjs?offline'),p=await import('../tcg-catalog-persistence-v1.mjs?offline');assert.ok(e.prepareProviderEvidence(card()).record_version);assert.equal(p.prepareRecords({sets:[fixture.set],cards:[card()],retrieved_at:'2026-10-04T00:00:00Z'}).stage_cards.length,1);assert.equal(requests,0);}finally{for(const [obj,key,value] of originals)obj[key]=value;syncBuiltinESMExports();}
 },
 R01:async()=>{const b=await database(native);try{const {baseline,install}=await import('./helpers/tcg-i2-fixture.mjs');await baseline(b);await install(b);assert.equal((await scalar(b,'select public.get_security_schema_readiness_v1() v')).compatible,true);assert.equal(await scalar(b,"select to_regclass('dv_collect_private.tcg_provider_evidence') v"),null);}finally{await b.close();}},
 R02:()=>drift('drop function public.list_tcg_catalog_variants_v1(text,uuid,text)'),
 R03:async()=>{assert.equal((await v('select public.get_security_schema_readiness_v1() v')).compatible,true);await claim(db,A);const r=await v('select public.get_tcg_catalog_readiness_v1() v');assert.equal(r.schema_compatible,true);assert.equal(r.activation_compatible,false);assert.equal(r.state,'foundation');await admin(db);},
 R04:()=>drift('grant select(raw_record) on dv_collect_private.tcg_provider_evidence to authenticated'),
 R05:()=>drift('alter table dv_collect_private.tcg_catalog_snapshots disable row level security'),
 R06:()=>drift('alter table dv_collect_private.tcg_catalog_snapshot_members drop constraint tcg_catalog_snapshot_members_evidence_id_provider_ref_id_fkey'),
 R07:()=>drift("insert into dv_collect_private.tcg_provider_bindings values('pokemon','scryfall','1')"),
 R08:()=>drift("create or replace function dv_collect_private.tcg_catalog_schema_readiness_v1() returns jsonb language sql stable security definer set search_path=pg_catalog,public,dv_collect_private as $$select '{}'::jsonb$$"),
 R09:()=>drift('alter table dv_collect_private.tcg_provider_evidence disable trigger tcg_catalog_immutable_rows'),
 R10:async()=>{const s=await v('select public.get_security_schema_readiness_v1() v'),l=await v('select public.get_market_legal_schema_readiness_v1() v');assert.equal(s.revision,'privilege-mfa-v1');assert.equal(l.revision,'trade-legal-contract-model-v1.2');assert.equal(s.compatible,true);assert.equal(l.compatible,true);},
 R11:()=>{for(const path of ['database/tcg-i2-canonical-integration-v1.sql','database/tcg-i2-readiness-v1.sql','tests/tcg-i2-database-test.mjs','tests/generate-tcg-i2-readiness.mjs','database/account-erasure-l1-v1.sql'])assert.equal(execFileSync('git',['diff','--numstat','70db8cde7b7ce244d10800eb0ffd1e0cfd44eaf4','--',path],{encoding:'utf8'}),'');},
 R12:()=>tx(async()=>{await db.exec(syntheticActive);assert.equal((await v('select public.get_security_schema_readiness_v1() v')).compatible,true);await db.exec(syntheticSuspended);assert.equal((await v('select public.get_security_schema_readiness_v1() v')).compatible,true);await db.exec("update dv_collect_private.tcg_games set available=true where game_key='magic'");assert.equal((await v('select public.get_security_schema_readiness_v1() v')).compatible,false);}),
 R13:()=>tx(async()=>{await db.query("insert into dv_collect_private.tcg_catalog_snapshots select (jsonb_populate_record(null::dv_collect_private.tcg_catalog_snapshots,to_jsonb(s)||jsonb_build_object('id',$1::text,'compressed_sha256',repeat('0',64)))).* from dv_collect_private.tcg_catalog_snapshots s",[uuid(998)]);await db.query("update dv_collect_private.tcg_catalog_releases set snapshot_id=$1 where game_key='magic'",[uuid(998)]);await claim(db,A);const r=await v('select public.get_tcg_catalog_readiness_v1() v');assert.equal(r.schema_compatible,true);assert.equal(r.data_compatible,false);assert.equal(r.activation_compatible,false);await admin(db);await db.exec("update dv_collect_private.tcg_catalog_releases set snapshot_id=null where game_key='magic'");await claim(db,A);assert.equal((await v('select public.get_tcg_catalog_readiness_v1() v')).data_compatible,false);}),
 R14:async()=>{const report=await upgradeRehearsal(native);assert.deepEqual(report.map(r=>r.existing),[false,true]);assert.deepEqual(report.map(r=>r.legacy_rows),[0,2]);},
 X01:()=>legacyParity('pokemon'),
 X02:()=>legacyParity('one_piece'),
 X03:async()=>{const result=regression('tests/tcg-v1-foundation-test.mjs',237);if(process.env.TCG_M4_EVIDENCE_DIR)await writeFile(process.env.TCG_M4_EVIDENCE_DIR+'/foundation237.tap',result);},
 X04:async()=>{const result=regression('tests/tcg-i2-consumers-test.mjs',19);if(process.env.TCG_M4_EVIDENCE_DIR)await writeFile(process.env.TCG_M4_EVIDENCE_DIR+'/consumers19.tap',result);},
 X05:()=>{assert.equal(native,true);assert.equal(nativeRegressionReports.filter(r=>r.id==='X05'&&r.status==='PASS').length,1);},
 X06:()=>{if(native)assert.equal(nativeRegressionReports.filter(r=>r.id==='X06'&&r.status==='PASS').length,6);for(const path of ['database/account-erasure-l1-v1.sql','database/account-data-export-collect-battle-v1.sql','database/publication-processing-hold-v1.sql'])assert.equal(execFileSync('git',['diff','--numstat','70db8cde7b7ce244d10800eb0ffd1e0cfd44eaf4','--',path],{encoding:'utf8'}),'');},
 X07:async()=>{if(native)assert.equal(nativeRegressionReports.filter(r=>r.id==='X07'&&r.status==='PASS').length,2);const def=await v("select pg_get_functiondef('dv_collect_private.delete_empty_binder(uuid)'::regprocedure) v");assert.match(def,/collection_items/);assert.match(def,/auth.uid/);assert.equal(execFileSync('git',['diff','--numstat','70db8cde7b7ce244d10800eb0ffd1e0cfd44eaf4','--','collect.html','collect-ux.js'],{encoding:'utf8'}),'');},
 X08:async()=>{assert.equal(execFileSync('git',['diff','--numstat','70db8cde7b7ce244d10800eb0ffd1e0cfd44eaf4','--','trade.js','trade.html'],{encoding:'utf8'}),'');assert.ok(!(await v("select pg_get_constraintdef(oid) v from pg_constraint where conname='market_listings_tcg_check'")).includes('magic'));await tradeMagicReject();},
 X09:()=>{for(const path of ['package.json','package-lock.json'])assert.equal(execFileSync('git',['diff','--numstat','70db8cde7b7ce244d10800eb0ffd1e0cfd44eaf4','--',path],{encoding:'utf8'}),'');assert.equal(execFileSync('git',['diff','--name-status','70db8cde7b7ce244d10800eb0ffd1e0cfd44eaf4','--','.github/workflows'],{encoding:'utf8'}),'M\t.github/workflows/scanner-v16-check.yml\n');assert.equal(fixture.matrix.total,159);},
};
Object.assign(tests,readCases(db,{native}));
try{
 assert.equal(fixture.matrix.total,159);assert.equal(Object.keys(tests).length,150);
 const run=fixture.matrix.cases.filter(c=>c.phase==='M4_SYNTHETIC_OFFLINE');assert.deepEqual(Object.keys(tests).sort(),run.map(c=>c.id).sort());
 await setup(db);await publish(db,snapshot,0);
 for(const c of output.cases){
  if(c.phase!=='M4_SYNTHETIC_OFFLINE'){c.status='SPECIFIED_NOT_RUN';continue;}
  Object.assign(c,executionRequirements(tests[c.id]));
  if(!native&&!c.pglite_precheck_executable){c.status='NATIVE_NOT_RUN';c.precheck='NOT_APPLICABLE';console.log('NATIVE_NOT_RUN '+c.id);continue;}
  await admin(db);
  try{await tests[c.id]();c.status=native||c.classification==='NON_NATIVE_EXECUTABLE'?'PASS':'NATIVE_NOT_RUN';c.precheck=native?'NATIVE_EXECUTED':'PASS';console.log(c.status+' '+c.id+' '+c.name+(c.status==='NATIVE_NOT_RUN'?' [PGlite precheck PASS]':''));}
  catch(e){c.status='FAIL';c.error=e.message;output.status='FAIL';throw e;}
 }
 await admin(db);assert.equal(await v("select state v from dv_collect_private.tcg_catalog_releases where game_key='magic'"),'foundation');
 output.status=native?'LOCAL_NATIVE_PASS':'IMPLEMENTED_AND_PRECHECKED_NATIVE_PG17_PENDING';output.acceptance=native;output.authoring_complete=true;output.classification_counts=Object.fromEntries(['NON_NATIVE_EXECUTABLE','REQUIRES_NATIVE_PG17'].map(k=>[k,run.filter(c=>executionRequirements(tests[c.id]).classification===k).length]));
}finally{
 output.counts=Object.fromEntries([...new Set(output.cases.map(c=>c.status))].map(s=>[s,output.cases.filter(c=>c.status===s).length]));
 if(process.env.TCG_M4_EVIDENCE_DIR){await mkdir(process.env.TCG_M4_EVIDENCE_DIR,{recursive:true});await writeFile(process.env.TCG_M4_EVIDENCE_DIR+'/m4-159-ledger.json',JSON.stringify(output,null,2)+'\n');}
 console.log(JSON.stringify({status:output.status,counts:output.counts,node:process.version,engine:output.engine,acceptance:output.acceptance}));await db.close();
}
