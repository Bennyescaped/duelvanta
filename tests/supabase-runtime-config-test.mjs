import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const handler=require('../api/supabase-runtime-config.js');
const original={VERCEL_ENV:process.env.VERCEL_ENV,SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY};

function invoke(method='GET'){
  const response={statusCode:200,headers:{},body:'',status(code){this.statusCode=code;return this},setHeader(name,value){this.headers[name.toLowerCase()]=value},send(body){this.body=body;return this}};
  handler({method},response);return response;
}

try{
  process.env.VERCEL_ENV='preview';delete process.env.SUPABASE_URL;delete process.env.SUPABASE_PUBLISHABLE_KEY;
  let response=invoke();
  assert.equal(response.statusCode,503,'preview must fail closed without staging configuration');
  assert.match(response.body,/not safely configured/);

  process.env.SUPABASE_URL='https://enifiaqsnqtbzylnfrpi.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='public-test';
  response=invoke();
  assert.equal(response.statusCode,503,'preview must reject the production project');

  process.env.SUPABASE_URL='https://unapproved.supabase.co';
  response=invoke();
  assert.equal(response.statusCode,503,'preview must reject every project except the isolated staging project');

  process.env.SUPABASE_URL='https://xhmjxrcskfhbovhitdej.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='public-test';
  response=invoke();
  assert.equal(response.statusCode,200);
  assert.match(response.body,/xhmjxrcskfhbovhitdej/);
  assert.doesNotMatch(response.body,/SERVICE_ROLE|secret/i,'runtime response must not expose server authority');
  assert.equal(response.headers['cache-control'],'private, no-store, max-age=0');

  process.env.VERCEL_ENV='production';delete process.env.SUPABASE_URL;delete process.env.SUPABASE_PUBLISHABLE_KEY;
  response=invoke();
  assert.equal(response.statusCode,200,'production keeps its existing public configuration');
  assert.match(response.body,/enifiaqsnqtbzylnfrpi/);

  assert.equal(invoke('POST').statusCode,405);

  for(const file of ['trade.html','login.html','reset-password.html','app.html','seller-onboarding.html','listing-report.html','admin.html']){
    const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
    assert.ok(source.includes('/api/supabase-runtime-config.js'),`${file} does not load the guarded runtime configuration`);
  }
  for(const file of ['trade.js','login.html','reset-password.html','app.html','seller-onboarding.js','listing-report.js','admin.html']){
    const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
    assert.ok(source.includes('DV_SUPABASE'),`${file} does not consume the guarded runtime configuration`);
    assert.ok(!source.includes('https://enifiaqsnqtbzylnfrpi.supabase.co'),`${file} still hardcodes production Supabase`);
  }
}finally{
  for(const [name,value] of Object.entries(original))value===undefined?delete process.env[name]:process.env[name]=value;
}

console.log('PASS: marketplace previews fail closed and cannot fall back to production Supabase');
