// Route only the frozen candidate read to its byte-identical packaged unit.
// No test source, assertion, database call or report is changed.
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=resolve(root,'database/local-candidates/magic-collect-admission-r9/candidate.sql');
const unit=resolve(root,'database/target-upgrades/staging-m6-r4-v1/migration-units/dv_staging_m6r4_01_magic_collect_admission.sql');
const read=fs.readFile.bind(fs),bytes=await read(unit);
assert.equal(bytes.length,429197);
assert.equal(createHash('sha256').update(bytes).digest('hex'),'b0dc4073eceae3727b07c67890dc98e5f431ebba8146d9fbff0a4285e897c88b');
assert.deepEqual(bytes,await read(source));
let reads=0;
fs.readFile=async function(path,...options){
 const name=path instanceof URL?fileURLToPath(path):typeof path==='string'?resolve(path):null;
 if(name===source){reads++;return read(unit,...options);}
 return read(path,...options);
};
syncBuiltinESMExports();
process.on('exit',()=>{console.log(JSON.stringify({r11_packaged_source:unit,reads,sha256:'b0dc4073eceae3727b07c67890dc98e5f431ebba8146d9fbff0a4285e897c88b'}));if(reads!==1)process.exitCode=1;});
