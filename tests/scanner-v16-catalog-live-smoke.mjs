// Read-only provider availability diagnostic, separate from hermetic tests.
// Never treats an empty live catalog as successful recognition.
import {mkdir,writeFile} from 'node:fs/promises';
await import('../scanner-v16-tcg.js');
await import('../scanner-v16-catalog.js');
const client=globalThis.DV_SCAN_V16_CATALOG.createClient({timeoutMs:7000});
const report=[];
for(const [tcg,code] of [['pokemon','074/084'],['one_piece','OP05-119']]){
  const id=tcg==='pokemon'?{code,local:'074',den:'084'}:{code};
  const candidates=await client.lookup(id,{tcg});
  report.push({tcg,identifier:code,catalogMatched:candidates.length>0,candidates:candidates.map(c=>({id:c.catalogId,number:c.number,name:c.name,language:c.language})),lookup:candidates.lookupInfo});
}
await mkdir('test-results',{recursive:true});
await writeFile('test-results/catalog-live-diagnostic.json',JSON.stringify({checkedAt:new Date().toISOString(),report},null,2));
console.log('LIVE PROVIDER DIAGNOSTIC (not a mocked recognition test):',JSON.stringify(report));
