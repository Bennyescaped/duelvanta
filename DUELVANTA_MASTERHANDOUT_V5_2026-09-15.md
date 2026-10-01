# DUELVANTA – Masterhandout V5

Stand: 15.09.2026. Produktionsfreigabe-Vorbereitung nach V4: ergänzende Prüfung, Blockerregister und kontrollierter Rollout-/Rollbackplan. **KEINE Produktionsfreigabe.**

## 1. Verbindlichkeit und Arbeitsstand

V5 ersetzt widersprechende Aussagen des vorangegangenen Auditberichts. V4 bleibt die Detailreferenz für die abgeschlossenen Funktionsabnahmen. Insbesondere bedeutet eine grüne Stripe-Sandbox-Abnahme weder vollständige Preview-Isolation noch fertige Live-Payments.

| Kennung | Stand |
|---|---|
| Repository | `Bennyescaped/duelvanta` |
| Entwicklungsbranch | `marketplace-ux-v1` |
| Geprüfter technischer Code-Checkpoint | `d1bb533c9ca69a9d33c99bd4378d419abeca897e` – unverändert |
| Branch-Head vor Ablage V5 | `30d372aee483705565288cd00a71a282482d4ad4` – V4-Dokumentation |
| V4 im Repository | `DUELVANTA_MASTERHANDOUT_V4_2026-09-15.md` |
| V5 im Repository | `DUELVANTA_MASTERHANDOUT_V5_2026-09-15.md` – diese Datei; einbringenden Dokumentationscommit über GitHub ermitteln |
| PR | #5: offen, Draft, nicht gemergt; erneut gelesen |
| main | `50f88213571be13255bb52eb489cc28cca660001`; unverändert |
| Technisches Preview | `dpl_3dnWuS1v6ccLLDB4ACr4pWWTf6uh`, zuletzt verifiziert READY, Code `d1bb533…` |
| V4-Dokumentationspreview | `dpl_32aeKva3DHk8K8xVveLf5aSx1fjM`, zuletzt verifiziert READY, Code `30d372…` |
| Vercel-Projekt / Team | `prj_dAtH0I1mwiHhOsA64J3iq97SoVnd` / `team_VHCwSwfBWANJvmS3qdkpJ0dK` |
| Staging | `xhmjxrcskfhbovhitdej`; ausschließlich hier lesende SQL-Abfragen |
| Produktionsprojekt-Referenz im Code | `enifiaqsnqtbzylnfrpi`; in dieser Fortsetzung NICHT abgefragt oder verändert |
| Bestehende CI-Evidenz | Run #216 / `34950605548`: success für `d1bb533…`; #217 / `34950810408`: success für V4-Dokumentationsstand |

V5 ist eine reine Dokumentationsänderung. Es wurden keine Produktcode-, Schema-, Berechtigungs-, Secret-, Tarif- oder Konfigurationsänderungen vorgenommen. Automatische CI-/Preview-Reaktionen auf den Dokumentationscommit sind keine neue fachliche Abnahme. Ein beweglicher Branch-Alias ersetzt nicht die obige feste Deployment-ID.

## 2. Unveränderliche Grenzen

Entwicklung nur auf Entwicklungsbranch, Preview und Staging. Kein Merge, kein Entwurf-Statuswechsel der PR, keine Änderung an main, Produktions-Supabase, produktiven Domains oder Live-Konfigurationen. Keine Live-Zahlung, Erstattung oder Auszahlung. Sandbox nicht reaktivieren, außer ein ausdrücklich neuer Abnahmeschritt benötigt dies.

`v-logo.svg` niemals verändern oder nachbauen. Slogan unverändert: **COLLECT. TRADE. BATTLE.** COLLECT, BATTLE, PROFILE und stabile TRADE-Bereiche nicht nebenbei umbauen. Die unten bestätigte PROFILE-Konfigurationslücke rechtfertigt später eine eng begrenzte Sicherheitskorrektur, kein Redesign.

Payment-, Steuer-, Vertrags- und Refund-Belege bleiben unveränderlich. Kein zweiter Refundpfad. Keine Staging-Nutzer, Bestellungen, Provider-IDs oder Schlüssel nach Produktion kopieren. Keine Secrets, personenbezogenen Exporte oder Datenbankbackups im öffentlichen Repository ablegen.

Compact Development Mode: gezielte Prüfungen, minimale Änderungen, keine Login-/Stripe-Schleifen. Keine abgeschlossenen Tests ohne neue Regression wiederholen.

## 3. Abgeschlossene Abnahmen bleiben geschlossen

Aus V4 unverändert übernommen, in diesem Block NICHT erneut ausgeführt: Stripe-Connect-Onboarding; erfolgreiche und fehlgeschlagene Testzahlung; Webhook-Wiederzustellung/Idempotenz; vollständiger Refund; Refund-ID-Reconciliation; Teilrefund-Schutz; Payout-Sicherheit; Datenexport; Löschblocker; RLS-/Browserzugriffsgrenzen der geprüften Flows; vollständige Stripe-Sandbox-Abnahme; Versand → Erhalt → Abschluss mit Payment-Gates und Benachrichtigungen; Verkäufer-Versandprofile; Combined Shipping mit manuellem Fallback; Provider-Resolution-UX; TRADE-Browserabnahme Mobile/Desktop.

Diese Evidenz gilt für ihren geprüften Umfang. Sie belegt ausdrücklich NICHT den vollständigen Storage-/Auth-Lösch-Worker, jede Preview-Seite oder einen Live-Paymentmodus. Die neuen Findings unten heben die abgeschlossenen Payment-Tests nicht pauschal auf.

## 4. Neu gesicherte Befunde und Korrekturen zum ersten Audit

### F01 – PROFILE ist nicht von Produktion isoliert: bestätigter Codefehler

`profile.html` lädt den vorhandenen Runtime-Konfigurationsendpunkt nicht. `profile.js` erzeugt den Client weiterhin mit der fest eingebauten Produktions-URL und veröffentlicht ihn als `window.__dvAppDb`. Das neue `profile-data-rights.js` verwendet genau diesen Client für Datenexport, Löschantrag und Abmeldung.

Damit ist auch auf einem Preview-Host ein Produktionszugriff möglich, insbesondere bei vorhandener Produktionssession auf diesem Host. Ein Staging-Login allein erzeugt nicht automatisch eine Produktionssession. Die Produktions-URL im Code ist bewiesen; ein tatsächlicher unbefugter Datenzugriff wurde weder behauptet noch ausprobiert. Die sichtbaren Publishable Keys sind keine Service-Role-Secrets.

Die vorherige Aussage zur sicheren Preview-Trennung galt nur für die geprüften TRADE-/Login-Einstiege. `tests/supabase-runtime-config-test.mjs` umfasst PROFILE bisher nicht. Bis zur Korrektur keine PROFILE- oder Datenschutzaktionen im Preview ausführen.

Minimaler Folgefix: `profile.html` vor dem Profilmodul an den bestehenden Runtime-Endpunkt anbinden; `profile.js` ausschließlich mit geprüfter `DV_SUPABASE`-Konfiguration initialisieren und bei fehlender Konfiguration geschlossen abbrechen; Cache-Versionen gezielt aktualisieren. Produktionsverhalten muss unverändert bleiben. Den vorhandenen lokalen Runtime-Test um PROFILE und fehlende/falsche Konfiguration erweitern; keine reale Kontolöschung testen.

### F02 – Lösch-Worker kollidiert mit Username-Schutz: bestätigter Integrationskonflikt

`prepare_account_deletion_data` setzt `profiles.username=null`, ohne den vorgesehenen internen Username-Freigabekontext zu setzen. Der aktive Trigger `guard_profile_username_direct_update` verweigert jede tatsächliche Username-Änderung ohne diesen Kontext.

Lesende Staging-Metadaten bestätigen: Trigger aktiviert; Worker leert Username; interner Freigabekontext im Worker fehlt. Bei einem bislang nicht leeren Username scheitert dieser Verarbeitungsschritt. Kein Löschlauf wurde ausgeführt. Die bereits geprüften Löschblocker sind davon zu unterscheiden.

Späterer Fix nur am kontrollierten Service-Role-Erasure-Pfad, mit isoliertem Test inklusive echtem Trigger. Niemals den globalen Username-Schutz entfernen. Außerdem Storage-/Auth-Aufrufe, Session-Entzug, Wiederanlauf und endgültige Retention-Freigabe separat abnehmen, ohne unveränderliche Belege zu löschen oder zu verändern.

### F03 – Live-Payments sind noch kein freischaltbares Produktfeature

`api/market-stripe-checkout.js` verlangt Testschlüssel und Test-Checkout-IDs. `api/market-stripe-webhook.js` akzeptiert nur `livemode=false`. In `database/market-stripe-connect-sandbox-v1.sql` erzwingen mehrere Constraints `live_mode=false`.

Ein Austausch der Schlüssel oder ein Setzen von `live_mode=true` reicht nicht. Erforderlich ist ein eigener, standardmäßig deaktivierter Live-Modus mit geprüfter Mandanten-/Umgebungstrennung, unveränderlichen Belegen und separat freigegebenen Tests. Vorhandenen Refundpfad weiterverwenden. Neue Zahlungsaufträge müssen unabhängig vom Empfang bereits ausgelöster Providerereignisse gestoppt werden können; der jetzige Sandbox-Schalter sperrt auch den Webhook.

### F04 – Datenbank und alter Frontendstand sind nicht automatisch rollback-kompatibel

`database/market-checkout-compliance-v1.sql` entzieht `authenticated` die Ausführung von `buy_market_listing_v2(...)`. Ein bloßer Vercel-Rollback stellt diese Rechte nicht wieder her. Die Verträglichkeit des konkreten Rückfallcodes mit dem neuen Schema muss vor dem Merge geprobt werden. Eine unkontrollierte Wiederfreigabe des alten Kaufpfads könnte neue Compliance-Prüfungen umgehen und ist keine sichere Standardlösung.

### Präzisierung älterer Warnungen

SECURITY-DEFINER-Advisorwarnungen sind nicht automatisch Exploits: öffentliche Lesefunktionen, intern geprüfte RPCs und Triggerfunktionen sind gesondert zu bewerten. Triggerfunktionen sind nicht allein wegen EXECUTE-Grants normal aufrufbare Datenänderungs-RPCs. Überbreite Rechte bleiben Härtungsarbeit; keine pauschale Umstellung auf SECURITY INVOKER.

Leaked-Password-Protection war auf Staging deaktiviert. Das beweist nicht denselben Produktionszustand. Die Supabase-Funktion erfordert laut aktueller Dokumentation Pro oder höher; keine kostenpflichtige Umstellung wurde veranlasst.

Die bisherige GitHub-Code-Suche meldete unvollständige Ergebnisse. **Kein vollständiger Secret- oder Historien-Scan wurde nachgewiesen.** `.gitignore` mit nur `.env.local` ist eine Präventionslücke, kein Beweis eines Secret-Leaks.

## 5. Aktuell lesend bestätigte Staging-/Hostingwerte

| Wert | Ergebnis |
|---|---|
| `sandbox_enabled` / `live_mode` | `false` / `false` |
| `platform_fee_tax_treatment` | `review_required` |
| `seller_invoice_issuance_enabled` | `false` |
| `seller_onboarding_enforced` | `false` |
| `tax_identifier_required_for_activation` | `true` |
| `seller_terms_version` | `seller-beta-2026-09` |
| Staging `cron.job` | nicht vorhanden; externe Scheduler dadurch NICHT ausgeschlossen |
| Vercel-Teamplan | erneut über Connector gelesen: `hobby` |

Für Dispatcher und Lösch-Worker sind im Code ENV-Schalter und Service-Role-RPCs vorhanden. Die geprüften Claim-Funktionen besitzen keinen zusätzlichen eigenen DB-Aktivierungsschalter. Eine pauschale Behauptung „doppelt durch ENV und DB deaktiviert“ ist für diese Worker nicht belegt. Ihre effektiven Deployment-ENV-Werte, externe Scheduler, E-Mail-Domainfreigabe und Zustellereignisse wurden hier nicht unabhängig verifiziert.

## 6. Verbindliches Go-Live-Blockerregister

„Offen / nicht nachgewiesen“ bedeutet keine Behauptung, die betreffende Maßnahme existiere definitiv nicht. Externe Freigaben benötigen einen privaten, datierten Nachweis; keine sensiblen Unterlagen ins Repository.

| ID | Offener Punkt / Evidenz | Abschlusskriterium und Verantwortung |
|---|---|---|
| B01 | PROFILE-Preview-Isolation, F01 | Engineering: eng begrenzter Fix, lokale Negativtests und Prüfung des korrigierten Preview-Artefakts ohne Produktionszugriff. |
| B02 | Erasure-/Retention-Betrieb, F02 | Engineering + Datenschutz/Rechtsprüfung: Triggerkonflikt behoben; Storage/Auth, Session-Entzug, Wiederanlauf, Fristablauf und gesetzliche Holds abgenommen; verantwortlicher Betreiber und Scheduler dokumentiert. |
| B03 | Live-Paymentimplementierung, F03 | Engineering + Betreiber/Stripe: separater deaktivierter Live-Modus vollständig implementiert und abgenommen. Sandbox-Erfolg nicht als Live-Freigabe verbuchen. |
| B04 | Release-Governance | Betreiber: main-Schutz mit PR-/CI-Pflicht, Force-Push-/Delete-Sperre und kontrolliertem Notfallweg; wirksame Regeln nachweisen. Bisher `protected=false`, keine Rulesets. CI-Filter für zukünftige Profil-/Hardeningänderungen mitprüfen. |
| B05 | Secret-/Supply-Chain-Hygiene | Engineering: `.gitignore` erweitern, vollständigen aktuellen und historischen Secret-Scan durchführen; Treffer einzeln prüfen, echte Secrets gegebenenfalls rotieren. Öffentliches Supabase-Publishable-Key-Material nicht fälschlich als Secret behandeln. |
| B06 | Auth-/Berechtigungsfreigabe | Engineering + Betreiber: Produktions-Auth tatsächlich prüfen; MFA/Step-up für Owner und sensible Vorgänge, Session-/Recovery-Schutz und Passwortschutz festlegen; Advisor-Ausnahmen begründen. Kein pauschales Entfernen funktionsnotwendiger RPC-Rechte. |
| B07 | Rechtliche Schlussprüfung | Betreiber + qualifizierte Rechtsprüfung: Betreiber-/Verkäuferrollen, Bedingungen, C2C/B2C-Informationen, Widerruf, Bestätigung, DSA-Anwendbarkeit, Datenschutz, Dienstleisterverträge, Transfers und gegebenenfalls Consent freigeben. Vorhandene Texte sind keine anwaltliche Freigabe. |
| B08 | Steuerliche Schlussprüfung | Betreiber + Steuerberatung: Gebührenmodell, Umsatzsteuer, Belegketten, PStTG/DAC7-Sorgfalt/Export/Fristen und Retention bestätigen; `review_required` nur nach Freigabe durch richtige Regel ersetzen. Keine pauschale 19-%-Annahme. |
| B09 | Betreiberstatus / Gewerbe | Benjamin Fritz: vorgesehenes Einzelunternehmen, tatsächlichen Betriebsbeginn und passende Gewerbeanzeige sowie finale Betreiberangaben nachweisen. Anmeldung nicht als bereits erledigt behandeln. |
| B10 | Kommerzieller Hostingbetrieb | Betreiber: kommerziell zulässigen Vercel-Tarif freigeben; Hobby ist laut Vercel nicht dafür bestimmt. Kostenbudget und Providerlimits dokumentieren. Keine automatische Tarifbuchung. |
| B11 | Produktionskonfiguration / Migrationen | Engineering: reale Produktionsbaseline lesend erheben, exaktes Delta-/Checksum-Manifest und Schema-Kompatibilität erstellen; Auth-Redirects, Storage, RLS, Schlüsselherkunft, Laufzeit und Umgebungszuordnung prüfen. Keine Staging-Vollkopie. |
| B12 | Live-Stripe-Konfiguration und Freigabe | Betreiber + Engineering: Geschäfts-/Connect-Freigabe, produktive Kontozuordnung, API-Version, getrennte Secrets, Signaturprüfung, Events, Gebühren und Support-/Disputezuständigkeit nachweisen; ausdrückliche spätere Live-Autorisierung. |
| B13 | E-Mail / Dispatcher | Engineering + Betreiber: Resend-Senderdomain/DNS und Vertrag, geschützter POST-Scheduler, Wiederholungs-/Deduplizierungsregeln, Bounce-/Delivery-Rückmeldung und Alerts freigeben. „Provider angenommen“ nicht als „zugestellt“ ausgeben. Vercel-Cron-GET nicht ungeprüft an einen POST-only-Handler hängen. |
| B14 | Monitoring / Logging / Incident | Betreiber + Engineering: Alarmempfänger, Vertretung, Zahlungs-/Webhookrückstände, Outboxfehler, Erasurefehler, Sicherheitsereignisse, Secretschutz und Vorfallsrunbook nachweisen. Keine Rohpayloads oder personenbezogenen Exporte in Logs. |
| B15 | Rollback / Restore / Schreibsperre | Engineering + Betreiber: getesteten Rückfallstand, rückwärtsverträgliches Schema oder sicheren Kompatibilitätspfad, DB- UND Storage-Wiederherstellung, vereinbarte RPO/RTO und wirksame direkte RPC-Schreibsperre nachweisen; F04 beachten. |

Die unmittelbare technische Priorität ist B01, danach B02. Rechts-/Steuer-/Betreiberfreigaben und Tarifentscheidungen sind keine Aufgaben, die durch grüne Softwaretests ersetzt werden können.

## 7. Rolloutplan – NUR PLAN, NICHT AUSFÜHREN

### 7.1 Vorbedingungen und Migrationsmanifest

Kein Merge des jetzigen Checkpoints. Erst B01/B02 und die übrigen Releaseblocker schließen und einen neuen, exakt bezeichneten Releasekandidaten bilden. Tests auf betroffene Risiken begrenzen; komplette Sandbox-Abnahme nur bei begründeter neuer Payment-Regression.

Das produktive Delta ist noch nicht ausführbar freigegeben, weil die echte Produktionsbaseline hier nicht untersucht wurde. Bereits vorhandene SQL-Dateien nicht blind erneut anwenden. Für das spätere Manifest gilt folgende Abhängigkeitsreihenfolge, jeweils nur für tatsächlich fehlende/abweichende Komponenten:

| Reihenfolge | Review-Dateien unter `database/` |
|---|---|
| 1 | `market-seller-compliance-v1.sql` |
| 2 | `market-notice-action-v1.sql` |
| 3 | `market-checkout-compliance-v1.sql` |
| 4 | `market-tax-transparency-v1.sql` |
| 5 | `account-data-rights-v1.sql` |
| 6 | `market-stripe-connect-sandbox-v1.sql` – deaktiviertes Fundament, KEIN Live-Modus |
| 7 | `market-stripe-payment-result-columns-v1.sql` |
| 8 | `trade-actions-column-aliases-v1.sql` |
| 9 | `market-stripe-event-ordering-hardening-v1.sql` |
| 10 | `market-stripe-refund-evidence-hardening-v1.sql` in finaler unveränderlichkeitskonformer Fassung |
| 11 | `trade-order-lifecycle-payment-hardening-v1.sql` nach den älteren Action-/Lifecycledefinitionen |
| 12 | `pgcrypto-digest-schema-hardening-v1.sql` nach allen relevanten Funktionsersetzungen; vertrauenswürdiges `extensions`-Schema verifizieren |

Zusätzlich die Änderungen an `trade-order-resolution-v1.sql` und `trade-order-resolution-v1-hardening.sql` als gezieltes Delta einordnen. Künftige B02-/Live-Modus-Patches ergänzen das Manifest erst nach ihrer Erstellung und Prüfung. Keine erfundenen Migrationsdateien ausführen.

Staging führt aktuell nur sieben Einträge im Migrationsjournal: Bucketanlage, pgcrypto-Härtung, Payment-Result-Spalten, Action-Aliase, Event-Ordering, Refund-Evidence und nachfolgende Refund-Immutability-Korrektur. Dieses Journal ist keine vollständige Rekonstruktion der installierten Basisschemas. Die bereits in V4 bestätigte Lifecycle-Härtung ist beispielsweise kein eigener Journalbeleg. Deshalb Definitionen, Grants, Trigger, Constraints und Checksums gegen den finalen Repository-Stand vergleichen; nicht nur Journalnamen zählen.

### 7.2 Kontrollierte Ausführungsreihenfolge nach gesonderter Freigabe

| Phase | Spätere Handlung | Zwingender Halt bei |
|---|---|---|
| A – Release einfrieren | Freigaben und neuen Release-SHA dokumentieren; PR erst dann aus Draft nehmen. Produktions-/Rollback-Deployment-ID und aktuelle DB-/ENV-Baseline privat sichern. | offener B01–B15-Punkt, unklarer SHA, fehlende verantwortliche Person |
| B – Bereitstellung entkoppeln | Automatische produktive Domainzuordnung und unkontrollierte Deployment-Hooks vor Merge kontrolliert aussetzen; funktionierende Zugriffssperre für den noch unveröffentlichten Produktionsbuild nachweisen. | Merge würde ungeprüfte Änderungen sofort öffentlich schalten |
| C – Transaktionen sichern | Geprüfte serverseitige Schreibsperre für neue Angebote/Käufe/Annahmen einlegen; direkte Supabase-RPCs berücksichtigen. DB- und Storage-Backup mit Wiederherstellungsnachweis sichern. Bereits laufende Providerereignisse weiter sicher bearbeiten. | nur UI-Wartungsbanner, fehlender Restore-Nachweis, ungeklärte laufende Vorgänge |
| D – Kontrollierter Merge | Erst jetzt genehmigten Releasekandidaten mit verpflichtend grüner CI mergen. Produktionsalias bleibt unverändert. | Head/Base-Drift, fehlende Checks, abweichender Mergeinhalt |
| E – Datenbankdelta | Nur freigegebenes Manifest auf Produktion anwenden; abbrechbare/transaktionale Schritte, nachvollziehbares Journal, Timeouts und anschließende Schema-/Grantprüfung. Bestehende Belege erhalten. | SQL-Fehler, unerwartete Grants/Tabellenänderungen, Integritätsverletzung |
| F – Supabase und ENV | Produktions-Auth/Redirects, Storage und minimale Rechte prüfen. Server-URL und zugehörige Keys konsistent setzen; niemals Staging-Keys. Worker bleiben aus. Der aktuelle öffentliche Runtime-Code verwendet fest die Produktionsreferenz – Server- und Browserzuordnung abgleichen. | gemischte Projekte, öffentliche Service-Role-/Secretwerte, ungetestete Auth-Konfiguration |
| G – Stripe separat vorbereiten | Erst mit fertigem B03 und ausdrücklicher Konfigurationsfreigabe produktive Konten/Versionen/Secrets/Webhookzuordnung vorbereiten. Neue Live-Zahlungsaufträge weiterhin blockieren. | Test-/Live-Vermischung, fehlende Signatur-/Kontoprüfung, ungeklärte Gebühren |
| H – Produktionsbuild ohne Öffentlichkeit | Mit Produktions-ENV neu bauen, noch keine Domainfreigabe. READ-only-Smoke für Version, Ressourcen, Konfiguration und Sperren. Keine echten Käufe, Mails, Löschungen oder Zahlungen als impliziten Test starten. | falscher SHA/Projektref, Fehlerantworten, offene Schreibpfade |
| I – Technische Domainfreigabe | Nach expliziter Freigabe nur den geprüften Produktionsbuild zuordnen; Transaktionssperre und deaktivierte Worker zunächst beibehalten. | falsche Domain-/Buildzuordnung oder neue Sicherheits-/Integritätsfehler |
| J – Betrieb freigeben | Freigegebene Bestätigungszustellung und Moderationsbetrieb vor Annahme neuer Verträge aktivieren. Erasure-/Retention-Worker erst nach B02-Abnahme und eigener Betriebsfreigabe aktivieren. Verkäufer-Enforcement kontrolliert aktivieren; Bestand prüfen, nicht automatisch umklassifizieren. | nicht zustellbare Bestätigungen, unbetreute Rückstände, fehlerhafte Löschung/Retention |
| K – Kommerzieller Start / Live-Payment | Eigene, ausdrückliche Freigabe für tatsächlichen Handel und für Live-Payments einholen. Nur dafür vorbereitete Betreiber-/Verkäuferkonten nutzen; Schreibsperren kontrolliert lösen. Kein pauschales Aktivieren aller Flags. | fehlende Rechts-/Steuer-/Betreiber-/Livefreigabe oder unzureichendes Monitoring |

Dieser Plan ist keine Erlaubnis für eine seiner produktiven Aktionen. Weder eine Vercel-Promotion noch ein bestandenes CI-Ergebnis erteilt eine Live-Zahlungsvollmacht.

### 7.3 ENV-Matrix des vorhandenen Codes

| Konfiguration | Vorgabe für spätere Vorbereitung |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Serverwerte gehören zum jeweiligen Projekt; Secret nur serverseitig; Preview ausschließlich Staging. |
| `SUPABASE_PUBLISHABLE_KEY` | öffentlicher Schlüssel des passenden Projekts; fehlende/falsche Zuordnung muss sicher abbrechen. |
| `DUELVANTA_PUBLIC_ORIGIN` | fest geprüfter HTTPS-Origin der jeweiligen Umgebung; keine beliebige Request-Host-Übernahme. |
| `STRIPE_CONNECT_SANDBOX_ENABLED` | bleibt deaktiviert; kein Schalter für produktive Zahlungen. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ACCOUNTS_V2_VERSION` | Live-Werte erst nach B03/B12; getrennt je Umgebung, niemals im Repository. |
| `COMPLIANCE_EMAIL_DELIVERY_ENABLED`, `COMPLIANCE_DISPATCH_SECRET`, `COMPLIANCE_EMAIL_FROM`, `RESEND_API_KEY` | Zustellung bis zur gesonderten Betriebsfreigabe aus; Scheduler authentisiert und POST-fähig. |
| `ACCOUNT_DATA_ERASURE_ENABLED`, `ACCOUNT_DATA_ERASURE_SECRET` | bis zur separaten Worker-Abnahme und Freigabe aus; keine Testlöschungen durch Aktivierung bestehender Queues. |

Noch nicht implementierte Live-/Wartungsschalter werden nicht als existierende Variablennamen dargestellt. Wirksame ENV-Änderungen erfordern einen neuen passenden Vercel-Build; ein alter Build wird dadurch nicht rückwirkend aktualisiert.

## 8. Abbruch- und Rollbackplan

Bei Projekt-/Key-Vermischung, unberechtigtem Datenzugriff, falschen Beträgen, Belegänderung, unsicherer Migration, unerwarteter Löschung oder fehlender Bestätigungszustellung sofort keine neuen Verträge/Zahlungsaufträge zulassen. Während der Einführung stoppt auch ein neuer ungeklärter Fehler im kritischen Pfad die nächste Phase. Nicht versuchsweise durch erneute Live-Zahlung diagnostizieren.

Engineering führt den technischen Rückfall aus; Benjamin Fritz entscheidet als Betreiber über Wiederaufnahme. Vertretung und Alarmkanal müssen vor Start konkret besetzt sein.

**Anwendungsrückfall:** Neue Schreibaufträge sperren, betroffene Worker anhalten, Vorfallzeitpunkt und IDs sichern. Nur auf eine vorab kompatibilitätsgeprüfte Produktions-Deployment-ID zurückschalten, nicht pauschal auf irgendein altes main-Deployment. Kein Force-Push, kein automatisches Revert-Merge.

**Datenbankrückfall:** Neue additive Daten und unveränderliche Belege behalten. Bevorzugt geprüfte Vorwärtskorrektur bzw. kompatible Funktionskorrektur bei geschlossenen Schreibpfaden. Keine DROP-/TRUNCATE-/Restore-Aktion als automatischen Bestandteil des Vercel-Rollbacks. Alte RPC-Rechte nicht ungeprüft wieder öffnen.

**Providerabgleich:** Bereits ausgelöste Zahlungs-/Refundereignisse müssen weiter authentisiert angenommen oder zuverlässig gesichert und später abgeglichen werden. Idempotenz beibehalten. Eine erfolgreiche Zahlung wird nicht allein wegen Deploymentrollback automatisch erstattet. Kein doppelter Refund oder erneuter Zahlungsauftrag.

**Desaster-Restore:** Nur nach ausdrücklicher Entscheidung, wenn ein normaler kompatibler Rückfall nicht reicht. DB und Storage getrennt behandeln; DB-Backups enthalten keine Storage-Dateien. Nach Restore zwischenzeitliche Providerereignisse und Aufträge abgleichen, bevor Schreibbetrieb wieder öffnet. RPO/RTO und die Wiederherstellungsprobe sind noch Freigabepunkte, keine gemessenen Zusagen.

## 9. Bewertung und nächster Arbeitsauftrag

Punkt 2 ist als Blockerregister erarbeitet. Punkt 3 ist als kontrollierter, nicht ausgeführter Rollout-/Rollbackplan dokumentiert. Punkt 4 ergibt: **NO-GO für Produktion und Live-Payments; Weiterentwicklung im isolierten Entwicklungszweig ist möglich.** Das ist keine Rücknahme der erfolgreichen Sandbox-/TRADE-Abnahmen, sondern die Trennung ihres Umfangs von Produktionsreife.

**Nächster technischer Block: B01 minimal beheben.** Zuerst Branch-Head/PR-Draft/main prüfen und den unveränderten V4-Codebaselinebezug sichern. Nur Profil-Runtimeeinbindung, sichere Initialisierung, Cache-Version und passgenauen lokalen Test ändern. Danach neuen technischen Checkpoint und Preview festhalten. Bis dahin PROFILE im Preview nicht bedienen. B02 anschließend als eigenen Worker-Integrationsfix behandeln. Sandbox-Abnahme nicht erneut starten.

## 10. Nachweise und Quellen

Interne Codebelege beziehen sich auf `d1bb533c9ca69a9d33c99bd4378d419abeca897e`: `profile.html`, `profile.js`, `profile-data-rights.js`, `tests/supabase-runtime-config-test.mjs`, `api/account-data-erasure.js`, `database/account-data-rights-v1.sql`, `api/compliance-message-dispatch.js`, `database/market-checkout-compliance-v1.sql`, `api/market-stripe-checkout.js`, `api/market-stripe-webhook.js`, `database/market-stripe-connect-sandbox-v1.sql`, `database/pgcrypto-digest-schema-hardening-v1.sql`, `.github/workflows/scanner-v16-check.yml`, `vercel.json` und `.gitignore`. Bestehende fachliche Detailbelege: Masterhandout V4. Ergänzend lesende Staging-Katalog-/Konfigurationsabfragen und Vercel-Teamabfrage am 15.09.2026; keine Produktionsabfrage in dieser Fortsetzung.

Aktuell konsultierte Primärquellen, keine anwaltliche oder steuerliche Schlussfreigabe:

- Vercel, Fair Use / kommerzielle Nutzung: https://vercel.com/docs/limits/fair-use-guidelines
- Vercel, ENV und Neubuild: https://vercel.com/docs/environment-variables
- Vercel, getrennte Produktionsbuild-/Domainfreigabe: https://vercel.com/docs/deployments/promoting-a-deployment
- Supabase, Passwortschutz und Tarifverfügbarkeit: https://supabase.com/docs/guides/auth/password-security
- Supabase, Datenbankbackups und separate Storage-Objekte: https://supabase.com/docs/guides/platform/backups
- § 14 GewO, Gewerbeanzeige bei Betriebsbeginn: https://www.gesetze-im-internet.de/gewo/__14.html
- § 312f BGB, Bestätigung auf dauerhaftem Datenträger im einschlägigen Verbraucherfall: https://www.gesetze-im-internet.de/bgb/__312f.html
- § 4 PStTG, Anbieter-/Freistellungsvoraussetzungen: https://www.gesetze-im-internet.de/psttg/__4.html

Quellenabruf 15.09.2026. Der Markdown-Changelog-Abruf von Supabase war im Webwerkzeug nicht auswertbar; keine angeblich geprüfte vollständige Changelog-/Security- oder CVE-Abdeckung behaupten. Keine absolute Fehlerfreiheit oder vollständige Produktionskonfigurationsprüfung zusagen.
