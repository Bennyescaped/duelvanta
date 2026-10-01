import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const source = readFileSync(new URL('../supabase/functions/battle-spectator-media-broker/index.ts', import.meta.url), 'utf8');
const origin = 'https://duelvantav5vision-git-marketplace-ux-v1-bennyescaped-3783.vercel.app';
let handler, rpcCalls = 0, tokens = 0, admission = { error: { message: 'denied' } }, grant;
const context = {
  Request, Response, crypto, console,
  TrackSource: { CAMERA: 1, MICROPHONE: 2 },
  Deno: { serve(fn) { handler = fn; }, env: { get: () => 'test-only' } },
  createClient: () => ({ rpc: async () => { rpcCalls++; return admission; } }),
  AccessToken: class {
    constructor(_key, _secret, options) { tokens++; assert.equal(options.ttl, '45s'); }
    addGrant(value) { grant = value; }
    async toJwt() { return 'test-only-not-a-real-token'; }
  },
};
vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\n/gm, '')), context);
const request = (method, body, authenticated = false) => new Request('https://staging.invalid/broker', {
  method, headers: { Origin: origin, ...(authenticated ? { Authorization: 'Bearer test-only' } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const cors = response => assert.equal(response.headers.get('access-control-allow-origin'), origin);
let response = await handler(request('OPTIONS'));
assert.equal(response.status, 204); cors(response);
assert.match(response.headers.get('access-control-allow-methods'), /POST/);
assert.match(response.headers.get('access-control-allow-headers'), /authorization/);
assert.equal(rpcCalls, 0); assert.equal(tokens, 0);
response = await handler(request('POST', {}));
assert.equal(response.status, 401); cors(response);
response = await handler(request('GET'));
assert.equal(response.status, 405); cors(response);
response = await handler(request('POST', {}, true));
assert.equal(response.status, 400); cors(response);
const body = { action: 'viewer', match_id: '11111111-1111-4111-8111-111111111111', tab_id: '22222222-2222-4222-8222-222222222222' };
response = await handler(request('POST', body, true));
assert.equal(response.status, 403); cors(response); assert.equal(tokens, 0);
admission = { data: { epoch: 'test-epoch', publisher_role: 'host' } };
response = await handler(request('POST', body, true));
assert.equal(response.status, 200); cors(response);
assert.equal(grant.canPublish, false); assert.equal(grant.canSubscribe, true);
assert.equal(grant.canPublishData, false); assert.equal(grant.canUpdateOwnMetadata, false);
assert.equal(grant.room, 'dv-' + body.match_id + '-test-epoch');
response = await handler(request('POST', { ...body, action: 'publisher' }, true));
assert.equal(response.status, 200); cors(response);
assert.equal(grant.canPublish, true); assert.equal(grant.canSubscribe, false);
assert.equal(JSON.stringify(grant.canPublishSources), '[1,2]');
console.log('PASS broker preflight, CORS, admission denial, viewer/publisher grants');

// Supply the pinned SDK module path to run real signing, without production credentials.
if (process.env.LIVEKIT_SDK_MODULE) {
  const sdk = await import(process.env.LIVEKIT_SDK_MODULE);
  context.AccessToken = sdk.AccessToken;
  context.TrackSource = sdk.TrackSource;
  for (const action of ['publisher', 'viewer']) {
    const result = await handler(request('POST', { ...body, action }, true));
    assert.equal(result.status, 200, 'real SDK must sign ' + action);
    const { token } = await result.json();
    const claims = await new sdk.TokenVerifier('test-only', 'test-only').verify(token);
    assert.equal(claims.video.canPublish, action === 'publisher');
    assert.equal(claims.video.canSubscribe, action === 'viewer');
    assert.equal(claims.video.canPublishData, false);
    assert.equal(claims.video.canUpdateOwnMetadata, false);
    assert.deepEqual(claims.video.canPublishSources, action === 'publisher' ? ['camera', 'microphone'] : []);
    assert.equal(claims.video.room, 'dv-' + body.match_id + '-test-epoch');
    assert.ok(claims.exp - claims.nbf <= 45);
  }
  console.log('PASS real LiveKit SDK signs and verifies publisher/viewer tokens; no real credentials used');
}
