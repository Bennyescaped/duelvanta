# DUELVANTA – Schritt 1: Veröffentlichung und GitHub-CI

Stand: 22.09.2026. Repository: `Bennyescaped/duelvanta`. Branch ausschließlich `marketplace-ux-v1`.

**Status: Patch veröffentlicht, beide GitHub-Workflows erfolgreich. Die angemeldete Preview-Abnahme bleibt offen. Keine Rechts-, Gesamt- oder Produktionsfreigabe.**

## 1. Verbindlicher neuer Ausgangsstand

| Merkmal | Nachweis |
|---|---|
| Veröffentlichter Entwicklungs-Head | `822f4b9b32b2d00806ab2c152cbd3d71c5fc688c` |
| Parent | `2f352a8781a4358713a1ce7e4d7a235918eba004` |
| Commit-Nachricht | `fix(trade): guard legal step 1 compatibility` |
| Git-Tree | `a4f1d4a48d3e51d99811d07e429d25028187f475` |
| Codex-Lokalcommit als Datei-Quelle | `efd6d1b9d06b3ca4f1e5c1d8d6d7dca412b5433a` |
| Identität zum Codex-Ergebnis | 19/19 Git-Blob-IDs stimmen überein |
| `main`, nach Veröffentlichung erneut verglichen | `50f88213571be13255bb52eb489cc28cca660001`, identisch |
| PR #5, nach Veröffentlichung erneut gelesen | offen, Draft, nicht gemergt; Head `822f4b9b32b2d00806ab2c152cbd3d71c5fc688c` |

Der lokale Codex-Commit wurde nicht als Git-Objekt gepusht. Sein exakt gemeldeter Dateistand wurde über den GitHub-Connector als neuer Commit mit demselben Parent veröffentlicht. Daher unterscheiden sich die Commit-IDs, nicht die 19 Dateiinhalte. Der Entwicklungsbranch wurde ohne Force aktualisiert. Kein älterer Diagnose-Commit wurde übernommen.

Die zusätzliche Änderung `addEventListener(){}` im Browser-Mock von `tests/supabase-runtime-config-test.mjs` ist enthalten. Sie ist die einzige zusätzliche Abweichung gegenüber dem geprüften Ausgangsmanifest. Eine vor Veröffentlichung erkannte abschließende Zeilenumbruch-Abweichung im Stripe-Vertragstest wurde vor der Branchaktualisierung korrigiert; der veröffentlichte Blob stimmt exakt mit Codex überein.

Die Differenz zum Parent umfasst ausschließlich die 19 gemeldeten Zielpfade. SQL, Migrationen, Paket-/Lockdateien und `docs/handoffs/duelvanta-step1-transfer-2026-09-22.json` sind unverändert.

## 2. Umfang des veröffentlichten Schutzes

Der Browser-Kompatibilitätsschutz bleibt standardmäßig geschlossen. Nur die geprüfte versionierte Antwort kann freigeben. Fehler, Teilantworten und ein Fünf-Sekunden-Timeout schalten nicht frei. Eine verspätete positive Antwort hebt eine abgeschlossene Timeout-Sperre nicht auf.

Neue Vertragsaktionen werden abgefangen und bei fehlender Kompatibilität sichtbar deaktiviert, einschließlich dynamisch hinzugefügter Bedienelemente. Normale Navigation, bestehende Bestellungen und Bestellnachweise werden nicht grundsätzlich gesperrt. Die optionale neue Widerrufsabfrage wird bei fehlender Guard-Kompatibilität übersprungen; andernfalls ist sie begrenzt und Fehler liefern keine erfundene Widerrufsberechtigung. Fehler des eigentlichen Bestellabrufs bleiben sichtbar.

Der tatsächliche Script-Loader und die Cacheversionen sind vereinheitlicht. Fehlt der Guard selbst, wird der TRADE-Handler-Stack nicht geladen. Die optionale Käuferprofilabfrage blockiert den normalen Profilstart nicht mehr. Der ursprüngliche Mockfehler und die abgeschwächte Fehlerprüfung sind korrigiert.

**Dies ist ein clientseitiger Kompatibilitätsschutz, keine neue serverseitige Berechtigungsprüfung.** Es wurde kein Schema-Freigabemarker gesetzt und keine neue Legal-Migration angewandt. Die fachlichen Vertrags-, Preisbindungs-, Widerrufs- und Datenschutzfragen späterer Schritte sind damit nicht abgenommen.

## 3. CI auf dem veröffentlichten Stand

| Workflow / Job | Lauf | Ergebnis |
|---|---:|---|
| Scanner V16 Check | #644 / `35715793199` | SUCCESS |
| Scanner: validate | Job `106706852488` | SUCCESS |
| Scanner: quota_database | Job `106706852876` | SUCCESS |
| Scanner: collect_f3_database | Job `106706853024` | SUCCESS |
| Battle WebRTC Check | #120 / `35715793036` | SUCCESS |

Beide Runs sind dem Head `822f4b9b32b2d00806ab2c152cbd3d71c5fc688c` zugeordnet. Die PR-CI checkte den automatisch erzeugten Test-Merge-Ref `8468c3745584e78d05ea97ebf74a9936569bb1a8` aus. Dessen Dateidifferenz zum veröffentlichten Head wurde über GitHub verglichen: **keine geänderten Dateien**. Dieser synthetische Test-Merge ist keine Zusammenführung von PR #5 in `main`.

### Im validate-Job tatsächlich beobachtet

| Prüfung | Ergebnis aus CI-Log |
|---|---|
| Gepinnte npm-Testabhängigkeiten und Chromium | Installation erfolgreich |
| Schema-/Guard-/Loader-Prüfungen | 40 Assertions PASS |
| Profilgrenzen | 11 Prüfungen PASS |
| Bestelllese-Grenzen | 92 Prüfungen PASS |
| Runtime-/Environment-Grenzen | PASS |
| TRADE-DOM-Integration | ALL UI TESTS PASSED, nur Mocks |
| Bestehende TRADE-Chromium-Abnahme | Mobile und Desktop PASS |
| Neue Guard-/Loader-Chromium-Szenarien | 13 PASS |
| Neue Bestelllese-Chromium-Szenarien | 9 PASS |
| Bestehende PGlite-Datenbankregressionen | PASS |
| Bestehende native PostgreSQL-Servicejobs | SUCCESS |

Damit sind die zuvor in Codex wegen fehlender npm-Abhängigkeiten blockierten Prüfungen jetzt in GitHub Actions ausgeführt. Die Datenbankprüfungen betreffen die vorhandenen isolierten Tests; daraus folgt **keine** Staging-Abnahme der noch nicht angewandten Legal-Migration.

Die beiden bisherigen push-only-Schritte „Real complex-card reference recognition and recovery“ und „Read-only live catalog availability“ wurden beim PR-Ereignis erwartungsgemäß übersprungen. Das ist keine neue Freischaltung oder Abnahme des Scanner-Release-Gates.

Im vorhandenen Datenrechte-UI-Mock steht weiterhin eine abgefangene Meldung über fehlendes `db.auth.getSession`; der Test besteht. Diese separate ältere Mock-Meldung und die Action-Runtime-Deprecation-Warnungen wurden in diesem Step-1-Transfer nicht verändert. Die neue Runtime-Mock-Korrektur ist davon getrennt.

CI-Artefakt: `v16-mobile-recognition`, ID `10689340017`, laut Upload-Log 35 Dateien und 6.205.049 Bytes. Darin liegen unter anderem die neuen Browser-Ergebnisse. Das Archiv wurde in diesem Lauf nicht heruntergeladen; Upload und Testausgaben wurden aus dem CI-Log geprüft. Die kompakte JSON-Evidenz enthält die im Log gemeldete Archiv-Prüfsumme.

## 4. Automatische Vercel-Preview

Deployment-ID: `dpl_8tMuYUaMHvqppaJwuv95Rw9qGsZE`.

Vercel-Metadaten wurden über den verbundenen Connector gelesen: **READY**, Quelle `git`, Branch `marketplace-ux-v1`, exakte Commit-SHA `822f4b9b32b2d00806ab2c152cbd3d71c5fc688c`. Der GitHub-Vercel-Status ist erfolgreich. Es wurde kein manueller Deployment-Auftrag gesendet.

Deployment-Hostname:
`duelvantav5vision-jjo8zo1qr-bennyescaped-3783.vercel.app`

Branch-Alias:
`duelvantav5vision-git-marketplace-ux-v1-bennyescaped-3783.vercel.app`

Beide autorisierten Abrufversuche von `trade.html` über den Vercel-Connector lieferten **HTTP 302 zur Vercel-SSO-Anmeldung**, nicht den angemeldeten Anwendungstext. Deshalb wurden hier weder die ausgelieferten Assets byteweise noch die angemeldete Staging-Oberfläche geprüft. Deployment-READY und bestandene Fixture-Browsertests dürfen nicht als Ersatz dafür ausgegeben werden. Es wurden keine Schutzvorgaben deaktiviert und keine Anmeldedaten angefordert oder veröffentlicht.

## 5. Unverändert / keine Folgeschritte vorweggenommen

`main` blieb exakt auf `50f88213571be13255bb52eb489cc28cca660001`. PR #5 bleibt offen, Draft und unmerged. Keine Änderung an Production oder Production-Supabase, keine Staging-SQL-Anwendung, keine Stripe-Freischaltung, Payments, Refunds, Payouts oder E-Mails. COLLECT- und BATTLE-Code sowie Scanner-Release-Gate sind unverändert. Die bestehenden CI-Regressionsjobs sind keine neue praktische COLLECT-/BATTLE-Abnahme.

**Schritt 2 wurde nicht begonnen.** Vor seiner Umsetzung bleibt der eng begrenzte angemeldete Preview-Nachtest offen: neue Vertragsaktionen bei fehlendem Schema gesperrt, bestehende Bestellungen und Nachweise lesbar, Profilstart nutzbar. Keine neue Bestellung und keine Zahlungsaktion dafür auslösen.

Für die nächste Weiterarbeit gilt der veröffentlichte Head `822f4b9b32b2d00806ab2c152cbd3d71c5fc688c`, nicht der nur lokale Codex-Commit `efd6d1b9…`. Die alte Codex-Arbeitskopie nicht ungeprüft darüber pushen und nichts zurücksetzen.

## 6. Nachweisquellen

Die folgenden Quellen wurden in dieser Sitzung über die verbundenen GitHub-/Vercel-Tools gelesen:

- Commit: https://github.com/Bennyescaped/duelvanta/commit/822f4b9b32b2d00806ab2c152cbd3d71c5fc688c
- Dateidifferenz: https://github.com/Bennyescaped/duelvanta/compare/2f352a8781a4358713a1ce7e4d7a235918eba004...822f4b9b32b2d00806ab2c152cbd3d71c5fc688c
- PR #5: https://github.com/Bennyescaped/duelvanta/pull/5
- Scanner CI #644: https://github.com/Bennyescaped/duelvanta/actions/runs/35715793199
- Battle CI #120: https://github.com/Bennyescaped/duelvanta/actions/runs/35715793036
- CI-Artefakt: https://github.com/Bennyescaped/duelvanta/actions/runs/35715793199/artifacts/10689340017
- Vercel-Deployment: https://vercel.com/bennyescaped-3783/duelvanta_v5_vision/8tMuYUaMHvqppaJwuv95Rw9qGsZE

Maschinenlesbare Begleitdatei: `docs/handoffs/duelvanta-step1-publication-evidence-2026-09-22.json`. Sie enthält die 19 Dateiidentitäten, Run-/Deployment-IDs und die ausdrücklich offenen Abnahmepunkte. Keine Tokens, Zugangscookies oder temporären Share-URLs sind enthalten.

---
**Endstatus: Veröffentlichung und CI abgeschlossen; angemeldeter Preview-Smoke-Test offen. Keine Legal-, Gesamt- oder Produktionsfreigabe.**
