# DUELVANTA – MASTERHANDOUT V36
Stand: **22.09.2026** · Entwicklungsbranch ausschließlich `marketplace-ux-v1`

**Der technische Fixblock für die beiden Schritt-6-Preflight-Blocker ist abgeschlossen: Reservierungs-/Löschgrenzen korrigiert, echte kataloggestützte Readiness implementiert, vollständige Scanner-/Battle-CI PASS. Die Legal-Gesamtmigration wurde weiterhin NICHT auf Staging angewandt. Schritt 6 als Staging-Migration ist NICHT abgeschlossen. STOP vor jeder Datenbankmutation; erst ein separater Folgeauftrag erlaubt einen neuen kontrollierten Migrations-Preflight. Keine Rechts- oder Produktionsfreigabe.**

## 1. Verbindlichkeit und Git-Basis

V36 ersetzt V35 für den aktuellen Fortsetzungsstatus. Die Schritte 1–5 und ihre Detailberichte bleiben für den dokumentierten Umfang gültig. V35 bleibt historischer Nachweis des bewusst gestoppten Preflights; seine Aussagen „Fix noch nicht implementiert“ und „Readiness fehlt im Kandidaten“ sind durch diesen technischen Fixblock überholt. Auf der Live-Staging-Datenbank bleibt die Migration jedoch weiterhin unapplied.

| Kennung | Bedeutung |
|---|---|
| `a4e92abb8bd2b96f690d9c9438b4200854a953c1` | erwarteter und tatsächlicher Ausgangs-Dokumentationshead aus V35; keine Abweichung |
| `b89cecc22e7eb2eb80716078a29584f383dd653e` | finaler technischer Head dieses Fixblocks, vollständige CI PASS |
| `d71b72d96a214c8f18697fd31ac750092e213288` | vorheriger technischer Schritt-5-Endstand |
| `50f88213571be13255bb52eb489cc28cca660001` | unveränderter main |
| `xhmjxrcskfhbovhitdej` | ausschließlich DUELVANTA-STAGING |
| `enifiaqsnqtbzylnfrpi` | Production, ausschließlich harte Negativgrenze |

Repository: Bennyescaped/duelvanta. PR #5 bleibt offen, Draft und unmerged. Der Commit dieses Handouts ist ein späterer Dokumentationscommit, kein weiterer technischer Implementierungshead. Vor Fortsetzung den tatsächlichen vollständigen Remote-Head bestimmen.

13 vorherige Arbeitskopien inventarisiert, fremde Änderungen und vorherige lokale Historie gesichert. Neue isolierte Arbeitskopie; kein Reset, Force-Push, Branchwechsel oder Überschreiben fremder Arbeit. Details im technischen Bericht.

## 2. Legal-Gesamtstatus

| Schritt | Status |
|---|---|
| 1 – Kompatibilitätsschutz | veröffentlicht, CI PASS, angemeldeter Read-only-Nachtest PASS; Guard im Fixblock auf 1.2 fortgeführt |
| 2 – Privatkäuferzugang | technisch/CI PASS; historischer Preview-Nachtest TEIL-PASS / Rest mangels aktivem eingegangenen Angebot BLOCKIERT, kein dort beobachteter FAIL |
| 3 – Preisangebote | technisch und vollständige CI PASS |
| 4 – Festpreis | ursprüngliche Replay-/Payment-Invarianten erhalten; S6-A01 zusätzlich mit echten PG17-Rollen-/Parallelitätsnachweisen geschlossen |
| 5 – Widerruf | technisch und vollständige CI/PG17/Chromium PASS |
| 6 – Staging-Gesamtmigration | **NICHT angewandt; NICHT abgeschlossen. Repository-Blocker technisch behoben, neuer Live-Preflight separat erforderlich.** |

Privatkäuferzugang wird wiederverwendet, kein zweites Käuferprofil, kein B2B/C2B-Release. Preisangebot bleibt verbindliches Käuferangebot auf eingefrorenem Review, Vertrag bei Verkäuferannahme, kein zweiter vertragsschließender Checkout. Festpreis bleibt snapshotgebunden mit sicherem Provider-/DB-Unknown-Recovery. Widerruf bleibt konkreter eigener B2C-Vertrag mit eingefrorenem Händlerempfänger, immutable evidence_snapshot/SHA256 und deduplizierter Outbox; kein automatischer Refund, Storno oder Payment-/Order-Statuswechsel.

## 3. S6-A01 – Reservierungsfehler geschlossen

Bestehendes authenticated-DELETE durfte eigene pending-Offers unabhängig vom Typ löschen. Dadurch konnte eine neue Festpreisreservation verschwinden, während der Listing-Bestand reduziert blieb.

Der überarbeitete Kandidat entzieht direkte Offer-Mutation für Browser/Backend; eigenes pending/price-DELETE bleibt nur ohne Reservation zulässig und wird zusätzlich durch eine restriktive Policy begrenzt. Der alte Käufer-Withdraw-RPC ist zusätzlich auf unreservierte Preisangebote begrenzt. Eine validierte State-CHECK verhindert auch status-only withdrawn/declined/cancelled durch alte SECURITY-DEFINER-Pfade, solange Bestand reserviert ist. Ein BEFORE-DELETE-Trigger verhindert privilegiertes/kaskadierendes Entfernen noch reservierter Zeilen. Release/Expire/Accept sperren Listing vor Offer, prüfen nach dem Warten erneut und führen die Menge atomar genau einmal zurück oder verbrauchen sie für den Vertrag. Vorhandene Deals werden nicht freigegeben. Inkonsistente Mengen führen zum Rollback statt zu geratenem Bestand.

PG17: sieben getrennte Verbindungen, 14 Fälle, elf beobachtete Sperrbeziehungen; eigene/fremde Käufer, anon/service, Direktmutation, Cascade, einmaliger Release, alle Release/Accept/Expire-Gewinner, letztes Stück, Request-/Accept-Replay und Payment-Nachweise PASS. Gewöhnliches unreserviertes Preisangebot bleibt durch seinen Käufer löschbar. API-Unknown-/Recovery-Verhalten unverändert.

Ablauf wird weiterhin vom vorhandenen Cleanup ausgeführt; kein neuer Timer/Scheduler. Die Zeile bleibt bis zur vorgesehenen Freigabe erreichbar. Vor späterer Migration reale Altzustände und Cleanup-Aufrufbarkeit neu prüfen.

## 4. S6-A02 – echte Readiness implementiert

`get_market_legal_schema_readiness_v1()` prüft schreibfrei PostgreSQL-Kataloge: 64 Tabellen, 201 Funktionsnamen, 266 Objektprüfungen einschließlich Signaturen/Implementierungen, Spalten/NOT NULL, Constraints/FKs, gültigen Indizes, Immutable-/Reservierungs-Triggern, RLS, privaten Schema-/Tabellen-/Spaltenrechten, RPC-Grants/Revokes und Offer-Policies. Vertragssnapshot, Preisangebot, Festpreis, Widerruf, Outbox sowie Datenrechte-/Retention-Abhängigkeiten sind eingeschlossen.

Sollwerte werden offline aus gesicherter datenfreier Katalogbasis und geprüftem Kandidaten erzeugt, per CI auf Aktualität geprüft. Keine Live-Selbstfreigabe, kein Dummy-RPC, keine Marker-Tabelle, kein Ersatz-Käuferprofil. Server-Ländereinstellungen sind für die äußere Prüfliste durch COLLATE "C" neutralisiert; NOT NULL wird versionsübergreifend über attnotnull geprüft.

Guard 1.2 akzeptiert nur `compatible === true` mit exakt `trade-legal-contract-model-v1.2`. Loader 1.4 sowie Order-Read-Grenze und Cache-Versionen sind angepasst. Fehlende Funktion, Teilmigration, falsche Version, Fehler, Timeout und unerwartete Antwort bleiben geschlossen. 47 native Katalogchecks und 17 reale Chromium-Guard-/Loader-Szenarien PASS. Die RPC ist auf Staging weiterhin nicht installiert: keine Behauptung einer geöffneten realen Staging-Readiness.

## 5. Exakter neuer Kandidat

`supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql`

- Git-Blob: `f1714dc1b5fc9ebeab0dbff5c974ac1696dc28ef`.
- SHA256: `a02e01bba93bda7e942850e776410fae1d752edb629b80319d9970859270d25f`.
- Ausschließlich in isolierten Testdatenbanken angewandt, **nicht auf Staging**.
- Der alte V35-Kandidat bleibt historische Fehlerreproduktion, keine freigegebene Migration.

## 6. Vollständige CI des technischen Heads

| Workflow | Run | Jobs | Ergebnis |
|---|---|---|---|
| Scanner V16 #682 | 35786444298 | validate 106944286665; collect_f3_database 106944286574; quota_database 106944286431 | SUCCESS |
| Battle WebRTC #158 | 35786443880 | battle_webrtc 106944285297; spectator_database 106944286051 | SUCCESS |

Schritt-1–5-, PostgreSQL-17-, Guard-/Loader-, Order-/Widerruf-Chromium-, Datenrechte-/Retention-, Stripe-Default-Off-/API-/Recovery- und vorhandene COLLECT-/BATTLE-/Scanner-Regressionspakete vollständig grün. Kein Schutztest abgeschaltet. Zwischenfehler und deren konkrete Korrekturen sind im technischen Bericht dokumentiert; alle Run-/Job-IDs und Artefaktdigests in `evidence/legal-step6-fixes-20260922/ci.json`.

## 7. Unveränderte Grenzen und offene Live-Abnahmen

Keine Staging-Migration, keine Staging-Transaktion und keine realen Deals/Orders/Payments/Refunds/Payouts/Widerrufe oder E-Mails in diesem Fixblock. main/Production durch diesen Block unverändert, keine Production-Verbindung, kein Merge und kein manueller Production-Deploy.

Stripe Sandbox/Live nicht aktiviert; dokumentierter OFF-Stand aus V35 und Default-Off-Code bleiben unverändert. Compliance-Delivery nicht aktiviert oder geändert. Ein aktueller Live-OFF-Nachweis des Deployment-E-Mail-Schalters liegt weiterhin nicht vor; keine stärkere Behauptung aus Mock-/Codeprüfungen ableiten.

Kein angemeldeter Staging-Nachtest dieses Fixblocks. Vorhandene sichere Zustände wurden nicht verändert; fehlende Testsituationen bleiben BLOCKIERT. Aus den isolierten Tests folgt keine Live-Schema-/Migrations-/Produktionsfreigabe. COLLECT F1–F3/Mobile, Spectator Media und Scanner-Release-Gate wurden nicht erneut bearbeitet.

## 8. Verbindlicher nächster Schritt

**Jetzt STOP. Keine Legal-Migration automatisch anwenden.** Erst separater Folgeauftrag zur kontrollierten Staging-Migration.

Dann zuerst V36 und `DUELVANTA_LEGAL_SCHRITT6_BLOCKER_FIXES_2026-09-22.md` vollständig lesen. Remote-Head/Arbeitskopien sichern, neuen Kandidatenhash prüfen, tatsächliches Staging-Routing einschließlich Production-Negativgrenze frisch verifizieren und Live-Katalog/Grants/Default-Privileges sowie reale Bestands-/Reservierungszustände read-only neu inventarisieren. Realen Stripe-/E-Mail-OFF-Stand und geeignete vorhandene Preview-Lesetestzustände klären. Der technische Bericht enthält den vollständigen Folge-Preflight.

Unverstandene Schema-/Daten-/Environment-Abweichung: stoppen und dokumentieren. Keine Sollhashes aus ungeprüfter Live-Drift neu erzeugen, keine Datenreparatur improvisieren. Nur nach expliziter Folgeautorisierung und konfliktfreiem Preflight darf exakt der geprüfte Kandidat ausschließlich auf `xhmjxrcskfhbovhitdej` angewandt werden. Anschließend Schema-/Grant-/Readiness- und sichere angemeldete Integration prüfen. Keine echten wirtschaftlichen Vorgänge nur für Tests.

## 9. Referenzen

- `DUELVANTA_LEGAL_SCHRITT6_BLOCKER_FIXES_2026-09-22.md`
- `evidence/legal-step6-fixes-20260922/`
- `DUELVANTA_LEGAL_SCHRITT6_PREFLIGHT_2026-09-22.md` und dessen historische Evidenz
- Schritt-1–5-Berichte gemäß V35; deren unveränderte Modell-/Nachtestgrenzen gelten weiter.
