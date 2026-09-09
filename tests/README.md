# TRADE checkout + automation verification

The fixtures in this directory are local in-memory responses, not Supabase users,
listings, deals or payments. Production HTML does not load them. Do not create real
test users or purchases to run these checks.

## Local DOM integration

Install `linkedom@0.18.12` into a temporary directory (no production dependency),
then run:

```sh
node tests/trade-dom-test.mjs /absolute/path/to/node_modules/linkedom/esm/index.js
```

The runner loads the existing TRADE page scripts against local fixtures. It models
dialog/select behavior and event capture. This is not a browser/layout test.
Assertions cover fixed vs negotiable checkout, editable quantity, tier pricing,
invalid quantities, duplicate clicks, network retry IDs, order quantity/unit price,
provisional shipping, single receipt/completion action, historical offer comparison
and HTML escaping.

The local fixture now also models the automation lifecycle without contacting
Supabase: unread notification badge, notification dialog/read state, direct order
routing, `AKTION ERFORDERLICH` for address and receipt, and removal of the receipt
action after completion.

## Automation contract regression

Run with plain Node.js:

```sh
node tests/trade-automation-contract-test.mjs
```

This static regression checks the production automation module and SQL for all five
notification event kinds, all required-action types, trigger/RPC wiring, RPC-only
notification storage, accepted-offer-to-order linking, hardened SECURITY DEFINER
search paths and reuse of the existing Supabase client. It performs no network call.

## Optional real-browser local test

```sh
node tests/trade-ui-server.mjs
```

Open `http://localhost:4173/`. The test server substitutes the Supabase library with
local fixtures and forbids remote connections using CSP. It does not send requests
to Supabase. Stop the server after testing.

On 2026-09-09, the connected browser available during the earlier checkout block
could not access this local URL. DOM/model tests must not be described as a real
browser/layout or real iPhone transaction test.

## Database smoke check

`trade-security-smoke.sql` performs read-only checks without an end-user JWT. It
checks checkout and automation RPC grants, internal helper isolation, RPC-only
notification storage, RLS, private storage, authentication guards, inventory
invariants and checkout request uniqueness. It does not simulate an authenticated
purchase or prove concurrent checkout execution.

## Applied migration sequence

Checkout hardening already applied to the existing DUELVANTA project:

1. `database/trade-checkout-v1.sql` — `trade_checkout_v1`
2. `database/trade-checkout-v1-hardening.sql` — `trade_checkout_v1_safety`
3. `database/trade-checkout-v1-validation.sql` — `trade_checkout_v1_validation`

Automation block already applied afterwards:

4. `database/trade-automation-v1.sql` — `trade_notifications_actions_v1`
5. `database/trade-automation-v1-hardening.sql` — `trade_notifications_actions_v1_hardening`

Do not apply only an intermediate file or rerun these casually on production. Later
files harden earlier definitions. Existing transactions are not rewritten.

## Short real-account UX acceptance

Automated checks should handle most regressions. Use two ordinary non-staff test
accounts only for the human/mobile acceptance pass:

1. Seller creates a low-value fixed-price listing; buyer purchases a small quantity.
2. Seller sees `NEUER KAUF`; buyer/seller see only the currently required action.
3. Add/verify shipping address and combined shipping when requested; seller ships.
4. Buyer sees `ORDER VERSENDET` + `ERHALT BESTÄTIGEN`; confirm receipt once.
5. Verify the action disappears and the seller receives `ERHALT BESTÄTIGT`.
6. Separately make one negotiable offer; seller sees `ANGEBOT PRÜFEN`, accepts it,
   and buyer's acceptance notification opens the resulting Order directly.

The purpose of this real pass is UX/mobile judgment, not database discovery. No
Stripe payment, payout or automatic payment confirmation is enabled.
