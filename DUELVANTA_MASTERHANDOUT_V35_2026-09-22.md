# DUELVANTA – MASTERHANDOUT V35
Stand: **22.09.2026** · Entwicklungsbranch ausschließlich `marketplace-ux-v1`

**Schritt 6 wurde begonnen und in Phase A kontrolliert gestoppt. Ein kritischer Rollen-/RLS-Konflikt wurde lokal mit dem tatsächlichen Staging-Schema und dem exakten Kandidaten reproduziert. Keine Legal-Migration auf Staging angewandt, kein Migrationsteilzustand. Guard 1.1 bleibt unverändert geschlossen. Schritt 6 ist NICHT technisch abgeschlossen. Keine Rechts-, Migrations-, Staging-, Gesamt- oder Produktionsfreigabe.**

## 1. Verbindlichkeit
V35 ersetzt V34 für den aktuellen Fortsetzungsstatus. Die Detailberichte der Schritte 1–5 bleiben für ihren nachgewiesenen Umfang maßgeblich. Die neue Gesamtmigrationsprüfung ergänzt sie um den zuvor nicht abgedeckten RLS-/Grant-Befund; historische CI-PASS-Ergebnisse sind keine Gesamtmigrationsfreigabe.

Repository: Bennyescaped/duelvanta. PR #5 bleibt offen, Draft und unmerged.

## 2. Git- und Projektbasis
| Kennung | Bedeutung |
|---|---|
| `faf730970c4637f8109e27a56725a97a30d252be` | verifizierter Ausgangshead Schritt 6; unveränderter Runtime-Stand |
| `d71b72d96a214c8f18697fd31ac750092e213288` | letzter technischer Implementierungshead, Schritt 5 |
| `826eb4ad866974bcf682796bcdfd51746e3218fc` | Schritt 4 |
| `2cab1572eec0e8a83e423c8633dcb57fc14ffa2b` | Schritt 3 |
| `6ed31d7c9b9c9076968d5220bee236a21ca9cc3e` | Schritt 2 |
| `822f4b9b32b2d00806ab2c152cbd3d71c5fc688c` | Schritt 1 |
| `50f88213571be13255bb52eb489cc28cca660001` | unveränderter main |
| `xhmjxrcskfhbovhitdej` | ausschließlich DUELVANTA-STAGING, PostgreSQL 17 |
| `enifiaqsnqtbzylnfrpi` | Production, ausschließlich Negativgrenze |

Der V35-Commit enthält nur Dokumentation und diagnostische Evidenz. Der genaue neue Dokumentationshead ist über den Commit dieser Datei zu bestimmen; nicht mit einem neuen technischen Implementierungshead verwechseln.

## 3. Legal-Gesamtstatus
| Schritt | Status |
|---|---|
| 1 – Kompatibilitätsschutz | veröffentlicht, CI PASS, angemeldeter Read-only-Preview-Nachtest PASS |
| 2 – Privatkäuferzugang | technisch/CI PASS; Preview TEIL-PASS / REST BLOCKIERT mangels aktivem eingegangenen Angebot; kein dort beobachteter FAIL |
| 3 – Preisangebote | technisch und vollständige CI PASS im dokumentierten Umfang |
| 4 – Festpreis | technisch und CI/PG17-Parallelität PASS im dokumentierten Umfang; neuer Gesamtmigrations-Blocker S6-A01 betrifft Zusammenspiel mit bestehender Staging-DELETE-Policy |
| 5 – Widerruf | technisch und vollständige CI/PG17/Chromium PASS im dokumentierten Umfang |
| 6 – kontrollierte Staging-Gesamtmigration | **BLOCKIERT in Phase A; nicht angewandt und nicht abgeschlossen** |

## 4. Unveränderte Vertragsmodelle aus Schritten 2–5
Der vorhandene Privatkäuferzugang wird wiederverwendet. Keine zweite Käuferklassifikation; B2B/C2B bleiben außerhalb des Releases.

Preisangebot: verbindliches Käuferangebot auf eingefrorenem Vertragsreview; Vertrag bei Verkäuferannahme; kein zweiter vertragsschließender Checkout.

Festpreis: eingefrorener Review-/Betrags-/Seller-/Fulfillment-/Stripe-Modus-Snapshot; Vertrag erst mit Erstellung der Stripe-Zahlungsaufforderung. Unklare Provider-/DB-Ergebnisse bleiben fail-safe und wiederaufnehmbar. Isolierte PostgreSQL-17-Tests bestätigten bisher Replay-/Parallelitätssicherheit.

Widerruf: ausschließlich eigener konkreter B2C-Marketplace-Vertragssnapshot mit Händler, Consumer-Käufer, withdrawal_eligible=true und eingefrorener seller_party.public_email. C2C, fremde/nicht berechtigte Verträge und fehlender Händlerempfänger bleiben gesperrt. Genau eine Erklärung pro Vertragssnapshot, immutable evidence_snapshot + SHA256, deduplizierte Käufer-/Händler-Outbox. Kein automatischer Refund, Storno oder Payment-/Order-Statuswechsel. Eigener Export ergänzt; keine neue Retention-Frist.

## 5. Schritt-6-Blocker S6-A01 – Rollen-/RLS-Konflikt
Staging erlaubt authenticated per Tabellen-DELETE-Grant und Policy `offers_delete_buyer` das direkte Löschen eigener pending-Angebote. Die Policy unterscheidet nicht zwischen price und dem neu geplanten fixed_price.

Die Migration führt pending-Festpreisreservierungen mit reduziertem Bestand ein, ändert diese DELETE-Grenze jedoch nicht. Der einzige DELETE-Trigger prüft eine Kontosperre und stellt keinen Bestand wieder her.

Lokaler Nachweis mit datenfrei rekonstruiertem Staging-Anwendungsschema und exakter Gesamtmigration:
- authenticated-Käufer löscht eine synthetische pending/fixed_price-Reservierung: 1 Zeile gelöscht.
- Listing bleibt quantity_available=0 bei stock_quantity=1, status=reserved.
- expire_market_offer_reservations_v1 findet danach 0 Reservierungen.

**Kritischer, reproduzierter Migrationskompatibilitätsfehler. Kein echter Vorgang und keine Mutation auf Staging.** Kein improvisierter Datenbankfix durchgeführt.

Minimaler Korrekturansatz: bestehenden direkten Käufer-DELETE-Pfad auf pending/price begrenzen; fixed_price muss beim vorhandenen serverseitigen Release-/Expiry-Pfad bleiben. Rollen-/RLS- und Bestandsfreigabe-Regressionsnachweis erforderlich. Noch nicht implementiert.

## 6. Schritt-6-GAP S6-A02 – echte Readiness fehlt
Guard 1.1 fragt GET-only `get_my_market_buyer_profile()` ab. Diese Funktion fehlt auf Staging und wird vom Kandidaten nicht erzeugt. configured:Boolean plus schema_version aus einer künstlichen RPC wäre kein vollständiger Kompatibilitätsnachweis.

Minimaler ausgearbeiteter Ansatz: eine authentisierte schreibfreie Schema-Prüfung anhand realer Katalogobjekte und effektiver Rechte; vorhandenen Guard daran anbinden, nur tatsächliches compatible=true akzeptieren. RPC-Definitionen/Signaturen, Spalten, Constraints, Unique-Indizes, unveränderbare Evidenz, RLS und Rollen-/Grant-Grenzen einschließlich S6-A01 müssen geprüft sein. Fehler, Timeout und Teilzustand bleiben geschlossen.

Kein Dummy-RPC, kein pauschaler Marker und kein zusätzlicher Käuferstatus. Noch keine Readiness-Implementierung erstellt oder angewandt.

## 7. Unveränderter Kandidat
`supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql`
- Git-Blob: `42c75129a4bf982d8d010f1bbbdc35b7dd2d6fb3`
- SHA256: `18cc18efeb2c32db43fb20150157eab57164fe8d6ed469feb7bf5dbdd92d261e`
- Auf Staging **NICHT angewandt**.
- Lokale vollständige DDL-Rekonstruktion PASS; dies hebt den reproduzierten Grant-/RLS-FAIL nicht auf.

## 8. CI und Testgrenzen
Frisch bestätigt auf faf73097…:
- Scanner #674: Run 35772380293 SUCCESS. Jobs validate 106896981725, collect_f3_database 106896981857, quota_database 106896982107.
- Battle #150: Run 35772380304 SUCCESS. Jobs battle_webrtc 106896989254, spectator_database 106896989398.

Schritt-5-Basis auf d71b72d9…:
- Scanner #673: Run 35771766205 SUCCESS; Jobs 106894958533, 106894958900, 106894958686.
- Battle #149: Run 35771766294 SUCCESS; Jobs 106894958982, 106894959332.

Schritt 6 zusätzlich lokal: unveränderter Guard 42 Assertions PASS, Environment-Routing 18 ungültige Konfigurationen abgewehrt; diagnostische Löschkonflikt-Reproduktion bestätigt FAIL. Kein neuer nativer PostgreSQL-17-Parallelitätsnachweis und keine neue vollständige Schritt-6-Abschlussregression.

Phase B/C/D/E bleibt blockiert; kein angemeldeter Staging-Integrationstest nach Migration möglich. Der aktuelle Preview-Zugriff erreichte lediglich Vercel-SSO/401. Nicht als Anwendungs-Funktionstest werten.

## 9. Stripe, E-Mail und Sperren
- Staging DB frisch verifiziert: sandbox_enabled=false, live_mode=false, seller_invoice_issuance_enabled=false.
- E-Mail-Code unverändert default-off. V34 dokumentiert deaktivierte Zustellung; aktueller Deployment-Schalter in diesem Block wegen Preview-Zugriffsschutz **nicht unabhängig bestätigt**.
- Keine echten Payments, Refunds, Payouts, Compliance-E-Mails oder Marketplace-Testtransaktionen.
- main/Production durch diesen Block unverändert; keine Production-Abfrage, kein Merge, kein manueller Deploy.
- Keine Schutzmechanismen abgeschaltet; keine anderen Migrationen angewandt.
- Kein Reset, Force-Push oder Branchwechsel.
- COLLECT F1–F3/Mobile, BATTLE Spectator Media und Scanner-Release-Gate bleiben außerhalb des Blocks.

## 10. Fortsetzung
Zuerst V35 und `DUELVANTA_LEGAL_SCHRITT6_PREFLIGHT_2026-09-22.md` vollständig lesen; tatsächlichen Remote-Head und Arbeitskopien prüfen.

Den dokumentierten S6-A01-Konflikt gezielt am Repository-Kandidaten beheben und mit tatsächlichen Rollen/Policies testen. Danach die reale Readiness-Komponente umsetzen. Vollständige Scanner-/Battle-CI inklusive Step-1–5-, PG17-, Guard-/Loader-, Order-/Widerruf-, Datenrechte-/Retention- und Stripe-Default-Off-Tests erforderlich.

Vor jeder Staging-Mutation Phase A vollständig neu mit aktualisiertem Kandidatenhash durchführen. Den hier geprüften unveränderten Kandidaten nicht anwenden. Erst konfliktfreier Preflight erlaubt die kontrollierte Migration ausschließlich nach xhmjxrcskfhbovhitdej und die anschließenden Phasen C–F.

## 11. Referenzen
- `DUELVANTA_LEGAL_SCHRITT6_PREFLIGHT_2026-09-22.md`
- `evidence/legal-step6-preflight-20260922/`
- `DUELVANTA_LEGAL_SCHRITT5_WIDERRUF_2026-09-22.md`
- `DUELVANTA_LEGAL_SCHRITT4_FESTPREIS_2026-09-22.md`
- `DUELVANTA_LEGAL_SCHRITT3_PREISANGEBOTE_2026-09-22.md`
- `DUELVANTA_LEGAL_SCHRITT2_PRIVATKAEUFER_2026-09-22.md`
- `DUELVANTA_LEGAL_SCHRITT2_PREVIEW_NACHTEST_2026-09-22.md`
- `DUELVANTA_LEGAL_SCHRITT1_VEROEFFENTLICHUNG_CI_2026-09-22.md`
- `DUELVANTA_LEGAL_SCHRITT1_PREVIEW_NACHTEST_2026-09-22.md`
