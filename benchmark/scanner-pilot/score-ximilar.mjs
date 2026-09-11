// Offline scoring of retained provider evidence. Never makes another API call.
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {scoreGemini} from './score-gemini.mjs';
import {code} from './score.mjs';
import pilot from './ximilar-server.cjs';

export function scoreXimilar(manifest,entries){
  // Reparse only the response shape; expected answers are never supplied to the parser.
  const parsed=entries.map(e=>e.result?.raw?{...e,result:{...e.result,...pilot.parseResponse(e.result.raw,e.result.selectedTcg)}}:e);
  const common=scoreGemini(manifest,parsed);
  const rows=common.rows.map((row,i)=>{
    const r=parsed[i].result,best=r?.catalogCandidate;
    const object=r?.raw?.records?.[0]?._objects?.find(o=>o.name==='Card'&&o._identification);
    const ocr=object?._ocr?.full_text||'';
    const numbers=[...new Set((ocr.match(row.tcg==='pokemon'?/\b\d{1,3}\s*\/\s*\d{2,3}\b/g:/\b(?:(?:OP|ST|EB|PRB)\d{2}|P)-\d{3}\b/g)||[]).map(code))];
    const links=best?.links||{};
    const {modelConfidence,highConfidenceConflict,...rest}=row;
    return {...rest,identifierCorrect:row.identifierCorrect&&!r?.identifierConflict,
      identifierAndLanguageCorrect:row.identifierAndLanguageCorrect&&!r?.identifierConflict,
      providerName:best?.name??null,providerFullName:best?.full_name??null,providerPrintingId:best?.card_id??null,
      providerSetCode:best?.set_code??null,providerRarity:best?.rarity??null,providerFinish:r?.detectedFinish??null,
      providerLinks:links,distances:r?.distances??[],alternatives:r?.alternatives??[],ocrCodes:numbers,
      ocrCatalogConflict:!!r?.identifierConflict,
      variantEvidencePresent:!!r?.observed?.variant||/alternate|parallel|manga|reprint|reverse|special art/i.test(best?.full_name||''),
      calibratedConfidence:null};
  });
  const completeCredits=rows.length>0&&rows.every(r=>Number.isFinite(r.usage?.reportedCredits));
  const latencies=rows.map(r=>r.elapsedMs).filter(Number.isFinite);
  const {schema,promptTokens,totalTokens,billableOutputTokensIncludingThinking,highConfidenceIdentifierOrLanguageConflicts,...rest}=common;
  return {...rest,schema:'duelvanta.ximilar-catalog-proposal-score.v1',
    scope:'16 private photos, 8 cards, two angles without sleeves; identifiers and languages scored independently of exact printing',
    minMs:latencies.length?Math.min(...latencies):null,maxMs:latencies.length?Math.max(...latencies):null,
    reportedCredits:completeCredits?rows.reduce((sum,r)=>sum+r.usage.reportedCredits,0):null,
    identifierCorrect:rows.filter(r=>r.identifierCorrect).length,
    identifierAndLanguageCorrect:rows.filter(r=>r.identifierAndLanguageCorrect).length,
    ocrCatalogConflicts:rows.filter(r=>r.ocrCatalogConflict).length,
    variantEvidencePresent:rows.filter(r=>r.variantEvidencePresent).length,
    exactPrintingVerified:0,rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const [manifest,observations,out]=process.argv.slice(2);if(!out)throw Error('Usage: score-ximilar.mjs PRIVATE_MANIFEST SINGLE_RUN_OBSERVATIONS OUTPUT');
  const report=scoreXimilar(JSON.parse(await readFile(manifest,'utf8')),JSON.parse(await readFile(observations,'utf8')));
  await writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rows:undefined}));
}
