/* Catalog record translation only. No transport, recognition, pricing operation,
 * canonical ID generation or merge. legacy is the unchanged scanner DTO projection. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./tcg-v1-contracts.js'),require('./tcg-v1-game-adapters.js'));
  else root.DV_TCG_V1_PROVIDERS=factory(root.DV_TCG_V1_CONTRACTS,root.DV_TCG_V1_GAMES);
})(globalThis,function(C,G){
  'use strict';
  if(!C||!G)throw new Error('TCG contracts and games must load first');
  const numeric=value=>/^\d+$/.test(String(value??''))?String(Number(value)):null;
  const operations={search:'record_translation_only',getSet:'unsupported',getCard:'record_translation_only',listVariants:'record_translation_only'};
  function context(v,game,locales){C.shape(v,['game_key','locale','collector','source_path','retrieved_at']);if(v.game_key!==game)C.fail('crossgame translation');C.choice(v.locale,locales);C.collectorInput(v.collector);C.text(v.source_path);if(v.retrieved_at!==null)C.text(v.retrieved_at);return C.immutable(v)}
  function validateRaw(card,game){
    // Raw JSON is detached evidence, never canonical metadata. Validate every
    // consumed field; retain unconsumed provider fields without interpreting them.
    const strings=game==='pokemon'?['id','name','localId','rarity','image']:['card_image_id','card_set_id','card_id','card_number','card_name','name','set_name','rarity','card_rarity','card_image','image'];
    const allowed=game==='pokemon'?[...strings,'set']:[...strings,'market_price','marketPrice','price'];
    card=C.immutable(card);C.shape(Object.fromEntries(Object.entries(card).filter(([k])=>allowed.includes(k))),[],allowed);
    for(const k of strings)if(card[k]!==undefined&&card[k]!==null)C.text(card[k],{empty:true});
    if(game==='pokemon'&&card.set!==undefined){C.shape(Object.fromEntries(Object.entries(card.set).filter(([k])=>['id','name','cardCount'].includes(k))),[],['id','name','cardCount']);for(const k of ['id','name'])if(card.set[k]!==undefined)C.text(card.set[k],{empty:true});if(card.set.cardCount!==undefined){C.shape(Object.fromEntries(Object.entries(card.set.cardCount).filter(([k])=>['official','total'].includes(k))),[],['official','total']);for(const x of [card.set.cardCount.official,card.set.cardCount.total].filter(x=>x!==undefined))if(!(Number.isInteger(x)&&x>=0)&&!(typeof x==='string'&&/^\d+$/.test(x)))C.fail('cardCount')}}
    if(game==='one_piece')for(const k of ['market_price','marketPrice','price'])if(card[k]!==undefined&&card[k]!==null&&!(typeof card[k]==='string'||(typeof card[k]==='number'&&Number.isFinite(card[k]))))C.fail('legacy price scalar');
    return C.immutable(card);
  }
  function record(binding,raw,ctx,legacy,namespace,external_id,discriminator){
    const a=G[binding.game_key];
    return C.providerRecord({ref:{kind:'ProviderCandidateRef',game_key:binding.game_key,provider_key:binding.provider_key,namespace,entity_kind:'card',external_id,locale:ctx.locale,discriminator},source:{provider_version:'1',record_version:'legacy-v16',retrieved_at:ctx.retrieved_at,source_path:ctx.source_path},raw,normalized:{name:legacy.name,set_name:legacy.set,collector_number:legacy.number,language:legacy.language,rarity:a.normalizeRarity(raw.rarity||raw.card_rarity||null),variant:a.normalizeVariant({name:legacy.name,set:legacy.set,rarity:raw.rarity||raw.card_rarity||'',variant:legacy.variant}),image:legacy.image},legacy},binding);
  }
  function tcgdexTranslate(payload,input){
    const binding={provider_key:'tcgdex',provider_version:'1',game_key:'pokemon'},ctx=context(input,'pokemon',['de','en','ja','ko']);
    C.choice(ctx.source_path,['cards']);
    const raw=validateRaw(payload,'pokemon'),parsed=G.pokemon.parseCollectorEvidence(ctx.collector);
    if(parsed.status!=='valid')return C.immutable({status:parsed.status,records:[],original:raw});
    const id=parsed.candidates[0],local=numeric(id.local),den=numeric(id.den);
    if(numeric(raw.localId)!==local||![raw.set?.cardCount?.official,raw.set?.cardCount?.total].some(n=>numeric(n)===den))return C.immutable({status:'no_match',records:[],original:raw});
    if(!raw.id||!raw.name)C.fail('missing TCGdex card identity');
    const lang=ctx.locale,legacy={catalogId:raw.id,tcg:'pokemon',name:raw.name,set:raw.set?.name||'',number:`${raw.localId}/${id.den||den}`,language:lang==='ja'?'JP':lang==='ko'?'KR':lang.toUpperCase(),sourceLang:lang,variant:raw.rarity||'',image:raw.image?`${raw.image}/high.webp`:null,catalogConfidence:88,confidence:88,catalogVerified:true,marketEur:null,priceSource:null};
    return C.immutable({status:'candidates',records:[record(binding,raw,ctx,legacy,'v2/cards',raw.id,null)],original:raw});
  }
  function optcgTranslate(payload,input){
    const binding={provider_key:'optcg',provider_version:'1',game_key:'one_piece'},ctx=context(input,'one_piece',['en']);C.choice(ctx.source_path,['sets','decks','promos']);
    const raw=validateRaw(payload,'one_piece'),parsed=G.one_piece.parseCollectorEvidence(ctx.collector);
    if(parsed.status!=='valid')return C.immutable({status:parsed.status,records:[],original:raw});
    const code=parsed.comparison_code,candidate=G.one_piece.parseCollectorEvidence({text:raw.card_set_id||raw.card_id||raw.card_number||'',source:'ocr'});
    if(candidate.status!=='valid'||candidate.comparison_code!==code)return C.immutable({status:'no_match',records:[],original:raw});
    const name=raw.card_name||raw.name,external=raw.card_image_id||raw.card_set_id||raw.card_id;
    if(!name||!external)C.fail('missing OPTCG card identity');
    // Exact precedence of scanner-v16-catalog.js, deliberately not harmonized
    // with quality.variantFamily. Promo/Reprint may have a different family.
    const variant=/winner/i.test(raw.card_name||'')?'Tournament / Winner':/finalist/i.test(raw.card_name||'')?'Tournament / Finalist':/participant/i.test(raw.card_name||'')?'Tournament / Participant':/manga/i.test(raw.card_name||'')?'Manga':/alternate art|parallel/i.test(raw.card_name||'')?'Parallel / Alt Art':/wanted poster/i.test(raw.card_name||'')?'Wanted Poster':/\(SP\)/i.test(raw.card_name||'')?'Special':/reprint/i.test(raw.card_name||'')?'Reprint':raw.rarity||raw.card_rarity||'';
    const legacy={catalogId:external,tcg:'one_piece',name,set:raw.set_name||'',number:code,language:'EN',rarity:raw.rarity||raw.card_rarity||'',variant,image:raw.card_image||raw.image||null,catalogConfidence:88,confidence:88,catalogVerified:true,marketEur:null,marketUsd:Number.isFinite(Number(raw.market_price??raw.marketPrice??raw.price))?Number(raw.market_price??raw.marketPrice??raw.price):null,priceSource:null};
    // Fallback IDs do not identify artwork. Keep discriminator + separate rows,
    // never collapse equal refs or equal names/numbers into a canonical card.
    const namespace=raw.card_image_id?'api/card_image_id':raw.card_set_id?'api/card_set_id':'api/card_id';
    const discriminator=raw.card_image_id?null:JSON.stringify([legacy.image,legacy.name]);
    return C.immutable({status:'candidates',records:[record(binding,raw,ctx,legacy,namespace,external,discriminator)],original:raw});
  }
  // Scryfall receives already supplied JSON only. No transport or import path.
  function magicJson(value,depth=0){
    if(depth>20)C.fail('scryfall data nesting');
    if(value===null||typeof value==='string'||typeof value==='boolean')return value;
    if(typeof value==='number'&&Number.isFinite(value))return value;
    if(Array.isArray(value)){
      if(Object.getPrototypeOf(value)!==Array.prototype||value.length>1000)C.fail('scryfall array');
      const allowed=new Set(['length',...Array.from({length:value.length},(_,i)=>String(i))]);
      for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(!allowed.has(key)||!d||!('value'in d))C.fail('scryfall array data')}
      return Array.from({length:value.length},(_,i)=>{if(!Object.hasOwn(value,i))C.fail('scryfall sparse array');return magicJson(value[i],depth+1)});
    }
    if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)C.fail('scryfall JSON object');
    C.shape(value,Reflect.ownKeys(value).filter(k=>typeof k==='string'&&!['__proto__','prototype','constructor'].includes(k)));
    return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,magicJson(v,depth+1)]));
  }
  const magicUuid=value=>{if(typeof value!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value))C.fail('scryfall UUID')};
  const magicBool=value=>{if(typeof value!=='boolean')C.fail('scryfall boolean')};
  const missingNull=(raw,key)=>Object.hasOwn(raw,key)?raw[key]:null;
  const magicLangs=['en','de','fr','it','es','ja','ko','zhs'];
  function magicContext(value){
    C.shape(value,['game_key','locale','collector','source_path','retrieved_at'],['variant_evidence']);
    if(value.game_key!=='magic')C.fail('crossgame translation');
    if(value.locale!==null)C.choice(value.locale,magicLangs.map(lang=>G.magic.normalizeLanguage(lang).locale));
    C.collectorInput(value.collector);C.text(value.source_path);
    if(value.retrieved_at!==null){C.text(value.retrieved_at);if(!/^\d{4}-\d\d-\d\dT.*Z$/.test(value.retrieved_at)||!Number.isFinite(Date.parse(value.retrieved_at)))C.fail('source time')}
    if(Object.hasOwn(value,'variant_evidence'))C.magicVariantEvidence(value.variant_evidence);
    return C.immutable(value);
  }
  function canonicalMagicJson(v){
    if(Array.isArray(v))return'['+v.map(canonicalMagicJson).join(',')+']';
    if(v!==null&&typeof v==='object')return'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonicalMagicJson(v[k])).join(',')+'}';
    return JSON.stringify(v);
  }
  // Synchronous SHA-256 over canonical UTF-8, shared by browser and CommonJS.
  // This fingerprints record content, never a name or canonical card identity.
  function magicDigest(value){
    const bytes=[];for(const ch of value){const n=ch.codePointAt(0);if(n<128)bytes.push(n);else if(n<2048)bytes.push(192|(n>>>6),128|(n&63));else if(n<65536)bytes.push(224|(n>>>12),128|((n>>>6)&63),128|(n&63));else bytes.push(240|(n>>>18),128|((n>>>12)&63),128|((n>>>6)&63),128|(n&63))}
    const length=bytes.length;bytes.push(128);while(bytes.length%64!==56)bytes.push(0);
    const hi=Math.floor(length/536870912),lo=(length*8)>>>0;
    for(const n of [hi,lo])for(let shift=24;shift>=0;shift-=8)bytes.push((n>>>shift)&255);
    const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],ror=(x,n)=>(x>>>n)|(x<<(32-n));
    for(let pos=0;pos<bytes.length;pos+=64){
      const w=new Uint32Array(64);for(let i=0;i<16;i++){const j=pos+i*4;w[i]=(bytes[j]<<24)|(bytes[j+1]<<16)|(bytes[j+2]<<8)|bytes[j+3]}
      for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=w[i-16]+(ror(a,7)^ror(a,18)^(a>>>3))+w[i-7]+(ror(b,17)^ror(b,19)^(b>>>10))}
      let [a,b,c,d,e,f,g,z]=h;
      for(let i=0;i<64;i++){const t1=(z+(ror(e,6)^ror(e,11)^ror(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((ror(a,2)^ror(a,13)^ror(a,22))+((a&b)^(a&c)^(b&c)))>>>0;z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}
      [a,b,c,d,e,f,g,z].forEach((n,i)=>{h[i]=(h[i]+n)>>>0});
    }
    return'sha256:'+h.map(n=>n.toString(16).padStart(8,'0')).join('');
  }
  function magicImageFields(raw){
    if(Object.hasOwn(raw,'image_status'))C.choice(raw.image_status,['missing','lowres','highres_scan']);
    if(!Object.hasOwn(raw,'image_uris'))return null;
    const images=raw.image_uris;if(!images||typeof images!=='object'||Array.isArray(images))C.fail('scryfall images');C.shape(images,Reflect.ownKeys(images));
    for(const k of ['small','normal','large','png','art_crop','border_crop'])if(Object.hasOwn(images,k)){C.text(images[k]);if(!/^https:\/\/[^\s<>]+$/.test(images[k]))C.fail('unsafe image')}
    if(raw.image_status==='missing')return null;
    return images.normal||images.large||images.png||null;
  }
  function magicFaces(raw){
    if(!Object.hasOwn(raw,'card_faces'))return[];
    C.list(raw.card_faces,f=>{C.shape(f,Reflect.ownKeys(f));C.text(f.name);if(Object.hasOwn(f,'printed_name'))C.text(f.printed_name);for(const k of ['illustration_id','oracle_id'])if(Object.hasOwn(f,k)&&f[k]!==null)magicUuid(f[k]);magicImageFields(f)});
    if(raw.card_faces.length>2)C.fail('scryfall face count');return raw.card_faces;
  }
  function magicProjection(raw,faces){
    const pc={id:raw.id,set_id:raw.set_id,oracle_id:missingNull(raw,'oracle_id'),lang:raw.lang,layout:raw.layout,collector_number:raw.collector_number,released_at:missingNull(raw,'released_at'),variation:missingNull(raw,'variation'),reprint:missingNull(raw,'reprint')};
    const illustrations=faces.length?faces.map(f=>missingNull(f,'illustration_id')):[missingNull(raw,'illustration_id')];
    if(Object.hasOwn(raw,'illustration_id')&&raw.illustration_id!==null)magicUuid(raw.illustration_id);
    return C.magicVariantEvidence({contract:'MagicVariantEvidence',version:'1',game_key:'magic',provider_key:'scryfall',provider_version:'1',printing_context:pc,chosen_finish:null,available_finishes:raw.finishes,frame:missingNull(raw,'frame'),border_color:missingNull(raw,'border_color'),full_art:missingNull(raw,'full_art'),frame_effects:Object.hasOwn(raw,'frame_effects')?raw.frame_effects:[],promo_types:Object.hasOwn(raw,'promo_types')?raw.promo_types:[],illustration_ids:illustrations,variation_of:missingNull(raw,'variation_of')});
  }
  function magicRoute(ctx,raw){
    const stem=raw.object==='set'?'api/sets':'api/cards';
    // SOURCE provenance is candidate-only; this pure translator never fetches.
    if(raw.object==='card'&&/^https:\/\/data\.scryfall\.io\/all-cards\/all-cards-\d{14}\.jsonl\.gz$/.test(ctx.source_path))return'candidate';
    if(raw.object==='set'&&/^https:\/\/api\.scryfall\.com\/sets(?:\/[a-zA-Z0-9_-]+)*$/.test(ctx.source_path))return'candidate';
    if(ctx.source_path===stem||raw.object==='card'&&ctx.source_path===stem+'/search')return'candidate';
    if(ctx.source_path===stem+'/'+raw.id||raw.object==='set'&&ctx.source_path===stem+'/'+encodeURIComponent(raw.code))return'exact';
    if(raw.object==='card'&&ctx.source_path===stem+'/'+encodeURIComponent(raw.set)+'/'+encodeURIComponent(raw.collector_number)+'/'+raw.lang)return'exact';
    if(ctx.source_path.startsWith(stem+'/'))return'no_match';C.fail('scryfall source route');
  }
  function scryfallTranslate(payload,input){
    const ctx=magicContext(input),raw=C.freeze(magicJson(payload));C.shape(raw,Reflect.ownKeys(raw));C.choice(raw.object,['set','card']);
    const binding={provider_key:'scryfall',provider_version:'1',game_key:'magic'};
    const result=(status,records=[])=>C.immutable({status,records,original:raw});
    magicUuid(raw.id);C.text(raw.name);magicBool(raw.digital);
    const source={provider_version:'1',record_version:magicDigest(canonicalMagicJson(raw)),retrieved_at:ctx.retrieved_at,source_path:ctx.source_path};
    const ref=(kind,locale,discriminator=null)=>({kind:'ProviderCandidateRef',game_key:'magic',provider_key:'scryfall',namespace:kind==='set'?'api/sets':kind==='variant'?'api/cards/finishes':'api/cards',entity_kind:kind,external_id:raw.id,locale,discriminator});
    if(raw.object==='set'){
      C.text(raw.code);if(ctx.locale!==null)C.fail('scryfall set locale');if(Object.hasOwn(ctx,'variant_evidence'))C.fail('set variant evidence');
      if(raw.digital)return result('unsupported');if(magicRoute(ctx,raw)==='no_match')return result('no_match');
      return result('candidates',[C.providerRecord({ref:ref('set',null),source,raw,normalized:{name:raw.name,language:null},legacy:{catalogId:raw.id,tcg:'magic',name:raw.name,code:raw.code}},binding)]);
    }
    for(const key of ['set','set_name','lang','layout','collector_number','rarity'])C.text(raw[key]);
    magicBool(raw.oversized);C.unique(C.list(raw.games,x=>C.text(x)));const faces=magicFaces(raw),projection=magicProjection(raw,faces),image=magicImageFields(raw)||((faces[0]&&magicImageFields(faces[0]))||null);
    if(Object.hasOwn(raw,'printed_name'))C.text(raw.printed_name);
    let evidence;
    if(Object.hasOwn(ctx,'variant_evidence')){
      evidence=C.magicVariantEvidence(ctx.variant_evidence);
      for(const key of Object.keys(projection).filter(k=>k!=='chosen_finish'))if(canonicalMagicJson(evidence[key])!==canonicalMagicJson(projection[key]))C.fail('scryfall variant evidence mismatch '+key);
    }
    if(ctx.locale===null)C.fail('scryfall card locale');
    const language=G.magic.normalizeLanguage(raw.lang),parsed=G.magic.parseCollectorEvidence(ctx.collector),route=magicRoute(ctx,raw);
    if(raw.digital||raw.oversized||!raw.games.includes('paper')||!['normal','split','flip','adventure','transform','modal_dfc'].includes(raw.layout))return result('unsupported');
    if(!magicLangs.includes(raw.lang)||language.status!=='valid')return result('unknown');
    if(language.locale!==ctx.locale||route==='no_match')return result('no_match');
    if(parsed.status!=='valid')return result(parsed.status);
    if(parsed.comparison_code!==raw.collector_number)return result('no_match');
    const name=raw.lang==='en'?raw.name:raw.printed_name||(faces.length&&faces.every(f=>f.printed_name)?faces.map(f=>f.printed_name).join(' // '):null);
    if(!name)return result('unknown');
    const variant=G.magic.normalizeVariant({variant:'',rarity:raw.rarity,name,set:raw.set_name},evidence),labels={nonfoil:'Nonfoil',foil:'Foil',etched:'Etched',normal:'Normal',alternate_art:'Alternate Art',borderless:'Borderless',extended_art:'Extended Art',showcase:'Showcase',retro_frame:'Retro Frame',prerelease_stamp:'Prerelease Stamp'};
    const legacy={catalogId:raw.id,tcg:'magic',name,set:raw.set_name,number:raw.collector_number,language:language.language,sourceLang:raw.lang,rarity:raw.rarity,variant:[variant.finish,variant.artwork,variant.treatment].filter(x=>x!==null).map(x=>labels[x]).join(' · '),image,marketEur:null,marketUsd:null,priceSource:null,catalogVerified:route==='exact',catalogConfidence:null,confidence:null};
    const normalized={name,set_name:raw.set_name,collector_number:raw.collector_number,language:language.language,rarity:G.magic.normalizeRarity(raw.rarity),variant,image};
    const records=[C.providerRecord({ref:ref('card',language.locale),source,raw,normalized,legacy},binding)];
    if(variant.status==='valid')records.push(C.providerRecord({ref:ref('variant',language.locale,'finish:'+variant.finish),source,raw,normalized,legacy},binding));
    return result('candidates',records);
  }
  return C.freeze({tcgdex:C.catalogProviderAdapter({provider_key:'tcgdex',provider_version:'1',game_key:'pokemon',operations,translate:tcgdexTranslate}),optcg:C.catalogProviderAdapter({provider_key:'optcg',provider_version:'1',game_key:'one_piece',operations,translate:optcgTranslate}),scryfall:C.catalogProviderAdapter({provider_key:'scryfall',provider_version:'1',game_key:'magic',operations:{search:'record_translation_only',getSet:'record_translation_only',getCard:'record_translation_only',listVariants:'record_translation_only'},translate:scryfallTranslate})});
});
