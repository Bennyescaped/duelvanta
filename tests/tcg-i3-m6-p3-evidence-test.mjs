// Fail closed on missing, mismatched or incomplete P3 evidence.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
const out='test-results/tcg-i3-m6-p3',sha=x=>createHash('sha256').update(x).digest('hex');
const payloadBytes=await readFile(out+'/browser-payload.json'),p=JSON.parse(payloadBytes),browser=JSON.parse(await readFile(out+'/browser-report.json'));
const fixture=await readFile('tests/fixtures/tcg-i3-magic/m6-p2-r1-live-response.json');
assert.equal(browser.passed,true);assert.equal(browser.payload.sha256,sha(payloadBytes));assert.equal(browser.payload.save_keys,17);
assert.equal(p.fixture_sha256,sha(fixture));assert.equal(p.fixture_sha256,'960df122f5c68b0a63284c75dd8e20efce8aa4bd9f208d10ac6ac2d7c734a5aa');
assert.equal(browser.cases.length,20);for(const width of [390,1363]){const cases=browser.cases.filter(c=>c.name.startsWith(width+': '));assert.equal(cases.length,10);assert.ok(cases.every(c=>c.status==='PASS'));}
assert.deepEqual(browser.forbidden_external_io_attempts,[]);
for(const counter of ['new_provider_live_requests','production_mutations','staging_mutations'])assert.equal(browser[counter],0);
const screenshotHashes={};for(const name of ['form-390.png','binder-390.png','form-1363.png','binder-1363.png']){const bytes=await readFile(out+'/'+name);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.ok(bytes.length>1000);screenshotHashes[name]=sha(bytes);}
assert.deepEqual(p.rpc.map(c=>c.name),['save_my_tcg_collection_item_v1','save_my_tcg_collection_item_v1','dv_collect_move_card','save_my_tcg_collection_item_v1']);
const keys=['folder_id','card_name','set_name','card_number','language','variant','condition','quantity','grading_company','grade','cert_number','purchase_price','purchase_date','market_price','currency','notes','contract_version'].sort();
for(const c of p.rpc.filter(c=>c.name==='save_my_tcg_collection_item_v1'))assert.deepEqual(Object.keys(c.args.p_item).sort(),keys);
assert.deepEqual(p.insert_save_payload,p.rpc[0].args);assert.deepEqual(p.edit_save_payload,p.rpc[1].args);assert.deepEqual(p.binder_move,p.rpc[2].args);assert.deepEqual(p.beta_off_edit_payload,p.rpc[3].args);
const report={contract:'m6-p3-evidence/1',passed:true,browser_payload_sha256:sha(payloadBytes),fixture_sha256:sha(fixture),screenshot_sha256:screenshotHashes,native_verified:false};
if(!process.argv.includes('--browser-only')){
 const native=JSON.parse(await readFile(out+'/native-report.json')),m6=JSON.parse(await readFile('test-results/tcg-i3-m6-database-native.json'));
 assert.equal(native.passed,true);assert.equal(native.native_acceptance,true);assert.equal(native.engine,'native-PG17');assert.equal(native.postgres_major,17);assert.equal(Math.floor(Number(native.version)/10000),17);
 assert.equal(native.browser_payload_sha256,sha(payloadBytes));assert.deepEqual(native.insert_payload,p.insert_save_payload);assert.deepEqual(native.browser_operations,p.rpc);
 assert.equal(native.cases.length,11);assert.ok(native.cases.every(c=>c.status==='PASS'));assert.deepEqual(native.io.forbidden_external_io_attempts,[]);
 assert.equal(native.connection.host,'127.0.0.1');assert.equal(native.connection.disposable,true);assert.equal(native.connection.production_staging_connection,false);assert.match(native.connection.database,/^tcg_m4_[0-9a-f]{32}$/);
 for(const [key,value] of Object.entries(p.readback))if(key!=='id')assert.deepEqual(native.final_readback[key],value);
 assert.equal(m6.passed,true);assert.equal(m6.native_acceptance,true);assert.equal(m6.postgres_major,17);assert.equal(m6.cases.length,22);assert.ok(m6.cases.every(c=>c.status==='PASS'));
 assert.deepEqual(m6.cases.slice(20).map(c=>c.name),['NATIVE_LOCK_01','NATIVE_LOCK_02']);
 for(const source of [native,m6])for(const counter of ['provider_live_requests','production_mutations','staging_mutations'])assert.equal(source.io[counter],0);
 report.native_verified=true;report.native_report_sha256=sha(await readFile(out+'/native-report.json'));
}
await writeFile(out+'/evidence-verification.json',JSON.stringify(report,null,2)+'\n');console.log('PASS P3 evidence',JSON.stringify(report));
