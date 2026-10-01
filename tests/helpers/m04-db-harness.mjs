// Private M04 test infrastructure. Native mode: an explicitly owned PG17 UNIX
// socket cluster only. --syntax: PGlite DDL/catalog inspection, NEVER P01-P32.
import assert from 'node:assert/strict';
import {readFile, stat, mkdir, writeFile} from 'node:fs/promises';
import {resolve, basename, isAbsolute} from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import readline from 'node:readline';
import {installW11} from './w11-native-fixture.mjs';
import {installW11 as installHistoryW11} from './m04-history-native-fixture.mjs';

// P26 observation only. JSON uses .log to match the existing artifact upload.
// No environment dump: only the four non-secret local connection selectors.
const p26Environment=()=>Object.fromEntries(['PGHOST','PGPORT','PGUSER','PGDATABASE'].map(k=>[k,process.env[k]??null]));
const p26Error=e=>({code:e.code??null,message:e.message});
const p26Stat=async path=>{
 try {const s=await stat(path);return {path,exists:true,size:s.size,uid:s.uid,gid:s.gid,mode:(s.mode&0o7777).toString(8),mtime:s.mtime.toISOString(),mtime_ms:s.mtimeMs};}
 catch(e){return {path,exists:e.code==='ENOENT'?false:null,error:p26Error(e)};}
};
const p26Process=pid=>{
 if(!Number.isSafeInteger(pid)||pid<=0)return {pid,exists:null};
 try{process.kill(pid,0);return {pid,exists:true};}
 catch(e){return {pid,exists:e.code==='ESRCH'?false:e.code==='EPERM'?true:null,error:p26Error(e)};}
};
const p26State=async(dir,socket,before,ports)=>{
 const pidPath=resolve(dir,'postmaster.pid'),pidfile=await p26Stat(pidPath);
 if(pidfile.exists){try{pidfile.text=await readFile(pidPath,'utf8');pidfile.process=p26Process(Number(pidfile.text.split('\n')[0]));}catch(e){pidfile.read_error=p26Error(e);}}
 const listeners={};
 for(const path of ['/proc/net/tcp','/proc/net/tcp6']){
  try{const lines=(await readFile(path,'utf8')).split('\n');listeners[path]={header:lines[0],listen_rows:lines.slice(1).filter(line=>{const f=line.trim().split(/\s+/);return f[3]==='0A'&&ports.includes(parseInt(f[1]?.split(':')[1],16));})};}
  catch(e){listeners[path]={error:p26Error(e)};}
 }
 return {monotonic_ns:process.hrtime.bigint().toString(),data_directory:dir,system_identifier_before_stop:before.system_identifier,
  socket,port:before.port,old_postmaster:p26Process(before.pid),pidfile,directory:await p26Stat(dir),socket_directory:await p26Stat(socket),
  socket_files:await Promise.all(ports.map(port=>p26Stat(resolve(socket,'.s.PGSQL.'+port)))),local_tcp_listeners:listeners};
};
const p26Config=async(bin,dir)=>{
 const values={};
 for(const key of ['listen_addresses','port','unix_socket_directories','fsync','synchronous_commit']){
  const executable=resolve(bin,'../postgres'),args=['-D',dir,'-C',key];
  try{const r=await promisify(execFile)(executable,args,{timeout:10000});values[key]={argv:[executable,...args],exitcode:0,stdout:r.stdout,stderr:r.stderr};}
  catch(e){values[key]={argv:[executable,...args],exitcode:typeof e.code==='number'?e.code:null,stdout:e.stdout??'',stderr:e.stderr??'',error:p26Error(e)};}
 }
 return {source:'read-only postgres -C: configuration files without initial-start command-line overrides',values};
};
const p26Save=async observation=>{
 const output=resolve('test-results');await mkdir(output,{recursive:true});
 const log=await p26Stat(observation.log_path);
 if(log.exists){try{const bytes=await readFile(observation.log_path);log.byte_length=bytes.length;log.sha256=createHash('sha256').update(bytes).digest('hex');log.base64=bytes.toString('base64');
  log.artifact=historyMode?'m04-r28-postmaster.log':'m04-p26-postmaster.log';await writeFile(resolve(output,log.artifact),bytes);
 }catch(e){log.read_or_copy_error=p26Error(e);}}
 observation.postmaster_log=log;
 await writeFile(resolve(output,historyMode?'m04-r28-restart-observation.log':'m04-p26-restart-observation.log'),JSON.stringify(observation,null,2)+'\n');
};
const p26Command=async(observation,bin,args)=>{
 const record={argv:[bin,...args],cwd:process.cwd(),pg_environment:p26Environment(),monotonic_start_ns:process.hrtime.bigint().toString()};
 observation.commands.push(record);
 try{const r=await promisify(execFile)(bin,args,{timeout:60000});Object.assign(record,{exitcode:0,stdout:r.stdout,stderr:r.stderr});return r;}
 catch(e){Object.assign(record,{exitcode:typeof e.code==='number'?e.code:null,signal:e.signal??null,killed:e.killed??false,stdout:e.stdout??'',stderr:e.stderr??'',error:p26Error(e)});throw e;}
 finally{record.monotonic_end_ns=process.hrtime.bigint().toString();}
};
// End P26 observation helpers.

const historyMode=process.argv.includes('--history');
const installFixture=historyMode?installHistoryW11:installW11;
const ddl=await readFile(new URL('../../database/psttg-m04-response-store-v1.sql',import.meta.url),'utf8')+
 (historyMode?await readFile(new URL('../../database/psttg-m04-adapter-history-v1.sql',import.meta.url),'utf8'):'');
if(process.argv.includes('--syntax')) {
 const {PGlite}=await import('@electric-sql/pglite');
 const {pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');
 const p=new PGlite({extensions:{pgcrypto}});
 const db={query:(...a)=>p.query(...a),exec:s=>p.exec(s),connect:async()=>p,release:async()=>{}};
 await installFixture(db);await p.exec(ddl);
 const tables=(await p.query("select c.relname,c.relrowsecurity,c.relacl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='dv_market_private' and c.relname like 'm04_%' and c.relkind='r' order by 1")).rows;
 const functions=(await p.query("select p.proname,p.prosecdef,p.provolatile,p.proconfig,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and p.proname like 'm04_%' order by 1")).rows;
 assert.equal(tables.length,3);assert.ok(tables.every(t=>t.relrowsecurity));
 assert.ok(functions.every(f=>f.proconfig.includes('search_path=""')));
 console.log(JSON.stringify({mode:'PGLITE_DDL_STRUCTURE_ONLY',native_status:'NATIVE_NOT_RUN',tables,functions}));
 await p.close();
} else {
 assert.ok(process.argv.includes('--native'),'explicit --native or --syntax required');
 assert.notEqual(process.getuid(),0,'no root runtime');
 const dir=process.env.M04_PG_DATA,bin=process.env.M04_PG_CTL,socket=process.env.PGHOST;
 assert.ok(dir&&bin&&socket&&[dir,bin,socket].every(isAbsolute));
 assert.ok(basename(dir).startsWith('m04_isolated_')&&basename(bin)==='pg_ctl');
 assert.equal(resolve(socket),resolve(dir,'socket'));assert.equal(process.env.PGDATABASE,'postgres');
 const {default:pg}=await import('pg');
 let admin,primary;const connections=new Set(),handles=new Map();let counter=0;
 const name='m04_ci_'+randomUUID().replaceAll('-','');
 const openAdmin=async()=>{admin=new pg.Client({connectionTimeoutMillis:5000});admin.on('error',()=>{});await admin.connect();};
 await openAdmin();
 const metadata=async()=>{
  const row=(await admin.query("select current_setting('data_directory') data_directory,(pg_control_system()).system_identifier::text system_identifier,current_setting('unix_socket_directories') socket,current_setting('port') port,pg_postmaster_start_time()::text start_time,current_setting('server_version_num') version,current_setting('fsync') fsync,current_setting('synchronous_commit') synchronous_commit,current_setting('listen_addresses') listen_addresses,current_user,session_user")).rows[0];
  row.pid=Number((await readFile(resolve(dir,'postmaster.pid'),'utf8')).split('\n')[0]);
  assert.equal(resolve(row.data_directory),resolve(dir));assert.equal(resolve(row.socket),resolve(socket));
  assert.equal(Math.floor(Number(row.version)/10000),17);assert.equal(row.fsync,'on');assert.equal(row.synchronous_commit,'on');return row;
 };
 const initial=await metadata();await admin.query(`create database ${name}`);
 const connect=async()=>{const c=new pg.Client({database:name,connectionTimeoutMillis:5000});c.on('error',()=>{});await c.connect();connections.add(c);await c.query("set statement_timeout='20s';set idle_in_transaction_session_timeout='60s';set timezone='UTC'");return c;};
 const release=async c=>{if(connections.has(c)){await c.end();connections.delete(c);}};
 primary=await connect();
 const db={query:(...a)=>primary.query(...a),exec:s=>primary.query(s),connect,release};
 const fixture=await installFixture(db);await db.exec(ddl);
 console.log(JSON.stringify({ready:true,native:true,version:initial.version,name,cluster:initial}));
 const lines=readline.createInterface({input:process.stdin});
 const answer=(id,result,error)=>process.stdout.write(JSON.stringify({id,result,error})+'\n');
 lines.on('line',async line=>{
  let r;try{
   assert.ok(line.length<=64*1024*1024);r=JSON.parse(line);let result;
   if(r.op==='open'){result=String(++counter);handles.set(result,await connect());}
   else if(r.op==='context')result=await fixture.context(r.revision,r.predecessor??null);
   else if(r.op==='query'){
    const c=handles.get(r.connection);assert.ok(c,'closed local connection');
    result=(await c.query(r.sql,r.params??[])).rows;
   }else if(r.op==='release'){const c=handles.get(r.connection);if(c)await release(c);handles.delete(r.connection);result=true;}
   else if(r.op==='metadata')result=await metadata();
   else if(r.op==='restart'){
    const before=await metadata();
    // One option string from the bound successful first-start runtime; never defaults.
    for(const key of ['socket','port','listen_addresses','fsync','synchronous_commit','current_user','session_user'])assert.equal(before[key],initial[key]);
    assert.match(initial.socket,/^\/[a-zA-Z0-9_./-]+$/);assert.match(initial.port,/^[0-9]+$/);
    assert.equal(initial.listen_addresses,'');assert.equal(initial.fsync,'on');assert.equal(initial.synchronous_commit,'on');
    assert.equal(initial.current_user,'postgres');assert.equal(initial.session_user,'postgres');
    const startOptions=`-k ${initial.socket} -p ${initial.port} -c listen_addresses='${initial.listen_addresses}' -c fsync=${initial.fsync} -c synchronous_commit=${initial.synchronous_commit}`;
    const observation={version:historyMode?'M04-R28-observation/1':'M04-P26-observation/1',before,log_path:resolve(dir,'postmaster.log'),cwd:process.cwd(),pg_environment:p26Environment(),commands:[],diagnostic_errors:[],first_start_bound:initial,restart_options:startOptions};
    // Observation failures are recorded, never substituted for the pg_ctl error.
    const observe=async(label,fn)=>{try{return await fn();}catch(e){observation.diagnostic_errors.push({label,...p26Error(e)});}};
    await observe('bind_log_before_stop',()=>p26Save(observation));
    for(const c of [...connections])await release(c);handles.clear();await admin.end();
    let ended=false;
    try{
     await p26Command(observation,bin,['-D',dir,'-m','fast','-w','stop']);
     try{process.kill(before.pid,0);}catch(e){assert.equal(e.code,'ESRCH');ended=true;}assert.ok(ended,'old postmaster must be absent');
     observation.configuration=await observe('read_configuration',()=>p26Config(bin,dir));
     const configuredPort=Number(observation.configuration?.values.port?.stdout);
     const ports=[...new Set([Number(before.port),configuredPort].filter(p=>Number.isInteger(p)&&p>0&&p<=65535))];
     observation.before_start=await observe('state_before_start',()=>p26State(dir,socket,before,ports));
     await observe('save_before_start',()=>p26Save(observation));
     try{await p26Command(observation,bin,['-D',dir,'-l',resolve(dir,'postmaster.log'),'-o',startOptions,'-w','start']);}
     catch(e){observation.after_failed_start=await observe('state_after_failed_start',()=>p26State(dir,socket,before,ports));throw e;}
    }catch(e){observation.failure=p26Error(e);throw e;}
    finally{await observe('save_after_pg_ctl',()=>p26Save(observation));if(observation.diagnostic_errors.length)process.stderr.write(JSON.stringify({p26_diagnostic_errors:observation.diagnostic_errors})+'\n');}
    await openAdmin();primary=await connect();const after=await metadata();
    assert.equal(after.system_identifier,before.system_identifier);assert.equal(after.data_directory,before.data_directory);
    assert.equal(after.socket,before.socket);assert.equal(after.port,before.port);assert.notEqual(after.pid,before.pid);assert.notEqual(after.start_time,before.start_time);
    for(const key of ['socket','port','listen_addresses','fsync','synchronous_commit','current_user','session_user'])assert.equal(after[key],initial[key]);
    observation.after_successful_start=after;observation.start_options_parity=true;
    await observe('save_after_successful_start',()=>p26Save(observation));
    result={before,after,old_postmaster_ended:ended,initdb_during_restart:false};
   }else if(r.op==='close'){
    for(const c of [...connections])await release(c);await admin.query(`drop database ${name} with (force)`);await admin.end();answer(r.id,true);lines.close();return;
   }else throw Error('closed M04 harness operation');
   answer(r.id,result);
  }catch(e){answer(r?.id,null,{message:e.message,code:e.code??null});}
 });
}
