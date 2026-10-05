// Operator connection only. Disk preparation precedes the one publication transaction.
// No network, credentials, activation, canonical-ID allocation or new DB schema.
import {createHash,randomUUID} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,appendFile,open,stat,realpath} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createInterface} from 'node:readline';
import {createRequire} from 'node:module';
import {canonicalJSON,parseProviderJSON,prepareProviderEvidence,sha256} from './tcg-catalog-evidence-v1.mjs';
import {prepareRecords,variantProjection,selectReference,validateManifest,scope_sha256,languages} from './tcg-catalog-persistence-v1.mjs';
import {jsonlRecords,setsPageFraming,validateSourceURL,parseSetsPage,LIMITS,SETS_FRAMING,DAY} from './tcg-catalog-scryfall-source-v1.mjs';
const fail=code=>{throw new TypeError('TCG ingest: '+code);};
const uuid=id=>{if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))fail('uuid');return id;};
const layouts=['normal','split','flip','adventure','transform','modal_dfc'];
const require=createRequire(import.meta.url),C=require('./tcg-v1-contracts.js'),G=require('./tcg-v1-game-adapters.js'),P=require('./tcg-v1-catalog-providers.js');
// Observers cannot change ingest outcomes, including by throwing/rejecting.
function diagnostic(callback,checkpoint,phase,fields={}){
 if(!callback)return;
 try{const pending=callback({checkpoint,phase,...fields});if(pending&&typeof pending.catch==='function')pending.catch(()=>{});}catch{}
}
export const STAGE_SQL=`
 create temporary table tcg_catalog_stage_header(
 id uuid,game_key text,provider_key text,provider_version text,bulk_id uuid,bulk_type text,bulk_updated_at timestamptz,download_uri text,format text,compressed_size bigint,compressed_sha256 text,jsonl_sha256 text,sets_response_sha256 text,manifest_sha256 text,raw_manifest jsonb,scope_contract text,scope_sha256 text,retrieved_at timestamptz,record_count bigint,accepted_cards bigint,accepted_variants bigint,accepted_sets bigint,sealed_at timestamptz) on commit drop;
 create temporary table tcg_catalog_stage_sets(external_id uuid primary key,name text not null,record_version text not null) on commit drop;
 create temporary table tcg_catalog_stage_cards(external_id uuid primary key,set_external_id uuid not null references tcg_catalog_stage_sets,provider_lang text not null,language_code text not null,locale text not null,collector_number text not null,name text not null,rarity text not null,record_version text not null) on commit drop;
 create temporary table tcg_catalog_stage_variants(card_external_id uuid not null references tcg_catalog_stage_cards,locale text not null,finish text not null,artwork text not null,treatment text not null,edition text,validated_evidence jsonb not null,evidence_sha256 text not null,reference_external_id uuid not null references tcg_catalog_stage_cards,reference_record_version text not null,primary key(card_external_id,locale,finish)) on commit drop;
 create temporary table tcg_catalog_stage_records(entity_kind text not null check(entity_kind in ('set','card')),external_id uuid not null,locale text,raw_record jsonb not null,canonical_utf8 bytea not null,content_sha256 text not null,record_version text not null,source_path text not null,retrieved_at timestamptz not null,unique nulls not distinct(entity_kind,external_id,locale)) on commit drop;
`;
const shapes=Object.freeze({
 header:['id','game_key','provider_key','provider_version','bulk_id','bulk_type','bulk_updated_at','download_uri','format','compressed_size','compressed_sha256','jsonl_sha256','sets_response_sha256','manifest_sha256','raw_manifest','scope_contract','scope_sha256','retrieved_at','record_count','accepted_cards','accepted_variants','accepted_sets','sealed_at'],
 sets:['external_id','name','record_version'],cards:['external_id','set_external_id','provider_lang','language_code','locale','collector_number','name','rarity','record_version'],
 variants:['card_external_id','locale','finish','artwork','treatment','edition','validated_evidence','evidence_sha256','reference_external_id','reference_record_version'],
 records:['entity_kind','external_id','locale','raw_record','canonical_utf8','content_sha256','record_version','source_path','retrieved_at']
});
const inserts=Object.freeze(Object.fromEntries(Object.entries(shapes).map(([k,cols])=>[k,'insert into pg_temp.tcg_catalog_stage_'+k+'('+cols.join(',')+') values('+cols.map((_,i)=>'$'+(i+1)).join(',')+')'])));
async function insert(client,kind,row){const cols=shapes[kind];if(!cols||Object.keys(row).length!==cols.length||cols.some(k=>!Object.hasOwn(row,k)))fail('stage_projection');return client.query(inserts[kind],cols.map(k=>k==='canonical_utf8'?Buffer.from(row[k],'utf8'):row[k]!==null&&typeof row[k]==='object'?JSON.stringify(row[k]):row[k]));}
async function hashFile(path,max){const h=createHash('sha256');let n=0;for await(const b of createReadStream(path)){n+=b.length;if(n>max)fail('file_size');h.update(b);}return {bytes:n,sha256:h.digest('hex')};}
async function* lines(path){const input=createReadStream(path);const reader=createInterface({input,crlfDelay:Infinity});try{for await(const line of reader){if(line)yield line;}}finally{reader.close();input.destroy();}}
async function writeJSON(path,value){await writeFile(path,JSON.stringify(value)+'\n',{flag:'wx',mode:0o600});}
async function indexPath(root,kind,id){uuid(id);const dir=join(root,kind,id.slice(0,2));await mkdir(dir,{recursive:true,mode:0o700});return join(dir,id+'.json');}
function exclusion(r,context,set){
 if(typeof r.digital!=='boolean'||typeof r.oversized!=='boolean'||typeof r.lang!=='string'||typeof r.layout!=='string'||!Array.isArray(r.games)||r.games.some(x=>typeof x!=='string'))fail('card_scope_shape');
 if(r.digital)return 'digital';if(r.oversized)return 'oversized';if(!r.games.includes('paper'))return 'not_paper';if(!Object.hasOwn(languages,r.lang))return 'language';if(!layouts.includes(r.layout))return 'layout';
 if(r.lang==='en'||Object.hasOwn(r,'printed_name'))return null;
 // Only absent evidence is unresolved. Invalid supplied text/face shapes and
 // other collector statuses must reach the unchanged fail-closed preparation.
 const collector=G.magic.parseCollectorEvidence({text:r.collector_number,source:'manual'});
 if(collector.status!=='valid'||collector.comparison_code!==r.collector_number)return null;
 const faces=Object.hasOwn(r,'card_faces')?r.card_faces:[];
 if(!Array.isArray(faces)||faces.length>2)return null;
 let missing=faces.length===0;
 for(const face of faces){
  if(!face||typeof face!=='object'||Array.isArray(face)||![null,Object.prototype].includes(Object.getPrototypeOf(face)))return null;
  try{C.text(face.name);if(Object.hasOwn(face,'printed_name'))C.text(face.printed_name);else missing=true;}catch{return null;}
 }
 if(!missing)return null;
 // Pure contract validation still rejects malformed consumed root/face fields.
 const translated=P.scryfall.translate(r,{game_key:'magic',locale:languages[r.lang][1],collector:{text:r.collector_number,source:'manual'},...context});
 if(!set||r.set!==set.code||r.set_name!==set.name||!r.finishes.length||G.magic.normalizeRarity(r.rarity).status!=='valid')return null;
 return translated.status==='unknown'?'unresolved_missing_printed_name':null;
}
// Streaming fold reproduces M4 selectReference over all eligible SAME-snapshot
// records without collecting an Oracle group (or the bulk dump) in memory.
async function referenceRaw(root,raw){
 const e=variantProjection(raw),own=selectReference(e,[e]);if(own&&own.reference_printing.printing_context.id===raw.id)return raw;
 if(!raw.oracle_id)return null;const path=await indexPath(root,'groups',raw.oracle_id);try{await stat(path);}catch(err){if(err.code==='ENOENT')return null;throw err;}
 let selected=null,vector=null,date=null,ambiguous=false;
 for await(const id of lines(path)){const candidate=JSON.parse(await readFile(await indexPath(root,'cards',id),'utf8')),ref=selectReference(e,[variantProjection(candidate)]);if(!ref)continue;
  const d=ref.reference_kind==='earlier_modern_standard'?candidate.released_at:null;
  if(selected!==null&&d!==null&&d<date)continue;
  if(selected===null||d!==null&&d>date){selected=candidate;date=d;vector=JSON.stringify(ref.reference_printing.illustration_ids);ambiguous=false;continue;}
  if(JSON.stringify(ref.reference_printing.illustration_ids)!==vector)ambiguous=true;
  if(candidate.id<selected.id)selected=candidate;
 }
 return ambiguous?null:selected;
}
export async function prepareAcquisition(envelope,{snapshot_id=randomUUID(),migrations=[],onDiagnostic=null}={}){
 diagnostic(onDiagnostic,'prepare_integrity_start','prepare_integrity');
 uuid(snapshot_id);if(migrations.length)fail('provider_migration_review_required');
 if(envelope.contract!=='ScryfallAcquisitionEnvelope'||envelope.version!=='1'||envelope.origin!=='bulk_snapshot'||envelope.sets_framing!==SETS_FRAMING)fail('envelope');
 const m=validateManifest(envelope.manifest);if(validateSourceURL(envelope.bulk_url,'bulk')!==m.jsonl_download_uri||!Number.isFinite(Date.parse(envelope.completed_at)))fail('envelope_binding');
 const acquired=await realpath(dirname(envelope.jsonl_file));if(acquired!==dirname(envelope.jsonl_file)||!/^acq-[0-9a-f-]{36}$/.test(acquired.split('/').at(-1)))fail('acquisition_directory');
 const inside=async path=>{if(dirname(path)!==acquired||await realpath(path)!==path)fail('acquisition_file');};await inside(envelope.jsonl_file);await inside(envelope.gzip_file);await inside(envelope.manifest_file);
 const gzip=await hashFile(envelope.gzip_file,LIMITS.compressed),jsonl=await hashFile(envelope.jsonl_file,LIMITS.decompressed);
 if(gzip.bytes!==m.compressed_size||gzip.bytes!==envelope.compressed_size||gzip.sha256!==envelope.compressed_sha256||jsonl.bytes!==envelope.decompressed_size||jsonl.sha256!==envelope.jsonl_sha256)fail('acquisition_digest');
 const manifestBytes=await readFile(envelope.manifest_file);if(manifestBytes.length>LIMITS.manifest||sha256(manifestBytes)!==envelope.manifest_raw_sha256||sha256(Buffer.from(canonicalJSON(m,65536)))!==envelope.manifest_sha256)fail('manifest_digest');
 const list=parseProviderJSON(manifestBytes,LIMITS.manifest),matches=list.data?.filter(x=>x.type==='all_cards');if(list.object!=='list'||list.has_more!==false||matches?.length!==1||canonicalJSON(matches[0],65536)!==canonicalJSON(m,65536))fail('manifest_binding');
 diagnostic(onDiagnostic,'prepare_sets_start','prepare_sets');
 const pages=[],sets=new Map(),setPaths=Object.create(null),seenURLs=new Set();let setBytes=0,next='https://api.scryfall.com/sets';
 for(const p of envelope.pages){await inside(p.file);if(p.order!==pages.length+1||p.url!==next||seenURLs.has(p.url))fail('sets_order');seenURLs.add(p.url);validateSourceURL(p.url,'sets');const bytes=await readFile(p.file);setBytes+=bytes.length;
  if(setBytes>LIMITS.sets||bytes.length!==p.bytes||sha256(bytes)!==p.raw_sha256)fail('sets_digest');const response=parseSetsPage(bytes);
  next=response.has_more?validateSourceURL(response.next_page,'sets'):null;if(!response.has_more&&response.next_page!=null)fail('sets_next_page');
  for(const r of response.data){if(r.object!=='set')fail('set_shape');uuid(r.id);const ev=prepareProviderEvidence(r);if(sets.has(r.id)&&prepareProviderEvidence(sets.get(r.id)).record_version!==ev.record_version)fail('catalog_identity_conflict');if(!sets.has(r.id)){sets.set(r.id,r);setPaths[r.id]=p.url;}}
  pages.push({url:p.url,bytes});
 }
 if(!pages.length||next!==null||setsPageFraming(pages)!==envelope.sets_response_sha256)fail('sets_framing');
 const root=join(acquired,'prepared-'+snapshot_id);await mkdir(root,{mode:0o700});const ids=join(root,'accepted.ids'),records=join(root,'records.jsonl'),cards=join(root,'cards.jsonl'),variants=join(root,'variants.jsonl'),setRows=join(root,'sets.jsonl'),report=join(root,'findings.jsonl');
 for(const path of [ids,records,cards,variants,setRows,report])await writeFile(path,'',{flag:'wx',mode:0o600});
 const counts={record_count:0,accepted_cards:0,accepted_variants:0,accepted_sets:0,duplicates:0,excluded:0,excluded_by_reason:{}};const used=new Set();let observed=0;
 let diagnosticPhase='prepare_cards',lastExternalID=null;
 const progress=checkpoint=>diagnostic(onDiagnostic,checkpoint,diagnosticPhase,{processed_count:observed,accepted_count:counts.accepted_cards,excluded_count:counts.excluded,duplicate_count:counts.duplicates,last_external_id:lastExternalID});
 diagnostic(onDiagnostic,'prepare_cards_start',diagnosticPhase);
 try{
  for await(const raw of jsonlRecords(envelope.jsonl_file)){observed++;
   if(onDiagnostic)lastExternalID=typeof raw.id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(raw.id)?raw.id:null;
   try{const ev=prepareProviderEvidence(raw);uuid(raw.id);const path=await indexPath(root,'seen',raw.id);
   let duplicate=false;try{const previous=JSON.parse(await readFile(path,'utf8'));if(previous.record_version!==ev.record_version||previous.lang!==raw.lang)fail('catalog_identity_conflict');duplicate=true;}catch(err){if(err.code!=='ENOENT')throw err;}
   if(duplicate){counts.duplicates++;await appendFile(report,JSON.stringify({kind:'duplicate_equal_digest',external_id:raw.id,record_version:ev.record_version})+'\n');continue;}
   await writeJSON(path,{record_version:ev.record_version,lang:raw.lang});counts.record_count++;const reason=exclusion(ev.raw_record,{source_path:envelope.bulk_url,retrieved_at:envelope.completed_at},sets.get(raw.set_id));
   if(reason){counts.excluded++;counts.excluded_by_reason[reason]=(counts.excluded_by_reason[reason]??0)+1;await appendFile(report,JSON.stringify({kind:'excluded',external_id:raw.id,reason})+'\n');continue;}
   const set=sets.get(raw.set_id);if(!set)fail('missing_set');const prepared=prepareRecords({sets:[set],cards:[raw],source_path:envelope.bulk_url,set_source_paths:setPaths,retrieved_at:envelope.completed_at});if(prepared.stage_cards.length!==1)fail('card_validation');
   await writeJSON(await indexPath(root,'cards',raw.id),raw);await appendFile(ids,raw.id+'\n');if(raw.oracle_id)await appendFile(await indexPath(root,'groups',raw.oracle_id),raw.id+'\n',{mode:0o600});used.add(raw.set_id);counts.accepted_cards++;
   }finally{if(onDiagnostic&&observed%10000===0)progress('prepare_progress');}
  }
  if(observed!==envelope.record_count||!counts.accepted_cards)fail('record_count');
  diagnosticPhase='prepare_sets_projection';diagnostic(onDiagnostic,'prepare_sets_projection_start',diagnosticPhase);
  for(const id of [...used].sort()){const r=sets.get(id),ev=prepareProviderEvidence(r);await appendFile(setRows,JSON.stringify({external_id:id,name:r.name,record_version:ev.record_version})+'\n');await appendFile(records,JSON.stringify({entity_kind:'set',external_id:id,locale:null,...ev,source_path:setPaths[id],retrieved_at:envelope.completed_at})+'\n');counts.accepted_sets++;}
  diagnosticPhase='prepare_variants';diagnostic(onDiagnostic,'prepare_variants_start',diagnosticPhase);
  for await(const id of lines(ids)){if(onDiagnostic)lastExternalID=id;const raw=JSON.parse(await readFile(await indexPath(root,'cards',id),'utf8')),ref=await referenceRaw(root,raw),st=prepareRecords({sets:[sets.get(raw.set_id),...(ref&&ref.set_id!==raw.set_id?[sets.get(ref.set_id)]:[])],cards:[raw],source_path:envelope.bulk_url,set_source_paths:setPaths,retrieved_at:envelope.completed_at,reference_records:ref?[ref]:[]});
   await appendFile(cards,JSON.stringify(st.stage_cards[0])+'\n');await appendFile(records,JSON.stringify(st.stage_records.find(r=>r.entity_kind==='card'))+'\n');for(const v of st.stage_variants){await appendFile(variants,JSON.stringify(v)+'\n');counts.accepted_variants++;}
  }
  const header={id:snapshot_id,game_key:'magic',provider_key:'scryfall',provider_version:'1',bulk_id:m.id,bulk_type:'all_cards',bulk_updated_at:m.updated_at,download_uri:m.jsonl_download_uri,format:'gzip_jsonl',compressed_size:envelope.compressed_size,compressed_sha256:envelope.compressed_sha256,jsonl_sha256:envelope.jsonl_sha256,sets_response_sha256:envelope.sets_response_sha256,manifest_sha256:envelope.manifest_sha256,raw_manifest:m,scope_contract:'magic-collect-catalog-v1',scope_sha256,retrieved_at:envelope.completed_at,record_count:counts.record_count,accepted_cards:counts.accepted_cards,accepted_variants:counts.accepted_variants,accepted_sets:counts.accepted_sets,sealed_at:null};
  diagnosticPhase='prepare_digests';diagnostic(onDiagnostic,'prepare_digests_start',diagnosticPhase);
  const files={sets:setRows,cards,variants,records};const digests={};for(const [k,file] of Object.entries(files))digests[k]=await hashFile(file,Number.MAX_SAFE_INTEGER);
  await writeJSON(join(root,'preparation-report.json'),{header,counts,digests,findings_file:report});return {header,counts,files,digests,findings_file:report};
 }catch(e){progress('prepare_failure');await writeJSON(join(root,'reject-report.json'),{code:e.message.startsWith('TCG ')?e.message:'preparation_error',counts});throw e;}
}
export async function publicationPreflight(client,header,{clock=()=>Date.now()}={}){
 const {rows}=await client.query(`select current_user as owner,current_setting('server_version_num') as server_version_num,
 (public.get_security_schema_readiness_v1()->>'compatible')::boolean as security_ready,
 (public.get_market_legal_schema_readiness_v1()->>'compatible')::boolean as legal_ready,
 r.release_generation::text as generation,to_jsonb(s) as snapshot
 from dv_collect_private.tcg_catalog_releases r left join dv_collect_private.tcg_catalog_snapshots s on s.id=r.snapshot_id
 where (r.game_key,r.provider_key,r.provider_version)=('magic','scryfall','1')`);
 if(rows.length!==1)fail('release_missing');const r=rows[0];if(r.owner!=='postgres'||Math.floor(Number(r.server_version_num)/10000)!==17||r.security_ready!==true||r.legal_ready!==true||!/^\d+$/.test(r.generation))fail('owner_or_readiness');
 let reused=false;if(r.snapshot){const old=r.snapshot,now=Date.parse(header.bulk_updated_at),before=Date.parse(old.bulk_updated_at);if(now<before)fail('catalog_snapshot_older');if(now===before){reused=['bulk_id','compressed_sha256','sets_response_sha256','scope_sha256'].every(k=>header[k]===old[k]);if(!reused)fail('catalog_snapshot_time_conflict');}}
 // DB time evidence survives process restart and a different operator temp path.
 // Generation binding below rejects concurrent preflights after another publish.
 if(r.snapshot&&!reused){const sealed=Date.parse(r.snapshot.sealed_at);if(!Number.isFinite(sealed))fail('snapshot_seal');if(clock()-sealed<DAY)fail('daily_snapshot_limit');}
 return {expected_generation:r.generation,reused};
}
export async function publishPrepared(client,prepared,options={}){
 const onDiagnostic=options.onDiagnostic??null;
 diagnostic(onDiagnostic,'publication_preflight_start','publication_preflight');
 const binding=await publicationPreflight(client,prepared.header,options);for(const [k,file] of Object.entries(prepared.files)){const actual=await hashFile(file,Number.MAX_SAFE_INTEGER);if(actual.bytes!==prepared.digests[k].bytes||actual.sha256!==prepared.digests[k].sha256)fail('prepared_digest');}
 diagnostic(onDiagnostic,'publication_preflight_complete','transaction_begin');
 await client.query('begin');
 diagnostic(onDiagnostic,'transaction_begin','stage_header');
 try{await client.query(STAGE_SQL);await insert(client,'header',prepared.header);
  diagnostic(onDiagnostic,'stage_header_complete','stage_sets');
  for(const kind of ['sets','cards','variants','records']){for await(const line of lines(prepared.files[kind]))await insert(client,kind,JSON.parse(line));diagnostic(onDiagnostic,'stage_'+kind+'_complete',{sets:'stage_cards',cards:'stage_variants',variants:'stage_records',records:'publisher'}[kind]);}
  diagnostic(onDiagnostic,'publisher_call_start','publisher');
  const result=await client.query('select dv_collect_private.tcg_publish_catalog_snapshot_v1($1,$2) as id',[prepared.header.id,binding.expected_generation]);const id=result.rows[0]?.id;uuid(id);
  diagnostic(onDiagnostic,'publisher_call_complete','commit');
  await client.query('commit');diagnostic(onDiagnostic,'commit_complete','finish');return {snapshot_id:id,reused:binding.reused,expected_generation:binding.expected_generation,counts:prepared.counts};
 }catch(e){try{await client.query('rollback');}catch(rollback){throw new AggregateError([e,rollback],'TCG ingest: rollback_failed');}throw e;}
}
export async function ingestAcquisition(acquisition,{client,snapshot_id=randomUUID(),migrations=[],clock=()=>Date.now(),onDiagnostic=null}={}){
 if(!client||typeof client.query!=='function'||!acquisition||typeof acquisition.finish!=='function')fail('operator_input');let done=false;
 diagnostic(onDiagnostic,'acquisition_complete','prepare');
 try{diagnostic(onDiagnostic,'prepare_start','prepare');const prepared=await prepareAcquisition(acquisition.envelope,{snapshot_id,migrations,onDiagnostic});
  if(onDiagnostic)diagnostic(onDiagnostic,'prepare_complete','publication_preflight',{counts:{...prepared.counts,excluded_by_reason:{...prepared.counts.excluded_by_reason}},digests:Object.fromEntries(Object.entries(prepared.digests).map(([k,v])=>[k,{...v}]))});
  const result=await publishPrepared(client,prepared,{clock,onDiagnostic});done=true;await acquisition.finish({published:true,...result});diagnostic(onDiagnostic,'finish_complete','finish');return {...result,findings_file:prepared.findings_file};}
 finally{if(!done){await acquisition.finish({published:false});diagnostic(onDiagnostic,'finish_complete','finish');}}
}
// Prepared real-source harness: caller supplies the already authorized source
// instance, operator temp directory and owner connection. Never runs on import.
export async function runRealSourceAcceptance({source,tempDir,client,onDiagnostic=null}){return ingestAcquisition(await source.acquire({tempDir}),{client,onDiagnostic});}
