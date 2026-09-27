# DUELVANTA – T3/G3: Scanner-Neuzulassung unter Processing-Hold

Dokumentreihe 26.09.2026 · Ausführung und Verifikation 27.09.2026 · **PASS als isoliert und nativ geprüfter Branch-Kandidat** · Nicht live · Production NO-GO

## Grundlage und Repository

V70 und `DUELVANTA_T3_G2_PRIVATSTELLUNG_ABSCHLUSS_2026-09-26.md` wurden vollständig aus den gemeinsamen Projektdateien gelesen. V68/T3 wurde für Scannerpfade, Abschlusswege und Restgrenzen abgeglichen. Der ausdrückliche Auftrag umfasst ausschließlich G3, isolierte Tests, Branch-Veröffentlichung nach isoliertem PASS, native PostgreSQL-17-Abnahme und vollständige GitHub-CI. Keine Cloud-Datenbank wurde kontaktiert.

| Gegenstand | Verifiziert |
|---|---|
| Repository / einziger Entwicklungsbranch | Bennyescaped/duelvanta / marketplace-ux-v1 |
| Ausgangshead | `824e27f35572aa1710e2887546fd447b0ebd0ab3` |
| Ausgangs-CI | Scanner #740 / Battle #216 SUCCESS |
| Technischer G3-Head | `c60cdcd7f8da2c3dc46e4a4abd5d750323e8e95d` |
| main unverändert | `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | open, Draft, unmerged |
| Scanner technische Abnahme | [#741 / 36300013083](https://github.com/Bennyescaped/duelvanta/actions/runs/36300013083), SUCCESS |
| Battle technische Abnahme | [#217 / 36300013066](https://github.com/Bennyescaped/duelvanta/actions/runs/36300013066), SUCCESS |
| Nativer DB-Job | `108565811636`, PostgreSQL 17.11 (`170011`) |
| G3 | **23/23 Ergebnisgruppen PASS** |
| Vollständiger G1-Test mit G2/G3 | **19/19 PASS** |
| Vollständiger G2-Test mit G3 | **18/18 PASS** |
| Vollständiger T2-Test mit G1/G2/G3 | **17/17 PASS**, 96 Tabellen/15 Sequenzen |
| Vollständige rekonstruierte Upgrade-Kette mit G3 | PASS |

Git und GitHub-Metadaten bestätigten vor Veröffentlichung denselben Ausgangsstand. Bericht und V71 folgen als reine Dokumentationsrevision. Deren endgültiger Head und vollständige Abschluss-CI stehen in `verification.json` im Evidenzpaket. Diese angekündigte Revision ist keine fachliche Drift. Kein veröffentlichter CI-FAIL und keine nachträgliche funktionale Korrektur erforderlich.

## Tatsächlich geprüfte Pfade

Die Prüfung rekonstruiert den versionierten Sollstand einschließlich P0-02/P0-05/T2/G1/G2. Sie ist **keine neue Live-Katalog-Attestierung** für Production oder Staging.

| Pfad | Bestehende Grenze und G3-Behandlung |
|---|---|
| `scanner-v16-provider.js` → `/api/scanner-v16-recognize` | Bestehender kontobezogener Raw-/Slab-Pfad, unveränderte Browserintegration |
| `api/scanner-v16-recognize.js` | Unveränderter Einstieg in `benchmark/scanner-pilot/recognize-server.cjs` |
| Handler-Authentifizierung | Bestehende Verifikation über Auth-Service, anschließend Nutzer-JWT und Publishable-Key; keine vertrauenswürdige Identität aus ungeprüften Clientclaims |
| `public.dv_v16_reserve_openai_scan` | Unveränderte SECURITY-INVOKER-Fassade mit unveränderten Parametern |
| `dv_v16_private.reserve_openai_for_caller` | Bestehender SECURITY-DEFINER-Kontext, postgres, leerer search_path; neue eigene Profil-Hold-Prüfung vor Ledger-Schreiben |
| `dv_v16_private.require_openai_server` | Unverändert: vorhandener Nutzer, kein anonymer Nutzer, Accounting-Key mit SHA256-Vergleich; benötigt zusätzlich zum JWT |
| Budget / Wochenquoten / Monatskosten | Bestehende getrennte Raw-/Slab-Zähler, Dubletten, globale Policy-Sperre, Monatslimit, EUR-Reservierung und FX-Snapshot bleiben erhalten |
| `public.dv_v16_openai_scan_budget` | Bestehende eigene Budgetprojektion ergänzt um `processingRestricted`; unter Hold enabled=false und verbleibende nutzbare Scans=0 |
| `public.dv_v16_settle_openai_scan` und privater Settlement-Helfer | Bytegleich; eigene vorhandene Reservierung, Key, FX-, Kostenobergrenze, Idempotenz und Monatszuordnung bleiben erhalten |
| Direkte Tabellen-DML / service_role | Bestehende ACL/RLS unverändert; BYPASSRLS ersetzt keine Tabellen-/Schemarechte |
| Historisches `dv_v16_reserve_scan` | Bestehender separater abgeschalteter Pfad unverändert; keine Reaktivierung und keine Behauptung eines neuen Legacy-Hold-Guards |
| Signierte Pilot-Endpunkte | Separater, deaktivierter/abgelaufener Pilot mit signierten Fotos und eigener Deploymentgrenze; keine Aktivierung oder neue Kontozuordnung |
| Deployment | Kontobezogener Handler bleibt nur für scanner-v16 Preview bzw. main Production im Code zugelassen; marketplace-ux-v1 bleibt 404. Keine Environment-/Vercel-Konfiguration verändert |

Vor Installation reproduzierten A und B neue Reservierungen und enabled=true trotz Processing-Hold. Diese Baseline-Transaktionen wurden zurückgerollt. Die G3-Tests verbinden anschließend den tatsächlichen Handler mit tatsächlichen SQL-Funktionen; nur Auth-Transport und Provider sind simuliert. Der Adapter besitzt keinen Netzwerk-Fallback. Insgesamt 15 Provider-Stub-Aufrufe, **null echte Provideraufrufe und null Kosten**.

## Einzige funktionale Änderung

`database/scanner-processing-hold-v1.sql` ersetzt genau zwei vorhandene private Funktionskörper. Es entstehen keine neuen Funktionen, Tabellen, Trigger, Rollen, ACLs, Policies oder Freigabeverfahren. Vorher-/Nachher-Sicherheitskatalog und separate Funktionsmetadaten bestätigen diese Grenze. Historische SQL-Dateien bleiben unverändert.

1. **Neue Reservierung:** Nach den bestehenden Auth-/Policy-/Accounting-Key-Prüfungen liest die Funktion das eigene aktive/beta Profil mit `FOR SHARE`. Ein nicht-NULL-Processing-Marker liefert `allowed:false, reason:account_data_processing_restricted`, bevor Monatszeile, Usage oder Reservierung verändert werden. Die Zeilensperre synchronisiert die Zulassung mit bestehenden Profil-/Closure-Updates. Die bisherigen Policy-, Monats- und Usage-Sperren bleiben erhalten.
2. **Eigene Budgetauskunft:** Der bereits gespeicherte Marker liefert den booleschen Wert `processingRestricted`. Unter Hold ist die nutzbare Zulassung deaktiviert; bestehende Kosten-/Budgetzahlen werden weiter korrekt ausgewiesen. Kein allgemeiner Lese- oder Sichtbarkeitsguard.
3. **Realer Handler:** Die Reservierungsablehnung wird als HTTP 403 behandelt. Nach erfolgreicher Reservierung prüft der Handler unmittelbar vor dem Providerstart den Hold erneut über den vorhandenen Budget-RPC. Ein gesetzter Hold liefert 403; fehlendes boolesches Feld oder nicht erreichbarer RPC liefert 503. In beiden Fällen kein Providerstart. So bleibt auch ein älterer DB-Vertrag geschlossen.

Settlement-Code und seine Aufrufstelle bleiben unverändert. Eine nach Reservierung verweigerte Providerzulassung erzeugt weder automatische Stornierung noch Refund, Retry oder neue Settlementdaten. Die vorhandene Reservierung bleibt konservativ bestehen; der bestehende autorisierte Accountingpfad bleibt nutzbar. Bereits gestartete erfolgreiche und unvollständige Providerantworten mit vorhandenen Usage-Daten werden weiterhin über den bestehenden Pfad verbucht.

`database/scanner-processing-hold-readiness-v1.sql` ist der offline erzeugte Vertrag für P0-02/P0-05/T2/G1/G2/G3: 424 Security- und 270 Legal-Katalogprüfungen. Der alte G2-Vertrag erkennt die geänderten Funktionen als inkompatibel; der passende G3-Vertrag besteht. Der Generator verlangt für `--scanner-hold` die G2-Basis. Die bisherige G2-Ausgabe wurde separat unverändert geprüft. Bei einer später separat freizugebenden Live-Einführung müssen SQL-Kandidat und passender Vertrag zusammen berücksichtigt werden; hier keine Live-Anwendung.

## Native Positiv-/Negativnachweise

| Fall auf PostgreSQL 17.11 | Ergebnis |
|---|---|
| A/B ohne Hold: Raw und Slab, öffentliche und private Reservierungsfunktion | Erlaubt; echter Handler mit Stub erfolgreich; Settlement erfolgreich |
| A/B Processing-Hold allein | Öffentliche/private Neureservierung verweigert; keine Änderung an Ledger/Quoten; Budget deaktiviert; Handler 403 und null Providerstarts |
| A/B reales Closure-Paket aus bestehendem RPC | Gleicher Schutz; G1-/G2-Marker und Privatstellung bleiben wirksam |
| Nicht gesperrter Kontrollnutzer | Weiterhin eigene Scans und Abrechnung möglich |
| Bereits vor Closure zugesagte eigene Reservierung | Nach Closure korrekt abgerechnet; reservierte Kosten abgebaut, tatsächliche EUR/USD/Tokenwerte und Scananzahl korrekt erhöht |
| Settlement-Wiederholung | duplicate=true, keine zweite Buchung und keine Quotenänderung |
| Fremde Reservierung / fehlender Accounting-Key | Weiterhin verweigert |
| Hold nach Reservierung, vor Providerstart | Handler 403, null Providerstarts; keine erfundene Stornierung; bestehendes Settlement weiterhin erreichbar |
| Hold während bereits gestarteter erfolgreicher Provider-Stub-Verarbeitung | Bestehendes Accounting erfolgreich |
| Hold während bereits gestarteter unvollständiger Provider-Stub-Verarbeitung | Vorhandene Usage abgerechnet, ursprünglicher Providerfehler bleibt bestehen |
| Fehlendes Hold-Feld / nicht erreichbare Vorstartprüfung | 503, null Providerstarts |
| Tatsächlicher DEFINER-/Owner-Kontext, gefälschter JWT-role, clientsetzbare GUC | Keine Ausnahme von neuer Hold-Zulassung |
| anon/service_role/direkte private DML | Bestehende Rechte verweigern; keine Ausweitung |
| Fehlendes Subjekt, anonymer JWT, falscher/fehlender Serverkey, gesperrter Kontostatus | Bestehende Ablehnung erhalten |
| Dublette, getrennte Raw-/Slab-Quote, Monatslimit, deaktivierte Policy | Bestehende Ablehnungen erhalten; Settlement bleibt bei deaktivierter Policy möglich |
| marketplace Preview/Production | Weiterhin 404 vor RPC/Provider; erlaubte Deploymentkontexte ausschließlich simuliert |
| Native Konkurrenz A und B | Reservierung wartet nachweislich mit `pg_blocking_pids` hinter einer echten Closure-Transaktion; nach deren Commit verweigert |

G1/G2/T2 wurden jeweils vollständig mit zusätzlich installiertem G3 erneut ausgeführt. G1 enthält den Marker-/Collection-Parallelitätsnachweis; G2 enthält konkurrierende RPC-/DML-Veröffentlichungsversuche; T2 enthält Audit-Hashbindung, Fremdfilter und Audit-only-Schreiben über 96 Tabellen/15 Sequenzen. Die vollständige versionierte Upgrade-Kette besteht. Sämtliche Scanner-/Battle-, P0-02/MFA-, P0-05-, Quoten-, F3- und Browserregressionen der vorhandenen Workflows sind erfolgreich. Bestehende synthetische Untertests werden dadurch nicht zu Live-Aktionen.

Die vorbereitenden PGlite-Läufe bestanden vor dem Push. Native PostgreSQL 17.11 im isolierten CI-Dienst ist der Abschlussnachweis; PGlite ersetzt ihn nicht. Lokale Testentwicklung korrigierte ausschließlich Fixture-/Assertiondetails (Katalogidentität, vorhandene importierte Kostensalden, zulässiger inaktiver Kontostatus). Keine fachliche Abschwächung zum Bestehen eines Tests.

## Reproduktion und Evidenz

```sh
node tests/generate-security-readiness.mjs --data-export --trade-lock --processing-markers --closure-privacy --scanner-hold --check
node tests/scanner-processing-hold-test.mjs --native
node tests/account-processing-markers-test.mjs --native --closure-privacy --scanner-hold
node tests/account-closure-privacy-test.mjs --native --scanner-hold
node tests/production-upgrade-rehearsal.mjs --native --trade-lock --data-export --processing-markers --closure-privacy --scanner-hold
node tests/account-data-export-collect-battle-test.mjs --native --trade-lock --processing-markers --closure-privacy --scanner-hold
```

Der native Harness erlaubt ausschließlich localhost/127.0.0.1 und PostgreSQL-Hauptversion 17. Er erzeugt und entfernt Wegwerfdatenbanken. Das originale CI-Artefakt `10924264270` wurde heruntergeladen und vor Extraktion gegen SHA256 `8b7543d99f03e85a7820ea5a15ece0314f77591c8e9789b9d6d0d1adb158d202` verifiziert. `DUELVANTA_T3_G3_EVIDENZ_2026-09-26.zip` enthält das Original, native Reports/Logs, lokale Ergänzungen, Quellstände, Dateihashes und endgültige Repository-/CI-Verifikation.

## Grenzen und exakt ein nächster Block

G3 schützt die Zulassung neuer kontobezogener OpenAI-Vorgänge anhand des bestehenden Markers. Der Vorstartcheck ist keine verteilte atomare Transaktion mit dem externen Provider. Ein Hold nach der letzten erfolgreichen DB-Prüfung bzw. nach Providerstart erhält hier keine neu erfundene Abbruch-/Widerrufssemantik; offene In-flight-Fragen bleiben ausdrücklich offen. Keine Behauptung einer rückwirkenden Providerverarbeitungsunterbrechung. Die vorhandene Abrechnung wird erhalten, nicht als allgemeine Freigabe für weitere Verarbeitung ausgelegt.

G4/G5 und D1–D4 aus V68 bleiben offen. Keine Änderungen an BATTLE, Signalisierung, Storage, Retention, Erasure, T1/T4–T6, Rechtstexten, Providerverträgen, Mail oder Stripe. Kein Merge, Production-Deploy, Live-Migration oder Live-Lock. Production und Staging wurden nicht kontaktiert oder verändert. main unverändert; PR #5 offen/Draft/unmerged; einzig marketplace-ux-v1 veröffentlicht, automatisches Preview erlaubt. PITR OFF und Production NO-GO bleiben bestehen. Kein neuer Recovery-Block.

**Exakt ein nächster fachlicher Block: T3/G4 – bestehende BATTLE-Spieler-Zulassung für Create/Join/Ready/Start an den eigenständigen Processing-Hold binden und bestehende Abschluss-/Nachweispfade erhalten.** Erst nach ausdrücklichem Folgeauftrag, anhand frischer Quellenprüfung; keine neue Regel für Signalisierung oder laufende Medien. Nicht begonnen.

Bericht, V71 und Evidenzpaket zusätzlich in den gemeinsamen DUELVANTA-Projektdateien. **G3 abgeschlossen. STOP.**
