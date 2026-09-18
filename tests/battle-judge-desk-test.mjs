import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
const [h,m,s]=await Promise.all([readFile(new URL('../battle.html',import.meta.url),'utf8'),readFile(new URL('../battle-moderation.js',import.meta.url),'utf8'),readFile(new URL('../supabase/migrations/20260918155500_battle_judge_desk_v1.sql',import.meta.url),'utf8')]);
for(const x of ['judgeDesk','judgeCases','MATCH PRÜFEN','resolve_battle_dispute','disputeResolve','data-resolve="host"','data-resolve="guest"','data-resolve="draw"'])assert.ok((h+m).includes(x),x);
for(const x of ["has_staff_permission('battle_moderate',auth.uid())","m.status='dispute'","revoke execute on function public.get_battle_disputes_for_moderation() from public,anon"])assert.ok(s.includes(x),x);
assert.ok(m.includes("if(!note)return alert('Bitte eine kurze Entscheidungsnotiz eintragen.')"));
console.log('PASS: Judge Desk discovery and dispute decision UI are permission-backed and dispute-scoped');