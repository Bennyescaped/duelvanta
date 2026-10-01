# DUELVANTA – Masterhandout V20

Stand: 17.09.2026, nach Abschluss des TRADE Release-Locks  
Status: **verbindlicher aktueller Übergabestand für die weitere DUELVANTA-Beta-Entwicklung**

V20 ersetzt widersprechende Statusangaben aus V19 und allen älteren Masterhandouts. Maßgeblich bleiben zusätzlich der tatsächliche Repository-Tree, der bestätigte Supabase-Staging-Stand und die unten dokumentierten CI-/Preview-Fakten.

Dieses Dokument ist **keine Rechts-, Steuer-, Payment- oder kommerzielle Produktionsfreigabe**.

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

Weiterhin verbindlich:
- `main` nicht verändern oder mergen, solange keine ausdrückliche Freigabe erfolgt;
- Stripe Live nicht aktivieren;
- keine echten Zahlungen, Refunds oder Payouts;
- keine produktive Rechts-/Steuer-/PStTG-/DAC7-Freigabe ableiten;
- COLLECT, BATTLE, Scanner, Logo und Slogan nicht durch TRADE-Arbeiten verändern.

Slogan:

`COLLECT. TRADE. BATTLE.`

---

## 2. Aktueller technischer Checkpoint

Letzter vollständig grün geprüfter technischer Branch-Checkpoint vor diesem Dokumentationscommit:

`71818b8b827a2513b1e86843fa1082b20d7c5e0a`

GitHub Actions:
- Workflow: `Scanner V16 Check`
- Run: **#502**
- Run-ID: `35236508363`
- Gesamt: **SUCCESS**
- `validate`: **SUCCESS**
- `Trade contracts and mobile order flow`: **SUCCESS**
- `quota_database`: **SUCCESS**
- allgemeine Scanner-/COLLECT-/Browser-Regressionskette: **SUCCESS** bzw. die push-only Live-Schritte erwartungsgemäß `skipped`.

Aktueller Vercel-Preview zum technischen Head:
- Deployment-ID: `dpl_9GkdDRMeLcrQdL3pPQoLHDKDQS1L`
- Status: **READY**
- Branch-Alias: `duelvantav5vision-git-marketplace-ux-v1-bennyescaped-3783.vercel.app`
- Function Count weiterhin 12 Node-Funktionen; keine zusätzliche Serverless-Funktion für den Release-Lock eingeführt.

---

## 3. Statusmatrix

### Kategorie A
**geschlossen**.

### Kategorie B
**geschlossen**.

Pickup-Nachrichten sind technisch in Datenexport sowie Account-Erasure-/Retention-Holds integriert und durch ausführbare Regression abgesichert. Keine erfundene automatische Aufbewahrungsfrist.

### Kategorie C
**extern offen**.

Weiterhin vor kommerziellem TRADE-Produktivstart erforderlich:
- anwaltliche Schlussprüfung;
- steuerliche Schlussprüfung;
- finale Verbraucher-/AGB-/Datenschutztexte;
- finale PStTG-/DAC7-Einordnung;
- Stripe-Live-Freigabe;
- echte Payment-/Refund-/Payout-Aktivierung.

Kategorie C blockiert nicht die interne Staging-/Beta-Entwicklung, bleibt aber Go-live-Gate für kommerzielles TRADE.

### Kategorie D
**geschlossen**.

Die bestehende Browser-/E2E-Evidenz wird ohne neuen reproduzierbaren Befund nicht erneut aufgerollt.

Gesamt:

**A geschlossen / B geschlossen / C extern offen / D geschlossen.**

---

## 4. TRADE Release-Lock – umgesetzt

Die in V19 noch geplante Beta-Strategie ist jetzt technisch vorbereitet.

Neue Dateien:
- `trade-release-gate.js`
- `trade-release-gate.css`
- `tests/trade-release-gate-test.mjs`

Geänderte Integrationspunkte:
- `trade.html`
- `api/compliance-message-dispatch.js`
- TRADE-Testharness/Contracttests für die dynamische Script-Ladung.

### 4.1 Production – normale Nutzer

Bei `DV_SUPABASE.environment = production` gilt für normale bzw. nicht als Owner erkannte Nutzer:
- TRADE-Runtime-Stack wird **nicht geladen**;
- Marktplatzfunktionen der Seite werden nicht initialisiert;
- stattdessen erscheint ein klarer Locked-State:
  - `TRADE · BETA`
  - `COMING SOON 2027`
  - Kaufen, Verkaufen und Tauschen noch nicht freigeschaltet;
- COLLECT und BATTLE werden als weiterhin verfügbare Bereiche benannt;
- anonyme Nutzer sehen ebenfalls nur den Locked-State.

Damit ist die normale Weboberfläche für TRADE auf einem späteren Production-Merge vorbereitet, ohne die fertige TRADE-Implementierung aus dem Code zu entfernen.

### 4.2 Owner-Bypass

Auf Production darf ausschließlich ein eingeloggtes Profil mit:

`profiles.role = owner`

den vollständigen TRADE-Runtime-Stack über das Release-Gate laden.

Für diesen internen Owner-Zugriff wird zusätzlich der Control-Center-Link eingeblendet.

Das ist ein interner Beta-/Wartungszugang und keine allgemeine Produktfreigabe.

### 4.3 Preview / Staging

Für `preview` und andere Nicht-Production-Umgebungen bleibt TRADE vollständig geladen.

Dadurch bleiben insbesondere erhalten:
- die zwei regulären Staging-Testrollen;
- Käufer-/Verkäufer-E2E;
- Tausch;
- Pickup;
- Shipping/Receive;
- Problemflows;
- Datenrechte;
- weitere interne Regressionen.

Der Release-Lock blockiert daher die weitere Staging-Entwicklung nicht.

### 4.4 Öffentliche Listing-Links

Der bestehende Public-Listing-Renderer wurde ebenfalls gegated.

Auf Production:
- keine Listingdetails werden öffentlich gerendert;
- Antwort ist der `COMING SOON 2027`-Locked-State;
- Statuscode: `423`.

Auf Preview bleibt die vorhandene öffentliche Listing-Vorschau für interne Tests bestehen.

---

## 5. Sicherheits-/Scope-Grenze des Release-Locks

Der neue Release-Lock ist bewusst ein **Web-/Runtime-/Public-Share-Release-Gate**.

Er bedeutet:
- normale Nutzer können über die ausgelieferte Production-TRADE-Oberfläche keinen Marktplatz-, Checkout-, Verkauf- oder Tauschflow starten;
- öffentliche Production-Listing-Links geben keine Angebote frei;
- Preview/Staging bleibt testbar;
- bestehende Auth-/RLS-/Business-Regeln bleiben unverändert.

Er bedeutet ausdrücklich **nicht**, dass jetzt eine neue produktive globale Datenbank-Sperre oder ein neues produktives Supabase-Feature-Flag aktiviert wurde.

Es wurden für diesen Block:
- keine Production-Supabase-Migrationen angewandt;
- keine Production-Datenbank geändert;
- keine Kategorie-C-Freigaben ersetzt.

Diese Abgrenzung muss bei einem späteren tatsächlichen `main`-/Production-Release erneut berücksichtigt werden.

---

## 6. Regressionen zum Release-Lock

Gezielt nachgewiesen:
- Production normaler Nutzer -> `locked`;
- Production anonym -> `locked`;
- Production Owner -> `owner-bypass`;
- Preview -> `internal-preview`;
- normale Production-Nutzer laden **keinen** TRADE-Runtime-Stack;
- Owner und Preview laden den bestehenden Stack in definierter Reihenfolge;
- öffentliche Production-Listing-Links sind gesperrt;
- alte TRADE-Module, Cacheversionen und Reihenfolge bleiben über den Gate-Manifestvertrag geprüft;
- LinkeDOM-DOM-Harness lädt für Tests die tatsächliche Manifestliste aus `trade-release-gate.js` nach, statt eine zweite Produktliste zu pflegen;
- reale Chromium-/Browser-Regressionsabdeckung bleibt bestehen.

Zwischenbefunde während der Einführung:
- zwei CI-Läufe wurden durch alte Testannahmen an die frühere statische Script-Ladung rot;
- es lag kein Produkt-/Datenbankfehler vor;
- die Testharnesses wurden gezielt auf die neue Gate-Ladung angepasst;
- anschließend vollständiger CI #502 = SUCCESS.

---

## 7. Nicht verändert

Unverändert geblieben:
- Produktions-`main`;
- Produktion;
- Supabase Production;
- Stripe Live;
- echte Payments/Refunds/Payouts;
- bestehende TRADE-Fachlogik außerhalb des Gates;
- COLLECT;
- BATTLE;
- Scanner;
- Logo;
- Slogan.

---

## 8. Bereits geschlossene Bereiche – nicht erneut bearbeiten

Ohne neuen konkreten reproduzierbaren Befund nicht wieder aufrollen:
- Kategorien A und B;
- Kategorie D;
- B01–B04;
- Seller-Onboarding-Grundmodell;
- C2C Eligibility/Revision/Binding;
- Pickup/Shipping/Receive/Problemflow;
- Pickup-Nachrichten einschließlich Data-Rights-Hardening;
- TRADE-Suche/Archiv;
- Notifications/Unread;
- Trade-only No-Money;
- Sealed-Sale-only;
- Release-1 Browserabnahmen;
- TRADE Release-Gate-Grundfunktion.

---

## 9. Nächster sinnvoller Arbeitsbereich

Der unmittelbar beauftragte Release-Lock ist abgeschlossen.

Vor einem tatsächlichen Merge auf `main` muss ausdrücklich neu entschieden und geprüft werden:
- welcher kombinierte COLLECT/TRADE/BATTLE-Stand nach `main` soll;
- ob der aktuelle Web-Release-Lock für den vorgesehenen Beta-Release genügt oder zusätzlich eine server-/datenbankseitige globale TRADE-Aktivierungssperre vorgesehen werden soll;
- vollständige Merge-/Production-Abnahme;
- Kategorie C bleibt unabhängig davon vor kommerziellem TRADE-Start offen.

Bis zu einer ausdrücklichen Merge-Freigabe gilt weiterhin:
- PR #5 Draft lassen;
- PR #5 nicht mergen;
- `main` nicht verändern.

---

## 10. Kurzstatus für Übergabe

Technischer Checkpoint:

`71818b8b827a2513b1e86843fa1082b20d7c5e0a`

CI:

`Scanner V16 Check #502 / 35236508363 = SUCCESS`

Preview:

`dpl_9GkdDRMeLcrQdL3pPQoLHDKDQS1L = READY`

Produktions-main:

`50f88213571be13255bb52eb489cc28cca660001`

PR #5:

`open / Draft / nicht gemergt`

Statusmatrix:

`A geschlossen / B geschlossen / C extern offen / D geschlossen`
