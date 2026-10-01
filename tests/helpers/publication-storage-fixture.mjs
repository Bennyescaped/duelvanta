// Storage metadata substitute: exact source RLS predicates; no storage service/objects.
import {read} from './security-schema-fixture.mjs';
export async function storageFixture(db){
 await db.exec(`create schema storage;
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null,name text not null,metadata jsonb default '{}'::jsonb,unique(bucket_id,name));
 create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
 grant execute on function storage.foldername(text) to authenticated;
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated,service_role;
 grant select,insert,update,delete on storage.objects to authenticated;
 grant all on storage.objects to service_role;`);
 const source=JSON.parse(await read('evidence/d4-publication-source-20260928/storage-readonly-20260928.json'));
 for(const p of source.policies)await db.exec(`create policy ${p.policyname} on storage.objects for ${p.cmd} to authenticated ${p.qual?'using ('+p.qual+')':''} ${p.with_check?'with check ('+p.with_check+')':''}`);
}
