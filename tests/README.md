# TRADE checkout verification

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

## Optional real-browser local test

```sh
node tests/trade-ui-server.mjs
```

Open `http://localhost:4173/`. The test server substitutes the Supabase library with
local fixtures and forbids remote connections using CSP. It does not send requests
to Supabase. Stop the server after testing.

On 2026-09-09, the connected browser could not access this local URL. The DOM tests
passed, but no successful browser/layout or real iPhone purchase test is claimed.

## Database smoke check

`trade-security-smoke.sql` performs read-only checks without an end-user JWT. It
checks API/helper grants, RLS, private storage, authentication guards, inventory
invariants and request uniqueness. It does not simulate an authenticated purchase
or prove concurrent checkout execution.

## Applied migration sequence

These additive updates require the existing DUELVANTA Sealed/Orders schema. They
were applied in order to the existing project using Supabase migrations:

1. `database/trade-checkout-v1.sql` — `trade_checkout_v1`
2. `database/trade-checkout-v1-hardening.sql` — `trade_checkout_v1_safety`
3. `database/trade-checkout-v1-validation.sql` — `trade_checkout_v1_validation`

Do not apply only the first file or rerun these on production. Later files replace
intermediate definitions and tighten entry points. Existing listings retain their
negotiable pricing mode; existing transactions are not rewritten.

## Remaining acceptance

On real accounts: create a fixed-price listing, buy quantity 3, inspect stock/order,
then ship and confirm receipt once. Check a negotiated offer with a visible price
difference. Before shipping mixed/multiple products, seller still confirms actual
combined postage because a reliable parcel-capacity/tariff model is not configured.
No Stripe payment, payout or automatic payment confirmation is enabled.
