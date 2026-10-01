# DUELVANTA – MASTERHANDOUT V38

Stand: 23.09.2026 · ausschließlich marketplace-ux-v1.

**S6-A03 technisch geschlossen. Vollständige verpflichtende Scanner-/Battle-CI erfolgreich, echte PostgreSQL-17-Readiness bestätigt. Live-E-Mail-OFF weiterhin BLOCKIERT. Keine Legal-Migration auf Staging angewandt. Nach V38 STOP.**

## 1. Verbindlicher Status

V38 ersetzt V37 beim aktuellen Fix-/Kandidatenstatus. V37 bleibt der historische Befund des vor Migration gestoppten Preflights. V36 bleibt der Nachweis von S6-A01 (Reservationen) und der Implementierung S6-A02 (echte Readiness). Schritte 1–5 samt bisherigen offenen Integrationsgrenzen gelten fort. Keine Live-Kompatibilität oder Post-Migrationsabnahme aus isolierter CI ableiten.

| Bezug | Wert |
|---|---|
| Repository / einziger Entwicklungsbranch | Bennyescaped/duelvanta / marketplace-ux-v1 |
| Ausgangs-Remote-Head | de7a121f01560d372fe12553a0f6acdad6ef1b36 |
| bisheriger technischer Head | b89cecc22e7eb2eb80716078a29584f383dd653e |
| neuer finaler technischer Head | 91bad0f6546d579f4d8adc99f26027e45a36e891 |
| unveränderter main | 50f88213571be13255bb52eb489cc28cca660001 |
| Staging | xhmjxrcskfhbovhitdej |
| Production, ausschließlich Negativgrenze | enifiaqsnqtbzylnfrpi |
| PR #5 | open, Draft, unmerged |

Dieses Handout und der Fixbericht werden anschließend ausschließlich als Dokumentation/Evidenz veröffentlicht. Veröffentlichungshead separat im Abschluss; vor Fortsetzung Remote neu prüfen. Arbeitskopien und lokale Änderungen inventarisiert/gesichert; kein Reset, Force-Push, Branchwechsel oder Verlust fremder Arbeit.

## 2. S6-A03: Ursache und geprüfte Lösung

Alle zwölf zusätzlichen Live-Indizes fachlich zugeordnet: zehn aus versionierten Seller-/Notice-/Data-rights-SQL-Dateien; beide Profile-Indizes bereits im geprüften Basisschema-Backup vom 11.09.2026 enthalten. Exakte Definitionen/UNIQUE/Expression/Predicate und Quellen in `tests/fixtures/legal-readiness/index-provenance.json`. Ursprünglicher Ersteller/Erstellungszeitpunkt der Profile-Indizes nicht behauptet; früheste belegte Präsenz das historische Backup. Keine Nutzerdaten kopiert, keine Production-Verbindung.

Die datenfreie Fixture enthält nun alle zwölf relevanten eigenständigen Basisindizes und die für neue postgres-Objekte in public geltenden Default Privileges, einschließlich direktem EXECUTE für anon/authenticated/service_role. Existierende ACLs bleiben getrennt rekonstruiert. Keine globale Live-Änderung der Defaults.

Sechs neue Käufer-RPCs sowie Readiness entziehen PUBLIC/anon/authenticated/service_role zunächst explizit alle Rechte und geben ausschließlich authenticated EXECUTE. Owner postgres bleibt bestehen. Service-only Release/Accept behalten ihre vorgesehenen Backendrechte. Geschäftskörper, Reservationen und Vertragsmodell unverändert.

Readiness-Soll ausschließlich offline aus geprüfter versionierter Fixture plus Kandidat erzeugt. Neun Tabellenfingerprints ändern sich; endgültige Funktionsrechte entsprechen dem bereits vorgesehenen Soll. Kein Dummy, Marker, Live-Hashimport oder Bypass. Revision bleibt `trade-legal-contract-model-v1.2`, Guard 1.2, weiterhin fail-closed.

## 3. Ausschließlich aktueller Kandidat

`supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql`

- Git-Blob: `c7b5df68a6d4dd37804e0efd59f9a076957b3dc8`.
- SHA256: `c7d061943629d692ada147ba27c9909105507929756deacc6a3a8cedb259b5c6`.
- Nativer Katalog-SHA256: `f8e0e4cf5e000d60776a26e5bbd5275318fde632d8e3f55c5bd9a6cf42a33604`.

V36/V37-Kandidat mit SHA256 `a02e01bba93bda7e942850e776410fae1d752edb629b80319d9970859270d25f` ist abgelöst. Der V35-Kandidat bleibt ebenfalls gesperrt. Unmittelbar vor einer später autorisierten DB-Mutation neuen Kandidaten selbst vollständig prüfen und hashen. In diesem Block keinerlei Migration autorisiert oder ausgeführt.

## 4. Vollständige technische CI

Auf technischem Head `91bad0f6546d579f4d8adc99f26027e45a36e891`:

- Scanner V16 #685, Run **35832063879**, SUCCESS. Jobs validate **107086740073**, quota_database **107086740309**, collect_f3_database **107086740344**, alle SUCCESS.
- Battle WebRTC #161, Run **35832063873**, SUCCESS. Jobs spectator_database **107086740010**, battle_webrtc **107086740251**, beide SUCCESS.
- GitHub PR-Mergecheckout **ff6ae94f361079969f886577d403c9ec35904721**, kein Merge nach main.
- Native Readiness PostgreSQL **17.11**, **109 Checks PASS**; alle zwölf Indizes, Defaults, explizite Grants, Revision und Katalog geprüft. Vollständige Basis + Kandidat true; fehlende/zusätzliche Indizes, Rollenrechte, Body/Owner/Signatur, Constraints, Trigger, RLS, private Rechte, Offer-Policy und Teilzustand false.
- Generator `--check` PASS: 64 Tabellen, 201 Funktionsnamen, 266 Checks. Guard 42 Assertions PASS. Schritt 1–5, PG17-Reservation/Parallelität, Withdrawal PG17, Chromium Guard/Loader/Order/Withdrawal, Data Rights/Retention, Stripe Default-Off/API-/Recovery-Mocks und COLLECT/BATTLE-Regressionen PASS.
- Keine Tests abgeschaltet oder gelockert. Zwei unverändert bedingte externe Scanner-Schritte skipped; Pflichtjobs vollständig grün. Einzelheiten und Grenzen im Fixbericht.

Evidenz `evidence/legal-step6-catalog-fix-20260923/`, einschließlich heruntergeladenem nativen Readiness-Artefakt (ID 10737417157, ZIP-Digest selbst verifiziert). Diese CI ist ein isolierter technischer Nachweis, kein Live-Migrationsnachweis.

## 5. Live-E-Mail-OFF weiterhin BLOCKIERT

Tatsächlicher Wert von `COMPLIANCE_EMAIL_DELIVERY_ENABLED` nicht lesbar; **weder false noch unset nachgewiesen**. Verfügbare read-only Vercel-Projektmetadaten enthalten keine Environment-Werte, Dashboard-Zugriff führt zur Anmeldung. Keine POST-Probe, kein Dispatch-Secret, keine echte E-Mail, keine Konfigurationsänderung. Vor späterer Migration muss read-only false oder unset nachgewiesen sein; true bedeutet STOP.

## 6. Live-Migration bleibt separat

Staging PostgreSQL 17.6 für Index-/Default-Privilege-Prüfung ausschließlich read-only verwendet. Neue Readiness-RPC live weiterhin nicht vorhanden. Keine Änderung von Live-Indizes, Grants, Defaults, Beständen, Offers, Deals oder Orders. Keine positive echte Staging-Readiness oder angemeldete Post-Migrationsintegration behauptet.

V37-Befunde zu Altreservationen, Cleanup, Stripe-OFF und Preview-Routing sind historische Evidenz und vor einer späteren Migration frisch zu prüfen. Keine Testkäufe/-Deals/-Widerrufe erzeugen. Fehlende sichere Testzustände weiterhin BLOCKIERT dokumentieren. Kein zweiter vertragsschließender Checkout; Festpreis bleibt snapshot-/reservationgebunden; Widerruf nur berechtigter B2C-Snapshot ohne automatischen Refund/Storno.

main unverändert, Production durch diesen Block unverändert und nicht verbunden, PR #5 offen/Draft/unmerged. Kein Production-Deploy, keine Stripe-Live-Aktivierung, echten Payments/Refunds/Payouts oder Compliance-E-Mails. Keine Produktions-, Rechts- oder kommerzielle Freigabe.

## 7. Nächster autorisierbarer Block und STOP

**Nach V38 STOP.** Erst ein weiterer ausdrücklich autorisierter Live-Preflight darf den neuen Kandidaten gegen Staging prüfen. Er muss den tatsächlichen E-Mail-OFF-Wert, Zielbindung, Katalog/Grants/Policies, Altreservationen, Cleanup, Stripe-OFF und fail-closed-Vorzustand frisch nachweisen. Nur vollständig konfliktfreies PASS kann Grundlage einer separat autorisierten Staging-Migration sein. Dieser technische Fixauftrag erteilt keine solche Freigabe.

Referenzen: `DUELVANTA_LEGAL_SCHRITT6_CATALOG_READINESS_FIX_2026-09-23.md`, zugehörige Evidenz, V37/Staging-Bericht als historischer Preflight und V36/Blocker-Fixbericht für vorherige technische Abnahmen.
