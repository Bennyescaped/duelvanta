# DUELVANTA – MASTERHANDOUT V32

Stand: 22.09.2026 · Verbindlicher Entwicklungsbranch: `marketplace-ux-v1`

**Schritt 1 ist veröffentlicht und in GitHub-CI geprüft. Die angemeldete Preview-Abnahme ist noch offen. Die neue Legal-Migration bleibt unangewandt; Schritt 2 wurde nicht begonnen. Keine Rechts-, Gesamt- oder Produktionsfreigabe.**

## 1. Verbindlichkeit und Arbeitsgrenzen

V32 ist der konsolidierte Übergabestand nach V31, den mitgeteilten Kanzlei-Antworten, der Korrektur des Legal-Entwurfs durch einen Kompatibilitätsschutz und dessen Veröffentlichung. Bei widersprüchlichen Statusangaben gilt V32 vor V31 und vor älteren Zwischenberichten. Frühere Nachweise behalten ihren ausdrücklich geprüften Umfang; historische Rechtseinschätzungen werden dadurch nicht zu einer neuen anwaltlichen Freigabe.

Repository: `Bennyescaped/duelvanta`. DUELVANTA bleibt **COLLECT. TRADE. BATTLE.** TRADE bleibt Kauf/Verkauf; Tausch/Swap wird nicht wieder eingeführt.

Vor weiterer Arbeit zuerst dieses Handout vollständig lesen, den tatsächlichen Remote-Head prüfen und vorhandene Arbeitskopien einschließlich unversionierter Dateien inventarisieren/sichern. Abweichungen einordnen, nichts zurücksetzen. Veröffentlichungen ausschließlich auf `marketplace-ux-v1`; PR #5 bleibt Draft und unmerged. Kein Force-Push, kein Merge, keine ungeprüfte Übernahme eines älteren lokalen Commits.

`main`, Production und Production-Supabase nicht verändern. Stripe Live und Sandbox nicht nebenbei aktivieren. Keine echten Payments, Refunds, Payouts oder E-Mails; kein manueller Deployment-Auftrag. Keine Secrets, Tokens, Sitzungsdaten oder temporären Freigabelinks anzeigen bzw. committen. Keine Sicherheits- oder Zugangssperren umgehen.

Abgeschlossene COLLECT-/BATTLE-Abnahmen werden ohne neuen reproduzierbaren Befund nicht wieder geöffnet. Offene Rechtsfragen dürfen nicht selbstständig als neue Produktentscheidung umgesetzt werden. Der Scanner-Release bleibt eine separate Entscheidung.

## 2. Verifizierte Git-Basis und Einordnung der Commit-IDs

| Kennung | Bedeutung |
|---|---|
| `822f4b9b32b2d00806ab2c152cbd3d71c5fc688c` | Veröffentlichter technischer Ausgangs-Head vor dem V32-Dokumentationscommit |
| `fix(trade): guard legal step 1 compatibility` | Nachricht des technischen Commits |
| `a4f1d4a48d3e51d99811d07e429d25028187f475` | Veröffentlichter technischer Git-Tree |
| `2f352a8781a4358713a1ce7e4d7a235918eba004` | Parent; ergänzte ausschließlich die Transportdatei für Codex |
| `23092137e2324d8962f6a7fd9571f33bb95b7316` | Frühere Patchbasis vor der Transportdatei; nicht mehr der aktuelle Entwicklungsstand |
| `efd6d1b9d06b3ca4f1e5c1d8d6d7dca412b5433a` | Lokaler Codex-Quellcommit; nicht selbst als Git-Objekt gepusht |
| `50f88213571be13255bb52eb489cc28cca660001` | Erneut verifizierter unveränderter `main`-Head |
| PR #5 | Offen, Draft, unmerged; Zielbranch `main` wird nicht verändert |

Alle **19 Git-Blob-IDs** des veröffentlichten Schritt-1-Dateistands stimmen mit der vom Nutzer übermittelten Codex-Prüfsummenliste überein. Die zusätzliche Mock-Korrektur `addEventListener(){}` in `tests/supabase-runtime-config-test.mjs` ist enthalten. Die abweichende Commit-ID entsteht durch die erneute Commit-Erstellung über den GitHub-Connector, nicht durch abweichende Dateiinhalte.

V32 und seine Begleitnachweise werden ausschließlich als Dokumentation ergänzt. Der daraus entstehende Dokumentations-Head ist vom oben genannten technischen Head zu unterscheiden; er wird im separaten Übergabeauftrag genannt. Bei einem neueren Head dessen Differenz prüfen, nicht auf `822f4b9b…` zurücksetzen.

Der ältere Diagnose-Commit `27471537…` und nicht veröffentlichte Zwischenobjekte sind **keine** Fortsetzungsbasis. Auch die alte Codex-Arbeitskopie auf `work` darf nicht ungeprüft über den Remote-Branch gepusht werden. `work` war nur der lokale Codex-Arbeitsbranch; das Remote-Veröffentlichungsziel bleibt `marketplace-ux-v1`.

## 3. Schritt 1 – tatsächlich veröffentlichter Umfang

| Bereich | Umgesetzter Schutz |
|---|---|
| Browser-Kompatibilität | `trade-legal-readiness.js`, Guard-Version `1.1`, standardmäßig geschlossen |
| Schema-Probe | Lesender RPC `get_my_market_buyer_profile` mit `{get:true}`; eine fehlerfreie Objektantwort mit booleschem `configured` und exakt `schema_version='trade-legal-contract-model-v1'` ist erforderlich |
| Fehlergrenzen | Fehlende Funktionen, Teilantworten, Fehler und fünf Sekunden Probe-Timeout schalten nicht frei; eine verspätete positive Antwort hebt eine Timeout-Sperre nicht auf |
| Vertragsaktionen | Die im Guard definierten Kauf-, Angebotsannahme-, Zahlungs-, Widerrufs- und Käuferstatus-Aktionen werden vor kompatiblem Schema abgefangen; dynamisch eingefügte Bedienelemente werden bei festgestellter Inkompatibilität ebenfalls deaktiviert |
| Bestehende Bestellungen | Normale Bestellnavigation und Bestellnachweise bleiben im geprüften Testumfang erreichbar; die neue optionale Widerrufsabfrage wird ohne bestätigte Guard-Kompatibilität übersprungen und andernfalls zeitlich begrenzt |
| Profil | Die optionale neue Käuferprofilabfrage blockiert den übrigen Profilstart nicht mehr; Speichern bleibt ohne bestätigte Kompatibilität gesperrt |
| Loader | Ausführender Script-Loader und Cacheversionen sind vereinheitlicht; ohne geladenen Guard startet der TRADE-Handler-Stack nicht |
| Tests | Fehlendes globales `Response` im alten Mock wird nicht mehr benötigt; der konkrete simulierte Verbindungsabbruch wird wieder streng geprüft. Die Codex-Zusatzkorrektur ergänzt die fehlende Browser-API im Runtime-Mock |

Die fünf Sekunden beziehen sich auf die gestartete RPC-Probe. Das vorherige Warten auf einen verfügbaren Anwendungsclient ist gesondert begrenzt; daraus folgt keine pauschale Fünf-Sekunden-Garantie für den gesamten Seitenstart.

**Dies ist ein clientseitiger Kompatibilitätsschutz, keine vollständige serverseitige Sperre und keine neue Berechtigungsprüfung.** Vorhandene Datenbankrechte werden dadurch nicht ersetzt. Die Existenz einzelner RPCs ist keine Schema- oder Rechtsfreigabe. Ein Freigabemarker wurde absichtlich weder in der Datenbank noch im Migrationsentwurf ergänzt. Den Marker nicht setzen, um den Schutz zum Testen zu öffnen.

Die optionale Widerrufsabfrage erzeugt bei Fehlern keine erfundene Berechtigung. Fehler des eigentlichen Bestellabrufs bleiben Fehler und werden nicht als erfolgreicher leerer Bestand ausgegeben. Fehlende Schutzdatei und fehlendes Datenbankschema sind unterschiedliche Fälle: Im ersten Fall startet der Handler-Stack nicht; im zweiten Fall soll die vorhandene Bestelleinsicht erhalten bleiben.

### 3.1 Die 19 übernommenen Zielpfade

```text
.github/workflows/scanner-v16-check.yml
profile.html
profile.js
tests/market-stripe-connect-contract-test.mjs
tests/supabase-runtime-config-test.mjs
tests/trade-legal-contract-model-test.mjs
tests/trade-legal-order-boundary-test.mjs
tests/trade-legal-order-browser-test.mjs
tests/trade-legal-profile-boundary-test.mjs
tests/trade-legal-readiness-browser-test.mjs
tests/trade-legal-readiness-test.mjs
tests/trade-marketplace-ux-contract-test.mjs
tests/trade-release-gate-test.mjs
tests/trade-ui-mock.js
tests/trade-ui-selftest.js
trade-legal-readiness.js
trade-orders.js
trade-release-gate.js
trade.html
```

SQL, Migrationen, Paket-/Lockdateien, Transportdatei, COLLECT-/BATTLE-Laufzeitcode und Scanner-Release-Gate wurden durch diese Veröffentlichung nicht verändert. Die vollständigen Dateiidentitäten stehen im JSON-Nachweis unter `docs/handoffs/duelvanta-step1-publication-evidence-2026-09-22.json`.

## 4. GitHub-CI – ausgeführt, nicht nur geplant

| Nachweis | Ergebnis |
|---|---|
| Scanner V16 Check #644, Run `35715793199` | SUCCESS |
| Battle WebRTC Check #120, Run `35715793036` | SUCCESS |
| Scanner-Job `validate`, ID `106706852488` | SUCCESS |
| Scanner-Job `quota_database`, ID `106706852876` | SUCCESS |
| Scanner-Job `collect_f3_database`, ID `106706853024` | SUCCESS |
| Neue Guard-/Profil-/Bestellleseprüfungen | 40 + 11 + 92 bestanden |
| Neue Chromium-Szenarien | 13 Guard-/Loader- und 9 Bestelllese-Szenarien bestanden |
| Bestehende TRADE-DOM-/Mobile-/Desktop-Tests | Bestanden |
| Bestehende PGlite-/native PostgreSQL-Regressionsjobs | Bestanden, isolierte Testumgebungen |

Beide Runs sind dem technischen Head `822f4b9b…` zugeordnet und wurden bei der V32-Erstellung erneut als erfolgreich gelesen. In der PR-CI wurde der synthetische Test-Merge `8468c3745584e78d05ea97ebf74a9936569bb1a8` ausgecheckt. Die im Veröffentlichungsblock verglichene Dateidifferenz zu `822f4b9b…` war leer. Das ist **kein tatsächlicher Merge von PR #5 in main**.

Die zuvor in Codex wegen fehlender npm-Abhängigkeiten blockierten Tests liefen anschließend erfolgreich in GitHub Actions. Es besteht dafür keine fortdauernde Installationsblockade. CI-Artefakt: `v16-mobile-recognition`, ID `10689340017`; Upload und Ergebnisse wurden im Veröffentlichungsblock aus dem Log geprüft, das Archiv damals nicht heruntergeladen.

Die zwei bereits vorhandenen push-only-Schritte für komplexe echte Kartenreferenzen bzw. Live-Katalogverfügbarkeit wurden beim PR-Ereignis erwartungsgemäß übersprungen. Das Scanner-Gate bleibt unverändert. Bestehende CI-Wiederholungen sind keine neue praktische COLLECT-/BATTLE-Abnahme.

Grenzen: Das CI-Grün beweist nicht die fachliche Vollständigkeit der neuen Vertragslogik, nicht deren Anwendung auf Staging und nicht die Zustellung realer Nachrichten. Es ersetzt insbesondere nicht den nachstehenden angemeldeten Preview-Test. Die bereits dokumentierte separate abgefangene Mock-Warnung zu `db.auth.getSession` im Datenrechte-UI-Test sowie Action-Runtime-Warnungen wurden durch Schritt 1 nicht bearbeitet.

## 5. Vercel-Preview – READY, angemeldeter Nachtest offen

| Merkmal | Verifizierter bzw. dokumentierter Stand |
|---|---|
| Projekt | `duelvanta_v5_vision`, ID `prj_dAtH0I1mwiHhOsA64J3iq97SoVnd` |
| Team | `team_VHCwSwfBWANJvmS3qdkpJ0dK` |
| Technisches Deployment | `dpl_8tMuYUaMHvqppaJwuv95Rw9qGsZE` |
| Quellstand | `822f4b9b32b2d00806ab2c152cbd3d71c5fc688c`, Branch `marketplace-ux-v1` |
| Herkunft und Ziel | `source=git`, `target=null`; keine Production-Bereitstellung |
| Zustand | READY, bei der V32-Erstellung erneut über Vercel-Metadaten bestätigt |
| Angegebener Deployment-Hostname | `duelvantav5vision-jjo8zo1qr-bennyescaped-3783.vercel.app` |
| Beweglicher Branch-Alias | `duelvantav5vision-git-marketplace-ux-v1-bennyescaped-3783.vercel.app` |
| Letzte Anwendungsabrufe im Veröffentlichungsblock | Beide `trade.html`-Abrufe lieferten HTTP 302 zur Vercel-SSO-Anmeldung |
| Angemeldete DUELVANTA-Abnahme | NICHT DURCHGEFÜHRT |

Vercel-Buildbereitschaft, Vercel-Zugangsfreigabe und die DUELVANTA-/Supabase-Nutzersitzung sind drei unterschiedliche Nachweise. Die SSO-Weiterleitung ist kein bestätigter Anwendungsfehler, aber auch kein bestandener Smoke-Test. Assets wurden dabei nicht byteweise aus dem angemeldeten Deployment gelesen.

Der Branch-Alias kann nach einem Dokumentationscommit auf ein neueres Deployment zeigen. Entweder das oben festgelegte technische Deployment verwenden oder die neue Deployment-SHA und ihre ausschließlich dokumentarische Abweichung prüfen. Keine Anmeldung oder Tests versehentlich auf `duelvanta.de` bzw. Production ausführen.

### 5.1 Erster Auftrag des nächsten Chats: begrenzter Read-only-Smoke-Test

| Prüfschritt | Abnahmekriterium |
|---|---|
| Deployment und Umgebung | Quellcommit dokumentiert; Preview verweist ausschließlich auf Staging `xhmjxrcskfhbovhitdej` |
| Autorisierter Zugang | Vorhandene berechtigte Vercel-Freigabe und danach eine autorisierte DUELVANTA-Staging-Sitzung; keine Secrets im Chat |
| TRADE bei fehlendem Schema | Sichtbarer Sperrhinweis; betreffende neue Vertragsaktionen gesperrt; keine Bestellung/Angebotsannahme/Zahlung auslösen |
| Bestehende Bestellungen | Vorhandene autorisierte Testbestellung lesbar; Bestellansicht bleibt bedienbar |
| Bestellnachweis | Vorhandener Bestätigungs-/Nachweisabruf funktioniert, ohne Vertragsdaten umzuschreiben |
| Profil | Übriges Profil lädt; die unfreigegebene neue Käuferstatusfunktion ist nicht nutzbar; keine Profilwerte ändern |

Ergebnis je Prüfschritt mit PASS, FAIL oder BLOCKIERT und der konkreten Evidenz dokumentieren. Sind keine geeigneten bestehenden Testbestellungen verfügbar, nicht für diesen Read-only-Test neue Käufe erzeugen und keinen vollständigen PASS behaupten. Keine Konten, Bestellungen oder Datenbestände nur für diese Prüfung verändern.

Zugang zuerst mit tatsächlich verfügbaren autorisierten Werkzeugen prüfen. Ist eine menschliche Anmeldung erforderlich, genau diesen einen Schritt an den Nutzer geben; keine Passwörter, OTPs oder Session-Cookies anfordern. Vercel-Schutz nicht abschalten. Ein Zugangshindernis darf nicht durch neue Pakettransfer-, Codex-Einrichtungs- oder Installationsschleifen ersetzt werden.

Bis zum dokumentierten Abschluss dieses Nachtests bleibt Schritt 1 insgesamt nur **VERÖFFENTLICHT + CI PASS / PREVIEW OFFEN**. Schritt 2 ist nicht vorweggenommen.

## 6. Datenbankstand und Legacy-Entwurf strikt trennen

Die Datei `supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql` ist weiterhin ein **nicht abgenommener, nicht auf Staging angewandter Entwurf**. Sie darf nicht allein wegen des erfolgreichen Schritt-1-Workflows übernommen werden. Es wurde kein Schema-Freigabemarker gesetzt.

Zuletzt im Legal-Block direkt dokumentierter Staging-Stand: `market_buyer_profiles` nicht installiert, Stripe-Konfiguration `sandbox_enabled=false` und `live_mode=false`; benannte synthetische Testzeilen wurden per Rollback entfernt. Die spätere Schritt-1-Veröffentlichung und die V32-Dokumentation führen keine Datenbankänderung aus. Bei der V32-Erstellung wurden diese Datenbankwerte nicht erneut abgefragt; vor einem späteren DB-Eingriff müssen sie lesend überprüft werden.

Der Staging-Backendstand folgt damit noch dem vorherigen Vertragsmodell. Der Browserstand enthält bereits Teile des neuen Kandidaten und jetzt den vorgeschalteten Schutz. Nicht behaupten, das neue Festpreis-, Preisangebots- oder Widerrufsmodell sei deshalb auf Staging durchgängig aktiv.

Frühere transaktionale Positivtests über einen privilegierten SQL-Zugang mit gesetzter Nutzerkennung ersetzen keine vollständigen Rollen-/Parallelitätstests. Rollback-Nachweise betreffen Schema und benannte Daten; PostgreSQL-Sequenzzähler können durch frühere Tests fortgeschritten sein und werden nicht zurückgesetzt.

## 7. Kanzlei-Antworten und korrigierter SOLL-/IST-Stand

### 7.1 Quellen und Aussagequalität

Die erste vom Nutzer eingefügte E-Mail ist mit Rechtsanwalt Arndt J. Nagel unterzeichnet. Sie wurde vollständig ausgewertet. Darauf folgten vier vom Nutzer nachgereichte Antworten zu Festpreis, Preisangeboten, Käuferstatus und Widerruf. Sie werden als **mitgeteilte Zielvorgaben** dokumentiert; eine technische Implementierung oder ein Testlabel ist keine zusätzliche anwaltliche Prüfung/Freigabe.

Die Aussage „es fehlen noch sämtliche Kanzlei-Antworten“ aus V31 ist überholt. Ebenso überholt ist die pauschale Aussage, es gebe überhaupt keine Erhebung/Bestätigung des privaten Käuferstatus. Nicht überholt sind die verbliebenen fachlichen und technischen Abnahmebedingungen.

| Thema | Mitgeteilte Aussage | Technische Konsequenz / offener Punkt |
|---|---|---|
| Fünf-Tage-Modell | Erste E-Mail: fünf Tage sind Maximalfrist, frühere Annahme etwa durch Zahlungsaufforderung möglich | Kein zusätzlicher Fünf-Tage-Warteprozess allein wegen dieser Klausel; konkrete Ereignis-/Zugangszuordnung noch sauber nachweisen |
| Festpreis | Ergänzung: automatisierte Zahlungsaufforderung soll die Verkäuferannahme abbilden, kein zusätzlicher manueller Verkäuferklick | Interne Stripe-Session-Erstellung, Bereitstellung/Zugang der Aufforderung, Vertragsevidenz und Zahlung trennen; nicht ungeprüft `session.created` als gesamten rechtlichen Nachweis behandeln |
| Preisangebot | Ergänzung: Vertrag bei Annahme des verbindlichen Käuferangebots durch den Verkäufer; Zahlung danach Erfüllung | Käuferinformationen und Gesamtpreis müssen vor seiner Bindung stehen; kein zweiter vertragsschließender Checkout |
| Käuferstatus | Ergänzung: keine zusätzliche Einzelabfrage nötig, wenn Zuordnung anderweitig gesichert ist; Schutzrechte nicht pauschal durch Profilwahl ausschließen | Bereits vorhandene private Käuferbestätigung wiederverwenden; keine ungefragte B2B-/C2B-Erweiterung |
| Widerruf | Ergänzung: B2C-Verträge mit entsprechendem Recht; Warenvertragsempfänger ist der Händler, eigene Plattformverträge haben DUELVANTA als Empfänger | Domains, Erklärung, Empfang, Bestätigung, Zustellung und Rückabwicklung getrennt behandeln; nicht jede Kontonutzung ungeprüft als gleichen Vertrag einstufen |
| Supabase-Datenschutz | Erste E-Mail empfiehlt zusätzliche Generator-Konfiguration bei Vertragsabwicklungsdiensten | Backend/DB/Storage sind noch in die passende Datenschutzbeschreibung einzuordnen; keine individuelle Textfreigabe daraus ableiten |
| Individuelle Texte | Erste E-Mail: individuelle Anpassung nicht im Paket enthalten und derzeit nicht gesondert angeboten; eigene Änderungen ohne Kanzleihaftung, Schnittstellenupdates können sie überschreiben | Generator-/Updatekonzept und individuelle Ergänzungen fachlich klären; keine frei erfundenen Klauseln automatisch veröffentlichen |
| LiveKit | Erste E-Mail fordert Angaben zu Notwendigkeit, AVV, Daten, Zweck, Betreiber und Empfängern; Aufnahme in Generator nicht zugesagt | Anbieter-/Kontonachweise und faktisches Datenschutzblatt fehlen weiterhin als abgeschlossene Rechtsgrundlage |

### 7.2 Die Käuferstatus-Korrektur ist verbindlich für die Fortsetzung

Bereits vorhanden sind `dv_market_private.trade_user_eligibility`, `get_my_market_trade_eligibility`, `confirm_my_market_trade_eligibility` und `require_trade_eligibility(..., true)`. Der dokumentierte bestehende Käuferzugang verwendet Volljährigkeit, Deutschland und `private_buyer_confirmed`.

Der erste Legal-Entwurf fügte zusätzlich `market_buyer_profiles`, `consumer/business` sowie B2B/C2B ein. Das war eine unnötige Erweiterung gegenüber dem bestehenden Release-Scope. Schritt 1 hat diese fachliche Korrektur **noch nicht umgesetzt**, sondern die inkompatiblen Aktionen geschützt. Der spätere Schritt 2 muss den bestehenden privaten Käuferzugang wiederverwenden, den zusätzlichen Geschäftskäuferpfad aus dem unangewandten Entwurf entfernen und bestehende Alters-/Länder-/Kontosperren erhalten. Keine historischen Vertragssnapshots rückwirkend umklassifizieren.

### 7.3 Verbleibende Abnahmeblocker des Kandidaten

| Blocker | Erforderlicher Nachweis vor Freigabe |
|---|---|
| Bindung von Preis und Vertragsdaten | Review, Käuferangebot, Versand, Verkäuferdaten, Gebühren, Providerbetrag, Annahme und Vertragssnapshot verwenden denselben eingefrorenen relevanten Stand; spätere Listing-/Profiländerungen dürfen ihn nicht unbemerkt ersetzen |
| Unbekannter Commit-Ausgang | Verlorene RPC-Antwort darf nicht blind zu Stripe-Expiry und Reservierungsfreigabe führen; tatsächlichen Zustand feststellen und Wiederaufnahme absichern |
| Parallelität / Wiederholung | Einheitliche Lockreihenfolge; Replays auch nach Zeitfenster; Konkurrenz mit Ablaufbereinigung und Prozessabbruch unter echten getrennten PostgreSQL-Verbindungen prüfen |
| Verbindliche Preisangebote | Pflichtinformationen, genaue Ware/Menge, Versand und Gesamtpreis vor der ursprünglichen Käuferbindung; angemessene Erklärung der Zahlungspflicht fachlich prüfen |
| Widerruf | Vertrag/Vertragsteil, Erreichbarkeit im maßgeblichen Zeitraum, zuständiger Empfänger, Doppelbestätigung, Zustellfehler und dauerhaftes Bestätigungsdokument nachweisen |
| Datenschutzintegration | Neue personenbezogene Nachweise in Export, Kontobeendigung und fachlich festgelegte Retention einordnen; eine unaufgerufene Löschfunktion genügt nicht |

Diese Punkte sind keine neue Rechtsentscheidung durch V32. Das Dokument hält die bereits identifizierten Prüf- und Umsetzungsbedarfe fest. Aktuelle Rechtsquellen und die konkrete Vertragsgestaltung sind vor einer rechtlich relevanten Änderung erneut fachlich zu prüfen.

## 8. Weitere Legal-/Datenschutzthemen bleiben offen

| Bereich | Vorhandenes Fundament / Grenze |
|---|---|
| Seller privat/trader | Technische Trennung, Legal-/Tax-Profile, Seller-Onboarding und Offenlegung vorhanden; passender Datenschutztext und B2C-Verkäuferinformationen nicht insgesamt freigegeben |
| Inseratsdaten | Im Kanzlei-Abgleich als eigenständiger Datenschutz-/Vorabprüfungsbedarf markiert; konkrete Screening-, Einwilligungs-/Identitäts-, Review- und Nachweisprozesse nicht eigenständig festlegen |
| Notice & Action | Art.-16-orientierter Melde-/Entscheidungs-/Einspruchsprozess vorhanden; Textabdeckung offen. Zusätzliche Art.-18-Eskalation wurde als offener Prozesspunkt erfasst, nicht als bereits geprüfte technische Pflichtlösung |
| PStTG/DAC7 | Ereignisledger und Exporte vorhanden; Vergütung nicht mit bloßem Vertragsschluss verwechseln. BZSt-Meldeweg, Zuständigkeit, verfügbare Finanzkonto-Kennung und Retention-Matrix nicht abschließend geklärt |
| PStTG-Fristen | Der bisherige Abgleich markiert einen Widerspruch zwischen der Aussage der ersten E-Mail und § 24 PStTG. Fachlich klären; vorhandene Holds nicht pauschal auf allgemeine kürzere Fristen setzen |
| Käuferdaten / Adresse | Beschränkte Orderdaten und separate Adress-Snapshots vorhanden; Empfänger, Zweck, Speicherdauer und Fortbestand nach Kontobeendigung datentypgenau erklären |
| COLLECT / OpenAI | Dokumentierter V16-Fluss: Kartenbild zur Analyse; `store:false`; spätere Bildspeicherung separat in Supabase. Daraus keine Behauptung „OpenAI speichert nichts“ ableiten; Account-/Provider-Retention gesondert prüfen |
| COLLECT / Supabase | Auth, Backend, PostgreSQL, Storage und private Sammlungsdaten; Staging-Region zuvor als Frankfurt/EU dokumentiert. Die Region allein ist keine vollständige Datenschutzfreigabe |
| Scanner-Accounting | Nutzerbezug, Request-/Bildhash und Nutzungs-/Kostenwerte sind in Export/Erasure/Retention einzuordnen; keine Quoten-/Provideränderung in diesem Dokumentationsblock |
| BATTLE / WebRTC | Kamera/Mikrofon, Supabase-Signalisierung und dokumentierter Google-STUN-Pfad müssen in die tatsächlichen Datenflüsse aufgenommen werden |
| BATTLE / LiveKit | Zusätzliche SFU-Übertragung für Zuschauer; kein DUELVANTA-Egress-/Recording-Pfad im bisherigen Codebefund. DPA/AVV, Datenregion, Medienrouting, Observability und Subprozessoren accountseitig nicht vollständig nachgewiesen |

Die vier Ergänzungsantworten schließen diese Themen nicht. Keine pauschale EU-only-Medienverarbeitung oder automatische Aufnahme eines Dienstes in den Kanzlei-Generator behaupten. Notwendige Rückfragen werden konkret aus dem tatsächlichen Datenfluss abgeleitet, nicht durch neue pauschale Featureblöcke ersetzt.

## 9. Abgeschlossene Grundlagen aus V31 bleiben bestehen

### 9.1 Environment-Routing

Zentraler Resolver: `supabase-environment.js`. Preview/Development verwendet ausschließlich `xhmjxrcskfhbovhitdej`; Production ausschließlich `enifiaqsnqtbzylnfrpi`. Die bestehenden Cross-Environment-Grenzen bleiben erhalten. Keine zweite Routinglogik, kein harter Production-Fallback. Referenz: `DUELVANTA_ENVIRONMENT_ROUTING_HARDENING_2026-09-20.md`.

### 9.2 COLLECT

| Umfang | Abgeschlossener Nachweis |
|---|---|
| F1/F2 | Echte Leerbestände gegenüber Such-/Filterleerzuständen getrennt; fehlende Preise bleiben unbekannt statt Null; unvollständige Wertebasis neutral gekennzeichnet |
| M1–M3 | Mobiler Dialog/Fokus-Zoom, Preis-Typografie, Bildersatzdarstellung und Listenlabels im dokumentierten Umfang korrigiert; iPhone-/Safari-Rückmeldungen des Nutzers vorhanden |
| Kaufdatum | Kompakte Breite vom Nutzer akzeptiert; Abbrechen und Speichern praktisch bestätigt; nicht erneut umgestalten |
| F3 | Eigene tatsächlich leere Binder über geschützten RPC löschbar; belegte Binder und Kartenreferenzen geschützt; 15 native PG17-Race-/Rollback-/Wiederholungsfälle bestanden |

F1/F2-Commit: `0d502c496d0bbe0af61a65d9d2f7d535b7a0cfae`. Mobile-Korrekturen: `14f9a16ae7f213fedf54d43e8dd3ff9e4c1c252e`; Kaufdatum-Nachtrag: `3bf24d78a9f3789eb8f3e84c70c9a4493ec06d47`.

F3-Anwendungscommit: `cd92ec135eae3b3ec2df9aa93500a0349f454805`. Getestete Migration: `supabase/migrations/20260921144947_collect_empty_binder_delete.sql`; SHA-256 `7ddbbf05f8d6a7e194948ed7fe7a165fced9be24d1bd5d5a87826805ef02252e`. Auf Staging unter Version `20260921151654`, Name `collect_empty_binder_delete` angewandt. Die Original-Referenz verwendet weiterhin `ON DELETE SET NULL`; direkte ungeschützte Browser-DELETEs bleiben untersagt. Keine Karte löschen, verschieben oder entkoppeln. Kein neuer Hardwaretest in diesem Legal-Block. Der ältere Binder `UXCHECK SYNTHETISCH 20260921` bleibt bestehen.

Details bleiben in den V31-Referenzen: `DUELVANTA_COLLECT_UX_F1_F2_2026-09-21.md`, `DUELVANTA_COLLECT_MOBILE_M1_M3_2026-09-21.md`, `DUELVANTA_COLLECT_PURCHASE_DATE_IPHONE_NACHTRAG_2026-09-21.md` und `DUELVANTA_COLLECT_F3_CI_2026-09-21.md`.

### 9.3 BATTLE

Spectator Foundation und Spectator Media sind funktional im dokumentierten Staging-/Mehrgeräteumfang abgenommen. Nachgewiesen sind Host/Gast-P2P, separater read-only-Zuschauer, Bild und Ton beider Spieler, Consent/Widerruf, echtes RemoveParticipant/Disconnect ohne Verlust des Spieler-P2P, Ablehnung alter Publisher-Tokens und erneute Media-Epoche nach Zustimmung.

Abnahmehead: `73f6baeb08116be4753799155b787f7ea937cd8a`; damals Battle #87 und Scanner #611 erfolgreich. Zuletzt dokumentierte Staging-Konfiguration: `media_enabled=true`, `max_viewers_per_match=50`. **50 ist das konfigurierte Beta-Limit, kein nachgewiesener Lastwert.** Keine Production-, Datenschutz- oder All-Browser-Freigabe. Referenz: `DUELVANTA_SPECTATOR_MEDIA_MULTIDEVICE_ACCEPTANCE_2026-09-21.md`.

### 9.4 Scanner-Gate

Die bestehende V16-Preview-Freigabe ist an `scanner-v16` gebunden; Production an `main`. Der reale Scannerpfad auf `marketplace-ux-v1` bleibt als separate Entscheidung gesperrt. CI-Namen und erfolgreiche Mock-Erkennung ändern daran nichts. Keine Aktivierung des Scanners als Nebenwirkung einer Legal-, Dokumentations- oder Profilkorrektur.

## 10. Weitere Reihenfolge – keine neue Großbaustelle

| Schritt | Arbeit | Stand / Ausstiegskriterium |
|---|---|---|
| 1 | Kompatibilitätsschutz und korrekte Tests | Veröffentlichung und CI abgeschlossen; zuerst angemeldeten Preview-Smoke-Test aus Abschnitt 5.1 abschließen |
| 2 | Bestehenden privaten Käuferzugang wiederverwenden | Noch nicht begonnen; zusätzliche Geschäfts-Käuferlogik aus dem unangewandten Entwurf entfernen, bestehende Grenzen erhalten; keine historischen Nachweise umschreiben |
| 3 | Preisangebotsmodell vollständig ausrichten | Bindungsinformationen zum ursprünglichen Käuferangebot; Vertrag bei Verkäuferannahme, keine Doppelorder und kein zweiter Vertrags-Checkout |
| 4 | Festpreisablauf absichern | Durchgehende Snapshot-/Betragsbindung, unbekannte Antworten, Wiederaufnahme und Parallelität unter echten Rollen prüfen |
| 5 | Widerruf fertigstellen | Erklärung, Vertragsteil, Bestätigung/Zustellung und Datenrechte vollständig prüfen; Storno/Refund getrennt |
| 6 | Getestete Gesamtmigration kontrolliert auf Staging übernehmen | Erst nach Abnahme der vorherigen Blöcke und separatem Übernahmeentscheid; exakte Quelle, Rollenvergleich und synthetische Integrationsabnahme |

Datenschutz-, Anbieter-, PStTG-/DSA- und Rechtstextfragen werden zusätzlich gezielt geklärt. Keine Rechts-, Gesamt- oder Produktionsfreigabe aus einzelnen Techniktests ableiten. Die ursprüngliche spätere Gesamtprüfung vor Live, einschließlich eines gesonderten Codex-Reviews, bleibt offen; die hier erfolgte Codex-Patcharbeit ersetzt sie nicht.

## 11. Fortsetzungsprozess und bereits gelöste Hindernisse

Die früheren Meldungen „Commit-Sperre“, „nur lokaler Patch“ und „fehlende Testabhängigkeiten“ sind für die Veröffentlichung von Schritt 1 überholt. Der GitHub-Connector hat den geprüften Dateistand veröffentlicht; CI ist grün. Verfügbare Aktionen bei jedem Lauf tatsächlich prüfen, nicht aus früherer Tool-Verfügbarkeit auf dauerhafte Rechte schließen. Sicherheitsablehnungen nicht umgehen.

Codex konnte auf dem iPhone über Cloud verwendet werden. ZIP-Upload und ein sehr langer Texteingabeversuch führten nicht zur zuverlässigen Übertragung. Gelöst wurde dies durch die reine Repository-Transportdatei `docs/handoffs/duelvanta-step1-transfer-2026-09-22.json`. Sie enthält den früheren geprüften Patch als Daten, ist keine aktive Konfiguration und darf **nicht erneut über den aktuellen Stand angewandt** werden.

Für diesen Schritt sind kein neuer Upload, kein erneuter Transfer-PASS, keine neue Codex-Umgebung und kein neuer PR erforderlich. Nutzer arbeitet häufig am Handy; bei einem notwendigen manuellen Zugangsschritt nur eine konkrete Aktion nennen, keine mehrfachen großen Kopieraufträge. Verfügbare autorisierte Verbindungen nutzen, ohne fehlende Berechtigungen oder Anmeldungen zu erfinden.

## 12. Dauerhafte Quellen und Nachweise

V32 fasst vorhandene Nachweise zusammen; es ist kein neues Rechtsgutachten. Aussagen zu offenen Rechtsquellen stammen aus dem bisherigen Abgleich und sind vor entsprechender Implementierung aktuell gegenzuprüfen.

| Datei / Quelle | Verwendung |
|---|---|
| `DUELVANTA_MASTERHANDOUT_V31_2026-09-21.md` | Historische konsolidierte Grundlage; abgeschlossene Abnahmegrenzen bleiben erhalten |
| `DUELVANTA_LEGAL_TECHNICAL_PREFLIGHT_2026-09-20.md` | Technischer Legal-Ausgangsbefund; überholte Environment-/BATTLE-Status nicht wieder öffnen |
| `DUELVANTA_LEGAL_KANZLEI_SOLLIST_ABGLEICH_2026-09-21.md` | Erste Kanzlei-Auswertung; Käuferstatus- und spätere Vertragsmodell-Ergänzungen aus V32 haben Vorrang |
| `DUELVANTA_LEGAL_SCHRITT1_VEROEFFENTLICHUNG_CI_2026-09-22.md` | Dauerhaft ergänzter Veröffentlichungs-/CI-Bericht mit Preview-Grenze |
| `docs/handoffs/duelvanta-step1-publication-evidence-2026-09-22.json` | Dateiidentitäten, Commit-/Run-/Deployment-IDs und Grenzen der bisherigen Evidenz |

GitHub-Nachweise:
- Commit: https://github.com/Bennyescaped/duelvanta/commit/822f4b9b32b2d00806ab2c152cbd3d71c5fc688c
- Scanner #644: https://github.com/Bennyescaped/duelvanta/actions/runs/35715793199
- Battle #120: https://github.com/Bennyescaped/duelvanta/actions/runs/35715793036

Bei der V32-Erstellung wurden V31 vollständig, der aktuelle PR-/Branchstand, der unveränderte main-Vergleich, die erfolgreichen technischen CI-Runs und die Vercel-Deployment-Metadaten geprüft. Die V32-Veröffentlichung ist ein Dokumentationsblock, keine Wiederholung der Anwendungstests. Neu ausgelöste Dokumentations-CI ist nicht mit den oben angegebenen technischen Läufen zu verwechseln.

---
**Nächster Chat: zuerst autorisierten angemeldeten Preview-Nachtest für Schritt 1 durchführen und dokumentieren. Bis dahin keine neue Legal-Migration, keine Freischaltung und kein Start von Schritt 2.**
