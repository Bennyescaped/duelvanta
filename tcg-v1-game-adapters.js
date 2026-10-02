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
      normalizeSetRef:value=>C.ref(value,{game_key:game,entity_kind:'set'}),normalizeCardRef:value=>C.ref(value,{game_key:game,entity_kind:'card'}),normalizeLanguage:language,normalizeRarity:raw=>rarity(game,raw),normalizeVariant:input=>variant(game,input),normalizeObservation,
      recognitionProfile:profile,metadataSchema:schema,searchDescriptors:[{key:'name',kind:'text',values:[]},{key:'collector_number',kind:'text',values:[]},{key:'set',kind:'text',values:[]}],presentation:{label:game==='pokemon'?'Pokémon':'One Piece Card Game',icon_path:null,badge:game},battleProfile:{modes:['webcam_casual','webcam_ranked']}});
  }
  return C.freeze({pokemon:make('pokemon',pokemonIds,normalizePokemonCode),one_piece:make('one_piece',onePieceIds,normalizeOnePieceCode)});
});
