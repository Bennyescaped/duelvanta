// V147-only fixture: unchanged W11 setup semantics with reserved synthetic UUIDs.
// This separate fixture leaves every V130/V140 source byte unchanged.
import {randomUUID as cryptoUUID,randomBytes,createHmac} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {publicationFixture} from './publication-hold-fixture.mjs';
import {UnitTestPeer} from '../psttg-v2-test-peer.mjs';
const randomUUID=()=> '00000000-0000-4000-8000-'+cryptoUUID().slice(-12);
export async function installW11(db){
 await publicationFixture(db);
 let protection;
 for(const name of ['psttg-capture-core-v1','psttg-removal-evaluation-v1','psttg-k5-synthetic-control-v1','psttg-representation-v2','psttg-v2-writer-unitmanifest-v1']){
  const sql=await readFile(new URL('../../database/'+name+'.sql',import.meta.url),'utf8');
  if(name==='psttg-v2-writer-unitmanifest-v1'){const at=sql.indexOf('-- PROTECTION INSTALLATION:');await db.exec(sql.slice(0,at)+'commit;');protection=sql.slice(at);}else await db.exec(sql);
 }
 const channels=[];
 for(let i=0;i<32;i++){
  const sid=(await db.query('select dv_market_private.psttg_ensure_scope($1,$2,$3,$4) v',['subject',randomBytes(32),null,null])).rows[0].v;
  const g={channel_id:randomUUID(),target_system_ref:randomUUID(),environment_ref:randomUUID(),account_ref:randomUUID(),scope_ids:[sid],operating_incarnation:randomUUID(),verification_key:randomBytes(32)};
  await db.query("insert into dv_market_private.psttg_v2_channel_v1(channel_id,target_system_ref,environment_ref,account_ref,configuration_revision,scope_ids,operating_incarnation,verification_key,contract_version) values($1,$2,$3,$4,1,$5,$6,$7,'psttg-k5-unitmanifest/1')",[g.channel_id,g.target_system_ref,g.environment_ref,g.account_ref,g.scope_ids,g.operating_incarnation,g.verification_key]);channels.push(g);
 }
 await db.exec('begin;'+protection);
 await db.exec(await readFile(new URL('../../database/psttg-w11-envelope-commit-v1.sql',import.meta.url),'utf8'));
 const secret=randomBytes(48).toString('base64');
 const val=async(sql,args=[],c=db)=>(await c.query(sql,args)).rows[0]?.v;
 const call=(f,args=[],c=db)=>val(`select dv_market_private.${f}(${args.map((_,i)=>'$'+(i+1)).join(',')}) v`,args,c);
 const sign=async(g,x,c=db)=>createHmac('sha256',g.verification_key).update(await val('select ($1::jsonb)::text v',[JSON.stringify(x)],c)).digest();
 const invoke=async(g,command,payload={})=>{
  await db.exec('begin');try{
   const challenge=await call('psttg_v2_challenge_v1');
   const digest=await val("select encode(dv_market_private.psttg_v2_hash($1::jsonb),'hex') v",[JSON.stringify([command,payload])]);
   const ticket={contract:'psttg-k5-unitmanifest/1',channel:g.channel_id,incarnation:g.operating_incarnation,challenge,command:digest};
   const result=await call('psttg_v2_execute_v1',[command,payload,ticket,await sign(g,ticket),secret]);await db.exec('commit');return result;
  }catch(e){await db.exec('rollback');throw e}
 };
 const common=(g,action)=>({contract:'psttg-v2-writer-use/1',action,channel:g.channel_id,operation_ref:randomUUID(),command_id:randomUUID()});
 const prepared=new Map();
 return {secret,async context(envelope_revision,predecessor=null){
  let g,ref;
  if(predecessor){
   const old=(await db.query('select * from dv_market_private.psttg_w11_envelope_proof_v1 where proof_id=$1',[predecessor])).rows[0];
   const prior=prepared.get(old.channel_id);if(!prior)throw Error('w11_fixture_history_context');
   g=prior.g;ref=prior.ref;
   const target={representation:2,schema_version:'psttg-unit-v2-writer1',id:prior.a.input_group,incarnation:await val('select incarnation v from dv_market_private.psttg_object_anchor where object_id=$1',[prior.a.input_group]),version:1};
   const assess={...common(g,'ASSESS'),targets:[target],manifest_ref:randomUUID(),manifest_revision:1,previous_manifest_ref:'',attempt_ref:randomUUID(),epoch:prior.epoch+1,authorization_ref:randomUUID(),proof_refs:Array.from({length:9},randomUUID),expected:{},adapter:'synthetic-unit/1',unit_action:'SIMULATE_UNIT_TRANSITION'};
   const expected=await invoke(g,assess);
   await invoke(g,{...common(g,'BIND_EVIDENCE'),operation_ref:prior.a.operation_ref,admission_ref:prior.a.admission_ref,revision:2,attempt_ref:prior.t.attempt_ref,epoch:prior.epoch,group_ref:randomUUID(),capture_command:randomUUID(),receipt_ref:old.receipt_id,expected});
  }else{
  g=channels.shift();if(!g)throw Error('w11_fixture_channels_exhausted');
  const sc={...common(g,'SOURCE'),source_ref:randomUUID(),source_version:1,predecessor:{},group_ref:randomUUID(),capture_command:randomUUID(),scopes:g.scope_ids};
  await invoke(g,sc,{source_ref:sc.source_ref,source_version:1,mode:'synthetic_test',attestation_ref:randomUUID()});
  ref={representation:2,schema_version:'psttg-unit-v2',id:sc.group_ref,incarnation:await val('select incarnation v from dv_market_private.psttg_object_anchor where object_id=$1',[sc.group_ref]),version:1};
  }
  const a={...common(g,'ADMIT'),admission_ref:randomUUID(),input_group:randomUUID(),input_command:randomUUID(),own_group:randomUUID(),own_command:randomUUID(),input_revision:1,sources:[ref],mode:'record',target:{},decision_ref:randomUUID()};
  const body={amount:120,currency:'EUR',period:2026,position:randomUUID(),other_attributes:{secret:'synthetic-only'},correction_reason:''};
  await invoke(g,a,{body,source_fragment:Object.fromEntries(['amount','currency','period','position'].map(k=>[k,body[k]])),original_fragment:{}});
  const epoch=Number(await val('select execution_epoch+1 v from dv_market_private.psttg_v2_channel_v1 where channel_id=$1',[g.channel_id]));
  const t={...common(g,'ATTEMPTING'),operation_ref:a.operation_ref,admission_ref:a.admission_ref,revision:1,attempt_ref:randomUUID(),epoch,group_ref:randomUUID(),capture_command:randomUUID()};
  await invoke(g,t);
  const observer=await db.connect();const peer=new UnitTestPeer(g);
  const e=peer.effect(await peer.observeCommitted(t.attempt_ref,observer));
  const proof_id=randomUUID();e.payload={detail_ref:proof_id};
  const ar=(await db.query('select * from dv_market_private.psttg_v2_use_admission_v1 where admission_id=$1',[a.admission_ref])).rows[0];
  const tr=(await db.query('select * from dv_market_private.psttg_v2_use_transition_v1 where command_id=$1',[t.command_id])).rows[0];
  const current=(await db.query('select receipt_revision,mapping_revision,stop_revision from dv_market_private.psttg_v2_channel_v1 where channel_id=$1',[g.channel_id])).rows[0];
  prepared.set(g.channel_id,{g,ref,a,t,epoch});
  return {key:g.verification_key.toString('hex'),secret,context:{proof_id,channel_id:g.channel_id,operating_incarnation:g.operating_incarnation,operation_ref:a.operation_ref,envelope_revision,
   admission_id:a.admission_ref,attempt_transition_id:tr.transition_id,admission_commit_ref:ar.commit_ref,input_revision:1,transition_commit_ref:tr.commit_ref,transition_revision:1,
   scope_ids:g.scope_ids,configuration_revision:1,receipt_revision:Number(current.receipt_revision),mapping_revision:Number(current.mapping_revision),stop_revision:Number(current.stop_revision),predecessor_proof_id:predecessor,envelope:e,
   environment_binding:{origin:'synthetic_test',environment:'TEST',application:'DAC7',dip_version:'2.0',environment_ref:g.environment_ref,account_ref:g.account_ref,system_ref:g.target_system_ref}}};
 },async quarantine(channel){
  const g=(await db.query('select * from dv_market_private.psttg_v2_channel_v1 where channel_id=$1',[channel])).rows[0];
  const n={contract:'psttg-k5-unitmanifest/1',action:'RESTORE_QUARANTINE',channel,external_incarnation:randomUUID()};
  await call('psttg_v2_quarantine_v1',[channel,n,await sign(g,n)]);
 }};
}
