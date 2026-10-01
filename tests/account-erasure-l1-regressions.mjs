// Same complete D4 regression suite, now with L1 installed in every database.
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const native=process.argv.includes('--native');
const flags=['--trade-lock','--data-export','--processing-markers','--closure-privacy','--scanner-hold','--battle-player-hold','--battle-signal-hold','--spectator-withdrawal','--spectator-epoch-hold','--staff-hold','--publication-hold','--b1-safety','--c-withdrawal','--l1-erasure'];
const tests=['generate-security-readiness','account-erasure-l1-test','account-deletion-withdrawal-test','battle-safety-sanctions-test','staff-processing-hold-test','publication-processing-hold-test','battle-spectator-epoch-processing-hold-test','battle-spectator-withdrawal-test','battle-signal-processing-hold-test','battle-player-processing-hold-test','account-processing-markers-test','account-closure-privacy-test','scanner-processing-hold-test','account-data-export-collect-battle-test','production-upgrade-rehearsal'];
mkdirSync('test-results',{recursive:true});const results=[];
for(const name of tests){
 const args=['tests/'+name+'.mjs',...flags,...(native?['--native']:[]),...(name==='generate-security-readiness'?['--check']:[])];
 const r=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:30*1024*1024});
 writeFileSync('test-results/l1-erasure-regression-'+name+'.log',(r.stdout||'')+(r.stderr||''));
 results.push({name,status:r.status,error:r.error?.message});console.log(name,r.status===0?'PASS':'FAIL');
 if(r.status!==0){console.error((r.stderr||'').slice(-1800));break;}
}
writeFileSync('test-results/l1-erasure-regressions-'+(native?'native':'preparation')+'.json',JSON.stringify({native,passed:results.length===tests.length&&results.every(x=>x.status===0),results},null,2));
if(results.length!==tests.length||results.some(x=>x.status!==0))process.exitCode=1;
