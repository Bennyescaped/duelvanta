import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const [html,css,shell,visuals]=await Promise.all([
  readFile(new URL('../battle.html',import.meta.url),'utf8'),
  readFile(new URL('../beta-battle.css',import.meta.url),'utf8'),
  readFile(new URL('../beta-shell.css',import.meta.url),'utf8'),
  readFile(new URL('../beta-product-visuals.css',import.meta.url),'utf8')
]);
const must=(s,n,m)=>assert.ok(s.includes(n),`${m}: ${n}`);
for(const id of ['id="app"','id="safetyBlocked"','id="battleShell"','id="lobbyView"','id="arenaView"','id="createMatch"','id="inviteCode"','id="matchGrid"','id="myVideo"','id="opponentVideo"','id="cameraBtn"','id="readyBtn"','id="startMatch"','id="safetyGate"','id="conductAccept"','id="privacyAccept"','id="createDialog"','id="reportDialog"'])must(html,id,'required Battle DOM id missing');
for(const script of ['battle-safety.js','battle.js','battle-webrtc.js','battle-moderation.js','battle-profile-links.js','battle-history.js'])must(html,script,'stable Battle script chain missing');
for(const asset of ['duelvanta-beta.css?v=1','beta-battle.css?v=2','beta-shell.css?v=2','beta-product-visuals.css?v=2','beta-shell.js?v=2'])must(html,asset,'Battle beta asset missing');
must(html,'BATTLE. WATCH. COMPETE.','Battle cinematic hero missing');
must(html,'battle-hero-vs','Battle VS hero treatment missing');
must(html,'KEINE AUFZEICHNUNG IN V1','Battle safety promise missing');
for(const action of ['create-match','lobby'])must(html,`data-beta-action="${action}"`,'Battle quick tile missing');
assert.ok(visuals.includes("url('v-logo.svg')"),'Battle VS cards must use exact v-logo.svg');
assert.ok(!html.includes('>V</div><b>VS'),'old V placeholders must not remain in Battle hero');
assert.ok(!html.includes('scanner-v16-'),'Battle visual refresh must stay isolated from Scanner V16 work');
assert.ok(!html.includes('service_role')&&!css.includes('service_role')&&!shell.includes('service_role')&&!visuals.includes('service_role'),'frontend must not contain service role');
for(const component of ['.battle-beta .matchGrid','.battle-beta .playerPanel','.battle-beta .videoFrame','.battle-beta .safetyDialog','.battle-beta .dv-site-header'])must(css,component,'Battle skin component missing');
must(shell,'.beta-mystic-tiles','shared mystic tile system missing');
console.log('PASS: DUELVANTA mystic Battle surface preserves safety, WebRTC and arena DOM contracts');
