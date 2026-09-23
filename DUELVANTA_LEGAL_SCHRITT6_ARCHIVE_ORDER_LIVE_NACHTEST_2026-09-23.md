# DUELVANTA – Archiv-Order-Fix: Live-Nachtest

23.09.2026, 10:29–10:33 UTC. **Archivfix live PASS: zwei kontrollierte Opens derselben Order und normaler Aktivfilter bestanden. Kein neuer FAIL. Verbleibende Nachweisgrenzen werden ausdrücklich nicht als PASS ausgegeben.**

## Ausgangsbasis

V41, Archiv-Fixbericht, V40 und bisheriger Live-Integrationsbericht vollständig aus dem frisch gefetchten Remote gelesen. Repository Bennyescaped/duelvanta, ausschließlich marketplace-ux-v1. Remote exakt `d47e92941d052070a27dc391bfe565ef82291458`, technischer Fixhead `4bfe6c986c52a7889c163ce383a72f7a7fc42d92`. Seit V40 drei erwartete Commits: Runtimefix d96f4ec, Testassertion 4bfe6c9, V41-Dokumentation d47e929. Sieben betroffene Dateien entsprechen Fix, Tests/CI und Dokumentation. Keine eigene Codeänderung. Bestehende saubere lokale Arbeitskopie beibehalten; keine fremden Änderungen überschrieben, kein Reset, Branchwechsel oder Force-Push. Veröffentlichung ergänzt ausschließlich diesen Bericht, V42 und Evidenz auf dem aktuellen Remote-Tree.

main frisch `50f88213571be13255bb52eb489cc28cca660001`; PR #5 open, draft=true, merged=false. Staging ausschließlich `xhmjxrcskfhbovhitdej`; Production `enifiaqsnqtbzylnfrpi` ausschließlich Negativgrenze, keine Verbindung.

Migration History vor/nach read-only bestätigt: `20260923081953 / trade_legal_contract_model_v1`. PostgreSQL17.6, echte Readiness compatible=true und revision=trade-legal-contract-model-v1.2. **Migration nicht erneut angewandt.** Stripe sandbox_enabled=false/live_mode=false.

## Preview und Testrolle

Vorhandenes READY-Deployment `dpl_Bc9bQaRCFzjw42j3bp6ogp2YJe9D`, target=null, Commit d47e92941d052070a27dc391bfe565ef82291458:

https://duelvantav5vision-j8865cbrx-bennyescaped-3783.vercel.app

Runtime-GET über autorisierten Vercel-Connector HTTP200, environment=preview, URL ausschließlich https://xhmjxrcskfhbovhitdej.supabase.co. Keine Keys/Share-Tokens dokumentiert. Temporärer autorisierter Preview-Zugang; Deployment-Schutz unverändert, kein Deployment eigens für diesen Test.

Die alte Sitzung lag auf der vorherigen Preview-Origin. Nutzer meldete den vorhandenen Staging-Testkäufer erneut über die sichere Work-Anmeldung an. Judge ohne zusätzliche Marketplace-Rechte gemäß bereits ausdrücklicher Nutzerbestätigung; keine Owner-/Admin-Ersatzsession. Sichtbare angemeldete Navigation/Abmelden und Profil. DOM-Releasezustand internal-preview, kein Owner-Bypass. Keine Registrierung, Passwortänderung, Magic-Link oder E-Mail.

## Exakter erster Open-Test und Replay

TRADE → ARCHIV → vorhandene Order **DV-260917-000010** → einmal ORDER ÖFFNEN.

| Prüfung | Erster Open | Zweiter Open |
|---|---|---|
| Bestellansicht „Käufe und Verkäufe.“ | PASS | PASS |
| Ziel DV-260917-000010 sichtbar | PASS | PASS |
| Ziel hidden=false, Layout vorhanden | PASS | PASS |
| Synchroner DOM-Marker data-archive-open-target=1 | PASS | PASS |
| Ziel im sichtbaren Viewport nach automatischem Scroll | PASS | PASS |
| Aktive Orders 000007, 000006, 000004 weiter sichtbar | PASS | PASS |
| Andere abgeschlossene Orders 000009/000008 hidden=true | PASS | PASS |

Zweiter Durchlauf erst nach bestandenem ersten: zurück ARCHIV, dieselbe Order erneut genau einmal öffnen. Kein manuelles Setzen des Markers, keine Manipulation von Klassen, Scrollposition oder Guards. Temporärer Highlight-Effekt nicht separat zeitlich aufgezeichnet; Sichtbarkeit und Scrollziel direkt nachgewiesen, auch nach Ablauf des kurzen Highlight-Zeitraums.

Anschließend normaler Klick BESTELLUNGEN ohne Archivziel: alle drei completed-Orders hidden=true, Marker jeweils entfernt; drei aktive Orders sichtbar. Damit kein dauerhaftes Einblenden abgeschlossener Orders. Der V40-FAIL ist im gezielten Live-Umfang geschlossen.

## Weitere sichere Lesewege

| Teil | Status | Umfang |
|---|---|---|
| Guard-/Loader-/Assetreferenzen | PASS | Tatsächlicher angemeldeter DOM: trade-legal-readiness.js?v=1.2, trade-release-gate.js?v=1.4, trade-orders.js?v=1.9, trade-search-archive.js?v=1.1, trade-checkout.js?v=2.2. Neues Marker-Verhalten live nachgewiesen, kein alter Archivfix aus Cache |
| Exakter Guard-RPC-Trace/Fehler-/Timeout-Injektion | BLOCKIERT | Nicht über die verfügbare DOM-Prüfung nachgewiesen; keine versteckten Browserzustände/Tokens gelesen, keine Mock-/Bypass-Probe. SQL-Readiness getrennte Evidenz |
| Profil | PASS | Normale Identitäts-/Adressfelder lesbar, keine Business-Buyer-Auswahl, kein zweites Käuferprofil; nichts gespeichert |
| Aktive Orders | PASS | Drei unterschiedliche aktive Orders mit Details sichtbar; keine zweite Checkout-Aktion |
| Bestellnachweis-Dialog | PASS | Vorhandene B2C-Order 000006: ein Vertragsnachweis, checkout-contract-v1, Downloadbutton vorhanden |
| Heruntergeladener Nachweisinhalt | BLOCKIERT | In diesem Block kein Datei-Download/Inhaltsabgleich; Dialog-PASS nicht auf Dateiinhalt erweitert |
| Private Tabellenrechte | PASS im Katalog | authenticated hat weder private Schema-USAGE noch SELECT auf market_contract_snapshots, market_withdrawal_drafts, market_withdrawals, marketplace_message_outbox |
| Direkte Anfrage aus authentisiertem Browser an private Tabellen | BLOCKIERT | Keine entsprechende sichtbare UI-Aktion; keine Session-/Tokenextraktion oder eigene Browser-Fetch-Probe. Katalogprüfung nicht als Browserrequest dargestellt |
| Preisangebote-Leseansicht | PASS für leeren aktiven Zustand | „Keine aktiven Vorgänge“, keine zweite Checkout-Aktion sichtbar |
| Geeigneter bestehender Preisangebots-Positivfall | BLOCKIERT | Kein entsprechender sichtbarer Zustand; kein neues Angebot erzeugt |
| Festpreisdialog/Review | BLOCKIERT | Markt „Noch keine passenden Angebote“, null sichtbare JETZT-KAUFEN-Buttons; keine Reservation erzeugt |
| C2C / alter B2C ohne Widerrufsbutton | PASS im sichtbaren Umfang | Null sichtbare data-o-withdraw-Buttons bei vorhandenen Orders, einschließlich alter B2C-Order |
| Berechtigter B2C-Positivfall | BLOCKIERT | Kein geeigneter vorhandener Snapshot nach V39/V40; keiner erzeugt |
| Datenzahlen / Stripe OFF | PASS | Vor/nach unverändert |

## Vor-/Nachvergleich

Alle SQL-Abfragen explizit BEGIN READ ONLY. Vorher 10:29:17 UTC, nachher 10:33:21 UTC.

| Objekt | Vorher | Nachher |
|---|---:|---:|
| Listings | 14 | 14 |
| Offers | 2 | 2 |
| Deals | 8 | 8 |
| Orders | 6 | 6 |
| Contract snapshots | 8 | 8 |
| Withdrawal drafts | 0 | 0 |
| Withdrawals | 0 | 0 |
| Payment attempts | 2 | 2 |

Stripe jeweils false/false, History und Readiness identisch. Keine wirtschaftliche Mutation, kein Checkout-/Payment-/Refund-/Payout-/Withdrawal-/Order-Lifecycle-Submit, keine Profiländerung. Normale Anmeldung und vorhandene lesende RPCs sind kein wirtschaftlicher Testvorgang; kein vollständiger HTTP-Methoden-Trace behauptet. Mengenvergleich beweist keine allgemeine Gleichheit jedes einzelnen Datenfeldes.

COMPLIANCE_EMAIL_DELIVERY_ENABLED bleibt laut Nutzer **manuell im Vercel-Dashboard unter Project und Shared als unset bestätigt**; kein API-gelesener Environment-Wert behauptet. Keine POST-Dispatch-Probe, kein Dispatch-Secret, keine E-Mail.

## Abschluss

Evidenz: evidence/legal-step6-archive-live-20260923/read-only-evidence.json. Archivfix technisch und im beschriebenen Live-Umfang abgeschlossen. Alle hier tatsächlich ausgeführten sicheren Lesewege ohne neuen FAIL. Eine lückenlose Schritt-6-Gesamtabnahme wird wegen der ausdrücklich offenen Browser-/Dokumentnachweise nicht behauptet.

Keine Code-/SQL-/Schemaänderung und kein neuer technischer CI-Bedarf. V41 Scanner691/35847846921 und Battle167/35847846912 bleiben technische Fixevidenz; Nutzer nennt außerdem Dokumentations-CI Scanner692/Battle168 erfolgreich. Diese Läufe werden nicht als Live-Nachtest umetikettiert.

main unverändert, Production durch diesen Block unverändert/nicht verbunden, PR #5 offen/Draft/unmerged. Nur Dokumentationsveröffentlichung; automatische bestehende CI/Preview kann dadurch anlaufen, kein manuelles Deployment. Keine Produktions-, Rechts-, Merge-, Stripe-Live- oder kommerzielle Freigabe. Nach V42 STOP.
