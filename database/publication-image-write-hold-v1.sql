-- D4-V1 branch candidate only. Apply after publication-processing-hold-v1.
-- No object DML, read/delete policy change, bucket change or cache invalidation.
begin;
drop policy if exists d4_image_insert_hold on storage.objects;
create policy d4_image_insert_hold on storage.objects as restrictive for insert to authenticated
with check (dv_market_private.d4_image_write_allowed(bucket_id,name));
drop policy if exists d4_image_update_hold on storage.objects;
create policy d4_image_update_hold on storage.objects as restrictive for update to authenticated
using (dv_market_private.d4_image_write_allowed(bucket_id,name))
with check (dv_market_private.d4_image_write_allowed(bucket_id,name));
commit;
