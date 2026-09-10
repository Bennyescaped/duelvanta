// Extraction score only: never turn a model proposal into a verified catalog/variant match.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {code} from './score.mjs';
const language=v=>({JA:'JP',JPN:'JP',GERMAN:'DE',DEUTSCH:'DE',ENGLISH:'EN',JAPANESE:'JP'}[String(v||'').trim().toUpperCase()]||String(v||'').trim().toUpperCase());
const median=values=>{if(!values.length)return null;const a=[...values].sort((a,b)=>a-b);const n=Math.floor(a.length/2);return a.length%2?a[n]:(a[n-1]+a[n])/2};
export function scoreGemini(manifest,entries){
  const expected=new Map(manifest.cards.flatMap(c=>c.shots.map(s=>[s.id,{shot:s,card:c}]))),seen=new Set();
  const rows=entries.map(e=>{
    const found=expected.get(e.photoId);if(!found||found.shot.sha256!==e.sha256||seen.has(e.photoId))throw Error('Unknown, changed or repeated fixture');seen.add(e.photoId);
    const r=e.result,a=r?.observed,t=found.card.expected;
    const rawCatalog=found.card.catalogEvidence?.rawResponse;
    const catalogRows=Array.isArray(rawCatalog)?rawCatalog:[rawCatalog];
    const catalogSetNames=[...new Set(catalogRows.map(c=>c?.set_name||c?.set?.name).filter(Boolean))];
    const identifierCorrect=!!a?.printed_code && code(a.printed_code)===code(t.code) && a.tcg===found.card.tcg;
    const languageCorrect=!!a?.language && language(a.language)===language(t.language);
    return {photoId:e.photoId,cardId:found.card.id,split:found.card.split,tcg:found.card.tcg,expectedCode:t.code,
      expectedLanguage:t.language,observedCode:a?.printed_code??null,observedName:a?.name??null,observedLanguage:a?.language??null,
      observedSet:a?.set_name??null,catalogSetNames,observedVariant:a?.variant??null,uncertainty:a?.uncertainty??null,
      identifierCorrect,languageCorrect,identifierAndLanguageCorrect:identifierCorrect&&languageCorrect,
      exactPrintingVerified:false,catalogVerified:false,importable:false,
      modelConfidence:a?.confidence??null,highConfidenceConflict:!!a && a.confidence>=.9 && (!identifierCorrect||!languageCorrect),
      error:e.error??null,elapsedMs:r?.elapsedMs??null,usage:r?.usage??null};
  });
  const missing=[...expected.keys()].filter(k=>!seen.has(k));
  const completeUsage=rows.every(r=>Number.isFinite(r.usage?.promptTokenCount)&&Number.isFinite(r.usage?.totalTokenCount));
  return {schema:'duelvanta.gemini-extraction-score.v1',scope:'16 private photographs, 8 cards, two angles without sleeves; proposals, not verified catalog matches',
    model:entries.find(e=>e.result)?.result.model??null,planned:expected.size,attempted:rows.length,completed:rows.filter(r=>!r.error).length,missing,
    identifierCorrect:rows.filter(r=>r.identifierCorrect).length,languageCorrect:rows.filter(r=>r.languageCorrect).length,
    identifierAndLanguageCorrect:rows.filter(r=>r.identifierAndLanguageCorrect).length,
    highConfidenceIdentifierOrLanguageConflicts:rows.filter(r=>r.highConfidenceConflict).length,exactPrintingVerified:0,
    medianMs:median(rows.map(r=>r.elapsedMs).filter(Number.isFinite)),
    promptTokens:completeUsage?rows.reduce((sum,r)=>sum+r.usage.promptTokenCount,0):null,
    totalTokens:completeUsage?rows.reduce((sum,r)=>sum+r.usage.totalTokenCount,0):null,
    billableOutputTokensIncludingThinking:completeUsage?rows.reduce((sum,r)=>sum+r.usage.totalTokenCount-r.usage.promptTokenCount,0):null,rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [manifest,observations,out]=process.argv.slice(2);if(!out)throw Error('Usage: score-gemini.mjs PRIVATE_MANIFEST PRIVATE_OBSERVATIONS OUTPUT');
  const report=scoreGemini(JSON.parse(await readFile(manifest,'utf8')),JSON.parse(await readFile(observations,'utf8')));
  await writeFile(out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,rows:undefined}));
}
