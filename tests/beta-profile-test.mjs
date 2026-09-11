import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const [privateHtml,publicHtml,css,shell,visuals]=await Promise.all([
  readFile(new URL('../profile.html',import.meta.url),'utf8'),
  readFile(new URL('../u.html',import.meta.url),'utf8'),
  readFile(new URL('../beta-profile.css',import.meta.url),'utf8'),
  readFile(new URL('../beta-shell.css',import.meta.url),'utf8'),
  readFile(new URL('../beta-product-visuals.css',import.meta.url),'utf8')
]);
const must=(s,n,m)=>assert.ok(s.includes(n),`${m}: ${n}`);
for(const id of ['id="profileApp"','id="avatarFallback"','id="avatarImage"','id="avatarFile"','id="chooseAvatar"','id="displayName"','id="username"','id="saveIdentity"','id="accountEmail"','id="newPassword"','id="confirmPassword"','id="setPassword"','id="defaultRecipient"','id="defaultStreet1"','id="defaultPostal"','id="defaultCity"','id="defaultCountry"','id="saveDefaultAddress"','id="deleteDefaultAddress"','id="privacyOptions"','id="foldersBlock"','id="folders"','id="identityCard"','id="securityCard"','id="shippingCard"','id="privacyCard"'])must(privateHtml,id,'private profile DOM contract missing');
for(const asset of ['profile.js?v=1.1','site-nav.js','duelvanta-beta.css?v=1','beta-profile.css?v=2','beta-shell.css?v=2','beta-product-visuals.css?v=2','beta-shell.js?v=2'])must(privateHtml,asset,'private profile asset missing');
for(const href of ['#identityCard','#securityCard','#shippingCard','#privacyCard'])must(privateHtml,`href="${href}"`,'profile navigation tile missing');
for(const id of ['id="main"','id="fallback"','id="avatar"','id="name"','id="username"','id="badges"','id="privacy"','id="count"','id="cards"','id="notFound"'])must(publicHtml,id,'public profile DOM contract missing');
for(const api of ['get_public_duelvanta_profile','get_public_duelvanta_collection','public-card-image'])must(publicHtml,api,'public profile safe API missing');
must(publicHtml,"persistSession:false,autoRefreshToken:false",'public profile must not create persistent auth state');
must(publicHtml,'/public-battle-profile.js?v=1.0','public Battle profile add-on missing');
must(publicHtml,'/duelvanta-beta.css?v=1','shared design system missing from public profile');
must(publicHtml,'/beta-profile.css?v=1','profile beta skin missing from public profile');
for(const forbidden of ['defaultRecipient','defaultStreet1','purchase_price','service_role'])assert.ok(!publicHtml.includes(forbidden),`public profile must not expose private field: ${forbidden}`);
assert.ok(!privateHtml.includes('service_role')&&!css.includes('service_role')&&!shell.includes('service_role')&&!visuals.includes('service_role'),'frontend must not contain service role');
assert.ok(!privateHtml.includes('scanner-v16-')&&!publicHtml.includes('scanner-v16-'),'profile refresh must stay isolated from Scanner V16');
for(const component of ['.profile-beta .card','.profile-beta .privacyOption','.public-profile-beta .item','.public-profile-beta .badge'])must(css,component,'profile skin component missing');
must(shell,'.beta-mystic-tiles','shared mystic tile system missing');
console.log('PASS: DUELVANTA mystic private profile preserves privacy and public profile remains safe');
