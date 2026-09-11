import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {allowed,createHandler}=createRequire(import.meta.url)('../api/scanner-v16-reference.js');
const url='https://optcgapi.com/media/static/Card_Images/OP01-013_p1.jpg';
assert.ok(allowed(url));assert.ok(allowed('https://optcgapi.com/api/sets/card/OP01-013/'));
for(const u of ['http://optcgapi.com/media/static/Card_Images/a.jpg','https://evil.test/a.jpg','https://optcgapi.com@evil.test/a.jpg','https://optcgapi.com/media/static/Card_Images/../../a.jpg',url+'?url=http://localhost','https://optcgapi.com/api/users/'])assert.equal(allowed(u),null);
let calls=0;
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'scanner-v16'};
function res(){return{headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},end(){},json(v){this.data=v},send(v){this.data=v}}}
const mock=async(u,o)=>{calls++;assert.equal(o.redirect,'error');assert.equal(o.headers.Authorization,undefined);return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/jpeg'}})};
let out=res();await createHandler({env,fetchImpl:mock})({method:'GET',query:{url}},out);assert.equal(out.code,200);assert.equal(calls,1);assert.equal(out.headers['X-Content-Type-Options'],'nosniff');
out=res();await createHandler({env:{...env,VERCEL_ENV:'production'},fetchImpl:mock})({method:'GET',query:{url}},out);assert.equal(out.code,404);assert.equal(calls,1);
out=res();await createHandler({env:{...env,VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'main'},fetchImpl:mock})({method:'GET',query:{url}},out);assert.equal(out.code,200);assert.equal(calls,2);
out=res();await createHandler({env,fetchImpl:async()=>new Response('html',{headers:{'content-type':'text/html'}})})({method:'GET',query:{url}},out);assert.equal(out.code,502);assert.equal(out.headers['Cache-Control'],'no-store');
out=res();await createHandler({env,fetchImpl:async()=>new Response('x',{headers:{'content-type':'image/jpeg','content-length':'4000000'}})})({method:'GET',query:{url}},out);assert.equal(out.code,502);
console.log('PASS: branch-only reference transport, fixed host/path, redirect denial, no credentials, type/size bounds, success-only caching');
