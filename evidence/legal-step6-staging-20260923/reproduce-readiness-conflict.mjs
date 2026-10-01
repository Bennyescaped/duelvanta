// Diagnostic only: in-memory PGlite, no application rows, no network. Does not update expected hashes.
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {gunzipSync} from 'node:zlib';
import {readFile,writeFile} from 'node:fs/promises';
import {legalSchemaFixture} from '../../tests/helpers/legal-schema-fixture.mjs';
const sql=await readFile(new URL('../../supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql',import.meta.url),'utf8');
const live=JSON.parse(gunzipSync(await readFile(new URL('./staging-catalog.json.gz',import.meta.url))));
const expected=JSON.parse(sql.match(/\$catalog\$(.*?)\$catalog\$/s)[1]);
const projection=sql.slice(sql.indexOf('  with required_tables'),sql.indexOf(' from checks into actual;'))+' from checks';
const results=[];
for(const mode of ['baseline','live_indexes','live_defaults','live_indexes_and_defaults']){
 const db=new PGlite({extensions:{pgcrypto}});
 try {
  await legalSchemaFixture(db);
  if(mode.includes('indexes'))for(const i of live.indexes)await db.exec(i.indexdef.replace('CREATE UNIQUE INDEX ','CREATE UNIQUE INDEX IF NOT EXISTS ').replace('CREATE INDEX ','CREATE INDEX IF NOT EXISTS '));
  if(mode.includes('defaults'))await db.exec('alter default privileges for role postgres in schema public grant execute on functions to anon,authenticated,service_role');
  await db.exec(sql);
  await db.exec('set search_path=pg_catalog,public');
  const readiness=(await db.query('select public.get_market_legal_schema_readiness_v1() as r')).rows[0].r;
  const actual=(await db.query(projection)).rows[0].jsonb_agg;
  const diffs=actual.filter(x=>!expected.some(e=>JSON.stringify(x)===JSON.stringify(e)));
  const grants=(await db.query("select proname,has_function_privilege('service_role',oid,'EXECUTE') as service_execute from pg_proc where pronamespace='public'::regnamespace and proname in ('review_market_price_offer_v1','create_market_offer_v3','get_my_market_withdrawable_contracts','prepare_fixed_price_market_offer_v1','prepare_market_withdrawal_v1','confirm_market_withdrawal_v1') order by proname")).rows;
  results.push({mode,readiness,diffs,grants});
 }finally{await db.close()}
}
await writeFile(new URL('./rehearsal-result.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
