import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../scanner-v16-entry.js',import.meta.url),'utf8');
for(const [folder,expected] of [['','scanner-v16.html'],['__graded__','scanner-v16.html'],['folder id','scanner-v16.html?folder=folder%20id']]){
  const button={};let target;
  vm.runInNewContext(code,{document:{getElementById:()=>button},activeFolder:folder,location:{assign:u=>target=u}});
  button.onclick();assert.equal(target,expected);
}
console.log('PASS COLLECT opens V16 and preserves selected binder');
