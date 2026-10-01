# Isolierter V112-Anschlusskandidat

Erstellt am 2026-09-29. Ausschließlich neue synthetische Wegwerf-Datenbanken. Diese Datei beschreibt die Implementierung, keinen nativen PASS. Maßgeblich bleiben V112 und der freigegebene Auftrag; V113 ist der historische Vorprüfungsstand.

## Anschluss und unveränderte Grenzen

`database/psttg-v2-writer-unitmanifest-v1.sql` wird ausschließlich vom isolierten Test installiert, nach Kern, Leser, synthetischem K5 und V111-Repräsentation. Keine Einbindung in Anwendung, Migration, Worker, Holdberechnung, Outbox oder Deployment. Keine neuen Grantees. K5-v1 und sein `SIMULATE_ONLY` bleiben unverändert.

Die vier ursprünglichen SQL-Dateien bleiben bytegleich. Das Add-on ersetzt innerhalb der Wegwerf-DB gezielt `psttg_v2_capture`, `psttg_v2_read`, `psttg_v2_plain`, `psttg_v2_commit_check` sowie den V2-Guardtrigger. Deren Funktionsdefinitionen sind dadurch ausdrücklich verändert; keine Behauptung unveränderter Laufzeit-Hashes. Die versionierten gesperrten Capture-/Readerteile übernehmen die ursprünglichen Inhalts-, Originalwerte-, Seal- und Gruppentests. Alte V2-Ciphertexte/Seals werden weder neu verschlüsselt noch umgeschrieben.

`psttg_v2_execute_v1` ist der private Anschluss für `psttg-v2-writer-use/1`; Unitmanifeste besitzen getrennt `psttg-k5-unitmanifest/1`. Es gibt keinen öffentlichen oder Anwendungseingang. `SIMULATE_UNIT_TRANSITION` ist die einzige Unitaktion. Alle erlaubten Übergänge erhalten Contentzeilen und Schlüsselumschläge. Kein Endreceipt, keine ended-Markierung und keine reale Endautorisierung.

## Feste synthetische Abbildung

Die Abbildung umfasst ausschließlich den vorhandenen synthetischen Vier-Felder-Fall amount/currency/period/position mit dessen Körperzusätzen. Alle aktuellen registrierten O1-Köpfe der verifizierten Kanal-Scopes gehören zum Quellenbedarf dieses Testfalls; serverseitiger Vergleich verweigert fehlende oder zusätzliche Vorschläge. Das ist kein reales Fachklassenmapping. Die vollständige transitive Bindinghülle wird aufgelöst und jede benötigte Gruppe tatsächlich gelesen, entschlüsselt und geprüft.

Neue bestehende Objektverweise tragen representation/schema_version/id/incarnation/version. Der Dispatcher prüft vor dem ersten Capture; gemischte oder V1-getaggte V2-Nutzungen werden abgewiesen. Ungetaggte alte Eingänge bleiben V1, deren Kern und FKs bleiben unverändert. Es gibt keine automatische V1-Übernahme und keinen V2-Fallback auf V1-Seal/Append.

Ready speichert genau input/event/proof in `psttg-unit-v2-writer1`; das Ereignis bedeutet ausschließlich `internal_ready`. Evidence speichert event/proof ohne erneuten Vollinput und bindet bereits registrierten Input, Versuch und unabhängig verschlüsselten Receipt. Requestdigests bleiben in verschlüsselten Beweisunits. Neue Header enthalten ausschließlich intern erzeugte Referenzen, Revisionen, Commitments und geschlossene Projektionen.

Korrektur-ready prüft die tatsächlichen Originalwerte und erzeugt die vollständigen fünf eigenen Slots vor Nutzung. `EXTRACT_COMMITTED` ersetzt ausschließlich den Bedarf genau dieser Originalextraktion durch den bestätigten Commit der geprüften Korrekturgruppe. Andere Originalbedarfe bleiben bestehen. Copy bindet eigene Artefaktidentität/-version und Originalbedarf; unbekannte Artefakte bleiben ausdrücklich unresolved.

## Transaktionen, Bedarf und Sperren

Der gemeinsame Rahmen sperrt geordnete Operationskeys, geordnete Commandkeys, Kanäle, transitive O5-Hülle, Unitguards, Admissions und anschließend Unitintents. Er vergleicht die gesamte Auflösung nach dem Warten erneut. Wachstum oder Umordnung ergibt 40001 und verlangt eine vollständig neue Transaktion und neue Tickets. Nur READ COMMITTED.

Gesperrte Helfer verlangen einen privaten, an Backend und tatsächliche xid gebundenen Kontext, tatsächliche Advisorylocks und den internen Aufrufstapel. Der Kontext darf keinen Commit überleben. Keine GUC, kein Callerflag und keine Rollenbehauptung erteilt eine Mutationsbefugnis. Globale O5-Fences/Closed/Recovery gelten zusätzlich. Unitfences ändern keinen Anbieter-O5 in closed.

`guard.demand_revision` behält seine alte Bedeutung. `use_demand_revision` wird monoton aus Admission-/Use-Transitions- und belegten Unit-Receiptzuordnungen abgeleitet. Aktiver Bedarf wird aus belegten Übergängen ermittelt. Die geschlossene Kantenprojektion enthält vollständige Unit-Tupel, Träger, Zwecke, Entscheidungen, Nutzungsarten und Bindungsstatus; unbekannte Copyträger bleiben eigene unresolved-Kanten. Die scopeweise `integration_revision` folgt dem append-only Integrationsjournal. Projektionen binden außerdem ganze O5-Zeilen durch Commitment, bestehende Generation/Phase/Recovery/Fence, Herkunft, V1-Bestand und sämtliche benötigten Kanalrevisionen.

Admission, Input-/Beweisgruppen und Bedarfsbindung committen atomar. Attempting benötigt einen vorherigen Admissioncommit und ist selbst separat zu committen. `psttg_v2_result_v1` liest den gleichen Vorgang nach; im eigenen uncommitteten Backend liefert es keine Commitbestätigung. Die native Gegenstelle prüft Sichtbarkeit über eine unabhängige Verbindung, bevor sie einen simulierten Effekt registriert.

## Unitmanifest und Gegenstelle

Die Manifestrevision bindet geordnete vollständige Zielgruppen und deren unverändert zu erhaltende Abhängigkeiten, Zielraum/Konto/Konfiguration, Drev/Srev/Kanalvektoren, genau eine Aktion und Adapterversion, neun geschlossene positive Testbelegarten mit Version/Issuer/Keyversion/Manifestbindung, Betriebsinkarnation, reservierten Versuch und nächste Epoche sowie konkrete Vor-/Nachprojektionen. Diese Belege stammen ausschließlich von der flüchtigen synthetischen Signaturgegenstelle; sie behaupten keine real erfüllten Pflichten.

Überlappung wird abgewiesen; disjunkte Gruppen brauchen nach fremden Schritten neue Bewertungen. Die reservierte attempt_id/Epoche wird nicht angepasst. `ABORT_UNSTARTED` benötigt eine neue signierte Bewertung und einen committeten Nichtvollzugs-/endgültigen Revokationsbeleg für den ungestarteten alten Versuch. Erst danach kann eine neue unveränderliche Manifestrevision entstehen. UNKNOWN, vorhandener Testeffekt und gestartete alte Versuche erlauben diesen Weg nicht.

Vor Guardmutationen werden konkrete Primärschlüssel, vollständige Vorwerte und berechnete Nachwerte gebunden. Der Prüfer vergleicht anschließend die exakte gesamte Projektion. Admission-/Use-Transitionsprojektionen werden mit virtuellen, vollständig bestimmten neuen Journalzeilen vor deren INSERT berechnet. Die zwei eigenen Projektionscommitments werden bei der Transitionskanonisierung ausgeschlossen, um einen Hashzyklus zu vermeiden. Es gibt keine allgemeine Differenz-Allowlist. Zusätzliche fremde Änderungen führen zur Ablehnung.

Ingress braucht nur das Gate und keinen verfügbaren Ziel-FK. Er speichert Receipt, Empfangsrevision und Stop atomar. Gleiche Eventidentität/anderer authentischer Inhalt bleibt ein weiterer konfliktbehafteter Receipt. Zuordnung ist getrennt, bindet den genauen Versuch und eröffnet kein rückwirkendes Ready. Ein Receipt ist kein Ack vor Commit. Reconciliation erwartet die exakt berechnete Empfangsänderung; zusätzliche Revisionen stoppen.

`tests/psttg-v2-test-peer.mjs` hält registrierte Versuche, simulierte Effekte, endgültige Revokationen und Betriebsinkarnation außerhalb des DB-Rollbacks. Effektprüfung und Append sind synchron. Die Restoreprüfung rekonstruiert ein früheres logisches Abbild in einer zweiten PostgreSQL-17-Wegwerf-DB, installiert alle Schutzgrenzen und setzt vor normaler Nutzung die unabhängige Quarantäne. Alte Tickets/Nutzungen bleiben blockiert; unabhängiger Ingress bleibt erreichbar. Keine physische Backup-/PITR-/Speicherüberschreibungsbehauptung.

## Abnahmezuordnung

| V112 Abschnitt 9 | Konkreter Testpfad |
|---|---|
| Ready/Fence; Herkunft/Admission | Native dependency races record/copy/correction; provenance/admission, jeweils beide Reihenfolgen |
| Parallele Admissions/Idempotenz | same/conflict/different, beide Reihenfolgen; genau eine bzw. zwei Bedarfsregistrierungen |
| Copy bei gleicher O5-Generation | Lokale exakte Revisionsprüfung plus native Copy/Fence-Reihenfolgen |
| Korrektur/Seal/Fence | Tatsächliche Originalwerte, committeter Extraktionsersatz, Zusatzinput-Ablehnung, native Korrektur/Fence-Reihenfolgen |
| Überlappende/disjunkte Manifeste | Native beide Reihenfolgen; fremder Snapshot abgelehnt; Neubewertung; O5 bleibt open |
| Wachstum/Snapshots/Revisionen | Native Wachstum→40001; RR-Ablehnung; falsche Tags/Versionen/Epochen; reservierte Epoche und neue Manifestrevision |
| Inhalt/Fragmente/Gruppen | V111-Regression zusätzlich mit installiertem Add-on; vorhandene vorbereitete End-/Korruptionsfixtures bleiben ausdrücklich solche |
| Ingress/Versuch | Native beide Gate-Reihenfolgen; keine neue Ausgabe bei vorherigem Stop |
| Rollback/Ack/Konflikt | Native unabhängige Sicht vor/nach Commit, verlorene Antwort und Replay; Konfliktinhalt separat erhalten |
| Eigene/Fremdprojektion | Exakte Projektionen in jedem Unitübergang; volle Daten-/Definitions-/Rechteinvarianz bei Ablehnungen |
| Restore | Zweite native DB, älteres logisches Abbild und unverändert unabhängiger Peerstand |
| Metadaten/Rollen/Leser | Vollständige neue Headerinventur, unabhängige DEKs, ACL/Immutable-Prüfungen, Dispatcher, unveränderte Leserflags |

A01–A34, K5-E01–E20 und ER01–ER20 behalten ihre bisherigen Grenzen. Die CI führt K1/K3, K2/K4, K5, V111, den Anschluss, V111 mit Anschluss, Bestandsinvarianz, native L1/C-/B1-/D3-/D4-/D1/D2-/G1–G5-/T2-Kette, Upgrade-/Readiness sowie bestehende Tax-/Seller-/Vertrags-/Paymenttests aus. Lokale PGlite-Ergebnisse sind Vorprüfungen, keine PostgreSQL-17-Abnahme. Scanner/Battle/PStTG müssen am veröffentlichten Kandidaten erfolgreich enden.

## Offen

Reale Quellen/Fachklassen, Producer, Unit-Autorisierer, Endadapter, Artefakt-/Providerkanäle, Schlüssel-/Restorebetrieb, Hold-/Workeranschluss, Migration und physische Entfernung bleiben offen. K5-v1-Klartextinputbefund wird nicht bereinigt. Leserflags bleiben `removal_authorized=false`, `external_coverage_complete=false`, `other_obligations=not_evaluated`.

Provisionsrechnungen und PStTG-Steuerdaten-/Schwellen-/Mitwirkungsprozess bleiben separat OPEN. Monatliche Sammelabrechnung bleibt Empfehlung, maximal 4 Prozent Verkäufergesamtgebühr einschließlich Stripe unverändert. Keine Beta-Bereinigung, keine Live-Nutzerdatenabfrage oder Provideraktion. Production/Staging, L2-/D3-HARD-STOP und B1-/C-/L1-Grenzen unverändert. Kein vollständiger PStTG-, Lösch-Lifecycle- oder Live-PASS.
