# DUELVANTA – Masterhandout V12

Stand: 15.09.2026, nach Korrektur des nach V11 entdeckten Preview-/Auth-Routing-Befunds. Dieses Dokument ist der verbindliche Übergabestand und ersetzt widersprechende Statusangaben aus V11. V10/V11 bleiben Detailreferenzen für B01–B06, soweit V12 nichts aktualisiert.

## 1. Verbindlicher Repository- und Release-Stand

- Repository: Bennyescaped/duelvanta
- Entwicklungsbranch: marketplace-ux-v1
- V11-Ausgangs-Head: ac74797dc1ad57dd11e903d27ef44658e6653b0f
- korrigierter B06-Codecheckpoint vor diesem Handout: 108ed5fc971ddf097756cf8288d5e1915af74677
- V12-Head: der Commit, der dieses Handout anlegt; exakter SHA wird im Abschluss des ausführenden Chats genannt
- main: 50f88213571be13255bb52eb489cc28cca660001, unverändert
- PR #5: open, Draft, nicht gemergt
- B01–B05: geschlossen und nicht erneut bearbeitet
- B06: nach neuem konkretem Preview-Befund korrigiert und erneut geschlossen
- B07: nicht begonnen

Kein Merge, kein Force Push, keine Produktionsmigration, keine produktive Supabase-/Stripe-/Vercel-Konfigurationsänderung und keine Domain-Promotion.

## 2. Anlass der B06-Korrektur

Nach V11 wurde bei einem manuellen Preview-Test ein reales Flackern/ständiges Neuladen bei COLLECT gemeldet; derselbe Effekt trat bei BATTLE und STAFF auf.

Vercel-Runtime-Logs des V11-Previews zeigten den Runtime-Konfigurationsendpunkt mehrfach pro Sekunde. Ursache war eine Redirect-Schleife zwischen zwei unterschiedlichen Auth-Umgebungen:

1. Preview-Login verwendete korrekt Supabase Staging `xhmjxrcskfhbovhitdej`.
2. Legacy-Seiten COLLECT, BATTLE und STAFF erzeugten noch direkt einen Client gegen Produktion `enifiaqsnqtbzylnfrpi`.
3. Die Staging-Session existierte dort nicht, daher Redirect zum Login.
4. Der Login erkannte wieder die gültige Staging-Session und leitete zurück.
5. Die Schleife begann erneut.

Der Befund war konkrete neue Evidenz und durfte daher trotz zuvor geschlossenem B06 erneut bearbeitet werden.

## 3. Umgesetzte Runtime-/Routing-Korrektur

### 3.1 COLLECT und BATTLE

`site-nav.js` besitzt jetzt einen parser-blockierend früh ausgeführten Runtime-Guard für die noch eingebetteten Legacy-Clientaufrufe von COLLECT/BATTLE:

- bekannte Produktionshosts bleiben auf Produktion;
- Vercel-Preview, lokale Entwicklung und sonstige Nicht-Produktionshosts werden zwingend auf Staging `xhmjxrcskfhbovhitdej` geroutet;
- nur die bekannten Produktions-/Staging-Supabase-Projekte werden akzeptiert;
- unbekannte Supabase-Projekte werden abgewiesen;
- der tatsächlich erzeugte Client wird als `window.__dvAppDb` bereitgestellt, damit Navigation und Session-Guard denselben Client verwenden;
- auf COLLECT wird der Guard vor der Legacy-Clienterzeugung geladen;
- auf BATTLE wird der Guard vor `battle.js` geladen.

Die alten `SB_URL`-/`SB_KEY`-Konstanten in COLLECT/BATTLE werden dadurch im Preview nicht mehr als tatsächliches Ziel verwendet. Sie werden nur noch als Legacy-Eingabe abgefangen. Der Guard ist durch Syntax- und Runtime-Vertragstest abgesichert.

### 3.2 Direkt auf DV_SUPABASE umgestellte Einstiege

Folgende Pfade wurden direkt auf die gemeinsame Runtime-Konfiguration `/api/compliance-message-dispatch?runtime_config=1` beziehungsweise `window.DV_SUPABASE` umgestellt:

- `staff.html`
- `staff-admin.html`
- `ranking.html` / `ranking.js`
- `welcome.html`
- `u.html`
- `public-battle-profile.js`
- `index.html`
- `scanner-v16-host.js` (Entfernung des verbliebenen Produktionsfallbacks)

Damit verwenden auch Wartelistenformular, Beta-Aktivierung, öffentliche Profile, öffentliche BATTLE-Statistiken, Ranking und Staff-Bewerbung im Preview Staging statt Produktion.

### 3.3 Staff-Control

`staff-admin.html` wurde zusätzlich gehärtet:

- gemeinsamer Runtime-Client;
- fehlende Session -> `login.html?next=staff-admin.html`;
- Nicht-Owner -> `app.html`;
- Owner ohne AAL2 -> `mfa.html?required=1&next=staff-admin.html`;
- erst nach Owner + AAL2 werden Bewerbungen/Auditdaten geladen.

### 3.4 Redirect-Vertrag

Der zentrale Login behält die bestehende same-origin Dateinamenbegrenzung für `next` bei. Der neue Regressionstest fixiert die erwarteten Rückwege für COLLECT, BATTLE, STAFF und Staff-Control.

## 4. Zusätzliche Regressionstests

Neu: `tests/runtime-routing-contract-test.mjs`.

Der Test prüft unter anderem:

- direkte Runtime-Konfiguration auf allen neu migrierten Einstiegen;
- keine hart codierte Produktions-Supabase-URL in den direkt migrierten Runtime-Dateien;
- COLLECT lädt den Runtime-Guard vor seiner Legacy-Clienterzeugung;
- BATTLE lädt den Guard vor `battle.js`;
- Preview-Legacy-Aufruf auf Produktion wird tatsächlich auf Staging umgebogen;
- Produktionshost bleibt auf Produktion;
- unbekannte Supabase-Projekte werden abgewiesen;
- `window.__dvAppDb` zeigt auf den guarded Client;
- Login-`next` bleibt filename-only/same-origin;
- Staff-Control verlangt AAL2.

Der bestehende Required-Workflow wurde erweitert:

- alle relevanten Routing-/Runtime-Dateien lösen künftig CI aus;
- `site-nav.js`, `ranking.js` und `public-battle-profile.js` werden syntaktisch geprüft;
- `tests/runtime-routing-contract-test.mjs` läuft im Required-Job `validate`.

## 5. Validierung und Auslieferungsnachweis

Codecheckpoint vor V12-Dokumentation:

- Commit: `108ed5fc971ddf097756cf8288d5e1915af74677`
- Scanner V16 Check #279
- Run-ID: `34984150346`
- `validate`: success
- `quota_database`: success
- neue Routing-/Runtime-Vertragsprüfung: success
- bestehende Auth-, Marketplace-, Browser-, COLLECT- und Scanner-Regressionen: success
- erwartete Push-only Schritte auf PR-Lauf: skipped

Vercel-Preview des Codecheckpoints:

- Deployment-ID: `dpl_3uoXCpGvPnhKtB3zPbzLSTTL3Eb4`
- Host: `duelvantav5vision-o4dbenqu1-bennyescaped-3783.vercel.app`
- Status: READY
- Git-Commit: exakt `108ed5fc971ddf097756cf8288d5e1915af74677`
- Branch-Alias: `duelvantav5vision-git-marketplace-ux-v1-bennyescaped-3783.vercel.app`
- ausgelieferter Runtime-Endpunkt: HTTP 200, `environment=preview`, Supabase Staging `xhmjxrcskfhbovhitdej`, `Cache-Control: private, no-store`

Es wurde für den Nachweis kein echter Login, Kauf, Payment, Refund, Account-Delete oder sonstiger produktiver Vorgang ausgelöst.

## 6. B06 – finaler Status

B06 ist nach der neu entdeckten Routing-Lücke erneut geschlossen.

Geschlossen sind jetzt:

- Auth-/Berechtigungsprüfung;
- privilegiertes MFA/TOTP-Konzept;
- AAL2-Step-up für privilegierte Verwaltungswege;
- Recovery mit globaler Refresh-Session-Abmeldung nach Passwortreset;
- Review-only privilegierter DB-Session-/AAL2-Gate;
- Control-Center-Preview-Isolation;
- COLLECT-/BATTLE-/STAFF-Preview-Auth-Routing;
- Ranking, öffentliche Profile, Welcome und Landingpage Preview-Isolation;
- automatisierte Regression gegen erneute Preview->Produktion-Fehlverdrahtung.

Weiterhin bewusst NICHT auf Produktion angewandt:

- `database/auth-privileged-step-up-v1.sql` bleibt REVIEW ONLY bis B11/Produktionsmigration;
- Leaked-Password-Protection und serverseitige Session-Lifetime/Idle-Limits bleiben wegen Supabase-Free-Plan als dokumentierte B10-Releaseauflage offen.

Diese Punkte sind keine Wiederöffnung von B06, solange kein neuer konkreter Befund entsteht; sie gehören zum späteren Tarif-/Produktionsrollout.

## 7. Harte Grenzen – weiterhin verbindlich

- Kein Merge und keine Änderung an main.
- PR #5 bleibt Draft.
- Keine produktive Supabase-Migration oder Auth-Konfigurationsänderung.
- Keine Stripe-Sandbox-/Live-Payments, Refunds oder Payouts aktivieren.
- Keine Vercel-Produktionspromotion oder Domainänderung.
- `v-logo.svg` niemals verändern.
- Slogan unverändert: `COLLECT. TRADE. BATTLE.`
- B01–B06 nicht erneut bearbeiten, solange keine neue konkrete Evidenz entsteht.
- B07 und spätere Blöcke nur auf neuen ausdrücklichen Arbeitsauftrag beginnen.

## 8. Nächster offener Block

B07 ist der nächste offene Releaseblocker. B07 wurde in diesem Korrekturlauf nicht begonnen.

Der nächste Chat muss zuerst dieses Masterhandout V12 vollständig lesen und den finalen V12-Head verwenden. Widersprechende ältere Statusangaben aus V11 sind durch V12 ersetzt.
