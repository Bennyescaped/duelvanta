/* Parallel I1 compatibility boundary. Legacy functions below are copied, not loaded
 * from consumer globals: scanner-v16-tcg.js 16.2 and quality.js 16.3 at the bound base.
 * No consumer imports this file. Original evidence is retained beside projections. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./tcg-v1-contracts.js'));
  else root.DV_TCG_V1_GAMES=factory(root.DV_TCG_V1_CONTRACTS);
})(globalThis,function(C){
  'use strict';
  if(!C)throw new Error('TCG contracts must load first');
  const plain=s=>String(s||'').normalize('NFKC').toUpperCase().replace(/[—–−]/g,'-').replace(/[\\／]/g,'/');

  function pokemonText(text){return plain(text).replace(/[Oo]/g,'0').replace(/[Il|!]/g,'1')}
  function pokemonIds(text){
    const out=[];for(const m of pokemonText(text).matchAll(/(?:^|\D)(\d{1,3})\s*[\/|]\s*(\d{2,3})(?:\D|$)/g)){
      const a=Number(m[1]),b=Number(m[2]);if(a>=1&&a<=999&&b>=10&&b<=999)out.push({local:m[1],den:m[2],code:`${m[1]}/${m[2]}`});
    }return out;
  }
  function onePieceText(text){
    return plain(text)
      .replace(/\s+/g,' ')
      .replace(/\b0P(?=\s*[- ]?\s*\d)/g,'OP')
      .replace(/\b5T(?=\s*[- ]?\s*\d)/g,'ST')
      .replace(/\bE8(?=\s*[- ]?\s*\d)/g,'EB')
      .replace(/\bPR8(?=\s*[- ]?\s*\d)/g,'PRB');
  }
  function canonicalOnePiece(prefix,setNo,cardNo){
    prefix=String(prefix||'').toUpperCase();cardNo=String(cardNo||'').replace(/\D/g,'');
    if(prefix==='P')return cardNo?`P-${cardNo.padStart(3,'0')}`:null;
    const sn=String(setNo||'').replace(/\D/g,'');if(!sn||!cardNo)return null;
    return `${prefix}${sn.padStart(2,'0')}-${cardNo.padStart(3,'0')}`;
  }
  function onePieceIds(text){
    const s=onePieceText(text),out=[],seen=new Set();
    const add=code=>{if(code&&!seen.has(code)){seen.add(code);out.push({code})}};
    for(const m of s.matchAll(/\b(OP|ST|EB|PRB)\s*[- ]?\s*([0-9OSIl|]{1,2})\s*[- ]\s*([0-9OSIl|]{2,3})\b/g)){
      const setNo=m[2].replace(/[Oo]/g,'0').replace(/S/g,'5').replace(/[Il|]/g,'1'),card=m[3].replace(/[Oo]/g,'0').replace(/S/g,'5').replace(/[Il|]/g,'1');add(canonicalOnePiece(m[1],setNo,card));
    }
    for(const m of s.matchAll(/\b(OP|ST|EB|PRB)\s*([0-9OSIl|]{1,2})\s+([0-9OSIl|]{2,3})\b/g)){
      const setNo=m[2].replace(/[Oo]/g,'0').replace(/S/g,'5').replace(/[Il|]/g,'1'),card=m[3].replace(/[Oo]/g,'0').replace(/S/g,'5').replace(/[Il|]/g,'1');add(canonicalOnePiece(m[1],setNo,card));
    }
    for(const m of s.matchAll(/\bP\s*[- ]\s*([0-9OSIl|]{2,3})\b/g))add(canonicalOnePiece('P',null,m[1].replace(/[Oo]/g,'0').replace(/S/g,'5').replace(/[Il|]/g,'1')));
    return out;
  }
  function normalizePokemonCode(code){const m=String(code||'').match(/(\d{1,3})\s*\/\s*(\d{2,3})/);return m?`${Number(m[1])}/${Number(m[2])}`:String(code||'').trim().toUpperCase()}
  function normalizeOnePieceCode(code){const hits=onePieceIds(String(code||''));return hits[0]?.code||String(code||'').replace(/\s/g,'').toUpperCase()}
  const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[._-]+/g,' ').replace(/\s+/g,' ').trim();

  function languageOf(c){
    const raw=norm(c?.sourceLang||c?.language||'');
    if(!raw)return null;
    if(raw==='de'||raw==='ger'||raw==='deu'||raw.includes('german')||raw.includes('deutsch'))return'DE';
    if(raw==='en'||raw==='eng'||raw.includes('english'))return'EN';
    if(raw==='ja'||raw==='jp'||raw==='jpn'||raw.includes('japanese'))return'JP';
    if(raw==='ko'||raw==='kr'||raw==='kor'||raw.includes('korean'))return'KR';
    if(raw.startsWith('zh')||raw==='cn'||raw.includes('chinese'))return'CN';
    if(raw==='fr'||raw==='fra'||raw.includes('french'))return'FR';
    if(raw==='it'||raw==='ita'||raw.includes('italian'))return'IT';
    if(raw==='es'||raw==='spa'||raw.includes('spanish'))return'ES';
    return String(c?.language||c?.sourceLang||'').toUpperCase().slice(0,8)||null;
  }

  function variantFamily(c,tcg){
    const s=norm([c?.variant,c?.rarity,c?.name,c?.set].filter(Boolean).join(' '));
    if(!s)return'standard';
    if(tcg==='one_piece'){
      if(/\bmanga\b/.test(s))return'manga';
      if(/treasure rare|\btr\b/.test(s))return'treasure';
      if(/signed|signature/.test(s))return'signed';
      if(/winner|championship|tournament|regional|nationals/.test(s))return'tournament';
      if(/parallel|alternate art|alt art|\baa\b/.test(s))return'parallel';
      if(/special rare|special card|\bsp\b/.test(s))return'special';
      if(/promo|promotion/.test(s))return'promo';
      return'standard';
    }
    if(/special illustration rare|\bsir\b/.test(s))return'special_illustration';
    if(/illustration rare|\bir\b/.test(s))return'illustration';
    if(/shiny ultra rare|\bsur\b/.test(s))return'shiny_ultra';
    if(/shiny rare/.test(s))return'shiny';
    if(/hyper rare|\bhr\b|gold rare/.test(s))return'hyper';
    if(/secret rare|\bsar\b|\bsr\b/.test(s))return'secret';
    if(/rainbow/.test(s))return'rainbow';
    if(/reverse holo|reverse foil/.test(s))return'reverse_holo';
    if(/holo|foil/.test(s))return'holo';
    if(/promo|promotion/.test(s))return'promo';
    return'standard';
  }

  function language(raw){
    if(raw!==null)C.text(raw,{empty:true});
    const legacy=languageOf({language:raw});
    const known=C.languages.includes(legacy)&&legacy!=='OTHER';
    return C.immutable({status:known?'valid':'unknown',original:raw,language:known?legacy:null,locale:known?C.locales[legacy]:null,legacy});
  }
  const rarityCodes={
    pokemon:{common:'common',uncommon:'uncommon',rare:'rare','special illustration rare':'special_illustration','illustration rare':'illustration','shiny ultra rare':'shiny_ultra','shiny rare':'shiny','hyper rare':'hyper','secret rare':'secret'},
    one_piece:{c:'common',uc:'uncommon',r:'rare',sr:'super_rare',sec:'secret',l:'leader',p:'promo',sp:'special',tr:'treasure'}
  };
  function rarity(game,raw){if(raw!==null)C.text(raw,{empty:true});const code=rarityCodes[game][norm(raw)]||null;return C.immutable({status:code?'valid':'unknown',original:raw,code:code?game+':'+code:null})}
  function variant(game,input){
    C.variantInput(input);const family=variantFamily(input,game),s=norm(Object.values(input).join(' '));
    // Legacy family remains exact, including its standard fallback. It is NOT
    // proof of nonfoil/standard artwork. Rarity is never a universal finish.
    const finish=/reverse holo|reverse foil/.test(s)?'reverse_holo':/holo|foil/.test(s)?'holo':null;
    const artwork=game==='one_piece'?(family==='parallel'?'parallel':family==='manga'?'manga':/wanted poster/.test(s)?'wanted_poster':null):null;
    const treatment=family==='signed'?'signed':null;
    const edition=/reprint/.test(s)?'reprint':family==='promo'?'promo':family==='tournament'?'tournament':null;
    return C.immutable({status:family!=='standard'||finish||artwork||treatment||edition?'valid':'unknown',original:input,legacy_family:family,game_code:family==='standard'?null:game+':'+family,finish,artwork,treatment,edition});
  }
  const profiles={
    pokemon:{version:'legacy-v16.12/quality-v16.3',number_profile:'numeric_fraction_1_999_over_10_999',manual_pattern:'^\\d{1,3}\\s*/\\s*\\d{2,3}$',card_ratio:63/88,
      ocr_regions:[[0,.84,.67,1,1.1,6],[0,.88,1,1,1,11],[0,.58,1,1,1.3,6]],visual_regions:[[.07,.10,.93,.70,.46],[.10,.16,.90,.62,.34],[.04,.04,.96,.96,.20]],
      ranking:{exact_bonus:11,visual_bands:[[82,15],[70,9],[60,4]],quality_bonus:3,quality_penalty:-5},
      review:{quality_min:36,reflection_visual_min:86,glare_max:14,visual_min:55,variant_clear:[75,7],variant_reflection:[86,12],language_clear:[78,8],ready_confidence:84,ready_quality:42,provider_review_required:true},coverage:'legacy_limited'},
    one_piece:{version:'legacy-v16.12/quality-v16.3',number_profile:'OP_ST_EB_PRB_P',manual_pattern:'^(?:(?:OP|ST|EB|PRB)\\s*\\d{1,2}\\s*-\\s*\\d{2,3}|P\\s*-\\s*\\d{2,3})$',card_ratio:63/88,
      ocr_regions:[[0,.48,1,1,1.3,6],[0,.74,1,1,1.1,6],[0,.88,1,1,1,11]],visual_regions:[[.05,.08,.95,.74,.48],[.08,.16,.92,.66,.32],[.04,.04,.96,.96,.20]],
      ranking:{exact_bonus:16,visual_bands:[[84,22],[74,15],[64,8],[48,0],[0,-8]],quality_bonus:3,quality_penalty:-5},
      review:{quality_min:36,reflection_visual_min:86,glare_max:14,visual_min:55,variant_clear:[78,9],variant_reflection:[88,14],language_clear:null,ready_confidence:84,ready_quality:42,provider_review_required:true},coverage:'legacy_limited'}
  };
  function make(game,parse,normalize){
    const profile=profiles[game],schema={version:'1',fields:[]}; // No unproved game metadata intake in I1.
    function parseCollectorEvidence(input){
      C.collectorInput(input);
      const manual=input.text.trim().toUpperCase();
      const candidates=input.source!=='ocr'&&!new RegExp(profile.manual_pattern).test(manual)?[]:parse(input.text);
      const distinct=[...new Set(candidates.map(x=>normalize(x.code)))];
      return C.immutable({status:distinct.length===1?'valid':distinct.length>1?'ambiguous':'unknown',original:input.text,source:input.source,candidates,comparison_code:distinct.length===1?distinct[0]:null});
    }
    function normalizeObservation(input){
      const original=C.observation(input);C.metadata(schema,input.metadata);
      const collector=parseCollectorEvidence({text:input.identifier||'',source:input.source}),lang=language(input.language);
      const status=input.selected_game!==game||(input.observed_game!==null&&!['unknown',game].includes(input.observed_game))?'game_conflict':input.observed_game===null||input.observed_game==='unknown'?'unknown':collector.status==='ambiguous'||input.uncertain?'ambiguous':collector.status!=='valid'?'identifier_invalid':lang.status!=='valid'?'unknown':'valid';
      return C.immutable({status,state:status==='valid'?'unknown':status,resolution:'not_attempted',original,game_key:game,collector,language:lang,rarity:rarity(game,input.rarity),variant:variant(game,{variant:input.variant||'',rarity:input.rarity||'',name:input.name||'',set:input.set||''}),query:status==='valid'?{game_key:game,collector_number:collector.comparison_code,language:lang.language}:null,review_required:true});
    }
    return C.gameAdapter({game_key:game,adapter_id:game+'_legacy_v1',adapter_version:'1',parseCollectorEvidence,
      normalizeSetRef:value=>C.ref(value,{game_key:game,entity_kind:'set'}),normalizeCardRef:value=>C.ref(value,{game_key:game,entity_kind:'card'}),normalizeLanguage:language,normalizeRarity:raw=>rarity(game,raw),normalizeVariant:(input,structuredEvidence=undefined)=>{if(structuredEvidence!==undefined)C.fail('structured_variant_evidence_unsupported');return variant(game,input)},normalizeObservation,
      recognitionProfile:profile,metadataSchema:schema,searchDescriptors:[{key:'name',kind:'text',values:[]},{key:'collector_number',kind:'text',values:[]},{key:'set',kind:'text',values:[]}],presentation:{label:game==='pokemon'?'Pokémon':'One Piece Card Game',icon_path:null,badge:game},battleProfile:{modes:['webcam_casual','webcam_ranked']}});
  }
  const magicLanguageAliases={EN:['EN','en'],DE:['DE','de'],FR:['FR','fr'],IT:['IT','it'],ES:['ES','es','sp'],JP:['JP','ja','jp'],KR:['KR','ko','kr'],CN:['CN','zh-cn','zhs','cs']};
  const magicProviderLanguages=['en','de','fr','it','es','ja','ko','zhs'];
  function magicLanguage(raw){
    if(raw!==null)C.text(raw,{empty:true});
    const code=Object.keys(magicLanguageAliases).find(k=>magicLanguageAliases[k].includes(raw))||null;
    return C.immutable({status:code?'valid':'unknown',original:raw,language:code,locale:code?C.locales[code]:null,legacy:code||raw});
  }
  function magicRarity(raw){
    if(raw!==null)C.text(raw,{empty:true});const code=['common','uncommon','rare','mythic','special','bonus'].includes(raw)?'magic:'+raw:null;
    return C.rarityResult({status:code?'valid':'unknown',original:raw,code},'magic');
  }
  function magicCollector(input){
    C.collectorInput(input);
    // Each delimited literal is only syntactic evidence. No number conversion,
    // suffix removal, Unicode normalization or OCR substitution is performed.
    const parts=input.text.trim()?input.text.trim().split(/\s+/u):[];
    const codes=[...new Set(parts.filter(code=>code.length<=128))];
    const status=parts.some(code=>code.length>128)?'unknown':codes.length===1?'valid':codes.length>1?'ambiguous':'unknown';
    return C.immutable({status,original:input.text,source:input.source,candidates:codes.map(code=>({code})),comparison_code:status==='valid'?codes[0]:null});
  }
  function magicRef(value,kind){
    const r=C.ref(value,{game_key:'magic',provider_key:'scryfall',entity_kind:kind});
    C.choice(r.namespace,[kind==='set'?'api/sets':'api/cards']);
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(r.external_id)||r.discriminator!==null)C.fail('magic printing ref');
    if(kind==='set'){if(r.locale!==null)C.fail('magic set locale')}else C.choice(r.locale,Object.keys(magicLanguageAliases).map(k=>C.locales[k]));
    return r;
  }
  const magicFaceCounts={normal:1,transform:2,modal_dfc:2,split:2,adventure:2};
  function completeMagicArt(e){const n=Object.hasOwn(magicFaceCounts,e.printing_context.layout)?magicFaceCounts[e.printing_context.layout]:0;return n>0&&e.illustration_ids.length===n&&e.illustration_ids.every(id=>id!==null)}
  function baseMagicTreatment(e,finish){
    if(e.frame===null||e.border_color===null||e.full_art===null)return null;
    const modern=['2003','2015'].includes(e.frame),bordered=['black','white'].includes(e.border_color);
    const neutral=['legendary',...(finish==='etched'?['etched']:[])];
    const special=e.frame_effects.filter(x=>!neutral.includes(x));
    const promos=e.promo_types.filter(x=>x!=='boosterfun');
    if(modern&&bordered&&!e.full_art&&special.length===0&&promos.length===0)return'normal';
    if(modern&&e.border_color==='borderless'&&special.length===0&&promos.length===0)return'borderless';
    if(modern&&bordered&&special.length===1&&promos.length===0){if(special[0]==='extendedart')return'extended_art';if(special[0]==='showcase')return'showcase'}
    if(modern&&bordered&&!e.full_art&&special.length===0&&promos.length===2&&promos.includes('prerelease')&&promos.includes('datestamped')&&finish==='foil')return'prerelease_stamp';
    return null;
  }
  function standardMagicReference(r){return r!==null&&r!==undefined&&baseMagicTreatment(r,null)==='normal'&&r.printing_context.variation===false&&r.variation_of===null&&r.printing_context.oracle_id!==null&&completeMagicArt(r)}
  function comparableMagicConcept(a,b){
    const x=a.printing_context,y=b.printing_context;
    return x.oracle_id!==null&&x.oracle_id===y.oracle_id&&x.lang===y.lang&&magicProviderLanguages.includes(x.lang)&&x.layout===y.layout&&completeMagicArt(a)&&completeMagicArt(b);
  }
  function retroMagicReference(e){
    const r=e.reference_printing;if(e.reference_kind!=='earlier_modern_standard'||!standardMagicReference(r)||!comparableMagicConcept(e,r))return false;
    const a=e.printing_context,b=r.printing_context;
    return a.reprint===true&&a.id!==b.id&&a.released_at!==null&&b.released_at!==null&&b.released_at<a.released_at;
  }
  function magicArtwork(e){
    const r=e.reference_printing;if(!standardMagicReference(r)||!comparableMagicConcept(e,r))return null;
    if(e.reference_kind==='same_set_standard'){
      if(e.printing_context.set_id!==r.printing_context.set_id||e.variation_of!==null&&e.variation_of!==r.printing_context.id)return null;
      if(e.printing_context.id===r.printing_context.id){
        if(e.printing_context.variation!==false||e.variation_of!==null||baseMagicTreatment(e,null)!=='normal')return null;
        // A selfreference denotes the same record, not two conflicting art claims.
        if(Object.keys(e.printing_context).some(k=>e.printing_context[k]!==r.printing_context[k]))return null;
        for(const k of ['frame','border_color','full_art','variation_of'])if(e[k]!==r[k])return null;
        for(const k of ['frame_effects','promo_types','illustration_ids'])if(JSON.stringify(e[k])!==JSON.stringify(r[k]))return null;
      }
    }else if(e.reference_kind==='earlier_modern_standard'){
      if(!retroMagicReference(e)||e.variation_of!==null)return null;
    }else return null;
    return e.illustration_ids.every((id,i)=>id===r.illustration_ids[i])?'normal':'alternate_art';
  }
  function magicVariant(input,structuredEvidence=undefined){
    C.variantInput(input);let finish=null,artwork=null,treatment=null;
    if(structuredEvidence!==undefined){
      const e=C.magicVariantEvidence(structuredEvidence);
      finish=e.chosen_finish!==null&&e.available_finishes.includes(e.chosen_finish)?e.chosen_finish:null;
      treatment=baseMagicTreatment(e,finish);
      if(treatment===null&&['1993','1997'].includes(e.frame)&&['black','white'].includes(e.border_color)&&e.full_art===false&&e.frame_effects.every(x=>x==='legendary'||x==='etched'&&finish==='etched')&&e.promo_types.every(x=>x==='boosterfun')&&retroMagicReference(e))treatment='retro_frame';
      artwork=magicArtwork(e);
    }
    const valid=finish!==null&&artwork!==null&&treatment!==null;
    return C.variantResult({status:valid?'valid':'unknown',original:input,legacy_family:valid?treatment:'unknown',game_code:valid?'magic:'+treatment:null,finish,artwork,treatment,edition:null},'magic');
  }
  function makeMagic(){
    const schema={version:'1',fields:['set_code','set_provider_id','printed_language_code','collector_total'].map(key=>({key,type:'text',values:[]})).concat({key:'face_side',type:'enum',values:['front','back','unknown']})};
    function normalizeObservation(input){
      const original=C.observation(input),metadata=C.metadata(schema,input.metadata);
      for(const value of Object.values(metadata))if(/^[\[{]/.test(value.trim()))C.fail('magic scalar metadata');
      if(metadata.set_provider_id&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(metadata.set_provider_id))C.fail('magic set observation UUID');
      const collector=magicCollector({text:input.identifier||'',source:input.source}),lang=magicLanguage(input.language);
      const printed=metadata.printed_language_code?magicLanguage(metadata.printed_language_code):null;
      const status=input.selected_game!=='magic'||input.observed_game!==null&&!['unknown','magic'].includes(input.observed_game)?'game_conflict':input.observed_game===null||input.observed_game==='unknown'?'unknown':collector.status==='ambiguous'||input.uncertain?'ambiguous':collector.status!=='valid'?'identifier_invalid':lang.status!=='valid'||printed&&(printed.status!=='valid'||printed.language!==lang.language)?'unknown':'valid';
      return C.immutable({status,state:status==='valid'?'unknown':status,resolution:'not_attempted',original,game_key:'magic',collector,language:lang,rarity:magicRarity(input.rarity),variant:magicVariant({variant:input.variant||'',rarity:input.rarity||'',name:input.name||'',set:input.set||''}),query:status==='valid'?{game_key:'magic',collector_number:collector.comparison_code,language:lang.language}:null,review_required:true});
    }
    return C.gameAdapter({game_key:'magic',adapter_id:'magic_paper_v1',adapter_version:'1',parseCollectorEvidence:magicCollector,normalizeSetRef:v=>magicRef(v,'set'),normalizeCardRef:v=>magicRef(v,'card'),normalizeLanguage:magicLanguage,normalizeRarity:magicRarity,normalizeVariant:magicVariant,normalizeObservation,
      recognitionProfile:{version:'1',coverage:'inactive',state:'planned',reason:'not_calibrated'},metadataSchema:schema,
      searchDescriptors:[{key:'name',kind:'text',values:[]},{key:'collector_number',kind:'text',values:[]},{key:'set',kind:'text',values:[]},{key:'language',kind:'select',values:Object.keys(magicLanguageAliases)},{key:'rarity',kind:'select',values:['common','uncommon','rare','mythic','special','bonus'].map(x=>'magic:'+x)},{key:'variant',kind:'select',values:[...C.variantVocabulary('magic').finish,...C.variantVocabulary('magic').treatment]}],presentation:{label:'Magic: The Gathering',icon_path:null,badge:'neutral'}});
  }
  return C.freeze({pokemon:make('pokemon',pokemonIds,normalizePokemonCode),one_piece:make('one_piece',onePieceIds,normalizeOnePieceCode),magic:makeMagic()});
});
