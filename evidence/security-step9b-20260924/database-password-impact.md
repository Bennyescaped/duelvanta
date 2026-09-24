# Staging database-password impact review — 2026-09-24

Read-only review, project xhmjxrcskfhbovhitdej. No password change, role alteration, migration or secret extraction. Production untouched.

- Repository API/Edge/browser code uses Supabase HTTP client/API keys; direct PostgreSQL connection patterns found only in CI tests, enforced localhost/127.0.0.1. CI test password is isolated-ci-only, unrelated to Staging.
- Live Vercel project variables: Supabase URL/anon/service-key Preview defaults and branch override; no DATABASE_URL/DIRECT_URL/POSTGRES_URL/PGPASSWORD/SUPABASE_DB_PASSWORD variable displayed. Shared tab: No shared variables linked. No values revealed.
- Current pg_stat_activity: PostgREST authenticator, pooler, management API postgres connection, pg_net worker, internal supabase_admin/cron/exporter. No separately identifiable external postgres client at observation time. A point-in-time view cannot exclude dormant clients.
- Both cron jobs active. Carrier job internal SQL; media reconciler HTTP. No direct connection/password pattern in either job command. Commands themselves not exported.
- Live Edge source for broker/reconciler/inspect checked for direct DB connection patterns: none. Broker/reconciler use Supabase client. Existing owner invite source uses Supabase client/API keys, no DB password.
- Provider docs: https://supabase.com/docs/guides/database/postgres/roles — managed services updated on project password reset; external services using postgres credentials need manual update. Existing API credentials are distinct from the postgres password.

Conclusion: no known application/CI/worker password dependency found; controlled Staging-only rotation is supportable, with caveat for unrecorded dormant external tools. Newly set credential must be user-entered and stored securely. No credential entry in chat or repository. After rotation verify management SQL, Auth/MFA, REST and cron health, then create and validate a recoverable backup before the security migrations. Rotation is not itself a backup.
