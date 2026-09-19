// Run the shipped battle.js with deferred, isolated DB reads (no network/media).
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createContext, runInContext} from 'node:vm';
import {setImmediate as settle} from 'node:timers/promises';
const source = await readFile(process.env.BATTLE_SOURCE || new URL('../battle.js', import.meta.url), 'utf8');
const results = [];
function fixture() {
  const nodes = new Map(), requests = [], rpcCalls = [], alerts = [], timers = new Set();
  function node(id) {
    if (!nodes.has(id)) {
      const classes = new Set();
      nodes.set(id, {textContent:'', innerHTML:'', value:'', dataset:{}, onclick:null,
        classList:{add:x=>classes.add(x), remove:x=>classes.delete(x), contains:x=>classes.has(x),
          toggle(x,on){const add=on??!classes.has(x);add?classes.add(x):classes.delete(x);return add;}},
        showModal(){}, close(){}});
    }
    return nodes.get(id);
  }
  const db = {
    auth:{getSession:()=>new Promise(()=>{})}, // boot stays pending; fixtures set their own user.
    from(table) {
      assert.equal(table, 'battle_matches');
      const filters = []; let pending;
      function finish() {
        if (!pending) pending = new Promise(resolve=>requests.push({filters, resolve}));
        return pending;
      }
      const query = {
        select(){return query;}, eq(...args){filters.push(args);return query;},
        in(...args){filters.push(args);return query;}, order(){return query;},
        single:finish, then:(resolve,reject)=>finish().then(resolve,reject)
      };
      return query;
    },
    async rpc(name,args){rpcCalls.push({name,args});return {data:'private-match',error:null};}
  };
  const context = createContext({console, document:{getElementById:node,querySelectorAll:()=>[]},
    supabase:{createClient:()=>db}, alert:message=>alerts.push(message),
    setInterval:fn=>{timers.add(fn);return fn;},clearInterval:fn=>timers.delete(fn),addEventListener(){}});
  context.window=context;
  runInContext(source,context,{filename:'battle.js'});
  const run=code=>runInContext(code,context);
  run("user={id:'host'};profile={display_name:'Host'}");
  return {run,node,requests,rpcCalls,alerts,timers};
}
const match=(id='a',overrides={})=>({id,host_id:'host',guest_id:'guest',status:'ready',tcg:'pokemon',
  title:`Match ${id}`,host_display_name:'Host',guest_display_name:'Guest',...overrides});
async function open(f,row=match()) {f.run(`openArena(${JSON.stringify(row)})`);}
async function resolve(f,index,data,error=null) {f.requests[index].resolve({data,error});await settle();}
async function test(name,fn) {
  try {await fn(fixture());results.push({name,status:'PASS'});console.log('PASS:',name);}
  catch(error){results.push({name,status:'FAIL',error:error.message});console.error('FAIL:',name,error.message);}
}
await test('Late refresh cannot restore a match after leaving for lobby',async f=>{
  await open(f);f.run('refreshMatch()');f.run('showLobby()');await resolve(f,0,match());
  assert.equal(f.run('currentMatch'),null);assert.ok(!f.node('lobbyView').classList.contains('hidden'));
  assert.equal(f.timers.size,0);
});
await test('Late refresh from match A cannot replace newly opened match B',async f=>{
  await open(f);f.run('refreshMatch()');await open(f,match('b'));await resolve(f,0,match());
  assert.equal(f.run('currentMatch.id'),'b');assert.equal(f.node('arenaTitle').textContent,'Match b');
});
await test('Reopening the same match invalidates the previous view generation',async f=>{
  await open(f);f.run('refreshMatch()');f.run('showLobby()');await open(f,match('a',{title:'Reopened'}));
  await resolve(f,0,match());assert.equal(f.node('arenaTitle').textContent,'Reopened');
});
await test('Out-of-order match responses cannot regress live to ready',async f=>{
  await open(f);f.run('refreshMatch()');f.run('refreshMatch()');
  await resolve(f,1,match('a',{status:'live'}));await resolve(f,0,match());
  assert.equal(f.run('currentMatch.status'),'live');assert.equal(f.node('matchStatus').textContent,'MATCH LÄUFT');
});
await test('Slow overlapping polling still progresses before the newer read resolves',async f=>{
  await open(f);f.run('refreshMatch()');f.run('refreshMatch()');
  await resolve(f,0,match('a',{title:'First response'}));assert.equal(f.node('arenaTitle').textContent,'First response');
  await resolve(f,1,match('a',{title:'Second response'}));assert.equal(f.node('arenaTitle').textContent,'Second response');
});
await test('Wrong-id, empty and failed reads do not replace the active match',async f=>{
  await open(f);f.run('refreshMatch()');await resolve(f,0,match('unexpected'));
  f.run('refreshMatch()');await resolve(f,1,null);
  f.run('refreshMatch()');await resolve(f,2,null,{message:'offline'});
  assert.equal(f.run('currentMatch.id'),'a');assert.equal(f.node('arenaTitle').textContent,'Match a');
});
await test('Cancelled match returns the remaining guest to lobby',async f=>{
  f.run("user={id:'guest'};profile={display_name:'Guest'}");
  await open(f,match('cancelled',{status:'ready'}));f.run('refreshMatch()');
  await resolve(f,0,match('cancelled',{status:'cancelled'}));await settle();await settle();
  assert.equal(f.run('currentMatch'),null);assert.ok(!f.node('lobbyView').classList.contains('hidden'));
  assert.ok(f.node('arenaView').classList.contains('hidden'));assert.equal(f.timers.size,0);
  assert.match(f.alerts.at(-1)||'',/Host.*Match beendet/);
});
await test('TCG switch ignores the late Pokemon response after One Piece renders',async f=>{
  f.run('loadLobby()');await settle();f.run("currentTcg='one_piece';loadLobby()");await settle();
  await resolve(f,1,[match('op',{tcg:'one_piece',guest_id:null,title:'Current One Piece'})]);
  await resolve(f,0,[match('pk',{guest_id:null,title:'Old Pokemon'})]);
  assert.match(f.node('matchGrid').innerHTML,/Current One Piece/);assert.doesNotMatch(f.node('matchGrid').innerHTML,/Old Pokemon/);
  assert.ok(f.requests[0].filters.some(([key,value])=>key==='tcg'&&value==='pokemon'));
  assert.ok(f.requests[1].filters.some(([key,value])=>key==='tcg'&&value==='one_piece'));
});
await test('Late lobby errors cannot overwrite a newer successful TCG selection',async f=>{
  f.run('loadLobby()');await settle();f.run("currentTcg='one_piece';loadLobby()");await settle();
  await resolve(f,1,[match('op',{tcg:'one_piece',guest_id:null})]);await resolve(f,0,null,{message:'old error'});
  assert.match(f.node('matchGrid').innerHTML,/Match op/);assert.doesNotMatch(f.node('matchGrid').innerHTML,/konnte nicht/);
});
await test('Repeated refresh for the same TCG keeps only the latest request',async f=>{
  f.run('loadLobby()');await settle();f.run('loadLobby()');await settle();
  await resolve(f,1,[]);const latest=f.node('matchGrid').innerHTML;
  await resolve(f,0,[match('old',{guest_id:null})]);assert.equal(f.node('matchGrid').innerHTML,latest);
});
await test('Lobby request from before arena entry stays invalid after returning',async f=>{
  f.node('matchGrid').innerHTML='Fresh lobby';f.run('loadLobby()');await settle();
  await open(f);f.run('showLobby()');await resolve(f,0,[match('old',{guest_id:null})]);
  assert.equal(f.node('matchGrid').innerHTML,'Fresh lobby');assert.equal(f.run('currentMatch'),null);
});
await test('Active arenas do not start hidden lobby reads',async f=>{
  await open(f);f.run('loadLobby()');await settle();assert.equal(f.requests.length,0);
});
await test('Current lobby error remains visible and a retry recovers',async f=>{
  f.run('loadLobby()');await settle();await resolve(f,0,null,{message:'offline'});
  assert.match(f.node('matchGrid').innerHTML,/Lobby konnte nicht geladen werden/);
  f.run('loadLobby()');await settle();await resolve(f,1,[match('fresh',{guest_id:null})]);
  assert.match(f.node('matchGrid').innerHTML,/Match fresh/);
});
await test('Normal lobby retains public filtering, occupied filtering and HTML escaping',async f=>{
  f.run('loadLobby()');await settle();await resolve(f,0,[match('safe',{guest_id:null,title:'<img onerror=alert(1)>'}),match('occupied')]);
  assert.match(f.node('matchGrid').innerHTML,/&lt;img/);assert.doesNotMatch(f.node('matchGrid').innerHTML,/<img|occupied/);
  assert.ok(f.requests[0].filters.some(([key,value])=>key==='visibility'&&value==='public'));
});
await test('Private code entry keeps the existing RPC and does not auto-start media',async f=>{
  f.node('inviteCode').value='  a1b2c3  ';f.node('joinCodeBtn').onclick();await settle();
  assert.equal(f.rpcCalls.length,1);assert.equal(f.rpcCalls[0].name,'join_battle_match');
  assert.equal(f.rpcCalls[0].args.p_match_id,null);assert.equal(f.rpcCalls[0].args.p_invite_code,'a1b2c3');
  await resolve(f,0,match('private-match',{visibility:'private',invite_code:'A1B2C3'}));
  assert.equal(f.run('currentMatch.id'),'private-match');assert.equal(f.run('stream'),null);
  assert.match(f.node('arenaMeta').textContent,/Code A1B2C3/);
});
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
await writeFile(new URL('../test-results/battle-async-state.json',import.meta.url),JSON.stringify({
  scope:'Shipped battle.js with isolated deferred DB responses; not real-device acceptance',results
},null,2)+'\n');
console.log(`${results.filter(x=>x.status==='PASS').length}/${results.length} BATTLE async-state checks passed`);
if(results.some(x=>x.status==='FAIL'))process.exitCode=1;
