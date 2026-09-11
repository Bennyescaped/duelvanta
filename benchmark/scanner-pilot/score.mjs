// Offline pilot scoring only. No browser, network, storage reset or app changes.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const norm=x=>String(x??'').normalize('NFKC').trim().toUpperCase();
const lang=x=>({JA:'JP',KO:'KR'}[norm(x)]||norm(x));
export function code(value){
 const text=norm(value).replace(/\s+/g,'');
 const p=text.match(/^(\d{1,3})\/(\d{2,3})$/);
 if(p)return `${Number(p[1])}/${Number(p[2])}`;
 const op=text.match(/^(OP|ST|EB|PRB)(\d{1,2})-(\d{2,3})$/);
 return op?`${op[1]}${op[2].padStart(2,'0')}-${op[3].padStart(3,'0')}`:text;
}
export function casesFrom(manifest){
 if(manifest.schema!==1||!Array.isArray(manifest.cards))throw Error('Unknown pilot manifest');
 const cases=[],ids=new Set(),physical=new Set();
 for(const card of manifest.cards){
  if(!card.id||physical.has(card.id))throw Error('Duplicate/missing physical card ID');physical.add(card.id);
  if(!['pokemon','one_piece'].includes(card.tcg)||!['development','holdout'].includes(card.split))throw Error('Invalid TCG or split');
  if(!Array.isArray(card.shots)||card.shots.length!==2)throw Error('Each physical card needs two shots in the same split');
  for(const shot of card.shots){if(!shot.id||ids.has(shot.id))throw Error('Duplicate/missing photo ID');ids.add(shot.id);cases.push({...shot,cardId:card.id,tcg:card.tcg,split:card.split,expected:card.expected||{}})}
 }
 return cases;
}
export function classify(test,observation){
 const e=test.expected,a=observation.actual||{};
 if(!e.confirmed||!code(e.code)||!lang(e.language))return 'ground_truth_pending';
 if(a.errorType)return a.errorType==='catalog_unavailable'?'catalog_unavailable':'pipeline_error';
 if(a.catalogMatched!==true)return 'no_hit';
 if(!a.tcg||!code(a.number))return 'identity_unverified';
 if(a.tcg!==test.tcg||code(a.number)!==code(e.code))return 'wrong_card';
 if(!lang(a.language))return 'language_unverified';
 if(lang(a.language)!==lang(e.language))return 'wrong_language';
 // A shared code or the label "Parallel" cannot prove the exact printing.
 if(!e.printingKey||!a.printingKey||!e.variant||!a.variant)return 'variant_unverified';
 if(norm(a.printingKey)!==norm(e.printingKey)||norm(a.variant)!==norm(e.variant))return 'wrong_variant';
 return 'exact_match';
}
const median=values=>{if(!values.length)return null;const v=values.slice().sort((a,b)=>a-b),mid=Math.floor(v.length/2);return v.length%2?v[mid]:(v[mid-1]+v[mid])/2};
export function summarize(manifest,observations){
 const cases=casesFrom(manifest),byId=new Map(cases.map(c=>[c.id,c])),groups=new Map(),seen=new Set();
 for(const observation of observations){
  const test=byId.get(observation.caseId);if(!test)throw Error('Unknown photo: '+observation.caseId);
  if(!observation.engine||!observation.version||!observation.environment||!['photo','live'].includes(observation.inputMode)||!['initial','recovery'].includes(observation.phase))throw Error('Each observation needs engine/version/environment/inputMode/phase');
  const a=observation.actual||{};for(const field of ['elapsedMs','additionalActions'])if(a[field]!=null&&(!Number.isFinite(a[field])||a[field]<0))throw Error('Invalid '+field);
  const key=JSON.stringify([observation.engine,observation.version,observation.inputMode,observation.environment,test.tcg,test.split]);
  if(observation.phase==='initial'){const unique=key+'|'+test.id;if(seen.has(unique))throw Error('Duplicate initial attempt: '+test.id);seen.add(unique)}
  if(!groups.has(key))groups.set(key,{engine:observation.engine,version:observation.version,inputMode:observation.inputMode,environment:observation.environment,tcg:test.tcg,split:test.split,rows:[]});
  groups.get(key).rows.push({caseId:test.id,phase:observation.phase,classification:classify(test,observation),ready:a.ready===true,elapsedMs:a.elapsedMs??null,additionalActions:a.additionalActions??null});
 }
 // Show a reserved split as missing even when the engine has not run it yet.
 for(const group of [...groups.values()])for(const split of new Set(cases.filter(c=>c.tcg===group.tcg).map(c=>c.split))){
  const key=JSON.stringify([group.engine,group.version,group.inputMode,group.environment,group.tcg,split]);
  if(!groups.has(key))groups.set(key,{...group,split,rows:[]});
 }
 return {schema:1,scope:'Small decision pilot, not a production accuracy estimate',groups:[...groups.values()].map(group=>{
  const planned=cases.filter(c=>c.tcg===group.tcg&&c.split===group.split),initial=group.rows.filter(r=>r.phase==='initial'),recovery=group.rows.filter(r=>r.phase==='recovery'),count=kind=>initial.filter(r=>r.classification===kind).length;
  const falseSafe=initial.filter(r=>r.ready&&['wrong_card','wrong_language','wrong_variant'].includes(r.classification)).length;
  const unverifiedSafe=initial.filter(r=>r.ready&&!['exact_match','wrong_card','wrong_language','wrong_variant'].includes(r.classification)).length;
  return {...group,planned:planned.length,initialAttempts:initial.length,missing:planned.length-initial.length,
   exactInitial:count('exact_match'),exactReady:initial.filter(r=>r.ready&&r.classification==='exact_match').length,
   exactReview:initial.filter(r=>!r.ready&&r.classification==='exact_match').length,falseSafe,unverifiedSafe,
   wrongCard:count('wrong_card'),wrongLanguage:count('wrong_language'),wrongVariant:count('wrong_variant'),noHit:count('no_hit'),catalogUnavailable:count('catalog_unavailable'),pipelineErrors:count('pipeline_error'),unverified:initial.filter(r=>/_unverified|_pending/.test(r.classification)).length,
   latencySamples:initial.filter(r=>r.elapsedMs!=null).length,medianMs:median(initial.map(r=>r.elapsedMs).filter(v=>v!=null)),
   actionSamples:initial.filter(r=>r.additionalActions!=null).length,medianAdditionalActions:median(initial.map(r=>r.additionalActions).filter(v=>v!=null)),
   recoveryAttempts:recovery.length,exactRecoveries:recovery.filter(r=>r.classification==='exact_match').length,
   decision:falseSafe||unverifiedSafe?'STOP_UNSAFE':initial.length!==planned.length?'INCOMPLETE':initial.some(r=>r.classification==='catalog_unavailable'||r.classification==='pipeline_error')?'BLOCKED':initial.some(r=>/_unverified|_pending/.test(r.classification))?'EVIDENCE_MISSING':'REVIEW_PAIRED_RESULTS'};
 })};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [manifestPath,observationsPath,outputPath]=process.argv.slice(2);
 if(!manifestPath||!observationsPath)throw Error('Usage: node benchmark/scanner-pilot/score.mjs manifest.json observations.json [report.json]');
 const report=summarize(JSON.parse(await readFile(manifestPath,'utf8')),JSON.parse(await readFile(observationsPath,'utf8'))),text=JSON.stringify(report,null,2)+'\n';
 if(outputPath)await writeFile(outputPath,text);else process.stdout.write(text);
}
