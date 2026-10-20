# R22-R3-R2 atomic placement/readiness package v1 – NOT_AUTO_APPLY

Only the isolated preparation, tests and CI are authorized. No Staging apply or preview.
Target: xhmjxrcskfhbovhitdej, exact History74 -> 75. Never Production.

`manifest.json` binds one migration payload and its source. The payload contains no top-level transaction controls: a future authorized Supabase apply_migration call must own one transaction including its migration-history row. Do not execute it statement-by-statement or insert a COMMIT. On any error roll back all four function operations and the history row; STOP, no blind retry. A timeout requires read-only reconciliation, never automatic reapplication. The actual version is assigned by the registrar only at apply; do not invent it in advance.

1. Verify target, exact branch commit, manifest SHA256/bytes and History74 identities.
2. Run `precheck.sql` read-only; require PRECHECK_PASS=true. It checks exact history, PG17, owner postgres, complete captured function definitions/owners/raw ACL/metainfo digest, original inventory, both gates and absence of both placement functions.
3. Obtain a separate operator authorization for exactly one atomic apply of `migration.sql` under the manifest name. Internal assertions repeat precheck and target schema postcheck within the same transaction.
4. After confirmed commit verify History75 with the exact 74-row prefix and one new name/version, then `postcheck.sql`. Preserve original receipt and exact payload hash. No collection writes are part of the package.
5. Any deviation: STOP. No repair migration. Preview needs another separate authorization.

The original placement source remains byte-unchanged in its existing path. Only its outer BEGIN/COMMIT are omitted from the combined payload. Two CREATE FUNCTION operations plus two CREATE OR REPLACE FUNCTION operations affect exactly four named functions. For the existing roots only the literal `$target$` may change; logic, revision, exception semantics, owner, grants and attributes are preserved.

The existing inventory helper is unchanged. Its Security inventory gains exactly two entries; no old entry changes. Its Legal inventory enumerates an explicit existing function set and therefore gains no entries. The Legal root keeps that exact literal unchanged and continues to require Security compatibility. Adding fictitious Legal entries would make the unchanged helper fail. This is recorded explicitly in readiness-diff.json and the manifest.

New functions are SECURITY INVOKER with exact ACL `{postgres=X/postgres,authenticated=X/postgres}`. The unchanged runtime inventory binds bodies, identity arguments, owner, definer flag, search_path, result, language, volatility, strictness and existing effective permissions for anon/authenticated/service_role. Pre/post package checks additionally bind raw ACL and complete function metadata. Expectations are frozen in committed artifacts, not learned during runtime or installation.

Reproduce with `node tests/r22-r3-r2/package.mjs --native` only in the disposable localhost PG17 harness. `package-test.mjs --native` independently reconstructs History74, regenerates byte-identical artifacts, applies the fixed payload, tests tampering, rollback, RLS/admission and a real observed racing writer. It must run under the existing CI database env. `--embedded` is an explicitly labelled local preflight using PGlite 0.4.0/PG17; it does not count as native/race acceptance and does not change the pinned CI runtime.

No changes to Admission/Beta/transport settings, provider access, storage, application tables, policies, indexes, triggers or any other functions. Synthetic test fixtures are local only. Existing physical camera/multi-card/binder proofs remain open.
