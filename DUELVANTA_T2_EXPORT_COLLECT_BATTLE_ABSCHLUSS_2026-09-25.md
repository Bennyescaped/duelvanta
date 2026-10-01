# DUELVANTA – T2 Export COLLECT/BATTLE: Abschluss

Dateiname gemäß V66-Fortführung: 25.09.2026. Tatsächliche Ausführung, Remoteprüfung und Abschluss: **26.09.2026**. Isolierter Branch-Kandidat; Production bleibt NO-GO.

## Ergebnis und verbindlicher Umfang

**PASS für den beauftragten T2-Teilblock:** eindeutig eigene Scanner-Reservierungs-, Usage- und historische Accountingdaten sowie eigene BATTLE-Teilnahme werden im bestehenden Export ergänzt. Pickup ist ausschließlich über den vorhandenen sicheren Helfer wieder eingebunden. Keine Erasure-, Retention- oder Hold-Änderung. T2 insgesamt ist damit nicht pauschal abgeschlossen; insbesondere unklare Drittdaten, Reports, Providerkopien und destruktive Datenrechte bleiben außerhalb dieser Abnahme.

Grundlagen: V66; `DUELVANTA_ITRECHT_SCOPE_ABGLEICH_COLLECT_BATTLE_2026-09-25.md`; dort referenzierte V64/Provider- und Legalnachweise; tatsächliche versionierte Schema-/Exportquellen; ausdrückliche Betreiberfreigabe für das bestehende einzelne Export-Audit-Event. Keine neue Rechtsentscheidung.

## Frischer Repository- und CI-Nachweis

| Gegenstand | Nachweis am 26.09.2026 |
|---|---|
| Repository / einziger Entwicklungsbranch | Bennyescaped/duelvanta / marketplace-ux-v1 |
| Remote vor Umsetzung | `556469f879d6104e33b37e721278a8f3d10678fd` |
| Geprüfter technischer Remote-Kandidat | `2973b83a9d9a077406ca295d8a8669ceef3dd715` |
| Technischer Git-Tree | `fdc4fc819fe21e6054c4c2c1b171de0658a3859c` – identisch mit isoliert geprüftem lokalen Tree |
| main unverändert | `50f88213571be13255bb52eb489cc28cca660001` |
| PR #5 | open, Draft, unmerged; frische API-Metadaten, nicht veralteter PR-Beschreibungstext |
| Baseline-CI | Scanner #734 / Battle #210 SUCCESS |
| Kandidaten-CI | [Scanner #735](https://github.com/Bennyescaped/duelvanta/actions/runs/36226086945) und [Battle #211](https://github.com/Bennyescaped/duelvanta/actions/runs/36226086946) vollständig SUCCESS |
| Scanner-Jobs | production_upgrade_p001, quota_database, account_data_export_t2, collect_f3_database, validate: sämtlich SUCCESS |
| Preview | Automatisch ausgelöster Vercel-Preview-Status SUCCESS; kein Production-Deployment |

Der technische Head ist der konkrete Abnahmegegenstand. Die anschließende reine Dokumentationsrevision enthält diesen Bericht, V67 und originale native JSON-Nachweise; ihre Commit-ID ist naturgemäß nicht in sich selbst eingebettet. Vor Beendigung wird auch der abschließende Remote-Head samt vollständiger CI frisch geprüft. Ein historisch divergierender lokaler Branch wurde eingeordnet und unverändert belassen; Umsetzung erfolgte in einem isolierten Checkout des tatsächlichen Remote-Stands. Veröffentlichung ausschließlich als Fast-forward auf marketplace-ux-v1, ohne Force und ohne main-/PR-Statusänderung.

## Tatsächlicher Ausgangsbefund und Korrektur

Die vollständige rekonstruierte P0-Baseline liefert tatsächlich Export **V1**: Eine spätere Legal-Migration überschreibt den früheren V2-Export und entfernt dabei den Pickup-Eintrag. Der sichere Helfer `dv_market_private.pickup_messages_for_export(uuid)` existiert unverändert. Der neue V3-Export erhält sämtliche aktuellen V1-Bestandteile einschließlich Widerrufen und ruft für Pickup ausschließlich diesen vorhandenen Helfer auf. Keine parallele Pickup-Logik, keine Änderung seines Gesprächsmodells oder seiner Funktion.

Der neue private, parameterlose STABLE-Helfer `dv_market_private.collect_battle_export_for_caller()` bindet die Auswahl an `auth.uid()`, nutzt schemaqualifizierte Objekte und explizite Feldlisten. Direktaufruf durch public/anon/authenticated/service_role ist gesperrt. Die vorhandenen öffentlichen RPC-Rechte bleiben unverändert: service_role hat historisch EXECUTE; ohne Subjekt scheitert der Aufruf, mit vertrauenswürdigem Auth-Subjekt bleibt er auf dieses Subjekt begrenzt. Keine neue Nutzer-ID als Exportparameter und keine Staff-/Owner-Ausweitung.

## Tabelle-/Feld-/Owner-Inventar

Verbindliche vollständige Einzelmatrix: `docs/account-data-export-collect-battle-field-matrix-v1.md`; maschinenlesbar `database/account-data-export-collect-battle-fields-v1.json`. **196 tatsächlich vorhandene Felder aus 25 relevanten Tabellen** sind jeweils mit Schema, Typ, Ownerfilter, Aufnahme/Ausschluss/Projektion bzw. konkretem Rest und Begründung erfasst. Der Test gleicht die Matrix gegen das isoliert rekonstruierte Schema ab. Kein Schema wurde aus einer angenommenen Handoutbeschreibung erfunden; keine echten Nutzerdatensätze oder Providerinhalte wurden dafür abgerufen.

| Bereich | Aufnahme / sichere eigene Projektion | Ausschluss / Grenze |
|---|---|---|
| openai_scan_reservation | Eigene Request-, Wochen-, Bildhash-, TCG-/Typ-, Reservierungs-, Wechselkurs-, Kosten-, Tokenanzahl- und Zeitfelder; settled und unsettled | Fremde Zeilen; keine Zugangstokens. Tokenanzahlen sind Abrechnungswerte |
| openai_weekly_usage | Eigene Wochen-/Raw-/Slab-Nutzungszahlen | Fremde Usage |
| Historische scan_reservation / scan_weekly_usage | Eigene historische Reservierungen, Credits, Wochenzählungen und Zeit-/Request-/Hashfelder | Globaler period_id und nicht individuell zurechenbare Kosten-/Import-/Policybestände |
| BATTLE matches | Eigene Teilnahme, Matchkontext, Status/Zeitwerte; eigene Rolle, eigene Bereitschaft, eigenes Ergebnis/Report als self/opponent/draw | Keine rohen Gegenpartei-IDs, Namen, Titel, private Moderation oder Invite-/Sessiondaten |
| Ratings / rating events | Eigene Bewertung, Spiele/Zählungen, eigene Vorher-/Nachher-/Delta-/Ergebniswerte | Fremde Ratings und Teilnehmerkennungen |
| Signals | Nur Metadaten selbst gesendeter Signale | Gesamter Signalpayload, SDP/ICE und fremde Signale |
| Zuschauer-Grants / Presence / Media Consents | Nur eigene Matchzuordnung, vorhandene Ablauf-/Zustimmungs-/Versions-/Zeitfelder | Session-/Tab-/Generation-/Epochkennungen; keine Admission-, Refresh- oder Cleanup-Aufrufe |
| Reports / Staff / Judge / interne Konfiguration | Keine Aufnahme | Unklare Dritt-/Fallinhalte und privilegierte Betriebsdaten bleiben separat; keine juristische Freigabe unterstellt |
| Pickup | Bestehender sicherer Helfer unverändert | Keine rohe Gegenpartei-ID; vorhandene self/other-Gesprächsinhalte bleiben wie bisher |

Die bestehende Marketplace-Ausgabe wurde nicht neu juristisch bewertet. Der Fremddaten-/Secret-Nachweis gilt für die strikten neuen Projektionen, die synthetischen Canary-Datensätze im gesamten Export und die unveränderte sichere Pickup-Abbildung. Er ist keine pauschale Behauptung, dass beliebige historische Freitexte niemals Angaben Dritter enthalten könnten.

## Einzige persistente Export-Schreiboperation

Pro erfolgreichem Aufruf bleibt **genau ein INSERT in `dv_market_private.user_data_export_events`** bestehen. Das ist die ausdrücklich erlaubte Ausnahme. Der Mechanismus, seine Felder, Trigger und Aufbewahrung wurden nicht erweitert. Nur der vorhandene Versionswert lautet technisch folgerichtig `duelvanta-data-export-v3`; der bestehende SHA-256 bindet das tatsächlich erweiterte vollständige JSON und der Nutzerhash das anfragende Subjekt.

Keine weiteren persistenten Schreiboperationen: Scanner, Collection, BATTLE, Quoten, Budgets, Matchintegrität, Profile, bestehende Auditzeilen, Holds und Erasure bleiben unverändert. Der Export bereinigt insbesondere weder abgelaufene Presence noch widerrufene Consentbestände.

## Isolierter Nachweis

| Prüfung | Ergebnis |
|---|---|
| Lokale PGlite-T2-Tests ohne / mit bestehendem P0-05-Kandidaten | jeweils 14/14 PASS |
| Native PostgreSQL 17.11, ohne / mit P0-05-Kandidaten | jeweils **14/14 PASS** |
| Vollständige native Rekonstruktion: 72 historische Migrationen, 60 Upgrade-Schritte, P0-05 und anschließend T2 | PASS; Security-/Legal-Readiness passend, V3-Smoke PASS |
| Bestehende P0-05-Testgruppen im Rehearsal | 20/20 PASS |
| Bestehende Data-Rights-/Pickup-Vertrags- und UI-Regressionsprüfungen | PASS |
| Alte unveränderte Readiness-Reproduktion und neue T2-Varianten | PASS; alter Vertrag weist T2 erwartungsgemäß ab |
| Gesamte GitHub-Regressions-CI des technischen Heads | Scanner #735 und Battle #211 SUCCESS |

Sechs synthetische Identitäten: zwei befüllte Nutzer, unbeteiligter Dritter, leerer Nutzer, eingeschränkter historischer Nutzer, Owner. Geprüft: beide Matchseiten, waiting/draw, eigene aktuelle und historische Scannerbestände, leere Bestände, Wiederholung bis auf generated_at identisch, keine Rollenausweitung, fehlendes Auth-Subjekt/anon abgewiesen, private Helfer gesperrt, unbekannte künftige Spalten ausgeschlossen. Secret-/Token-/Signal-/Report-/Staff-/Fremd-Canaries dürfen nicht erscheinen.

In beiden Varianten werden **96 persistente Tabellen und 15 Sequenzen** geprüft. BEFORE-STATEMENT-Guards weisen INSERT/UPDATE/DELETE/TRUNCATE außerhalb des erlaubten Audit-INSERT zurück – auch wirkungslose DML mit null betroffenen Zeilen. Vor/nach jedem geprüften Aufruf werden sämtliche persistenten Zeilenbestände und Sequenzpositionen verglichen. Frühere Auditzeilen bleiben identisch, exakt ein neues Audit-Event muss korrekte Nutzer-/Versions-/Payloadhashes tragen. Historische Fixtures werden ausschließlich vor diesen Exportprüfungen in der isolierten Testdatenbank hergestellt; beim Export sind Originaltrigger aktiv. Keine Live-Schutzfunktion abgeschaltet.

Die native Ausführung erfolgte in der lokalen PostgreSQL-Serviceinstanz von GitHub Actions. Ein lokaler Container-Start war wegen Betriebssystemrechten nicht möglich; lokale PGlite-Ergebnisse werden deshalb nicht als native Evidenz ausgegeben.

Originale native JSON-Nachweise liegen in `evidence/t2-export-20260926/`. Artefakt #10900797836 (`account-data-export-t2-evidence`), Scanner #735; ZIP-SHA-256 `17e0a23a00cb822e9c9b16cba39ec71c0e710a50c75c55ccccbbbfbcf34c46a6`. `artifact-manifest.json` bindet technischen Head und Einzeldateihashes. Keine produktiven Datensätze oder Secrets enthalten.

## P0-Integrität, Anwendung und verbleibende Grenzen

P0-01 bis P0-05 behalten ihre dokumentierten V61/V59/V57/V56/V55-Abnahmegrenzen. P0-01-Manifest und ursprüngliche SQL-/Readinessdateien sind unverändert. T2 ist ein zusätzlicher Branch-Kandidat, keine bereits angewandte Migration. Der zukünftige ausdrücklich autorisierte Rollout muss T2 samt Hashes und passendem finalen Readinessvertrag in sein Manifest aufnehmen: nach P0-Stack, bei Verwendung des TRADE-Locks nach dessen Kandidaten. Dafür stehen getrennte T2-Verträge ohne und mit Lock bereit. Kein alter Vertrag darf irrtümlich als Abschlussvertrag des geänderten Katalogs dienen.

Nicht neu attestiert: aktueller Live-Katalog, Providerkopien, Production-/Staging-Runtime, juristische Vollständigkeit, neue Löschfristen, externe Verträge. Es wurden keine Live-Datenbanken verändert. Gespeicherte Production-Umgebung bleibt ohne durch diesen Auftrag ausgelöste Aktivierung; PITR bleibt nach verbindlicher Vorgabe OFF.

Rest: unklare Report-/Drittfelder und Providerexporte gezielt fachlich klären; destruktive Datenrechte, Retention und Hold-Pfadabdeckung getrennt bearbeiten. Das sind keine Blocker des hier bestandenen sicheren Exportteilblocks. Kein allgemeines externes Rechtsmandat wird als Voraussetzung für technische Weiterarbeit eingeführt.

## Ausdrücklich nicht ausgeführt

Keine Production-/Staging-Migration oder -Mutation; kein Merge, main-Eingriff, Production-Deploy oder Live-P0-05-Lock; keine Umsetzung T1/T3–T6, Rechtstextänderung, Erasure, Löschung, Anonymisierung, Retention-/Hold-Änderung. Kein Stripe, Zahlung/Refund/Payout, echte E-Mail, Kontakt zu Kanzlei/Provider/Steuerberatung, kostenpflichtige Beauftragung oder Vertrags-/AVV-/DPA-Annahme. Keine Domain-/DNS-/SMTP-/Key-/Auth-Änderung, PITR-Aktivierung oder TinyFish. Ausschließlich autorisierter Branch-Push mit automatischem Preview und isolierte Testdatenbank-Schreiboperationen.

Nächster Block ausschließlich gemäß V67, **nicht begonnen**. Beide Abschlussdokumente werden zusätzlich in den gemeinsamen DUELVANTA-Projektdateien abgelegt. STOP.
