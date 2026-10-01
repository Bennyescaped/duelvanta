# Schritt 7A – BLOCKIERT vor Listing-Erstellung

23.09.2026. Verbindlicher Auftrag V44. Schritt 6 bleibt nach V43 abgeschlossen. Kein neuer Codefehler im Preisangebots-/Widerrufspfad behauptet: Diese Pfade wurden noch nicht erreicht.

## Basis

- Ausgangsremote: `12c8652d359cbcbe100123b6d826163de46bd7c7`, marketplace-ux-v1.
- Gegen V43-Head `0cc9a6f2e83737deb7b6e15181c085e49817086e` genau ein zusätzlicher Commit, ausschließlich V44 hinzugefügt.
- main: `50f88213571be13255bb52eb489cc28cca660001`, unverändert; PR5 offen, Draft, unmerged.
- Staging: `xhmjxrcskfhbovhitdej`; Production `enifiaqsnqtbzylnfrpi` ausschließlich Negativgrenze, nicht verbunden.
- Bestehendes READY-Deployment `dpl_GRZaur1M6n6Hf2h2Mcw6npTWrLLy`, technischer Head `260f5f3133e354ae0dd1f875bb623714a77f3897`; spätere Commits nur Dokumentation.
- Preview: https://duelvantav5vision-8bv09tebl-bennyescaped-3783.vercel.app
- V43 und Abschlussnachweis vollständig gelesen; V44 vollständig aus Branch gelesen. Saubere lokale Arbeitskopie inventarisiert, Fetch ohne Reset/Branchwechsel. Veröffentlichung nur der zwei neuen Dokumente auf aktuellem Remote-Tree; ältere lokale Codekopie nicht über Remote geschrieben.

## Preflight und verwendete Identitäten

Staging read-only am 23.09.2026 12:28:43 UTC: PostgreSQL17.6, Readiness compatible=true/revision=trade-legal-contract-model-v1.2. Migration History `20260923081953 / trade_legal_contract_model_v1`. Stripe sandbox_enabled=false/live_mode=false. Work Cloud Browser, kein TinyFish.

Vorhandene Buyer-ID `e81841df-2b08-45c1-a2d7-2671f8c58f7d`, test-kaeufer@duelvanta.de, normale Rolle player/beta. Anfängliche Browseransicht zeigte testKaeufer; kein Angebot abgegeben.

Wiederverwendeter synthetischer Seller `2fe2dfab-2802-46ac-8c7b-2804eae2be8e`, test-verkaeufer@duelvanta.de, player/beta, ursprünglich private/active. Anmeldung über sichere Work-Anmeldung erfolgreich, Profil im Browser bestätigt. Keine Owner-/Admin-Ersatzrolle. Keine neuen Authkonten, kein Reset/Magic-Link, keine Credentials dokumentiert.

Ältere aktive Trader-Fixture `7b2c0000-0000-4000-8000-000000000001` besitzt keine konfigurierte Passwortanmeldung; keine Session dafür verfügbar, kein Passwort gesetzt, nicht als Browser-E2E-Ersatz ausgegeben.

## Tatsächlich vorgenommene Änderungen

Der native Bestätigungsdialog beim Verkäuferartwechsel blockierte zunächst die Browsersteuerung. Nutzer bestätigte den Wechsel selbst über autorisierten Staging-Link. Danach DB trader/draft, updated_at 12:40:12.941415 UTC. Neue Work-Ansicht stellte den regulären Zugang wieder her.

Im vorhandenen Seller-Onboarding wurden ausschließlich synthetische Angaben gespeichert:

- Geschäftsbezeichnung DUELVANTA STAGING TESTHÄNDLER STEP7A
- Name DUELVANTA Staging / Test Trader STEP7A
- Rechtsform Einzelunternehmen
- Öffentliche E-Mail dv-step7a-trader@invalid.example
- Telefon +49 000 0000000
- Vorhandene Testanschrift mit Zusatz SYNTHETIC STAGING TEST STEP7A – KEINE ZUSTELLUNG

Automatische Freigabeprüfung stoppte zunächst die Verkäufererklärungen. Nach ausdrücklicher Nutzerbestätigung wurden die drei Erklärungen im Browser bestätigt und „Grunddaten zur Prüfung senden“ einmal erfolgreich ausgeführt. Reguläre Pfade save_my_market_seller_legal_profile und submit_my_market_seller_onboarding; keine direkte SQL-Mutation. Sichtbares Ergebnis: PRÜFUNG AUSSTEHEND / Grunddaten wurden zur Prüfung eingereicht. DB bestätigt trader/pending_review und die synthetische Geschäftsbezeichnung.

## Blocker S7A-B01: Voraussetzung für Händlerfreigabe fehlt

Live read-only bestätigt:

- marketplace_compliance_policy.tax_identifier_required_for_activation=true
- Für den Testverkäufer kein tin/vat_id in seller_tax_identifiers vorhanden; nur Existenz geprüft, keine Steuerwerte gelesen.
- review_market_seller_onboarding verlangt einen echten Owner-Aufrufer und für approve einen solchen Steueridentifikator; andernfalls seller_tax_identifier_required.
- Das sichtbare Onboarding kündigt einen getrennten verschlüsselten Erfassungsschritt lediglich an. Es bietet dafür kein Eingabefeld.
- Am aktuellen Remote-Head kein Schreibpfad für seller_tax_identifiers in API-/JavaScript-Dateien gefunden. Live-Funktionen mit Tabellenreferenz sind Readiness, Tax-Export, Verkäuferreview, Datenexport, Löschverarbeitung und Review-Liste; kein Erfassungs-RPC.

Keine Freigabeprobe mutierend ausgeführt. Kein Steueridentifikator erfunden oder als Platzhalter direkt eingefügt. Kein Owner-Aufrufer simuliert. Keine Steuerpflicht-Policy abgeschaltet. Kein direct UPDATE auf active. Kein spontaner Fix im Live-E2E-Block.

## Ergebnis je Phase

Preflight PASS für Git/DB/Stripe; Preview READY und reguläre Anmeldung/Onboarding nutzbar. Separater Runtime-Konfigurationsaufruf wurde durch den Browser blockiert; kein neuer direkt gelesener Runtime-Konfigurationsnachweis behauptet. Vorhandene Preview-/Staging-Bindung stammt zusätzlich aus V43 und dem unveränderten technischen Deployment.

Testidentität und Einreichung PASS. Händlerfreigabe BLOCKIERT S7A-B01. Listing, Angebot, Review, Annahme, Vertrag, Dokument, Widerruf, Outbox-/Hash-/Replay-Nachweis sämtlich BLOCKIERT/nicht begonnen. Keine IDs für nicht erzeugte Objekte erfinden.

| Objekt | Vorher 12:28:43 UTC | Nachher 12:45:55 UTC |
|---|---:|---:|
| Listings | 14 | 14 |
| Offers | 2 | 2 |
| Deals | 8 | 8 |
| Orders | 6 | 6 |
| Contract snapshots | 8 | 8 |
| Withdrawal drafts | 0 | 0 |
| Withdrawals | 0 | 0 |
| Payment attempts | 2 | 2 |

Readiness, Stripe OFF und Migration History nachher identisch. Die unveränderten acht Zahlen bedeuten ausdrücklich nicht „keine DB-Änderung“: Verkäuferart, Legal-Profile und Onboarding-Erklärungen/Audit wurden regulär geändert. Diese synthetische Fixture bleibt pending_review auf Staging erhalten. Vorhandene Vertragssnapshots wurden nicht geändert oder gelöscht.

E-Mail unset nach manuellem Nutzer-Nachweis im Vercel-Dashboard aus V43; kein frischer API-Nachweis behauptet. Kein Versand/Dispatch-Secret, keine Stripe API/Checkout/Payment/Refund/Payout, kein Widerruf oder wirtschaftlicher Testvertrag. Keine Migration/Schemaänderung, Production unverändert. Keine Codeänderung und keine neue technische CI erforderlich; alte CI nicht als 7A-Live-PASS ausgegeben.

## Separater Folgeauftrag – noch nicht ausgeführt

Zuerst einen vorgesehenen sicheren Weg für die verschlüsselte Steueridentifikator-Erfassung und reguläre Owner-Freigabe der synthetischen Trader-Fixture klären. Keine globale Lockerung, Klartext-/Dummy-Ciphertext-Einträge oder Rollen-Impersonation. Falls Implementierung nötig: separater Fixblock mit vollständiger Scanner-/Battle-CI, Auswirkungen auf Readiness/Katalog ausdrücklich prüfen; kein stiller Schemawechsel. Danach erneuter begrenzter 7A-Preflight, vorhandene Fixture wiederverwenden, erst nach active genau ein synthetisches Listing erstellen.

Schritt 7A nicht bestanden. Schritt 7B nicht freigegeben und nicht begonnen. Keine Produktions-, Rechts-, Stripe-Live- oder kommerzielle Freigabe. STOP.
