# DUELVANTA F3 – lokaler Implementierungsstand, Veröffentlichung blockiert

Stand: 21.09.2026. **F3 ist NICHT abgeschlossen.**

Die lokale Implementierung und die ausgeführten isolierten SQL-/Browserprüfungen liegen vor. Der zwingende Parallelitätstest mit zwei unabhängigen PostgreSQL-Verbindungen fehlt. Daher wurden weder Staging-Migration noch Commit/Push, neue Preview oder praktischer Staging-Löschtest durchgeführt. Keine Gesamt-, Rechts- oder Produktionsfreigabe.

## Ausgangsstand und Grenzen

Repository `Bennyescaped/duelvanta`, ausschließlich Branch `marketplace-ux-v1`. Lokaler und erneut abgefragter Remote-Head: `3bf24d78a9f3789eb8f3e84c70c9a4493ec06d47`, keine Abweichung. Frische Arbeitskopie; kein Reset oder Branchwechsel. V30 einschließlich Nachträgen sowie F1/F2-, M1–M3- und Kaufdatum-Dokumentation gelesen.

Alle externen Datenbankabfragen waren read-only und ausschließlich gegen `DUELVANTA-STAGING / xhmjxrcskfhbovhitdej`. Projektidentität per Projektabfrage bestätigt; PostgreSQL 17.6.1.166. Keine angemeldeten Preview-Tests in diesem Arbeitsblock; deshalb auch keine neue Preview-/Runtime-Freigabe behauptet.

## Erneuter Staging-Abgleich

| Bereich | Tatsächlich beobachteter Stand |
| --- | --- |
| Fremdschlüssel | `collection_items.folder_id → collection_folders.id`, `ON DELETE SET NULL`, validiert, nicht aufschiebbar |
| Account-Bezug | Beide Tabellen referenzieren `auth.users` mit `ON DELETE CASCADE` |
| RLS | Auf beiden Tabellen aktiv, nicht FORCE RLS; normale Rollen ohne BYPASSRLS |
| Binder-Policies | SELECT/INSERT/UPDATE/DELETE für `authenticated`, Eigentumsvergleich mit `auth.uid()`; DELETE ohne Leerprüfung |
| Karten-Policies | SELECT/INSERT/UPDATE/DELETE nach eigenem `user_id`; unsichtbare referenzierende Karten dürfen deshalb nicht als Leerbestand gewertet werden |
| Grants | Binder: `anon`, `authenticated`, `service_role` besitzen u. a. DELETE und TRUNCATE; Karten: `authenticated` und `service_role` besitzen u. a. DELETE; keine Rollenmitgliedschaften für anon/authenticated |
| Account-Sperren | `block_restricted_collection_folders` und `block_restricted_collection_items` aktiv; `block_restricted_account_mutation()` prüft `profiles.data_processing_restricted_at` |
| Positions-/Zeittrigger | `trg_clear_collection_binder_position_on_folder_change` und `trg_touch_collection_item_updated_at` aktiv |
| Indizes | Index auf `folder_id`; bestehender partieller Unique-Index auf Nutzer/Binder/Seite/Platz |
| Binder-RPCs | `dv_collect_move_card` und `set_my_collection_folder_visibility` SECURITY INVOKER; bestehender öffentlicher Collection-Leser inventarisiert |
| Account-Löschung | `request_my_account_deletion`, `claim_account_deletion_requests`, `prepare_account_deletion_data`, `finish_account_deletion_request`, `release_account_deletion_hold` und privater Blocker inventarisiert; Workerfunktionen nur privilegiert ausführbar |

`prepare_account_deletion_data` entfernt Collection-Karten vor Collection-Bindern. Die neue Migration verändert weder diese Funktionen noch Fremdschlüssel oder vorhandene Trigger. Privilegierte Bereinigung und Auth-Kaskaden bleiben vom Benutzer-Löschpfad getrennt.

## Lokale Änderung

Migration: `supabase/migrations/20260921144947_collect_empty_binder_delete.sql`, mit Supabase CLI erzeugt; **nicht auf Staging angewendet**.

- DELETE und TRUNCATE auf `collection_folders` werden PUBLIC/anon/authenticated entzogen. `service_role` behält den vorhandenen Bereinigungspfad. Bestehende RLS bleibt aktiv und unverändert.
- Öffentliche SECURITY-INVOKER-RPC `dv_collect_delete_empty_binder(uuid)` ruft genau eine private SECURITY-DEFINER-Funktion auf. Nur `authenticated` erhält EXECUTE; feste leere `search_path`, qualifizierte Namen, keine frei übergebene Nutzer-ID.
- Die private Funktion prüft Anmeldung einschließlich Ausschluss anonymer Sessions, bestehende Datenverarbeitungssperre und Eigentum. Sie sperrt den eigenen Binder mit `FOR UPDATE`, prüft anschließend sämtliche Kartenreferenzen unabhängig von Aufrufer-RLS und löscht nur bei leerem Bestand.
- SECURITY DEFINER ist für die vollständige Referenzprüfung erforderlich. Es werden keine Karten, Zuordnungen oder Positionen geändert. Fremde, fehlende und bereits gelöschte Binder ergeben dieselbe neutrale Antwort.
- Die Sperrstrategie soll mit den KEY-SHARE-Sperren der vorhandenen FK-Prüfung kollidieren. **Dies ist noch kein nachgewiesener Parallelitätsschutz:** Der vorgeschriebene Zwei-Verbindungs-Test fehlt, insbesondere für Hinzufügen/Zuweisen vor und nach Erwerb der Bindersperre.

Oberfläche in `collect.html`:

- Eigene geöffnete Binder erhalten eine separate Aktion; Master/Graded keine. Nicht gefilterter Bestand und erfolgreiche vollständige Ladung bestimmen die Freigabe. Eine exakte Ergebnisanzahl verhindert Freigabe bei abgeschnittener Antwort; ohne bestätigte Vollständigkeit bleibt die Aktion gesperrt.
- Belegte Binder zeigen „Nur leere Binder können gelöscht werden.“ Ein Suchfilter ohne Treffer ändert das nicht.
- Eigener Bestätigungsdialog; Bindername über `textContent`, Abbrechen ohne RPC, Mehrfachausführung während laufendem Request gesperrt.
- Nur `status: deleted` bestätigt Erfolg. Fremd/fehlend, Serverfehler und unbekannte oder verlorene Antworten erzeugen keine Erfolgsmeldung. Bestand wird neu geladen; eine inzwischen belegte Collection bleibt erhalten.
- Nach Erfolg Master Collection, Seite null, aktualisierte Binderkacheln und Auswahlfelder; ausstehende Binderwahl sowie Binder-/Ansichts-/Seitenparameter in der URL werden bereinigt.
- Keine Änderungen an Kaufdatum, 16-px-Eingabeschrift, Zoom, Kartenbildern, Preislogik oder Binder-Renderer-Adapter.

## Tatsächliche Tests

### Isolierte Datenbanktests

`tests/collect-binder-delete-database-test.mjs`: **PASS in PGlite 0.5.8**, PostgreSQL-WASM, echte SQL-Rollen/RLS/Grants/Trigger/FK; keine JavaScript-Mocks der Datenbank. Die Benutzeroperationen laufen unter `authenticated`, nicht als Superuser/Service-Rolle. Fixture-Aufbau und Nachkontrollen verwenden privilegierte Rollen.

Nachgewiesen: eigener leerer Binder; Wiederholung; fremder/nicht existierender Binder mit gleicher Antwort; anon/fehlende UID/anonyme Session; Datenverarbeitungssperre; direkter Tabellen-DELETE und TRUNCATE abgewiesen; eigene sichtbare und fremde unsichtbare Kartenreferenz blockieren; Kartenzeile samt `folder_id`, Seite und Platz nach Ablehnung unverändert; privilegierte Bereinigungsreihenfolge und Auth-Kaskade.

`tests/account-data-rights-database-test.mjs` wurde um die F3-Migration ergänzt; seine vorhandenen Assertions bleiben unverändert und bestehen. Damit wurden Datenexport, Löschblocker, Sperre, Löschworker-RPCs, Bereinigung und Aufbewahrungspfad mit eingebundener Migration geprüft.

**BLOCKIERT:** Parallelität mit zwei unabhängigen DB-Verbindungen. Kein nativer PostgreSQL-Server/psql und keine vorhandene lokale Containerlaufzeit verfügbar. Der Prozess läuft als root ohne Linux-Capabilities; `runuser -u nobody -- id` scheitert mit `cannot set groups: Operation not permitted`. PGlite bietet hier keinen unabhängigen Mehrverbindungsbetrieb. Keine Zugangssperre umgangen, kein externer Dienst eingerichtet. Die sequenziellen SQL-Tests ersetzen den fehlenden Nachweis nicht.

### Lokale Browserfixtures

`tests/collect-binder-delete-browser-test.mjs`: **PASS**. Chromium **140.0.7339.186**, Playwright 1.55.1, Linux/headless. Gesetzte und per `innerWidth`/`innerHeight` gemessene Viewports: **1363 × 844**, **390 × 844**, **430 × 844 CSS-Pixel**. Ausschließlich lokale synthetische Fixtures, externe Anfragen blockiert.

Nachgewiesen: Systemansichten ohne Aktion; belegter Binder auch ohne Suchtreffer gesperrt; laufende/fehlerhafte/abgeschnittene Ladung gesperrt; gefährlich aussehender Bindername als reiner Text; erreichbare Dialogaktionen ohne horizontalen Überlauf; Abbrechen und Escape ohne Schreibaufruf; Doppelklick nur ein RPC; belegter Serverbestand, Serverfehler, Netzwerkfehler, verlorene Erfolgsantwort, unbekannte und neutrale Antwort; korrektes Erfolgsverhalten, Seiten-/URL-/Auswahlbereinigung und Fehlen nach Neuladen.

Die RPC-Antworten im Browser sind Fixtures. Dies ist **kein praktischer Staging- oder HTTP-API-Sicherheitsnachweis**. SQL-Rechte wurden separat wie oben geprüft. Screenshots: `collect-f3-1363-confirm.png`, `collect-f3-390-confirm.png`, `collect-f3-430-confirm.png` im Belegpaket; Messwerte in `collect-f3-browser.json`.

### Regressionen

PASS: `collect-ux-test`, `collect-ux-browser-test`, `collect-mobile-ui-test` einschließlich Kaufdatum, `scanner-v16-binder-layout-test`, `scanner-v16-collect-e2e` mit lokalen Mocks, `scanner-v16-contract-test`, `scanner-v16-acceptance-regression-test`, `runtime-routing-contract-test`, eingebundener `account-data-rights-database-test`, `account-data-erasure-worker-test` mit Mocks, `account-data-erasure-username-guard-test` in PGlite, Inline-JavaScript-Syntax und `git diff --check`.

Die neuen Tests sind im lokalen Entwurf des vorhandenen Scanner-Workflows ergänzt. Keine bestehenden Tests wurden abgeschwächt. **Beide Remote-CI-Workflows für einen neuen Commit: NICHT GETESTET**, da es keinen neuen Commit/Push gibt.

## iPhone-Nachtrag – getrennte Nutzerevidenz

Die vom Nutzer übermittelten bisherigen iPhone-/Safari-Ergebnisse bleiben akzeptierte Teilnachweise: kein unerwünschter Fokus-Zoom, Aktionen vertikal erreichbar, lesbare Preisstatus-Texte, Namen bildloser Karten, mobile Feldlabels sowie akzeptierte kompakte Kaufdatum-Darstellung. Abbrechen und Speichern wurden vom Nutzer bestätigt. Sie werden hier nicht wieder als offen behandelt.

Der manuelle Speichertest war eine **Nutzer-Datenänderung**, getrennt von den zuvor datenunverändernden Work-Prüfungen. Keine eigene Hardwareprüfung dieses Arbeitsblocks. F3 auf iPhone wurde nicht geprüft; Chromium ersetzt diesen Nachtest nicht.

## Dateien und verbleibender Abschluss

Lokaler Entwurf: `collect.html`, neue Migration, zwei neue F3-Testdateien, Erweiterung von `tests/account-data-rights-database-test.mjs`, Ergänzung `.github/workflows/scanner-v16-check.yml`, dieses Dokument. Keine Änderungen an F1/F2-Preislogik, M1–M3- oder Kaufdatum-Produktcode.

Offene Pflichtschritte, in dieser Reihenfolge:

1. Isolierten PostgreSQL-Server mit zwei unabhängigen Verbindungen bereitstellen; Hinzufügen und Zuordnen gegen Löschen in beiden Sperrreihenfolgen sowie Wiederholung/Transaktionsabbruch prüfen. Keine verlorene Karte oder unbemerkte Aufhebung einer Zuordnung zulässig.
2. Nach vollständigem grünem DB-Nachweis Migration nur auf Staging anwenden, Rechte/Funktion erneut prüfen; danach nur zugehörige Änderungen committen und auf demselben Branch pushen.
3. Beide CI-Workflows prüfen; automatisch entstandene Preview anhand Deployment-Commit und ausschließlich Staging-Runtime verifizieren.
4. Unter normalem synthetischem Konto genau einen neuen markierten leeren F3-Binder über die UI erstellen/löschen und Fehlen nach Neuladen nachweisen. Vorhandene Karten, Kaufdaten und `UXCHECK SYNTHETISCH 20260921` bleiben unangetastet.

**Testdatenänderungen dieses Blocks:** nur kurzlebige lokale Fixtures. Null Staging-Schreibvorgänge, keine zurückgebliebenen neuen Staging-Testdaten; alte Testbestände nicht verändert. Kein Commit, kein Push, keine Staging-Migration, kein Merge, kein manueller Deploy, keine neue F3-Preview. Production/main/Stripe Live und alle ausgeschlossenen Produktbereiche unverändert.
