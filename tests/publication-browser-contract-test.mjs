// Actual public rendering scripts with responses from the executed SQL matrix.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const result=JSON.parse(readFileSync(process.argv[2]||'test-results/publication-processing-hold-preparation.json','utf8'));assert.equal(result.passed,true);
for(const state of ['normal','processing','closure']){
 const rows=name=>{const c=result.cases.find(x=>x.label===state+'/anon/'+name);assert.ok(c);return c.rows;};
 let {window}=parseHTML('<html><head></head><body><main id="main"><div class="hero"></div></main></body></html>');
 window.DV_SUPABASE={url:'https://synthetic.invalid',key:'anon'};
 vm.runInNewContext(readFileSync('public-battle-profile.js','utf8'),{window,document:window.document,location:{pathname:'/u/alpha',search:''},URLSearchParams,setTimeout,console,fetch:async url=>({ok:true,json:async()=>rows(url.split('/').at(-1))})});
 for(let i=0;i<20&&!window.document.querySelector('#dvBattleRecent .dvBattleEmpty, #dvBattleRecent .dvBattleRow');i++)await new Promise(r=>setTimeout(r,5));
 await new Promise(r=>setTimeout(r,5));
 const recent=window.document.getElementById('dvBattleRecent').textContent;assert.equal(recent.includes(rows('get_public_battle_recent')[0]?.opponent_display_name||'NEVER_SYNTHETIC'),state==='normal');
 assert.equal(window.document.getElementById('dvRankedPublic').textContent.includes('1500'),state==='normal');
 ({window}=parseHTML('<html><head></head><body><div id="rankList"></div><div id="podium"></div><div id="boardMeta"></div><button id="refreshRanking"></button><a id="accountAction"></a></body></html>'));
 window.DV_SUPABASE={url:'https://synthetic.invalid',key:'anon'};window.supabase={createClient:()=>({rpc:async()=>({data:rows('leaderboard')}),auth:{getSession:async()=>({data:{session:null}})}})};
 vm.runInNewContext(readFileSync('ranking.js','utf8'),{window,document:window.document,console});await new Promise(r=>setTimeout(r,5));
 assert.equal(window.document.getElementById('rankList').innerHTML.includes('/u/alpha'),state==='normal');assert.ok(window.document.getElementById('rankList').innerHTML.includes('/u/bravo'));
 assert.equal(rows('collection').length,state==='closure'?0:1);
}
console.log('PASS actual public profile/ranking DOM against SQL outputs: normal, Processing-only, Closure; unchanged collection contract');
