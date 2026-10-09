/* Printing lookup projection only. The existing Scryfall adapter owns all
 * normalization. Provider UUIDs never become DUELVANTA canonical IDs. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./tcg-v1-catalog-providers.js'),require('./tcg-v1-game-adapters.js'));
  else root.DV_MAGIC_ON_DEMAND=factory(root.DV_TCG_V1_PROVIDERS,root.DV_TCG_V1_GAMES);
})(globalThis,function(P,G){
  'use strict';
  const languages=Object.freeze({EN:'en',DE:'de',FR:'fr',IT:'it',ES:'es',JP:'ja',KR:'ko',CN:'zhs'});
  function printingInput(input){
    if(!input||Object.getPrototypeOf(input)!==Object.prototype||Object.keys(input).sort().join(',')!=='collector_number,language,set_code')throw new TypeError('magic_lookup_input');
    const {set_code,collector_number,language}=input;
    if(typeof set_code!=='string'||!/^[a-z0-9]{2,8}$/i.test(set_code))throw new TypeError('magic_set_code');
    if(typeof collector_number!=='string'||collector_number.length>128||! /^[\p{L}\p{N}★☆†‡*._+:/-]+$/u.test(collector_number)||['.','..'].includes(collector_number))throw new TypeError('magic_collector_number');
    if(!Object.hasOwn(languages,language))throw new TypeError('magic_language');
    const set=set_code.toLowerCase(),lang=languages[language];
    return Object.freeze({set_code:set,collector_number,language,provider_language:lang,locale:G.magic.normalizeLanguage(language).locale,source_path:'api/cards/'+encodeURIComponent(set)+'/'+encodeURIComponent(collector_number)+'/'+lang});
  }
  function translatePrinting(raw,input,retrieved_at){
    const query=printingInput(input);let result;
    try{result=P.scryfall.translate(raw,{game_key:'magic',locale:query.locale,collector:{text:query.collector_number,source:'manual'},source_path:query.source_path,retrieved_at});}
    catch(error){
      if(error instanceof TypeError&&error.message==='TCG contract: scryfall face count'){
        P.scryfallCardStructure(raw);
        return Object.freeze({status:'unsupported',reason:'unresolved_face_count_outside_initial_scope',candidate:null});
      }
      throw error;
    }
    if(result.status!=='candidates')return Object.freeze({status:result.status,candidate:null});
    const cards=result.records.filter(record=>record.ref.entity_kind==='card');
    if(cards.length!==1)return Object.freeze({status:'ambiguous',candidate:null});
    const r=cards[0],l=r.legacy;
    // No raw/image/price export; no invented VariantEvidence or canonical link.
    return Object.freeze({status:'candidates',candidate:Object.freeze({tcg:l.tcg,name:l.name,set:l.set,number:l.number,language:l.language,rarity:l.rarity,variant:l.variant,provider_ref:r.ref,source:r.source})});
  }
  return Object.freeze({languages,printingInput,translatePrinting});
});
