// Offline SOURCE acceptance. I19 requires a separately authorized real run.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {fixture,clone,card,uuid,sandbox,sourceFixture,recordingDB,forbidExternalIO} from './helpers/tcg-i3-magic-source-fixture.mjs';
import {createScryfallSource,validateSourceURL,selectManifest,setsPageFraming,cleanupTemporary,jsonlRecords,parseSetsPage,LIMITS,DAY,RETENTION,boundedLimits} from '../tcg-catalog-scryfall-source-v1.mjs';
import {prepareAcquisition,publishPrepared,ingestAcquisition,runRealSourceAcceptance,STAGE_SQL} from '../tcg-catalog-ingest-worker-v1.mjs';
import {prepareRecords,prepareSyntheticSnapshot} from '../tcg-catalog-persistence-v1.mjs';
import {canonicalJSON,sha256} from '../tcg-catalog-evidence-v1.mjs';
const require=createRequire(import.meta.url),P=require('../tcg-v1-catalog-providers.js'),R=require('../tcg-v1-registry.js');
const io=forbidExternalIO(),tests=[];
const add=(id,name,run)=>tests.push({id,name,run});
const source=fx=>createScryfallSource(fx);
const context={game_key:'magic',locale:'en',collector:{text:fixture.card.collector_number,source:'manual'},source_path:fixture.manifest.jsonl_download_uri,retrieved_at:fixture.clock};
async function acquired(fn,options={}){return sandbox(async tempDir=>{const fx=sourceFixture(options),acq=await source(fx).acquire({tempDir});try{return await fn({fx,acq,tempDir});}finally{await acq.finish({published:false});}});}
async function rejected(pattern,options={},extra={}){return sandbox(async tempDir=>{const fx=sourceFixture(options);await assert.rejects(createScryfallSource({...fx,...extra}).acquire({tempDir}),pattern);return fx;});}
const rows=async file=>(await readFile(file,'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const prepare=async acq=>prepareAcquisition(acq.envelope,{snapshot_id:fixture.snapshot_id});
add('I18','Pure exact bulk source URL is candidate, genuine provenance, no transport',()=>{
 const result=P.scryfall.translate(card(),context);assert.equal(result.status,'candidates');assert.equal(result.records[0].legacy.catalogVerified,false);assert.equal(result.records[0].source.source_path,context.source_path);assert.equal(result.records[0].ref.namespace,'api/cards');
 assert.deepEqual(P.scryfall.operations,{search:'record_translation_only',getSet:'record_translation_only',getCard:'record_translation_only',listVariants:'record_translation_only'});assert.equal(P.scryfall.importRecords,undefined);
});
add('M5_01','Exactly one all_cards metadata record',()=>{
 const manifest={...fixture.manifest,compressed_size:23};assert.deepEqual(selectManifest(Buffer.from(JSON.stringify({object:'list',has_more:false,data:[{type:'oracle_cards'},manifest]}))),manifest);
 const select=m=>selectManifest(Buffer.from(JSON.stringify({object:'list',has_more:false,data:[m]})));
 const timestamp='2026-10-03T09:18:18.757',utcManifest={...manifest,updated_at:timestamp+'+00:00'};
 assert.equal(select({...manifest,updated_at:timestamp+'Z'}).updated_at,timestamp+'Z');
 const accepted=select(utcManifest);assert.deepEqual(accepted,utcManifest);assert.equal(accepted.updated_at,timestamp+'+00:00');
 assert.equal(sha256(Buffer.from(canonicalJSON(accepted,65536),'utf8')),sha256(Buffer.from(canonicalJSON(utcManifest,65536),'utf8')));
 for(const zone of ['+01:00','-01:00','-00:00',''])assert.throws(()=>select({...manifest,updated_at:timestamp+zone}),/utc_time/);
 for(const updated_at of ['2026-10-03 09:18:18.757Z','2026-10-03T09:18:18.7570Z','2026-10-03T09:18Z','not-a-dateZ'])assert.throws(()=>select({...manifest,updated_at}),/utc_time/);
 for(const data of [[],[manifest,manifest]])assert.throws(()=>selectManifest(Buffer.from(JSON.stringify({object:'list',has_more:false,data}))),/one_all_cards/);
 assert.throws(()=>selectManifest(Buffer.from(JSON.stringify({object:'list',has_more:true,data:[manifest]}))),/manifest_list/);
});
add('M5_02','Wrong origins and unsafe URL components reject before transport',async()=>{
 for(const u of ['http://data.scryfall.io/all-cards/all-cards-20261003000000.jsonl.gz','https://evil.invalid/all-cards/all-cards-20261003000000.jsonl.gz','https://user@data.scryfall.io/all-cards/all-cards-20261003000000.jsonl.gz','https://data.scryfall.io:444/all-cards/all-cards-20261003000000.jsonl.gz',context.source_path+'?x=1',context.source_path+'#x',context.source_path.replace('20261003000000','123'),'https://data.scryfall.io/all-cards/all-cards-20261003000000.jsonl.gz\n']){
  assert.throws(()=>validateSourceURL(u,'bulk'));assert.throws(()=>P.scryfall.translate(card(),{...context,source_path:u}));await rejected(/bulk_origin|source_origin/,{manifest:{jsonl_download_uri:u}});
 }
 for(const url of ['https://evil.invalid/sets','https://user@api.scryfall.com/sets','https://api.scryfall.com:443/sets','https://api.scryfall.com/sets?page=2','https://api.scryfall.com/sets#x','https://api.scryfall.com/cards/search'])assert.throws(()=>validateSourceURL(url,'sets'));
});
add('M5_03','Redirect status and response URL redirects fail closed',async()=>{
 for(const event of [{status:302,headers:{location:'https://evil.invalid'}},{redirected:true},{url:'https://evil.invalid/sets'}]){const fx=await rejected(/redirect/,{schedule:[event]});assert.equal(fx.calls.length,1);}
});
add('M5_04','Compressed size mismatch rejects snapshot',async()=>{await rejected(/compressed_size/,{manifest:{compressed_size:1}});await rejected(/compressed_size_mismatch/,{manifest:{compressed_size:100000}});});
add('M5_05','1 GiB compressed guard and immutable lower-only test ceilings',async()=>{
 assert.equal(LIMITS.compressed,1073741824);assert.equal(LIMITS.decompressed,17179869184);assert.equal(LIMITS.lines,5000000);assert.equal(LIMITS.line,1048576);assert.equal(LIMITS.sets,67108864);assert.ok(Object.isFrozen(LIMITS));assert.throws(()=>boundedLimits({compressed:1073741825}));
 await rejected(/compressed_size/,{manifest:{compressed_size:1073741825}});await rejected(/compressed_size/,{}, {limits:{compressed:10}});
});
add('M5_06','Gzip corruption and truncation checked by stream inflater',async()=>{
 const fx=sourceFixture();const corrupt=Buffer.from(fx.gzip);corrupt[corrupt.length-8]^=1;await rejected(/gzip_integrity/,{compressed:corrupt});await rejected(/gzip_integrity/,{compressed:fx.gzip.subarray(0,-3)});
});
add('M5_07','Strict UTF-8 including split-byte chunks and BOM',async()=>{
 await rejected(/utf8/,{jsonl:Buffer.from([123,34,120,34,58,34,255,34,125,10])});await rejected(/bom/,{jsonl:Buffer.concat([Buffer.from([239,187,191]),Buffer.from(JSON.stringify(card())+'\n')])});
 await acquired(async({acq})=>assert.equal(acq.envelope.record_count,1),{chunkSize:1});
});
add('M5_08','JSON array file reject',async()=>{await rejected(/jsonl_object/,{jsonl:JSON.stringify([card()])});});
add('M5_09','Malformed JSONL and duplicate decoded keys reject entire acquisition',async()=>{
 for(const jsonl of [JSON.stringify(card())+'\n{"object":"card"',JSON.stringify(card())+'\n{"object":"card","object":"card"}\n'])await rejected(/json_syntax|duplicate_key/,{jsonl});
});
add('M5_10','Empty line reject; final newline and CRLF supported',async()=>{
 await rejected(/empty_line/,{jsonl:JSON.stringify(card())+'\n\n'});await rejected(/empty_snapshot/,{jsonl:''});await acquired(async({acq})=>assert.equal(acq.envelope.record_count,1),{jsonl:JSON.stringify(card())+'\r\n'});
});
add('M5_11','Record >1 MiB rejects without collecting bulk',async()=>{await rejected(/record_size/,{jsonl:JSON.stringify({...card(),large:'x'.repeat(1048576)})+'\n'});});
add('M5_12','Streaming decompressed byte and line count ceilings',async()=>{await rejected(/decompressed_size/,{}, {limits:{decompressed:100}});await rejected(/line_count/,{cards:[card(),card()]},{limits:{lines:1}});});
add('M5_13','Complete ordered sets pagination with genuine page provenance',()=>acquired(async({fx,acq})=>{
 assert.equal(acq.envelope.pages.length,2);assert.deepEqual(acq.envelope.pages.map(p=>p.order),[1,2]);assert.deepEqual(fx.calls.map(c=>c.url),['https://api.scryfall.com/bulk-data',...fixture.pages.map(p=>p.url),context.source_path]);
 const p=await prepare(acq),raw=await rows(p.files.records);assert.equal(raw.find(x=>x.entity_kind==='set').source_path,fixture.pages[0].url);assert.equal(raw.find(x=>x.entity_kind==='card').source_path,context.source_path);
}));
add('M5_14','Unsafe next_page and pagination cycles reject',async()=>{
 for(const next_page of ['https://evil.invalid/sets','https://api.scryfall.com:444/sets','https://u@api.scryfall.com/sets','https://api.scryfall.com/sets#x','https://api.scryfall.com/sets?q=x','https://api.scryfall.com/sets']){
  const pages=[{url:fixture.pages[0].url,raw:JSON.stringify({object:'list',has_more:true,next_page,data:[fixture.set]})}];await rejected(/origin|pagination_cycle/,{pages});
 }
});
add('M5_15','Versioned deterministic page framing matches independent fixture digest',()=>{
 const pages=fixture.pages.map(p=>({url:p.url,bytes:Buffer.from(p.raw)}));const actual=setsPageFraming(pages);assert.equal(actual,fixture.framing.expected_sha256);assert.equal(setsPageFraming(pages),actual);assert.notEqual(setsPageFraming([...pages].reverse()),actual);assert.notEqual(setsPageFraming([{url:pages[0].url,bytes:Buffer.concat(pages.map(p=>p.bytes))}]),actual);
});
add('M5_16','24h manifest and set cache; boundary forces new acquisition',()=>sandbox(async tempDir=>{
 const fx=sourceFixture(),worker=source(fx);let a=await worker.acquire({tempDir});await a.finish({published:false});const first=fx.calls.length;
 fx.advance(DAY-1001);a=await worker.acquire({tempDir});assert.equal(a.envelope.cache_hit,true);assert.equal(fx.calls.length-first,1);await a.finish({published:false});fx.advance(1001);
 a=await worker.acquire({tempDir});assert.equal(a.envelope.cache_hit,false);assert.equal(fx.calls.length-first,5);await a.finish({published:false});
}));
add('M5_17','One successful new snapshot/day; idempotent reuse does not consume a new day',()=>sandbox(async tempDir=>{
 const fx=sourceFixture(),worker=source(fx);let a=await worker.acquire({tempDir});await a.finish({published:true,reused:true,snapshot_id:fixture.snapshot_id});a=await worker.acquire({tempDir});await a.finish({published:true,snapshot_id:fixture.snapshot_id});const before=fx.calls.length;
 await assert.rejects(worker.acquire({tempDir}),/daily_snapshot_limit/);assert.equal(fx.calls.length,before);fx.advance(DAY);a=await worker.acquire({tempDir});await a.finish({published:false});
}));
add('M5_18','429 minimum30s and longer Retry-After honored without real sleep',async()=>{
 for(const [header,expected] of [['1',30000],['45',45000],['Sun, 04 Oct 2026 00:01:00 GMT',60000]])await sandbox(async tempDir=>{
  const fx=sourceFixture({schedule:[{status:429,headers:{'retry-after':header}}]}),a=await source(fx).acquire({tempDir});assert.equal(a.envelope.attempt,2);assert.ok(fx.delays.includes(expected));assert.ok(fx.calls[1].at-fx.calls[0].at>=expected);await a.finish({published:false});
 });
});
add('M5_19','Max three whole-acquisition network attempts, no fourth retry',async()=>{
 const fx=await rejected(/acquisition_attempts_exhausted/,{schedule:[{status:429},{status:429},{status:429}]});assert.equal(fx.calls.length,3);assert.deepEqual(fx.delays,[30000,30000,30000]);
 await rejected(/acquisition_attempts_exhausted/,{schedule:[{error:true},{error:true},{error:true}]});
});
add('M5_20','Identifying headers, credentials omitted, API rate <=1/s and robust rate clock',async()=>{
 const evidence=[];
 await acquired(async({fx})=>{
  const calls=fx.calls.filter(c=>c.url.startsWith('https://api.scryfall.com'));for(let i=1;i<calls.length;i++)assert.ok(calls[i].at-calls[i-1].at>=1000);for(const c of fx.calls){assert.match(c.options.headers['User-Agent'],/^DUELVANTA\//);assert.ok(c.options.headers.Accept);assert.equal(c.options.credentials,'omit');assert.equal(c.options.redirect,'manual');}
  evidence.push({scenario:'NORMAL_LEGACY_CLOCK_INJECTION',api_starts:calls.map(c=>c.at),delays:fx.delays,status:'PASS'});
 });
 for(const scenario of ['EARLY_WAKEUP','WALLCLOCK_BACKWARD','MONOTONIC_BACKWARD','FROZEN_RATE_CLOCK','NONFINITE_RATE_CLOCK'])await sandbox(async tempDir=>{
  const fx=sourceFixture(),api_starts=[],delays=[];let monotonic=0;
  const transport=async(url,options)=>{if(url.startsWith('https://api.scryfall.com'))api_starts.push({rate:monotonic,wall:fx.clock()});const response=await fx.transport(url,options);
   if(api_starts.length===1){if(scenario==='WALLCLOCK_BACKWARD')fx.advance(-3600000);if(scenario==='MONOTONIC_BACKWARD')monotonic=-1;}
   return response;
  };
  const sleep=async ms=>{assert.ok(ms>0);delays.push(ms);const progress=scenario==='FROZEN_RATE_CLOCK'?0:scenario==='EARLY_WAKEUP'&&delays.length===1?ms-7:ms;await fx.sleep(ms);monotonic+=progress;};
  const worker=createScryfallSource({...fx,transport,sleep,rateClock:()=>scenario==='NONFINITE_RATE_CLOCK'?NaN:monotonic});
  if(['MONOTONIC_BACKWARD','FROZEN_RATE_CLOCK','NONFINITE_RATE_CLOCK'].includes(scenario)){
   await assert.rejects(worker.acquire({tempDir}),/^TypeError: TCG source: clock_rate$/);assert.equal(api_starts.length,scenario==='NONFINITE_RATE_CLOCK'?0:1);assert.equal(fx.calls.length,api_starts.length);
   assert.deepEqual(delays,scenario==='FROZEN_RATE_CLOCK'?[1000]:[]);
  }else{
   const a=await worker.acquire({tempDir});try{
    assert.equal(api_starts.length,3);for(let i=1;i<api_starts.length;i++)assert.ok(api_starts[i].rate-api_starts[i-1].rate>=1000);
    assert.deepEqual(delays,scenario==='EARLY_WAKEUP'?[1000,7,1000]:[1000,1000]);
    if(scenario==='WALLCLOCK_BACKWARD'){assert.ok(api_starts[1].wall<api_starts[0].wall);assert.equal(a.envelope.requests[0].started_at,new Date(api_starts[0].wall).toISOString());assert.equal(a.envelope.requests[1].started_at,new Date(api_starts[1].wall).toISOString());}
   }finally{await a.finish({published:false});}
  }
  evidence.push({scenario,api_starts,delays,status:'PASS'});
 });
 if(process.env.TCG_M5_EVIDENCE_DIR){await mkdir(process.env.TCG_M5_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.TCG_M5_EVIDENCE_DIR,'M5_20-regressions.json'),JSON.stringify(evidence,null,2)+'\n');}
});
add('M5_21','Download cleanup older7d, keep exactly7d, durable digest receipt retained',()=>sandbox(async tempDir=>{
 const fx=sourceFixture(),w=source(fx),a=await w.acquire({tempDir});await a.finish({published:true,snapshot_id:fixture.snapshot_id});fx.advance(RETENTION);assert.deepEqual(await cleanupTemporary(tempDir,{clock:fx.clock}),[]);fx.advance(1);assert.equal((await cleanupTemporary(tempDir,{clock:fx.clock})).length,1);assert.ok(await stat(join(tempDir,'dv-scryfall-source-v1','last-success.json')));
}));
add('M5_22','Equal duplicate digest once with explicit finding and correct counts',()=>acquired(async({acq})=>{
 const p=await prepare(acq);assert.equal(p.counts.duplicates,1);assert.equal(p.counts.accepted_cards,1);assert.equal(p.counts.record_count,1);assert.equal((await rows(p.findings_file))[0].kind,'duplicate_equal_digest');
},{cards:[card(),card()]}));
add('M5_23','Conflicting duplicate raw or language rejects entire preparation',async()=>{
 for(const conflict of [card({name:'conflict'}),card({lang:'de',printed_name:'Druck'})])await acquired(async({acq})=>assert.rejects(prepare(acq),/catalog_identity_conflict/),{cards:[card(),conflict]});
});
add('M5_24','Missing set fails closed with no per-card repair or DB write',()=>acquired(async({acq,fx})=>{
 await assert.rejects(prepare(acq),/missing_set/);assert.equal(fx.calls.length,4);
},{cards:[card({set_id:uuid(99)})]}));
add('M5_25','Explicit exclusion counts for languages layouts digital oversized paper',()=>acquired(async({acq})=>{
 const p=await prepare(acq);assert.equal(p.counts.accepted_cards,1);assert.equal(p.counts.excluded,6);assert.deepEqual(p.counts.excluded_by_reason,{language:2,layout:1,digital:1,oversized:1,not_paper:1});assert.equal((await rows(p.findings_file)).length,6);
},{cards:[card(),card({id:uuid(10),lang:'pt'}),card({id:uuid(11),lang:'zht'}),card({id:uuid(12),layout:'battle'}),card({id:uuid(13),digital:true}),card({id:uuid(14),oversized:true}),card({id:uuid(15),games:['arena']} )]}));
add('M5_26','Malformed in-scope record, set contradiction and missing printed name reject',async()=>{
 for(const extra of [{digital:'false'},{rarity:'foil'},{set:'wrong'},{lang:'de'},{games:null}])await acquired(async({acq})=>assert.rejects(prepare(acq)),{cards:[card(extra)]});
});
add('M5_27','Actual second-page set provenance and bulk provenance preserved',()=>acquired(async({acq})=>{
 const p=await prepare(acq),r=await rows(p.files.records);assert.equal(r.find(x=>x.entity_kind==='set').source_path,fixture.pages[1].url);assert.equal(r.find(x=>x.entity_kind==='card').source_path,context.source_path);
},{cards:[card({set_id:JSON.parse(fixture.pages[1].raw).data[0].id,set:'zzn',set_name:'Second Synthetic Set'})]}));
add('M5_28','No image downloads/prices/extra requests; placeholder and root-null image projection',async()=>{
 await acquired(async({fx,acq})=>{
  const p=await prepare(acq);assert.ok(fx.calls.every(c=>c.url===context.source_path||c.url==='https://api.scryfall.com/bulk-data'||fixture.pages.some(p=>p.url===c.url)));const projection=await rows(p.files.cards);assert.ok(!('image' in projection[0])&&!('prices' in projection[0]));assert.ok((await rows(p.files.records)).find(r=>r.entity_kind==='card').raw_record.prices);
 });
 const root='https://example.invalid/root.png',front='https://example.invalid/front.png',evidence=[];
 const transform=extra=>card({layout:'transform',card_faces:[{name:'Synthetic Front',image_status:'highres_scan',image_uris:{normal:front}},{name:'Synthetic Back'}],...extra});
 const cases=[
  ['A_PLACEHOLDER_WITH_ROOT',card({image_status:'placeholder',image_uris:{normal:root}}),null],
  ['B_ROOT_MISSING_WITH_FRONT',transform({image_status:'missing',image_uris:{normal:root}}),null],
  ['C_ROOT_PLACEHOLDER_WITH_FRONT',transform({image_status:'placeholder',image_uris:{normal:root}}),null],
  ['D_ALLOWED_FRONT_FALLBACK',transform({image_status:'highres_scan'}),front],
  ['D_ABSENT_ROOT_STATUS_FALLBACK',transform(),front],
  ['E_HIGHRES_ROOT_UNCHANGED',card({image_status:'highres_scan',image_uris:{normal:root}}),root]
 ];
 for(const [scenario,raw,expected] of cases){
  if(scenario.startsWith('D_')){delete raw.image_uris;if(scenario==='D_ABSENT_ROOT_STATUS_FALLBACK')delete raw.image_status;}
  const before=clone(raw),result=P.scryfall.translate(raw,context);assert.equal(result.status,'candidates');assert.deepEqual(raw,before);assert.deepEqual(result.original,before);
  for(const record of result.records){assert.deepEqual(record.raw,before);assert.equal(record.legacy.image,expected);assert.equal(record.normalized.image,expected);assert.equal(record.source.record_version,'sha256:'+sha256(Buffer.from(canonicalJSON(before))));}
  evidence.push({scenario,status:result.status,legacy_image:result.records[0].legacy.image,normalized_image:result.records[0].normalized.image,raw_unchanged:true,record_version:result.records[0].source.record_version});
 }
 assert.throws(()=>P.scryfall.translate(card({image_status:'future_image_status',image_uris:{normal:root}}),context),/^TypeError: TCG contract: unsupported value future_image_status$/);
 evidence.push({scenario:'F_UNKNOWN_STATUS_REJECT',status:'PASS'});
 // Null projection still validates every supplied consumed root/face URL.
 for(const image_status of ['missing','placeholder'])for(const raw of [card({image_status,image_uris:{normal:root,art_crop:'http://example.invalid/unsafe.png'}}),transform({image_status,card_faces:[{name:'Synthetic Front',image_uris:{normal:'http://example.invalid/unsafe.png'}},{name:'Synthetic Back'}]})])assert.throws(()=>P.scryfall.translate(raw,context),/unsafe image/);
 await acquired(async({acq})=>{const p=await prepare(acq);assert.equal(p.counts.accepted_cards,1);assert.deepEqual((await rows(p.files.records)).find(r=>r.entity_kind==='card').raw_record,card({image_status:'placeholder',image_uris:{normal:root}}));},{cards:[card({image_status:'placeholder',image_uris:{normal:root}})]});
 evidence.push({scenario:'PLACEHOLDER_PREPARE_AND_URL_VALIDATION',status:'PASS'});
 if(process.env.TCG_M5_EVIDENCE_DIR){await mkdir(process.env.TCG_M5_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.TCG_M5_EVIDENCE_DIR,'M5_28-regressions.json'),JSON.stringify(evidence,null,2)+'\n');}
});
add('M5_29','Five exact stage shapes, fixed order, owner preflight then one transaction/publisher',()=>acquired(async({acq})=>{
 const p=await prepare(acq),db=recordingDB();const result=await publishPrepared(db,p);assert.equal(result.expected_generation,'7');assert.equal(result.snapshot_id,fixture.snapshot_id);assert.equal(db.calls[1].sql,'begin');assert.equal(db.calls.at(-1).sql,'commit');assert.equal(db.calls.filter(c=>c.sql==='begin').length,1);assert.equal(db.calls.filter(c=>c.sql.includes('select dv_collect_private.tcg_publish_catalog_snapshot_v1')).length,1);
 const names=db.calls.filter(c=>c.sql.startsWith('insert')).map(c=>c.sql.match(/stage_(\w+)/)[1]);assert.deepEqual([...new Set(names)],['header','sets','cards','variants','records']);assert.equal((STAGE_SQL.match(/create temporary table/g)||[]).length,5);assert.equal((STAGE_SQL.match(/on commit drop/g)||[]).length,5);
 const pub=db.calls.find(c=>c.sql.includes('select dv_collect_private.tcg_publish_catalog_snapshot_v1'));assert.deepEqual(pub.params,[fixture.snapshot_id,'7']);assert.equal(db.rowsByStage.cards.length,1);assert.equal(db.rowsByStage.variants.length,3);assert.equal(db.rowsByStage.records.length,2);
}));
add('M5_30','Rollback on stage failure, publisher failure, stale generation, commit error',async()=>{
 for(const failAt of ['stage_cards(', 'select dv_collect_private.tcg_publish_catalog_snapshot_v1','commit'])await acquired(async({acq})=>{
  const db=recordingDB({failAt});await assert.rejects(publishPrepared(db,await prepare(acq)),/injected failure/);assert.equal(db.calls.at(-1).sql,'rollback');assert.equal(db.state().published,false);
 });
 await acquired(async({acq})=>{const db=recordingDB();const original=db.query;db.query=async(sql,params)=>{if(sql.includes('select dv_collect_private.tcg_publish_catalog_snapshot_v1'))throw Error('catalog_generation_stale');return original(sql,params);};await assert.rejects(publishPrepared(db,await prepare(acq)),/catalog_generation_stale/);assert.equal(db.calls.at(-1).sql,'rollback');assert.equal(db.calls.filter(c=>c.sql==='begin').length,1);});
});
add('M5_31','Owner postgres and PG17/readiness preflight mandatory',async()=>{
 for(const configuration of [{owner:'service_role'},{owner:'authenticated'},{major:16}])await acquired(async({acq})=>{const db=recordingDB(configuration);await assert.rejects(publishPrepared(db,await prepare(acq)),/owner_or_readiness/);assert.equal(db.calls.length,1);});
});
add('M5_32','Older snapshot preflight rejects before transaction',()=>acquired(async({acq})=>{
 const db=recordingDB({snapshot:{bulk_updated_at:'2026-10-04T00:00:00Z'}});await assert.rejects(publishPrepared(db,await prepare(acq)),/catalog_snapshot_older/);assert.equal(db.calls.length,1);
}));
add('M5_33','Equal provider time with changed bulk or set bytes rejects',async()=>{
 for(const key of ['compressed_sha256','sets_response_sha256','bulk_id'])await acquired(async({acq})=>{
  const p=await prepare(acq),old={...p.header,[key]:key==='bulk_id'?uuid(300):'0'.repeat(64)};const db=recordingDB({snapshot:old});await assert.rejects(publishPrepared(db,p),/catalog_snapshot_time_conflict/);assert.equal(db.calls.length,1);
 });
});
add('M5_34','Identical snapshot reuse result comes from publisher, generation bound unchanged',()=>acquired(async({acq})=>{
 const p=await prepare(acq),db=recordingDB({snapshot:{...p.header,id:uuid(70)}}),result=await publishPrepared(db,p);assert.equal(result.reused,true);assert.equal(result.snapshot_id,uuid(70));assert.equal(result.expected_generation,'7');
}));
add('M5_35','Explicit fresh preflight required on every retry; no generation auto-retry',()=>acquired(async({acq})=>{
 const p=await prepare(acq),db=recordingDB({generation:'8'});await publishPrepared(db,p);assert.deepEqual(db.calls.find(c=>c.sql.includes('select dv_collect_private.tcg_publish_catalog_snapshot_v1')).params,[fixture.snapshot_id,'8']);
}));
add('M5_36','Migration is explicit review_required, no alias heuristic',()=>acquired(async({acq})=>assert.rejects(prepareAcquisition(acq.envelope,{migrations:[{kind:'merge'}]}),/provider_migration_review_required/)));
add('M5_37','No credentials, caller identifier, log secrets or new login interface',async()=>{
 const code=await readFile(new URL('../tcg-catalog-ingest-worker-v1.mjs',import.meta.url),'utf8');assert.ok(!/process\.env|createClient|password|connectionString/.test(code));assert.ok(!/\bfetch\s*\(/.test(code));
 await sandbox(async tempDir=>{const fx=sourceFixture({schedule:[{error:true},{error:true},{error:true}]});await assert.rejects(source(fx).acquire({tempDir}),/attempts_exhausted/);const root=join(tempDir,'dv-scryfall-source-v1');for(const name of (await readdir(root)).filter(n=>n.startsWith('acq-')))assert.ok(!(await readFile(join(root,name,'reject-report.json'),'utf8')).includes('injected secret'));});
});
add('M5_38','Acquisition/JSONL tampering rejects before DB',()=>acquired(async({acq})=>{
 await writeFile(acq.envelope.jsonl_file,JSON.stringify(card({name:'tampered'}))+'\n');await assert.rejects(prepare(acq),/acquisition_digest/);
}));
add('M5_39','Prepared stage tampering rejected before BEGIN',()=>acquired(async({acq})=>{
 const p=await prepare(acq),db=recordingDB();await writeFile(p.files.cards,'{}\n');await assert.rejects(publishPrepared(db,p),/prepared_digest/);assert.equal(db.calls.length,1);
}));
add('M5_40','Same-snapshot external reference selection matches whole-array M4 preparation',()=>acquired(async({acq})=>{
 const p=await prepare(acq),actual=await rows(p.files.variants),expected=prepareRecords({sets:[fixture.set],cards:[card(),card({id:uuid(80),frame_effects:['showcase'],illustration_id:uuid(81)})],source_path:context.source_path,set_source_paths:{[fixture.set.id]:fixture.pages[0].url},retrieved_at:acq.envelope.completed_at}).stage_variants;
 assert.deepEqual(actual.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))),clone(expected).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));assert.ok(actual.some(v=>v.artwork==='alternate_art'));
},{cards:[card(),card({id:uuid(80),frame_effects:['showcase'],illustration_id:uuid(81)})]}));
add('M5_41','Conflicting reference illustrations do not silently select first',()=>acquired(async({acq})=>{
 const p=await prepare(acq),v=await rows(p.files.variants);assert.equal(v.filter(v=>v.card_external_id===uuid(83)).length,0);
},{cards:[card(),card({id:uuid(82),illustration_id:uuid(88)}),card({id:uuid(83),frame_effects:['showcase']})]}));
add('M5_42','Earlier-modern retro reference, latest date and equivalent smallest UUID',()=>acquired(async({acq})=>{
 const p=await prepare(acq),v=await rows(p.files.variants),retro=v.filter(v=>v.card_external_id===uuid(92));assert.equal(retro.length,3);assert.ok(retro.every(v=>v.reference_external_id===uuid(90)&&v.treatment==='retro_frame'));
},{cards:[card(),card({id:uuid(91),released_at:'2025-02-01'}),card({id:uuid(90),released_at:'2025-02-01'}),card({id:uuid(92),frame:'1993',reprint:true,released_at:'2026-01-01'})]}));
add('M5_43','All eight languages, six layouts, long collector TEXT remain explicit',()=>acquired(async({acq})=>{
 const p=await prepare(acq),c=await rows(p.files.cards);assert.equal(c.length,8+5);assert.equal(c.find(c=>c.external_id===fixture.card.id).collector_number,fixture.card.collector_number);assert.ok(c.some(c=>c.provider_lang==='zhs'&&c.locale==='zh-cn'&&c.language_code==='CN'));
},{cards:[...['en','de','fr','it','es','ja','ko','zhs'].map((lang,i)=>card(i?{id:uuid(100+i),lang,printed_name:'Printed '+lang}:{})),...['split','flip','adventure','transform','modal_dfc'].map((layout,i)=>card({id:uuid(120+i),layout,card_faces:[{name:'Front',illustration_id:uuid(150)},{name:'Back',illustration_id:uuid(151)}]}))]}));
add('M5_44','Set responses total64MiB ceiling and malformed response fail closed',async()=>{
 await rejected(/response_size/,{}, {limits:{sets:10}});await rejected(/sets_page/,{pages:[{url:fixture.pages[0].url,raw:'{"object":"list","has_more":false,"data":[{"object":"card"}]}'}]});
});
add('M5_45','Full ingest success and failure release lease, aborted downloads retained for cleanup',()=>sandbox(async tempDir=>{
 const fx=sourceFixture(),s=source(fx);let a=await s.acquire({tempDir});const db=recordingDB({failAt:'stage_cards('});await assert.rejects(ingestAcquisition(a,{client:db,snapshot_id:fixture.snapshot_id}),/injected failure/);a=await s.acquire({tempDir});const result=await ingestAcquisition(a,{client:recordingDB(),snapshot_id:uuid(200)});assert.equal(result.counts.accepted_cards,1);await assert.rejects(s.acquire({tempDir}),/daily_snapshot_limit/);
}));
add('M5_46','External preparation files stay outside repository',async()=>{
 const fx=sourceFixture();await assert.rejects(source(fx).acquire({tempDir:new URL('./tmp-provider-data',import.meta.url).pathname}),/repository_provider_data/);assert.equal(fx.calls.length,0);
});
add('M5_47','Real I19 entrypoint prepared and unexecuted; import starts no acquisition',()=>{assert.equal(typeof runRealSourceAcceptance,'function');assert.equal(io.attempts(),0);});
add('M5_48','Synthetic M4 output remains byte/semantically identical',async()=>{
 const {pathToFileURL}=require('node:url');await sandbox(async tempDir=>{
  const base=execFileSync('git',['show','83391852a0bccf3b0bd05613162f5810b250ee80:tcg-catalog-persistence-v1.mjs'],{encoding:'utf8'}).replaceAll("'./tcg-catalog-evidence-v1.mjs'",JSON.stringify(new URL('../tcg-catalog-evidence-v1.mjs',import.meta.url).href)).replaceAll("require('./tcg-v1-contracts.js')",'require('+JSON.stringify(new URL('../tcg-v1-contracts.js',import.meta.url).pathname)+')').replaceAll("require('./tcg-v1-game-adapters.js')",'require('+JSON.stringify(new URL('../tcg-v1-game-adapters.js',import.meta.url).pathname)+')').replaceAll("require('./tcg-v1-catalog-providers.js')",'require('+JSON.stringify(new URL('../tcg-v1-catalog-providers.js',import.meta.url).pathname)+')');
  const file=join(tempDir,'base.mjs');await writeFile(file,base);const before=await import(pathToFileURL(file));const fx=sourceFixture(),input={snapshot_id:fixture.snapshot_id,manifest:fx.manifest,compressed_bytes:fx.gzip,sets_response_bytes:Buffer.from(JSON.stringify({object:'list',has_more:false,data:[fixture.set]})),retrieved_at:fixture.clock};
  assert.equal(JSON.stringify(prepareSyntheticSnapshot(input)),JSON.stringify(before.prepareSyntheticSnapshot(input)));
 });
});
add('M5_49','Magic product descriptor remains planned and all languages/providers/capabilities locked',()=>{
 const d=R.get('magic');assert.equal(d.status,'planned');assert.deepEqual(d.providers,[]);assert.ok(Object.values(d.supported_languages).every(v=>v.length===0));assert.ok(Object.values(d.capabilities).every(v=>v.status==='unsupported'));assert.ok(Object.values(d.variant_capabilities).every(v=>v.status==='unsupported'&&v.codes.length===0));
});
add('M5_50','Forbidden external I/O = zero attempts',()=>assert.equal(io.attempts(),0));
add('M5_51','Cleanup removes expired raw metadata and preserves acquisition/preparation receipts',()=>sandbox(async tempDir=>{
 const fx=sourceFixture(),w=source(fx),a=await w.acquire({tempDir});await prepare(a);const name=a.envelope.jsonl_file.split('/').at(-2);await a.finish({published:false});fx.advance(RETENTION+1);await cleanupTemporary(tempDir,{clock:fx.clock});
 await assert.rejects(stat(join(tempDir,'dv-scryfall-source-v1','metadata-cache.json')),/ENOENT/);
 const receipt=JSON.parse(await readFile(join(tempDir,'dv-scryfall-source-v1','receipts',name+'.json'),'utf8'));assert.equal(receipt.envelope.compressed_sha256,sha256(fx.gzip));assert.equal(receipt.preparations[0].counts.accepted_cards,1);assert.equal(receipt.envelope.sets_response_sha256,fixture.framing.expected_sha256);
}));
add('M5_52','DB sealed snapshot enforces daily limit across operator directories; 24h boundary permits new snapshot',()=>acquired(async({acq})=>{
 const p=await prepare(acq),clock=()=>Date.parse(fixture.clock),old={...p.header,bulk_updated_at:'2026-10-02T00:00:00Z',sealed_at:'2026-10-03T23:00:00Z'};
 const db=recordingDB({snapshot:old});await assert.rejects(publishPrepared(db,p,{clock}),/daily_snapshot_limit/);assert.equal(db.calls.length,1);
 await publishPrepared(recordingDB({snapshot:{...old,sealed_at:'2026-10-03T00:00:00Z'}}),p,{clock});
}));
add('M5_53','Streaming transport exceptions cannot leak credentials into caller errors or retained reports',()=>sandbox(async tempDir=>{
 const fx=sourceFixture({schedule:[{bodyError:true}]});await assert.rejects(source(fx).acquire({tempDir}),/acquisition_stream/);const root=join(tempDir,'dv-scryfall-source-v1');
 for(const name of (await readdir(root)).filter(n=>n.startsWith('acq-')))assert.ok(!(await readFile(join(root,name,'reject-report.json'),'utf8')).includes('SECRET_MUST_NOT_LOG'));
}));
add('M5_54','Aggregate set list can exceed 1000 records while per-record JSON limits stay strict',()=>acquired(async({acq})=>{
 const p=await prepare(acq);assert.equal(p.counts.accepted_sets,1);assert.equal(p.counts.accepted_cards,1);
},{pages:[{url:'https://api.scryfall.com/sets',raw:JSON.stringify({object:'list',has_more:false,data:[fixture.set,...Array.from({length:1001},(_,i)=>({...fixture.set,id:uuid(1000+i)}))]})}]}));
add('M5_55','Set aggregate parser preserves raw objects and rejects duplicate keys, unsafe keys and malformed envelopes',()=>{
 const set={...fixture.set,name:'String with },] and "quotes" \\ newline\n',extra:{safe:[null,true,1]}};const raw=JSON.stringify({data:[set],object:'list',has_more:false});assert.deepEqual(clone(parseSetsPage(Buffer.from(raw)).data[0]),set);
 for(const raw of ['{"object":"list","object":"list","has_more":false,"data":[]}','{"object":"list","has_more":false,"data":[],"data":[]}','{"object":"list","has_more":false,"data":[{"object":"set","id":1,"id":2}]}','{"object":"list","has_more":false,"data":[{"object":"set","constructor":1}]}','{"object":"list","has_more":false,"data":[{"object":"set"},]}','{"object":"list","has_more":false,"data":[]} extra'])assert.throws(()=>parseSetsPage(Buffer.from(raw)));
 assert.throws(()=>parseSetsPage(Buffer.from(JSON.stringify({object:'list',has_more:false,data:[{...set,extra:Array(1001).fill(null)}]}))),/array_limit/);
});
add('M5_56','Third 429 completes minimum cooldown before STOP, including next operator attempt',()=>sandbox(async tempDir=>{
 const fx=sourceFixture({schedule:[{status:429},{status:429},{status:429}]}),worker=source(fx);await assert.rejects(worker.acquire({tempDir}),/attempts_exhausted/);const last=fx.calls.at(-1).at;
 assert.ok(fx.clock()-last>=30000);const a=await worker.acquire({tempDir});assert.ok(fx.calls[3].at-last>=30000);await a.finish({published:false});
}));
const ledger={contract:'TCG-I3-M5-local-source-ledger',version:'1',engine:'injected-local-transport/recording-DB-sequence',real_source_acquisition:false,native_acceptance:false,cases:[],source_cases:[],activation:fixture.later.activation.map(id=>({id,status:'SPECIFIED_NOT_RUN'}))};
try{
 for(const c of tests){try{await c.run();ledger.cases.push({id:c.id,name:c.name,status:'PASS'});console.log('PASS '+c.id+' '+c.name);}catch(e){ledger.cases.push({id:c.id,name:c.name,status:'FAIL',error:e.message,stack:e.stack});console.error('FAIL '+c.id+' '+e.stack);}}
 ledger.forbidden_external_io_attempts=io.attempts();ledger.counts={PASS:ledger.cases.filter(c=>c.status==='PASS').length,FAIL:ledger.cases.filter(c=>c.status==='FAIL').length};ledger.source_cases=[{id:'I18',status:ledger.cases.find(c=>c.id==='I18').status},{id:'I19',status:'REAL_SOURCE_NOT_RUN',harness:'runRealSourceAcceptance',executed:false}];
 ledger.status=ledger.counts.FAIL||io.attempts()?'FAIL':'IMPLEMENTED_AND_PRECHECKED_REAL_SOURCE_PENDING';if(ledger.status==='FAIL')process.exitCode=1;
 if(process.env.TCG_M5_EVIDENCE_DIR){await mkdir(process.env.TCG_M5_EVIDENCE_DIR,{recursive:true});await writeFile(join(process.env.TCG_M5_EVIDENCE_DIR,'m5-local-ledger.json'),JSON.stringify(ledger,null,2)+'\n');}
 console.log(JSON.stringify({status:ledger.status,counts:ledger.counts,source_cases:ledger.source_cases,forbidden_external_io_attempts:io.attempts()}));
}finally{io.restore();}
