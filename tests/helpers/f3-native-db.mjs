import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
export async function createDatabase(){
 assert.ok(['localhost','127.0.0.1'].includes(process.env.PGHOST),'Only disposable localhost PostgreSQL permitted');
 assert.equal(process.env.PGDATABASE,'postgres');
 const admin=new pg.Client({connectionTimeoutMillis:5000});await admin.connect();
 const version=(await admin.query('show server_version_num')).rows[0].server_version_num;
 assert.equal(Math.floor(Number(version)/10000),17,'PostgreSQL 17 required');
 const name='f3_ci_'+randomUUID().replaceAll('-','');
 await admin.query(`create database ${name}`);
 const clients=[];
 const connect=async()=>{const c=new pg.Client({database:name,connectionTimeoutMillis:5000});await c.connect();await c.query("set statement_timeout='12s';set idle_in_transaction_session_timeout='30s'");clients.push(c);return c};
 const client=await connect();
 return {name,version,client,connect,query:(...args)=>client.query(...args),exec:sql=>client.query(sql),close:async()=>{
  for(const c of clients)await c.end();
  await admin.query(`drop database ${name}`);
  // Roles are cluster objects. This dedicated service hosts no other jobs/databases.
  await admin.query('drop role if exists anon, authenticated, service_role');await admin.end();
 }};
}
