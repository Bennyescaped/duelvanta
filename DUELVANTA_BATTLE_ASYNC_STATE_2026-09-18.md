# DUELVANTA – BATTLE Async-State / Post-V27

Stand: 18.09.2026
Status: **Gezielter Lobby-/Arena-Fix technisch geprüft; vollständige relevante CI SUCCESS; Preview-Auslieferung geprüft.**

Ergänzung zu `DUELVANTA_MASTERHANDOUT_V27_2026-09-18.md`, kein Ersatz für dessen Release-/Freeze-Regeln und keine Produktionsfreigabe.

## Ausgangspunkt und Grenzen

V27 wurde vollständig gelesen. GitHub bestätigte vor Beginn:
- Branch `marketplace-ux-v1`, Head `f7459391938fb64acf0cade4c87e0d87bf48dfcd`.
- `main` unverändert `50f88213571be13255bb52eb489cc28cca660001`.
- PR #5 offen, Draft, nicht gemergt.

Die reale Zwei-Geräte-Kernabnahme zum technischen Checkpoint `5ff782c86a3a55650a62f7d91860b0628e7137a8` bleibt geschlossen. Sie wurde nicht wiederholt. Detailreferenz bleibt `DUELVANTA_BATTLE_CAMERA_RESTART_2026-09-18.md`.

## Konkrete Befunde und Reproduktion

Analyse von `battle.js` sowie HTML, WebRTC-, Safety-, Moderations-, History-, Ranked-/Result-Addons, Runtime-Guard, BATTLE-Migrationen und relevanter CI zeigte zwei zusammengehörige Fehlerklassen:

1. `refreshMatch()` übernahm verzögerte Antworten ohne Prüfung der inzwischen aktiven Ansicht. Ein alter Refresh konnte nach `showLobby()` wieder `currentMatch` setzen, ein inzwischen geöffnetes anderes Match überschreiben oder bei vertauschter Antwortreihenfolge `live` auf einen älteren `ready`-Stand zurücksetzen.
2. `loadLobby()` übernahm verzögerte Antworten ohne Prüfung des inzwischen ausgewählten TCGs beziehungsweise eines neueren Ladevorgangs. Alte Pokémon-Ergebnisse oder alte Fehler konnten die aktuelle One-Piece-Lobby überschreiben. Vor einem Arena-Wechsel gestartete Antworten blieben auch nach der Rückkehr anwendbar.

Reproduziert wurde gegen den unveränderten V27-Runtime-Quelltext mit kontrolliert verzögerten Datenbankantworten, ohne echte Datenbank oder Kamera. Von 14 gezielten Prüfungen schlugen vor dem Fix 10 erwartungsgemäß fehl; vier bestehende Verhaltensprüfungen bestanden. Dies sind nicht zehn unabhängige neue Produktbefunde.

## Minimaler Fix

Technischer Commit: `4c75af5b14d83f0eea13cd9e8edf40ca71cff97b`.

Genau drei technische Dateien geändert:
- `battle.js`: vier bestehende Funktionen und die dazugehörigen Anfrage-/Ansichtszähler.
- `tests/battle-async-state-test.mjs`: neue isolierte Regression.
- `.github/workflows/battle-webrtc-check.yml`: Regression ausführen und JSON-Nachweis mit hochladen.

`showLobby()` und `openArena()` invalidieren alte Ansichts-/Lobby-Anfragen. `loadLobby()` rendert nur die weiterhin aktuelle Anfrage des ausgewählten TCGs außerhalb einer aktiven Arena. `refreshMatch()` prüft Match-ID, Ansichtsgeneration und bereits angewandte Antwortreihenfolge.

Für Match-Polling zählt die letzte **angewandte**, nicht bloß die letzte gestartete Anfrage. Dadurch bleiben überlappende langsame Antworten nutzbar, solange noch keine neuere Antwort angewandt wurde; langsame Verbindungen werden nicht durch dauernd neue Polls ausgehungert.

Keine Änderung an Auth, Safety, Moderation, Ready-/Start-/Ergebnisregeln, WebRTC, RPCs, SQL, Runtime-Guard, Branding oder TRADE. Kein Großrefactoring und keine neuen Abhängigkeiten.

## Regression und CI

Lokaler Nachweis: unveränderter V27-Quelltext **4/14 PASS, 10/14 erwartete FAIL**; gepatchter Quelltext **14/14 PASS**. Syntaxprüfung ebenfalls PASS. Die übertragenen drei Dateien wurden anhand ihrer Git-Blob-SHAs mit den lokal geprüften Bytes abgeglichen.

Die Regression deckt unter anderem Verlassen, Matchwechsel, erneutes Öffnen derselben ID, vertauschte Antworten, langsames Polling, leere/fehlgeschlagene Antworten, TCG-Wechsel, Retry sowie unveränderte Filterung/HTML-Escaping und privaten Code-Beitritt ohne automatischen Medienstart ab. Der private Code-Test ist ein isolierter Client-Vertragstest, keine neue reale Zwei-Nutzer-Abnahme.

Für exakt `4c75af5b14d83f0eea13cd9e8edf40ca71cff97b` bestätigte GitHub:

| Workflow | Run | Ergebnis |
| --- | --- | --- |
| Scanner V16 Check #534 | 35340666811 | SUCCESS |
| `validate` | Job 105585584687 | SUCCESS |
| `quota_database` | Job 105585584528 | SUCCESS |
| Battle WebRTC Check #10 | 35340666746 | SUCCESS |
| `battle_webrtc` | Job 105585584254 | SUCCESS |

Bestätigte Schritte: neue Async-State-Regression, bestehende Kamera-Neustart-Regression, echte Chromium-WebRTC-Regression mit isoliertem Signaling, BATTLE-/Profile-Datenbankgrenzen, Scanner-/Binder-/Mobile-Regressionsprüfungen sowie bestehende TRADE-/Quoten-Regressionssuite. Die beiden optionalen Schritte für komplexe reale Kartenreferenzen und read-only Live-Catalog-Availability waren planmäßig `skipped`, nicht als bestandene Live-Prüfungen gezählt.

CI-Nachweise:
- https://github.com/Bennyescaped/duelvanta/actions/runs/35340666811
- https://github.com/Bennyescaped/duelvanta/actions/runs/35340666746
- Artifact `battle-webrtc-evidence` enthält `battle-async-state.json` und `battle-webrtc-browser.json`.

## Preview und tatsächlicher Prüfumfang

- Deployment: `dpl_FMHNsAZ3A5KckWmk4QnEuUDC2eRn`.
- Host: `duelvantav5vision-37l4rdiy8-bennyescaped-3783.vercel.app`.
- Commit: `4c75af5b14d83f0eea13cd9e8edf40ca71cff97b`.
- Vercel: READY, `target = null`, Branch `marketplace-ux-v1`, nur Preview-Branch-Alias, kein Production-Target.

Live-HTTP-Prüfung über den verbundenen Vercel-Zugriff:
- `battle.html`: HTTP 200, BATTLE-Dokument ausgeliefert.
- `battle.js?v=4c75af5`: HTTP 200, neuer Anfrage-/Ansichtsschutz tatsächlich ausgeliefert.
- HTML lädt `site-nav.js` weiterhin parser-blockierend vor `battle.js`.
- `site-nav.js` ist im Repository bytegleich zum Ausgangsstand; Blob `5981600bd10d8efdd633b2f5e5b2cb9573292ece`.
- Ein separater direkter HTTP-Abruf von `site-nav.js` über das Werkzeug lieferte eine Vercel-SSO-Weiterleitung (302). Dies ist ausdrücklich kein positiver Einzelasset-HTTP-Nachweis. Der unveränderte Guard und die ausgelieferte Script-Reihenfolge wurden anhand Repository/HTML geprüft.

Keine neue angemeldete interaktive Preview-/Zwei-Geräte-Abnahme in diesem Block. Die automatisierte Chromium-WebRTC-Prüfung lief in CI mit isoliertem Signaling, nicht als reale Staging-Nutzersitzung. Keine Änderung an Preview-Authentifizierung oder Deployment-Schutz.

## Unverändert / weitere Arbeit

Keine Supabase-Migration angewandt; weder Staging noch Production verändert. Kein `main`-Update, kein PR-Merge, keine produktiven Payments/Refunds/Payouts oder PStTG-/DAC7-Meldungen. TRADE-Freeze, Tausch-Stilllegung, noch nicht ausgerollter Production-TRADE-Hard-Lock und noch nicht gelöschte Production-Testdaten bleiben unverändert. `v-logo.svg` und `COLLECT. TRADE. BATTLE.` unverändert.

Der bekannte Staging-Auditpunkt `public.market_notification_sync_state` ohne RLS wurde nicht bearbeitet und bleibt für den späteren Security-/Codex-Pre-Merge-Audit dokumentiert.

Diese Notiz wird in einem nachfolgenden reinen Dokumentationscommit abgelegt. Der vollständig geprüfte technische Stand und das oben genannte Preview bleiben `4c75af5...`. V27 bleibt der verbindliche Gesamtrahmen; diese Notiz ergänzt ausschließlich den abgeschlossenen Async-State-Block. Keine anderen BATTLE-Bereiche werden dadurch pauschal als abgenommen markiert.
