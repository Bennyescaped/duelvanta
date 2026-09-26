# DUELVANTA – P0-04: Environment-/Key-/Origin-Bindung

> **Abschlussstand V59:** Die vier später ausdrücklich freigegebenen Production-Variablen wurden eingerichtet und im dokumentierten Umfang attestiert. P0-04 PASS für gespeicherte Konfiguration, mit Write-only-Nachweisgrenze des Service-Keys; kein Deployment-/Runtime-PASS. Verbindlicher Abschluss: [V59](DUELVANTA_MASTERHANDOUT_V59_2026-09-25.md), [finale Evidenz](evidence/production-environment-p0-04-20260925/attestation-final.json). Der folgende V58-Bericht bleibt unverändert als historische Aufnahme vor Einrichtung; seine fehlenden Production-Einträge und damalige Freigabesperre sind durch V59 überholt.

25.09.2026. **HARD STOP vor Production-Konfigurationsänderung. P0-04 nicht vollständig PASS.** Read-only-Inventar, Auth-Allowlist und sichere Konfigurationskandidaten vorbereitet. Keine Production-Mutation, Migration, kein Deploy, kein Merge; P0-05 nicht begonnen.

## Verbindliche Basis und Nachweise

V57 und P0-01-Abschlussbericht vollständig gelesen; V51/Production-Preflight sowie V55/V56 für Grenzen berücksichtigt. Repository Bennyescaped/duelvanta, ausschließlich marketplace-ux-v1. Frisch geprüfter Ausgangshead `08284a01ea81c8874cf675375956451140af7888`; Scanner730/36097709399 und Battle206/36097709393 SUCCESS. PR5 open/Draft/unmerged. Separater sauberer Checkout; alte Arbeitskopie mit lokalen Änderungen unangetastet.

Production bleibt `enifiaqsnqtbzylnfrpi`. Vercel-API bestätigt `duelvanta.de` → `dpl_ENc313pWZJMSn6y21VbURMEWLMkt`, READY/production/main `50f88213571be13255bb52eb489cc28cca660001`. Projekt `prj_dAtH0I1mwiHhOsA64J3iq97SoVnd`, Team `team_VHCwSwfBWANJvmS3qdkpJ0dK`.

Evidenz: `evidence/production-environment-p0-04-20260925/attestation.json`, Production-Scope-Screenshot; Kandidat: `config/production-environment-candidate-v1.json`. Keine Schlüsselwerte in diesen Dateien.

## Attestierter Iststand

| Bereich | Befund | Ergebnis / Grenze |
|---|---|---|
| Production-Domain | duelvanta.de Valid Configuration / Production; www.de 308 und Standard-vercel.app 307 auf .de | PASS Konfiguration; .com ist kein hier freigegebener Origin |
| Production-Browserkey | Enabled Publishable-Key, Provider-ID c190dfd3-a643-4455-86e9-9e8d07df9524, stimmt mit Repository-Konstante überein | PASS projektgebundener Providervergleich |
| Ausgelieferte Production | GET login.html und www.de/app.html → .de/app.html HTTP200; Production-Ref und Production-Publishable-Key, kein Staging-Ref | PASS für diese beiden statischen Antworten; keine Authsession erzeugt |
| Production-Auth | Site URL https://duelvanta.de; vier exakte Callback-URLs | PASS Allowlist-Konfiguration und Quellpfadabgleich; kein Mail-/Login-E2E |
| Vercel Project / Shared | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DUELVANTA_PUBLIC_ORIGIN nur Preview; keine verknüpften Shared-Variablen | BLOCKIERT: Production-Einträge fehlen |
| Production-Keyquelle | Legacy anon enabled; Legacy service_role vorhanden, Legacy-Keys enabled; modernes Secret ebenfalls vorhanden | Existenz belegt; Service-Key nicht aufgedeckt oder exportiert; keine gespeicherte Vercel-Zielbindung vorhanden |
| Scannerprovider | OPENAI_API_KEY gemeinsam Production/Preview; DV_OPENAI_ACCOUNTING_KEY getrennte Einträge | Nur Scopeinventar; kein neuer OpenAI-Konto-/Accounting-Hash-Abgleich, keine Rotation oder Scanneraktion |
| Staging-Auth | Site URL http://localhost:3000; leere Redirect-Allowlist | Keine Production-Cross-Allowlist, aber kein funktionsfähiger Preview-Mailcallback belegt; Passwort-/MFA-Tests aus 9B dadurch nicht entwertet |

Production-Allowlist vollständig:

- https://duelvanta.de/admin.html – Admin-Magic-Link
- https://duelvanta.de/app.html – regulärer Magic-Link
- https://duelvanta.de/welcome.html – aktuell deployte Beta-Einladung
- https://duelvanta.de/reset-password.html – Passwort-Recovery

Keine Wildcards, localhost, Staging-, Preview- oder fremden Domains. Keine Allowlist-Änderung erforderlich. Auth-E-Mail-Templates/SMTP und tatsächliche Zustellung sind hier nicht neu attestiert. Keine Auth-Mail, Einladung, Passwortänderung oder Token-Manipulation ausgelöst.

## Quellen- und Laufzeitgrenzen

`supabase-environment.js` bindet production an Production und preview/development an Staging; widersprüchliche konfigurierte URL wird verworfen. Browser bekommt nur Publishable-Key. Lokale bestehende Tests `runtime-routing-contract-test.mjs` und `supabase-runtime-config-test.mjs` PASS, darunter 18 ungültige Runtime-Konfigurationen. Diese Tests verwenden lokale Mocks und ersetzen keinen Test der später gespeicherten Production-Serverkeys.

`api/market-stripe-lib.js` nutzt SUPABASE_SERVICE_ROLE_KEY als apikey und ohne User-Token auch als Bearer; SUPABASE_ANON_KEY dient der Userprüfung. Dispatcher und Erasure-Worker benötigen ebenfalls Service-Key. Aktueller Code prüft Server-Key-Ref/Rolle nicht selbst lokal. Deshalb dürfen weder bloße Variablennamen noch dekodierte, unbestätigte JWT-Claims als vollständige Keyattestierung gelten. Bestehende Legacy-Keys sind für diesen Kandidaten kompatible Quelle; keine ungeprüfte Umstellung auf sb_secret und kein JWT-Signing-Key-Wechsel.

Stripe-Origin stammt aus DUELVANTA_PUBLIC_ORIGIN. Die API prüft HTTPS (Onboarding zusätzlich reinen Origin), bindet den Wert aber nicht selbst an duelvanta.de. Der Konfigurationskandidat bindet ihn deshalb exakt an https://duelvanta.de; keine Ableitung aus Request-Host, keine Previewkopie. Diese Konfigurationsattestierung ist keine neue Runtime-Sicherheitsfunktion und keine Stripe-Freigabe.

Production-Edgeinventar unverändert: invite-beta-user v2/verify_jwt=true, public-card-image v2/verify_jwt=false. Frisch gelesener Invite-Quelltext bindet CORS an https://duelvanta.de und Callback an /welcome.html; Supabase-Zugang aus projektseitigen Built-ins. Kein Funktionsaufruf. Die V55-MFA-Implementierung ist ein späterer Deploymentkandidat und noch nicht dort aktiv.

Branch-Media-Broker ist ausdrücklich auf den Preview-Origin festgelegt. Er darf nicht unverändert als Production-Media-Rollout verwendet werden. P0-01 hat Media/Provider/Scheduler-Aktivierung zurückgestellt; hier kein Edge-Deploy und keine Mediafreigabe. Vor späterer Aktivierung wären Production-Origin, getrennte Provider-/Reconcilersecrets und zugehörige Jobs separat zu attestieren. Vorhandene Diagnose-/Bildfunktionen werden nicht ersetzt oder gelöscht.

## Konkreter Konfigurationskandidat – nur nach Freigabe

Ausschließlich vier neue Einträge im oben benannten Vercel-Projekt, jeweils **nur Production**, ohne Branchoverride oder Shared-Verknüpfung:

| Name | Wertquelle / Soll |
|---|---|
| SUPABASE_URL | https://enifiaqsnqtbzylnfrpi.supabase.co |
| SUPABASE_ANON_KEY | bestehender aktiver Legacy-anon-Key genau dieses Production-Projekts |
| SUPABASE_SERVICE_ROLE_KEY | bestehender aktiver Legacy-service_role-Key genau dieses Production-Projekts; sensitive/server-only |
| DUELVANTA_PUBLIC_ORIGIN | https://duelvanta.de |

Dies erweitert den Zugriff künftiger Production-Serverfunktionen auf Production-Daten. Der Service-Key kann RLS umgehen und muss ausschließlich serverseitig gespeichert werden. Keine Keywerte in Chat, Repository, Screenshots, Zwischenlogs oder CI. Keine neuen Keys, keine Rotation, keine Preview-Werte kopieren. Quell-/Zieltransfer erst nach ausdrücklicher Freigabe; UI-Reveal allein ist kein sicherer Auditbeleg.

Ausführungsfolge nach Freigabe:

1. Remote/Productiondeployment und genau diese vier fehlenden Scopes frisch prüfen. Bei Drift STOP. Vorhandene Keys aus dem verifizierten Production-Projekt über sicheren Secretkanal beziehen; ref/role, Aktivstatus und Übereinstimmung mit autoritativer Quelle prüfen, ohne Werte offenzulegen. Falscher Ref, Rollenvertauschung, abgelaufener/gesperrter Key oder nicht sicherer Transfer: STOP.
2. Nur die vier neuen Production-Einträge anlegen; deren IDs, Scopes und nicht-sensitive Metadaten dokumentieren. Service-Key nicht als Browservariable oder Shared-Variable. UI-/API-Ausgabe vor Protokollierung redigieren. Keine Aktivierungsvariablen setzen und kein automatisches Redeploy bestätigen.
3. Gespeicherten Zielbestand und Secretgleichheit sicher attestieren. Optionaler Schlüsselakzeptanznachweis nur per HEAD/GET auf dem exakt festgelegten Production-Host, Redirects verboten, Timeout, keine Datenrückgabe loggen; keine POST-RPCs, Mail-/Login-/Scan-/Paymentaktionen. Claim-Dekodierung allein reicht nicht. Bei unzugänglichem sicheren Vergleich bleibt Keybindung BLOCKIERT.
4. Auth-Allowlist unverändert bestätigen. Aktuelles Productiondeployment muss unverändert bleiben. Gespeicherte Konfiguration betrifft spätere Deployments; **kein** Runtime-PASS des neuen Branchcodes ohne später separat autorisierten kompatiblen Rollout. P0-05 und weitere V51-Gates bleiben offen.

Rollback bei fehlerhafter Ablage: ausschließlich die vier gerade neu angelegten Production-Einträge anhand ihrer erfassten IDs entfernen; keine Preview-/Shared-/alten Providerwerte löschen und keinen Quellkey rotieren. Ein Deployment-/DB-Rollback ist nicht Bestandteil dieser Konfigurationsänderung.

Separater, nicht ausgeführter Staging-Callback-Kandidat: Site URL auf den festen marketplace-ux-v1-Preview-Origin und dieselben vier exakten Pfade unter diesem Origin; keine Production-URLs, keine globalen Vercel-Wildcards. Für die jetzige Production-Allowlist nicht erforderlich und nicht Teil der erbetenen Production-Freigabe.

## Abschlussstatus

Read-only-Befunde und Kandidaten liegen vor. **P0-04 insgesamt BLOCKIERT / HARD STOP**, weil Production-Serverkonfiguration und deren sichere gespeicherte Keybindung fehlen. Kein pauschales Environment-/Provider-/Secret-PASS. Ein vorhandener Supabase-Servicekey ist nicht gleichbedeutend mit seiner richtigen Speicherung in Vercel.

Nächster einziger Schritt: ausdrückliche Betreiberfreigabe für genau die vier Production-Variablen abwarten. Danach P0-04 fortsetzen und Nachweise vervollständigen. Kein P0-05, Merge, Production-Migration, Deploy oder Featurelaunch.

Dokumentationsquellen: https://supabase.com/docs/guides/auth/redirect-urls (exakte Production-Pfade), https://supabase.com/docs/guides/auth/signing-keys (Legacy-/neue Keytypen getrennt), https://supabase.com/changelog.md (gelesener aktueller Index). Keine API-/Keymigration aus allgemeinen Dokumentationsempfehlungen abgeleitet.
