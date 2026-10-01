# DUELVANTA – MASTERHANDOUT V59

25.09.2026, Abschlussprüfung ca. 10:09 UTC. **P0-04: Einrichtung und Konfigurationsattestierung der vier ausdrücklich freigegebenen Production-Variablen PASS. Kein Deployment-/Runtime-PASS. Production-Rollout bleibt NO-GO; nach diesem Abschluss STOP.**

## Verbindlichkeit und Autorisierung

Der Nutzer hat am 25.09.2026 ausdrücklich die Einrichtung ausschließlich von SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY und DUELVANTA_PUBLIC_ORIGIN im Vercel-Production-Scope freigegeben. Keys ausschließlich aus Supabase enifiaqsnqtbzylnfrpi, Origin https://duelvanta.de. Keine Previewkopie, Rotation, Migration, kein Deployment, Merge oder P0-05. Diese Autorisierung hebt nur die entsprechende V58-Konfigurationssperre auf.

V57/P0-01, V55/P0-02 und V56/P0-03 behalten ihre Nachweisgrenzen. Der V58-Bericht bleibt historische Istaufnahme vor Einrichtung. Dieses V59 ersetzt dessen Aussage, die vier Production-Einträge fehlten, nicht dessen sonstige Betriebs-/Providergrenzen.

## Repository / CI / Production

Vor Ausführung frisch geprüft: marketplace-ux-v1 `2a67f48633b4abd81a418311f9824c285d9ed31e`; Scanner731 / 36116555780 SUCCESS; Battle207 / 36116556049 SUCCESS. PR5 open/Draft/unmerged; main `50f88213571be13255bb52eb489cc28cca660001`.

Vercel-Projekt `prj_dAtH0I1mwiHhOsA64J3iq97SoVnd`, Team `team_VHCwSwfBWANJvmS3qdkpJ0dK`. Production vor und nach Einrichtung: `dpl_ENc313pWZJMSn6y21VbURMEWLMkt`, READY, target=production, main50f8821. Keine neue Bereitstellung ausgelöst. Vercel meldete nach jedem Speichern ausdrücklich, dass die Änderung erst bei einem neuen Deployment wirksam wird. Redeploy wurde nicht gewählt.

**Dokumentationsveröffentlichung ausdrücklich freigegeben:** V59 und die P0-04-Abschlussnachweise werden auf `marketplace-ux-v1` veröffentlicht. Die oben genannten Remote-/CI-Werte dokumentieren den Ausgangsstand. Tatsächlicher neuer Remote-Head und beide Abschluss-CI-Workflows werden nach Veröffentlichung geprüft und im Abschluss der Sitzung bestätigt; dieses Dokument behauptet keinen vorab bekannten Commit oder CI-Erfolg. Keine Production-Konfigurationsänderung, kein manueller Deploy, kein Merge und kein P0-05 im Veröffentlichungsauftrag.

`attestation-final.json` bleibt die unveränderte zeitpunktbezogene Evidenz der Konfigurationseinrichtung: `git_push=false` und der V58-Head beziehen sich auf diese frühere Phase. Die anschließende ausdrücklich autorisierte Dokumentationsveröffentlichung ändert diese historische Beobachtung nicht.

## Vollständige Änderungsmenge

| Variable | Quelle / exakter nicht-sensitiver Wert | Scope / Typ | Nachweis |
|---|---|---|---|
| SUPABASE_URL | https://enifiaqsnqtbzylnfrpi.supabase.co | nur Production / Config | gespeichert, frisch geladen, exakter Wert zurückgelesen |
| SUPABASE_ANON_KEY | bestehender aktiver Legacy-anon-Key aus genau diesem Production-Projekt | nur Production / Config (öffentlicher Anon-Key) | Quelle → Eingabe und gespeicherter zurückgelesener Wert exakt gleich |
| SUPABASE_SERVICE_ROLE_KEY | bestehender aktiver Legacy-service_role-Key aus genau diesem Production-Projekt | nur Production / Secret, nicht wieder anzeigbar | Quelle → Eingabe exakt gleich, Secret-Typ geprüft, Speicherung erfolgreich, Eintrag nach Reload vorhanden |
| DUELVANTA_PUBLIC_ORIGIN | https://duelvanta.de | nur Production / Config | gespeichert, frisch geladen, exakter Wert zurückgelesen |

Keine anderen Variablen geändert, kein zusätzlicher Scope, keine Shared-Verknüpfung oder Branchoverrides hinzugefügt. Vorhandene Preview-Einträge sind weiterhin vorhanden und zeigen unveränderte historische Zeitangaben. OPENAI_API_KEY und DV_OPENAI_ACCOUNTING_KEY unverändert.

## Sichere Key-Zuordnung und genaue Methodikgrenze

Quelle war die authentifizierte Supabase-Seite `/dashboard/project/enifiaqsnqtbzylnfrpi/settings/api-keys/legacy`, mit eindeutigem Production-Projektkontext und getrennten Anon-/Service-Rollenfeldern. Bereits vorhandene Legacy-Keys enabled. Kein neues Keymaterial erzeugt; kein Signing-Key-/JWT-Secret-Wechsel.

Beide bestehenden Schlüssel direkt aus diesen sichtbaren Quellenfeldern in den flüchtigen Arbeitskontext übernommen und über die Vercel-Eingabemaske übertragen; keine Zwischenablagedatei, Shellargumente, Chat-/Repository-/Logausgabe oder Preview-Keyquelle. Zusätzlich Claims auf ref=enifiaqsnqtbzylnfrpi, jeweilige role=anon/service_role und nicht abgelaufene exp geprüft. Die Claimsprüfung ist eine zusätzliche Plausibilitätskontrolle, **keine eigenständige kryptographische Verifikation**. Entscheidend ist die direkt attestierte autoritative Projektquelle samt wertgleicher Übertragung.

Vercel bestätigte alle vier Speicheraktionen als erfolgreich. Nach Neuladen wurden Scopes und Typen geprüft. Anon-Key, URL und Origin wurden aus dem gespeicherten Ziel wertgleich zurückgelesen; der zunächst zu frühe Anon-Vergleich lag vor der abgeschlossenen Reveal-Anzeige, der Vergleich nach vollständiger Anzeige war exakt gleich. Kein Schlüsselunterschied festgestellt.

**Der Service-Key ist absichtlich nicht zurücklesbar.** Sein Nachweis umfasst die exakte Quelle-/Eingabegleichheit, aktiven Secret-Typ, erfolgreiche Provider-Speicherbestätigung und persistenten richtigen Production-Eintrag nach Reload. Kein unabhängiger entschlüsselter Ziel-Bytevergleich und kein Runtime-Keyaufruf werden behauptet. Kein Secret wurde zur stärkeren Rücklesbarkeit herabgestuft. Diese Einschränkung macht die dokumentierte Herkunft/Rollenzuordnung nicht uneindeutig, begrenzt aber den Nachweis der späteren Verwendung.

Kein HEAD/GET-/RPC-Aufruf mit Service-Key, kein Login-, Mail-, Scan- oder Paymenttest. API-Schlüsselakzeptanz im späteren Deployment bleibt Bestandteil der separat autorisierten Rolloutprüfung. Die gespeicherten Werte sind nicht automatisch Konfiguration des weiterhin laufenden alten Deployments.

## Auth-/Origin-Abschluss

Production Site URL frisch unverändert https://duelvanta.de. Vollständige Allowlist unverändert exakt:

- https://duelvanta.de/admin.html
- https://duelvanta.de/app.html
- https://duelvanta.de/welcome.html
- https://duelvanta.de/reset-password.html

Keine Wildcards, Staging-/Preview-/localhost-URLs in Production. Quellpfadabgleich und Browser-Publishable-Key-Prüfung aus V58 bleiben gültig; der Code ist unverändert. Keine Supabase-Authkonfiguration verändert. Mail-/Recovery-E2E nicht neu ausgeführt. Staging localhost:3000/leere Allowlist bleibt unverändert; der separate Kandidat wurde nicht ausgeführt.

Die bestehende V58-Domainbindung an Production bleibt über die frisch bestätigte Deployment-/Aliasantwort belegt. Originwert exakt .de; keine .com-/Previewfreigabe. Die isolierten Routingtests aus V58 bleiben PASS; keine Codeänderung, kein unnötiger erneuter Testlauf.

## Ergebnis und Fortsetzung

P0-04 PASS für die jetzt eingerichtete **gespeicherte Environment-/Keyquellen-/Origin-/Auth-Allowlist-Konfiguration** mit obiger Write-only-Nachweisgrenze. Kein umfassendes Providersecret-Audit, keine neue OpenAI-/Accounting-Hashprüfung, keine aktivierte Edge-/Media-/Schedulerfunktion. V58-Sicherheits-/Providergrenzen bleiben bestehen.

Production DB/Auth/Storage unverändert; einzige externe Mutation waren die vier freigegebenen Vercel-Konfigurationseinträge. Keine Migration, keine Keys rotiert, kein Deploy/Merge, kein P0-05 und keine Featureaktivierung. Production-Rollout weiterhin NO-GO bis sämtliche übrigen Gates geschlossen und gesonderte Ausführungsfreigaben erteilt sind.

**Jetzt STOP.** Ein nächster ausdrücklich beauftragter fachlicher Block kann P0-05 sein; er wurde hier nicht begonnen. Vor jeder späteren Ausführung Remote/CI, gespeicherte Environment-Scopes und unveränderte Productionquelle frisch attestieren. Die hier dokumentierte Veröffentlichung ist ausdrücklich autorisiert; nach erfolgreicher Remote-/CI-Abschlussprüfung STOP.

Nachweise im Paket: dieses vollständige Handout, `attestation-final.json`, `production-env-after.jpg` sowie SHA256-Dateiliste. Keine Schlüsselwerte enthalten.
