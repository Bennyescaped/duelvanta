import {publicationFixture,admin} from './publication-hold-fixture.mjs';
import {read} from './security-schema-fixture.mjs';
export const tail=['publication-processing-hold-v1','publication-processing-hold-readiness-v1','battle-safety-sanctions-v1','battle-safety-sanctions-readiness-v1','account-deletion-withdrawal-v1','account-deletion-withdrawal-readiness-v1','account-erasure-l1-v1','account-erasure-l1-readiness-v1'];
export async function baseline(db){await publicationFixture(db);for(const name of tail)await db.exec(await read('database/'+name+'.sql'));await admin(db);await db.exec('set search_path=pg_catalog,public');}
export async function install(db,readiness=true){await db.exec(await read('database/tcg-i2-canonical-integration-v1.sql'));if(readiness)await db.exec(await read('database/tcg-i2-readiness-v1.sql'));}
