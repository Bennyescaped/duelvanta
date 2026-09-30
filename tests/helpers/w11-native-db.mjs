// N19-specific lifecycle around the existing localhost/PG17 disposable DB pattern.
// Unlike f3-native-db, this helper must close its admin connection before restart.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {basename,isAbsolute,resolve} from 'node:path';
import pg from 'pg';
export async function createW11Database(){
 assert.ok(['localhost','127.0.0.1'].includes(process.env.PGHOST));
 assert.equal(process.env.PGDATABASE,'postgres');
 let admin;const clients=[];const name='f3_ci_'+randomUUID().replaceAll('-','');
 const adminConnect=async()=>{admin=new pg.Client({connectionTimeoutMillis:5000});admin.on('error',()=>{});await admin.connect();};
 await adminConnect();const version=(await admin.query('show server_version_num')).rows[0].server_version_num;
 assert.equal(Math.floor(Number(version)/10000),17,'native PG17 required');
 assert.equal((await admin.query('show fsync')).rows[0].fsync,'on');
 await admin.query(`create database ${name}`);
 const connect=async()=>{const c=new pg.Client({database:name,connectionTimeoutMillis:5000});c.on('error',()=>{});await c.connect();await c.query("set statement_timeout='12s';set idle_in_transaction_session_timeout='30s'");clients.push(c);return c};
 let client=await connect();
 return {name,version,connect,query:(...args)=>client.query(...args),exec:s=>client.query(s),
  restart:async()=>{
   const bin=process.env.W11_PG_CTL,dir=process.env.W11_PG_DATA;
   assert.ok(bin&&dir&&isAbsolute(bin)&&isAbsolute(dir)&&basename(bin)==='pg_ctl'&&basename(dir).startsWith('w11_isolated_'),'N19 explicit disposable pg_ctl/data capability required');
   assert.equal(resolve((await admin.query('show data_directory')).rows[0].data_directory),resolve(dir));
   // No administrative client is left to receive an unhandled shutdown event.
   for(const c of clients)await c.end();clients.length=0;await admin.end();
   await promisify(execFile)(bin,['-D',dir,'-m','fast','-w','restart'],{timeout:60000});
   await adminConnect();client=await connect();
   assert.equal(Math.floor(Number((await admin.query('show server_version_num')).rows[0].server_version_num)/10000),17);
   return {restarted:true};
  },close:async()=>{
   for(const c of clients)await c.end();await admin.query(`drop database ${name} with (force)`);
   await admin.query('drop role if exists anon,authenticated,service_role');await admin.end();
  }};
}
