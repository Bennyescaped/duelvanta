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
for(const asset of ['duelvanta-beta.css?v=1','beta-app.css?v=3','beta-shell.css?v=2','beta-product-visuals.css?v=2','beta-shell.js?v=2'])must(html,asset,'beta app asset missing');
must(html,'site-nav.js','global navigation loader missing');
must(html,"location.replace('login.html?next=app.html')",'auth redirect missing');
must(html,"db.rpc('set_my_locale'",'locale persistence missing');
must(html,"db.auth.onAuthStateChange",'auth state guard missing');
must(html,'app-bento','mystic bento dashboard missing');
must(html,'app-logo-card-stack','branded card stack missing');
assert.ok((html.match(/src="v-logo\.svg"/g)||[]).length>=4,'dashboard decorative cards must reuse exact v-logo.svg');
assert.equal((html.match(/createClient\(/g)||[]).length,1,'app must keep exactly one Supabase Auth client');
assert.ok(!html.includes('scanner-v16-'),'app shell must stay isolated from Scanner V16 work branch');
assert.ok(!html.includes('service_role')&&!css.includes('service_role')&&!shell.includes('service_role')&&!visuals.includes('service_role'),'frontend must not contain service role');
assert.ok(!html.includes('<svg'),'app must use fixed logo asset rather than redraw it');
for(const component of ['.app-dashboard','.app-bento','.app-bento-tile','.app-logo-card-stack','.app-profile','.app-beta .dv-site-header'])must(css,component,'app shell component missing');
for(const component of ['.beta-page-hero','.beta-mobile-dock','.beta-route-strip','.beta-mystic-tiles'])must(shell,component,'shared cinematic shell component missing');
console.log('PASS: DUELVANTA mystic bento app shell preserves auth, locale, routing and scanner isolation');
