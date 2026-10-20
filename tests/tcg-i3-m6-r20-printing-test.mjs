import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const M=require('../tcg-magic-on-demand.js'),API=require('../api/tcg-magic-scryfall.js');
const fixture=JSON.parse(readFileSync(new URL('./fixtures/tcg-i3-magic/contract-v1.json',import.meta.url)));
globalThis.fetch=()=>{throw Error('LIVE_IO_FORBIDDEN');};
const time='2026-10-16T07:00:00.000Z',now=()=>Date.parse(time);
// Synthetic records, not captured Scryfall responses or claims of a live lookup.
const cases=[
 {set:'dsk',name:'Abhorrent Oculus',number:'344',printed:'0344',id:'40000000-0000-4000-8000-000000000001',border_color:'borderless',frame_effects:[]},
 {set:'ecl',name:'High Perfect Morcant',number:'373',printed:'0373',id:'40000000-0000-4000-8000-000000000002',border_color:'black',frame_effects:['extendedart']}
];
const raw=c=>({...structuredClone(fixture.raw),set:c.set,name:c.name,collector_number:c.number,id:c.id,border_color:c.border_color,frame_effects:c.frame_effects});
const input=(c,number=c.number)=>({set_code:c.set.toUpperCase(),collector_number:number,language:'EN'});
const res=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const request=q=>({method:'GET',url:'/api/tcg-magic-scryfall?'+new URLSearchParams(q),headers:{authorization:'Bearer synthetic'}});
function harness(c,{authorized=true,approved=true,reserved=true,status=200,payload=raw(c)}={}){
 const calls=[];
 const transport=API.createTransport({clock:()=>time,fetch:async(url)=>{calls.push(['provider',url]);return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json'}});}});
 const handler=API.createOperationalMockHandler({now,serverApproved:approved,transport,
  authorize:async()=>{calls.push(['authorize']);return authorized?{userId:'synthetic-user'}:null;},
  reserve:async(token,id)=>{calls.push(['reserve']);return {contract:'magic-collect-transport/1',request_id:id,user_id:'synthetic-user',reserved,reserved_at:time};}});
 return {calls,handler};
}
for(const c of cases){
 for(const number of [c.printed,c.number])test(`${c.set}/${number}/EN resolves exact synthetic printing with one request`,async()=>{
  const h=harness(c),r=res(),q=input(c,number);await h.handler(request(q),r);
  assert.equal(r.code,200);assert.equal(r.body.status,'candidates');
  assert.equal(r.body.candidate.name,c.name);assert.equal(r.body.candidate.number,c.number);
  assert.equal(r.body.candidate.provider_ref.external_id,c.id);
  assert.deepEqual(h.calls.map(x=>x[0]),['authorize','reserve','provider']);
  assert.equal(h.calls[2][1],`https://api.scryfall.com/cards/${c.set}/${c.number}/en`);
  // Original provider number, identity, source fingerprint and variant projection
  // are identical to the already working unpadded path; do not invent finish evidence.
  assert.deepEqual(r.body,M.translatePrinting(raw(c),input(c),time));
 });
 test(`${c.set} aliases do not merge a different number, set, language or record`,()=>{
  const q=input(c,c.printed),original=raw(c),snapshot=structuredClone(original);
  for(const changed of [{collector_number:c.number+'a'},{collector_number:c.printed},{set:'other'},{lang:'de',printed_name:'Synthetic German'}])
   assert.equal(M.translatePrinting({...original,...changed},q,time).status,'no_match');
  const other={...original,id:'40000000-0000-4000-8000-000000000003',frame_effects:['showcase']};
  const a=M.translatePrinting(original,q,time).candidate,b=M.translatePrinting(other,q,time).candidate;
  assert.notEqual(a.provider_ref.external_id,b.provider_ref.external_id);
  assert.notEqual(a.source.record_version,b.source.record_version);assert.deepEqual(original,snapshot);
 });
}
test('unconfirmed numeric padding, zero and alphanumeric identifiers retain exact bytes',()=>{
 for(const [set,number] of [['zzm','0001'],['zzm','0344'],['dsk','000344'],['dsk','0345'],['ecl','0374'],['dsk','0344a'],['ecl','0373★'],['zzm','0001/α★'],['zzm','0'],['zzm','0000']]){
  const q={set_code:set,collector_number:number,language:'EN'},r={...fixture.raw,set,collector_number:number};
  assert.equal(M.printingInput(q).collector_number,number);
  assert.equal(M.translatePrinting(r,q,time).candidate.number,number);
 }
});
test('invalid input rejects before authorization, reservation and provider',async()=>{
 for(const number of ['', '..', '0344?x=1',' 0344','0344 ','x'.repeat(129)]){
  const h=harness(cases[0]),r=res();await h.handler(request(input(cases[0],number)),r);
  assert.equal(r.code,400);assert.equal(r.body.error,'invalid_printing_query');assert.deepEqual(h.calls,[]);
 }
});
test('missing bearer, denied admission, server OFF and budget denial retain fail-closed order',async()=>{
 for(const [opts,missing,code,steps] of [[{},true,401,[]],[{authorized:false},false,403,['authorize']],[{approved:false},false,503,['authorize']],[{reserved:false},false,503,['authorize','reserve']]]){
  const h=harness(cases[0],opts),r=res(),req=request(input(cases[0],'0344'));if(missing)req.headers={};
  await h.handler(req,r);assert.equal(r.code,code);assert.deepEqual(h.calls.map(x=>x[0]),steps);
 }
});
test('no_match, provider error and unsupported printing remain distinct with no retry',async()=>{
 for(const [opts,code,status,error] of [[{status:404},404,'no_match',undefined],[{status:500},502,'error','provider_unavailable'],[{payload:{...raw(cases[0]),layout:'token'}},200,'unsupported',undefined]]){
  const h=harness(cases[0],opts),r=res();await h.handler(request(input(cases[0],'0344')),r);
  assert.equal(r.code,code);assert.equal(r.body.status,status);assert.equal(r.body.error,error);
  assert.equal(h.calls.filter(x=>x[0]==='provider').length,1);
 }
});
