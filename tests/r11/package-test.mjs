import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {database} from '../helpers/tcg-i3-magic-fixture.mjs';
import {history72} from '../r9/author.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const base=root+'database/target-upgrades/staging-m6-r4-v1/';
const out=root+'test-results/tcg-i3-m6-r11/';
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=p=>readFile(p,'utf8');
const report={contract:'staging72-r4-package/1',passed:false,engine:'native-PG17',synthetic_only:true,real_apply_authorized:false,cases:[],suites:[]};let db;
await mkdir(out,{recursive:true});await mkdir(root+'test-results/tcg-i3-m6-r9',{recursive:true});
async function checked(id,fn){const evidence=await fn();report.cases.push({id,status:'PASS',evidence});console.log('PASS',id);}
async function checkSQL(path){await db.exec('begin read only');try{return (await db.query(await read(base+path))).rows[0];}finally{await db.exec('rollback');}}
try{
 assert.ok(process.argv.includes('--native'));assert.equal(process.env.PGHOST,'127.0.0.1');assert.equal(process.env.PGUSER,'postgres');assert.equal(process.env.PGDATABASE,'postgres');
 const m=JSON.parse(await read(base+'manifest.json'));
 await checked('package-source-binding',async()=>{assert.equal(m.package_mode,'NOT_AUTO_APPLY');assert.equal(m.real_apply_authorized,false);assert.equal(m.units.length,1);assert.equal(m.units[0].version,null);assert.equal(m.required_history.length,72);assert.equal(hash(JSON.stringify(m.required_history)),m.history_identity_sha256);for(const f of m.files){const b=await readFile(base+f.path);assert.equal(b.length,f.bytes,f.path);assert.equal(hash(b),f.sha256,f.path);}assert.deepEqual(await readFile(base+m.units[0].query_path),await readFile(root+m.units[0].source_path));return {files:m.files,history72:m.history_identity_sha256};});
 db=await database(true);report.version=db.version;report.connection={host:'127.0.0.1',database:db.name,disposable:true};
 await history72(db);
 await db.exec('create schema if not exists supabase_migrations;create table if not exists supabase_migrations.schema_migrations(version text primary key,name text,statements text[])');
 assert.equal(Number((await db.query('select count(*) n from supabase_migrations.schema_migrations')).rows[0].n),0);
 for(const h of m.required_history)await db.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)',[h.version,h.name]);
 await checked('history72-original-precheck',async()=>{const r=await checkSQL('precheck.sql');assert.equal(r.PRECHECK_PASS,true);return r;});
 await checked('wrong-target-history-denied',async()=>{await db.exec('begin');try{await db.query("update supabase_migrations.schema_migrations set name='SYNTHETIC_WRONG_TARGET' where version=$1",[m.required_history[0].version]);const r=(await db.query(await read(base+'precheck.sql'))).rows[0];assert.equal(r.PRECHECK_PASS,false);return r;}finally{await db.exec('rollback');}});
 await checked('single-packaged-apply',async()=>{await db.exec(await read(base+m.units[0].query_path));await db.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)',['99999999999999',m.units[0].name]);return {apply_count:1,synthetic_history_version:'99999999999999',real_version_allocated:false};});
 await checked('history73-original-postcheck',async()=>{const r=await checkSQL('postcheck.sql');assert.equal(r.POSTCHECK_PASS,true);return r;});
 await checked('duplicate-apply-denied-before-sql',async()=>{const r=await checkSQL('precheck.sql');assert.equal(r.PRECHECK_PASS,false);return {precheck:r,second_apply_count:0};});
 await checked('unexpected-grant-denied',async()=>{await db.exec('begin');try{await db.exec('grant select on dv_collect_private.magic_collect_admission_v1 to authenticated');const r=(await db.query(await read(base+'postcheck.sql'))).rows[0];assert.equal(r.POSTCHECK_PASS,false);return r;}finally{await db.exec('rollback');}});
 await checked('postcheck-restored-beta-off-empty',async()=>{const r=await checkSQL('postcheck.sql');assert.equal(r.POSTCHECK_PASS,true);return r;});
 await db.close();db=null;
 const suites=[
  {entry:'tests/r9/native.mjs',report:'test-results/tcg-i3-m6-r9/admission-native.json',count:10,races:6,packaged:true},
  {entry:'tests/r9/catalog.mjs',report:'test-results/tcg-i3-m6-r9/catalog-acl-rls.json',packaged:true},
  {entry:'tests/r9/provider-test.cjs',report:null,packaged:false},
  {entry:'tests/tcg-i3-m6-r9-regression-test.mjs',report:'test-results/tcg-i3-m6-r9-regression-native.json',count:22,packaged:true},
 ];
 for(const [i,s] of suites.entries()){
  const args=[...(s.packaged?['--import',root+'tests/r11/package-source.mjs']:[]),root+s.entry,...(s.entry.endsWith('.mjs')?['--native']:[])];
  const c=spawnSync(process.execPath,args,{cwd:root,env:process.env,encoding:'utf8',maxBuffer:32*1024*1024,timeout:900000});
  await writeFile(out+`suite-${i}.log`,c.stdout+'\n'+c.stderr);
  const record={entry:s.entry,args,exit_code:c.status,error:c.error?.message,packaged:s.packaged};report.suites.push(record);
  assert.equal(c.error,undefined);assert.equal(c.status,0,c.stderr);
  if(s.report){const bytes=await readFile(root+s.report);await writeFile(out+s.report.split('/').at(-1),bytes);const r=JSON.parse(bytes);
   if(s.entry==='tests/r9/catalog.mjs'){
    assert.equal(r.members,0);assert.equal(r.beta.length,1);assert.equal(r.beta[0].enabled,false);
    assert.equal(r.relations.length,3);assert.ok(r.relations.every(x=>x.owner==='postgres'&&x.rls));
    assert.equal(r.rights.length,72);assert.ok(r.rights.every(x=>x.allowed===false));
    assert.deepEqual(r.trade_lock_after,r.trade_lock_before);
    assert.equal(r.flags[0].available,false);assert.equal(r.flags[0].marketplace_ready,false);
    assert.equal(r.release[0].state,'foundation');assert.equal(r.release[0].snapshot_id,null);
   }else assert.equal(r.passed,true);
   if(s.count)assert.equal(r.cases.length,s.count);if(s.races)assert.equal(r.races.length,s.races);record.report_sha256=hash(bytes);record.cases=r.cases?.length;record.races=r.races?.length;}
 }
 report.passed=true;
}catch(e){report.error={message:e.message,stack:e.stack};process.exitCode=1;console.error(e);}
finally{if(db)await db.close();await writeFile(out+'package-native.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,cases:report.cases.length,suites:report.suites.length,error:report.error}));}
