(()=>{
  'use strict';
  const root=globalThis;
  const VERSION='16.4.0-lab';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const signature=text=>{let hash=0;for(let i=0;i<text.length;i++)hash=(hash*31+text.charCodeAt(i))|0;return String(hash)};
  const LABELS={identifier_unconfirmed:'OCR-Nummer noch unbestätigt',language_conflict:'Kartentext und Katalogsprache widersprechen sich',
    exact_id:'OCR-Nummer passt zum Katalog',art_strong:'Artwork sehr stark',art_good:'Artwork passend',art_match:'Artwork ähnlich',art_weak:'Artwork schwach',art_leader_gap:'Artwork klar vorne',
    variant_art_separated:'Variante visuell getrennt',language_visual_separated:'Sprache visuell getrennt',variant_ambiguity:'Variante nicht eindeutig',language_ambiguity:'Sprache nicht eindeutig',
    reflection_guard:'Reflexion beeinflusst Artwork',heavy_glare:'Starke Spiegelung erkannt',low_image_quality:'Bildqualität zu niedrig',top_candidate_unverifiable:'Referenzbild nicht prüfbar',missing_variant_image:'Variantenbild fehlt'
  };
  const variantLabel=v=>({standard:'Standard',parallel:'Parallel / Alt Art',manga:'Manga',special:'Special',treasure:'Treasure Rare',signed:'Signed',tournament:'Tournament / Winner',promo:'Promo',special_illustration:'Special Illustration Rare',illustration:'Illustration Rare',shiny_ultra:'Shiny Ultra Rare',shiny:'Shiny Rare',hyper:'Hyper / Gold Rare',secret:'Secret Rare',rainbow:'Rainbow',reverse_holo:'Reverse Holo',holo:'Holo'}[v]||v||'—');

  function reasonsOf(result){return [...new Set([...(result?.reviewReasons||[]),...(result?.qualityDecision?.reasons||[]),...(result?.recognitionReasons||[])].filter(Boolean))]}
  function candidateAt(result,index=0){return result?.candidates?.[index]||result?.best||null}
  function languageOf(c){return c?.v16Language||root.DV_SCAN_V16_QUALITY?.languageOf?.(c)||c?.language||c?.sourceLang||null}
  function variantOf(c,tcg){if(!c)return null;return c?.v16VariantFamily||root.DV_SCAN_V16_QUALITY?.variantFamily?.(c,tcg)||null}

  function headlineFor(result,{candidateIndex=0}={}){
    const c=candidateAt(result,candidateIndex),reasons=reasonsOf(result);
    if(result?.languageConflict)return{headline:'SPRACHE WIDERSPRICHT KATALOG',tone:'review',summary:'Der gelesene Kartentext und die Katalogsprache passen nicht zusammen. Kein bestätigter Treffer.'};
    if(!c)return{headline:'KEIN SICHERER TREFFER',tone:'review',summary:'DUELVANTA konnte für diesen Ausschnitt keinen belastbaren Katalogtreffer bestätigen.'};
    if(result?.manualConfirmed||candidateIndex>0)return{headline:'MANUELL AUSGEWÄHLT · BITTE PRÜFEN',tone:'review',summary:'Du hast diesen Katalogkandidaten selbst bestätigt. Die automatische Confidence ist eine getrennte Messung und keine manuelle Garantie.'};
    if(result?.identifierReliable===false)return{headline:'PRÜFEN · NUMMER NOCH NICHT BESTÄTIGT',tone:'review',summary:'Die unabhängigen OCR-Ausschnitte stimmen nicht ausreichend überein. Der Katalogkandidat bleibt ein Vorschlag.'};
    if(result?.identifierSource==='manual'&&result?.status==='ready')return{headline:'NUMMER EINGEGEBEN · KANDIDAT PRÜFEN',tone:'review',summary:'Die Kartennummer wurde manuell eingegeben. Vergleiche Artwork, Sprache und Variante und bestätige den passenden Katalogkandidaten.'};
    if(result?.status==='ready'){
      const strong=reasons.some(x=>['variant_art_separated','language_visual_separated','art_leader_gap','art_strong'].includes(x))||Number(c?.v16Visual||result?.visualConfidence||0)>=82;
      return strong?{headline:'STARKER TREFFER',tone:'ready',summary:'Mehrere unabhängige Merkmale sprechen klar für diesen Treffer.'}:{headline:'GUTER TREFFER',tone:'ready',summary:'Kartendaten und Bildabgleich sind ausreichend konsistent für einen automatischen Treffer.'};
    }
    if(reasons.includes('variant_ambiguity'))return{headline:'PRÜFEN · VARIANTE NICHT EINDEUTIG',tone:'review',summary:'Die Kartennummer passt, aber mindestens zwei Varianten liegen beim Artwork noch zu nah beieinander.'};
    if(reasons.includes('language_ambiguity'))return{headline:'PRÜFEN · SPRACHE NICHT EINDEUTIG',tone:'review',summary:'Die Kartennummer passt, aber die Sprache kann visuell noch nicht zuverlässig getrennt werden.'};
    if(reasons.includes('heavy_glare')||reasons.includes('reflection_guard'))return{headline:'PRÜFEN · REFLEXION ERKANNT',tone:'review',summary:'Foil- oder Folienreflexionen schwächen den Artwork-Vergleich. DUELVANTA reduziert deshalb bewusst die Confidence.'};
    if(reasons.includes('low_image_quality'))return{headline:'PRÜFEN · BILDQUALITÄT ZU NIEDRIG',tone:'review',summary:'Für eine sichere Variantenentscheidung fehlen Schärfe oder verwertbare Bilddetails.'};
    if(reasons.includes('top_candidate_unverifiable')||reasons.includes('missing_variant_image'))return{headline:'PRÜFEN · REFERENZBILD NICHT PRÜFBAR',tone:'review',summary:'Der Katalogtreffer ist plausibel, kann aber visuell nicht ausreichend gegen Alternativen geprüft werden.'};
    return{headline:'PRÜFEN · MEHR BEWEISE NÖTIG',tone:'review',summary:'Der Treffer ist plausibel, aber noch nicht eindeutig genug für eine automatische Bestätigung.'};
  }

  function explain(result,tcg,{candidateIndex=0}={}){
    const c=candidateAt(result,candidateIndex),head=headlineFor(result,{candidateIndex}),reasons=reasonsOf(result),q=result?.quality||{},art=Number(c?.v16Visual||result?.visualConfidence||0),gap=Number(result?.visualGap||result?.qualityDecision?.visualGap||0),lang=languageOf(c),variant=variantOf(c,tcg),evidence=[];
    if(c?.v16ExactId||reasons.includes('exact_id'))evidence.push({kind:result?.identifierReliable?'good':'neutral',label:'Kartennummer',value:result?.identifierSource==='manual'?'manuell eingegeben · Katalog passt':result?.identifierReliable?'mehrfach gelesen · Katalog passt':'OCR/Katalog gleich · noch unbestätigt'});
    else if(result?.id)evidence.push({kind:'neutral',label:'Kartennummer',value:String(result.id.code||'erkannt')});
    if(art>0)evidence.push({kind:art>=78?'good':art>=62?'neutral':'warn',label:'Artwork',value:`${Math.round(art)} %`});
    if(gap>0)evidence.push({kind:gap>=9?'good':gap>=5?'neutral':'warn',label:'Abstand #1 → #2',value:`+${Math.round(gap)}`});
    if(lang)evidence.push({kind:result?.languageAmbiguity?'warn':'neutral',label:'Sprache',value:String(lang).toUpperCase()});
    if(variant)evidence.push({kind:result?.variantAmbiguity?'warn':'neutral',label:'Variante',value:variantLabel(variant)});
    if(Number.isFinite(Number(q.score)))evidence.push({kind:Number(q.score)>=55?'good':Number(q.score)>=40?'neutral':'warn',label:'Bildqualität',value:`${Math.round(Number(q.score||0))} %`});
    if(q.reflectionRisk||Number(q.glare||0)>=5||Number(q.centerGlare||0)>=5)evidence.push({kind:q.reflectionRisk?'warn':'neutral',label:'Reflexion',value:`${Math.max(Number(q.glare||0),Number(q.centerGlare||0)).toFixed(1)} %`});
    const warnings=reasons.filter(x=>['variant_ambiguity','language_ambiguity','reflection_guard','heavy_glare','low_image_quality','top_candidate_unverifiable','missing_variant_image'].includes(x)).map(x=>LABELS[x]||x);
    const positives=reasons.filter(x=>['exact_id','art_strong','art_good','art_match','art_leader_gap','variant_art_separated','language_visual_separated'].includes(x)).map(x=>LABELS[x]||x);
    const rivals=(result?.candidates||[]).slice(0,2).map((x,i)=>({rank:i+1,name:x?.name||'Kandidat',number:x?.number||'',variant:variantLabel(variantOf(x,tcg)),language:languageOf(x)||'—',artwork:Number(x?.v16Visual||0),score:Number(x?.v16Score||x?.confidence||x?.catalogConfidence||0),image:x?.image||null}));
    return{...head,confidence:clamp(Math.round(Number(result?.confidence||0)),0,99),candidate:c,evidence,warnings,positives,rivals,reasons};
  }

  const state={results:[],lastMode:null};
  function addStyles(){if(typeof document==='undefined'||document.getElementById('dvV16ExplainStyle'))return;const s=document.createElement('style');s.id='dvV16ExplainStyle';s.textContent=`
    .dvV16Explain{grid-column:1/-1;margin-top:9px;border:1px solid #303640;border-radius:10px;background:#07090c;padding:9px}.dvV16Explain.ready{border-color:#355d45}.dvV16Explain.review{border-color:#675632}.dvV16ExplainHead{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.dvV16ExplainTitle{font-size:9px;font-weight:800;letter-spacing:.08em;color:#efd18c}.dvV16Explain.review .dvV16ExplainTitle{color:#e7c883}.dvV16ExplainScore{font-size:9px;color:#aab2bc;white-space:nowrap}.dvV16ExplainSummary{font-size:9px;color:#8f98a4;line-height:1.45;margin-top:4px}.dvV16Evidence{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.dvV16Evidence span{border:1px solid #323943;border-radius:999px;padding:4px 6px;font-size:7px;color:#a8b0ba}.dvV16Evidence span.good{border-color:#355d45;color:#9ed2ad}.dvV16Evidence span.warn{border-color:#745c36;color:#e6c989}.dvV16Warnings{margin-top:7px;font-size:8px;color:#d7b978;line-height:1.45}.dvV16Rivals{margin-top:8px;border-top:1px solid #252b33;padding-top:7px}.dvV16RivalsTitle{font-size:7px;letter-spacing:.1em;color:#727b86;margin-bottom:5px}.dvV16Rival{display:grid;grid-template-columns:28px 1fr auto;gap:6px;align-items:center;padding:4px 0}.dvV16Rival+.dvV16Rival{border-top:1px solid #1d2229}.dvV16Rival img{width:28px;aspect-ratio:63/88;object-fit:cover;border-radius:4px;background:#0b0d11}.dvV16RivalName{font-size:8px;color:#d7d9dc}.dvV16RivalMeta{font-size:7px;color:#737d88;margin-top:2px}.dvV16RivalScore{text-align:right;font-size:7px;color:#8f99a4}.dvV16RivalScore b{display:block;color:#efd18c;font-size:9px}@media(max-width:620px){.dvV16Explain{padding:8px}.dvV16Rival{grid-template-columns:26px 1fr auto}}`;
    document.head.appendChild(s)}
  function rivalHtml(x){return `<div class="dvV16Rival">${x.image?`<img src="${esc(x.image)}" alt="">`:'<span></span>'}<div><div class="dvV16RivalName">#${x.rank} ${esc(x.name)}</div><div class="dvV16RivalMeta">${esc([x.number,x.variant,x.language].filter(Boolean).join(' · '))}</div></div><div class="dvV16RivalScore">ARTWORK<b>${x.artwork?`${Math.round(x.artwork)} %`:'—'}</b></div></div>`}
  function panelHtml(data){const rivals=data.rivals.length>1?`<div class="dvV16Rivals"><div class="dvV16RivalsTitle">TOP-KANDIDATEN · ARTWORK-VERGLEICH</div>${data.rivals.map(rivalHtml).join('')}</div>`:'';return `<section class="dvV16Explain ${data.tone}"><div class="dvV16ExplainHead"><div class="dvV16ExplainTitle">${esc(data.headline)}</div><div class="dvV16ExplainScore">GESAMT ${data.confidence} %</div></div><div class="dvV16ExplainSummary">${esc(data.summary)}</div><div class="dvV16Evidence">${data.evidence.map(x=>`<span class="${x.kind}">${esc(x.label)} · ${esc(x.value)}</span>`).join('')}</div>${data.warnings.length?`<div class="dvV16Warnings">⚠ ${esc(data.warnings.join(' · '))}</div>`:''}${rivals}</section>`}
  function decorate(){if(typeof document==='undefined')return;addStyles();const host=document.getElementById('dvV16Results');if(!host)return;const cards=[...host.querySelectorAll('.dvV16Result')];cards.forEach((card,i)=>{const r=root.DV_SCAN_V16?.batch?.[i]||state.results[i];if(!r)return;const select=card.querySelector('[data-v16-select]'),idx=Math.max(0,Number(r.chosen||select?.value||0)),data=explain(r,r.tcg||r.v16ExplainTcg||'pokemon',{candidateIndex:idx}),html=panelHtml(data),stamp=signature(html);let panel=card.querySelector('.dvV16Explain');if(!panel){card.insertAdjacentHTML('beforeend',html);panel=card.querySelector('.dvV16Explain')}else if(panel.dataset.v16Signature!==stamp){panel.outerHTML=html;panel=card.querySelector('.dvV16Explain')}if(panel)panel.dataset.v16Signature=stamp;if(select&&!select.dataset.v16ExplainBound){select.dataset.v16ExplainBound='1';select.addEventListener('change',()=>setTimeout(decorate,0))}})}
  function install(){const core=root.DV_SCAN_V16_CORE;if(!core?.analyze||core.__v164ExplainInstalled)return !!core?.__v164ExplainInstalled;const old=core.analyze.bind(core);core.analyze=async function(source,opts={}){const out=await old(source,opts),rows=(out?.results||[]).map(r=>({...r,v16ExplainTcg:out?.tcg||opts?.tcg||'pokemon'}));out.results=rows;if((out?.mode||opts?.mode)==='continuous')state.results.push(...rows);else state.results=rows;state.lastMode=out?.mode||opts?.mode||null;setTimeout(decorate,0);return out};core.__v164ExplainInstalled=true;root.DV_SCAN_V16_EXPLAIN.installed=true;return true}
  function installDom(){if(typeof document==='undefined')return;addStyles();const observer=new MutationObserver(()=>decorate());const bind=()=>{const host=document.getElementById('dvV16Results');if(host&&!host.dataset.v16ExplainObserved){host.dataset.v16ExplainObserved='1';observer.observe(host,{childList:true,subtree:true})}const reset=document.getElementById('dvV16Reset');if(reset&&!reset.dataset.v16ExplainBound){reset.dataset.v16ExplainBound='1';reset.addEventListener('click',()=>{state.results=[]})}};let tries=0;const t=setInterval(()=>{tries++;bind();decorate();if((document.getElementById('dvV16Results')&&install())||tries>160)clearInterval(t)},50)}

  root.DV_SCAN_V16_EXPLAIN={version:VERSION,LABELS,variantLabel,reasonsOf,headlineFor,explain,panelHtml,install,decorate,state,installed:false};
  if(typeof document==='undefined')install();else installDom();
})();
