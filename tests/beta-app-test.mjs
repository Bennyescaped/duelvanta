import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const [html,css,shell,visuals]=await Promise.all([
  readFile(new URL('../app.html',import.meta.url),'utf8'),
  readFile(new URL('../beta-app.css',import.meta.url),'utf8'),
  readFile(new URL('../beta-shell.css',import.meta.url),'utf8'),
  readFile(new URL('../beta-product-visuals.css',import.meta.url),'utf8')
]);
const must=(s,n,m)=>assert.ok(s.includes(n),`${m}: ${n}`);
for(const id of ['id="app"','id="language"','id="logout"','id="hello"','id="identity"','id="founderMeta"','id="genMeta"','id="sinceMeta"','id="statusMeta"'])must(html,id,'required app id missing');
for(const href of ['collect.html','trade.html','profile.html','ranking.html'])must(html,`href="${href}"`,'dashboard route missing');
must(html,'duelvanta-beta.css?v=1','shared beta system missing');
must(html,'beta-app.css?v=2','app shell stylesheet missing');
must(html,'beta-shell.css?v=1','shared authenticated shell missing');
must(html,'beta-product-visuals.css?v=1','cinematic product visuals missing');
must(html,'beta-shell.js?v=1','mobile dock runtime missing');
must(html,'site-nav.js','global navigation loader missing');
must(html,"location.replace('login.html?next=app.html')",'auth redirect missing');
must(html,"db.rpc('set_my_locale'",'locale persistence missing');
must(html,"db.auth.onAuthStateChange",'auth state guard missing');
assert.equal((html.match(/createClient\(/g)||[]).length,1,'app must keep exactly one Supabase Auth client');
assert.ok(!html.includes('scanner-v16-'),'app shell must stay isolated from Scanner V16 work branch');
assert.ok(!html.includes('service_role')&&!css.includes('service_role')&&!shell.includes('service_role')&&!visuals.includes('service_role'),'frontend must not contain service role');
assert.ok(!html.includes('<svg'),'app must use fixed logo asset rather than redraw it');
for(const component of ['.app-dashboard','.app-quick','.app-module-grid','.app-profile','.app-beta .dv-site-header'])must(css,component,'app shell component missing');
for(const component of ['.beta-page-hero','.beta-mobile-dock','.beta-route-strip'])must(shell,component,'shared cinematic shell component missing');
for(const component of ['.app-module-emblem','.app-module-collect','.app-module-trade','.app-module-battle'])must(visuals,component,'dashboard cinematic module treatment missing');
console.log('PASS: DUELVANTA cinematic beta app shell preserves auth, locale, routing and scanner isolation');
