# DUELVANTA – Masterhandout V10

Stand: 15.09.2026, nach Abschluss von B05. Dieses Dokument ist der verbindliche Übergabestand und ersetzt widersprechende ältere Angaben. V9 bleibt Detailreferenz für B01–B04, soweit V10 nichts aktualisiert.

## 1. Verbindlicher Repository- und Release-Stand

- Repository: Bennyescaped/duelvanta
- Entwicklungsbranch: marketplace-ux-v1
- Ausgangs-Head für B05 / V9-Head: 81e0b7018309e8de18b92d6e05313603709781eb
- B05-/V10-Commit: der Commit, der dieses Handout zusammen mit den B05-Härtungen anlegt; der exakte neue Branch-Head wird im Abschluss des ausführenden Chats genannt.
- main: 50f88213571be13255bb52eb489cc28cca660001, unverändert
- PR #5: open, Draft, nicht gemergt
- PR #5 Base: main
- B01–B04: geschlossen und in B05 nicht erneut bearbeitet
- B04 Ruleset Protect main, ID 23447544: unverändert aktiv

Produktion, produktives Supabase, Stripe, Vercel-Produktion, Domains, main und PR-Draftstatus wurden in B05 nicht verändert. Es gab keinen Merge, keinen Force Push, keinen History Rewrite und keine Secret-Rotation.

## 2. B05 – GESCHLOSSEN: Secret-, Repository- und Supply-Chain-Härtung

B05 ist geschlossen. Es wurde kein echtes oder rotationspflichtiges Secret im aktuellen Stand oder in der erreichbaren Git-Historie gefunden. Der einzige konkrete hohe Supply-Chain-Befund wurde mit einem minimalen Patch behoben; der abschließende npm-Audit ist frei von bekannten Schwachstellen.

## 3. Repository- und Ignore-Prüfung

### 3.1 Ausgangsbefund

- Zu Beginn enthielt `.gitignore` ausschließlich `.env.local`.
- `.vercelignore`, `.npmignore` und weitere Ignore-Dateien waren nicht vorhanden.
- Weder versionierte noch lokale `.env*`-Dateien waren vorhanden.
- Keine versionierten oder lokalen Build-, Coverage-, Browser-, Testreport-, Log-, Debug-, Temp-, Export-, Backup-, Datenbank- oder Dump-Artefakte wurden gefunden.
- Die Arbeitskopie war bei Beginn sauber.
- Die erreichbare Git-Historie enthielt auch keine verdächtigen Artefaktnamen dieser Kategorien.
- Es gab acht kleine versionierte JSON-Dateien. Sie wurden als Vercel-Konfiguration, öffentliche Scanner-Konfiguration, öffentliche Ed25519-Verifikationsschlüssel, Kartenhash-/Referenzmetadaten oder Vorlagen klassifiziert. Es handelt sich nicht um private Exporte.
- Das größte Testfixture `tests/fixtures/retourorden-iphone.png` wurde visuell geprüft und enthält ausschließlich eine Pokémon-Testkarte, keine personenbezogenen Daten.

### 3.2 Umgesetzte `.gitignore`-Härtung

Die Datei schützt jetzt gezielt:

- `.env` und `.env.*`, bei ausdrücklicher Freigabe von `.env.example` und `.env.*.example`;
- lokalen Vercel-Zustand unter `.vercel/`;
- `node_modules`, Build-, Coverage- und Browser-/Testergebnisse;
- Logs, Debuglogs sowie übliche temporäre Editor-/Patchdateien;
- lokale Datenbanken, Dumps, Backups und Exportverzeichnisse;
- private Schlüssel- und Zertifikatsbundle-Dateien;
- lokale OS-/Editor-Metadaten.

Legitime SQL-Migrationen, JSON-Konfigurationen, Bilder, CSV/TSV-Dateien und Projektquellen werden nicht pauschal ignoriert. `git ls-files -ci --exclude-standard` meldete keine bereits versionierte legitime Datei, die von den neuen Regeln verdeckt würde.

Eine `.vercelignore` wurde bewusst nicht angelegt: Im Repository existiert kein Vercel-spezifisches privates Artefakt, und eine zusätzliche Deploy-Ausschlussliste könnte benötigte statische Dateien ausblenden. Eine `.npmignore` ist nicht erforderlich, weil dieses Repository kein zu veröffentlichendes npm-Paket ist.

## 4. Aktueller und historischer Secret-Scan

### 4.1 Eingesetzte Prüfungen

- Gitleaks 8.30.1, Arbeitsbaumscan mit `gitleaks dir . --redact=100`;
- Gitleaks 8.30.1, vollständiger Git-Scan mit `gitleaks git . --redact=100`;
- ergänzender maskierter Präfix-/Strukturscan über 1.064 eindeutige historische Text-Blobs;
- gezielte Prüfung auf Supabase-Service-Keys/JWTs, Stripe-Keys/Webhook-Secrets, GitHub-Tokens, OpenAI-/Gemini-/Provider-Keys, Datenbank-Zugangsdaten, private Schlüssel und eingebettete Credentials;
- historische Dateinamensuche nach `.env*`, Keys, Dumps, Datenbanken, Logs, Browserartefakten, Archiven und Exporten;
- maskierte Suche nach möglichen Kontakt-/Finanzkennungen und anschließende Kontextklassifizierung.

Alle Scannerreports lagen nur außerhalb des Repositorys unter `/tmp`, wurden nicht committed und gaben Secret-Werte nicht vollständig aus.

### 4.2 Gitleaks-Klassifizierung

Gitleaks meldete am aktuellen Stand 13 Fundstellen und über die erreichbare Historie 39 Fundstellen. Sämtliche Treffer gehörten zu vier eindeutig klassifizierten Werten:

1. Öffentlich verwendbarer Supabase-Publishable-Key, Fingerprint `sha256:582c8017f769…`, Länge 46: aktueller Browser-/Server-Fallback für die bekannte öffentlich nutzbare Projektkonfiguration; kein Service-Role-Key.
2. Öffentlich verwendbarer Supabase-Publishable-Key, Fingerprint `sha256:74e186465505…`, Länge 46: bekannte Staging-Publishable-Konfiguration; kein Service-Role-Key.
3. Nur historisch vorkommender Supabase-Publishable-Key, Fingerprint `sha256:c43cdbe22d93…`, Länge 46: ebenfalls ausdrücklich `sb_publishable_`, kein privilegiertes JWT und kein Service-Role-Key.
4. UI-Testzugangscode, Fingerprint `sha256:8ec2ba71a9cf…`, Länge 12: deterministisches Mock-/Testfixture unter `tests/`, kein Provider- oder Produktivtoken.

Bewertung: Dokumentation/öffentliche Publishable-Konfiguration beziehungsweise Testwert. Keine Rotation erforderlich.

### 4.3 Ergänzende Suche und sensible Daten

- Der ergänzende Scan fand 0 Treffer auf Service-Role-/privilegierte Supabase-JWTs, `sb_secret_`, `sk_test_`, `sk_live_`, `whsec_`, GitHub-PATs, OpenAI-/Gemini-Schlüsselmuster, AWS-Zugangsschlüssel, private Schlüssel oder Datenbank-URLs mit eingebetteten Zugangsdaten.
- Es wurde keine historisch gelöschte `.env`-, Key-, Dump-, Backup-, Datenbank-, Log-, Browser- oder Exportdatei gefunden.
- Öffentliche Ed25519-Schlüssel in den `*-pilot-public.json`-Dateien sind ausschließlich Verifikationsschlüssel. Die Erzeugungsskripte speichern den privaten Gegenpart nicht im Repository; der Private-Key-Musterscan blieb leer.
- Kontaktindikatoren unter `duelvanta.de` gehören zu bewusst veröffentlichten Produkt-/Rechts-/Adminangaben, nicht zu Nutzerexporten.
- Adressen unter `example.test`, `invalid.example` und `evil.test` sind reservierte Testdaten. `name@email.de` ist ein Formularplatzhalter.
- Numerische Telefon-/IBAN-Heuristiken waren False Positives aus Kartenkennungen, CSS-Werten, Benchmarktabellen und Modell-/Konfigurationsbezeichnungen. Ein echter IBAN-, Telefon- oder personenbezogener Export wurde nicht gefunden.
- Bekannte Supabase-Projektreferenzen und andere öffentliche Provider-/Projektkennungen wurden nicht als Secret fehlklassifiziert.

## 5. Supply-Chain- und Dependency-Prüfung

### 5.1 Ausgangsbefund

- Das Repository besaß weder `package.json` noch Lockfile.
- Der Workflow installierte fünf direkt exakt versionierte Testpakete mit `npm install --no-save --no-package-lock`; transitive Versionen und Integritätswerte waren damit nicht dauerhaft festgeschrieben.
- Paket-Lifecycle-Skripte wurden beim Installieren nicht blockiert.
- Der erste isolierte `npm audit` löste 34 Pakete auf und meldete genau eine hohe Schwachstelle, keine kritische: Playwright `<1.55.1`, GHSA-7mvr-c777-76hp, fehlende SSL-Zertifikatsauthentizitätsprüfung beim Browserdownload.

### 5.2 Korrektur

- Neues CI-isoliertes Manifest `.github/ci/package.json` mit den fünf tatsächlich verwendeten direkten Testabhängigkeiten.
- Neues Lockfile `.github/ci/package-lock.json`, Lockfile-Version 3, 34 aufgelöste Pakete, Registry-Integritätswerte für alle aufgelösten externen Einträge.
- Minimaler Playwright-Patch von 1.55.0 auf 1.55.1; keine unnötigen Major-/Minor-Upgrades.
- Workflow verwendet jetzt `npm ci --ignore-scripts` gegen das isolierte Lockfile.
- Der Workflow führt `npm audit --audit-level=high` aus.
- Zwei im Lockfile deklarierte Paket-Installationsskripte werden durch `--ignore-scripts` nicht ausgeführt.
- Der benötigte Chromium-Download erfolgt anschließend explizit über die lokal gelockte Playwright-1.55.1-Binärdatei; `npx` kann dabei kein ungeplantes Paket nachladen.
- Die CI-Abhängigkeiten bleiben außerhalb der produktiven Root-Konfiguration, damit der statische Vercel-Build nicht in ein npm-Projekt umgewandelt wird.

Der abschließende `npm audit` meldete: 0 info, 0 low, 0 moderate, 0 high, 0 critical.

### 5.3 GitHub Actions

Im Repository existiert genau ein Workflow. Externe Actions:

- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/upload-artifact@v4`

Alle stammen aus dem offiziellen GitHub-`actions`-Namespace; die Tags wurden gegen die jeweiligen öffentlichen Upstream-Repositories auflösbar verifiziert. Es gibt keine unbekannte Drittanbieter-Action, kein `curl`, kein `wget`, kein unkontrolliertes `npm install` und kein `npx` mehr im Workflow.

`postgres:17` ist das offizielle PostgreSQL-Image und dient ausschließlich als kurzlebige isolierte CI-Datenbank mit festem Testpasswort. Der Major-Tag bleibt veränderlich, stellt im dokumentierten Einmal-Container ohne Produktionszugriff jedoch keinen offenen hohen oder kritischen Befund dar.

## 6. Lokale Validierung

Erfolgreich ausgeführt:

- JSON-Parsing für CI-Manifest, Lockfile und `vercel.json`;
- `npm ci --ignore-scripts` aus dem isolierten CI-Verzeichnis;
- Playwright 1.55.1 und Installation des zugehörigen Chromium-Builds;
- `npm audit --audit-level=high`: 0 Schwachstellen;
- LinkeDOM-Tests: Account-Data-Rights-UI und TRADE-DOM vollständig erfolgreich;
- PGlite-Tests: TRADE-Actions, B02-Username-Guard und Stripe-Live-Mode vollständig erfolgreich;
- Browser-E2E: TRADE, Notice/Appeal, COLLECT und Scanner-V16 vollständig erfolgreich;
- `git diff --check`: erfolgreich;
- erneuter aktueller Gitleaks-Scan: nur die 13 vollständig klassifizierten Publishable-/Testwert-False-Positives.

Es wurden keine echten Nutzer, Zahlungen, Refunds, Provideraufrufe, Supabase-Migrationen oder Produktionssysteme verwendet.

## 7. Abschlusskriterien

1. Aktueller Secret-Scan: abgeschlossen.
2. Git-History-Scan: abgeschlossen.
3. `.gitignore`: bewertet und gezielt gehärtet.
4. Supply-Chain-/Dependency-Prüfung: abgeschlossen.
5. Alle Treffer: klassifiziert.
6. Echte Secrets: sicher ausgeschlossen; keine Rotation erforderlich.
7. Hohe/kritische Repository-/Supply-Chain-Befunde: keine offen; der Playwright-Befund ist behoben.
8. main: unverändert.
9. PR #5: weiterhin open, Draft und nicht gemergt.

## 8. Harte Grenzen – weiterhin verbindlich

- Kein Merge und keine Änderung an main.
- PR #5 bleibt Draft.
- Keine Produktionsänderung, Domain-Promotion oder produktive Supabase-Migration.
- Keine Stripe-Sandbox- oder Live-Payments aktivieren.
- Keine Secret-Rotation ohne echten Befund und Betreiberfreigabe.
- v-logo.svg niemals verändern.
- Slogan unverändert: COLLECT. TRADE. BATTLE.
- B01–B05 nicht erneut bearbeiten, solange kein neuer konkreter Befund entsteht.
- B06 und spätere Blöcke nur nach neuem ausdrücklichem Arbeitsauftrag beginnen.

## 9. Nächster offener Block

B06 ist als nächster Releaseblocker offen, wurde in diesem B05-Lauf jedoch nicht begonnen: Produktions-Auth-/Berechtigungsprüfung einschließlich MFA/Step-up, Sessions, Recovery und begründeter Advisor-Ausnahmen.

## 10. Übergaberegel

Der nächste Chat muss dieses Masterhandout V10 vollständig lesen und den final im B05-Abschluss genannten Branch-Head verwenden. B01–B05 sind geschlossen. B06 darf erst auf ausdrücklichen neuen Arbeitsauftrag begonnen werden. Produktion, main, Merge, Payment-Aktivierung und produktive Provideränderungen bleiben gesperrt.
