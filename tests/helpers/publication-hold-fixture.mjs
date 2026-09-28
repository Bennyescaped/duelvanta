import {securitySchemaFixture,read} from './security-schema-fixture.mjs';
export const uid=n=>'84000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const [O,J,A,B,C,D]=[1,2,3,4,5,6].map(uid),sid=u=>u?.replace('84000000','84100000'),fid=u=>u?.replace('84000000','84200000');
export async function claim(db,u,role='authenticated',extra={}){await db.query('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:u,role,aal:'aal2',session_id:sid(u),...extra})]);await db.query('set role '+role);}
export const admin=db=>claim(db,null,'postgres');
export async function publicationFixture(db){
 await securitySchemaFixture(db);
 for(const [u,role,name] of [[O,'owner','owner'],[J,'judge','judge'],[A,'player','alpha'],[B,'player','bravo'],[C,'player','charlie'],[D,'player','delta']]){
 const email=u===O?'info@duelvanta.de':name+'@example.invalid';
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[u,email]);
 await db.query("insert into public.profiles(id,email,username,display_name,role,account_status,age_band,conduct_accepted_at,conduct_version,collection_visibility) values($1,$2,$3,$3,$4,'active','18_plus',now(),'battle-v1-2026-09','public')",[u,email,name,role]);
 await db.query("insert into auth.mfa_factors(id,user_id,status) values($1,$2,'verified')",[fid(u),u]);
 await db.query("insert into auth.sessions(id,user_id,factor_id,aal) values($1,$2,$3,'aal2')",[sid(u),u,fid(u)]);
 }
 const chain=['auth-privileged-step-up-v1','security-privilege-mfa-hardening-v1','security-readiness-v1','market-production-trade-lock-v1','market-production-trade-lock-readiness-v1','account-data-export-collect-battle-v1','account-data-export-trade-lock-readiness-v1','account-processing-markers-v1','account-processing-markers-readiness-v1','account-closure-privacy-v1','account-closure-privacy-readiness-v1','scanner-processing-hold-v1','scanner-processing-hold-readiness-v1','battle-player-processing-hold-v1','battle-player-processing-hold-readiness-v1','battle-signal-processing-hold-v1','battle-signal-processing-hold-readiness-v1','battle-spectator-withdrawal-v1','battle-spectator-withdrawal-readiness-v1','battle-spectator-epoch-processing-hold-v1','battle-spectator-epoch-processing-hold-readiness-v1'];
 for(const f of [...chain,'staff-processing-hold-v1','staff-processing-hold-readiness-v1'])await db.exec(await read('database/'+f+'.sql'));
 for(const p of ['battle_moderate','reports_review','review_reports'])await db.query('insert into public.staff_permissions(user_id,permission,granted_by) values($1,$2,$3)',[J,p,O]);
}
