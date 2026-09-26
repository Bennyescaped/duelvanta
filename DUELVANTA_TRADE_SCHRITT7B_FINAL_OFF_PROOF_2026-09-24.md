# DUELVANTA – Schritt 7B: finaler Stripe-Sandbox-OFF-Nachweis

24.09.2026. **PASS: Der in V49 noch blockierte abschließende HTTP-OFF-Nachweis ist geschlossen. Schritt 7B ist damit vollständig bestanden.**

## Ausgangslage

V49 dokumentierte bereits den erfolgreichen positiven Festpreis-/Stripe-TEST-Produktpfad:

- synthetisches Festpreislisting
- normaler Buyer-Review
- einmal „Zahlungspflichtig bestellen“
- echte Stripe TEST Checkout Session
- genau ein Deal, eine Order, ein Contract Snapshot, ein Payment Attempt und eine Allocation
- keine Zahlung
- kein Refund
- kein Payout
- keine E-Mail
- Sandbox anschließend in DB und Preview wieder OFF

V49 blieb ausschließlich deshalb BLOCKIERT, weil ein direkter POST auf die geschützte OFF-Preview von Vercel mit HTTP401 abgefangen wurde und die Anwendung nicht erreichte.

## Technische Lösung

Technischer Ausgangshead V49:
`90b92d4d1ca41638447a9b6398fbd395b2f14a71`

Finaler technischer Head:
`ca6c04557e8f80fb558e961e5c4e13c0542b5db6`

Die Lösung verwendet keinen zusätzlichen Serverless-Function-Slot.

Der erste Entwurf mit separatem Proof-Endpunkt überschritt auf Vercel Hobby die Grenze von 12 Serverless Functions und wurde vollständig entfernt.

Final implementiert ist eine **preview-only GET-Diagnose im bereits vorhandenen**
`/api/market-stripe-checkout`-Handler:

`GET /api/market-stripe-checkout?off_probe=1`

Eigenschaften:

- nur bei `VERCEL_ENV=preview`
- in Production: 404
- verwendet direkt dieselbe `stripeMode('payments')`-Logik wie der reale Checkout
- kein Authorization-Header
- kein Buyer-Token
- kein Supabase-Auth-Aufruf
- kein Stripe-Providercall
- keine Mutation
- PASS ausschließlich wenn die echte Anwendung `stripe_sandbox_disabled` feststellt
- wenn Sandbox aktiv wäre, liefert die Probe FAIL und führt trotzdem keinen Providercall aus

Der normale POST-Checkoutpfad wurde in seiner Produktsemantik nicht verändert.

## CI

Finaler technischer Head `ca6c04557e8f80fb558e961e5c4e13c0542b5db6`:

- Scanner V16 #709 – Run `35968208896` – SUCCESS
- Battle WebRTC #185 – Run `35968208856` – SUCCESS

Neue Regression:

`tests/market-stripe-off-proof-api-test.mjs`

belegt:

- Preview + Sandbox OFF → PASS / `stripe_sandbox_disabled`
- Preview + Sandbox ON → FAIL ohne Auth-/Providercall
- Production → Diagnose nicht verfügbar
- normaler GET ohne Diagnoseparameter bleibt `method_not_allowed`

Zusätzlich blieb die zuvor ergänzte Browserdiagnose regressionsgesichert.

## Echtes Vercel-Deployment

Finales READY Preview:

- Deployment: `dpl_9AeELHwqnbgnKwyahAkCKdFbTCPu`
- Commit: `ca6c04557e8f80fb558e961e5c4e13c0542b5db6`
- Branch: `marketplace-ux-v1`
- target: null
- URL: `https://duelvantav5vision-8ua5nhyvd-bennyescaped-3783.vercel.app`

Der autorisierte Vercel-Connector rief auf diesem geschützten Deployment direkt auf:

`GET /api/market-stripe-checkout?off_probe=1`

Tatsächliche Antwort:

- HTTP 200
- `status = pass`
- `error = stripe_sandbox_disabled`
- `provider_call_possible = false`

Damit ist der zuvor fehlende echte Anwendungskanten-Nachweis erbracht. Der Vercel-Schutz wurde nicht abgeschaltet.

## Finaler Staging-Zustand

Staging:
`xhmjxrcskfhbovhitdej`

Frisch read-only bestätigt:

- `sandbox_enabled=false`
- `live_mode=false`
- Readiness `compatible=true`
- Revision `trade-legal-contract-model-v1.2`

Kernzähler:

- Listings 16
- Offers 4
- Deals 10
- Orders 8
- Contract snapshots 10
- Withdrawals 1
- Payment attempts 3
- Payment allocations 3

Dies entspricht den in 7A/7B erhaltenen synthetischen Testevidenzen.

Keine erneute Migration.

## 7B-Produktnachweis aus V49

Erhaltene 7B-Evidenz:

- Trader: `2fe2dfab-2802-46ac-8c7b-2804eae2be8e`
- Buyer: `e81841df-2b08-45c1-a2d7-2671f8c58f7d`
- TEST Connected Account: `acct_1UFU7JDwFcjtFwoY`
- Listing: `4f8fa6ad-8c11-4df2-9283-795b252d5236`
- Fixed-price Offer: `a6582e51-8cb0-4eb3-8d62-6e701dafc446`
- Checkout Request: `722c431d-8e58-4e23-9b62-0de51df0b295`
- Deal: `ddd5122f-c6ee-4840-80fd-584529436886`
- Order: `90f5a50f-5fb6-4882-9572-2b359257dd9f`
- Ordernummer: `DV-260924-000015`
- Contract Snapshot: `a4642a8f-3167-42c1-953b-eb3e9234b611`
- Payment Attempt: `af15faff-b883-4db5-ac56-3da50d902921`
- Stripe TEST Session: `cs_test_a1ggPuMidIoH67H38qmJIzrWdmiAa10TBNfxTS8MKTu83l4t3kl5FL7pFZ`

Keine Zahlung wurde abgeschlossen. TEST Checkout Session bleibt unbezahlt.

## Git-/Production-Grenzen

- `main` unverändert:
  `50f88213571be13255bb52eb489cc28cca660001`
- PR #5 offen, Draft, unmerged
- Production nicht verändert
- Stripe Live nie aktiviert
- keine echten Payments
- keine Refunds
- keine Payouts
- keine Compliance-E-Mails

## Abschluss

**Schritt 7B – positiver Festpreis-/Stripe-Sandbox-E2E inklusive vollständigem Sandbox-OFF-Nachweis: PASS.**

V49 bleibt historische Evidenz des vorübergehend BLOCKIERTEN Abschlussnachweises.

Dieser Abschluss ist keine Production-, Rechts-, Merge-, Stripe-Live- oder kommerzielle Freigabe.

Nächster möglicher Block ist ausschließlich nach separater Autorisierung:

**Schritt 8 – Production Readiness Preflight.**
