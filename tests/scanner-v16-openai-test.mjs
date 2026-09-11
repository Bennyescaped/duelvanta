import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import openai from '../benchmark/scanner-pilot/openai-server.cjs';

const {createOpenAIHandler,MODEL,requestBody,validateObservation,outputText}=openai;
const image=Buffer.from([255,216,255,0,1,2,3,4]),hash=createHash('sha256').update(image).digest('hex');
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const now=Date.parse('2026-09-11T12:00:00Z'),expiresAt=new Date(now+3600000).toISOString();
const config={enabled:true,dataset:'openai-unit',expiresAt,publicKey:publicKey.export({type:'spki',format:'pem'}),photos:{[hash]:'one_piece'}};
const env={VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'scanner-v16',OPENAI_API_KEY:'unit-only-never-live'};
const ticket=JSON.stringify({dataset:config.dataset,model:MODEL,expiresAt,sha256:hash,tcg:'one_piece'});
const body={ticket,signature:sign(null,Buffer.from(ticket),privateKey).toString('base64url'),imageBase64:image.toString('base64')};
const observed={tcg:'one_piece',printed_code:'OP01-013',name:'Sanji',language:'EN',set_name:'Romance Dawn',rarity:null,variant:'Parallel / Alt Art',is_graded:true,grading_company:'PSA',grade:'10',certificate_number:'148536135',card_corners:[{x:.1,y:.15},{x:.9,y:.12},{x:.92,y:.9},{x:.08,y:.92}],holder_corners:[{x:.04,y:.03},{x:.96,y:.03},{x:.96,y:.97},{x:.04,y:.97}],subgrades:[],confidence:.84,needs_review:true,uncertainty:'Certificate not verified'};
let calls=0,sent;
const fetchImpl=async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.authorization,`Bearer ${env.OPENAI_API_KEY}`);assert.ok(!url.includes(env.OPENAI_API_KEY));sent=JSON.parse(options.body);return{ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(observed)}]}],usage:{input_tokens:2000,output_tokens:500,total_tokens:2500,output_tokens_details:{reasoning_tokens:120}}})}};
const make=options=>createOpenAIHandler({env,config,now:()=>now,fetchImpl,...options});
async function invoke(handler,request={}){const r={headers:{},setHeader(k,v){this.headers[k]=v},status(code){this.code=code;return this},json(value){this.value=value;return this}};await handler({method:'POST',headers:{'content-type':'application/json'},body,...request},r);return r}

let r=await invoke(make(),{method:'GET'});assert.equal(r.value.configured,true);assert.equal(r.value.model,MODEL);assert.equal(calls,0);
for(const bad of [{...env,VERCEL_ENV:'production'},{...env,VERCEL_GIT_COMMIT_REF:'main'}])assert.equal((await invoke(createOpenAIHandler({env:bad,config,now:()=>now,fetchImpl}))).code,404);
assert.equal((await invoke(createOpenAIHandler({env:{...env,OPENAI_API_KEY:''},config,now:()=>now,fetchImpl}))).code,503);
const handler=make(),results=await Promise.all([invoke(handler),invoke(handler)]);assert.equal(calls,1,'simultaneous duplicate must share one provider call');
r=results[0];assert.equal(r.value.observed.printed_code,'OP01-013');assert.equal(r.value.observed.grading_company,'PSA');assert.equal(r.value.observed.certificate_number,'148536135');assert.equal(r.value.importable,false);assert.equal(r.value.usage.reasoningTokens,120);assert.equal(r.value.estimatedCostUsd,0.00375);
assert.equal(sent.model,MODEL);assert.equal(sent.store,false);assert.equal(sent.input[0].content[1].detail,'original');assert.equal(sent.text.format.type,'json_schema');assert.equal(sent.text.format.strict,true);assert.ok(!JSON.stringify(sent).includes('OP01-013'),'request must contain no expected answer');
assert.equal(outputText({output:[{type:'message',content:[{type:'output_text',text:'a'},{type:'refusal',refusal:'x'}]}]}),'a');
assert.equal(validateObservation(observed,'one_piece').status,'proposal');assert.equal(validateObservation({...observed,printed_code:'#013'},'one_piece').status,'identifier_failure');
assert.throws(()=>validateObservation({...observed,card_corners:[{x:2,y:0}]},'one_piece'));
assert.throws(()=>validateObservation({...observed,holder_corners:[{x:-1,y:0}]},'one_piece'));
const rgs={...observed,tcg:'pokemon',printed_code:'022/187',name:'ブースターex',language:'JP',grading_company:'RGS',certificate_number:null,subgrades:[{label:'Centering',value:'10'},{label:'Corners',value:'9'}]};
assert.equal(validateObservation(rgs,'pokemon').status,'proposal');
const unauthorized=await invoke(make(),{body:{...body,signature:'x'.repeat(86)}});assert.equal(unauthorized.code,403);assert.equal(calls,1);
const denied=await invoke(createOpenAIHandler({env,config,now:()=>now,fetchImpl:async()=>({ok:false,status:403,json:async()=>({error:{code:'permission_denied'}})})}));assert.equal(denied.value.providerReason,'permission_denied');assert.ok(!JSON.stringify(denied).includes(env.OPENAI_API_KEY));
const request=requestBody(image,'pokemon');assert.match(request.instructions,/grading company/);assert.match(request.instructions,/card_corners are required whenever all four physical card corners/);assert.match(request.instructions,/Rotation or perspective alone is not a reason/);assert.match(request.input[0].content[0].text,/pokemon/);
console.log('OpenAI pilot: exact signed photos, image detail, structured card/slab output, measured tokens/cost, deduplication and secret isolation verified.');
