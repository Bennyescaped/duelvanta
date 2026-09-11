import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(process.argv[2]?pathToFileURL(process.argv[2]).href:'@electric-sql/pglite');
const db=new PGlite();
const H='10000000-0000-4000-8000-000000000001',G='10000000-0000-4000-8000-000000000002',X='10000000-0000-4000-8000-000000000003',M='20000000-0000-4000-8000-000000000001';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
try{
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to anon,authenticated;
 create table public.profiles(id uuid primary key,email text,role text default 'player',account_status text default 'active',safety_restricted boolean default false,display_name text,username text,username_changed_at timestamptz,founder_number integer,founder_generation text,founder_since timestamptz);
 create table public.battle_matches(id uuid primary key default gen_random_uuid(),host_id uuid,guest_id uuid,tcg text,mode text default 'casual',visibility text,status text default 'waiting',invite_code text,title text,language text,host_display_name text,guest_display_name text,host_founder_number integer,guest_founder_number integer,host_ready boolean default false,guest_ready boolean default false,moderation_state text,paused_at timestamptz,host_result text,guest_result text,winner_id uuid,started_at timestamptz,completed_at timestamptz,updated_at timestamptz);
 insert into public.profiles(id) values ('${H}'),('${G}'),('${X}');
 insert into public.battle_matches(id,host_id,visibility,tcg) values ('${M}','${H}','public','pokemon');`);
 await db.exec(await read('tests/fixtures/auth-boundary-baseline.sql'));
 // Reproduce the old SQL NULL bypass in an isolated database, never on production.
 await db.exec(`set role anon; select public.set_battle_ready('${M}',true); reset role;`);
 assert.equal((await db.query(`select guest_ready from public.battle_matches where id='${M}'`)).rows[0].guest_ready,true);
 await db.exec(`update public.battle_matches set guest_ready=false where id='${M}';`);
 await db.exec(await read('supabase/migrations/20260911180746_harden_battle_and_profile_auth_boundaries.sql'));
 const claim=async(uid,role='authenticated')=>db.exec(`reset role; select set_config('request.jwt.claim.sub','${uid||''}',false); set role ${role};`);
 const blocked=async(sql,pattern)=>assert.rejects(()=>db.query(sql),pattern);
 await claim(null,'anon');
 for(const call of [`join_battle_match('${M}',null)`,`set_battle_ready('${M}',true)`,`start_battle_match('${M}')`,`report_battle_result('${M}','host')`])await blocked('select public.'+call,/permission denied/);
 await claim(null,'authenticated');await blocked(`select public.set_battle_ready('${M}',true)`,/not_authenticated/);
 await claim(X);await blocked(`select public.set_battle_ready('${M}',true)`,/Nicht erlaubt/);await blocked(`select public.start_battle_match('${M}')`,/Nur der Host/);
 await db.exec(`reset role;update public.profiles set safety_restricted=true where id='${X}';`);
 await claim(X);await blocked(`select public.join_battle_match('${M}',null)`,/battle_account_unavailable/);
 await db.exec('reset role');
 assert.equal((await db.query(`select public.can_update_own_profile_safe(jsonb_populate_record(null::public.profiles,to_jsonb(p)||'{"safety_restricted":false}'::jsonb)) as allowed from public.profiles p where id='${X}'`)).rows[0].allowed,false,'users cannot remove their own moderation restriction');
 await claim(H);await db.query(`select public.set_battle_ready('${M}',true)`);await blocked(`select public.start_battle_match('${M}')`,/Beide Spieler/);
 await claim(G);await db.query(`select public.join_battle_match('${M}',null)`);await db.query(`select public.set_battle_ready('${M}',true)`);
 await claim(H);await db.query(`select public.start_battle_match('${M}')`);await db.query(`select public.report_battle_result('${M}','host')`);
 await claim(G);await db.query(`select public.report_battle_result('${M}','host')`);
 await db.exec('reset role');assert.equal((await db.query(`select status from public.battle_matches where id='${M}'`)).rows[0].status,'completed');
 console.log('PASS: anonymous NULL bypass reproduced then blocked; participant/active-account guards, protected profile restriction and full two-player match pass');
}finally{await db.close()}
