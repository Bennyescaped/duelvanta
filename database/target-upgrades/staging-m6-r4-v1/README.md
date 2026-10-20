# Staging72 R9 admission upgrade

NOT_AUTO_APPLY — REAL_APPLY_NOT_AUTHORIZED.

Target: xhmjxrcskfhbovhitdej (staging), PostgreSQL major 17, exact History72. Product baseline: Run835 / 38547472142, commit a99ae1e1e9750a108e7fa2520692b9cd06658beb.

Unit01 is the complete byte-identical accepted R9 candidate. Its SQL must not be edited. No real migration version is allocated here. The future operator must assign one version strictly after the last bound History72 entry and register exactly the name dv_staging_m6r4_01_magic_collect_admission, only under separate real-apply authorization.

Order: verify manifest hashes and target identity; execute precheck.sql in a read-only transaction and require PRECHECK_PASS=true; only after separate authorization apply Unit01 once through the migration registrar; verify exactly History73; execute postcheck.sql in a read-only transaction and require POSTCHECK_PASS=true. A false/null result or SQL error is a hard stop, never a warning. The checks do not mutate data or register history.

The 72 version/name identities are bound in manifest.json. Both R3 units are already applied and must never be replayed on staging. Synthetic native tests reconstruct their effects in a new disposable database only. Duplicate application is rejected by the mandatory precheck. No automatic apply entrypoint is provided.

Precheck embeds the accepted R3 postcheck, including its trusted helper and exact catalog inventories. Postcheck binds the R9 helper identity and full accepted security/legal inventories (ACL, RLS, SECURITY DEFINER, RPCs and triggers), empty admission/audit, exact Beta-OFF row and foundation-only state. Scanner, pricing and battle remain unavailable; registry and provider fail-closed contracts are also exercised by native package tests. No provider live request is permitted.

Testing: node tests/r11/package-test.mjs --native. PGHOST=127.0.0.1, PGUSER=postgres, PGDATABASE=postgres, isolated PostgreSQL17 only. No real users or hosted endpoints.
