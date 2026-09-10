import assert from 'node:assert/strict';
await import('../scanner-v16-tcg.js');
await import('../scanner-v16-catalog.js');
await import('../scanner-v16-resilience.js');
await import('../scanner-v16-recovery.js');
await import('../scanner-v16-live.js');
const {DV_SCAN_V16_TCG:tcg,DV_SCAN_V16_CATALOG:catalog,DV_SCAN_V16_RESILIENCE:resilience,DV_SCAN_V16_RECOVERY:recovery,DV_SCAN_V16_LIVE:live}=globalThis;
const id=tcg.pokemonIds('Retourorden 074/084')[0];
assert.equal(id.code,'074/084');assert.equal(tcg.idCode(id,'pokemon'),'74/84');
const requests=[];
const client=catalog.createClient({languages:['de'],fetch:async url=>{
  requests.push(url);
  const path=new URL(url).pathname;
  let data;
  if(path==='/v2/de/sets')data=[...Array.from({length:25},(_,i)=>({id:'old'+i,cardCount:{official:100,total:110}})),{id:'fixture84',cardCount:{official:84,total:84}}];
  if(path==='/v2/de/sets/fixture84')data={cards:[{id:'wrong-174',localId:'174'},{id:'fixture84-074',localId:'074'}]};
  if(path==='/v2/de/cards/fixture84-074')data={id:'fixture84-074',localId:'074',name:'Retourorden',set:{name:'Regression fixture (not provider availability)',cardCount:{official:84,total:84}}};
  return{ok:!!data,status:data?200:404,json:async()=>data};
}});
const cards=await client.lookup(id,{tcg:'pokemon'});
assert.equal(cards.length,1,'074/084 must resolve against numeric official count 84');
assert.equal(cards[0].name,'Retourorden');assert.equal(cards[0].number,'074/084');
assert.equal(cards[0].language,'DE');assert.ok(cards[0].catalogVerified);
assert.equal(requests.length,3,'filter sets first; never fetch the first 18 contains-search results');
assert.ok(requests.every(url=>!url.includes('wrong-174')));
await assert.rejects(()=>client.lookup(id),/expliziten TCG/);
const opRequests=[];
const op=catalog.createClient({fetch:async url=>{opRequests.push(url);return{ok:true,status:200,json:async()=>[{card_set_id:'OP05-119',card_name:'Monkey D. Luffy',card_image_id:'OP05-119_p1',rarity:'SEC'},{card_set_id:'OP05-118',card_name:'Wrong card'}]}}});
assert.equal((await op.lookup({code:'0P05-119'},{tcg:'one_piece'}))[0].number,'OP05-119');
assert.equal((await op.lookup({code:'OP05-119'},{tcg:'one_piece'})).length,1);
assert.match(opRequests[0],/sets\/card\/OP05-119/);
const noHit={tcg:'pokemon',id,quality:{score:96,sharpness:100,brightness:138,glare:0},candidates:[],best:null};
assert.equal(resilience.shouldRetry(noHit),false,'a catalog miss is not a reason to discard a read identifier');
assert.equal(resilience.guidanceFor(noHit).failureType,'catalog_no_match');
assert.ok(!resilience.guidanceFor(noHit).text.includes('besseres Bild'));
assert.equal(resilience.classifyFailure({...noHit,id:null}),'identifier_failure');
assert.equal(resilience.classifyFailure({...noHit,quality:{score:10}}),'image_quality_failure');
for(const [flag,type] of [['variantAmbiguity','variant_ambiguity'],['languageAmbiguity','language_ambiguity']])assert.equal(resilience.classifyFailure({...noHit,best:cards[0],[flag]:true}),type);
assert.equal(resilience.classifyFailure({...noHit,best:cards[0],status:'review'}),'artwork_ambiguity');
assert.equal(resilience.guidanceFor({...noHit,best:cards[0],status:'ready'}).code,'matched');
for(const dims of [[1920,1080,390,500],[720,1280,390,500],[1280,720,844,350],[1920,1440,707,930]])for(const objectFit of ['contain','cover']){
  const g=live.geometry({sourceWidth:dims[0],sourceHeight:dims[1],boxWidth:dims[2],boxHeight:dims[3],objectFit});
  assert.ok(Math.abs(g.overlay.w/g.overlay.h-63/88)<1e-10);
  for(const axis of ['x','y'])assert.ok(Math.abs(g.content[axis]+g.source[axis]*g.scale-g.overlay[axis])<1e-8);
  assert.ok(g.source.x>=0&&g.source.y>=0&&g.source.x+g.source.w<=dims[0]+1e-8&&g.source.y+g.source.h<=dims[1]+1e-8);
}
assert.equal(live.geometry({}),null);
const width=280,height=392,pixels=new Uint8ClampedArray(width*height*4),expected={x:40,y:56,w:200,h:280};
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const v=x>=40&&x<240&&y>=56&&y<336?190+((x+y)%3)*15:45,i=(y*width+x)*4;pixels.set([v,v,v,255],i)}
const frame=live.inspect({data:pixels,width,height},expected);
assert.equal(frame.presence,true);assert.equal(frame.aligned,true);
const gate=live.createGate();let captures=0;
for(let at=1000;at<5500;at+=220)captures+=gate.update(frame,at).autoCapture?1:0;
assert.equal(captures,1,'exactly one high-quality capture per camera arm');
gate.reset();assert.equal(gate.update({...frame,glare:.4},1000).status,'Reflexion reduzieren');
assert.equal(gate.update({...frame,presence:false},1220).autoCapture,false);
assert.equal(live.inspect({data:new Uint8ClampedArray(width*height*4),width,height},expected).presence,false);
// Run the actual core bridge and recovery with deterministic OCR at the unit
// boundary. The browser suite separately runs real Tesseract on pixels.
globalThis.window=globalThis;
globalThis.document={createElement:()=>({width:820,height:1145,getContext:()=>({drawImage(){},putImageData(){},getImageData(_x,_y,w,h){const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4){const v=(i/4)%2?190:70;data.set([v,v,v,255],i)}return{data}}})})};
let activeCode='074/084',ocrCalls=0;
globalThis.Tesseract={recognize:async()=>{ocrCalls++;return{data:{text:activeCode}}}};
const contexts=[];
globalThis.selectedScanTcg='one_piece';
globalThis.catalogLookup=async(identifier,context)=>{contexts.push(context.tcg);return context.tcg==='pokemon'?client.lookup(identifier,context):op.lookup(identifier,context)};
await import('../scanner-v16-core.js');
const core=globalThis.DV_SCAN_V16_CORE;resilience.install();
let pack=await core.analyze({width:630,height:880},{tcg:'pokemon'});
assert.equal(pack.results[0].id.code,'074/084');assert.equal(pack.results[0].best.name,'Retourorden');assert.equal(pack.results[0].tcg,'pokemon');
assert.equal(globalThis.selectedScanTcg,'one_piece','core must never mutate the global TCG selection');
activeCode='OP05-119';pack=await core.analyze({width:630,height:880},{tcg:'one_piece'});
assert.equal(pack.results[0].best.number,'OP05-119');assert.equal(pack.results[0].tcg,'one_piece');assert.deepEqual(contexts,['pokemon','one_piece']);
const before=ocrCalls,original={...noHit,crop:{width:630,height:880},slot:7};
const recovered=await recovery.search(original,'074/084',(source,options)=>core.analyze(source,options));
assert.equal(ocrCalls,before,'manual code recovery must not rescan the photo');
assert.equal(recovered.slot,7);assert.equal(recovered.selected,false);
recovery.confirm(recovered,0);assert.equal(recovered.selected,true);assert.equal(recovered.manualConfirmed,true);
assert.throws(()=>recovery.confirm({...noHit,candidates:[{name:'Unknown'}]},0),/verifizierter/);
assert.equal(recovery.canConfirm(recovered,{...cards[0],tcg:'one_piece'}),false);
await assert.rejects(()=>recovery.search(original,'banana',()=>{}),/Format/);
assert.deepEqual(core.regionsFor({width:630,height:880,__v16Prepared:true},'single')[0],{x:0,y:0,w:630,h:880,index:0,slot:1,row:1,col:1});
console.log('PASS: 074/084 numeric set resolution, explicit TCG core bridge, failure guidance, exact video geometry, contour/stability gate and manual candidate recovery');

// Third iPhone failure: correlated duplicate text is not independent evidence.
assert.equal(core.votePasses(['074/081 074/081 074/081','074/084','074/084'],'pokemon')[0].code,'074/084');
assert.equal(core.votePasses(['074/081 074/081'],'pokemon')[0].passes.length,1);
assert.equal(core.observedLanguage(['Einmal wahrend deines Zuges kannst du diese Karte anlegen.']),'DE');
assert.equal(core.observedLanguage(['TRAINER Retourorden 074/084'] ),null,'title alone must not invent a language');
assert.equal(core.observedLanguage(['During your turn draw a card from your deck.']),'EN');
await import('../scanner-v16-quality.js');globalThis.DV_SCAN_V16_QUALITY.install();
const correct={...cards[0],v16Visual:90},wrong={...correct,number:'074/081',language:'JP',sourceLang:'ja'};
const lookupBefore=globalThis.catalogLookup;
globalThis.catalogLookup=async id=>Number(id.den)===81?[wrong]:[correct];
let texts=['074/081','074/081','074/084 während deines Zuges kannst du'];
globalThis.Tesseract.recognize=async()=>({data:{text:texts.shift()||''}});
let conflicted=await core.analyze({width:630,height:880},{tcg:'pokemon'});
assert.equal(conflicted.results[0].best.language,'DE');assert.equal(conflicted.results[0].id.code,'074/084');
assert.equal(conflicted.results[0].identifierReliable,false);assert.equal(conflicted.results[0].status,'review');
texts=['074/081','074/081','074/081 während deines Zuges kannst du'];
conflicted=await core.analyze({width:630,height:880},{tcg:'pokemon'});
assert.equal(conflicted.results[0].best,null,'German card text must exclude the Japanese false positive even if all number passes agree');
assert.equal(conflicted.results[0].failureType,'language_ambiguity');
texts=['während deines Zuges kannst du','','','074/081','074/081'];
conflicted=await core.analyze({width:630,height:880},{tcg:'pokemon'});
assert.equal(conflicted.results[0].recovery.attempted,true);
assert.equal(conflicted.results[0].observedLanguage,'DE','language evidence must survive a failed initial identifier pass');
assert.equal(conflicted.results[0].best,null,'multipass recovery must apply the same language rejection');
assert.equal(conflicted.results[0].failureType,'language_ambiguity');
globalThis.catalogLookup=lookupBefore;
const forgiving=live.createGate();let fired=0;
for(let i=0;i<24;i++){
  const offset=(i%4)*6,glitch=i===4;
  const f={...frame,sample:frame.sample.map((v,j)=>v+offset+Math.sin(i+j)*2),rect:{...frame.rect,x:frame.rect.x+Math.sin(i)*1.5},presence:!glitch};
  fired+=forgiving.update(f,1000+i*220).autoCapture?1:0;
}
assert.equal(fired,1,'exposure oscillation, hand tremor and one edge dropout must not starve capture');
for(const bad of [{glare:.2},{sharpness:20},{presence:false},{aligned:false}]){
  const gate=live.createGate();for(let i=0;i<25;i++)assert.equal(gate.update({...frame,...bad},1000+i*220).autoCapture,false);
}
const moving=live.createGate();for(let i=0;i<25;i++)assert.equal(moving.update({...frame,rect:{...frame.rect,x:frame.rect.x+i*10}},1000+i*220).autoCapture,false,'camera pan must not trigger capture');
console.log('PASS: independent votes, 081/084 conflict, observed DE excludes JP, exposure/jitter/dropout tolerance and hard capture gates');
