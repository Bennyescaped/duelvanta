// The same catalog projection is used to generate the reviewed contract and at runtime.
// No application rows, network calls, configuration markers or user-profile substitutes.
export function catalogQuery(tables,functions){
 const lit=s=>"'"+s.replaceAll("'","''")+"'";
 return `with required_tables(name) as (values ${tables.map(n=>'('+lit(n)+')').join(',')}),
 required_functions(name) as (values ${functions.map(n=>'('+lit(n)+')').join(',')}),
 checks as (
 select 'table' kind,r.name,jsonb_build_object(
 'rls',c.relrowsecurity,
 'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
  from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
 'constraints',(select jsonb_agg(jsonb_build_array(x.conname,pg_get_constraintdef(x.oid),x.convalidated,x.condeferrable,x.condeferred) order by x.conname) from pg_constraint x where x.conrelid=c.oid),
 'indexes',(select jsonb_agg(jsonb_build_array(i.relname,pg_get_indexdef(x.indexrelid),x.indisvalid,x.indisready) order by i.relname) from pg_index x join pg_class i on i.oid=x.indexrelid where x.indrelid=c.oid),
 'triggers',(select jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid),t.tgenabled) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal),
 'browser_privileges',(select jsonb_agg(jsonb_build_array(role,priv,has_table_privilege(role,c.oid,priv)) order by role,priv)
  from unnest(array['anon','authenticated']) role cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) priv),
 'column_privileges',(select jsonb_agg(jsonb_build_array(role,a.attname,priv,has_column_privilege(role,c.oid,a.attnum,priv)) order by role,a.attnum,priv)
  from pg_attribute a cross join unnest(array['anon','authenticated']) role cross join unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) priv
  where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)
 ) value from required_tables r left join pg_class c on c.oid=to_regclass(r.name)
 union all
 select 'function',r.name||'('||pg_get_function_identity_arguments(p.oid)||')',
 jsonb_build_object('body',md5(p.prosrc),'result',pg_get_function_result(p.oid),'definer',p.prosecdef,'volatility',p.provolatile,
 'config',p.proconfig,'language',l.lanname,'kind',p.prokind,
 'grants',(select jsonb_agg(jsonb_build_array(role,has_function_privilege(role,p.oid,'EXECUTE')) order by role) from unnest(array['anon','authenticated','service_role']) role))
 from required_functions r left join pg_proc p on p.pronamespace::regnamespace::text||'.'||p.proname=r.name left join pg_language l on l.oid=p.prolang
 union all
 select 'boundary','private',jsonb_build_object(
 'schema',(select jsonb_agg(jsonb_build_array(role,has_schema_privilege(role,'dv_market_private','USAGE'),has_schema_privilege(role,'dv_market_private','CREATE')) order by role) from unnest(array['anon','authenticated']) role),
 'offer_backend',(select jsonb_agg(jsonb_build_array(priv,has_table_privilege('service_role','public.market_offers',priv)) order by priv) from unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) priv),
 'offer_policies',(select jsonb_agg(jsonb_build_array(p.polname,p.polcmd,p.polpermissive,
 (select jsonb_agg(r.rolname order by r.rolname) from pg_roles r where r.oid=any(p.polroles)),pg_get_expr(p.polqual,p.polrelid),pg_get_expr(p.polwithcheck,p.polrelid)) order by p.polname)
 from pg_policy p where p.polrelid='public.market_offers'::regclass))
 ) select jsonb_agg(jsonb_build_array(kind,name,md5(value::text)) order by kind,name) from checks`;
}
