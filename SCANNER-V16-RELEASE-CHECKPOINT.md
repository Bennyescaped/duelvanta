# V16.25 release notes — 2026-09-11

Owner approved publication of Scanner V16 and integrated Admin controls.
COLLECT's scan button opens the direct V16 route with the selected binder.
Existing TRADE, BATTLE, PROFILE, branding and original V-logo are preserved.

## Controls and accounting

- Owner-only controls in admin.html: 50 raw / 10 slab requests per user per
  Berlin week; adjustable down to zero; on/off and EUR 25 per calendar month.
- Independent OpenAI ledger; no Ximilar credit budget or provider runtime.
- Named RPCs, private RLS tables, narrow grants, active/beta account checks,
  active Owner checks, audit log, server-authenticated atomic reservations.
- DV_OPENAI_ACCOUNTING_KEY is server-only. Owner stored it in Vercel
  Production/Preview; matching SHA-256 was provisioned separately in SQL.
  Never commit/log the key. Existing OPENAI_API_KEY covers both environments.
- Token cost includes cached input. Incomplete/invalid responses with usable
  usage settle their measured cost; otherwise the reservation remains.
- Each request holds EUR 0.50. Full 400k input context at $0.75/M plus bounded
  1400 output at $4.50/M costs <=$0.3063 before conversion. No tools or retries.
- Fixed valuation: 1 USD = 0.862664 EUR (ECB 2026-09-11, EUR/USD 1.1592),
  snapshotted per reservation. Estimates exclude tax and bank fees. This is an
  application budget, not a guaranteed cap on the full OpenAI account invoice.
- Ten documented pilot calls ($0.03083475) imported once at EUR 0.026601.
  Twenty legacy reservations lack reliable provider/cost metadata: shown as a
  history gap, not invented OpenAI charges. Weekly counts start with the new
  ledger; older unattributed requests are not deducted from new weekly quotas.
- Uncertain holds never auto-refund. Reconcile only against verified provider
  usage via privileged SQL in one transaction. Age alone is not proof of zero cost.

## Validation and rollout

Isolated PostgreSQL assertions cover private permissions, Owner/player/suspended
roles, RPC names, weekly/monthly accounting, currency conversion, duplicate
settlement and reapplication preserving settings and newer consumption.
Provider tests use synthetic calls and cover cached input, paid incomplete
responses, retained uncertain holds and deployment gates. The entry test checks
COLLECT routing and binder preservation. No paid scan or collection write in tests.

The additive migration and matching fingerprint are active. Owner RPC was
verified on the live database in a rolled-back transaction. No real account
or collection records were modified. Advisors flag intended no-direct-policy
INFO for private tables; other pre-existing findings are outside this release.

Public endpoints accept preview/scanner-v16 or production/main only.
Build production from merged main; do not promote a Preview artifact.
Rollback: turn OpenAI off in Admin or set the new policy enabled=false, then
restore the previous production deployment. Keep the ledger; never drop it.

Limitations: earlier costs cannot be completely reconstructed from retained
logs. The first physical iPhone scan after release confirms actual vendor-key
access and camera permissions; synthetic checks do not prove these.
The new ledger does not retroactively stop or account for older immutable
Preview deployments. Their old allowance remains until explicitly retired.

Sources: https://developers.openai.com/api/docs/models/gpt-5.4-mini
and https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html
