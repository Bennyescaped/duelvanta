// Isolated contract regression for the current BATTLE join RPC.
// This test models the row-lock/state guards shipped in 20260918123500_battle_beta_account_status_v1.sql.
// No Supabase project, Auth account or live match is mutated.
import assert from 'node:assert/strict';

const unavailable='Match ist nicht mehr verfügbar';
function join(match,userId,code=null){
  if(!userId) throw Error('not_authenticated');
  if(match.host_id===userId) return match.id;
  if(match.status!=='waiting'||match.guest_id!==null) throw Error(unavailable);
  if(match.visibility==='private'&&(code===null||code.trim().toUpperCase()!==match.invite_code)) throw Error('Ungültiger Einladungscode');
  match.guest_id=userId;match.status='ready';return match.id;
}
function error(fn,message){assert.throws(fn,e=>e.message===message);}

const occupied={id:'private-occupied',visibility:'private',invite_code:'B49F27',status:'ready',host_id:'host',guest_id:'guest'};
error(()=>join({...occupied},'third','B49F27'),unavailable);
assert.equal(occupied.guest_id,'guest');
console.log('PASS: third player cannot enter an occupied private match');

const waiting={id:'private-waiting',visibility:'private',invite_code:'B49F27',status:'waiting',host_id:'host',guest_id:null};
assert.equal(join(waiting,'guest','b49f27'),'private-waiting');
assert.equal(waiting.guest_id,'guest');
assert.equal(waiting.status,'ready');
error(()=>join(waiting,'third','B49F27'),unavailable);
console.log('PASS: first join claims the only guest slot; a repeated competing join is rejected');

const ended={id:'private-ended',visibility:'private',invite_code:'B49F27',status:'cancelled',host_id:'host',guest_id:null};
error(()=>join(ended,'third','B49F27'),unavailable);
console.log('PASS: ended private matches cannot be joined');

const wrong={id:'private-wrong',visibility:'private',invite_code:'B49F27',status:'waiting',host_id:'host',guest_id:null};
error(()=>join(wrong,'third','B49F28'),'Ungültiger Einladungscode');
console.log('PASS: wrong private invitation code remains rejected');
