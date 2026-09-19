# DUELVANTA – Masterhandout V17

Stand: 16.09.2026, 20:51 Uhr MESZ  
Status: **verbindlicher aktueller Übergabestand für die Weiterarbeit an B07**

V17 ersetzt widersprechende Statusangaben aus V16 und allen älteren Masterhandouts. Maßgeblich sind zusätzlich der tatsächliche Repository-Code, der bestätigte Supabase-Staging-Stand und die unten genannten CI-/Preview-Fakten.

Dieses Dokument ist **keine Rechts-, Steuer-, Payment- oder Produktionsfreigabe**.

---

## 1. Unveränderliche Projektgrenzen

Repository: `Bennyescaped/duelvanta`

Entwicklungsbranch: `marketplace-ux-v1`

Produktions-`main`:

`50f88213571be13255bb52eb489cc28cca660001`

PR #5:
- offen;
- Draft;
- nicht gemergt;
- Base `main`;
- Head `marketplace-ux-v1`.

Verbindlich:
- `main` nicht verändern;
- Produktion nicht verändern;
- PR #5 nicht mergen;
- Stripe Live nicht aktivieren oder verändern;
- keine echten Zahlungen;
- keine echten Refunds;
- keine echten Payouts;
- keine produktive PStTG-/DAC7-/Sanktions-/AGB-Aktivierung;
- keine echten Kundendaten für B07-Abnahmen verwenden.

Slogan bleibt unverändert:

`COLLECT. TRADE. BATTLE.`

---

## 2. Aktueller technischer Code-Checkpoint

Letzter vollständig technisch geprüfter App-/DB-/UI-Checkpoint:

`678c4a644c5da43b39e710103090b2b5479d7487`

Dieser Checkpoint enthält:
- den persistenten C2C-Stack;
- die realen Staging-Kompatibilitätsfixes;
- die native C2C-Marketplace-Integration;
- den resilienten mobilen C2C-Initializer;
- den Startreihenfolge-Fix für den TAUSCH-Tab;
- den mobilen Dialog-Layoutfix;
- die vollständige Zwei-Rollen-Pickup-Abnahmebasis;
- den neuen privaten Pickup-Nachrichtenkern für Tausch und Kauf;
- den gemeinsamen TRADE-Bereich `ABHOLUNG CHAT`;
- PostgreSQL- und Contract-Regressionen für die Nachrichtenfunktion.

`DUELVANTA_MASTERHANDOUT_V17_2026-09-16.md` wird als reiner Dokumentationscommit **nach** diesem technischen Checkpoint angelegt. Der technische Checkpoint bleibt deshalb `678c4a64…`.

---

## 3. Letzter vollständig grüner CI-Stand

Workflow: `Scanner V16 Check`

Run #450 / Run-ID `35133080448` auf technischem Checkpoint `678c4a644c5da43b39e710103090b2b5479d7487`:

- Gesamt: **SUCCESS**
- `validate`: **SUCCESS**
- `Trade contracts and mobile order flow`: **SUCCESS**
- `quota_database`: **SUCCESS**
- PostgreSQL 17 C2C-Regressionskette: **SUCCESS**
- Pickup-Message-Regression Tausch + Order: **SUCCESS**
- Browser-/DOM-Bestandstests: **SUCCESS**

Der neue Nachrichtenkern wurde bewusst zuerst gegen PostgreSQL 17 geprüft. Zwischenfehler betrafen ausschließlich Test-Fixtures/Test-Bootstrap und wurden vor der finalen grünen Abnahme korrigiert. Produktiv- oder Stagingdaten wurden dadurch nicht beschädigt.

---

## 4. Supabase-Staging – verbindlicher Stand

Projekt:

`xhmjxrcskfhbovhitdej` / `DUELVANTA-STAGING`

Produktion wurde nicht verändert.

### 4.1 C2C-Stack

Persistent aktiv sind weiterhin die in V16 dokumentierten C2C-Bausteine für:
- Eligibility-Abhängigkeit;
- Schema;
- Revision/Binding;
- Versand;
- Empfang;
- Problems;
- Pickup;
- Pickup-Code;
- Abschluss-Kompatibilität zum realen Staging-Schema.

Relevante jüngste Migrationen auf Staging:
- `b07_l07_01_c2c_swap_v1_fulfillment_shipping`
- `b07_l07_01_c2c_swap_v1_fulfillment_receive`
- `b07_l07_01_c2c_swap_v1_problems`
- `b07_l07_01_c2c_swap_v1_pickup_schema`
- `b07_l07_01_c2c_swap_v1_pickup_revision`
- `b07_l07_01_c2c_swap_v1_pickup_proposals`
- `b07_l07_01_c2c_swap_v1_pickup_binding`
- `b07_l07_01_c2c_swap_v1_pickup_code`
- `b07_l07_01_c2c_swap_v1_completion_compat`
- `b07_l07_01_c2c_swap_v1_pickup_completion_compat`

### 4.2 Neuer Pickup-Nachrichtenkern

Zusätzlich aktiv:
- `b07_l07_01_pickup_messages_v1`
- `b07_l07_01_pickup_messages_v1_list`

Neue private Tabelle:

`dv_market_private.market_pickup_messages`

Sicherheitsstand bestätigt:
- RLS aktiv;
- Tabellen-ACL nur `postgres`;
- `anon`: kein SELECT/INSERT;
- `authenticated`: kein direkter SELECT/INSERT;
- Browserzugriff ausschließlich über participant-geprüfte RPCs;
- `anon`: kein RPC-Zugriff;
- `authenticated`: nur explizit freigegebene RPCs.

Freigegebene Browser-RPCs:
- `list_my_market_pickup_conversations_v1()`
- `get_market_pickup_conversation_v1(text, uuid)`
- `send_market_pickup_message_v1(text, uuid, text)`

Regeln:
- Kontext nur `swap` oder `order`;
- ausschließlich persönliche Abholung;
- nur die beiden tatsächlich beteiligten Nutzer;
- Nachricht 1–1000 Zeichen;
- Rate-Limit 20 Nachrichten / 10 Minuten / Absender / Kontext;
- abgeschlossene Kontexte bleiben lesbar, sind aber nicht mehr beschreibbar;
- kein externer Nachrichtenversand, keine E-Mail-/WhatsApp-Kopplung, keine Paymentkopplung.

Aktueller Datenbestand:
- `market_pickup_messages`: **0 Nachrichten**.

---

## 5. Reguläre Staging-Testnutzer – jetzt zwei Rollen vorhanden

### Käufer-Testaccount

E-Mail: `test-kaeufer@duelvanta.de`

User-ID:

`e81841df-2b08-45c1-a2d7-2671f8c58f7d`

Aktueller Stand:
- `seller_type = private`
- `onboarding_status = active`
- `country_code = DE`
- `verified_at` vorhanden
- Geburtsdatum im Testprofil: `1990-01-01`
- Wohnsitzland: `DE`
- `private_buyer_confirmed = true`
- TRADE-Eligibility regulär über die Browser-UI bestätigt.

### Verkäufer-Testaccount

E-Mail: `test-verkaeufer@duelvanta.de`

User-ID:

`2fe2dfab-2802-46ac-8c7b-2804eae2be8e`

Aktueller Stand:
- `seller_type = private`
- `onboarding_status = active`
- `country_code = DE`
- `verified_at` vorhanden
- Geburtsdatum im Testprofil: `1990-01-01`
- Wohnsitzland: `DE`
- regulärer privater Staging-Verkäufer.

Keine Passwörter im Repository oder im Handout dokumentieren. Keine Auth-Tabellenmanipulation für Tests.

---

## 6. Post-V16 Browser-Härtung – geschlossen

Nach V16 wurden in der manuellen iPhone/Safari-Abnahme reale UI-Befunde gefunden und gezielt geschlossen.

### 6.1 Native Tauschaktion

Trade-only-Listings rendern jetzt nativ:

`TAUSCH VORSCHLAGEN`

`trade-b07-c2c-ux-bridge.js` ist entfernt und wird nicht mehr geladen.

Kein neuer Bridge-Layer darf wieder eingeführt werden.

### 6.2 Langsamer Mobile-Start

Der alte C2C-Initializer konnte nach einem festen ~12-Sekunden-Fenster dauerhaft aufgeben oder bei einem temporären RPC-/Schema-Cache-Problem fälschlich als installiert gelten.

Korrigiert:
- kein `tries > 150`-Latch mehr;
- temporäre `loadSwaps()`-Fehler bleiben retrybar;
- bounded backoff bis max. 2 Sekunden;
- Retry bei `pageshow` und erneutem Sichtbarwerden.

### 6.3 Mobiles Dialoglayout

Die Kandidatenzeile im Tauschdialog lief auf Mobile rechts aus dem Dialog.

Korrigiert über gezielte CSS-Regel:
- Checkbox + flexibel umbrechender Text;
- keine C2C-Logikänderung.

### 6.4 TAUSCH-Tab Startreihenfolge

Realer Verkäufer-Befund:
- Backend/RPC sah den Thread korrekt;
- TAUSCH-Tab fehlte trotzdem.

Ursache:
- Marketplace-UX konnte `+ VERKAUFEN` vor C2C-Initialisierung bereits in `.dvTradePrimary` verschieben;
- C2C versuchte anschließend `tabs.insertBefore(button, sell)` obwohl `sell` kein direktes Kind von `.tabs` mehr war.

Fix:
- existiert `.dvTradeSecondary`, wird TAUSCH dort eingehängt;
- sonst bleibt der frühe Initialisierungspfad vor Marketplace-Rebuild erhalten.

Regression für beide Startreihenfolgen vorhanden und grün.

---

## 7. Browser-Zwei-Rollen-Abnahme – aktueller tatsächlicher Stand

Die in V16 noch fehlende zweite regulär onboardete Rolle ist inzwischen vorhanden und wurde browserseitig verwendet.

### 7.1 Proposal – PASS

Käufer erstellte im aktuellen Preview einen echten C2C-Vorschlag.

Thread:

`56032438-18ae-4f25-87a6-ed9edc3ad5a6`

Revision 1:

`bb1a487b-1c9d-4dda-bd6a-d2e78ffd43ad`

Stand:
- `fulfillment_mode = shipping`
- beide Testkarten korrekt als Revision-Items;
- Thread `negotiating`;
- Reservierungen zu diesem Zeitpunkt bewusst noch nicht vorhanden.

### 7.2 Revision-Invalidierung – PASS

Käufer bestätigte Revision 1 einmal.

Danach erzeugte Verkäufer browserseitig Revision 2 durch Änderung auf Pickup:

`526a3f84-f4cf-431a-81b8-2a12f3bdcb4e`

Bestätigt:
- Revision 1 behielt ihre alte Bestätigung;
- Revision 2 startete mit **0** Bestätigungen;
- alte Bestätigung wurde nicht auf Revision 2 übertragen.

### 7.3 Bilaterale Bestätigung – PASS

Revision 2 wurde zuerst vom Verkäufer und danach vom Käufer bestätigt.

Ergebnis:
- Thread `bound`;
- `bound_revision_id = 526a3f84-f4cf-431a-81b8-2a12f3bdcb4e`;
- beide Listings reserviert;
- Pickup erzeugte keine Shipping-Fulfillments;
- keine Versandadresse;
- keine Versandfrist.

### 7.4 Pickup-Codeflow – PASS

Browserseitig vollständig geprüft:
- Käufer erzeugte den 2h-Übergabecode;
- Verkäufer sah das Code-Eingabefeld;
- Verkäufer bestätigte den fremden Code;
- Code wurde verbraucht;
- `confirmed_by` ist der Verkäufer;
- Thread wurde `completed`;
- keine offenen Fälle.

Abschlusszeit Staging:

`2026-09-16T18:00:57.337618+00:00`

### 7.5 Testlistings nach Abschluss

Käufer-Karte:
- ID `0f64b17c-1933-446d-aa47-9c07cda019e4`
- `B07 Browser Testkarte Käufer`
- Status `sold`
- `quantity_available = 0`

Verkäufer-Karte:
- ID `749c6cd4-a83d-44db-96bb-1d79ab1f302c`
- `B07 Browser Testkarte Verkäufer`
- Status `sold`
- `quantity_available = 0`

Die Daten sind klar als B07-Staging-Testdaten markiert und aktuell **noch nicht gelöscht**. Vor finaler Abnahme/Testdatenbereinigung gezielt entfernen; keine fremden Staging-Daten anfassen.

---

## 8. Was aus Kategorie D jetzt wirklich geschlossen ist

Browserseitig mit zwei regulären Staging-Accounts nachgewiesen:
- C2C Proposal;
- Revision;
- Bestätigung Revision 1 nur durch eine Partei;
- neue Revision macht alte Bestätigung für den neuen Stand unwirksam;
- bilaterale Bestätigung Revision 2;
- Binding;
- Pickup ohne Versandartefakte;
- Pickup-Codeerzeugung;
- Fremdpartei-Bestätigung;
- Abschluss;
- finale Listing-Finalisierung.

Damit ist der **browserseitige C2C-Pickup-E2E geschlossen**.

---

## 9. Kategorie D – weiterhin offene Browser-Evidenz

Noch nicht browserseitig mit zwei Rollen vollständig abgeschlossen:

### C2C Versand
- Proposal/Revision/Binding ist grundsätzlich browserseitig bewiesen;
- Versandpfad als eigener gebundener Shipping-Thread noch browserseitig prüfen;
- Versandmarkierung;
- Empfang beider Seiten;
- technischer Abschluss.

### C2C Problemfall
Browserseitig noch prüfen:
- ungetracktes `not_received` vor 14 Tagen blockiert;
- nach Test-Zeitverschiebung/geeignetem Staging-Szenario erlaubt;
- Antwort-/Nachweisstatus;
- Rücknahme bzw. vorgesehener Abschluss.

DB-/RPC-seitig sind Versand und Problemfall bereits in PostgreSQL und realem Staging nachgewiesen. Offen ist hier nur die Browser-Evidenz.

### Pickup-Nachrichten UI
Noch offen:
- aktueller UI-Head muss zuerst exakt als READY-Preview ausgeliefert werden;
- abgeschlossenen Pickup-Tausch im `ABHOLUNG CHAT` als read-only anzeigen;
- aktiven Pickup-Kontext browserseitig öffnen;
- Nachricht Partei A -> Partei B;
- Nachricht Partei B -> Partei A;
- sicherstellen, dass Shipping-Kontexte nicht erscheinen;
- abgeschlossenen Kontext nicht mehr beschreibbar.

Für den Kauf-Abholungsfall ist zusätzlich ein echter Browsertest mit einer Pickup-Order erforderlich.

---

## 10. Neuer gemeinsamer Bereich `ABHOLUNG CHAT`

Technischer Checkpoint `678c4a64…` enthält:

`trade-pickup-messages.js`

Einbindung in:

`trade.html`

Konzept:
- ein gemeinsamer Bereich für **Abholung bei Tausch und Kauf**;
- keine getrennten Chat-Implementierungen;
- keine MutationObserver-Bridge;
- keine Änderung an `trade-c2c-swap.js` oder `trade-orders.js` für den Chat notwendig;
- Listendarstellung über `list_my_market_pickup_conversations_v1()`;
- Detaildialog über `get_market_pickup_conversation_v1(...)`;
- Senden über `send_market_pickup_message_v1(...)`.

Der Bereich zeigt aktive und abgeschlossene Pickup-Kontexte. Terminale Kontexte sind read-only.

---

## 11. Vercel / Preview – aktueller Blocker

Aktueller technischer Repository-Head:

`678c4a644c5da43b39e710103090b2b5479d7487`

Dieser Head ist **noch nicht als Vercel-Preview ausgeliefert**.

Der Branch-Alias

`duelvantav5vision-git-marketplace-ux-v1-bennyescaped-3783.vercel.app`

zeigt weiterhin auf:
- Deployment `dpl_H3h9EySjdB5C6PJK1i3mNa1z7wZV`
- READY
- Commit `d30da4aa1e9c77f982bd5494a545a3e8c7379d46`

Damit fehlen im aktuell auslieferbaren Preview die späteren Listen-/UI-Commits für `ABHOLUNG CHAT`.

Verbindliche Regel:
- keinen manuellen Deploy auslösen, solange nicht zweifelsfrei sichergestellt ist, dass ausschließlich ein Preview-Deployment entsteht;
- Produktion nicht berühren;
- bei neuem automatischem READY-Preview zuerst Commit-SHA gegen den technischen Checkpoint prüfen.

---

## 12. Work-/Browser-Automation-Hinweis

Mehrere Work-Chats scheiterten zuvor an Browserinfrastruktur (`CDP operation refresh tabs timed out`). Das war kein DUELVANTA-Appnachweis.

Die erfolgreiche Zwei-Rollen-Abnahme wurde deshalb manuell in Safari mit direkter Staging-/DB-Gegenprüfung durchgeführt.

Regel für weitere Abnahmen:
- Browserinfrastrukturfehler nicht als Appfehler bewerten;
- bei manueller Browseraktion direkt danach Staging lesen und Zustand verifizieren;
- keine spekulativen Schnellfixes;
- vor jedem Codefix Ursache isolieren.

---

## 13. Pickup-Nachrichten – Datenschutz-/Retention-Grenze

Die Nachrichtenfunktion kann Treffpunkt, Uhrzeit und andere personenbezogene Angaben enthalten.

Technisch bereits umgesetzt:
- private Speicherung;
- participant-only RPC-Zugriff;
- kein anonymer Zugriff;
- kein direkter Browser-Tabellenzugriff;
- neue Retention-Kategorie `pickup_messages` wird angelegt, falls `data_retention_rules` vorhanden ist;
- `automatic_until_supported = false`;
- keine automatische Löschung auf Basis einer geratenen Frist.

Bewusst **noch offen**:
- Aufnahme der Pickup-Nachrichten in `export_my_duelvanta_data()`;
- technische Integration in Account-Erasure/Retention-Holds;
- endgültige Aufbewahrungsdauer;
- endgültige Rechtsgrundlage für die Aufbewahrung nach Abschluss.

Die letzten beiden Punkte sind Kategorie C / externe Rechtsprüfung. Datenexport und technische Erasure-/Hold-Integration sind dagegen noch ein konkreter interner Hardening-Punkt vor Release.

---

## 14. Aktualisierte A/B/C/D-Einordnung

V16s Aussage `A geschlossen / B geschlossen / C extern offen / D Browser-Evidenz offen` wird durch die Post-V16-Arbeiten präzisiert.

### Kategorie A

**geschlossen / weiterverwendbar**

Kein neuer Architekturgrundfehler festgestellt.

### Kategorie B

Der neue Pickup-Nachrichtenkern selbst ist technisch implementiert, PostgreSQL-getestet und auf Staging sicher aktiviert.

Neu offen durch dieses Feature:
- `pickup_messages` in persönlichen Datenexport aufnehmen;
- technische Account-Erasure-/Retention-Hold-Behandlung ergänzen;
- danach Regressionen ergänzen.

Bewertung:

**B: ein neuer klar abgegrenzter technischer Hardening-Punkt offen.**

### Kategorie C

Weiter extern offen:
- finale Rechts-/Steuer-/Paymentfreigaben aus V16;
- zusätzlich finale Rechtsgrundlage und Aufbewahrungsfrist für Pickup-Nachrichten.

Bewertung:

**C offen; kommerzieller Produktivstart weiterhin blockiert.**

### Kategorie D

Geschlossen:
- browserseitiger Zwei-Rollen-C2C-Pickup-E2E.

Offen:
- browserseitiger C2C-Versand/Empfang;
- browserseitiger C2C-Problemfall;
- browserseitige Pickup-Chat-Abnahme für Tausch und Kauf;
- aktuell zusätzlich durch fehlenden exakten READY-Preview des Heads `678c4a64…` blockiert.

Verbindliche Kurzform:

**A geschlossen / B 1 technischer Hardening-Punkt offen / C extern offen / D teilweise geschlossen, Rest-Browser-Evidenz offen.**

---

## 15. Kategorie C – weiterhin strikt deaktiviert

Nicht produktiv aktivieren:
- Stripe Live;
- echte Zahlungen;
- echte Refunds / Chargebacks;
- reale Payouts / Holds;
- wirtschaftliche 4-%-Stornogebühr;
- automatische Sanktionsleiter;
- finale AGB-/TRADE-Neuakzeptanz;
- finale C2C-PStTG-/DAC7-Einordnung;
- produktive BZSt-Meldung;
- produktive Identitäts-/Altersprüfung;
- finale B2C-Verbraucherrechtsdarstellung;
- finale Bewertungsmoderation;
- finale Versandprodukte, Haftungs-/Versicherungsgrenzen und Risikokriterien;
- automatische Pickup-Message-Löschfristen ohne externe Freigabe.

Anwalt/Steuerberater sind weiterhin kein technischer Blocker für interne Staging-Entwicklung, aber Gate vor kommerziellem Produktivstart.

---

## 16. Bereits geschlossene Bereiche – nicht ohne neuen Befund wiederholen

Nicht erneut bearbeiten:
- B01–B04;
- GitHub-Main-Ruleset;
- Release-1 Eligibility-Grundmodell;
- Anti-Circumvention-Grundguard;
- Preisangebot -> Reservierung;
- Shipping-/Delivery-Grundentscheidung;
- Tracking >25 EUR / optional <=25 EUR;
- Owner-Zustellprüfung;
- 72h-Lifecycle;
- ungetrackter Order-Abschluss nach 40 Tagen;
- Versandfrist-Hardening;
- Order-Pickup-Grundmodell;
- C2C Revision/Binding;
- C2C Versand-DB/RPC;
- C2C Problems-DB/RPC;
- C2C Pickup-DB/RPC;
- C2C PostgreSQL-Regression;
- Staging-C2C-Stack;
- `reservation_expires_at`-Kompatibilitätsfix;
- C2C native Marketplace-Aktion;
- resilienter Mobile-Initializer;
- mobiler Tauschdialog-Layoutfix;
- TAUSCH-Tab Startreihenfolge;
- browserseitiges Proposal/Revision/Bestätigung/Binding/Pickup;
- browserseitiger Pickup-Codeflow;
- Pickup-Nachrichtenkern DB/RPC;
- Pickup-Nachrichten-RLS/ACL/RPC-Grenzen;
- Pickup-Nachrichten PostgreSQL-Regressionskern.

---

## 17. Git-/Release-Hygiene

PR #5 enthält aufgrund der umfangreichen B07-Entwicklung und der Post-V16-Debugginghistorie viele Commits.

Verbindlich:
- jetzt **keine** riskante History-Rewrite-Aktion;
- keine Zwischenstände nach `main` übertragen;
- erst vor finaler Releasefreigabe den effektiven Tree auditieren;
- obsolete Bridge-Dateien/Altpfade weiterhin entfernt halten;
- finalen PR-Transfer später konsolidiert/squashed durchführen, sofern der Releaseprozess dies erlaubt;
- PR #5 bleibt bis dahin Draft.

Entscheidend ist der geprüfte aktuelle Tree, nicht die Anzahl historischer Zwischencommits.

---

## 18. Exakter Arbeitsauftrag für den nächsten Chat

Arbeite ausschließlich auf `marketplace-ux-v1` und nur im B07-/TRADE-Staging-Kontext.

### Schritt 1 – Repository-/CI-/Preview-Checkpoint verifizieren

1. `DUELVANTA_MASTERHANDOUT_V17_2026-09-16.md` öffnen.
2. technischen Code-Checkpoint `678c4a644c5da43b39e710103090b2b5479d7487` gegen Repository prüfen;
3. `main` muss `50f88213571be13255bb52eb489cc28cca660001` bleiben;
4. PR #5 muss offen + Draft + ungemergt bleiben;
5. Run #450 als letzten vollständig grünen technischen Lauf anerkennen;
6. Vercel prüfen: erst weiter mit Chat-Browserabnahme, wenn ein READY-Preview den exakten App-Codecheckpoint oder einen nachfolgenden reinen Doku-Commit mit identischem App-Tree enthält.

Kein manueller Deploy, wenn Preview-only nicht sicher garantiert werden kann.

### Schritt 2 – Pickup-Chat Browserabnahme

Sobald aktueller Preview READY:

1. als einer der beiden Testnutzer anmelden;
2. `ABHOLUNG CHAT` öffnen;
3. bestehenden abgeschlossenen Thread `56032438-18ae-4f25-87a6-ed9edc3ad5a6` prüfen:
   - sichtbar;
   - `completed`;
   - read-only;
   - keine Sendemöglichkeit;
4. danach einen neuen klar markierten **aktiven Pickup-Testkontext** über regulären Browserflow erzeugen;
5. Nachricht Partei A -> B senden;
6. Gegenrolle anmelden;
7. Nachricht muss sichtbar sein;
8. Antwort B -> A senden;
9. Gegenprüfung über Staging-RPC/Tabelle;
10. nach Abschluss read-only prüfen.

Mindestens ein echter Pickup-Kauf/Order-Chat muss zusätzlich browserseitig geprüft werden, weil die DB-Regression zwar Order + Swap abdeckt, die UI-Evidenz für Kauf aber noch fehlt.

### Schritt 3 – Kategorie-B-Hardening Pickup-Nachrichten

Gezielt ergänzen:
- Pickup-Nachrichten in `export_my_duelvanta_data()`;
- Account-Erasure/Retention-Holds für diese Datenart technisch berücksichtigen;
- keine automatische Löschfrist erfinden;
- Tests für Export + Erasure-/Hold-Grenze ergänzen;
- erst danach Kategorie B wieder schließen.

### Schritt 4 – verbleibende Kategorie-D-C2C-Evidenz

Mit zwei regulären Testrollen:
- separaten Shipping-C2C-Thread erstellen;
- Versandmarkierung beider Seiten;
- Empfang beider Seiten;
- Abschluss prüfen;
- separaten Problemfall browserseitig prüfen;
- 14-Tage-Grenze und 7-Tage-Antwort-/Nachweisstatus sichtbar verifizieren.

Zeitverschiebung nur auf klar markierten Staging-Testdaten. Keine Produktion.

### Schritt 5 – Testdatenbereinigung

Nach Abschluss der Browserabnahmen:
- ausschließlich klar markierte B07-Testlistings/-threads/-messages/-orders/-cases bereinigen;
- bestehende fremde Staging-Daten nicht anfassen;
- vor Löschung IDs und Counts dokumentieren;
- nach Löschung Counts erneut prüfen.

### Schritt 6 – B07-Re-Review / Dokumentation

Erst nach den obigen Punkten:
- `DUELVANTA_B07_IMPLEMENTATION_STATUS_2026-09-16.md` nachziehen;
- `DUELVANTA_B07_L07-01_REVIEW_CATALOG_2026-09-15.md` nachziehen;
- neues A/B/C/D-Re-Review erstellen;
- Kategorie C ausdrücklich offen lassen;
- erst dann ein neues Masterhandout V18 erzeugen.

---

## 19. Stop-Kriterien

Sofort stoppen und nicht weiterbauen bei:
- `main` weicht von `50f88213571be13255bb52eb489cc28cca660001` ab;
- PR #5 ist nicht mehr Draft oder wurde gemergt;
- Preview zeigt auf Produktion statt Staging;
- Supabase-Projekt ist nicht `xhmjxrcskfhbovhitdej`;
- Stripe Live ist aktiv;
- echter Zahlungs-/Refund-/Payout-Pfad würde ausgelöst;
- Browser-/Work-Infrastrukturfehler wird fälschlich als Appfehler interpretiert;
- eine geplante Änderung benötigt spekulative Bridge-/Overlay-Schichten statt isolierter Ursache;
- Testdaten lassen sich nicht eindeutig von vorhandenen Staging-Daten unterscheiden.

---

## 20. Verbindliche Schlussaussage V17

Der aktuelle B07-Stand ist technisch deutlich weiter als V16:

- zwei reguläre private Staging-Rollen vorhanden;
- echter browserseitiger Zwei-Rollen-C2C-Pickup-E2E vollständig bestanden;
- Revision-Invalidierung und bilaterale Bindung browserseitig nachgewiesen;
- Pickup-Codeflow browserseitig vollständig bestanden;
- privater gemeinsamer Pickup-Nachrichtenkern für Tausch + Kauf implementiert;
- RLS/ACL/RPC-Grenzen auf Staging bestätigt;
- PostgreSQL-17-Regressionskette und gesamter CI Run #450 grün;
- `main`, Produktion und Stripe Live unverändert.

Noch offen:
- exakter Vercel-Preview für den aktuellen Chat-UI-Head;
- Browserabnahme des `ABHOLUNG CHAT`;
- Browser-Evidenz C2C Versand/Empfang;
- Browser-Evidenz C2C Problemfall;
- Pickup-Nachrichten in Datenexport und Erasure-/Retention-Hardening;
- externe Kategorie-C-Freigaben einschließlich finaler Retention-Rechtsgrundlage.

Zulässige Kurzform:

**A geschlossen / B 1 technischer Hardening-Punkt offen / C extern offen / D Pickup-E2E geschlossen, verbleibende Browser-Evidenz offen.**

Nicht zulässig:
- `B07 vollständig freigegeben`;
- `rechtlich freigegeben`;
- `steuerlich freigegeben`;
- `Payment produktionsbereit`;
- `kommerzieller Start freigegeben`.
