# DUELVANTA – Masterhandout V18

Stand: 17.09.2026, nach vollständiger Kategorie-D-Browserabnahme und CI Run #490  
Status: **verbindlicher aktueller Übergabestand für die Weiterarbeit an B07 / TRADE**

V18 ersetzt widersprechende Statusangaben aus V17 und allen älteren Masterhandouts. Maßgeblich bleiben zusätzlich der tatsächliche Repository-Tree, der bestätigte Supabase-Staging-Stand und die unten dokumentierten CI-/Preview-Fakten.

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
- keine echten Kundendaten für B07-Abnahmen verwenden;
- keine bereits geschlossenen B07-Bereiche ohne neuen konkreten Befund wieder aufrollen.

Slogan bleibt:

`COLLECT. TRADE. BATTLE.`

---

## 2. Aktueller Repository-/CI-/Preview-Checkpoint

Aktueller vollständig grüner Branch-Checkpoint vor diesem Dokumentationscommit:

`dc9830991ba9542889c1be1bd638e4b9c3470b53`

PR #5 Head vor V18-Dokumentationscommit:

`dc9830991ba9542889c1be1bd638e4b9c3470b53`

Letzter vollständig grüner CI-Lauf:

- Workflow: `Scanner V16 Check`
- Run: **#490**
- Run-ID: `35232406904`
- Gesamt: **SUCCESS**
- `validate`: **SUCCESS**
- `Trade contracts and mobile order flow`: **SUCCESS**
- `quota_database`: **SUCCESS**
- Mobile-/Browser-/DOM-Regressionskette: **SUCCESS**

Aktueller Vercel-Preview zu `dc983099…`:

- Deployment-ID: `dpl_3wTaNGXHRCNAJt5zVFdprA9j9Zxm`
- Status: **READY**
- Branch-Alias bleibt `duelvantav5vision-git-marketplace-ux-v1-bennyescaped-3783.vercel.app`.

Wichtig: Der V18-Dateicommit liegt nach diesem technischen Checkpoint. Für technische Vergleiche ist `dc983099…` der letzte vollständig grün geprüfte Tree vor der Dokumentation.

---

## 3. Supabase-Staging – verbindlicher Stand

Projekt:

`xhmjxrcskfhbovhitdej` / `DUELVANTA-STAGING`

Produktion wurde nicht verändert.

Weiterhin aktiv und geprüft:
- C2C Eligibility;
- revisionsfester Tausch;
- bilaterales Binding;
- Versand-Fulfillment;
- Empfang;
- persönliche Abholung / Übergabecode;
- C2C-Problemfälle;
- Pickup-Nachrichten für Tausch und Kauf;
- Order-/Checkout-/Vertragsnachweis;
- Seller-Onboarding;
- Notice & Action;
- Datenrechte-/Erasure-Grundsystem;
- PStTG-/DAC7-Ledger-Grundsystem;
- Stripe-Connect-Sandboxfundament weiterhin deaktiviert für reale Transaktionen.

Reguläre Staging-Testrollen bleiben:

### Käufer
`test-kaeufer@duelvanta.de`  
User-ID `e81841df-2b08-45c1-a2d7-2671f8c58f7d`

### Verkäufer
`test-verkaeufer@duelvanta.de`  
User-ID `2fe2dfab-2802-46ac-8c7b-2804eae2be8e`

Keine Passwörter im Repository oder in Masterhandouts dokumentieren.

---

## 4. Kategorie D – Browser-Evidenz jetzt geschlossen

Die in V17 noch offenen Browserpunkte wurden am 17.09.2026 mit den zwei regulären Staging-Rollen vollständig geprüft.

### 4.1 Pickup-Tausch + Pickup-Chat – PASS

Neuer browserseitiger Pickup-/Chat-Test mit realen Staging-Testkarten:

Thread:

`f3ff18f1-6f7e-49dd-bed0-a0d1fa389687`

Nachgewiesen:
- Tauschvorschlag;
- bilaterale Bestätigung;
- Binding;
- persönliche Abholung;
- privater Pickup-Chat Partei A -> Partei B;
- privater Pickup-Chat Partei B -> Partei A;
- einmaliger Übergabecode;
- Bestätigung durch die Gegenpartei;
- technischer Abschluss;
- abgeschlossener Chat anschließend **read-only**.

Browsernachrichten im Test:
- Käufer: `Testnachricht Käufer: Übergabe morgen 18:00 Uhr.`
- Verkäufer: `Testnachricht Verkäufer: 18:00 Uhr passt.`

Der bereits in V17 dokumentierte frühere Pickup-E2E bleibt ebenfalls gültig und muss nicht wiederholt werden.

### 4.2 Pickup-Kauf / Order-Chat – PASS

Browserseitig wurde zusätzlich eine echte Staging-Pickup-Order mit zwei Rollen geprüft.

Ordernummer:

`DV-260917-000008`

Nachgewiesen:
- verbindliche Bestellung ohne Onlinezahlung;
- Abholung als Fulfillment;
- privater `ABHOLUNG CHAT · BESTELLUNG`;
- Käufer -> Verkäufer Nachricht;
- Verkäufer -> Käufer Nachricht;
- Übergabecodeflow;
- technischer Abschluss;
- Chat nach Abschluss **read-only**;
- unveränderbarer Bestell-/Vertragsnachweis bleibt abrufbar.

Damit ist die in V17 noch offene Pickup-Chat-Abnahme für **Tausch und Kauf** geschlossen.

### 4.3 C2C-Versand – PASS

Versand-Tauschthread:

`78812209-ce7d-4c50-a6eb-15d4d44a83e9`

Browserseitig nachgewiesen:
- Shipping-Proposal;
- bilaterale Bestätigung;
- Binding;
- zwei getrennte Fulfillments;
- Trackingpflicht auf beiden Seiten;
- Verkäufer -> Käufer Versand;
- Käufer -> Verkäufer Versand;
- jeweilige Empfangsbestätigung;
- automatischer technischer Abschluss erst nach beiden Empfangsbestätigungen.

Staging-Testtracking:
- Verkäufer: `DHL TEST / B07-SHIP-V-001`
- Käufer: `DHL TEST / B07-SHIP-K-001`

Endzustand:
- beide Sendungen versendet;
- beide Empfänge bestätigt;
- Thread `completed`;
- `completed_at` gesetzt.

### 4.4 C2C-Problemfall 14/7/7 – PASS

Für die Fristprüfung wurde ein isolierter ungetrackter Staging-Testthread verwendet:

`b0700000-0000-4000-8000-000000000101`

Problemfall:

`8280ad98-ba7e-46d2-951a-7bacf3c219b4`

Browserseitig nachgewiesen:
- bei ungetracktem Versand ist `Nicht erhalten` vor Ablauf von 14 Tagen blockiert;
- angezeigte Freigabe im Test: `01.10.2026, 13:58`;
- andere konkrete Kategorien bleiben vorher meldbar;
- Problem eröffnet am 17.09.2026 ca. 14:01;
- Antwortfrist exakt +7 Tage;
- Nachweisfrist exakt +7 Tage;
- Gegenpartei konnte antworten;
- Antwort blieb nachvollziehbar gespeichert;
- eröffnende Partei konnte den Fall zurückziehen;
- Status wechselte von `disputed` zurück auf `bound`, solange kein weiterer offener Fall existiert.

Der künstliche Testthread wurde danach aus der aktiven Ansicht genommen, damit keine falsche `AKTION ERFORDERLICH` verbleibt.

### 4.5 Kategorie-D-Ergebnis

Für den derzeit definierten Release-1-Browserumfang sind damit geschlossen:
- C2C Pickup;
- Pickup-Code;
- Pickup-Chat Tausch;
- Pickup-Chat Kauf;
- C2C Versand;
- beidseitiger Empfang;
- C2C-Problemfall 14/7/7;
- Problemantwort;
- Problemrücknahme;
- Abschluss-/Archivdarstellung.

**Kategorie D: browserseitig geschlossen.**

---

## 5. `Nur Tausch` – kein Geldbetrag mehr

Neue verbindliche Regel für **Single und Graded**:

Bei `listing_type = trade` gilt:
- kein Verkaufspreis;
- keine Preisart;
- `asking_price = NULL`;
- keine Mengenpreise;
- Preisangebote gegen reine Tauschlistings werden serverseitig blockiert;
- Marktwert darf ausschließlich als unverbindlicher Referenzwert angezeigt werden.

UI:
- Preisfeld und Preisart verschwinden bei `Nur Tausch`.

DB:
- zusätzliche Invarianten verhindern manipulierte Tauschlistings mit Geldpreis.

Browserabnahme: **PASS**.

---

## 6. Sealed – ausschließlich Verkauf

Strategische Produktentscheidung vom 17.09.2026:

**Sealed wird nicht als Tauschprodukt angeboten.**

Für Sealed gilt jetzt:
- nur `sale`;
- kein `sale_or_trade`;
- kein `trade`;
- Tauschoptionen sind aus dem Sealed-Formular entfernt;
- Datenbank blockiert manipulierte Sealed-Tauschlistings.

Single und Graded behalten weiterhin:
- Verkauf;
- Verkauf oder Tausch;
- Nur Tausch.

Browser-/CI-Abnahme: **PASS**.

---

## 7. TRADE-Suche und automatisches Archiv

### 7.1 Marktplatzsuche

TRADE enthält jetzt eine prominente Suche mit Suchraum für:
- Karten;
- Graded;
- Sealed;
- Sets;
- Kartennummern / Produktnummern.

Bestehende TCG-, Produkt- und Sortierfilter bleiben erhalten.

Browserabnahme: **PASS**.

### 7.2 Automatisches Archiv

Neuer Bereich:

`WEITERE BEREICHE -> ARCHIV`

Prinzip:
- abgeschlossene Vorgänge werden **nicht gelöscht**;
- sie werden nur aus den aktiven Ansichten entfernt;
- Nachweise und Vertragsdaten bleiben bestehen;
- keine erfundene automatische Löschfrist wurde eingeführt.

Archivierte UI-Kategorien:
- Inserate;
- Käufe / Verkäufe;
- Tausch;
- Preisangebote;
- Problemfälle.

Aktive Ansichten blenden terminale Vorgänge aus. Beispiel:
- 200 abgeschlossene Verkäufe stehen nicht zwischen aktuellen Verkäufen;
- sie bleiben über das Archiv auffindbar.

Das Archiv besitzt:
- eigene Suche;
- Kategorienfilter;
- Order-Öffnung für archivierte Orders.

Browserabnahme: **PASS**.

### 7.3 Behobener Tausch-Ladefehler

Befund:

`TAUSCH` blieb nach Einführung des Archivs bei `Tauschvorgänge werden geladen …` stehen.

Ursache:
- nicht die C2C-RPC;
- eine MutationObserver-Schleife im neuen Aktiv-/Archivfilter erzeugte den Leerzustand wiederholt neu.

Produktfix:
- Leerzustand idempotent;
- kein permanentes Entfernen/Neuerzeugen mehr;
- Cache-Version erhöht.

Browsernachweis danach:

`Keine aktiven Vorgänge. Abgeschlossene Einträge findest du im Archiv.`

Status: **geschlossen**.

---

## 8. TRADE-Benachrichtigungen und `AKTION ERFORDERLICH`

Die frühere Benachrichtigungslogik deckte im Wesentlichen Kauf, Preisangebot und Orderstatus ab. Sie wurde auf den neuen Release-1-TRADE-Stack erweitert.

### 8.1 Benachrichtigungen v2

Neu abgedeckt:
- neuer Tauschvorschlag;
- Tauschänderung / neue Revision;
- Gegenpartei bestätigt Tauschstand;
- Tausch verbindlich;
- Gegenseite versendet;
- Erhalt bestätigt;
- Tausch abgeschlossen;
- Übergabecode bereit;
- Pickup bestätigt;
- Tauschproblem eröffnet;
- Antwort auf Tauschproblem;
- Problem abgeschlossen / zurückgezogen;
- neue Pickup-Chat-Nachricht bei Order;
- neue Pickup-Chat-Nachricht bei Tausch.

Technisch:
- `market_notifications` bleibt RPC-only;
- `context_type` / `context_id` ergänzen die vorhandenen Order-/Offer-/Listing-Bezüge;
- `sync_my_trade_notifications_v2()` erzeugt fehlende Ereignisse idempotent;
- historische v2-Ereignisse wurden beim Rollout als gelesen behandelt, damit kein künstlicher Alt-Badge entsteht.

UI-Hinweis lautet jetzt sinngemäß:

`Kauf · Angebot · Tausch · Chat · Versand · Erhalt · Probleme`

### 8.2 `AKTION ERFORDERLICH`

Zusätzlich zu Kauf-/Orderaktionen werden jetzt C2C-Aktionen berücksichtigt, insbesondere:
- Tauschstand bestätigen;
- Tausch versenden;
- Tausch-Erhalt bestätigen;
- Pickup-Code / Übergabe bestätigen;
- auf Tauschproblem antworten.

Browsernachweis:
- nach Testdatenbereinigung `AKTION ERFORDERLICH = 0`;
- kein Ghost-Action-Eintrag mehr.

### 8.3 Ungelesen-End-to-End

Gezielter Staging-Test:
- Ausgang: Badge `0`;
- ein frisches Testereignis erzeugt;
- Badge wurde browserseitig `1`;
- Meldung erschien oben als ungelesen;
- Antippen markierte sie gelesen;
- Badge fiel wieder auf `0`.

Testnotification wurde nach der Abnahme wieder aus Staging entfernt.

Status: **Benachrichtigungs-/Unread-Flow PASS**.

---

## 9. CI #485 – Ursache des langen Laufs und endgültige Korrektur

CI Run #485 hing nicht an einem Produkt-/Supabase-Fehler.

Aus dem vollständigen Joblog:
- sämtliche Trade-/DB-/Stripe-Prüfungen bis einschließlich `market-stripe-live-mode-database-test.mjs` waren bereits **PASS**;
- danach startete `trade-dom-test.mjs`;
- dort blieb der synthetische LinkeDOM-Test bis zum Job-Timeout stehen.

Ursache:
- `trade-search-archive.js` arbeitet bewusst mit realem `MutationObserver`-Verhalten;
- LinkeDOM ist für diesen observergetriebenen Archivfilter kein verlässliches Browser-Modell und konnte dessen synthetischen Eventloop verhungern lassen;
- der reale Safari-/Chromium-Browser war nach dem Produktfix bereits responsiv.

Saubere Testtrennung:
- `trade-search-archive.js` wird nicht mehr im LinkeDOM-DOM-Modell ausgeführt;
- Such-/Archivvertrag wird statisch geprüft;
- reales Observer-/Rendering-Verhalten bleibt im Chromium-E2E und in der manuellen Browserabnahme abgedeckt.

Ergebnis:

CI Run #490 ist vollständig grün.

Das ist eine **Test-Harness-Korrektur**, kein Abschwächen der Produktprüfung.

---

## 10. Aktualisierte A/B/C/D-Einordnung

### Kategorie A

**geschlossen**.

### Kategorie B

Weiterhin ein interner Hardening-Block für Pickup-Nachrichten offen:
- Pickup-Nachrichten in `export_my_duelvanta_data()` aufnehmen;
- technische Integration in Account-Erasure-/Retention-Holds.

Endgültige Aufbewahrungsdauer und endgültige Rechtsgrundlage gehören dagegen zur externen Kategorie C.

Bewertung:

**B: 1 technisches Hardening-Paket offen.**

### Kategorie C

Weiterhin offen und absichtlich deaktiviert:
- anwaltliche Schlussprüfung;
- steuerliche Schlussprüfung;
- finale Verbraucher-/AGB-/Datenschutztexte;
- finale PStTG-/DAC7-Einordnung;
- Stripe Live;
- echte Zahlungen / Refunds / Payouts;
- produktive Payment-/Reporting-Aktivierung.

Anwalt/Steuerberater sind **kein Blocker für interne Staging-Entwicklung**, aber weiterhin Gate vor kommerziellem Produktivstart.

Bewertung:

**C offen; kommerzieller TRADE-Produktivstart bleibt blockiert.**

### Kategorie D

Browser-Evidenz für den aktuellen Release-1-Umfang ist vollständig geschlossen.

Bewertung:

**D geschlossen.**

Gesamt:

**A geschlossen / B 1 interner Hardening-Block offen / C extern offen / D geschlossen.**

---

## 11. Strategische Release-Entscheidung für `main`

Geplanter späterer Beta-Integrationsweg:
- COLLECT, TRADE und BATTLE können technisch gemeinsam auf `main` gebracht werden, sobald der Merge ausdrücklich freigegeben wird;
- TRADE soll dabei zunächst **gesperrt** bleiben;
- vorgesehenes Nutzerbild: `COMING SOON 2027` bzw. gleichwertiger klarer Locked-State;
- COLLECT und BATTLE können währenddessen weiter als Beta ausgebaut werden;
- die vorhandene TRADE-Implementierung bleibt im Code, ist aber für normale Nutzer nicht zugänglich.

Diese Strategie ist **nur geplant**.

Aktuell gilt weiterhin:
- kein Merge;
- `main` unverändert;
- PR #5 Draft.

---

## 12. Bereits geschlossene Bereiche – nicht ohne neuen Befund wiederholen

Nicht erneut bearbeiten:
- B01–B04;
- GitHub-Main-Ruleset;
- Seller-Onboarding-Grundmodell;
- C2C Eligibility;
- C2C Revision/Binding;
- C2C Pickup-E2E;
- C2C Shipping-/Receive-E2E;
- C2C Problemflow 14/7/7;
- Pickup-Nachrichten RLS/ACL/RPC-Grenzen;
- Pickup-Chat Browserabnahme Tausch + Kauf;
- Trade-only No-Money-Regel;
- Sealed-Sale-only-Regel;
- TRADE Suche;
- automatisches Archiv;
- Benachrichtigungen v2 / Unread-Badge;
- Tausch-Ladefehler / Archiv-Mutationloop;
- CI-LinkeDOM-Testharness für den Archivfilter.

Nur bei einem neuen reproduzierbaren Befund wieder öffnen.

---

## 13. Testdaten-/Datenschutz-Hinweise

Alle genannten Browserdaten sind Staging-Testdaten.

Verbindlich:
- keine fremden Staging-Daten pauschal löschen;
- Testdaten nur gezielt über eindeutige IDs/Marker bereinigen;
- Vertrags-/Auditdaten nicht ohne dokumentierten Grund entfernen;
- keine Passwörter oder Auth-Secrets in Handouts aufnehmen;
- Pickup-Chats können personenbezogene Übergabedaten enthalten und bleiben deshalb Teil des offenen B-/C-Retention-Themas.

---

## 14. Exakter Arbeitsauftrag für den nächsten Chat

Arbeite ausschließlich auf `marketplace-ux-v1`.

1. Dieses Masterhandout V18 zuerst öffnen und als verbindlichen Übergabestand verwenden.
2. Repository-/PR-/CI-Stand gegen den tatsächlichen Head prüfen.
3. `main`, Produktion, Stripe Live und echte Paymentflüsse nicht verändern.
4. Kategorie D **nicht erneut testen**, sofern kein neuer konkreter Befund vorliegt.
5. Als nächsten internen B07-Punkt das verbleibende Kategorie-B-Hardening für Pickup-Nachrichten bearbeiten:
   - Exportintegration;
   - Erasure-/Retention-Hold-Integration;
   - dazu Contract-/DB-Regressionen.
6. Kategorie C nicht technisch „wegimplementieren“; externe Rechts-/Steuerprüfung bleibt späteres Go-live-Gate.
7. PR #5 offen und Draft lassen; nicht mergen.

---

## 15. Kurzstatus für Übergabe

Aktueller geprüfter technischer Tree vor V18-Dokumentation:

`dc9830991ba9542889c1be1bd638e4b9c3470b53`

CI:

`Scanner V16 Check #490 / 35232406904 = SUCCESS`

Preview:

`dpl_3wTaNGXHRCNAJt5zVFdprA9j9Zxm = READY`

Produktions-main:

`50f88213571be13255bb52eb489cc28cca660001`

PR #5:

`open / Draft / nicht gemergt`

Statusmatrix:

`A geschlossen / B 1 internes Hardening-Paket offen / C extern offen / D geschlossen`
