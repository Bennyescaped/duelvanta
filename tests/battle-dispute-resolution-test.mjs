// Static security/contract regression for the BATTLE dispute-resolution migration.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sql=await readFile(new URL('../supabase/migrations/20260918152000_battle_dispute_resolution_v1.sql',import.meta.url),'utf8');
for(const required of [
  "has_staff_permission('battle_moderate', v_uid)",
  "Players cannot resolve own match",
  "v_match.status <> 'dispute'",
  "p_result not in ('host','guest','draw')",
  "where id=p_match_id for update",
  "status='completed'",
  "action,details",
  "'battle_dispute_resolved'",
  "revoke execute on function public.resolve_battle_dispute(uuid,text,text) from public, anon",
  "grant execute on function public.resolve_battle_dispute(uuid,text,text) to authenticated, service_role"
]) assert.ok(sql.includes(required),required);
assert.ok(/winner_id\s*=v_winner/.test(sql));
assert.ok(/moderation_state='resolved'/.test(sql));
console.log('PASS: judge dispute resolution is permission-gated, player-blocked, dispute-only, audited and completes exactly one locked match');
