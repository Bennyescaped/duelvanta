import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../app.html', import.meta.url), 'utf8');
const i18n = readFileSync(new URL('../i18n.js', import.meta.url), 'utf8');

assert.match(
  app,
  /<article class="module live"><div class="num">03<\/div><h2>BATTLE<\/h2>[\s\S]*?<a class="open" href="battle\.html" data-i18n="battle\.open">BATTLE BETRETEN<\/a>[\s\S]*?data-i18n="common\.betaLive">Beta live<\/div><\/article>/,
  'BATTLE must be an active beta module linking to battle.html'
);
assert.doesNotMatch(
  app,
  /<h2>BATTLE<\/h2>[\s\S]{0,400}data-i18n="common\.locked"/,
  'BATTLE must not be marked locked on the account home'
);
assert.match(
  app,
  /data-i18n="account\.world">[^<]*BATTLE[^<]*<\/p>/,
  'Account hero fallback must mention BATTLE as open'
);
assert.equal((i18n.match(/'battle\.open':/g) || []).length, 5, 'All five locales must define battle.open');
assert.equal((i18n.match(/'account\.world':'[^']*BATTLE[^']*'/g) || []).length, 5, 'All five locales must mention BATTLE in account.world');

console.log('Account home BATTLE live contract: OK');
