/* I2 consumer boundary. Registry readiness is scope eligibility, not authorization.
 * Existing release/account/processing gates and DB privileges remain authoritative. */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./tcg-v1-registry.js'),require('./tcg-v1-catalog-providers.js'),require('./tcg-v1-contracts.js'));
  else root.DV_TCG_V1_CONSUMERS=factory(root.DV_TCG_V1_REGISTRY,root.DV_TCG_V1_PROVIDERS,root.DV_TCG_V1_CONTRACTS);
})(globalThis,function(registry,providers,C){
  'use strict';
  if(!registry||!providers||!C)throw new Error('TCG foundation required');
  const scopes={collection:'legacy_items',binder:'legacy_slots',scanner:'raw_review',marketplace:'legacy_snapshots',catalog:'legacy_lookup'};
  let magicReceipt=null;
  const magicVisible=()=>magicReceipt?.ready===true&&Date.now()<magicReceipt.expires;
  async function refreshMagicReadiness(db,userId){
    magicReceipt=null;
    try{const {data,error}=await db.rpc('get_magic_on_demand_collection_beta_v1');
      const checked=Date.parse(data?.checked_at);
      if(!Number.isFinite(checked)||Math.abs(Date.now()-checked)>60000||error||data?.contract!=='magic-on-demand-collect-beta/1'||data.user_id!==userId||data.magic_on_demand_collection_beta!==true)return false;
      magicReceipt={ready:true,expires:Date.now()+60000};return true;
    }catch{return false;}
  }
  const eligible=(entry,scope)=>entry.status==='available'&&entry.capabilities[scope]?.status==='ready'&&entry.capabilities[scope].profiles.includes(scopes[scope]);
  function games(scope,gates){return registry.entries.filter(entry=>eligible(entry,scope)&&(entry.game_key!=='magic'||magicVisible())&&(!gates||registry.isEnabled(entry.game_key,scope,gates)))}
  function requireGame(key,scope){const entry=registry.get(key);if(!eligible(entry,scope)||key==='magic'&&!magicVisible())throw new Error('TCG scope unavailable');return entry}
  function adapter(key,scope='scanner'){requireGame(key,scope);const a=registry.adapter(key);if(scope==='scanner')C.requireActiveRecognitionProfile(a.recognitionProfile);return a}
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  // The short legacy label is presentation compatibility, never a game definition.
  const label=key=>registry.get(key).presentation.label.replace(/ Card Game$/,'');
  function options(scope){return games(scope).map(entry=>`<option value="${esc(entry.game_key)}">${esc(label(entry.game_key))}</option>`).join('')}
  function parse(text,key,source='ocr'){return adapter(key).parseCollectorEvidence({text:String(text||''),source})}
  function code(text,key){const evidence=parse(text,key);return evidence.comparison_code||String(text||'').trim().toUpperCase()}
  function binding(key){return requireGame(key,'catalog').providers.find(p=>p.type==='catalog')}
  function translate(raw,key,context){const b=binding(key),provider=Object.values(providers).find(p=>p.provider_key===b.provider_key&&p.provider_version===b.provider_version&&p.game_key===key);if(!provider)throw new Error('Catalog binding unavailable');return provider.translate(raw,{...context,game_key:key})}
  // Provider references are not canonical IDs. Only an explicitly verified resolver
  // receipt can carry a link. Legacy DTOs are not decorated or normalized here.
  function handoff(legacy,resolution){requireGame(legacy.tcg,'collection');if(!resolution||resolution.state!=='resolved')return{legacy,catalog_link:null};
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(resolution.game_key!==legacy.tcg||!uuid.test(resolution.provider_ref_id)||!uuid.test(resolution.card_id)||resolution.variant_id!==null&&!uuid.test(resolution.variant_id)||resolution.provider_game!==legacy.tcg||resolution.card_game!==legacy.tcg||resolution.variant_id!==null&&resolution.variant_game!==legacy.tcg)throw new Error('Catalog resolution conflict');
    return{legacy,catalog_link:{provider_ref_id:resolution.provider_ref_id}};
  }
  async function saveLink(db,kind,id,receipt){if(!receipt?.catalog_link)return;const rpc=kind==='collection'?'set_my_collection_catalog_link_v1':kind==='listing'?'set_my_listing_catalog_link_v1':null;if(!rpc)throw new Error('Invalid link parent');const result=await db.rpc(rpc,{p_parent_id:id,p_provider_ref_id:receipt.catalog_link.provider_ref_id});if(result.error)throw result.error}
  return Object.freeze({version:'i3-m6-v1',registry,games,requireGame,adapter,label,options,parse,code,binding,translate,handoff,saveLink,refreshMagicReadiness});
});
