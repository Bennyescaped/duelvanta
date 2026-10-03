/* TCG-I1: pure contracts. No release, persistence, transport or ownership policy. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DV_TCG_V1_CONTRACTS=api;
})(globalThis,function(){
  'use strict';
  /** @typedef {'planned'|'available'|'retired'} GameStatus */
  /** @typedef {'unsupported'|'planned'|'ready'} CapabilityStatus */
  /** @typedef {{kind:'LegacyItemRef',item_id:string}} LegacyItemRef */
  /** @typedef {{kind:'ProviderCandidateRef',game_key:string,provider_key:string,
   * namespace:string,entity_kind:'set'|'card'|'variant',external_id:string,
   * locale:string|null,discriminator:string|null}} ProviderCandidateRef */
  const capabilityKeys=['catalog','collection','binder','marketplace','scanner','pricing','sealed','grading','battle'];
  const languages=['DE','EN','JP','FR','IT','ES','KR','CN','OTHER'];
  const locales={DE:'de',EN:'en',JP:'ja',FR:'fr',IT:'it',ES:'es',KR:'ko',CN:'zh-cn',OTHER:null};
  const profiles={catalog:['legacy_lookup'],collection:['legacy_items'],binder:['legacy_slots'],marketplace:['legacy_snapshots'],scanner:['raw_review','slab_review'],pricing:['legacy_raw'],sealed:['manual_listing'],grading:['manual','label_review'],battle:['webcam_casual','webcam_ranked']};
  const axes={finish:['holo','reverse_holo'],artwork:['parallel','manga','wanted_poster'],treatment:['signed'],edition:['promo','reprint','tournament']};
  const variantVocabularyVersion='1';
  const variantVocabularies={pokemon:axes,one_piece:axes,magic:{finish:['nonfoil','foil','etched'],artwork:['normal','alternate_art'],treatment:['normal','borderless','extended_art','showcase','retro_frame','prerelease_stamp'],edition:[]}};
  const emptyVariantVocabulary={finish:[],artwork:[],treatment:[],edition:[]};
  function variantVocabulary(game_key){token(game_key);return Object.hasOwn(variantVocabularies,game_key)?variantVocabularies[game_key]:freeze(emptyVariantVocabulary)}
  function fail(message){throw new TypeError('TCG contract: '+message)}
  function object(v){if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)fail('plain object required');return v}
  function shape(v,required,optional=[]){object(v);for(const k of Reflect.ownKeys(v)){if(typeof k!=='string'||!required.concat(optional).includes(k))fail('unknown field '+String(k));const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value'in d))fail('accessor not allowed')}for(const k of required)if(!Object.hasOwn(v,k))fail('missing '+k);return v}
  function text(v,{empty=false,max=500}={}){if(typeof v!=='string'||v.length>max||(!empty&&!v.trim())||/[\u0000-\u001f\u007f]/.test(v))fail('invalid text');return v}
  function token(v){text(v);if(!/^[a-z][a-z0-9_]*$/.test(v)||['constructor','prototype','__proto__'].includes(v))fail('invalid key');return v}
  function choice(v,allowed){if(!allowed.includes(v))fail('unsupported value '+String(v));return v}
  function list(v,check){if(!Array.isArray(v)||v.length>1000)fail('array required');v.forEach(check);return v}
  function unique(v){if(new Set(v).size!==v.length)fail('duplicate value');return v}
  function freeze(v){if(v&&(typeof v==='object'||typeof v==='function')&&!Object.isFrozen(v)){Object.freeze(v);for(const x of Object.values(v))freeze(x)}return v}
  // JSON data only; clone before freezing, so callers cannot mutate a retained alias.
  function copy(v,depth=0){if(depth>20)fail('data nesting');if(v===null||typeof v==='boolean'||typeof v==='string')return v;if(typeof v==='number'&&Number.isFinite(v))return v;if(Array.isArray(v))return v.map(x=>copy(x,depth+1));object(v);const out={};for(const k of Reflect.ownKeys(v)){if(typeof k!=='string'||['__proto__','constructor','prototype'].includes(k))fail('unsafe data key');const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value'in d))fail('accessor data');out[k]=copy(d.value,depth+1)}return out}
  const immutable=v=>freeze(copy(v));
  function presentation(v){shape(v,['label','icon_path','badge']);text(v.label);if(/[<>]/.test(v.label))fail('unsafe label');if(v.icon_path!==null&&!(typeof v.icon_path==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_/-]*\.svg$/.test(v.icon_path)&&!v.icon_path.includes('..')))fail('unsafe icon');choice(v.badge,['neutral','pokemon','one_piece']);return immutable(v)}
  function languageScopes(v){shape(v,['manual','catalog','scanner','pricing']);for(const s of Object.keys(v)){unique(list(v[s],x=>{shape(x,['language','locale']);choice(x.language,languages);if(x.locale!==locales[x.language])fail('locale mismatch')}).map(x=>x.language))}return immutable(v)}
  function variantCapabilities(v,game_key=undefined){const vocabulary=game_key===undefined?axes:variantVocabulary(game_key);shape(v,Object.keys(axes));for(const k of Object.keys(axes)){shape(v[k],['status','codes']);choice(v[k].status,['unsupported','planned','ready']);unique(list(v[k].codes,x=>choice(x,vocabulary[k])));if(v[k].status!=='ready'&&v[k].codes.length)fail('inactive axis with codes')}return immutable(v)}
  // Evidence is a closed data contract, not an extensible metadata dictionary.
  function evidenceArray(v,max,check,distinct=false){
    if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>max)fail('evidence array');
    const keys=new Set(['length',...Array.from({length:v.length},(_,i)=>String(i))]);
    for(const k of Reflect.ownKeys(v)){if(!keys.has(k))fail('evidence array field');const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!('value'in d))fail('evidence array accessor')}
    for(let i=0;i<v.length;i++){if(!Object.hasOwn(v,i))fail('sparse evidence array');check(v[i])}
    if(distinct)unique(v);return v;
  }
  function evidenceUuid(v){if(typeof v!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v))fail('evidence UUID')}
  function evidenceCode(v,max=32){text(v,{max});if(!/^[a-z0-9_]+$/.test(v))fail('evidence provider code')}
  function evidenceDate(v){
    if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))fail('evidence date');
    const y=Number(v.slice(0,4)),m=Number(v.slice(5,7)),d=Number(v.slice(8,10));
    const days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
    if(m<1||m>12||d<1||d>days[m-1])fail('evidence date');
  }
  const nullable=(v,check)=>{if(v!==null)check(v)};
  const evidenceBoolean=v=>{if(typeof v!=='boolean')fail('evidence boolean')};
  function printingContext(v){
    shape(v,['id','set_id','oracle_id','lang','layout','collector_number','released_at','variation','reprint']);
    evidenceUuid(v.id);evidenceUuid(v.set_id);nullable(v.oracle_id,evidenceUuid);evidenceCode(v.lang,16);evidenceCode(v.layout);
    text(v.collector_number,{max:128});nullable(v.released_at,evidenceDate);nullable(v.variation,evidenceBoolean);nullable(v.reprint,evidenceBoolean);
  }
  const appearanceFields=['frame','border_color','full_art','frame_effects','promo_types','illustration_ids','variation_of'];
  function appearanceEvidence(v){
    nullable(v.frame,evidenceCode);nullable(v.border_color,evidenceCode);nullable(v.full_art,evidenceBoolean);
    evidenceArray(v.frame_effects,32,evidenceCode,true);evidenceArray(v.promo_types,32,evidenceCode,true);
    evidenceArray(v.illustration_ids,2,x=>nullable(x,evidenceUuid));nullable(v.variation_of,evidenceUuid);
  }
  function magicVariantEvidence(v){
    shape(v,['contract','version','game_key','provider_key','provider_version','printing_context','chosen_finish','available_finishes',...appearanceFields],['reference_kind','reference_printing']);
    for(const [k,value] of Object.entries({contract:'MagicVariantEvidence',version:'1',game_key:'magic',provider_key:'scryfall',provider_version:'1'}))choice(v[k],[value]);
    printingContext(v.printing_context);nullable(v.chosen_finish,x=>choice(x,variantVocabularies.magic.finish));
    evidenceArray(v.available_finishes,3,x=>choice(x,variantVocabularies.magic.finish),true);appearanceEvidence(v);
    if(Object.hasOwn(v,'reference_kind')!==Object.hasOwn(v,'reference_printing'))fail('reference pair');
    if(Object.hasOwn(v,'reference_kind')){
      nullable(v.reference_kind,x=>choice(x,['same_set_standard','earlier_modern_standard']));
      if((v.reference_kind===null)!==(v.reference_printing===null))fail('reference pair');
      if(v.reference_printing!==null){shape(v.reference_printing,['printing_context',...appearanceFields]);printingContext(v.reference_printing.printing_context);appearanceEvidence(v.reference_printing)}
    }
    return immutable(v);
  }
  function metadataSchema(v){shape(v,['version','fields']);text(v.version);list(v.fields,x=>{shape(x,['key','type','values']);token(x.key);choice(x.type,['text','enum']);list(x.values,y=>text(y));if(x.type==='text'&&x.values.length)fail('text enum values')});unique(v.fields.map(x=>x.key));return immutable(v)}
  function metadata(schema,v){v=copy(v);object(v);for(const k of Reflect.ownKeys(v)){const field=schema.fields.find(f=>f.key===k);if(!field)fail('unknown metadata '+String(k));text(v[k],{empty:true});if(field.type==='enum')choice(v[k],field.values)}return immutable(v)}
  function searchDescriptors(v){list(v,x=>{shape(x,['key','kind','values']);choice(x.key,['name','collector_number','set','language','rarity','variant']);choice(x.kind,['text','select','multi_select']);list(x.values,y=>text(y));if(x.kind==='text'&&x.values.length)fail('text facet values')});unique(v.map(x=>x.key));return immutable(v)}
  function ref(v,{game_key,provider_key,entity_kind}={}){shape(v,['kind','game_key','provider_key','namespace','entity_kind','external_id','locale','discriminator']);choice(v.kind,['ProviderCandidateRef']);token(v.game_key);token(v.provider_key);text(v.namespace);choice(v.entity_kind,['set','card','variant']);text(v.external_id);if(v.locale!==null)choice(v.locale,Object.values(locales).filter(Boolean));if(v.discriminator!==null)text(v.discriminator);if(game_key&&v.game_key!==game_key)fail('crossgame ref');if(provider_key&&v.provider_key!==provider_key)fail('crossprovider ref');if(entity_kind&&v.entity_kind!==entity_kind)fail('entity kind');return immutable(v)}
  // Equality of observed external references only; NOT a canonical card identity.
  function sameRef(a,b){a=ref(a);b=ref(b);return Object.keys(a).every(k=>a[k]===b[k])}
  function legacyItemRef(v){shape(v,['kind','item_id']);choice(v.kind,['LegacyItemRef']);if(typeof v.item_id!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v.item_id))fail('legacy UUID');return immutable(v)}
  function collectorInput(v){shape(v,['text','source']);text(v.text,{empty:true,max:4000});choice(v.source,['ocr','manual','recognition']);return immutable(v)}
  function variantInput(v){shape(v,['variant','rarity','name','set']);Object.values(v).forEach(x=>text(x,{empty:true}));return immutable(v)}
  function observation(v){shape(v,['version','selected_game','observed_game','identifier','language','name','set','rarity','variant','source','confidence','uncertain','metadata']);choice(v.version,['1']);token(v.selected_game);if(v.observed_game!==null)token(v.observed_game);for(const k of ['identifier','language','name','set','rarity','variant'])if(v[k]!==null)text(v[k],{empty:true,max:4000});choice(v.source,['ocr','manual','recognition']);if(v.confidence!==null&&!(Number.isFinite(v.confidence)&&v.confidence>=0&&v.confidence<=1))fail('confidence');if(typeof v.uncertain!=='boolean')fail('uncertain');object(v.metadata);return immutable(v)}
  function activeRecognitionProfile(v){shape(v,['version','number_profile','manual_pattern','card_ratio','ocr_regions','visual_regions','ranking','review','coverage']);text(v.version);text(v.number_profile);text(v.manual_pattern);if(!Number.isFinite(v.card_ratio)||v.card_ratio<=0)fail('ratio');for(const key of ['ocr_regions','visual_regions'])list(v[key],row=>{if(!Array.isArray(row)||row.length!==(key==='ocr_regions'?6:5)||row.some(x=>!Number.isFinite(x)))fail('region')});shape(v.ranking,['exact_bonus','visual_bands','quality_bonus','quality_penalty']);list(v.ranking.visual_bands,r=>{if(!Array.isArray(r)||r.length!==2||r.some(x=>!Number.isFinite(x)))fail('score band')});for(const k of ['exact_bonus','quality_bonus','quality_penalty'])if(!Number.isFinite(v.ranking[k]))fail('score');shape(v.review,['quality_min','reflection_visual_min','glare_max','visual_min','variant_clear','variant_reflection','language_clear','ready_confidence','ready_quality','provider_review_required']);for(const k of ['variant_clear','variant_reflection','language_clear'])if(v.review[k]!==null){if(!Array.isArray(v.review[k])||v.review[k].length!==2||v.review[k].some(x=>!Number.isFinite(x)))fail('review band')}for(const k of ['quality_min','reflection_visual_min','glare_max','visual_min','ready_confidence','ready_quality'])if(!Number.isFinite(v.review[k]))fail('review number');if(v.review.provider_review_required!==true)fail('provider review');choice(v.coverage,['legacy_limited']);return immutable(v)}
  const activeProfileFields=['number_profile','manual_pattern','card_ratio','ocr_regions','visual_regions','ranking','review'];
  function recognitionProfile(v){
    object(v);const d=Object.getOwnPropertyDescriptor(v,'coverage');if(!d||!('value'in d))fail('coverage data field');
    choice(d.value,['legacy_limited','inactive']);if(d.value==='legacy_limited')return activeRecognitionProfile(v);
    shape(v,['version','coverage','state','reason']);choice(v.version,['1']);choice(v.state,['planned','unsupported']);
    if(v.reason!==(v.state==='planned'?'not_calibrated':'out_of_scope'))fail('inactive profile reason');
    return new Proxy(immutable(v),{get(target,key,receiver){if(activeProfileFields.includes(key))fail('recognition_profile_inactive');return Reflect.get(target,key,receiver)}});
  }
  function requireActiveRecognitionProfile(v){const p=recognitionProfile(v);if(p.coverage==='inactive')fail('recognition_profile_inactive');return p}
  const methodNames=['parseCollectorEvidence','normalizeSetRef','normalizeCardRef','normalizeLanguage','normalizeRarity','normalizeVariant','normalizeObservation'];
  function gameAdapter(v){shape(v,['game_key','adapter_id','adapter_version',...methodNames,'recognitionProfile','metadataSchema','searchDescriptors','presentation'],['battleProfile']);token(v.game_key);token(v.adapter_id);text(v.adapter_version);methodNames.forEach(k=>{if(typeof v[k]!=='function')fail('adapter method '+k)});const validatedProfile=recognitionProfile(v.recognitionProfile);metadataSchema(v.metadataSchema);searchDescriptors(v.searchDescriptors);presentation(v.presentation);if(v.battleProfile){shape(v.battleProfile,['modes']);unique(list(v.battleProfile.modes,x=>choice(x,profiles.battle)))}return freeze({...v,recognitionProfile:validatedProfile,metadataSchema:immutable(v.metadataSchema),searchDescriptors:immutable(v.searchDescriptors),presentation:immutable(v.presentation),...(v.battleProfile?{battleProfile:immutable(v.battleProfile)}:{})})}
  function providerBinding(v){shape(v,['type','provider_key','provider_version','game_key','priority']);choice(v.type,['catalog']);token(v.provider_key);text(v.provider_version);token(v.game_key);if(!Number.isInteger(v.priority)||v.priority<0)fail('priority');return immutable(v)}
  function rarityResult(v,game){shape(v,['status','original','code']);choice(v.status,['valid','unknown']);if(v.original!==null)text(v.original,{empty:true});if(v.code!==null){text(v.code);if(!v.code.startsWith(game+':'))fail('rarity namespace')}if((v.status==='valid')!==(v.code!==null))fail('rarity state');return immutable(v)}
  function variantResult(v,game){shape(v,['status','original','legacy_family','game_code','finish','artwork','treatment','edition']);choice(v.status,['valid','unknown']);variantInput(v.original);token(v.legacy_family);if(v.game_code!==null){text(v.game_code);if(!v.game_code.startsWith(game+':'))fail('variant namespace')}const vocabulary=variantVocabulary(game);for(const k of Object.keys(axes))if(v[k]!==null)choice(v[k],vocabulary[k]);if(game==='magic'){if(v.edition!==null)fail('magic edition');if(v.status==='valid'&&(!v.finish||!v.artwork||!v.treatment||v.legacy_family!==v.treatment||v.game_code!=='magic:'+v.treatment))fail('magic variant state');if(v.status==='unknown'&&(v.legacy_family!=='unknown'||v.game_code!==null))fail('magic unknown variant state')}return immutable(v)}
  function providerRecord(v,binding){shape(v,['ref','source','raw','normalized','legacy']);ref(v.ref,binding);shape(v.source,['provider_version','record_version','retrieved_at','source_path']);if(v.source.provider_version!==binding.provider_version)fail('provider version');text(v.source.record_version);text(v.source.source_path);if(v.source.retrieved_at!==null&&(!/^\d{4}-\d\d-\d\dT.*Z$/.test(v.source.retrieved_at)||!Number.isFinite(Date.parse(v.source.retrieved_at))))fail('source time');if(v.ref.entity_kind==='set'){shape(v.normalized,['name','language']);text(v.normalized.name);if(v.normalized.language!==null)choice(v.normalized.language,languages)}else{shape(v.normalized,['name','set_name','collector_number','language','rarity','variant','image']);for(const k of ['name','set_name','collector_number'])text(v.normalized[k],{empty:true});if(v.normalized.language!==null)choice(v.normalized.language,languages);rarityResult(v.normalized.rarity,v.ref.game_key);variantResult(v.normalized.variant,v.ref.game_key);if(v.normalized.image!==null){text(v.normalized.image);if(!/^https:\/\/[^\s<>]+$/.test(v.normalized.image))fail('unsafe image')}}object(v.raw);object(v.legacy);return immutable(v)}
  function providerRequest(op,v,binding){choice(op,['search','getSet','getCard','listVariants','importRecords']);shape(v,['game_key','locale'],['text','ref','collector']);if(v.game_key!==binding.game_key)fail('crossgame request');if(v.locale!==null)choice(v.locale,Object.values(locales).filter(Boolean));if(v.text!==undefined)text(v.text,{empty:true});if(v.ref!==undefined){ref(v.ref,binding);if(v.ref.locale!==v.locale)fail('request locale mismatch')}if(v.collector!==undefined)collectorInput(v.collector);if(op==='getSet'&&v.ref?.entity_kind!=='set')fail('set request');if(['getCard','listVariants'].includes(op)&&v.ref?.entity_kind!=='card')fail('card request');if(op==='search'&&v.text===undefined&&v.collector===undefined)fail('search terms');return immutable(v)}
  function catalogProviderAdapter(v){shape(v,['provider_key','provider_version','game_key','operations','translate']);token(v.provider_key);text(v.provider_version);token(v.game_key);shape(v.operations,['search','getSet','getCard','listVariants'],['importRecords']);for(const value of Object.values(v.operations))choice(value,['record_translation_only','unsupported']);if(typeof v.translate!=='function')fail('translate');return freeze({...v,operations:immutable(v.operations)})}
  function descriptor(v,adapters,providers){shape(v,['game_key','display_name','status','adapter_id','adapter_version','capabilities','supported_languages','variant_capabilities','presentation','providers']);token(v.game_key);text(v.display_name);if(/[<>]/.test(v.display_name))fail('unsafe display name');choice(v.status,['planned','available','retired']);shape(v.capabilities,capabilityKeys);for(const k of capabilityKeys){const c=v.capabilities[k];shape(c,['status','profiles']);choice(c.status,['unsupported','planned','ready']);unique(list(c.profiles,x=>choice(x,profiles[k])));if(c.status==='ready'&&!c.profiles.length)fail('ready requires scoped profile');if(c.status!=='ready'&&c.profiles.length)fail('inactive capability profile');if(v.status==='planned'&&c.status==='ready')fail('planned ready');}
    if(v.adapter_id===null){if(v.adapter_version!==null||v.status==='available')fail('missing adapter')}else{token(v.adapter_id);text(v.adapter_version);const a=adapters.find(x=>x.adapter_id===v.adapter_id&&x.adapter_version===v.adapter_version&&x.game_key===v.game_key);if(!a)fail('unbound adapter')}
    if(v.capabilities.scanner.status==='ready'){const a=adapters.find(x=>x.adapter_id===v.adapter_id&&x.adapter_version===v.adapter_version&&x.game_key===v.game_key);if(!a)fail('scanner without adapter');requireActiveRecognitionProfile(a.recognitionProfile)}
    languageScopes(v.supported_languages);variantCapabilities(v.variant_capabilities,v.game_key);presentation(v.presentation);list(v.providers,b=>{providerBinding(b);if(b.game_key!==v.game_key||!providers.some(p=>p.game_key===b.game_key&&p.provider_key===b.provider_key&&p.provider_version===b.provider_version))fail('unbound provider')});unique(v.providers.map(b=>b.type+':'+b.provider_key));if(v.status==='planned'&&(v.providers.length||Object.values(v.variant_capabilities).some(x=>x.status==='ready')||Object.values(v.supported_languages).some(x=>x.length)))fail('planned activation');if(v.capabilities.catalog.status==='ready'&&!v.providers.length)fail('catalog without source');if(v.capabilities.binder.status==='ready'&&v.capabilities.collection.status!=='ready')fail('binder without collection');if(v.capabilities.scanner.status==='ready'&&v.capabilities.catalog.status!=='ready')fail('scanner without catalog');return immutable(v)
  }
  function createRegistry(definitions,{adapters=[],providers=[]}={}){adapters=list(adapters,x=>object(x)).map(gameAdapter);providers=list(providers,x=>object(x)).map(catalogProviderAdapter);unique(adapters.map(x=>x.adapter_id+':'+x.adapter_version));unique(providers.map(x=>x.game_key+':'+x.provider_key+':'+x.provider_version));const entries=list(definitions,x=>object(x)).map(x=>descriptor(x,adapters,providers));unique(entries.map(x=>x.game_key));freeze(entries);const get=key=>{token(key);const d=entries.find(x=>x.game_key===key);if(!d)fail('unknown game');return d};return freeze({version:'1',entries,get,adapter:key=>{const d=get(key);if(!d.adapter_id)fail('game has no adapter');return adapters.find(a=>a.adapter_id===d.adapter_id&&a.adapter_version===d.adapter_version&&a.game_key===key)},isEnabled:(key,capability,gates)=>{const d=get(key);choice(capability,capabilityKeys);shape(gates,['release','environment','platform','account']);Object.values(gates).forEach(x=>{if(typeof x!=='boolean')fail('gate boolean')});return d.status==='available'&&d.capabilities[capability].status==='ready'&&Object.values(gates).every(Boolean)}})}
  return freeze({version:'1.1',capabilityKeys,languages,locales,profiles,axes,variantVocabularyVersion,variantVocabularies,variantVocabulary,magicVariantEvidence,fail,shape,text,token,choice,list,unique,freeze,copy,immutable,presentation,languageScopes,variantCapabilities,metadataSchema,metadata,searchDescriptors,ref,sameRef,legacyItemRef,collectorInput,variantInput,observation,recognitionProfile,requireActiveRecognitionProfile,gameAdapter,providerBinding,rarityResult,variantResult,providerRecord,providerRequest,catalogProviderAdapter,descriptor,createRegistry});
});
