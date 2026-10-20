// Reuse unchanged R9/M6 assertions against the exact R4 + forward R13 path.
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=resolve(root,'database/local-candidates/magic-collect-admission-r9/candidate.sql');
const base=resolve(root,'database/target-upgrades/staging-m6-r5-v1');
const read=fs.readFile.bind(fs),original=await read(source);
assert.equal(original.length,429197);
assert.equal(createHash('sha256').update(original).digest('hex'),'b0dc4073eceae3727b07c67890dc98e5f431ebba8146d9fbff0a4285e897c88b');
const manifest=JSON.parse(await read(base+'/manifest.json','utf8'));
const unit=await read(resolve(base,manifest.units[0].query_path));
assert.equal(unit.length,manifest.units[0].query_bytes);
assert.equal(createHash('sha256').update(unit).digest('hex'),manifest.units[0].query_sha256);
const combined=Buffer.concat([original,Buffer.from('\n'),unit]);let reads=0;
fs.readFile=async function(path,...options){
 const name=path instanceof URL?fileURLToPath(path):typeof path==='string'?resolve(path):null;
 if(name===source){reads++;const encoding=typeof options[0]==='string'?options[0]:options[0]?.encoding;return encoding?combined.toString(encoding):Buffer.from(combined);}
 return read(path,...options);
};
syncBuiltinESMExports();
process.on('exit',()=>{console.log(JSON.stringify({r13_packaged_regression:true,reads,unit_sha256:manifest.units[0].query_sha256}));if(reads!==1)process.exitCode=1;});
