# DUELVANTA – Schritt 7B: Festpreis / Stripe TEST E2E

Ausführung: **24.09.2026, UTC**. Dateiname gemäß Auftrag/V48 beibehalten.

**Produktpfad PASS: normales Seller-Listing → normaler Buyer-Review → einmaliges Kaufangebot → echte Stripe TEST Checkout Session → B2C-Vertrag. Keine Zahlung. Gesamtabschluss 7B noch BLOCKIERT: der geforderte HTTP-Nachweis `stripe_sandbox_disabled` wird vom vorgeschalteten Vercel-Deployment-Schutz abgefangen. Nicht als vollständiges V48-PASS ausgeben.**

## Basis und Grenzen

V48, V47, abgeschlossener 7A-Bericht, V46 und STRIPE_CONNECT_SANDBOX_ACCEPTANCE.md vollständig gelesen. V48 überschreibt die historische Anleitung: kein neues Onboarding, keine Zahlung, kein Refund, keine Datenlöschung.

- Repository Bennyescaped/duelvanta, ausschließlich marketplace-ux-v1.
- Ausgangsremote: `4b9b8a24eef5e3ef8ce841112f8618a1062f8fbb`.
- Gegen V47 `24a419f7d77a9df022af8dbb48f61db27d9d5058`: genau ein Dokumentationscommit, ausschließlich V48 hinzugefügt.
- Technischer Code unverändert gegenüber `260f5f3133e354ae0dd1f875bb623714a77f3897`.
- main `50f88213571be13255bb52eb489cc28cca660001`, frisch unverändert; PR5 open, draft=true, merged=false.
- Staging `xhmjxrcskfhbovhitdej`. Production `enifiaqsnqtbzylnfrpi` nur Negativgrenze, nicht verbunden oder verändert.
- Beide vorhandenen lokalen Arbeitskopien auf marketplace-ux-v1 sauber inventarisiert; kein Reset, Force-Push oder Branchwechsel. Die ältere lokale Codebasis wurde nicht über Remote geschrieben. Veröffentlichung nur neuer Dokumente auf dem aktuellen Remote-Tree.
- Keine Code-/Schemaänderung, keine Migration, kein erneutes Aufrollen von Schritt6/7A, kein Schritt8.

## Konfiguration und Deployment-Evidenz

Vor Aktivierung: DB sandbox=false/live=false, Gebühren 0 BPS/0 Cent, policy stripe-connect-sandbox-v1. Readiness true/revision trade-legal-contract-model-v1.2. Bestehender TEST Connected Account ready, charges_enabled/payouts_enabled/details_submitted=true, live_mode=false. Kein neues Konto oder Onboarding.

Vercel Dashboard tatsächlich im Work-Browser geprüft: STRIPE_CONNECT_SANDBOX_ENABLED existiert ausschließlich für Preview / marketplace-ux-v1. Die fünf STRIPE_CONNECT_LIVE_* Schalter sind unter Project und Shared nicht vorhanden. COMPLIANCE_EMAIL_DELIVERY_ENABLED ist unter Project und Shared ebenfalls nicht vorhanden. Dies ist ein neuer Dashboard-Browsernachweis, kein Connector-Environment-API-Read. Keine Secret-Werte ausgelesen oder dokumentiert.

| Verwendung | Deployment | URL |
|---|---|---|
| Ausgangs-V48, OFF | dpl_FYSCjvykHoN3jB62dHDdevyYQ3iR | https://duelvantav5vision-dzkr7nhj4-bennyescaped-3783.vercel.app |
| Temporärer TEST-Lauf, ON | dpl_7c2kCjSj1nH86pwhA1Js9X1GPeZq | https://duelvantav5vision-1vhde1rta-bennyescaped-3783.vercel.app |
| Wiederhergestellte Preview, OFF | dpl_6XrAfoRTNhhN42BxExuP9sfQsvaU | https://duelvantav5vision-ocmzr0fg8-bennyescaped-3783.vercel.app |

Alle drei per Vercel-Connector READY, Commit 4b9b8a24eef5e3ef8ce841112f8618a1062f8fbb, marketplace-ux-v1, target=null. Finaler Branch-Alias zeigt auf das OFF-Deployment. Keine Production-Bereitstellung. Ein allgemeiner Redeploy-Dialog war initial auf Production voreingestellt; ohne Ausführung abgebrochen. Nur der gezielt geöffnete Branch-Preview-Dialog wurde ausgeführt.

Ausgangs-Runtime tatsächlich als preview / https://xhmjxrcskfhbovhitdej.supabase.co abgerufen. Beim neuen ON-Deployment wurde der separate Runtime-Abruf durch Vercel-SSO umgeleitet; ein Browser-Direktaufruf meldete ERR_BLOCKED_BY_CLIENT. Deshalb zunächst fail-safe DB OFF, dann Preview-Variable false gespeichert und OFF-Redeploy ausgeführt.

Fortsetzung im selben Block über den bereits vorgesehenen sichtbaren Diagnosemodus auf dem ON-Deployment: LIVE-LEGAL-DIAGNOSE v1.1, GESAMT PASS, Browser-Session PASS, Guard/RPC/Loader PASS, echte Readiness GET/true/revision1.2, vier private GETs HTTP406/PGRST106. Der vollständig geprüfte Resolver desselben Git-Heads erzwingt für preview ausschließlich Staging und verwirft abweichende SUPABASE_URL; die Diagnose wird nur bei runtime.environment=preview angezeigt. **Dies ist kombinierte Browser-/Code-Zielbindung, kein erfolgreicher separater HTTP-Runtime-Body-Abruf des ON-Deployments.** Reguläre Seller-Anmeldung und nachfolgende Datensätze wurden zusätzlich im Staging bestätigt.

Danach DB nochmals kurz ON; derselbe unveränderte ON-Deployment-URL wurde für den Produktpfad verwendet. Die gespeicherte Projektvariable und der Branch-Alias blieben dabei bereits OFF. Nach Erzeugung der TEST-Session DB sofort wieder OFF. Alte immutable Deployment-Artefakte werden durch eine Environment-Änderung nicht rückwirkend umgeschrieben; ON-URL nicht weiter für Aktionen verwenden. Keine Entfernung alter Deployments behauptet.

Zeitbelege: ON-Deployment erstellt 05:38:57.646 UTC, READY 05:39:08.500; OFF-Deployment erstellt 05:48:59.041, READY 05:49:09.218. DB ON erstmals um ca.05:36, Zwischen-OFF vor 05:48:58.724 read-only bestätigt; zweite DB-ON-Phase ca.05:50 bis unmittelbar nach Checkout 05:54:32. Spätestens 05:58:30.372 und nochmals 05:59:46.940 DB false/false read-only bestätigt. Die einzelnen Schaltzeitpunkte wurden nicht sekundengenau persistiert; keine erfundenen exakten Fenstergrenzen.

## Identitäten und erhaltene Testevidenz

| Objekt | ID |
|---|---|
| Normaler Trader | 2fe2dfab-2802-46ac-8c7b-2804eae2be8e |
| Normaler Buyer | e81841df-2b08-45c1-a2d7-2671f8c58f7d |
| Vorhandener TEST Connected Account | acct_1UFU7JDwFcjtFwoY |
| Listing | 4f8fa6ad-8c11-4df2-9283-795b252d5236 |
| Fixed-price Offer | a6582e51-8cb0-4eb3-8d62-6e701dafc446 |
| Checkout Request / Idempotency Key | 722c431d-8e58-4e23-9b62-0de51df0b295 |
| Deal | ddd5122f-c6ee-4840-80fd-584529436886 |
| Order | 90f5a50f-5fb6-4882-9572-2b359257dd9f |
| Ordernummer | DV-260924-000015 |
| Contract Snapshot | a4642a8f-3167-42c1-953b-eb3e9234b611 |
| Payment Attempt | af15faff-b883-4db5-ac56-3da50d902921 |
| Allocation | genau das Paar Attempt / Snapshot oben |

Stripe TEST Session: `cs_test_a1ggPuMidIoH67H38qmJIzrWdmiAa10TBNfxTS8MKTu83l4t3kl5FL7pFZ`.

Keine Credentials, Session-Tokens, Secret Keys oder vollständigen Checkout-URL-Fragmente in diesem Bericht.

## Browser-Produktpfad – PASS

Work Cloud Browser, kein TinyFish. Sichtbare Identitäten vor Aktionen: „Willkommen, verkaeufer.“ und „Willkommen, testKaeufer.“. Bestehende normale Konten, keine Owner-/Admin-Produktaktionen, keine Registrierung, kein Reset, kein Magic-Link.

Genau ein Listing über +VERKAUFEN → SEALED regulär veröffentlicht, 05:51:00.395131 UTC. Titel DV STEP7B SYNTHETIC FIXED PRICE TEST – DO NOT BUY, Set STEP7B-TEST, other/other, sale/fixed, Menge1, EUR2, parcel/EUR1. Vorhandene eindeutig synthetische Testgrafik aus7A für den Pflichtupload wiederverwendet; keine reale Produktfotografie oder Ware. Vor Kauf active/available1/stock1.

Buyer: JETZT KAUFEN → serverseitiger Review. Sichtbar B2C / gewerblicher Verkauf an Verbraucher, DUELVANTA STAGING TESTHÄNDLER STEP7A, korrektes Produkt, Menge1, Stückpreis/Warenwert EUR2, Paketversand EUR1, Gesamt EUR3. Vertragsschlusshinweis und exakter Button Zahlungspflichtig bestellen vor Klick dokumentiert. Genau einmal geklickt; keine doppelte Submission absichtlich ausgelöst.

Tatsächliche Weiterleitung zu checkout.stripe.com, cs_test_ Session, sichtbarer Sandbox-Badge und EUR3. Keine Kontakt-/Kartendaten eingegeben, kein Zahlungsbutton, keine Testzahlung und kein künstlicher Payment-Webhook. Stripe zeigt die vorhandene Account-Brandingbezeichnung „DUELVANTA Privatverkäufer“; dies ist eine bestehende Testaccount-Anzeigebezeichnung, nicht die rechtliche Trader-Klassifikation im DUELVANTA-Review/Snapshot. Nicht verändert; vor einer späteren realen Freigabe fachlich prüfen. Account-ID entspricht exakt dem in V48 vorgeschriebenen TEST Account.

## Datenbank-Vertragsnachweis – PASS

Offer um05:54:31.791511 erstellt; accepted um05:54:32. offer_type=fixed_price, consumer, korrekte Buyer-/Seller-/Listing-IDs. Checkout-Hash `a854642c973ff014ce59a348e781b52d8bc9105f649bfe40efaf45df8bbb22cd`. payment_live_mode_snapshot=false, vorgesehener TEST Account, Session-ID korrekt. reserved_quantity=0, reservation_expires_at=NULL: Reservation verbraucht.

Genau1 Deal/Order/Snapshot/Attempt/Allocation. Order stripe_connect/pending, paid_amount0, EUR2+1=3. Deal accepted, paid_atNULL. Snapshot checkout-contract-v2, trader/consumer/b2c, withdrawal_eligible=true, stripe_connect, Menge1, korrekt eingefrorene Seller- und Produktdaten, Versand/Preise EUR3; contract_formed_at05:54:32 UTC. Snapshot-Hash `dfbc9dd2fc3c3d5677e62a23d29637e038522491e3b5f419c81fdaf9196469d7`.

Attempt session_created, amount_due_cents300, platform_fee_cents0, seller_net_cents300, paid_cents0/refunded_cents0, keine Charge-/PaymentIntent-ID, paid_atNULL. Die Tabelle besitzt keine eigene live_mode-Spalte; TEST-Modus ist über Offer-Snapshot=false, Account=false und cs_test_ belegt, nicht durch eine erfundene Spalte. Servercode stripeMode prüft sk_test_-Präfix vor Auth/Providercall. Kein Key ausgelesen, angelegt oder ersetzt.

Allocation exakt Attempt/Snapshot, gross_cents300, fee0, refunded0, tax_event_idNULL.

Listing final reserved/quantity_available0/stock_quantity1, nicht mehr im aktiven Käufermarkt. Keine zusätzliche Bestandskorrektur oder Lifecycle-Aktion.

## Wiederöffnung / Dokument / E-Mail

Zurück zur normalen TRADE-Ansicht ohne Payment-Abschluss. BESTELLUNGEN zeigt genau1 DV-260924-000015 mit pending/EUR3 und „STRIPE-TESTZAHLUNG WIRD GEPRÜFT · Bitte nicht erneut starten“. BESTELLBESTÄTIGUNG öffnet genau1 checkout-contract-v2-Dokument mit gespeichertem SHA. Kein zweiter Checkoutbutton verwendet, kein Widerruf, Storno oder Adress-Update.

MARKT und BESTELLUNGEN erneut geöffnet; keine zweite Order, finale SQL-Dedupe um05:59:46.940: je1 Deal/Order/Snapshot/Attempt/Allocation für denselben Request. Kein zusätzlicher Provider-Replay nur zur Evidenzerzeugung. Echte Parallelität/Doppelklickfälle bleiben beim bestehenden CI-Nachweis, nicht als neuer Live-Doppelklicktest ausgegeben.

Outbox genau1 order_confirmation: a4c6af4e-76b3-4578-bba7-99775b5b052a, dedupe_key order_confirmation:a4642a8f-3167-42c1-953b-eb3e9234b611. pending, attempts0, sent_at/delivered_at/provider_message_idNULL. E-Mail unset im Dashboard; kein Versand/Dispatch-Test. Zugehörige normale Produkt-Nebenobjekte sind kein zusätzlicher wirtschaftlicher Testfall.

## Vorher / nachher

| Kernobjekt | Vorher frisch | Nachher 05:58:30 UTC |
|---|---:|---:|
| Listings |15|16|
| Offers |3|4|
| Deals |9|10|
| Orders |7|8|
| Snapshots |9|10|
| Withdrawal drafts |0|0|
| Withdrawals |1|1|
| Payment attempts |2|3|

Payment allocations final3, davon genau1 für7B; kein separater globaler Allocation-Zähler vor Beginn erfasst. Keine Feld-für-Feld-Unverändertheitsprüfung aller fremden Tabellen behauptet. Vorhandene7A-Evidenz nicht bearbeitet oder gelöscht.

Migration History unverändert 20260923081953/trade_legal_contract_model_v1. Readiness weiterhin true/revision trade-legal-contract-model-v1.2.

## Finaler OFF-Nachweis und offene Grenze

| Prüfung | Ergebnis |
|---|---|
| DB sandbox_enabled=false/live_mode=false nach Test | PASS, mehrfach read-only |
| Preview/marketplace-ux-v1 Variable false gespeichert | PASS, Vercel success bestätigt |
| Neues OFF-Preview READY, gleicher Branch/Head, target=null | PASS |
| Live-Schalter Project/Shared unset, keine Änderung | PASS |
| Anwendungsantwort stripe_sandbox_disabled vor Auth/Provider | **BLOCKIERT** |

Ein unauthentisierter POST `{}` auf /api/market-stripe-checkout des OFF-Deployments erhielt HTTP401 „Protected deployment“ von Vercel. Er erreichte die Anwendung nicht. Connector-GETs/temporärer Share-Zugang lieferten für geschützte API-Routen SSO-Redirects statt Runtime-Antworten. Kein Schutz abgeschaltet, keine Browsercookies/Tokens extrahiert, kein eigener Admin-/Service-Role-Browserclient. Quellcode/CI und gespeicherter OFF-Wert ersetzen den geforderten tatsächlichen HTTP-OFF-Nachweis nicht.

Dies ist eine verbleibende Zugangs-/Nachweisgrenze, kein beobachteter Vertrags-/Payment-Produktfehler und kein erfundener V48-HARD-STOP-Sicherheitsbefund. Für die letzte Probe ist ein geeigneter autorisierter HTTP-Zugang zum geschützten OFF-Preview nötig. **Kein neues Listing, Kaufangebot, Vertrag oder Sandbox-ON dafür nötig.** Ohne diese Probe kein vollständiges7B-PASS und kein Schritt8.

Keine Codeänderung: keine neue technische CI erforderlich; vorhandene technische CI nicht als7B-Live-Test umetikettiert. Nur Dokumentation veröffentlicht. main/Production unverändert, PR5 Draft/unmerged. Keine reale Zahlung, keine Testzahlung, keine Refunds/Payouts/Widerrufe/Compliance-E-Mails, keine erneute Migration.

**V49 ist ein ehrlicher Teilabschluss mit sicher zurückgesetzter aktueller Konfiguration, keine Freigabe. Danach STOP.**
