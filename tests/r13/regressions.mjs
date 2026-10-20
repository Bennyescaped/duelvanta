import {spawnSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=root+'test-results/tcg-i3-m6-r13/';
await mkdir(out,{recursive:true});await mkdir(root+'test-results/tcg-i3-m6-r9',{recursive:true});
const report={passed:false,suites:[]};
try{
 for(const s of [
  {entry:'tests/r9/native.mjs',native:true,path:'test-results/tcg-i3-m6-r9/admission-native.json',cases:10,races:6},
  {entry:'tests/tcg-i3-m6-r9-regression-test.mjs',native:true,path:'test-results/tcg-i3-m6-r9-regression-native.json',cases:22},
  {entry:'tests/r9/provider-test.cjs'},
  {entry:'tests/tcg-i3-m6-collect-test.mjs'},
  {entry:'tests/tcg-i3-m6-transport-test.mjs'},
 ]){
  const args=[...(s.native?['--import',root+'tests/r13/package-source.mjs']:[]),root+s.entry,...(s.native?['--native']:[])];
  const r=spawnSync(process.execPath,args,{cwd:root,env:process.env,encoding:'utf8',maxBuffer:32*1024*1024,timeout:900000});
  const record={entry:s.entry,args,exit_code:r.status,error:r.error?.message};report.suites.push(record);
  await writeFile(out+s.entry.split('/').at(-1)+'.log',r.stdout+'\n'+r.stderr);
  assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr);
  if(s.path){const bytes=await readFile(root+s.path);await writeFile(out+s.path.split('/').at(-1),bytes);const j=JSON.parse(bytes);assert.equal(j.passed,true);assert.equal(j.cases.length,s.cases);if(s.races)assert.equal(j.races.length,s.races);record.cases=j.cases.length;record.races=j.races?.length;}
  console.log('PASS',s.entry);
 }
 report.passed=true;
}catch(e){report.error={message:e.message,stack:e.stack};process.exitCode=1;console.error(e);}
finally{await writeFile(out+'regressions.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
