# Staging M6 target package — NOT_AUTO_APPLY

Operator source of truth for `preview_staging`, project `xhmjxrcskfhbovhitdej`, contract `duelvanta-staging-m6-v1`. Source head: `fe808692aa2679f971b94b9b7b552d511f652291`. This package grants no real apply or Beta activation authority. Production `enifiaqsnqtbzylnfrpi` is forbidden. U001–U060 remain CANDIDATE_NOT_AUTHORIZED_FOR_PRODUCTION; see `production-hold.json`.

The accepted P5-R1 observation and P6-R3/P6-R5-R1 native rehearsal bind the starting legacy schema: PostgreSQL 17, `dv_collect_private` present, Foundation/M4/M6 absent, legacy Security/Legal compatible, no Production TRADE lock. P5-R1 observed 53 registered Staging migrations; Production has 72, with no shared versions. Neither real history is written or recreated here. The native replay uses the unchanged, data-free P6-R3 reconstruction of that accepted starting state; it does not claim source-byte parity with all 53 remotely registered migrations.

## Unit construction

There are 17 ordered migration units. Units 01–13 are exactly the accepted P6-R3 COMMON product prerequisites, with no intervening Production readiness profiles. Unit 14 is the unchanged I2 delta; unit 15 is the unchanged Staging I2 readiness. Unit 16 concatenates the M4 delta and Staging M4 readiness with zero separator bytes. Unit 17 does the same for M6. In each of the last two units, the delta opens the transaction and readiness closes it. Never split either unit, add a transaction wrapper, or rewrite its SQL. Every other source already has its own complete BEGIN/COMMIT contract.

`manifest.json` records each source SHA256, exact unit SHA256 and byte count, ordered name, pre/postconditions and transaction boundaries. Versions, registered history versions and applied flags remain null/false. `reapply_safe=not_proven` for every unit. No timestamp version is invented. Regenerate only from the pinned sources with `node tests/helpers/tcg-i3-m6-p7-migration-package.mjs --build`; verify committed bytes by omitting `--build`. This builder has no database connection or real apply operation.

Prerequisite units can temporarily make the old readiness profile incompatible. That is the accepted P6-R3 sequence, not permission to bypass final readiness. Unit 13 must reach the accepted protected export/erasure function hashes. Unit 15 restores compatible Staging I2 readiness; units 16 and 17 must each leave compatible roots. Production lock must remain absent throughout.

## Read-only checks

`precheck.sql` is one SELECT statement with CTEs. Missing objects, altered legacy readiness bodies, changed constraints or a wrong major version produce `PRECHECK_PASS=false`. Both readiness bodies match the P5-R1 captured functions and the accepted source. Only fixed SELECT strings are passed to `query_to_xml` to avoid parsing nonexistent functions on the negative target. There is no repair. Query errors also mean STOP, never permission to continue.

`postcheck.sql` is read-only and pins the final Staging readiness bodies. It requires both compatible roots and the M6 Beta contract, exact Magic/scryfall/1 binding, foundation/persistence with no snapshot, exactly one Beta row disabled, Collection Magic allowed, Marketplace Magic forbidden and Production lock absent. Scanner/Pricing/Battle are closed at this database state through unavailable Magic and the foundation release. CI separately verifies their non-ready application capability entries in the pinned registry; SQL alone cannot inspect deployed JavaScript or attest an external runtime configuration.

Schema checks do not prove a Supabase project identity. A future separately authorized operator must independently verify the exact connection project ref. The Production72 native negative test demonstrates this package's schema precheck rejects that baseline; it is not an authorization mechanism for another project with a copied schema.

## Future tracking and resume contract

Before the first authorized real write, freshly confirm project identity, registered history and schema read-only; verify all package hashes and require PRECHECK_PASS. Existing P5/P6 captures cannot replace this fresh preflight. Do not put these files in `supabase/migrations`, repair history or infer versions from filenames.

Apply one complete unit in order using its exact `migration_name` and bytes through a separately authorized controlled Supabase migration operation. After each successful operation, call `list_migrations` read-only. Bind the actual registered version and exact name, unit SHA256, target and operation result to durable evidence before proceeding. Require exactly one matching registered record. An unexpected existing name, hash conflict, out-of-order history or uncertain commit outcome means STOP and read-only reconciliation. Never repeat a unit based only on a missing client receipt. No automatic rollback or blind idempotent reapply is claimed.

Resume skips only a verified, unique, ordered completed prefix bound to the same target/package and exact hashes. Continue the missing suffix in order. A fresh-install precheck intentionally fails on a partial installation; it must not be used to erase or reinstall that state. Resume instead requires reconciled registered history and the last completed checkpoint. Run the read-only postcheck after the complete suffix. Beta remains OFF.

P7 tests this logic with a local JSON ledger, `APPLIED_SIMULATED`, in disposable PG17 databases only. It injects an interruption between fully committed units, reloads the prefix and proves every unit executes exactly once and the final state equals a full replay and fresh P6-R3 semantics. No Supabase history table is created or written, and no real migration operation is called.

## Acceptance

The regular PR job runs native full replay, Production72 wrong-target rejection, tracking/resume, source/hash/transaction checks and fresh P6 regressions. Native admission permits only the hosted disposable PostgreSQL 17 service at 127.0.0.1; the existing forbidden-I/O boundary blocks provider and external database access. Evidence is in `test-results/tcg-i3-m6-p7/`.

NO REAL APPLY. NO HISTORY WRITE. NO BETA ACTIVATION. NO PRODUCTION PACKAGE. NO MERGE.
