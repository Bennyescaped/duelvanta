// Private test-only stdio driver. No application import, HTTP or remote DB route.
import readline from 'node:readline';
import assert from 'node:assert/strict';
import {installW11} from './w11-native-fixture.mjs';
const native=process.argv.includes('--native');
assert.ok(native!==process.argv.includes('--pglite'),'Explicit native or PGlite preflight mode required');
let db;
if(native) db=await(await import('./w11-native-db.mjs')).createW11Database();
else {
 const {PGlite}=await import('@electric-sql/pglite');const {pgcrypto}=await import('@electric-sql/pglite/contrib/pgcrypto');
 // No emulated durability setting: the native write gate must reject fsync=off.
 const p=new PGlite({extensions:{pgcrypto}});db={query:(...a)=>p.query(...a),exec:s=>p.exec(s),connect:async()=>p,release:async()=>{},close:()=>p.close()};
}
const fixture=await installW11(db);
// PGlite has one shared engine: release removes only its logical handle.
// Native release ends exactly one pg.Client and removes its registration.
const clients=new Map(),closed=new Set(),closing=new Map();let counter=0;
const open=async()=>{const id=String(++counter);clients.set(id,await db.connect());return id};
const answer=(id,result,error)=>process.stdout.write(JSON.stringify({id,result,error})+'\n');
console.log(JSON.stringify({ready:true,native,version:db.version??'PGlite-only',name:db.name??null}));
const lines=readline.createInterface({input:process.stdin});
lines.on('line',async line=>{
 let r;
 try{
  assert.ok(line.length<=64*1024*1024);r=JSON.parse(line);let result;
  if(r.op==='open')result=await open();
  else if(r.op==='context')result=await fixture.context(r.revision,r.predecessor??null);
  else if(r.op==='quarantine'){await fixture.quarantine(r.channel);result=true;}
  else if(r.op==='query'){
   const c=clients.get(r.connection);assert.ok(c&&!closing.has(r.connection),'unknown or closed isolated connection');
   const params=(r.params??[]).map(x=>typeof x==='string'&&/^\\x[0-9a-f]+$/.test(x)?Buffer.from(x.slice(2),'hex'):x);
   result=(await c.query(r.sql,params)).rows;
  }else if(r.op==='release'){
   const id=r.connection;assert.ok(typeof id==='string'&&/^[1-9][0-9]*$/.test(id),'invalid isolated connection');
   if(closed.has(id))result=true;
   else{
    assert.ok(clients.has(id),'unknown isolated connection');
    if(!closing.has(id))closing.set(id,db.release(clients.get(id)).then(()=>{clients.delete(id);closed.add(id);closing.delete(id);return true;}));
    // Failed release remains closed to queries; global teardown can still clean it.
    result=await closing.get(id);
   }
  }else if(r.op==='restart'){
   assert.ok(native,'N19 requires native PG17');
   result=await db.restart();clients.clear();closed.clear();closing.clear();
  }else if(r.op==='close'){await db.close();answer(r.id,true);lines.close();return;}
  else throw Error('closed harness operation');
  answer(r.id,result);
 }catch(e){answer(r?.id,null,{message:e.message,code:e.code??null});}
});
