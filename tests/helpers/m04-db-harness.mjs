// Private M04 test infrastructure. Native mode: an explicitly owned PG17 UNIX
// socket cluster only. --syntax: PGlite DDL/catalog inspection, NEVER P01-P32.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve, basename, isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import readline from 'node:readline';
import {installW11} from './w11-native-fixture.mjs';

const ddl=await readFile(new URL('../../database/psttg-m04-response-store-v1.sql',import.meta.url),'utf8');
if(process.argv.includes('--syntax')) {
 const {PGlite}=await import('@electric-sql/pglite');
 const {pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');
 const p=new PGlite({extensions:{pgcrypto}});
 const db={query:(...a)=>p.query(...a),exec:s=>p.exec(s),connect:async()=>p,release:async()=>{}};
 await installW11(db);await p.exec(ddl);
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
  const row=(await admin.query("select current_setting('data_directory') data_directory,(pg_control_system()).system_identifier::text system_identifier,current_setting('unix_socket_directories') socket,current_setting('port') port,pg_postmaster_start_time()::text start_time,current_setting('server_version_num') version,current_setting('fsync') fsync,current_setting('synchronous_commit') synchronous_commit")).rows[0];
  row.pid=Number((await readFile(resolve(dir,'postmaster.pid'),'utf8')).split('\n')[0]);
  assert.equal(resolve(row.data_directory),resolve(dir));assert.equal(resolve(row.socket),resolve(socket));
  assert.equal(Math.floor(Number(row.version)/10000),17);assert.equal(row.fsync,'on');assert.equal(row.synchronous_commit,'on');return row;
 };
 const initial=await metadata();await admin.query(`create database ${name}`);
 const connect=async()=>{const c=new pg.Client({database:name,connectionTimeoutMillis:5000});c.on('error',()=>{});await c.connect();connections.add(c);await c.query("set statement_timeout='20s';set idle_in_transaction_session_timeout='60s';set timezone='UTC'");return c;};
 const release=async c=>{if(connections.has(c)){await c.end();connections.delete(c);}};
 primary=await connect();
 const db={query:(...a)=>primary.query(...a),exec:s=>primary.query(s),connect,release};
 const fixture=await installW11(db);await db.exec(ddl);
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
    const before=await metadata();for(const c of [...connections])await release(c);handles.clear();await admin.end();
    await promisify(execFile)(bin,['-D',dir,'-m','fast','-w','stop'],{timeout:60000});
    let ended=false;try{process.kill(before.pid,0);}catch(e){assert.equal(e.code,'ESRCH');ended=true;}assert.ok(ended,'old postmaster must be absent');
    await promisify(execFile)(bin,['-D',dir,'-l',resolve(dir,'postmaster.log'),'-w','start'],{timeout:60000});
    await openAdmin();primary=await connect();const after=await metadata();
    assert.equal(after.system_identifier,before.system_identifier);assert.equal(after.data_directory,before.data_directory);
    assert.equal(after.socket,before.socket);assert.equal(after.port,before.port);assert.notEqual(after.pid,before.pid);assert.notEqual(after.start_time,before.start_time);
    result={before,after,old_postmaster_ended:ended,initdb_during_restart:false};
   }else if(r.op==='close'){
    for(const c of [...connections])await release(c);await admin.query(`drop database ${name} with (force)`);await admin.end();answer(r.id,true);lines.close();return;
   }else throw Error('closed M04 harness operation');
   answer(r.id,result);
  }catch(e){answer(r?.id,null,{message:e.message,code:e.code??null});}
 });
}
