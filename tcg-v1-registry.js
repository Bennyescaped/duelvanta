/* Single browser/CommonJS registry definition. Dormant foundation: no consumer
 * loads it in I1. ready describes legacy scope; it never grants release access. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./tcg-v1-contracts.js'),require('./tcg-v1-game-adapters.js'),require('./tcg-v1-catalog-providers.js'));
  else root.DV_TCG_V1_REGISTRY=factory(root.DV_TCG_V1_CONTRACTS,root.DV_TCG_V1_GAMES,root.DV_TCG_V1_PROVIDERS);
})(globalThis,function(C,G,P){
  'use strict';
  if(!C||!G||!P)throw new Error('TCG contracts, games and providers must load first');
  const scope=keys=>keys.map(language=>({language,locale:C.locales[language]}));
  const caps=ready=>Object.fromEntries(C.capabilityKeys.map(k=>[k,{status:ready?'ready':'unsupported',profiles:ready?C.profiles[k]:[]}]));
  const variants=values=>Object.fromEntries(Object.keys(C.axes).map(k=>[k,{status:values[k]?.length?'ready':'unsupported',codes:values[k]||[]}]));
  function legacy(game,provider,catalog){const a=G[game];return{game_key:game,display_name:a.presentation.label,status:'available',adapter_id:a.adapter_id,adapter_version:a.adapter_version,
    capabilities:caps(true),supported_languages:{manual:scope(C.languages),catalog:scope(catalog),scanner:scope(catalog),pricing:scope(game==='pokemon'?['DE','EN','JP','KR','CN']:['EN'])},
    variant_capabilities:variants(game==='pokemon'?{finish:['holo','reverse_holo'],edition:['promo']}:{artwork:['parallel','manga','wanted_poster'],treatment:['signed'],edition:['promo','reprint','tournament']}),presentation:a.presentation,
    providers:[{type:'catalog',provider_key:provider.provider_key,provider_version:provider.provider_version,game_key:game,priority:0}]}}
  function reserved(game,name){return{game_key:game,display_name:name,status:'planned',adapter_id:null,adapter_version:null,capabilities:caps(false),supported_languages:{manual:[],catalog:[],scanner:[],pricing:[]},variant_capabilities:variants({}),presentation:{label:name,icon_path:null,badge:'neutral'},providers:[]}}
  return C.createRegistry([
    legacy('pokemon',P.tcgdex,['DE','EN','JP','KR']),legacy('one_piece',P.optcg,['EN']),
    {...reserved('magic','Magic: The Gathering'),status:'available',adapter_id:G.magic.adapter_id,adapter_version:G.magic.adapter_version,
      capabilities:{...caps(false),collection:{status:'ready',profiles:['legacy_items']},binder:{status:'ready',profiles:['legacy_slots']},catalog:{status:'ready',profiles:['legacy_lookup']},scanner:{status:'planned',profiles:[]},marketplace:{status:'planned',profiles:[]}},
      supported_languages:{manual:scope(['EN','DE','FR','IT','ES','JP','KR','CN']),catalog:scope(['EN','DE','FR','IT','ES','JP','KR','CN']),scanner:[],pricing:[]},
      variant_capabilities:variants(C.variantVocabularies.magic),
      providers:[{type:'catalog',provider_key:'scryfall',provider_version:'1',game_key:'magic',priority:0}]},reserved('yugioh','Yu-Gi-Oh!'),reserved('naruto','Naruto')
  ],{adapters:Object.values(G),providers:Object.values(P)});
});
