# DUELVANTA – Masterhandout V19

Stand: 17.09.2026, nach Abschluss des verbleibenden Kategorie-B-Hardenings für Pickup-Nachrichten und vollständig grünem CI Run #492  
Status: **verbindlicher aktueller Übergabestand für die Weiterarbeit an B07 / TRADE**

V19 ersetzt widersprechende Statusangaben aus V18 und allen älteren Masterhandouts. Bereits in V18 geschlossene und hier nicht erneut aufgeführte Bereiche bleiben geschlossen, sofern kein neuer reproduzierbarer Befund vorliegt.

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
- keine echten Zahlungen, Refunds oder Payouts;
- keine produktive Rechts-/Steuer-/PStTG-/DAC7-Freigabe ableiten;
- keine bereits geschlossenen Kategorie-D-Punkte ohne neuen konkreten Befund erneut prüfen.

COLLECT, BATTLE, Scanner, Logo und Slogan bleiben unangetastet.

Slogan:

`COLLECT. TRADE. BATTLE.`

---

## 2. Aktueller technischer Checkpoint vor V19-Dokumentationscommit

Technischer Branch-Checkpoint:

`f2071eb698566161b93622c9ed1cf5016a6445d9`

Commit:

`test: close pickup message data-rights runtime gap`

Dieser Commit basiert direkt auf dem V18-Dokumentationscommit:

`41530783ab2877c19095c5b764efa1a485534e77`

Vollständiger CI-Lauf auf `f2071eb…`:

- Workflow: `Scanner V16 Check`
- Run: **#492**
- Run-ID: `35234475263`
- Gesamt: **SUCCESS**
- `quota_database`: **SUCCESS**
- `validate`: **SUCCESS**
- `Trade contracts and mobile order flow`: **SUCCESS**
- übrige reguläre PR-Regressionskette: **SUCCESS**
- ausschließlich push-spezifische Live-Katalog-/Real-Card-Schritte wurden erwartungsgemäß übersprungen.

Der V19-Dateicommit liegt nach diesem technischen Checkpoint. Für die technische Abnahme des Kategorie-B-Hardenings ist `f2071eb…` der vollständig grün geprüfte Referenzstand.

---

## 3. Kategorie B – Pickup-Nachrichten Data Rights jetzt geschlossen

Das in V18 noch offene interne Hardening-Paket umfasste ausschließlich:
- Pickup-Nachrichten in `export_my_duelvanta_data()`;
- Integration in Account-Erasure-/Retention-Holds;
- belastbare Contract-/DB-Regressionen.

### 3.1 Bestehende Produktintegration bestätigt

Die bereits vorhandene Datei:

`database/account-data-rights-pickup-messages-hardening-v1.sql`

enthält weiterhin:
- `dv_market_private.pickup_messages_for_export(uuid)`;
- `dv_market_private.user_has_pickup_messages(uuid)`;
- `public.export_my_duelvanta_data()` mit `duelvanta-data-export-v2` und `marketplace.pickup_messages`;
- Export der Gegenpartei nur als `sender_role = self|other`, nicht als fremde interne User-ID;
- `pickup_messages` als eigene Retention-Kategorie;
- `legal_basis = external_review_required`;
- `automatic_until_supported = false`;
- manuellen Retention-Hold bei Account-Erasure, wenn Pickup-Nachrichten vorhanden sind;
- keine automatisch erfundene Aufbewahrungsfrist;
- Trigger `block_restricted_pickup_messages` für die vorhandene Processing-Restriction-Grenze.

Die endgültige gesetzliche Aufbewahrungsdauer und Rechtsgrundlage werden **nicht** technisch vorweggenommen und bleiben Kategorie C.

### 3.2 Neue ausführbare Runtime-Regression

Neu hinzugefügt:

`tests/account-data-rights-pickup-messages-database-test.mjs`

Die Regression lädt die reale Pickup-Data-Rights-Hardening-SQL in eine disposable PGlite-Datenbank und prüft zur Laufzeit:
- Pickup-Nachrichten erscheinen im Eigendatenexport;
- Nachrichtenkörper und `self|other`-Rolle bleiben erhalten;
- fremde interne User-ID wird im Pickup-Export nicht ausgegeben;
- Retention-Regel bleibt `external_review_required`;
- keine automatische Frist wird gesetzt;
- Erasure mit vorhandenen Pickup-Nachrichten erzeugt einen manuellen `pickup_messages`-Hold;
- `retain_until` bleibt für diesen Hold `NULL`;
- `auth_action` wird auf `disable_and_retain` gesetzt;
- die Pickup-Nachricht bleibt während des Holds erhalten;
- der Processing-Restriction-Trigger ist vorhanden.

`tests/account-data-rights-contract-test.mjs` führt diese Runtime-Regression jetzt im bestehenden CI-Pfad mit aus.

Produktlogik außerhalb dieses Data-Rights-Bereichs wurde nicht verändert.

### 3.3 Supabase-Staging gegenprüft

Projekt:

`xhmjxrcskfhbovhitdej` / `DUELVANTA-STAGING`

Read-only geprüft:
- `public.export_my_duelvanta_data()` vorhanden;
- `dv_market_private.pickup_messages_for_export(uuid)` vorhanden;
- `dv_market_private.user_has_pickup_messages(uuid)` vorhanden;
- `public.prepare_account_deletion_data(uuid,uuid)` vorhanden;
- Exportfunktion verwendet den Pickup-Exporthelper;
- Erasure-Funktion prüft Pickup-Nachrichten und verwendet manuellen Hold;
- Retention-Regel `pickup_messages` steht auf `external_review_required` und `automatic_until_supported = false`;
- `block_restricted_pickup_messages` ist vorhanden;
- beide regulären Staging-Testrollen besitzen aktuell jeweils 4 exportierbare Pickup-Nachrichten und werden vom Hold-Helper korrekt erkannt.

Es wurden für diese Gegenprüfung keine Staging-Testdaten verändert und keine Produktion berührt.

### 3.4 Kategorie-B-Ergebnis

Der in V18 definierte letzte interne Hardening-Block ist technisch implementiert, runtime-getestet, CI-grün und gegen Staging verifiziert.

**Kategorie B: geschlossen.**

---

## 4. Aktualisierte A/B/C/D-Einordnung

### Kategorie A

**geschlossen**.

### Kategorie B

Pickup-Data-Rights-Hardening vollständig geschlossen.

**geschlossen**.

### Kategorie C

Weiterhin offen und ausdrücklich nicht durch technische Implementierung ersetzt:
- anwaltliche Schlussprüfung;
- steuerliche Schlussprüfung;
- finale Verbraucher-/AGB-/Datenschutztexte;
- finale PStTG-/DAC7-Einordnung;
- endgültige Rechtsgrundlage und Aufbewahrungsentscheidung für relevante Datenkategorien einschließlich Pickup-Nachrichten;
- Stripe Live;
- echte Zahlungen / Refunds / Payouts;
- produktive Payment-/Reporting-Aktivierung.

Anwalt/Steuerberater bleiben kein Blocker für interne Staging-Entwicklung, aber Gate vor kommerziellem TRADE-Produktivstart.

**Kategorie C: extern offen.**

### Kategorie D

Der in V18 dokumentierte Release-1-Browserumfang bleibt vollständig geschlossen.

**Kategorie D: geschlossen.**

Gesamt:

**A geschlossen / B geschlossen / C extern offen / D geschlossen.**

---

## 5. Kategorie D bleibt unangetastet

Ohne neuen reproduzierbaren Befund nicht erneut bearbeiten:
- C2C Pickup und Pickup-Code;
- Pickup-Chat Tausch und Kauf;
- C2C Versand / beidseitiger Empfang;
- C2C Problemflow 14/7/7;
- Problemantwort / Problemrücknahme;
- Trade-only No-Money-Regel;
- Sealed-Sale-only-Regel;
- TRADE-Suche;
- automatisches Archiv;
- Benachrichtigungen v2 / Unread-Badge;
- Tausch-Ladefehler / MutationObserver-Fix;
- weitere in V18 bereits als geschlossen dokumentierte Kategorie-D-Punkte.

---

## 6. Nächster B07-/TRADE-Schritt

Aus V18 verbleibt **kein weiterer interner Kategorie-B-Hardening-Punkt**.

Der nächste B07-/TRADE-Schritt darf daher nur aus einem neu konkret definierten Produkt-/Technikziel entstehen. Kategorie C darf dabei nicht technisch „wegimplementiert“ werden.

Bis zu einer ausdrücklichen Freigabe weiterhin:
- PR #5 offen und Draft;
- kein Merge;
- `main` unverändert;
- kein Stripe Live;
- keine echten Zahlungen;
- keine produktive Rechts-/Steuer-/PStTG-/DAC7-Freigabe.

Die in V18 geplante spätere Beta-Integration auf `main` mit gesperrtem TRADE-/`COMING SOON 2027`-State bleibt lediglich eine Strategie und ist **nicht freigegeben**.

---

## 7. Kurzstatus für Übergabe

Technischer vollständig grüner Checkpoint vor V19-Dokumentation:

`f2071eb698566161b93622c9ed1cf5016a6445d9`

CI:

`Scanner V16 Check #492 / 35234475263 = SUCCESS`

Produktions-main:

`50f88213571be13255bb52eb489cc28cca660001`

PR #5:

`open / Draft / nicht gemergt`

Statusmatrix:

`A geschlossen / B geschlossen / C extern offen / D geschlossen`
