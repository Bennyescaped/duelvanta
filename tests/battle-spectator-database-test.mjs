// Real PostgreSQL regression, including independent concurrent connections. Never a remote DB.
import assert from 'node:assert/strict';
import {execFile, execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
const run = promisify(execFile);
assert.ok(['localhost','127.0.0.1'].includes(process.env.PGHOST), 'Disposable localhost PostgreSQL required');
const root = new URL('../', import.meta.url);
const env = {...process.env, PGOPTIONS:'-c client_min_messages=warning'};
const ids = Array.from({length:10},(_,i)=>`10000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
const [H,G,A,B,J,SUSP,RESTRICT,NOGATE,DELETING] = ids;
const sid = u => u.replace('10000000','20000000');
const M='30000000-0000-4000-8000-000000000001', P='30000000-0000-4000-8000-000000000002',
      LIVE='30000000-0000-4000-8000-000000000003', DISPUTE='30000000-0000-4000-8000-000000000004',
      END='30000000-0000-4000-8000-000000000005';
const quote = value => value===null ? 'null' : "'"+String(value).replaceAll("'","''")+"'";
function prefix(user, extras={}) {
  if (user===undefined) return '';
  const claims={role:extras.role||'authenticated',sub:user||'',session_id:user?sid(user):'',...extras};
  return `set request.jwt.claims=${quote(JSON.stringify(claims))}; set role ${claims.role};`;
}
function sql(text,user,extras) {
  return execFileSync('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-c',prefix(user,extras)+text],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}
async function concurrent(text,user) {
  return (await run('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-c',prefix(user)+text],{env,encoding:'utf8'})).stdout.trim();
}
const json=(text,user,extras)=>JSON.parse(sql(text,user,extras));
const denied=(text,user,pattern=/permission denied|spectator_|Nicht erlaubt|Nur der Host|battle_moderate/,extras)=>assert.throws(()=>sql(text,user,extras),pattern);
const file=path=>sql(readFileSync(new URL(path,root),'utf8'));
const call=(name,args=[])=>'select public.'+name+'('+args.map(quote).join(',')+');';
const join=(match,tab,code=null)=>call('join_battle_spectator',[match,tab,code]);
const beat=(match,tab)=>call('heartbeat_battle_spectator',[match,tab]);
const leave=(match,tab)=>call('leave_battle_spectator',[match,tab]);
const count=match=>Number(sql(`select battle_spectator_private.viewer_count('${match}');`));
const passed=[];
const pass=name=>{passed.push(name); console.log('PASS:',name);};

sql(`create role anon; create role authenticated; create role service_role;
create schema auth; grant usage on schema auth,public to anon,authenticated,service_role;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
create table public.profiles(id uuid primary key,email text,role text default 'player',account_status text default 'beta',safety_restricted boolean default false,display_name text,username text,username_changed_at timestamptz,founder_number integer,founder_generation text,founder_since timestamptz,age_band text default '18_plus',conduct_accepted_at timestamptz default now(),conduct_version text default 'battle-v1-2026-09',data_processing_restricted_at timestamptz);
create table public.battle_matches(id uuid primary key default gen_random_uuid(),host_id uuid,guest_id uuid,tcg text,mode text default 'casual',visibility text,status text default 'waiting',invite_code text,title text,language text,host_display_name text,guest_display_name text,host_founder_number integer,guest_founder_number integer,host_ready boolean default false,guest_ready boolean default false,moderation_state text,paused_at timestamptz,paused_by uuid,moderator_id uuid,moderator_joined_at timestamptz,moderation_note text,host_result text,guest_result text,winner_id uuid,started_at timestamptz,completed_at timestamptz,created_at timestamptz default now(),updated_at timestamptz);
create table public.battle_signals(id bigint generated always as identity,match_id uuid references public.battle_matches(id),sender_id uuid,signal_type text,payload jsonb,created_at timestamptz default now());
create table public.admin_audit_log(id bigint generated always as identity,actor_id uuid,action text,details jsonb);
create function public.has_staff_permission(text,uuid default auth.uid()) returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.profiles where id=$2 and role='judge' and $1='battle_moderate')$$;
alter table public.battle_matches enable row level security;
alter table public.battle_signals enable row level security;
create policy battle_visible on public.battle_matches for select to authenticated using ((visibility='public' and status in ('waiting','ready')) or auth.uid() in(host_id,guest_id,moderator_id));
create policy signals_read on public.battle_signals for select to authenticated using (exists(select 1 from public.battle_matches m where m.id=match_id and auth.uid() in(m.host_id,m.guest_id)));
create policy signals_write on public.battle_signals for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.battle_matches m where m.id=match_id and auth.uid() in(m.host_id,m.guest_id) and m.status in('waiting','ready','live','dispute')));
grant select,truncate,references,trigger on public.battle_matches to authenticated;
grant select,insert,update,delete,truncate,references,trigger on public.battle_signals to authenticated;
grant usage on sequence public.battle_signals_id_seq to authenticated;
insert into public.profiles(id,display_name) values ${ids.map((u,i)=>`('${u}','Player ${i}')`).join(',')};
insert into auth.sessions(id,user_id) values ${ids.map(u=>`('${sid(u)}','${u}')`).join(',')};
update public.profiles set role='judge' where id='${J}';
update public.profiles set account_status='suspended' where id='${SUSP}';
update public.profiles set safety_restricted=true where id='${RESTRICT}';
update public.profiles set conduct_version=null where id='${NOGATE}';
update public.profiles set data_processing_restricted_at=now() where id='${DELETING}';
insert into public.battle_matches(id,host_id,guest_id,tcg,visibility,status,invite_code,host_display_name,guest_display_name,moderation_note) values
('${M}','${H}',null,'pokemon','public','waiting',null,'Host','Guest','private-note'),
('${P}','${H}',null,'pokemon','private','waiting','ABC123','Host','Guest','private-note'),
('${LIVE}','${H}','${G}','pokemon','public','live',null,'Host','Guest','private-note'),
('${DISPUTE}','${H}','${G}','pokemon','public','dispute',null,'Host','Guest','private-note'),
('${END}','${H}','${G}','pokemon','public','completed',null,'Host','Guest','private-note');`);
file('tests/fixtures/auth-boundary-baseline.sql');
file('supabase/migrations/20260911180746_harden_battle_and_profile_auth_boundaries.sql');
file('supabase/migrations/20260918123500_battle_beta_account_status_v1.sql');
file('supabase/migrations/20260918152000_battle_dispute_resolution_v1.sql');
const originalNames="('join_battle_match','set_battle_ready','start_battle_match','report_battle_result','create_battle_match_v2','resolve_battle_dispute')";
const fingerprint=()=>sql(`select md5(string_agg(pg_get_functiondef(oid),'' order by proname)) from pg_proc where pronamespace='public'::regnamespace and proname in ${originalNames};`);
const beforeFunctions=fingerprint();
// Reproduce the observed legacy table-level grant, only in this disposable database.
sql('begin; truncate public.battle_signals; rollback;',A);
pass('baseline browser TRUNCATE privilege reproduced in disposable database');
file('database/battle-spectator-foundation-v1.sql');
assert.equal(fingerprint(),beforeFunctions);
denied('truncate public.battle_signals;',A,/permission denied/);
denied('truncate public.battle_matches cascade;',A,/permission denied/);
pass('unnecessary table-level privileges revoked; existing RPC definitions unchanged');

for(const text of [call('list_battle_spectator_matches',['pokemon']),join(M,randomUUID()),beat(M,randomUUID()),leave(M,randomUUID()),call('get_battle_spectator_status',[M]),call('set_battle_spectator_link',[P,true])]) denied(text,null,/permission denied/,{role:'anon'});
denied(call('list_battle_spectator_matches',['pokemon']),null,/spectator_not_authenticated/);
denied(join(M,randomUUID()),A,/spectator_not_authenticated/,{is_anonymous:true});
denied(join(M,randomUUID()),A,/spectator_session_unavailable/,{session_id:sid(B)});
denied(join(M,randomUUID()),A,/spectator_session_unavailable/,{session_id:randomUUID()});
for(const u of [SUSP,RESTRICT,NOGATE,DELETING]) denied(join(M,randomUUID()),u,/spectator_battle_access_required/);
pass('anonymous, missing/revoked/mismatched session and ineligible BATTLE accounts rejected');
const lobby=json(call('list_battle_spectator_matches',['pokemon']),A);
assert.deepEqual(new Set(lobby.map(m=>m.id)),new Set([M,LIVE,DISPUTE]));
assert.equal(json(call('list_battle_spectator_matches',['one_piece']),A).length,0);
for(const row of lobby) for(const secret of ['invite_code','host_id','guest_id','host_result','guest_result','moderation_note','moderator_id']) assert.ok(!(secret in row),secret);
assert.equal(sql(`select count(*) from public.battle_matches where id='${P}';`,A),'0');
assert.equal(sql(`select count(*) from public.battle_matches where id='${LIVE}';`,A),'0');
denied('select * from battle_spectator_private.links;',A,/permission denied/);
denied(`select battle_spectator_private.snapshot('${P}');`,A,/permission denied/);
pass('public discovery includes live/dispute; private/terminal matches and sensitive columns stay private');
const beforeRow=sql(`select row_to_json(m) from public.battle_matches m where id='${M}';`);
const a1=randomUUID(),a2=randomUUID(),b1=randomUUID();
assert.equal(json(join(M,a1),A).match.spectator_count,1);
json(join(M,a1),A); json(join(M,a2),A); assert.equal(count(M),1);
json(join(M,b1),B); assert.equal(count(M),2);
sql(leave(M,a1),A); assert.equal(count(M),2);
sql(leave(M,a2),A); assert.equal(count(M),1);
sql(leave(M,a2),A); denied(beat(M,a2),A,/spectator_presence_expired/);
assert.equal(sql(`select row_to_json(m) from public.battle_matches m where id='${M}';`),beforeRow);
pass('idempotent join/leave, distinct-user multi-tab count and completely unchanged player slots');
sql(`update battle_spectator_private.presence set expires_at=clock_timestamp()-interval '1 second' where user_id='${B}';`);
assert.equal(count(M),0); denied(beat(M,b1),B,/spectator_presence_expired/);
json(join(M,b1),B);
sql(`update public.profiles set safety_restricted=true where id='${B}';`); assert.equal(count(M),0); denied(beat(M,b1),B,/spectator_battle_access_required/);
sql(`update public.profiles set safety_restricted=false where id='${B}'; update auth.sessions set not_after=now()-interval '1 second' where id='${sid(B)}';`);
assert.equal(count(M),0); denied(beat(M,b1),B,/spectator_session_unavailable/);
sql(`update auth.sessions set not_after=null where id='${sid(B)}'; delete from auth.sessions where id='${sid(B)}';`);
assert.equal(count(M),0); assert.equal(sql(`select count(*) from battle_spectator_private.presence where user_id='${B}';`),'0');
sql(`insert into auth.sessions(id,user_id) values('${sid(B)}','${B}');`);
pass('expiry, safety restriction, session timeout and session deletion immediately remove viewers from counts');

const same=randomUUID();
await Promise.all(Array.from({length:6},()=>concurrent(join(M,same),A)));
assert.equal(count(M),1); assert.equal(sql(`select count(*) from battle_spectator_private.presence where user_id='${A}';`),'1');
const burst=await Promise.allSettled(Array.from({length:10},()=>concurrent(join(M,randomUUID()),B)));
assert.equal(burst.filter(r=>r.status==='fulfilled').length,8);
assert.equal(sql(`select count(*) from battle_spectator_private.presence where user_id='${B}';`),'8');
assert.equal(count(M),2);
sql(`delete from battle_spectator_private.presence;`);
const race=await Promise.allSettled([concurrent(join(M,randomUUID()),A),concurrent(call('join_battle_match',[M,null]),A)]);
assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
assert.equal(race.filter(r=>r.status==='rejected').length,1);
sql(`delete from battle_spectator_private.presence; update public.battle_matches set guest_id=null,status='waiting',guest_display_name='Guest' where id='${M}';`);
pass('real concurrent joins deduplicate, respect the tab cap and cannot mix player/spectator roles');

for(const who of [H,G]) denied(join(LIVE,randomUUID()),who,/spectator_role_conflict/);
const watching=randomUUID(); json(join(M,watching),A);
for(const command of [call('set_battle_ready',[M,true]),call('start_battle_match',[M]),call('report_battle_result',[M,'host']),call('resolve_battle_dispute',[DISPUTE,'host','test'])]) denied(command,A);
denied(call('join_battle_match',[M,null]),A,/spectator_read_only_leave_first/);
denied(`update public.battle_matches set guest_id='${A}' where id='${M}';`,A,/permission denied/);
denied(`insert into public.battle_signals(match_id,sender_id,signal_type,payload) values('${M}','${A}','offer','{}');`,A,/row-level security/);
assert.equal(sql('select count(*) from public.battle_signals;',A),'0');
const judgeTab=randomUUID(); json(join(DISPUTE,judgeTab),J);
denied(call('resolve_battle_dispute',[DISPUTE,'host','test']),J,/spectator_read_only_leave_first/);
assert.equal(sql(`select count(*) from public.admin_audit_log;`),'0');
sql(leave(DISPUTE,judgeTab),J);
assert.equal(sql(call('resolve_battle_dispute',[DISPUTE,'host','test']),J),'completed');
pass('spectators cannot play, signal or resolve; a Judge must leave spectator mode before moderation');
sql(leave(M,watching),A);

denied(join(P,randomUUID()),A,/spectator_unavailable/);
denied(join(P,randomUUID(),'ABC123'),A,/spectator_unavailable/);
denied(call('set_battle_spectator_link',[P,true]),A,/spectator_link_host_only/);
denied(call('set_battle_spectator_link',[P,true]),G,/spectator_link_host_only/);
let code=json(call('set_battle_spectator_link',[P,true]),H).code;
assert.match(code,/^SP-[0-9A-F]{64}$/);
assert.notEqual(sql(`select secret_hash from battle_spectator_private.links where match_id='${P}';`),code);
denied(call('join_battle_match',[null,code]),B,/Match nicht gefunden/);
const privateTab=randomUUID();
assert.equal(json(join(null,privateTab,code),A).match.id,P);
assert.equal(count(P),1);
assert.ok(json(join(P,randomUUID()),A).match,'explicit server-side grant survives a new browser tab');
denied(join(P,randomUUID(),'ABC123'),A,/spectator_unavailable/);
denied(join(P,randomUUID()),B,/spectator_unavailable/);
denied(beat(P,privateTab),B,/spectator_unavailable/);
const rotated=await Promise.allSettled([concurrent(call('set_battle_spectator_link',[P,true]),H),concurrent(beat(P,privateTab),A)]);
assert.equal(rotated[0].status,'fulfilled');
const newCode=JSON.parse(rotated[0].value).code;
assert.notEqual(newCode,code); assert.equal(count(P),0);
denied(beat(P,privateTab),A,/spectator_unavailable/);
denied(join(P,randomUUID(),code),A,/spectator_unavailable/);
denied(join(P,randomUUID()),A,/spectator_unavailable/);
json(join(P,randomUUID(),newCode),A);
sql(call('set_battle_spectator_link',[P,false]),H);
assert.equal(count(P),0); denied(join(P,randomUUID(),newCode),A,/spectator_unavailable/);
assert.equal(sql(`select invite_code from public.battle_matches where id='${P}';`),'ABC123');
pass('private grants, secret hashing, code-domain separation, concurrent rotation and immediate revoke');

// Existing player lifecycle remains live while independent spectators watch.
sql(`delete from battle_spectator_private.presence; update public.battle_matches set status='completed';`);
const fresh=sql(call('create_battle_match_v2',['one_piece','public','Spectator regression','de','casual']),H);
sql(call('join_battle_match',[fresh,null]),G);
const terminalTab=randomUUID(); json(join(fresh,terminalTab),A);
sql(call('set_battle_ready',[fresh,true]),H); sql(call('set_battle_ready',[fresh,true]),G);
sql(call('start_battle_match',[fresh]),H);
sql(`insert into public.battle_signals(match_id,sender_id,signal_type,payload) values('${fresh}','${H}','offer','{}');`,H);
assert.equal(sql(`select count(*) from public.battle_signals where match_id='${fresh}';`,G),'1');
sql(call('report_battle_result',[fresh,'host']),H); sql(call('report_battle_result',[fresh,'host']),G);
assert.equal(count(fresh),0);
const finished=json(beat(fresh,terminalTab),A);
assert.equal(finished.match.status,'completed'); assert.equal(finished.match.result,'host'); assert.equal(finished.lease_expires_at,null);
denied(join(fresh,randomUUID()),B,/spectator_unavailable/);
denied(beat(fresh,terminalTab),A,/spectator_presence_expired/);
pass('unchanged player ready/start/signaling/result lifecycle and terminal spectator cleanup');
assert.equal(fingerprint(),beforeFunctions);
mkdirSync(new URL('test-results/',root),{recursive:true});
writeFileSync(new URL('test-results/battle-spectator-database.json',root),JSON.stringify({passed,engine:'PostgreSQL 17 / independent psql connections'},null,2));
