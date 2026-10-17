# R13 closed-beta operations for Staging73

NOT_AUTO_APPLY. REAL_APPLY_NOT_AUTHORIZED. BETA_ACTIVATION_NOT_AUTHORIZED.

One forward-only unit extends exact History73 to History74. R4 version 20261014192812 must never be replayed. A future migration registrar, only after separate operator authorization, assigns the real version. Initial and postcheck state: beta OFF, transport OFF, limits 0/0, admission/audit empty. No real users, deployment or provider contact in this package's tests.

## Private operator workflow

Only postgres may invoke private SECURITY INVOKER `dv_collect_private.magic_admission_operator_v1`. No public enrolment RPC or service-role grant exists. R9 admission remains the sole membership authority. Supply an expressly approved UUID allowlist, one user UUID, new request UUID, `admit`/`revoke`, finite absolute start/expiry, exact contract `magic-on-demand-collect-beta/1`, and operator authorization reference. Never scan staging for users.

Run first with `p_dry_run=true` in a read-only transaction. Check all parameters and retain returned `expected_state`. With approval, use the identical request with that hash and `p_dry_run=false`. Concurrent state changes fail the compare-and-set; conflicting active admission is never overwritten. R9 audit records states and operator reference; a private receipt binds each request. Replaying an identical committed command is a no-op, never a reactivation. `already_committed` denotes historical execution, not current admission: a later revoke still wins. Different payload with the same UUID fails. Reactivation needs new approval and request ID.

Revoke with a new dry-run/compare-and-set command. Do not delete admission/audit/history as rollback. R9-permitted own-item maintenance/deletion remains; revoked users cannot create new Magic identities or reserve provider capacity.

## Later activation and shutdown

Separate operator approvals are required for testers, beta, deployment and provider transport. Server gate `DUELVANTA_MAGIC_PROVIDER_LIVE_APPROVAL=magic-collect-transport/1` defaults absent/OFF; HTTP headers and claims cannot supply it. Verified `/auth/v1/user` and caller-bound R9 readiness are retained. A publishable key and identical caller bearer reserve budget; no service-role bypass and no user_metadata decision.

The private policy row separately requires enabled=true, an authorization reference and approved bounded limits. Defaults: 0 global / 0 per-user requests per 60-second UTC-aligned window, OFF. Bounds: global 0..10000, user 0..1000, window 1..86400 seconds. Never change window geometry while active or clear usage to manufacture capacity. Disable both gates, drain in-flight requests, then configure a newly approved release.

Lock order: profile -> beta -> admission -> global policy -> usage. The shared policy lock serializes all instances. One committed reservation increments both counters and creates technical evidence without tokens. Request IDs are single-use, with no refund/retry on provider failure or ambiguous DB response. Local 100ms throttling is additional only. Provider host/redirect/timeout/size/payload guards are unchanged.

A reservation committed before revocation can complete its already-authorized in-flight request; revocation committed first prevents new reservations. Expiry is rechecked after waiting on the global lock. Shutdown disables server and DB transport gates, disables beta, and drains requests bounded by the existing 8-second provider timeout.

## Native verification

`node tests/r13/build-package.mjs --native` authors only the new package against disposable PG17. `node tests/r13/package-test.mjs --native` validates original pre/postchecks, one synthetic migration, history/ACL drift, provisioning, atomic budgets, revocation ordering and caller-bound mock search/save/binder flow. R9 sources remain untouched; the route is the explicitly authorized extension. Existing R9/M6/browser regressions remain active. No GitHub-Actions emulator.
