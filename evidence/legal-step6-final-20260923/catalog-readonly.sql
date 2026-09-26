begin read only;
select jsonb_build_object(
'columns',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'position',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid))) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where n.nspname in ('public','dv_market_private') and c.relkind='r' and a.attnum>0 and not a.attisdropped),
'constraints',(select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'type',contype,'definition',pg_get_constraintdef(oid))) from pg_constraint where connamespace in ('public'::regnamespace,'dv_market_private'::regnamespace)),
'triggers',(select jsonb_agg(jsonb_build_object('table',tgrelid::regclass::text,'name',tgname,'enabled',tgenabled,'definition',pg_get_triggerdef(t.oid))) from pg_trigger t join pg_class c on c.oid=tgrelid where c.relnamespace in ('public'::regnamespace,'dv_market_private'::regnamespace) and not tgisinternal),
'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'identity',p.oid::regprocedure::text,'acl',p.proacl,'definition',pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','dv_market_private') and p.prokind='f'),
'sequences',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','dv_market_private') and c.relkind='S'),
'indexes',(select jsonb_agg(to_jsonb(i)) from pg_indexes i where schemaname in ('public','dv_market_private')),
'rls',(select jsonb_agg(jsonb_build_object('table',c.oid::regclass::text,'rls',relrowsecurity,'acl',relacl)) from pg_class c where relnamespace in ('public'::regnamespace,'dv_market_private'::regnamespace) and relkind='r'),
'schema_acl',(select jsonb_agg(jsonb_build_object('schema',nspname,'acl',nspacl)) from pg_namespace where nspname in ('public','dv_market_private')),
'policies',(select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname in ('public','dv_market_private')),
'default_privileges',(select jsonb_agg(jsonb_build_object('owner',defaclrole::regrole::text,'schema',defaclnamespace::regnamespace::text,'type',defaclobjtype,'acl',defaclacl)) from pg_default_acl),
'column_grants',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'column',a.attname,'acl',a.attacl)) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','dv_market_private') and a.attnum>0 and a.attacl is not null),
'invalid_constraints',(select count(*) from pg_constraint where connamespace in ('public'::regnamespace,'dv_market_private'::regnamespace) and not convalidated),
'invalid_indexes',(select count(*) from pg_index i join pg_class c on c.oid=i.indrelid where c.relnamespace in ('public'::regnamespace,'dv_market_private'::regnamespace) and (not indisvalid or not indisready))
) as catalog;
commit;
