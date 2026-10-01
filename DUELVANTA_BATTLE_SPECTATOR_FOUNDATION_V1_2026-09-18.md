# DUELVANTA — BATTLE Spectator Foundation V1

Stand: 18.09.2026. Post-V27-Delta, kein Produktionsrelease.

**Status: vollständig praktisch abgenommen. Implementierung, Staging-Rollentests, relevante CI sowie die öffentlichen und privaten Zuschauerpfade sind bestätigt. Spectator Media V1 und SFU bleiben ein zukünftiger Arbeitsschritt und wurden nicht begonnen.**

## 1. Grundlage und unveränderte Grenzen

Zuerst vollständig gelesen: `DUELVANTA_MASTERHANDOUT_V27_2026-09-18.md`, `DUELVANTA_BATTLE_RANKED_V1_ACCEPTANCE_2026-09-18.md`, `DUELVANTA_BATTLE_PRIVATE_INVITATIONS_2026-09-18.md`, `DUELVANTA_BATTLE_CAMERA_RESTART_2026-09-18.md`.

V27 bleibt Grundlage. Die genannten Post-V27-Dokumente und dieses Delta überschreiben ausschließlich veraltete technische Statusangaben. Bereits geschlossene Ranked-, Einladungs-, Kamera- und Judge-Abnahmen werden nicht pauschal wieder geöffnet.

- Repository: `Bennyescaped/duelvanta`; ausschließlich `marketplace-ux-v1`.
- Ausgangshead: `22f1515c80f9a51e86f24fec98b75bd52cc9376e`.
- Server-/Testcommit: `ae5e7c9dd259b24f06b04530bddc022299a78c8a`.
- Vollständig grün geprüfter technischer Head: `ce39799c5249a28eb110ee97bd2f4cb67a288994`.
- Dieses Dokument wird anschließend als reiner Dokumentationscommit ergänzt. Dessen SHA über den tatsächlichen Branch-Head ermitteln; nicht mit dem technischen Head verwechseln.
- `main`: `50f88213571be13255bb52eb489cc28cca660001`, unverändert. PR #5 offen, Draft, nicht gemergt.
- Staging: `xhmjxrcskfhbovhitdej`. Produktion und Production-Supabase `enifiaqsnqtbzylnfrpi` nicht verändert.
- TRADE eingefroren, Tausch nicht reaktiviert. Stripe Live sowie echte Payments, Refunds und Payouts nicht angefasst.
- `v-logo.svg` unverändert. Slogan: **COLLECT. TRADE. BATTLE.**

## 2. Implementierter Umfang

Eigene Zuschauer-Lobby und read-only Ansicht: `battle-spectator.html`, `battle-spectator.js`, `battle-spectator.css`.

Öffentliche Matches in `waiting`, `ready`, `live` und `dispute` werden über einen eigenen, berechtigungsgeprüften Endpunkt angeboten. Private Matches sind nicht in dieser Liste. Zuschauer sehen Namen, Matchstatus, rein informative Ready-Zustände, sichtbare Judge-Präsenz, Pause, bestätigtes Endergebnis und Zuschauerzahl.

Es gibt keinerlei Zuschauer-Kamera, Mikrofon, Video-/Audioelemente oder Broadcast. Die Seite lädt weder `battle.js` noch WebRTC-, Ranked- oder Moderationsruntime. Spieler-RPCs, Signalisierung und Mediensteuerung werden nicht von der Zuschaueransicht verwendet.

`battle-spectator-host.js` ergänzt auf der bestehenden Spielerseite ausschließlich einen Zuschauer-Einstieg, den Zähler und die Host-Verwaltung separater privater Zuschauerlinks. `battle.html` erhielt genau einen zusätzlichen Script-Tag; keine bestehende Funktion wurde umwickelt oder refaktoriert.

Die Browserregression schützt die unveränderten Git-Blob-Hashes:

| Datei | Erwarteter unveränderter Blob |
| --- | --- |
| `battle.js` | `4f465a801dd5561fa4adae2cc860823bc27ffa3d` |
| `battle-webrtc.js` | `5d97ae8e195264c6c14c18a33c4cbc5545533c14` |
| `site-nav.js` | `5981600bd10d8efdd633b2f5e5b2cb9573292ece` |
| `battle.html`, nach Entfernen nur des neuen Script-Tags | `bbb624f6aca3709b0609b7b93be910a29eb29dcb` |

## 3. Servermodell und Zugriffsschutz

Kanonische SQL-Datei: `database/battle-spectator-foundation-v1.sql`.

Privates Schema `battle_spectator_private`, drei Tabellen:

- `links`: Match, Schlüsselfingerprint, Generation und Aktivierung.
- `grants`: ausdrücklich erteilte Zuschauerberechtigung pro Match/Nutzer/Schlüsselgeneration.
- `presence`: Match/Nutzer/tatsächliche Auth-Sitzung/Browseransicht mit Ablaufzeit.

Alle drei Tabellen haben RLS und keine Browserrechte. `anon` und `authenticated` haben weder Schema-USAGE noch direkten Tabellenzugriff oder Zugriff auf die internen Hilfsfunktionen. Es wurde keine bestehende Match- oder Signal-Lesepolicy für Zuschauer erweitert.

Sechs neue öffentliche RPCs, ausschließlich für `authenticated`, mit festem leerem `search_path` und serverseitiger Autorisierung:

| RPC | Zweck |
| --- | --- |
| `list_battle_spectator_matches(text)` | Reduzierte öffentliche Zuschauer-Lobby |
| `join_battle_spectator(uuid,uuid,text)` | Autorisierter Zuschauerbeitritt / eigene Presence |
| `heartbeat_battle_spectator(uuid,uuid)` | Berechtigung erneut prüfen, Presence verlängern, Status lesen |
| `leave_battle_spectator(uuid,uuid)` | Ausschließlich eigene Browseransicht verlassen, idempotent |
| `get_battle_spectator_status(uuid)` | Zähler und Linkstatus für die bestehenden Matchteilnehmer |
| `set_battle_spectator_link(uuid,boolean)` | Privater Host: Schlüssel erstellen/ersetzen/widerrufen |

BATTLE-Berechtigung wird auf dem Server geprüft: Account `beta` oder `active`, nicht sicherheitsgesperrt, Altersband `16_17` oder `18_plus`, bestätigter aktueller Arena Code `battle-v1-2026-09`, keine Verarbeitungssperre. JWT-Nutzer, Rolle und `session_id` müssen zu einer tatsächlich vorhandenen, gültigen `auth.sessions`-Zeile passen. Anonyme Nutzer sind ausgeschlossen.

Die Antwort nutzt eine explizite Feldauswahl. Spieler-IDs, Spieler-Einladungscode, interne Moderationsnotiz, vorläufige Ergebnisangaben und Signale gehören nicht zur Zuschauerantwort.

### Rollen und private Codes

Zuschauer belegen niemals `host_id` oder `guest_id`. Host, Gast und aktuell zugeordneter Judge können demselben Match nicht zusätzlich als Zuschauer beitreten.

Ein additiver `BEFORE UPDATE`-Guard auf `battle_matches` verhindert Matchänderungen durch einen aktuell anwesenden Zuschauer. Auch ein global berechtigter Judge muss den Zuschauermodus dieses Matches zuerst verlassen, bevor er dort moderiert. Die vorhandenen Spieler-/Judge-RPC-Definitionen bleiben unverändert. Die Zuschauerrolle verleiht keine zusätzlichen kontoweiten Staff-Rechte.

Private Zuschauerlinks verwenden ausschließlich eigene `SP-`-Schlüssel mit 64 Hex-Zeichen, nicht den Spieler-Code. Gespeichert wird nur ein SHA-256-Fingerprint. Der Host erhält den Klartext nur bei Erstellung/Ersetzung; bestehende Links sind nicht aus der Datenbank auslesbar.

Link-Ersetzung oder Widerruf wechselt die Generation und entfernt vorhandene Berechtigungen/Presence dieses Matches sofort auf dem Server. Der Spieler-Code bleibt unverändert. Bereits angezeigte Browserdaten werden beim nächsten Abgleich verworfen; die Oberfläche ist kein Push-Broadcast.

Der Zuschauerlink enthält das Geheimnis im URL-Fragment, nicht in Query-Parametern. Nach erfolgreichem Beitritt wird das Fragment entfernt; der Schlüssel wird nicht dauerhaft im Browser gespeichert. Eine danach gültige serverseitige Berechtigung erlaubt den Wiederbeitritt per Match-ID. Nach Abmeldung einen privaten Zuschauerlink erneut öffnen.

### Presence und asynchrone Antworten

Gezählt werden unterschiedliche berechtigte Nutzer, nicht Tabs oder Geräte. Mehrere gültige Sitzungen/Ansichten derselben Person zählen pro Match einmal. Eine Browseransicht bekommt eine eigene Zufalls-ID. Pro Nutzer sind höchstens acht gleichzeitige Presence-Zeilen erlaubt.

Heartbeat: 20 Sekunden. Server-Lease: 75 Sekunden. Das Host-Panel fragt den Zähler alle fünf Sekunden ab. Bei hartem Verbindungsabbruch kann die letzte bestätigte Anwesenheit bis zum Lease-Ablauf gezählt werden; es wird keine sofortige Offline-Erkennung behauptet.

Abgelaufene, gesperrte oder ungültigen Auth-Sitzungen zugehörige Anwesenheiten zählen nicht. Ablaufende Zeilen werden beim nächsten Beitritt dieses Nutzers bereinigt; Löschen einer Auth-Sitzung entfernt deren Presence über den Fremdschlüssel. Ein abgelaufener Heartbeat kann die Anwesenheit nicht wiederbeleben. Beendete Matches zählen keine Zuschauer und stoppen die Statusverlängerung.

Nutzerbezogene Transaktionssperren plus Match-Zeilensperren sichern konkurrierende Beitritte, Tab-Limits, Rollenwechsel und Link-Widerruf ab. Clientseitig verhindern Anfragegenerationen und Cleanup verspäteter Antworten, dass geschlossene oder gewechselte Ansichten wieder erscheinen. Netzwerk-Timeout: 12 Sekunden; lokale Verwerfung unbestätigter Ansichten spätestens nach 70 Sekunden ohne erfolgreiche Statusbestätigung.

## 4. Neuer konkreter Befund und minimale Behebung

Bei der Bestandsaufnahme waren unnötige `TRUNCATE`, `REFERENCES` und `TRIGGER`-Rechte auf `battle_matches`/`battle_signals` für Browserrollen vorhanden. Der `TRUNCATE`-Fall wurde ausschließlich in der isolierten PostgreSQL-Testdatenbank reproduziert und nach der Migration erneut abgewiesen.

Nur diese Tabellenrechte wurden entzogen. Die für den bestehenden P2P-Pfad benötigten Signal-SELECT-/INSERT-Rechte und die vorhandenen RLS-Policies bleiben erhalten. Es wurde keine tatsächliche Staging-Tabelle geleert.

## 5. Nachweise

### CI zum technischen Head `ce39799…`

- Scanner V16 Check: https://github.com/Bennyescaped/duelvanta/actions/runs/35359475014 — `validate` und `quota_database` SUCCESS. Bestehende optionale externe Katalog-/Provider-Schritte waren workflowgemäß übersprungen; keine bezahlten Provider-Aufrufe wurden daraus abgeleitet.
- Battle WebRTC Check: https://github.com/Bennyescaped/duelvanta/actions/runs/35359475040 — `spectator_database` und `battle_webrtc` SUCCESS.
- Der vorangehende Servercommit war ebenfalls vollständig grün: Runs `35358018854` und `35358018868`.

`tests/battle-spectator-database-test.mjs` läuft in echtem PostgreSQL 17 mit unabhängigen parallelen psql-Verbindungen. Geprüft sind Autorisierung, Sessionbindung, private Projektion, Code-Trennung, Mehrfach-Tabs, echte konkurrierende Beitritte und Rollenwechsel, Ablauf, Sperre, Widerruf, Judge-Sperre sowie der bestehende Spielerablauf mit Ready/Start/Signalen/Ergebnis. Die sechs geprüften alten RPC-Definitionen werden vor/nach der Migration verglichen.

`tests/battle-spectator-browser-test.mjs`: zwölf erfolgreiche Chromium-Szenarien mit tatsächlichem HTML/JS und Runtime-Guard, aber bewusst isolierten RPC-/Auth-Antworten. Darunter XSS-Textbehandlung, mobile Ansicht, verspätete Antworten, Abbruch, TCG-Wechsel, Rollenfehler, privater Schlüssel, Widerruf, Timeout, terminaler Zustand und additive Host-Steuerung. Medienaufrufe: null. Das ist keine angemeldete Supabase-E2E-Abnahme.

Bestehende WebRTC-Browserregression unverändert erfolgreich: beidseitiger Audio-/Videoempfang, wiederholter Kamera-Neustart, Stop-/Ready-Grenze und Mikrofonsteuerung. Signalisierung ist dabei isoliert; es wurde kein echter Nutzer-Webcamtest vorgetäuscht.

Artefakte: `battle-spectator-database-evidence` und `battle-webrtc-evidence`. Letzteres enthält die Zuschauer-Desktop-/Mobile-Screenshots und JSON-Nachweise; Artifact-ID `10553442447` im Battle-Run.

### Tatsächliches Supabase-Staging

Die kanonische SQL-Datei wurde über `apply_migration` nur auf `xhmjxrcskfhbovhitdej` angewandt. Remote-Migration: **`20260918150007_battle_spectator_foundation_v1`**. Bereits installiert — nicht blind erneut ausführen oder auf Produktion übertragen.

Nachher geprüft: alle sechs RPCs authentifiziert ausführbar, anonym nicht ausführbar; private Schema-/Tabellenrechte geschlossen; RLS aktiv; unerforderliche Tabellenrechte entzogen; Signal-SELECT und -INSERT weiter vorhanden.

Die sechs bestehenden Spieler-/Judge-RPC-Definitionen sind unverändert, Fingerprint `7e7b4663f431e0995fea124b9829ae21`. Alle neun vorhandenen Matchzeilen sind unverändert, Fingerprint `851759b0703b24af7b414688450ce79e`.

Zusätzlich tatsächlicher Staging-RPC-Rollentest unter `SET LOCAL ROLE authenticated`, mit den vorhandenen Testprofilen und gültigen Auth-Sitzungen: öffentlicher Zutritt, reduzierte Antwort, unterschiedliche Tabs, Ready-/Start-/Spielerrollen-Sperre, privater Code und Grant, Rotation, Ablauf, Widerruf, unveränderter Spieler-Code sowie Judge-Sperre und zulässige Entscheidung erst nach Verlassen — PASS.

Alle hierfür angelegten Casual-Matches, Grants, Presence und Audit-Schreibvorgänge wurden innerhalb einer Transaktion zurückgerollt. Ein anfänglicher Spalten-/Wertefehler ausschließlich in der Testfixture wurde korrigiert und der gesamte Test erneut erfolgreich ausgeführt; kein Produktcode-Fix war nötig. Nachher weiterhin neun unveränderte Matches, null Zeilen in den drei neuen Tabellen. Keine Passwörter oder bestehenden Auth-Sitzungen verändert.

Security-Advisors: Die drei neuen privaten Tabellen werden erwartungsgemäß als RLS ohne Policy gemeldet; das ist hier bewusstes Deny-all. Die sechs authentifiziert aufrufbaren SECURITY-DEFINER-RPCs sind beabsichtigte, intern autorisierte API-Einstiege. Kein neuer Zuschauer-RPC ist anonym ausführbar. Vorhandene weitere Projektwarnungen, einschließlich deaktiviertem Leaked-Password-Schutz, wurden nicht als behoben oder warnungsfrei dargestellt und nicht außerhalb des Scopes geändert.

Referenzen zur Einordnung: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy ; https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable ; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

### Tatsächliches Preview

Technisches Deployment: `dpl_4oT9mED1dnN9DPgr2wYfEEgguGaz`, READY, `target=null`, Git-Ref `marketplace-ux-v1`, Git-SHA `ce39799c5249a28eb110ee97bd2f4cb67a288994`.

Commitgebundene Seite: https://duelvantav5vision-g7hs7vax5-bennyescaped-3783.vercel.app/battle-spectator.html .

Fortlaufender Branch-Alias: https://duelvantav5vision-git-marketplace-ux-v1-bennyescaped-3783.vercel.app/battle-spectator.html . Für eine Abnahme zuerst dessen tatsächlichen Deployment-Head gegenprüfen. Geschützte Previews benötigen Vercel-Zugang bzw. einen frisch erzeugten temporären Share-Link; Share-Schlüssel gehören nicht ins Repository.

Realer, ausschließlich ausgeloggter Browsercheck über TinyFish-Run `0bde9481-74f7-4346-94c2-31bbcf586272` erfolgreich: korrekte Foundation-Seite, abgeschlossene Anmeldeaufforderung, sichtbarer Login, versteckte Zuschauer-Lobby/Matchansicht, keine Video-/Audioelemente oder sichtbaren Spiel-/Moderationscontrols, keine gemeldeten JavaScriptfehler, kein beobachteter horizontaler Überlauf um 390 Pixel. Keine Anmeldung oder Matchänderung durchgeführt. Dieser Check ersetzt keine praktische Drei-Rol## 6. Praktische Abnahme — abgeschlossen

Abnahme am 18.09.2026 auf dem Preview des Branches `marketplace-ux-v1` mit Host `test-verkaeufer@duelvanta.de`, Gast `test-kaeufer@duelvanta.de` und `test-judge@duelvanta.de` ausdrücklich als normalem Zuschauer über **„ZUSCHAUEN · OHNE VIDEO“**. Technischer Abnahme-Head: `7ee367213eb0c92838162d1a5b82dc5757eca93e`. Deployment `dpl_EisYqSqpLYCZyGvF7LZeHQotasDw`: READY und demselben Git-SHA zugeordnet.

| Praktischer Pfad | Ergebnis |
| --- | --- |
| Öffentliches Casual-Match | PASS: Host und Gast blieben die einzigen Spieler. Der dritte Account erhielt eine eigene read-only Zuschaueransicht; Zähler 1. Keine Ready-, Start-, Ergebnis- oder Moderationssteuerung, keine Kamera-/Mikrofonanforderung und kein Zuschauer-WebRTC. |
| Presence / Mehrfach-Tab | PASS: Zwei Ansichten desselben Zuschaueraccounts wurden weiterhin als 1 Zuschauer gezählt. Nach Schließen einer Ansicht blieb der Zähler 1; nach regulärem Verlassen der letzten Ansicht fiel er auf 0. Der bereits automatisiert geprüfte Lease-Ablauf wurde nicht künstlich erneut abgewartet. |
| Privates Casual-Match | PASS: Spieler-Code `A25484` trat ausschließlich über den Spielerpfad als Gast `testKaeufer` bei, wurde im Zuschauerformular abgewiesen und das private Match erschien nicht in der öffentlichen Liste. Der getrennte `SP-`-Zuschauerlink gewährte ausschließlich read-only Zuschauerzugriff; Host und Gast blieben unverändert. |
| Rotation und Widerruf | PASS: Ersetzung machte den alten Zuschauerzugang beim nächsten Abgleich ungültig; der neue Link funktionierte und zeigte wieder Zähler 1. Der endgültige Widerruf schloss die offene Ansicht, setzte den Zähler auf 0 und ließ Gast sowie Spieler-Code unberührt. |
| Rollen und Rechte | PASS: Die Zuschaueroberfläche bot weder Spieler- noch Moderationsaktionen. Der Judge-Testaccount wurde ausschließlich als Zuschauer verwendet. Die praktische Rollenabweisung und der bereits vollständig grüne tatsächliche Staging-RPC-Rollentest bestätigen, dass Spieler/Judge nicht gleichzeitig Zuschauer desselben Matches sein können und Moderation erst nach Verlassen des Spectator-Modus möglich ist. Der bestehende Judge-Pfad wurde nicht verändert. |

Der vorhandene Zwei-Spieler-P2P-WebRTC-Pfad wurde wegen nur einer verfügbaren physischen Kamera nicht unnötig erneut als Zweigerätetest wiederholt. Seine zuvor bestätigte praktische Abnahme, die geschützten unveränderten Blob-Hashes und die erneut grüne WebRTC-Regression bleiben maßgeblich. Während der Spectator-Abnahme trat kein konkreter P2P-, Kamera- oder Signalregressionsbefund auf.

### Konkreter Befund und minimaler Fix

Beim absichtlichen Eingeben des Spieler-Codes in das private Zuschauerformular wurde der Zugriff serverseitig korrekt verweigert, die Rückmeldung erschien mobil jedoch außerhalb des sichtbaren Bereichs. Minimaler Fix ohne Änderung an Berechtigungen, Datenbank oder WebRTC:

- `battle-spectator.html`: Inline-Status direkt unter dem Codeformular.
- `battle-spectator.js`: sichtbare Fehlermeldung, `aria-invalid` und Zurücksetzen bei neuer Eingabe.
- `tests/battle-spectator-browser-test.mjs`: Regression für sichtbare Ablehnung ohne Join-RPC.
- Fixcommit: `7ee367213eb0c92838162d1a5b82dc5757eca93e`.
- Praktischer Retest: Spieler-Code `A25484` wurde sichtbar inline mit „Kein Zuschauerzugang“ abgewiesen; der getrennte Zuschauerlink funktionierte anschließend weiterhin.

Relevante CI zu diesem technischen Head:

- Battle WebRTC Check #38, Run [35379643555](https://github.com/Bennyescaped/duelvanta/actions/runs/35379643555): `battle_webrtc` und `spectator_database` SUCCESS.
- Scanner V16 Check #562, Run [35379643506](https://github.com/Bennyescaped/duelvanta/actions/runs/35379643506): `validate` und `quota_database` SUCCESS.

## 7. Abschlussentscheidung und Grenzen

**Spectator Foundation V1 ist praktisch abgenommen.** Öffentliche und private Zuschauerpfade, Presence-Deduplizierung, separate private Berechtigungen, Rotation, Widerruf und read-only Rollenbegrenzung sind bestätigt.

- `main` blieb bei `50f88213571be13255bb52eb489cc28cca660001`.
- Produktion und Production-Supabase `enifiaqsnqtbzylnfrpi` blieben unverändert.
- Staging `xhmjxrcskfhbovhitdej` wurde nicht blind erneut migriert.
- PR #5 bleibt offen, Draft und unmerged.
- TRADE, Tausch, Stripe Live, echte Payments, Refunds und Payouts wurden nicht angefasst.
- `v-logo.svg` und der Slogan **COLLECT. TRADE. BATTLE.** blieben unverändert.
- Dieser Abschlusscommit ändert ausschließlich dieses Dokument; sein tatsächlicher SHA ist anschließend als finaler Branch-Head zu erfassen.

**Nächster zukünftiger Arbeitsschritt: Spectator Media V1 / mögliche SFU-Entscheidung. Nicht Bestandteil dieses Work-Laufs und nicht begonnen.**
