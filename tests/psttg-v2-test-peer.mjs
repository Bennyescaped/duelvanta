// Isolated protocol counterparty. Imported only by the disposable acceptance test.
// Its effects, issued attempts, revocations and incarnation stay outside DB rollback.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export class UnitTestPeer {
 constructor(config){this.config=config;this.incarnation=config.operating_incarnation;this.quarantine=false;this.issued=new Map();this.effects=new Map();this.receipts=new Map();this.revoked=new Set();this.epoch=0;}
 async observeCommitted(attempt,observer){
  const g=(await observer.query('select operating_incarnation,execution_epoch,stopped,quarantine from dv_market_private.psttg_v2_channel_v1 where channel_id=$1',[this.config.channel_id])).rows[0];
  const writer=(await observer.query("select a.operation_ref,a.admission_id target_ref,t.attempt_id,t.execution_epoch from dv_market_private.psttg_v2_use_transition_v1 t join dv_market_private.psttg_v2_use_admission_v1 a using(admission_id) where t.attempt_id=$1 and a.channel_id=$2 and t.transition_kind='ATTEMPTING'",[attempt,this.config.channel_id])).rows[0];
  const unit=(await observer.query("select m.operation_ref,m.manifest_id target_ref,t.attempt_id,t.execution_epoch from dv_market_private.psttg_k5_unitattempt_v1 t join dv_market_private.psttg_k5_unitmanifest_v1 m using(manifest_id) where t.attempt_id=$1 and m.channel_id=$2 and t.state='ATTEMPTING'",[attempt,this.config.channel_id])).rows[0];
  const row=writer??unit;if(!row)throw Error('peer_uncommitted_attempt');
  if(!g||g.quarantine||g.stopped||g.operating_incarnation!==this.incarnation||this.quarantine)throw Error('peer_quarantined_or_stopped');
  if(Number(row.execution_epoch)!==Number(g.execution_epoch)||Number(row.execution_epoch)<this.epoch)throw Error('peer_stale_epoch');
  const token={...row,execution_epoch:Number(row.execution_epoch),incarnation:this.incarnation};
  if(this.issued.has(attempt))assert.equal(canonical(this.issued.get(attempt)),canonical(token));
  this.issued.set(attempt,token);this.epoch=token.execution_epoch;return token;
 }
 assertCurrent(token){
  if(this.quarantine||token.incarnation!==this.incarnation||token.execution_epoch!==this.epoch||this.revoked.has(token.attempt_id)||canonical(this.issued.get(token.attempt_id))!==canonical(token))throw Error('peer_stale_or_revoked');
 }
 async revokeUnstarted(manifest,observer){
  const m=(await observer.query('select * from dv_market_private.psttg_k5_unitmanifest_v1 where manifest_id=$1',[manifest])).rows[0];
  const started=(await observer.query("select count(*)::int n from dv_market_private.psttg_k5_unitattempt_v1 where manifest_id=$1 and state='ATTEMPTING'",[manifest])).rows[0].n;
  if(!m||started||this.issued.has(m.attempt_id)||this.effects.has(m.attempt_id)||this.quarantine||m.operating_incarnation!==this.incarnation)throw Error('peer_unstarted_required');
  this.revoked.add(m.attempt_id);
  return this.envelope({operation_ref:m.operation_ref,target_ref:m.manifest_id,attempt_id:m.attempt_id,execution_epoch:Number(m.execution_epoch),incarnation:m.operating_incarnation},'NOT_APPLIED_REVOKED');
 }
 effect(token){
  // Validation and append are synchronous: no await between check and simulated effect.
  this.assertCurrent(token);
  if(!this.effects.has(token.attempt_id))this.effects.set(token.attempt_id,{effect_ref:randomUUID(),target_ref:token.target_ref});
  return this.envelope(token,'SIMULATED');
 }
 revokeWithoutEffect(token){
  this.assertCurrent(token);if(this.effects.has(token.attempt_id))throw Error('peer_effect_already_exists');
  this.revoked.add(token.attempt_id);return this.envelope(token,'NOT_APPLIED_REVOKED');
 }
 unknown(token){this.assertCurrent(token);return this.envelope(token,'UNKNOWN');}
 envelope(token,result){
  const id=token.attempt_id+':'+result;if(this.receipts.has(id))return this.receipts.get(id);
  const g=this.config;const e={contract:'synthetic-unit-result/1',channel:g.channel_id,system_ref:g.target_system_ref,environment_ref:g.environment_ref,account_ref:g.account_ref,event_ref:randomUUID(),operation_ref:token.operation_ref,attempt_ref:token.attempt_id,target_ref:token.target_ref,operating_incarnation:token.incarnation,epoch:token.execution_epoch,result,proof_ref:randomUUID(),payload:{detail_ref:randomUUID()}};
  this.receipts.set(id,e);return e;
 }
 restore(){this.incarnation=randomUUID();this.quarantine=true;}
}
