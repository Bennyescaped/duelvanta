import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {history72} from '../r9/author.mjs';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const base=root+'database/target-upgrades/staging-m6-r5-v1/';
export async function history73(db){
 await history72(db);
 await db.exec(await readFile(root+'database/target-upgrades/staging-m6-r4-v1/migration-units/dv_staging_m6r4_01_magic_collect_admission.sql','utf8'));
 const m=JSON.parse(await readFile(root+'database/target-upgrades/staging-m6-r4-v1/manifest.json','utf8'));
 const history=[...m.required_history,{version:'20261014192812',name:'dv_staging_m6r4_01_magic_collect_admission'}];
 await db.exec('create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])');
 for(const h of history)await db.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)',[h.version,h.name]);
 assert.equal((await db.query(await readFile(root+'database/target-upgrades/staging-m6-r4-v1/postcheck.sql','utf8'))).rows[0].POSTCHECK_PASS,true);
 return history;
}
