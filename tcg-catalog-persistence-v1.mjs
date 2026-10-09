// Pure synthetic preparation. No acquisition, credentials, database or HTTP client.
import {createRequire} from 'node:module';
import {gunzipSync} from 'node:zlib';
import {canonicalJSON,parseProviderJSON,prepareProviderEvidence,detachedFrozen,sha256} from './tcg-catalog-evidence-v1.mjs';
const require=createRequire(import.meta.url),C=require('./tcg-v1-contracts.js'),G=require('./tcg-v1-game-adapters.js'),P=require('./tcg-v1-catalog-providers.js');
export const contract='tcg-i3-magic-persistence',version='1';
export const scope_sha256='a53ed167751e6ac3bf288864f7991f2b70bc486ec53cb5b9d5e7f7f7440d5aaa';
export const descriptor_sha256='52d7223aa087a90bca1464a8e67b2fe8ae58b272c8c7993803bbad83394d1909';
const languageMap={en:['EN','en'],de:['DE','de'],fr:['FR','fr'],it:['IT','it'],es:['ES','es'],ja:['JP','ja'],ko:['KR','ko'],zhs:['CN','zh-cn']};
export const languages=Object.freeze(Object.fromEntries(Object.entries(languageMap).map(([k,v])=>[k,Object.freeze([...v])])));
const faceCounts={normal:0,split:2,flip:2,adventure:2,transform:2,modal_dfc:2};
const fail=x=>{throw new TypeError('TCG persistence: '+x);},nullField=(r,k)=>Object.hasOwn(r,k)?r[k]:null;
const uuid=v=>{if(typeof v!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v))fail('uuid');};
const utc=v=>{if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|\+00:00)$/.test(v)||!Number.isFinite(Date.parse(v)))fail('utc_time');};
const freeze=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;};
export function validateManifest(input){
 const m=detachedFrozen(input,65536);if(m.object!=='bulk_data'||m.type!=='all_cards')fail('bulk_manifest');uuid(m.id);utc(m.updated_at);
 if(!Number.isSafeInteger(m.compressed_size)||m.compressed_size<1||m.compressed_size>1073741824)fail('compressed_size');
 for(const [k,host,pattern] of [['uri','api.scryfall.com',new RegExp('^/bulk-data/'+m.id+'$')],['jsonl_download_uri','data.scryfall.io',/^\/all-cards\/all-cards-\d{14}\.jsonl\.gz$/]]){
  if(typeof m[k]!=='string'||m[k].length>500)fail('bulk_origin');let u;try{u=new URL(m[k]);}catch{fail('bulk_origin');}if(u.protocol!=='https:'||u.hostname!==host||u.port||u.username||u.password||u.hash||u.search||!pattern.test(u.pathname)||u.href!==m[k])fail('bulk_origin');
 }
 return m;
}
export function variantProjection(raw,chosen_finish=null){
 const faces=raw.card_faces??[];
 return C.magicVariantEvidence({contract:'MagicVariantEvidence',version:'1',game_key:'magic',provider_key:'scryfall',provider_version:'1',printing_context:{id:raw.id,set_id:raw.set_id,oracle_id:nullField(raw,'oracle_id'),lang:raw.lang,layout:raw.layout,collector_number:raw.collector_number,released_at:nullField(raw,'released_at'),variation:nullField(raw,'variation'),reprint:nullField(raw,'reprint')},chosen_finish,available_finishes:raw.finishes,frame:nullField(raw,'frame'),border_color:nullField(raw,'border_color'),full_art:nullField(raw,'full_art'),frame_effects:raw.frame_effects??[],promo_types:raw.promo_types??[],illustration_ids:faces.length?faces.map(f=>nullField(f,'illustration_id')):[nullField(raw,'illustration_id')],variation_of:nullField(raw,'variation_of')});
}
const appearance=e=>{const {printing_context,frame,border_color,full_art,frame_effects,promo_types,illustration_ids,variation_of}=e;return {printing_context,frame,border_color,full_art,frame_effects,promo_types,illustration_ids,variation_of};};
const vi={variant:'',rarity:'',name:'',set:''};
function standard(e){
 const r=G.magic.normalizeVariant(vi,{...e,chosen_finish:e.available_finishes[0]??null,reference_kind:'same_set_standard',reference_printing:appearance(e)});
 return r.status==='valid'&&r.treatment==='normal'&&r.artwork==='normal'&&e.printing_context.variation===false&&e.variation_of===null;
}
export function selectReference(e,records){
 if(e.printing_context.oracle_id===null)return null;
 const own=e.printing_context;
 const eligible=records.filter(r=>{const p=r.printing_context;return p.oracle_id===own.oracle_id&&p.lang===own.lang&&p.layout===own.layout&&standard(r);});
 let kind='same_set_standard',selected;
 if(['1993','1997'].includes(e.frame)){
  kind='earlier_modern_standard';if(own.reprint!==true||own.released_at===null||e.variation_of!==null)return null;
  const earlier=eligible.filter(r=>r.printing_context.id!==own.id&&r.printing_context.released_at!==null&&r.printing_context.released_at<own.released_at);
  const date=earlier.map(r=>r.printing_context.released_at).sort().at(-1);selected=earlier.filter(r=>r.printing_context.released_at===date);
 }else if(standard(e))selected=[e];else selected=eligible.filter(r=>r.printing_context.set_id===own.set_id&&(e.variation_of===null||e.variation_of===r.printing_context.id));
 if(!selected.length||selected.some(r=>JSON.stringify(r.illustration_ids)!==JSON.stringify(selected[0].illustration_ids)))return null;
 selected.sort((a,b)=>a.printing_context.id<b.printing_context.id?-1:a.printing_context.id>b.printing_context.id?1:0);
 return {reference_kind:kind,reference_printing:appearance(selected[0])};
}
export function prepareRecords({sets,cards,source_path='api/cards/search',retrieved_at,migrations=[],set_source_paths=null,reference_records=null}){
 utc(retrieved_at);if(typeof source_path!=='string'||!source_path.length||source_path.length>500)fail('source_path');
 if(!Array.isArray(sets)||!Array.isArray(cards)||!Array.isArray(migrations))fail('records_shape');if(migrations.length)fail('provider_migration_review_required');if(!cards.length)fail('empty_snapshot');
 const setIndex=new Map(),index=new Map(),duplicates=[],excluded=[],accepted=[];
 const setPath=id=>set_source_paths===null?'api/sets/'+id:set_source_paths[id];
 if(set_source_paths!==null&&(typeof set_source_paths!=='object'||Array.isArray(set_source_paths)))fail('set_provenance');
 for(const input of sets){const ev=prepareProviderEvidence(input),r=ev.raw_record;const t=P.scryfall.translate(r,{game_key:'magic',locale:null,collector:{text:'',source:'manual'},source_path:setPath(r.id),retrieved_at});if(t.status!=='candidates')fail('set_scope');
  for(const k of ['set_type','parent_set_code','released_at'])if(Object.hasOwn(r,k)&&r[k]!==null){if(typeof r[k]!=='string'||r[k].length>(k==='set_type'?32:500))fail('set_metadata');if(k==='set_type'&&!/^[a-z0-9_]+$/.test(r[k]))fail('set_metadata');if(k==='released_at'&&(!/^\d{4}-\d\d-\d\d$/.test(r[k])||new Date(r[k]).toISOString().slice(0,10)!==r[k]))fail('set_date');}
  if(setIndex.has(r.id)){if(setIndex.get(r.id).ev.record_version!==ev.record_version)fail('catalog_identity_conflict');duplicates.push({kind:'set',external_id:r.id});}else setIndex.set(r.id,{r,ev,record:t.records[0]});
 }
 for(const input of cards){const ev=prepareProviderEvidence(input),r=ev.raw_record;uuid(r.id);
  if(index.has(r.id)){if(index.get(r.id)!==ev.record_version)fail('catalog_identity_conflict');duplicates.push({kind:'card',external_id:r.id});continue;}index.set(r.id,ev.record_version);
  if(!Object.hasOwn(languageMap,r.lang)||!Object.hasOwn(faceCounts,r.layout)||r.digital===true||r.oversized===true||Array.isArray(r.games)&&!r.games.includes('paper')){excluded.push({external_id:r.id,reason:'outside_scope'});continue;}
  const [language_code,locale]=languageMap[r.lang],context={game_key:'magic',locale,collector:{text:r.collector_number,source:'manual'},source_path:source_path.startsWith('https://')?source_path:'api/cards/'+r.id,retrieved_at};
  const t=P.scryfall.translate(r,context);if(t.status!=='candidates')fail('card_validation');const record=t.records.find(x=>x.ref.entity_kind==='card');if(!record||record.source.record_version!==ev.record_version)fail('record_version_mismatch');
  if((r.card_faces??[]).length!==faceCounts[r.layout]||!r.finishes.length||record.normalized.rarity.status!=='valid')fail('card_scope');
  const s=setIndex.get(r.set_id);if(!s||r.set!==s.r.code||r.set_name!==s.r.name)fail('catalog_set_conflict');
  accepted.push({r,ev,record,language_code,locale,context,e:variantProjection(r)});
 }
 if(!accepted.length)fail('empty_snapshot');
 const used=new Set(accepted.map(x=>x.r.set_id)),stage_sets=[],stage_cards=[],stage_variants=[],stage_records=[];
 // External preparation may supply a bounded set of already selected reference
 // records from the SAME acquisition. Validate them by the ordinary path first.
 // They are reference evidence only; they are not added to this chunk's stages.
 const external=[];
 if(reference_records!==null){
  if(!Array.isArray(reference_records))fail('reference_records');
  for(const raw of reference_records){const st=prepareRecords({sets,cards:[raw],source_path,retrieved_at,set_source_paths,migrations});if(st.stage_cards.length!==1)fail('reference_unavailable');external.push({r:raw,e:variantProjection(raw),ev:prepareProviderEvidence(raw)});}
 }
 const references=reference_records===null?accepted:[...accepted,...external];
 for(const id of [...used].sort()){const {r,ev}=setIndex.get(id);stage_sets.push({external_id:id,name:r.name,record_version:ev.record_version});stage_records.push({entity_kind:'set',external_id:id,locale:null,...ev,source_path:setPath(id),retrieved_at});}
 for(const x of accepted.sort((a,b)=>a.r.id<b.r.id?-1:1)){
  const {r,ev,record,language_code,locale,e}=x;
  stage_cards.push({external_id:r.id,set_external_id:r.set_id,provider_lang:r.lang,language_code,locale,collector_number:r.collector_number,name:record.normalized.name,rarity:record.normalized.rarity.code,record_version:ev.record_version});
  stage_records.push({entity_kind:'card',external_id:r.id,locale,...ev,source_path,retrieved_at});
  const ref=selectReference(e,references.map(y=>y.e));if(!ref)continue;
  for(const finish of r.finishes){const v=C.magicVariantEvidence({...e,chosen_finish:finish,...ref});const result=G.magic.normalizeVariant(vi,v);if(result.status!=='valid')continue;
   P.scryfall.translate(r,{...x.context,variant_evidence:v});const reference=references.find(y=>y.r.id===v.reference_printing.printing_context.id);if(!reference)fail('reference_unavailable');
   stage_variants.push({card_external_id:r.id,locale,finish:result.finish,artwork:result.artwork,treatment:result.treatment,edition:null,validated_evidence:v,evidence_sha256:sha256(Buffer.from(canonicalJSON(v,16384),'utf8')),reference_external_id:reference.r.id,reference_record_version:reference.ev.record_version});
  }
 }
 return freeze({stage_sets,stage_cards,stage_variants,stage_records,duplicates,excluded});
}
export function prepareSyntheticSnapshot({snapshot_id,manifest,compressed_bytes,sets_response_bytes,retrieved_at,migrations=[]}){
 uuid(snapshot_id);utc(retrieved_at);const m=validateManifest(manifest),compressed=Buffer.from(compressed_bytes),setbytes=Buffer.from(sets_response_bytes);
 if(compressed.length!==m.compressed_size||compressed.length>1073741824||setbytes.length>67108864)fail('snapshot_size');
 let jsonl;try{jsonl=gunzipSync(compressed,{maxOutputLength:17179869184});}catch{fail('gzip_integrity');}
 const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(jsonl);if(text.charCodeAt(0)===0xfeff)fail('bom');
 const lines=text.split('\n');if(lines.at(-1)==='')lines.pop();if(!lines.length||lines.length>5000000)fail('line_count');
 const cards=lines.map(l=>{if(l.endsWith('\r'))l=l.slice(0,-1);if(!l)fail('empty_line');const r=parseProviderJSON(l);if(!r||Array.isArray(r)||r.object!=='card')fail('jsonl_object');return r;});
 // Synthetic aggregate response is parsed with the SAME strict parser; each set
 // still has the per-record limits. Real paged/streaming acquisition is separate.
 const response=parseProviderJSON(setbytes,67108864);if(response.object!=='list'||response.has_more!==false||!Array.isArray(response.data))fail('sets_response');
 const stages=prepareRecords({sets:response.data,cards,source_path:'api/cards/search',retrieved_at,migrations});
 const stage_header={id:snapshot_id,game_key:'magic',provider_key:'scryfall',provider_version:'1',bulk_id:m.id,bulk_type:'all_cards',bulk_updated_at:m.updated_at,download_uri:m.jsonl_download_uri,format:'gzip_jsonl',compressed_size:compressed.length,compressed_sha256:sha256(compressed),jsonl_sha256:sha256(jsonl),sets_response_sha256:sha256(setbytes),manifest_sha256:sha256(Buffer.from(canonicalJSON(m,65536),'utf8')),raw_manifest:m,scope_contract:'magic-collect-catalog-v1',scope_sha256,retrieved_at,record_count:cards.length-stages.duplicates.filter(x=>x.kind==='card').length,accepted_cards:stages.stage_cards.length,accepted_variants:stages.stage_variants.length,accepted_sets:stages.stage_sets.length,sealed_at:null};
 return freeze({stage_header,...stages});
}
