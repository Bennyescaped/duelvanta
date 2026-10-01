# DUELVANTA – Masterhandout V27

Stand: 18.09.2026  
Status: **VERBINDLICHER GESAMT-CHECKPOINT / BATTLE-KERNABNAHME PASS / TRADE-FREEZE BLEIBT**

V27 ersetzt V26 als verbindlichen Gesamtstand und ergänzt den Post-V26-BATTLE-Block nach:
- BATTLE-Beta-Account-Statusfix auf Staging;
- vollständiger realer Zwei-Geräte-WebRTC-Abnahme;
- wiederholten Host-/Gast-Kamera-Neustarts;
- Audio-/Mute-, Ready-, Matchstart-, Abschluss- und Dispute-Abnahme;
- Kamera-UI-Lifecycle-Fix mit finalem Preview-Retest;
- Scanner V16 Check #531 und Battle WebRTC Check #7 vollständig grün.

Der gesamte TRADE-/Legal-/Tax-/Pre-Merge-Rahmen aus V26 bleibt unverändert verbindlich.

Historische V26-Einleitung:
- vollständiger TRADE-Zwei-Rollen-Abnahme;
- dauerhafter Tausch-Stilllegung;
- TRADE-Lade-/UX-Hardening;
- zusätzlichem Production-TRADE-Hard-Lock als vorbereitete Release-Migration;
- vollständiger CI #522;
- konfliktfreier GitHub-Merge-Simulation gegen `main`;
- Owner-Entscheidung, die verbliebenen Production-Marketplace-Daten als alte Testdaten vor einem späteren Merge vollständig zu entfernen;
- Entscheidung, vor dem ersten großen Beta-Merge Recht/Tax technisch zu finalisieren und danach einen vollständigen Codex Pre-Merge Release Audit durchzuführen.

V27 ersetzt V26 als aktuelles Masterhandout. V21–V25 sowie die B07-Dokumente bleiben Detailreferenzen, soweit V26 nichts ausdrücklich aktualisiert. Dieses Dokument ist **keine Rechts-, Steuer-, Payment- oder kommerzielle Produktionsfreigabe**.

---

## 1. Produktbild und unveränderliche Leitplanken

DUELVANTA bleibt:

**COLLECT. TRADE. BATTLE.**

Primäre Produktbereiche:
- **COLLECT** – Sammlung, Kartenscanner, Slab-Scan, Binder und Sammlungsverwaltung.
- **TRADE** – künftig ausschließlich Kaufen + Verkaufen.
- **BATTLE** – Webcam-TCG-Arena mit Matchmaking, privaten Einladungen, Safety-/Moderationssystem und Matchhistorie.

Verbindliche Produktentscheidung:
- **Tausch ist dauerhaft aus dem TRADE-Release-Scope entfernt.**
- Keine Tausch-UI, keine Tausch-CTAs, keine neuen Swap-/Tauschvorgänge.
- Historische Swap-Daten, Tabellen, Migrationen und Dateien bleiben aus Nachweis-/Historiengründen erhalten.
- Sie dürfen nicht vorsorglich gelöscht oder reaktiviert werden.

Branding:
- Slogan unverändert: `COLLECT. TRADE. BATTLE.`
- `v-logo.svg` nicht verändern.
- Gold/Schwarz bleibt das bevorzugte DUELVANTA-Design.

---

## 2. Repository-, Branch- und Release-Stand

Repository:
`Bennyescaped/duelvanta`

Aktiver Entwicklungsbranch:
`marketplace-ux-v1`

Aktueller Branch-Head vor Erstellung dieses V27-Dokuments:
`45be7e2187edb59a96d2b81547001e095d1345ec`

Letzter vollständig grün geprüfter **technischer BATTLE-Checkpoint**:
`5ff782c86a3a55650a62f7d91860b0628e7137a8`

Der frühere TRADE-/Merge-Preflight-Checkpoint `39385df67cb5ad130c0ed6b41d13fd2cbb0228ae` bleibt als historischer Nachweis für den V26-TRADE-Block bestehen.

Unverändertes Production-`main`:
`50f88213571be13255bb52eb489cc28cca660001`

PR #5:
- offen;
- Draft;
- nicht gemergt;
- Base `main`;
- Head `marketplace-ux-v1`;
- aktuell mergeable;
- vor V26: 367 Commits vor `main`, 0 Commits dahinter;
- Merge-Base exakt `50f88213571be13255bb52eb489cc28cca660001`.

**Kein tatsächlicher Merge wurde durchgeführt.**

---

## 3. Vercel / Preview

Vercel-Projekt:
`prj_dAtH0I1mwiHhOsA64J3iq97SoVnd`

Team:
`team_VHCwSwfBWANJvmS3qdkpJ0dK`

Technisches Preview zu `39385df...`:
- Deployment: `dpl_FBqVb6DzUrzmsiyDdzi8R2bsEGWo`
- Host: `duelvantav5vision-mq6dsbm4b-bennyescaped-3783.vercel.app`
- Zustand: READY
- Target: Preview / kein Production-Target.

Aktuelles Preview zum Dokumentationsstand `92bb8cc...`:
- Deployment: `dpl_GJpHRZRfLjc3fWXZD3ircYtsck3J`
- Host: `duelvantav5vision-2qm34bucs-bennyescaped-3783.vercel.app`
- Zustand: READY
- Target: Preview / kein Production-Target.

Der zweite Stand enthält gegenüber dem technischen Checkpoint nur Dokumentation; die relevante geprüfte technische Basis bleibt `39385df...`.

---

## 4. Supabase-Umgebungen

Staging:
`xhmjxrcskfhbovhitdej` / DUELVANTA-STAGING

Production:
`enifiaqsnqtbzylnfrpi`

Verbindlich:
- Staging darf für interne Beta-/Preview-Arbeit verwendet werden.
- Production nicht verändern, solange kein ausdrücklich freigegebener Produktionsschritt vorliegt.
- Keine produktiven Marketplace-/Payment-Migrationen aus diesem Handout ableiten.
- Stripe Live bleibt aus.
- Keine echten Payments, Refunds oder Payouts.

---

## 5. CI – letzter vollständiger technischer Nachweis

Workflow:
`Scanner V16 Check`

Run:
**#522 / 35310511305**

Commit:
`39385df67cb5ad130c0ed6b41d13fd2cbb0228ae`

Gesamt:
**SUCCESS**

Bestätigte Kernbereiche:
- `validate`: SUCCESS
- `quota_database`: SUCCESS
- JavaScript Syntax: SUCCESS
- Scanner V16 Contract: SUCCESS
- OpenAI/Gemini/Ximilar-isolierte Regressionen ohne bezahlte Providercalls: SUCCESS
- Pokémon/One Piece Recognition: SUCCESS
- Mobile Photo Pipeline / State Recovery: SUCCESS
- Native iOS Photo Capture: SUCCESS
- BATTLE + Profile Database Access Boundaries: SUCCESS
- TRADE Contracts + Mobile Order Flow: SUCCESS
- zweite Mobile Acceptance Regressionen: SUCCESS
- COLLECT Scanner + Binder E2E: SUCCESS
- Mobile Browser Upload E2E: SUCCESS
- Browser Evidence: SUCCESS
- Production-TRADE-Hard-Lock Datenbankregression: SUCCESS

Nicht als Fehler zu interpretieren:
- reale komplexe Kartenreferenz-Prüfung und read-only Live-Catalog-Availability wurden im Lauf planmäßig `skipped`.

---

## 6. GitHub-Merge-Simulation gegen main – PASS

GitHub erzeugte für PR #5 den synthetischen Mergecommit:

`4f19abdee3e8f23b59d33781bb7442062e961722`

Eltern:
1. `50f88213571be13255bb52eb489cc28cca660001` – main
2. `39385df67cb5ad130c0ed6b41d13fd2cbb0228ae` – geprüfter Branch-Checkpoint

Tree des synthetischen Mergecommits:
`5b046446bb4c1c6f3bc3a07c51c5b51ff5c312fa`

Tree des Branch-Checkpoints:
`5b046446bb4c1c6f3bc3a07c51c5b51ff5c312fa`

Damit ist der synthetische Merge konfliktfrei und inhaltlich identisch mit dem Branch-Tree.

Wichtig:
GitHub Actions #522 checkte ausdrücklich
`refs/pull/5/merge`
mit dem synthetischen Mergecommit aus. Die vollständige grüne CI ist daher gleichzeitig die technische Merge-Simulation gegen den aktuellen `main`.

Separates Nachweisdokument:
`DUELVANTA_BETA_MERGE_PREFLIGHT_2026-09-18.md`

---

## 7. TRADE – aktueller Produktstatus

TRADE ist technisch weit entwickelt und in Preview/Staging funktionsfähig.

Aktiver Scope:
- Markt / Listings;
- Single;
- Graded;
- Sealed;
- Verkauf;
- Festpreis;
- Verhandlungsbasis / Preisangebote;
- Bestellungen;
- Combined Shipping;
- Versand;
- persönliche Abholung;
- Übergabecode;
- private Order-Abholchats;
- Tracking;
- Empfangsbestätigung;
- Storno-/Problemflüsse;
- Benachrichtigungen;
- Suche;
- automatisches Archiv;
- Verkäufer-Onboarding;
- Notice & Action;
- Vertrags-/Bestellsnapshots;
- Datenexport/Löschvorbereitung;
- PStTG/DAC7-Ledger-Grundsystem;
- Stripe-Connect-Sandboxfundament, weiterhin deaktiviert für echte Transaktionen.

Nicht im Release-Scope:
- Tausch / Swap.

---

## 8. TRADE-Zwei-Rollen-Abnahme – vollständig geschlossen

Reguläre Staging-Testrollen:
- Käufer: `test-kaeufer@duelvanta.de`
- Verkäufer: `test-verkaeufer@duelvanta.de`

Keine Passwörter in Masterhandouts dokumentieren.

### Versand

Order:
`DV-260917-000009`

UUID:
`60085d9b-b744-45d2-91b2-6df3f3dc9649`

Browserseitig bestätigt:
- Käufer öffnet Versandorder;
- Tracking sichtbar;
- Käufer bestätigt `ERHALTEN – ALLES IN ORDNUNG`;
- Order verschwindet nach Reload aus offenen Aktionen;
- Käufer-Archiv: `KAUF / COMPLETED`;
- Verkäufer erhält `ERHALT BESTÄTIGT`;
- Verkäufer-Archiv: `VERKAUF / COMPLETED`;
- zugehöriges Listing `SOLD`.

Staging:
- `technical_completion_reason = buyer_received_ok`
- 1 Deal;
- 0 offene Deals;
- 1 SOLD-Listing;
- 1 Abschlussmeldung.

### Abholung

Order:
`DV-260917-000010`

UUID:
`0cc409fd-5382-4e4c-911d-fe6bd88a210d`

Browserseitig bestätigt:
- Verkäufer erzeugt frischen einmaligen Übergabecode;
- Käufer bestätigt Code;
- Code nur einmal verbraucht;
- Käufer-Archiv: `KAUF / COMPLETED`;
- Verkäufer erhält `ERHALT BESTÄTIGT`;
- Verkäufer-Archiv: `VERKAUF / COMPLETED`;
- drei zugehörige Listings `SOLD`.

Staging:
- `technical_completion_reason = pickup_bilateral_handover`
- 3 Deals;
- 0 offene Deals;
- 3 SOLD-Listings;
- 1 Abschlussmeldung.

Diese Zwei-Rollen-Abnahme ist **geschlossen und nicht erneut durchzuführen**, solange kein neuer reproduzierbarer Befund entsteht.

---

## 9. Staging-Drift bei Versandabschluss – geschlossen

Bei `DV-260917-000009` wurde nach dem Browserabschluss festgestellt, dass Staging noch eine ältere Version von `confirm_market_order_received` verwendete.

Folge:
- Order war korrekt `completed`;
- B07-Felder `buyer_received_ok_at`, `technical_completed_at`, `technical_completion_reason` fehlten.

Gezielte Staging-Korrektur:
- aktuelle B07-Funktion aus dem Branch aktiviert;
- vorhandenes Abschlussereignis konsistent nachgezogen;
- kein Browsernachweis durch SQL ersetzt.

Der Befund ist geschlossen.

---

## 10. Tausch-Stilllegung – vollständig und dauerhaft

Tausch wurde nicht nur optisch versteckt.

Aktiver Runtime-Stack:
- lädt `trade-c2c-swap.js` nicht;
- lädt `trade-listing-type-rules.js` nicht.

UI:
- kein Tausch-Tab;
- keine Tausch-CTAs;
- kein `Verkauf oder Tausch`;
- Single/Graded nur Verkauf;
- Sealed nur Verkauf.

Server/Staging:
- neue Swap-Threads/Revisionen/Bestätigungen blockiert;
- Swap-Mutations-RPCs für normale Browserrollen entzogen;
- neue Nicht-Verkaufs-Listings blockiert;
- alte Tausch-Angebote dürfen keine neuen Deals erzeugen;
- öffentliche reine Tausch-Listings werden nicht ausgeliefert.

Historie:
- historische Daten bleiben erhalten;
- zuletzt geprüft: 6 historische `trade`-Listings, 0 `sale_or_trade`;
- 0 aktive/reservierte/pausierte retired Listings.

Nicht erneut bearbeiten, solange kein konkreter Defekt vorliegt.

---

## 11. TRADE Lade-/UX-Hardening – geschlossen

Früherer Befund:
Beim Öffnen von TRADE/Archiv erschien kurz ein unfertiger, überlagerter Zustand; ein erster Render-Hold erzeugte anschließend kurz eine schwarze Fläche.

Finale Lösung:
- stabiler Boot-Shell in `trade.html`;
- sichtbarer Ladezustand:
  **TRADE – Marktplatz wird geladen.**
- aktive Marktoberfläche wird erst nach Kerninitialisierung freigegeben;
- Runtime-Skripte werden parallel angefordert und behalten definierte Ausführungsreihenfolge;
- Marketplace-UX und Archivfilter werden vor Freigabe synchronisiert;
- reduzierte kurze Einblendanimation;
- `prefers-reduced-motion` berücksichtigt.

Praktische iPhone-Abnahme durch Owner:
- Ladebildschirm funktioniert;
- keine Überlagerung;
- Übergang zu TRADE sauber;
- Bestellungen sauber;
- Archiv sauber;
- UX vom Owner ausdrücklich bestätigt.

Nicht weiter refaktorieren, solange kein neuer reproduzierbarer UI-Befund entsteht.

---

## 12. Production-TRADE-Release-Lock

Bereits vorhandener Web-Lock:
- Production normaler Nutzer: `COMING SOON 2027`;
- Production anonym: gesperrt;
- Production Owner: Owner-Bypass;
- Preview/Staging: vollständig testbar;
- normale Production-Nutzer laden keinen TRADE-Runtime-Stack;
- öffentliche Production-Listing-Links sind gesperrt.

Zusätzlicher Befund vor Merge:
Ein reiner UI/Web-Lock genügte nicht als vollständige Release-Sperre, weil Production historisch noch Marketplace-RPCs und direkte Tabellen-Schreibrechte für `authenticated` besitzt.

Dafür wurde **nur im Repository** vorbereitet:

`database/market-production-trade-lock-v1.sql`

Status:
- NICHT auf Production angewendet;
- NICHT auf Staging angewendet;
- ausschließlich für einen später ausdrücklich autorisierten Production-Beta-Release vorgesehen.

Wirkung der vorbereiteten Migration:
- entzieht Browserrollen direkte Insert/Update/Delete-Rechte auf Commerce-Kerntabellen;
- sperrt neue Listing-/Offer-/Buy-/Offer-Accept-/Publish-/Edit-Einstiege;
- bestehende Orders dürfen weiterhin Versand, Empfang, Probleme/Storno und Abschluss durchlaufen;
- Read-/Datenrechte bleiben erhalten;
- Reopening von TRADE erfordert später eine ausdrücklich geprüfte Unlock-Migration.

Regression:
- echte PostgreSQL-Wegwerf-DB in CI #522: SUCCESS.

---

## 13. Production-Marketplace-Testdaten – Owner-Entscheidung

Read-only Preflight fand in Production:
- 2 offene Orders;
- 2 offene Deals;
- 1 reserviertes Listing;
- 3 angenommene/offene Offers.

Offene Orders:
- `DV-260910-000006` – open, Versand, 18,00 EUR, `manual_beta`
- `DV-260917-000007` – open, Versand, 78,00 EUR, `manual_beta`

Owner-Entscheidung vom 18.09.2026:
**Diese Vorgänge und der zugehörige nichtterminale Marketplace-Bestand sind alte Testdaten und sollen vor dem späteren Merge vollständig entfernt werden.**

Wichtig:
- Die Löschung wurde in diesem Checkpoint **noch nicht ausgeführt**.
- Bis zum Pre-Merge-Fenster bleibt Production unverändert.
- Vor der Löschung muss der konkrete zusammengehörige Datensatzbaum nochmals lesend bestimmt werden, damit nur die bestätigten alten Testdaten und keine unabhängigen Nutzerdaten entfernt werden.
- Danach Cleanup mit Nachher-Prüfung und dokumentiertem Zählervergleich.
- Kein pauschales `TRUNCATE`, kein ungezieltes Löschen kompletter Marketplace-Tabellen.

---

## 14. COLLECT – aktueller stabiler Stand

COLLECT bleibt während des TRADE-Freeze aktiv weiterentwickelbar, sofern keine bestehenden Scanner-/Binder-Garantien gebrochen werden.

Scanner V16 / OpenAI:
- OpenAI ist der aktive KI-Pfad;
- Ximilar ist aus dem aktiven Runtime-/Budgetpfad entfernt;
- historischer providerneutraler Ledger bleibt nur als Historie;
- Owner-Steuerung vorhanden;
- Standardgrenzen: **50 Raw/Card-Scans + 10 Slab-Scans pro Nutzer und Berlin-Woche**;
- monatliches internes OpenAI-Appbudget standardmäßig **25 EUR**;
- Owner kann Limits nach unten bis 0 und Scanner on/off steuern;
- Accounting-Key ist serverseitig, nicht im Client/Repository;
- atomare Reservierung vor Providercall;
- unsichere/unklare Requests werden nicht automatisch gutgeschrieben.

Binder/Collection:
- Scanner-Einstieg in COLLECT;
- Karten in Sammlung übernehmen;
- interaktive Binder;
- Drag & Drop;
- freie Plätze bleiben frei;
- Seitenwechsel;
- seitenübergreifendes Tauschen von Binderpositionen;
- Graded/Slab-Support vorhanden.

CI #522 bestätigt Scanner/Binder/Mobile-Upload weiterhin grün.

COLLECT in diesem TRADE-Abschlussblock nicht weiter verändern.

---

## 15. BATTLE – Kernabnahme abgeschlossen

BATTLE ist aktuell **Beta live** und vom TRADE-Freeze unabhängig. Der BATTLE-Kernpfad wurde am 18.09.2026 real mit zwei Staging-Nutzern und zwei Geräten vollständig abgenommen.

Finaler technischer Checkpoint: `5ff782c86a3a55650a62f7d91860b0628e7137a8`.
Finales Preview: `duelvantav5vision-55flywomc-bennyescaped-3783.vercel.app` / READY.
CI: Scanner V16 Check #531 SUCCESS; Battle WebRTC Check #7 SUCCESS.

Praktisch PASS: Safety-Gate, öffentliche Lobby, Create/Join, bidirektionales Video und Audio, Mute/Unmute, wiederholter Kamera-Neustart auf Host und Gast, Kamera-Ready-Sperre, Ready-Synchronisation, Host-Start, Match live, konsistenter Abschluss sowie Dispute bei widersprüchlichen Ergebnissen.

Post-V26 behoben: BATTLE akzeptiert nun die vorgesehenen Profilzustände `beta` und `active`; `suspended`, `safety_restricted` und anonyme/null Auth bleiben gesperrt. Die Migration wurde nur auf Staging angewandt. Ebenfalls behoben und real bestätigt: stale Kamera-Button-State nach Matchwechsel; ein neues Match ohne Kamerastart zeigt wieder konsistent `KAMERA TESTEN` / `KAMERA NICHT AKTIV`.

Detailnachweis: `DUELVANTA_BATTLE_CAMERA_RESTART_2026-09-18.md`.

Vorhanden:

Vorhanden:
- Pokémon + One Piece;
- öffentliche Lobby;
- private Matches per Einladungscode;
- Match erstellen / beitreten;
- Ready-State;
- Host-Start;
- physisches TCG per Webcam;
- WebRTC-Modul;
- Kamera-Test;
- Ergebnisabgabe durch beide Spieler;
- Abschluss bei übereinstimmendem Ergebnis;
- Dispute bei widersprüchlichen Ergebnissen;
- Matchhistorie;
- Profile/Founder-Verknüpfung;
- Moderatoren-/Judge-Beitritt;
- Pause/Fortsetzen durch Moderation;
- Spieler-Meldeprozess;
- Safety Gate;
- 16+ Kennzeichnung;
- Arena Code;
- V1 ausdrücklich ohne dauerhafte Webcam-Aufzeichnung;
- DE/EN/JP/CN/KR UI-Grundtexte.

Security-/Auth-Grundlage:
- anonyme/null Auth-Bypässe für zentrale BATTLE-RPCs sind durch Migration/Regression geschlossen;
- Safety-restricted Accounts können BATTLE nicht selbst wieder freischalten;
- privilegierte Verwaltungswege benötigen AAL2 + aktive Session;
- CI #522: `Battle and profile database access boundaries = SUCCESS`.

Wichtige technische Altlast für spätere BATTLE-Arbeit:
`battle.js` enthält weiterhin die historische Production-Supabase-Konstante. In Preview wird diese durch den parser-blockierenden Runtime-Guard in `site-nav.js` abgefangen und auf Staging geroutet. Dieser Guard ist sicherheitskritisch und darf bei einer BATTLE-Refaktorierung nicht unbeabsichtigt umgangen werden.

**Nächster Chat darf BATTLE gezielt weiterentwickeln. Die geschlossene Kernabnahme nicht ohne neuen reproduzierbaren Befund wiederholen.**
TRADE bleibt dabei eingefroren, außer bei einem echten neuen Defekt.

---

## 16. Kategorie A/B/C/D

Aktuelle Statusmatrix:

- **Kategorie A: geschlossen**
- **Kategorie B: geschlossen**
- **Kategorie C: extern offen**
- **Kategorie D: geschlossen**

Kategorie C blockiert den kommerziellen TRADE-Produktivstart, aber nicht interne Staging-/Beta-Entwicklung von COLLECT oder BATTLE.

---

## 17. Rechtstexte – verbindliche Strategie

Standard-Rechtstexte für DUELVANTA werden über das Schutzpaket der **IT-Recht Kanzlei** erzeugt.

Zielbereiche:
- Plattform-/Nutzungsbedingungen;
- Registrierung / Nutzungsberechtigung;
- Rollen der Plattform;
- Ranking;
- Moderation / Beschränkung / Sanktionen;
- Beschwerdeverfahren soweit einschlägig;
- Bewertungen;
- Haftung;
- Laufzeit/Kündigung;
- Änderungen der Bedingungen;
- anwendbares Recht;
- weitere Marketplace-/Verbrauchertexte nach dem tatsächlichen Kanzlei-Paket.

Verbindlicher Freeze:
**TRADE wird jetzt technisch nicht weiter in Richtung kommerzieller Freigabe umgebaut, bis die finalen Kanzlei-Texte vorliegen.**

Wenn die Texte vorliegen:
1. gemeinsam mit ChatGPT gegen den tatsächlichen DUELVANTA-Flow prüfen;
2. Abweichungen zwischen Text und Produkt markieren;
3. keine freie Neuformulierung freigegebener Rechtstexte;
4. technische Einbindung / Versionierung / Verlinkung / Zustimmung / Checkout-Platzierung exakt umsetzen;
5. Sonderfälle separat identifizieren;
6. danach Codex Pre-Merge Audit.

Die Kanzlei-Freigabe wird nicht durch ChatGPT oder Codex ersetzt.

---

## 18. Steuer / PStTG / DAC7 – verbindliche Strategie

Weiterhin vorgesehen:
- Stripe Connect als spätere Payment-/Connected-Account-Infrastruktur;
- Stripe Tax dort, wo fachlich passend;
- Stripe Platform Tax Reporting prüfen, soweit für den deutschen Prozess geeignet;
- DUELVANTA-eigenes PStTG/DAC7-Ledger als Kontroll-/Exportebene beibehalten;
- Jahres-/Quartalsexporte;
- kostengünstiger XML-/Reporting-Weg für den BZSt-Meldeprozess;
- externe Steuerberatung nur für konkrete verbleibende Sonderfragen oder einmalige Bestätigung, sofern nötig.

Vor echtem kommerziellem TRADE-Start:
- endgültige PStTG/DAC7-Einordnung bestätigen;
- echten Meldeprozess festlegen;
- Stripe-Live-Freigabe;
- Gebühren-/Steuerbehandlung final klären;
- keine echte Meldung oder Zahlung ohne ausdrückliche Freigabe.

Tax/Reporting wird vor Merge technisch durch Codex gegen die festgelegte Architektur geprüft; Codex ersetzt keine notwendige fachliche Steuerfreigabe.

---

## 19. Geplanter Codex Pre-Merge Release Audit

Vor dem ersten großen Beta-Merge auf `main` wird **ein vollständiger, findings-orientierter Codex-Audit** durchgeführt.

Codex darf dabei nicht pauschal hunderte Dateien „schöner“ refaktorieren.

Auditbereiche:

### Security
- Auth / Session / AAL2;
- RLS / Grants / RPC-Berechtigungen;
- IDOR / Broken Object Level Authorization;
- XSS / HTML-Escaping;
- CSRF-relevante Aktionen;
- offene Direktwrites;
- Datenlecks / PII;
- Uploads / Storage-Buckets / Signed URLs;
- Secrets / Keys / Client-Leaks;
- API-Umgebungsgrenzen Preview/Production;
- Rate Limits / Abuse;
- Webhooks / Stripe-Signaturen / Idempotenz;
- Race Conditions / Double Submit;
- Datenintegrität / Reservierungen / Bestandslogik.

### Architektur / Codequalität
- echte Spaghetti-Bereiche;
- zyklische oder unnötige Kopplung;
- Doppelcode;
- veraltete Kompatibilitätspfade;
- große fragile Module;
- MutationObserver-/Timer-Kaskaden;
- dead/unreachable Runtime-Code;
- Preview-/Production-Routing;
- Fehlertoleranz / Recovery.

### Performance
- N+1-Abfragen;
- unnötige Supabase-Requests;
- große Payloads;
- unnötige Polling-Schleifen;
- Startzeit;
- Mobile Safari;
- Scanner/Binder Performance;
- TRADE Runtime;
- BATTLE Polling/WebRTC-Lifecycle;
- mögliche Memory-/Stream-Leaks.

### Compliance-Technik
- Kanzlei-Texte technisch korrekt eingebunden;
- Consent/Versionen beweisbar;
- Checkout-/Seller-Onboarding-Verweise;
- Vertrags-/Bestellsnapshots;
- PStTG/DAC7-Ledger/Exports;
- Stripe-/Payment-Gates;
- Datenrechte;
- Notice & Action;
- Moderations-/Auditpfade.

Ergebnisformat:
- Release Blocker;
- High;
- Medium;
- Low;
- Evidenz / konkrete Datei/Funktion;
- reproduzierbar oder theoretisch;
- minimaler Fix.

Nur reale, reproduzierbare oder klar belegte Findings werden behoben. Keine großflächige Refaktorierung unmittelbar vor Merge ohne zwingenden Grund.

---

## 20. Verbindliche Pre-Merge-Reihenfolge

Vor einem echten Merge von PR #5 auf `main`:

1. IT-Recht-Kanzlei-Texte erhalten.
2. Texte gemeinsam gegen tatsächliche DUELVANTA-Flows prüfen.
3. Texte technisch korrekt einbinden und versionieren.
4. Steuer-/PStTG-/DAC7-Zielprozess fachlich festziehen.
5. Alte bestätigte Production-Marketplace-Testdaten gezielt vollständig bereinigen.
6. Production-TRADE-Hard-Lock für den geplanten Release migrationsseitig final gegen den dann aktuellen Production-Schema-Stand prüfen.
7. Codex Security-/Architecture-/Performance-/Compliance-Audit.
8. Release-Blocker/High-Findings gezielt schließen.
9. Vollständige CI.
10. erneute Merge-Simulation gegen dann aktuellen `main`.
11. letzte iPhone-/Browser-Smoke-Abnahme von COLLECT, BATTLE und Production-TRADE-Lock.
12. PR #5 erst danach aus Draft nehmen.
13. Merge nur nach ausdrücklicher Owner-Freigabe.
14. Production-Migrationen separat und kontrolliert.
15. Kein Stripe Live ohne eigene ausdrückliche Freigabe.

---

## 21. Was jetzt ausdrücklich eingefroren ist

Bis Rechtstexte vorliegen:
- TRADE-Fachlogik nicht weiter ausbauen;
- Tausch nicht wieder öffnen;
- bereits geschlossene Order-/Pickup-/Shipping-Flows nicht erneut aufrollen;
- TRADE Lade-UX nicht weiter umbauen;
- Production-Hard-Lock nicht auf Production anwenden;
- Production-Testdaten noch nicht löschen, solange nicht das kontrollierte Pre-Merge-Cleanup gestartet wird;
- PR #5 nicht mergen;
- `main` nicht verändern;
- Stripe Live nicht aktivieren;
- keine echten Payments/Refunds/Payouts;
- keine produktive PStTG-/DAC7-Meldung.

Erlaubt:
- BATTLE im nächsten Chat gezielt weiterentwickeln;
- COLLECT bei klar definierten separaten Aufgaben weiterentwickeln;
- Dokumentation;
- read-only Checks;
- reproduzierbare neue Defekte beheben.

---

## 22. Aktueller Arbeitsmodus für den nächsten Chat

Der nächste Chat soll zuerst vollständig lesen:

`DUELVANTA_MASTERHANDOUT_V26_2026-09-18.md`

Danach:
- Repository/Branch-Head read-only gegenprüfen;
- ausschließlich auf `marketplace-ux-v1` arbeiten;
- TRADE als eingefrorenen Stand behandeln;
- keine Production-/main-/Stripe-Live-Änderung;
- wenn der Nutzer BATTLE ausbauen möchte, direkt mit dem tatsächlichen BATTLE-Repository-Stand beginnen;
- vor BATTLE-Codeänderungen bestehende `battle.html`, `battle.js`, `battle-webrtc.js`, `battle-safety.js`, `battle-moderation.js`, BATTLE-Migrationen und relevante Tests lesen;
- den Preview/Production-Runtime-Guard unbedingt erhalten.

---

## 23. Kurzstatus

**COLLECT:** stabil / OpenAI Scanner + Binder grün / weiterentwickelbar.  
**TRADE:** Kauf + Verkauf funktional weitgehend abgenommen / Tausch entfernt / jetzt Freeze bis Recht+Tax+Codex Pre-Merge Audit.  
**BATTLE:** Beta live / Kernpfad Zwei-Geräte-Abnahme PASS / WebRTC-Neustarts, Audio, Ready, Abschluss und Dispute bestätigt / zwei reale Post-V26-Befunde geschlossen.  
**Main:** unverändert.  
**PR #5:** Draft / nicht gemergt.  
**Production:** keine Änderung aus diesem Abschlussblock.  
**CI:** #522 vollständig grün.  
**Merge-Simulation:** PASS.  
**Production-TRADE-Hard-Lock:** vorbereitet + CI-grün, nicht ausgerollt.  
**Production-Testdaten:** vom Owner als alte Testdaten bestätigt; vollständige gezielte Bereinigung vor Merge beschlossen, noch nicht ausgeführt.  
**Kategorie C:** extern offen.  
**Nächster großer TRADE-Schritt:** erst nach Vorliegen der IT-Recht-Kanzlei-Texte.

---

## 24. Referenzdokumente

- `DUELVANTA_MASTERHANDOUT_V26_2026-09-18.md`
- `DUELVANTA_BATTLE_CAMERA_RESTART_2026-09-18.md`
- `DUELVANTA_MASTERHANDOUT_V25_2026-09-18.md`
- `DUELVANTA_BETA_MERGE_PREFLIGHT_2026-09-18.md`
- `DUELVANTA_MASTERHANDOUT_V21_2026-09-17.md`
- `DUELVANTA_B07_LEGAL_FINAL_REVIEW_2026-09-15.md`
- `DUELVANTA_B07_RE_REVIEW_2026-09-16.md`
- `DUELVANTA_B07_IMPLEMENTATION_STATUS_2026-09-16.md`
- `SCANNER-V16-RELEASE-CHECKPOINT.md`
- `database/market-production-trade-lock-v1.sql`

Keine Passwörter, privaten Zugangsdaten, API-Keys oder Übergabecodes gehören in Masterhandouts.
