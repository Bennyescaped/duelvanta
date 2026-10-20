import assert from 'node:assert/strict';
import {setup as history74,BASE as R22,read,capture} from '../r22-r3-r2/package.mjs';
export * from '../r22-r3-r2/package.mjs';
export async function setup(native){
 const db=await history74(native);
 await db.exec('begin');await db.exec(await read(R22+'migration.sql'));
 await db.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2)',['20261018125255','dv_staging_magic_scanner_r22_r3_v1']);await db.exec('commit');
 const actual=await capture(db),stage=JSON.parse(await read('tests/r23/staging-baseline.json'));
 assert.deepEqual(actual.history,stage.history,'exact real History75');
 assert.deepEqual(actual.inventory,stage.inventory,'complete History75 inventory matches read-only Staging capture');
 assert.equal(actual.readiness.security.compatible,true);assert.equal(actual.readiness.legal.compatible,true);
 return db;
}
