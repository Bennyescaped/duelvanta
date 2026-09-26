# T2 – own COLLECT scanner / BATTLE export candidate

Prepared 26 September 2026 under V66 and the operator's audit exception. Branch candidate only; no Production/Staging application, no UI/provider/payment changes.

## Scope and actual baseline

`public.export_my_duelvanta_data()` returns V3 with the existing account, collection, marketplace and withdrawal payload plus explicit `scanner` and `battle` projections. The current hardened baseline actually returns V1: the later legal migration overwrote the earlier V2 Pickup entry. V3 restores that entry through the unchanged `dv_market_private.pickup_messages_for_export(auth.uid())`; there is no parallel Pickup implementation.

The additional private, parameterless STABLE helper uses `auth.uid()` and fully qualified tables. It cannot be called directly by anon/authenticated/service_role. Existing public-export ACL and authentication checks are preserved. In particular, the historical service_role EXECUTE grant is not silently removed: a service call without a subject fails; a service call with a subject remains restricted to that subject. This is not a new session-security or Processing-Hold release.

Exactly one existing audit INSERT remains per successful public call. Only its existing version value changes to `duelvanta-data-export-v3` so its SHA-256 identifies the final augmented payload correctly. No new audit columns, triggers, events or retention are introduced. No scanner, quota, budget, match, collection, profile, erasure or hold data is written by the export.

The detailed [field matrix](account-data-export-collect-battle-field-matrix-v1.md) and `database/account-data-export-collect-battle-fields-v1.json` cover all 196 columns of 25 relevant tables in the reconstructed schema. No current provider data or real user rows were queried. Global cost imports are not falsely assigned to users. Reports, staff/judge records, counterpart identities/ratings, invite/session/tab/generation/epoch identifiers and signaling payloads are excluded from the extension. Existing Pickup conversation semantics remain unchanged.

## Candidate dependencies and readiness

The original P0-01 72-history/60-step manifest and all existing P0 SQL remain unchanged. T2 is a separate reviewed tail candidate, not an automatic new live migration.

After the full P0-01/P0-02 stack, apply `database/account-data-export-collect-battle-v1.sql` and `database/account-data-export-readiness-v1.sql` together in a future explicitly authorized release transaction. If the P0-05 lock candidate is part of that release, apply its unchanged implementation before T2 and use **`database/account-data-export-trade-lock-readiness-v1.sql`** as the final contract instead. Never finish such a release with the older pre-T2 contract, or with the non-lock contract on a lock-bearing schema. The current task does not authorize either live sequence.

The authored contracts compare complete schema/function/ACL fingerprints; they are not captured from live drift. T2 changes exactly the public export function and one new private helper before replacing its matching readiness pair. An old contract must reject T2. Original contracts remain reproducible and usable for their original P0 candidates. A future final rollout manifest must explicitly include the selected T2 tail and hashes; this is not an implicit Production migration authorization.

## Verification

Local SQL verification:

```sh
node tests/account-data-export-collect-battle-test.mjs
node tests/account-data-export-collect-battle-test.mjs --trade-lock
node tests/generate-security-readiness.mjs --check
node tests/generate-security-readiness.mjs --data-export --check
node tests/generate-security-readiness.mjs --data-export --trade-lock --check
node tests/production-upgrade-rehearsal.mjs --trade-lock --data-export
```

GitHub `account_data_export_t2` additionally uses the localhost-only native PostgreSQL 17 harness for both variants and the full P0 reconstruction followed by T2. No cloud database is a test target. JSON/log artifacts are uploaded by the workflow. PGlite local evidence is not described as native evidence.

The test creates two populated users, a third unrelated participant, an empty account, a restricted historical-only account and an Owner account. Checks include own settled/unsettled/historical scanner entries, host/guest sides, waiting/draw results, expired spectator presence and withdrawn consent, repeatability, no role-based scope widening, no caller-supplied user ID, restricted private helpers, excluded secret/foreign canaries, exact output field allowlists and exclusion of future columns.

Before every verified call, all persistent application/Auth rows and sequence positions are fingerprinted. BEFORE STATEMENT guards reject all INSERT/UPDATE/DELETE/TRUNCATE operations except the approved audit INSERT, including attempts matching zero rows. Every successful export must add exactly one audit row, preserve earlier audit rows, hash the final JSON with the same caller hash and leave all other fingerprints unchanged. The fixture contains 96 tables without the lock candidate (97 with it) and 15 sequences. Fixture-only restoration of retired historical swaps occurs before these guards; all original triggers are active during export tests. No live protection is changed.

The test coverage does not assert that arbitrary text already present in every historical marketplace export has received a new legal/privacy audit. Its concrete proof covers the new strict projections, synthetic full-export canaries, unchanged baseline payload and existing Pickup behavior. Excluded reports/third-party rights, external provider copies, retention, erasure and end-to-end holds remain separate work.
