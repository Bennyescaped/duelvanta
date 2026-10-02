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
  return C.freeze({tcgdex:C.catalogProviderAdapter({provider_key:'tcgdex',provider_version:'1',game_key:'pokemon',operations,translate:tcgdexTranslate}),optcg:C.catalogProviderAdapter({provider_key:'optcg',provider_version:'1',game_key:'one_piece',operations,translate:optcgTranslate})});
});
