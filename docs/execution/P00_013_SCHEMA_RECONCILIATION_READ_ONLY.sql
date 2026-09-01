-- P00-013 live/local schema reconciliation.
--
-- READ ONLY: this statement reads catalog/migration metadata and aggregate
-- row counts. It does not return application rows and does not perform DDL or
-- DML. Run it only against
-- the explicitly confirmed Privelier Supabase project, then retain a redacted
-- summary rather than raw hosted output.

select jsonb_build_object(
  'migrations',
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'version', version,
          'name', name,
          'has_statements', statements is not null,
          'remote_only_statements',
            case
              when version = '20260728141752'
                or name = 'create_waitlist_table'
              then to_jsonb(statements)
              else null
            end
        )
        order by version
      ),
      '[]'::jsonb
    )
    from supabase_migrations.schema_migrations
  ),
  'review_created_at_ledger_references',
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'version', version,
          'name', name
        )
        order by version
      ),
      '[]'::jsonb
    )
    from supabase_migrations.schema_migrations
    where coalesce(array_to_string(statements, E'\n'), '') ~* 'reviews'
      and coalesce(array_to_string(statements, E'\n'), '') ~* 'created_at'
  ),
  'public_tables',
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'table', c.relname,
          'rls_enabled', c.relrowsecurity,
          'rls_forced', c.relforcerowsecurity,
          'replica_identity', c.relreplident
        )
        order by c.relname
      ),
      '[]'::jsonb
    )
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  ),
  'target_columns',
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'table', table_name,
          'ordinal', ordinal_position,
          'column', column_name,
          'type', data_type,
          'udt', udt_name,
          'nullable', is_nullable,
          'default', column_default
        )
        order by table_name, ordinal_position
      ),
      '[]'::jsonb
    )
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('reviews', 'waitlist')
  ),
  'target_row_counts',
  jsonb_build_array(
    jsonb_build_object(
      'table', 'reviews',
      'count', (select count(*) from public.reviews)
    ),
    jsonb_build_object(
      'table', 'waitlist',
      'count', (select count(*) from public.waitlist)
    )
  ),
  'target_constraints',
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'table', c.relname,
          'name', con.conname,
          'type', con.contype,
          'definition', pg_get_constraintdef(con.oid, true)
        )
        order by c.relname, con.conname
      ),
      '[]'::jsonb
    )
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('reviews', 'waitlist')
  ),
  'target_indexes',
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'table', tablename,
          'name', indexname,
          'definition', indexdef
        )
        order by tablename, indexname
      ),
      '[]'::jsonb
    )
    from pg_indexes
    where schemaname = 'public'
      and tablename in ('reviews', 'waitlist')
  ),
  'target_policies',
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'table', tablename,
          'name', policyname,
          'permissive', permissive,
          'roles', roles,
          'command', cmd,
          'using', qual,
          'check', with_check
        )
        order by tablename, policyname
      ),
      '[]'::jsonb
    )
    from pg_policies
    where schemaname = 'public'
      and tablename in ('reviews', 'waitlist')
  ),
  'target_grants',
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'table', table_name,
          'grantee', grantee,
          'privilege', privilege_type
        )
        order by table_name, grantee, privilege_type
      ),
      '[]'::jsonb
    )
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name in ('reviews', 'waitlist')
  ),
  'target_triggers',
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'table', c.relname,
          'name', t.tgname,
          'definition', pg_get_triggerdef(t.oid, true)
        )
        order by c.relname, t.tgname
      ),
      '[]'::jsonb
    )
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname = 'public'
      and c.relname in ('reviews', 'waitlist')
  ),
  'target_inbound_foreign_keys',
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'target_table', target.relname,
          'source_schema', source_ns.nspname,
          'source_table', source.relname,
          'name', con.conname,
          'definition', pg_get_constraintdef(con.oid, true)
        )
        order by target.relname, source_ns.nspname, source.relname, con.conname
      ),
      '[]'::jsonb
    )
    from pg_constraint con
    join pg_class target on target.oid = con.confrelid
    join pg_namespace target_ns on target_ns.oid = target.relnamespace
    join pg_class source on source.oid = con.conrelid
    join pg_namespace source_ns on source_ns.oid = source.relnamespace
    where con.contype = 'f'
      and target_ns.nspname = 'public'
      and target.relname in ('reviews', 'waitlist')
  ),
  'target_dependent_views',
  (
    select coalesce(
      jsonb_agg(
        distinct jsonb_build_object(
          'target_table', target.relname,
          'dependent_schema', dependent_ns.nspname,
          'dependent_relation', dependent.relname,
          'dependent_kind', dependent.relkind
        )
      ),
      '[]'::jsonb
    )
    from pg_depend dep
    join pg_class target on target.oid = dep.refobjid
    join pg_namespace target_ns on target_ns.oid = target.relnamespace
    join pg_rewrite rewrite on rewrite.oid = dep.objid
    join pg_class dependent on dependent.oid = rewrite.ev_class
    join pg_namespace dependent_ns on dependent_ns.oid = dependent.relnamespace
    where target_ns.nspname = 'public'
      and target.relname in ('reviews', 'waitlist')
      and dependent.oid <> target.oid
      and dependent.relkind in ('v', 'm')
  ),
  'realtime_publication',
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'publication', pubname,
          'schema', schemaname,
          'table', tablename
        )
        order by pubname, schemaname, tablename
      ),
      '[]'::jsonb
    )
    from pg_publication_tables
    where schemaname = 'public'
  ),
  'storage_buckets',
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'name', name,
          'public', public,
          'file_size_limit', file_size_limit,
          'allowed_mime_types', allowed_mime_types
        )
        order by id
      ),
      '[]'::jsonb
    )
    from storage.buckets
  ),
  'storage_object_policies',
  (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', policyname,
          'roles', roles,
          'command', cmd,
          'using', qual,
          'check', with_check
        )
        order by policyname
      ),
      '[]'::jsonb
    )
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
  )
) as schema_reconciliation;
