import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../supabase/functions/battle-spectator-media-reconciler/index.ts', import.meta.url), 'utf8');

assert.match(source, /@supabase\/supabase-js@2\.116\.0/);
assert.match(source, /livekit-server-sdk@2\.19\.0/);
assert.match(source, /get_pending_battle_spectator_media_revocations/);
assert.match(source, /complete_battle_spectator_media_revocation/);
assert.doesNotMatch(source, /\.schema\(["']battle_spectator_media_private["']\)/);
assert.match(source, /BigInt\(Math\.floor\(Date\.now\(\) \/ 1000\) \+ 5\)/);
assert.ok(
  source.indexOf('removeParticipant') < source.indexOf('complete_battle_spectator_media_revocation'),
  'revocation must reach LiveKit before the outbox row is completed',
);
assert.doesNotMatch(source, /MEDIA_RECONCILER_SECRET[^\n]*(console|json|Response)/);

console.log('PASS spectator media reconciler contract');
