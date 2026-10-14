DUELVANTA R9 — LOCAL SECURITY CANDIDATE / NOT PUBLISHED / NOT AUTHORIZED TO APPLY

Base: Bennyescaped/duelvanta, tcg-registry-v1
HEAD 3b4fd2a71b9e041c4427b50d4fd2af6283230959
Parent 7f306cd6339d10563d0cb571c1262aa6249c97de
Tree b1d26069f81c959942244b05fc5792bb13d350de

candidate.sql is the single forward-only atomic candidate. It includes admission.sql,
inventory-helper.sql and the separately authored, literal readiness inventories.
Do not execute fragments independently. No real migration name/version is allocated.
No real tester rows are supplied. No old R3 source or published package is modified.

Admission contract
Database-local auth.uid, verified auth.users email, nonanonymous caller, eligible
profile, global beta ON, Security/Legal compatible and active unexpired membership.
The membership has fixed magic/collect scope and magic-on-demand-collect-beta/1.
Private owner-managed table; zero anon/authenticated/service_role privileges and
RLS without client policies. There is no admission-management RPC. Insert/update/
delete creates an operator-only audit event with an authorization reference and
hashed subject identifier; this audit is pseudonymous, not anonymous. A future
operator process must define its access, reference format and retention policy.

Mutations retain profile and beta locks. New rows and identity changes additionally
hold the membership row FOR SHARE through transaction end. Revocation must update
or delete the same row; no external cache is authoritative. Save/trigger identity
checks execute inside the write transaction. A save that wins the lock commits
before revocation; revocation that wins prevents the later save. Readiness receipts
are only UI visibility hints. Existing own nonidentity maintenance (including the
previously allowed quantity field), binder movement and deletion stay available;
new item rows, identity replacement and game conversion remain gated.

Provider boundary
The browser supplies its current session bearer. The server verifies it with Auth
/user, then invokes the readiness RPC with the identical bearer and publishable
key. The verified user must match the fresh RPC subject. No user_metadata decision,
service-role authorization or client header can substitute for this check.
The normal exported handler ALWAYS refuses provider transport, even after successful
authorization. There is no R9 environment flag to unlock it. createMockHandler is
an explicit dependency-injection factory used only by isolated tests; no HTTP input
selects it. Real transport requires a separate reviewed live gate, shared atomic
global/user budgets, new tests and explicit operator authorization. Configuration
names for future auth integration are SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY;
no credentials are part of this package or obtained for R9.

Reproduction, disposable PG17 only
Use the exact base checkout and .github/ci/package-lock.json. Install the pinned
test dependencies; expose no ports externally and deny outbound test traffic.
PGHOST=127.0.0.1, PGUSER=postgres, PGDATABASE=postgres; PGPORT is the disposable port.
The native helper creates/destroys randomly named synthetic databases. Never point
these commands at a shared or real database. Existing R3 SQL is replayed solely to
reconstruct a fresh synthetic History72-equivalent schema, never on Real-Staging.

node tests/r9/author.mjs --native
node tests/r9/native.mjs --native
node tests/r9/catalog.mjs --native
node tests/r9/provider-test.cjs
node tests/tcg-i3-m6-r9-regression-test.mjs --native
node --test tests/tcg-i3-m6-collect-test.mjs tests/tcg-i3-m6-transport-test.mjs
node tests/tcg-i3-m6-vertical-browser-test.mjs

The authoring command derives literal inventories only in disposable databases,
then verifies independent reconstruction and identical candidate bytes. Old
generators and SQL are unchanged. The unchanged native M6 baseline remains a
separate 22-case run; the added candidate harness retains all 22 assertions and
changes only initialization and synthetic membership setup. UI/transport/browser
test fixtures add synthetic session tokens and explicit mock transport injection;
no old assertion is removed or weakened. Production CI configuration is unchanged.
This local result is not a publication/CI/real-apply/activation/merge/deploy approval.
