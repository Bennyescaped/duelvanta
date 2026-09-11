# TRADE checkout + automation + shipping + resolution verification

## Scanner V16.9 mobile

The canonical branch-only scanner route is `scanner-v16.html`.
`scanner-v16-lab.html` only redirects to it; there is no iframe camera
boundary. The deterministic browser route
`scanner-v16.html?e2e=1` uses local scanner fixtures and cannot mutate
Supabase data.

Run all Scanner V16 contracts with:

```sh
for test in tests/scanner-v16-*-test.mjs; do node "$test"; done
```

The mobile runtime test covers photo decode, analysis start, recovery and
duplicate binding. The mobile route test covers the direct route, separate
native-camera/gallery inputs and Guided Benchmark completion wiring.

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

The local fixture also models the automation lifecycle without contacting Supabase:
unread notification badge, notification dialog/read state, direct order routing,
`AKTION ERFORDERLICH` for address and receipt, and removal of the receipt action
after completion.

## Static contract regressions

Run with plain Node.js:

```sh
node tests/trade-automation-contract-test.mjs
node tests/trade-shipping-contract-test.mjs
node tests/trade-resolution-contract-test.mjs
```

The automation contract checks notification event kinds, required-action types,
trigger/RPC wiring, RPC-only notification storage, accepted-offer-to-order linking,
hardened SECURITY DEFINER search paths and reuse of the existing Supabase client.

The shipping contract checks private default-address isolation, seller shipping-profile
RPCs, RLS/direct-grant closure, country/unit/weight tariff matching, automatic-vs-manual
fallback, the Sealed/All requirement for both unit and weight capacity, the address
snapshot wiring and reuse of the existing TRADE Supabase client.

The resolution contract checks order-level cancellation requests, cancellation shipping
locks, bounded inventory restoration, preservation of paused/withdrawn listings,
problem-vs-cancellation phase separation, participant RPC isolation, future provider
refund preparation and truthful `manual_beta` wording. None of these static tests
performs a network call.

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
checks checkout/automation/resolution RPC grants, internal helper isolation, RPC-only
sensitive tables, RLS, private storage, authentication guards, inventory invariants,
shipping-rule safety, cancellation phase guards and checkout request uniqueness. It
does not simulate an authenticated purchase or prove concurrent checkout execution.

## Applied migration sequence

Checkout hardening already applied to the existing DUELVANTA project:

1. `database/trade-checkout-v1.sql` — `trade_checkout_v1`
2. `database/trade-checkout-v1-hardening.sql` — `trade_checkout_v1_safety`
3. `database/trade-checkout-v1-validation.sql` — `trade_checkout_v1_validation`

Automation block applied afterwards:

4. `database/trade-automation-v1.sql` — `trade_notifications_actions_v1`
5. `database/trade-automation-v1-hardening.sql` — `trade_notifications_actions_v1_hardening`

Private default address + seller shipping-profile block:

6. `database/trade-shipping-profiles-v1.sql` — `trade_shipping_profiles_v1`
7. `database/trade-shipping-profiles-v1-hardening.sql` — `trade_shipping_profiles_v1_hardening`
8. `database/trade-shipping-profiles-v1-safety.sql` — `trade_shipping_profiles_v1_safety`

Order cancellation/problem/refund-preparation block:

9. `database/trade-order-resolution-v1.sql` — `trade_order_resolution_v1`
10. `database/trade-order-resolution-v1-hardening.sql` — `trade_order_resolution_v1_hardening`

Do not apply only an intermediate file or rerun these casually on production. Later
files harden earlier definitions. Existing transactions are not rewritten.

## Short real-account UX acceptance

Automated checks should handle most regressions. Use two ordinary non-staff test
accounts only for the human/mobile acceptance pass after a useful batch of changes:

1. Buyer stores a private standard address in PROFILE once.
2. Seller creates one real shipping profile/rule using an actual tariff the seller
   intends to charge; for Sealed/All, enter both max product count and max weight.
3. Seller creates a low-value fixed-price listing; buyer purchases. Verify the new
   shipping Order already contains the protected address snapshot without retyping it.
4. Add a second compatible item before shipping. If the seller's rule safely matches,
   Combined Shipping should show `AUTOMATISCH`; if limits are exceeded, it must fall
   back to `PRÜFUNG NÖTIG` instead of guessing a tariff.
5. Before shipping, request a cancellation from one account. Verify seller shipping is
   blocked, the other account sees `STORNO PRÜFEN`, and decline/withdraw lets the Order
   continue. In a separate low-value test, accept one cancellation and verify the Order
   becomes `STORNIERT` and available inventory is restored.
6. Complete a separate Order through shipping. After it is marked shipped, open a
   problem case. Verify receipt confirmation disappears, the other account can submit
   one statement, and no UI claims that DUELVANTA refunded money.
7. Withdraw that problem from the reporting account. The Order should return to
   `VERSANDT` and the buyer can confirm receipt normally.
8. Verify final receipt closes the Order and seller receives `ERHALT BESTÄTIGT`.
9. Separately make one negotiable offer; seller sees `ANGEBOT PRÜFEN`, accepts it,
   and buyer's acceptance notification opens the resulting Order directly. If that
   Order is later cancelled by agreement, the offer must display `STORNIERT`.

The purpose of this real pass is UX/mobile judgment, not database discovery. No
Stripe payment, payout or automatic refund/payment confirmation is enabled.
