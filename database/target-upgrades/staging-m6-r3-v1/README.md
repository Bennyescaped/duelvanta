# Staging70 reconciliation – NOT_AUTO_APPLY

Target xhmjxrcskfhbovhitdej only. This is not a fresh installation. Requires exact real History70 after committed R2 Unit02; all original history remains registered and immutable. No real apply authorization. Production access/apply, Beta activation, history repairs, reapply of confirmed units, merge and deployment are excluded.

Root cause: STAGING70_M4_SECURITY_AUTHORED_TARGET_BASELINE_MISMATCH. Ten legacy security index entries are present in the live baseline but absent from the old target. Legal inventory is exact; false is solely the Security dependency.

Under a later explicit operator authorization: verify project, full version/name prefix and absent names; run exact precheck.sql. For each unit, list_migrations before, verify exact prefix and exact query SHA/bytes, apply once, list_migrations after, bind actual version/name externally to query SHA/bytes, require read-only checkpoint before continuing. Unit01 standalone replaces only the two M4 public readinessroots and ACLs; it does not rerun M4. Require true/true, unchanged foundation/persistence/snapshot NULL and Beta absent. Unit02 is the separator-free common M6 delta plus native Staging70 readiness; require exact postcheck.sql PASS, one Magic Beta row enabled=false, Collection Magic allowed, Marketplace/Scanner/Pricing/Battle closed and Production lock absent. Expected future history counts 71 then72; versions remain null until observed.

P7 Units01–15 and R2 Units01–02 are CONFIRMED_APPLIED_DO_NOT_REAPPLY. P7 Units16/17 and R2 Unit03 are SUPERSEDED_DO_NOT_APPLY. Never execute an old suffix on this target.

Ambiguous return/timeout/connector error: no blind retry or next write. Read real migrationhistory, exact name and full prefix, then schema checkpoint and terminal evidence. Classify CONFIRMED_APPLIED, CONFIRMED_NOT_APPLIED or AMBIGUOUS_STOP. The real ledger plus external hash-bound receipts is authoritative. Only a unique ordered confirmed prefix may be skipped. A simulated ledger never substitutes for real history. No idempotency claim; reapply_safe=not_proven.
