# DUELVANTA – Masterhandout V15

Stand: 16.09.2026  
Status: **verbindlicher Übergabestand für die Weiterarbeit ausschließlich an B07**

Dieses Dokument ersetzt widersprechende Statusangaben aus älteren Masterhandouts und fasst den tatsächlich geprüften Stand nach dem Release-1-Versandmodell, C2C-Problemflow, realer PostgreSQL-C2C-Abnahme und C2C-Abholimplementierung zusammen.

Es ist **keine Rechts-, Steuer- oder Paymentfreigabe**. Externe Schlussprüfung vor kommerziellem Produktivstart bleibt bestehen. Interne Entwicklung und Staging-Prüfung dürfen weitergeführt werden.

---

## 1. Verbindlicher Repository-Stand

Repository: `Bennyescaped/duelvanta`

Entwicklungsbranch: `marketplace-ux-v1`

Technischer Code-Checkpoint vor diesem Dokumentationscommit:

`2bdcc62964251e6d7cef9ac138b6ef369d7529a4`

Produktions-`main`:

`50f88213571be13255bb52eb489cc28cca660001`

PR #5:
- offen
- Draft
- nicht gemergt
- Base: `main`
- Head: `marketplace-ux-v1`

**Verbindliche Grenze:** `main`, Produktion und produktives Supabase nicht verändern. Kein Merge. Keine Stripe-Live-, echte Payment-, Refund- oder Payout-Aktivierung.

---

## 2. Letzter vollständig bestätigter CI-Stand

GitHub Actions Workflow: `Scanner V16 Check`

Letzter bestätigter Lauf auf technischem Checkpoint `2bdcc62964251e6d7cef9ac138b6ef369d7529a4`:

- Run #403
- Run-ID: `35075709516`
- Ergebnis: **SUCCESS**
- `validate`: **SUCCESS**
- `quota_database`: **SUCCESS**
- `Trade contracts and mobile order flow`: **SUCCESS**
- `trade-browser-e2e`: im erfolgreichen `validate`-Job enthalten
- Real SQL quota and B07 C2C regressions in disposable PostgreSQL 17: **SUCCESS**

Nicht erneut alte erfolgreiche Läufe oder den bereits geschlossenen Browser-Hänger debuggen, sofern spätere Änderungen diese Bereiche nicht berühren.

---

## 3. Vercel-Sonderstatus am 16.09.2026

Vercel Free hat das tägliche Deployment-Limit erreicht:

`api-deployments-free-per-day` / mehr als 100 Deployments.

Folge:
- weitere Preview-Deployments können bis zum automatischen Limit-Reset fehlschlagen;
- dies ist **kein DUELVANTA-Codefehler**;
- kein Vercel-Pro-Upgrade ist für B07 erforderlich;
- bis zum Reset GitHub-CI und Supabase-Staging für die Abnahme verwenden;
- nach Reset nur **ein** Preview-Deployment des dann aktuellen Branch-Heads erzeugen bzw. abwarten;
- fehlgeschlagene Zwischen-Deployments nicht einzeln nachholen.

Bis dahin darf nicht behauptet werden, dass ein Vercel-Preview zwingend exakt den neuesten Branch-Head ausliefert.

---

## 4. Supabase-Staging – tatsächlich verifizierter Stand

Staging-Projekt:

`xhmjxrcskfhbovhitdej`

Am 16.09.2026 direkt geprüft:

- `b07_set_shipping_due` Trigger: **aktiv**
- `request_market_order_delivery_review_b07(uuid)`: **aktiv**
- `advance_market_order_lifecycle_b07()`: **aktiv**
- B07-Cron `duelvanta-b07-carrier-72h-advance`: **aktiv**
- C2C-Stack `dv_market_private.market_swap_threads`: **nicht auf Staging aktiviert**

Damit gilt:
- Release-1-Order-Versand-/Abschlusslogik ist auf Staging teilweise persistent aktiviert und getestet;
- C2C-Schema/Binding/Fulfillment/Problems/Pickup sind aktuell nur Repository + disposable PostgreSQL-CI, **nicht Staging**;
- C2C nicht isoliert oder in falscher Reihenfolge auf Staging anwenden.

---

## 5. Verbindliches Release-1-Versand-/Abschlussmodell

Quelle: `DUELVANTA_B07_DECISION_L07-01_54_2026-09-16.md`.

### Versand

- Warenwert > 25 EUR: Tracking verpflichtend.
- Warenwert <= 25 EUR: Tracking optional.
- Risikoflag kann Tracking unabhängig vom Warenwert verpflichten.
- Freiwillig getrackter Versand <= 25 EUR nutzt den getrackten Abschlussweg.
- Trackingpflicht wird serverseitig erzwungen, nicht nur in der UI.

### Getrackter Versand ohne kostenpflichtige Carrier-API

- Verkäufer speichert Carrier + Trackingnummer.
- Käufer kann jederzeit `ERHALTEN – ALLES IN ORDNUNG` bestätigen und damit technisch sofort abschließen, sofern kein Problemfall offen ist.
- Reagiert der Käufer nicht, kann der Verkäufer `ZUSTELLPRÜFUNG ANFORDERN`.
- Owner prüft die offizielle Sendungsverfolgung und verifiziert den tatsächlichen Zustellzeitpunkt.
- Erst Owner-Verifizierung setzt `delivery_evidence_at` und `closure_eligible_at = delivery_evidence_at + 72 hours`.
- Offener Problemfall blockiert Abschluss.
- Nach 72 Stunden ohne offenen Problemfall: technischer Abschluss mit `carrier_delivery_72h_elapsed`.
- Automatischer Abschluss setzt **keine** fingierte Käuferbestätigung.

### Ungetrackter Versand

- keine 72h-Zustellfrist;
- `Nicht erhalten` frühestens 14 Tage nach `shipped_at`;
- ohne offenen Problemfall technischer Autoabschluss nach 40 Tagen;
- Abschlussgrund `untracked_shipping_40d_elapsed`;
- andere konkret eingetretene Problemarten sind nicht pauschal 14 Tage gesperrt.

### AfterShip

- vorbereitete Multi-Carrier-Integration bleibt im Repository;
- `MARKET_TRACKING_ENABLED` bleibt default-off;
- AfterShip ist **keine Release-1-Abhängigkeit**;
- keine kostenpflichtige AfterShip-Buchung erforderlich;
- spätere Aktivierung darf nur die manuelle Owner-Zustellprüfung automatisieren, nicht das fachliche Fristenmodell verändern.

---

## 6. Versandfrist-Lifecycle – gehärtet und auf Staging geprüft

Datei:

`database/b07-l07-01-shipping-deadline-hardening-v1.sql`

Erledigt:
- `dv_market_private.b07_add_workdays_de` ist `STABLE`, nicht `IMMUTABLE`;
- bereits bezahlt angelegte Orders erhalten die 3-Werktage-Frist bei `INSERT`;
- spätere `payment_status='paid'`-Updates werden erfasst;
- relevante Änderungen an `fulfillment_group` werden erfasst;
- wenn vorhanden, wird `paid_at` als Friststart verwendet;
- Trigger deckt `BEFORE INSERT OR UPDATE OF payment_status, fulfillment_group` ab.

Staging-Test mit Rollback bestätigte INSERT-paid und UPDATE-paid jeweils mit exakt drei Werktagen.

---

## 7. C2C-Tausch – verbindliches Produktmodell

Release 1:
- nur privat <-> privat;
- ausschließlich Ware gegen Ware;
- keine Geldkomponente;
- keine DUELVANTA-Tauschprovision;
- jeder trägt eigene Versandkosten;
- Deutschland-only;
- registriert und 18+;
- Tausch wird erst verbindlich, wenn beide Parteien **denselben finalen Revisionshash** bestätigen;
- jede Änderung erzeugt neue Revision und alte Bestätigungen gelten nicht für den neuen Stand;
- bei Versand beginnt nach Bindung eine 3-Werktage-Versandfrist;
- Tracking bei unbekanntem oder >25-EUR-Referenzwert;
- technische Referenzwerte erzeugen keine PStTG-/Steuerbuchung;
- `psttg_evaluation_status='external_review_required'`;
- `psttg_event_created_by_b07=false`.

Wichtige Dateien:
- `database/b07-l07-01-c2c-swap-v1-schema.sql`
- `database/b07-l07-01-c2c-swap-v1-binding.sql`
- `database/b07-l07-01-c2c-swap-v1-fulfillment.sql`
- `trade-c2c-swap.js`

---

## 8. C2C-Problemfälle – implementiert

Datei:

`database/b07-l07-01-c2c-swap-v1-problems.sql`

UI:

`trade-c2c-swap-problems.js`

Implementiert:
- Problemfall an konkrete Tauschsendung/Senderseite gebunden;
- Kategorien inkl. `not_received`, `damaged`, `not_as_described`, `shipping`, `other`;
- nur Teilnehmer dürfen öffnen/antworten/zurückziehen;
- offener Fall setzt Thread auf `disputed`;
- 7-Tage-Antwortfrist;
- 7-Tage-Nachweisfrist;
- ungetracktes `not_received` erst nach 14 Tagen;
- Rücknahme des einzigen offenen Problems setzt Thread wieder auf `bound`;
- keine Refund-/Payout-/Gebührenwirkung;
- keine zivilrechtliche automatische Schuldentscheidung.

Der Flow wurde im echten PostgreSQL-17-CI zusammen mit Bindung, Reservierung und Abschluss erfolgreich ausgeführt.

---

## 9. C2C-Abholung – aktueller tatsächlicher Stand

Die zentrale B07-Entscheidung erlaubt beim C2C-Tausch ausdrücklich `Tracking bzw. bei Abholung den Übergabenachweis`.

Implementiert in:

`database/b07-l07-01-c2c-swap-v1-pickup.sql`

UI bereits in:

`trade-c2c-swap.js`

### Fachliche/technische Umsetzung

- `fulfillment_mode` ist `shipping|pickup`;
- Übergabeart ist Bestandteil des **unveränderbaren Revisionsinhalts/-hashes** (`c2c-swap-revision-v2`);
- Wechsel Versand <-> Abholung erzeugt neue Revision;
- frühere Bestätigung gilt nicht für neue Revision;
- Pickup bindet erst nach Bestätigung derselben Pickup-Revision durch beide Seiten;
- Pickup erzeugt keine Versandfrist;
- Pickup erzeugt keine Shipping-Address-Snapshots;
- Pickup erzeugt keine Shipping-Fulfillment-Zeilen;
- Pickup verwendet privaten gehashten Einmal-Übergabecode;
- Code gültig 2 Stunden;
- maximal 8 Fehlversuche;
- Ersteller des Codes darf eigenen Code nicht bestätigen;
- zweite Partei bestätigt und erzeugt bilateralen Übergabenachweis;
- erfolgreicher Pickup finalisiert reservierte Listings;
- keine Payment-, Fee-, Wallet- oder Steuerwirkung.

### Tests

Echte PostgreSQL-Abnahme:

`tests/b07-c2c-postgres-regression.sql`

ist ein Wrapper und lädt:

1. `tests/b07-c2c-postgres-regression-base.sql`
2. `database/b07-l07-01-c2c-swap-v1-pickup.sql`
3. `tests/b07-c2c-pickup-postgres-regression.sql`

Damit war die C2C-Pickup-Migration im erfolgreichen `quota_database`-Job von Run #403 tatsächlich enthalten.

Separater statischer Contract-Test existiert:

`tests/b07-c2c-pickup-contract-test.mjs`

**Offen:** Dieser separate Test wird im aktuellen Workflow noch nicht explizit im `validate`-Job aufgerufen. Das ist der nächste kleine CI-Hardening-Schritt.

---

## 10. C2C real PostgreSQL regression – geschlossen

Die frühere Lücke `C2C nur statisch/vertraglich getestet` ist **geschlossen**.

Der verpflichtende `quota_database`-Job verwendet PostgreSQL 17 und testet real:
- bilaterale Bindung;
- unveränderbare Revisionen;
- Reservierung;
- Referenzwerte;
- Trackingpflicht >25 EUR / optional <=25 EUR;
- Versandmarkierung;
- 14-Tage-Sperre bei ungetracktem Nicht-Erhalt;
- 7-Tage-Problemfristen;
- Problemantwort;
- Problemrücknahme;
- Rückkehr zu `bound`;
- beidseitige Empfangsbestätigung;
- Abschluss/Finalisierung der Listings;
- Pickup-Revision;
- Versand<->Pickup-Moduswechsel erzeugt neue Revision;
- alter Confirmationsstand leakt nicht;
- Pickup ohne Versandadressen/Fulfillment;
- 2h-Code;
- Fremdpartei-Bestätigung;
- Fehlversuchszähler;
- Pickup-Abschluss.

Letzter bestätigter realer DB-Lauf: Run #403 / `quota_database` SUCCESS.

---

## 11. Bereits geschlossene B07-Bereiche – nicht erneut bearbeiten

Nicht ohne neuen konkreten Befund wiederholen:

- Release-1 Eligibility / Deutschland-only / 18+ / Accountpflicht;
- Anti-Circumvention-Grundguard;
- Preisangebot -> 2h Reservierung statt Vertrag;
- Browser-Hänger durch `trade-offer-checkout.js` MutationObserver – geschlossen;
- Release-1 Versandmodell Entscheidung /54;
- Trackingpflicht >25 EUR / Risikoflag;
- Owner-Zustellprüfung;
- 72h-Order-Lifecycle;
- ungetrackter Order-Abschluss nach 40 Tagen;
- Versandfrist-Trigger INSERT/UPDATE-Hardening;
- Order-Pickup-Einmalcode;
- C2C bilaterale Revision/Bindung;
- C2C Problemfälle;
- C2C reale PostgreSQL-Regressionsbasis;
- C2C revisionsgebundene Abholung DB + UI + echter PostgreSQL-Test;
- Seller cancellation technische Kategorie-B-Grenze;
- Blind Reviews Grundmodell;
- Public Listing Share Grundmodell;
- B01–B04;
- GitHub `main`-Ruleset.

---

## 12. Main-Schutz / Release-Governance

Ruleset: `Protect main`

ID: `23447544`

Aktiv:
- PR-Pflicht;
- Required Checks `validate` und `quota_database`;
- Force-Push gesperrt;
- Delete gesperrt;
- keine Bypass-Regeln.

PR #5 bleibt Draft und darf nicht gemergt werden.

---

## 13. Category-C / externe Freigaben bleiben deaktiviert

Nicht produktiv aktivieren:
- Stripe Live;
- reale Zahlungen;
- reale Refunds;
- reale Auszahlungen;
- reale Provider-Holds;
- 4-%-Stornogebühr;
- automatische Sanktionen;
- finale AGB-/TRADE-Neuakzeptanz;
- finale PStTG-/DAC7-Einordnung des Tauschs;
- steuerliche Übernahme von Tauschwerten;
- finale B2C-Verbraucherrechtsdarstellung;
- produktive Identitäts-/Altersprüfung;
- finale Bewertungsmoderation.

Der Nutzer hat entschieden, die interne B07-Arbeit im Chat weiterzuführen. Anwalt/Steuerberater sind kein technischer Blocker für die interne Entwicklung; externe Schlussprüfung bleibt jedoch Gate vor kommerziellem Produktivstart.

---

## 14. Dokumente mit teilweise überholtem Detailstand

`DUELVANTA_B07_IMPLEMENTATION_STATUS_2026-09-16.md` wurde vor den jüngsten C2C-Problem-/Pickup-Härtungen geschrieben und ist in diesen Detailpunkten nicht vollständig aktuell.

Der zentrale Prüfkatalog `DUELVANTA_B07_L07-01_REVIEW_CATALOG_2026-09-15.md` enthält die verbindlichen Geschäftsmodellentscheidungen, wurde aber noch nicht vollständig auf den neuesten technischen Implementierungsstand nach Entscheidung /54 und den jüngsten C2C-Commits nachgezogen.

Bei Widerspruch gilt:

**dieses Masterhandout V15 + die expliziten Entscheidungsdokumente + der tatsächliche Repository-Code/CI-Stand.**

---

## 15. Exakter Arbeitsauftrag für den nächsten Chat

Arbeite **ausschließlich an B07** auf `marketplace-ux-v1`.

Reihenfolge:

1. **CI-Hardening C2C-Pickup schließen**
   - `tests/b07-c2c-pickup-contract-test.mjs` explizit in den bestehenden `validate`-Block `Trade contracts and mobile order flow` aufnehmen.
   - Keine neue Workflow-Datei anlegen.
   - Keine unnötigen zusätzlichen Tests oder Deployments erzeugen.
   - CI abwarten und `validate` + `quota_database` bestätigen.

2. **C2C-Stack auf Staging aktivieren – nur wenn Schritt 1 grün ist**
   - Projekt ausschließlich `xhmjxrcskfhbovhitdej`.
   - Reihenfolge exakt:
     1. `database/b07-l07-01-c2c-swap-v1-schema.sql`
     2. `database/b07-l07-01-c2c-swap-v1-binding.sql`
     3. `database/b07-l07-01-c2c-swap-v1-fulfillment.sql`
     4. `database/b07-l07-01-c2c-swap-v1-problems.sql`
     5. `database/b07-l07-01-c2c-swap-v1-pickup.sql`
   - vorher Abhängigkeiten prüfen;
   - keine Produktion;
   - keine Payment-/PStTG-Aktivierung.

3. **Staging-C2C-Abnahme**
   - Browserrollen/RPC-Rechte prüfen;
   - private Tabellenrechte für `anon/authenticated` müssen entzogen bleiben;
   - zwei private DE-Testnutzer: Proposal -> Revision -> beidseitige Bestätigung -> Versand bzw. Pickup;
   - Problemfall 14 Tage / 7 Tage gezielt prüfen;
   - Pickup: 2h-Code / andere Partei / Versuchslimit / Abschluss;
   - Testdaten sauber markieren bzw. rollbacken, wo sinnvoll.

4. **Vercel erst nach Free-Limit-Reset**
   - nicht vorher weiter deployen;
   - danach genau einen aktuellen Preview-Stand prüfen;
   - browserseitig C2C Versand + Problemfall + Pickup gegen Staging abnehmen.

5. **B07-Dokumentation aktualisieren**
   - `DUELVANTA_B07_IMPLEMENTATION_STATUS_2026-09-16.md` nachziehen;
   - `DUELVANTA_B07_L07-01_REVIEW_CATALOG_2026-09-15.md` technische Checklist korrigieren;
   - keine Kategorie-C-Punkte als freigegeben markieren.

6. **Danach B07-Re-Review**
   - reale verbleibende A/B/C/D-Befunde auflisten;
   - keine pauschale Aussage `B07 vollständig freigegeben`, solange externe Kategorie-C-Gates bestehen;
   - erst nach technischer Abschlussprüfung neues Masterhandout erzeugen.

---

## 16. Arbeitsweise / Budgetschutz

- Compact Development Mode beibehalten.
- Keine Wiederholung bereits grüner Tests ohne neue Codeänderung.
- Keine Vercel-Deployments bis Limit-Reset.
- Änderungen möglichst als abgeschlossene, kleine Blöcke committen; nicht für jeden Diagnosegedanken einen Commit erzeugen.
- Keine Login-/Browser-Schleifen.
- Erst vorhandene Repository-/DB-Fakten lesen, dann ändern.
- Keine stillen Produktentscheidungen erfinden; bestehende Entscheidungen verwenden.

---

## 17. Kurzstatus für sofortigen Einstieg

**Technischer Stand:** Release-1-Order-Versandmodell gehärtet; C2C Binding + Versand + Problems + Pickup implementiert; echter PostgreSQL-17-C2C-Gesamttest grün; UI enthält Versand/Pickup-Auswahl und Pickup-Codeflow; C2C noch nicht auf Supabase-Staging aktiviert.

**Nächster konkrete Schritt:** `tests/b07-c2c-pickup-contract-test.mjs` in den bestehenden `validate`-Job aufnehmen und CI grün bestätigen. Danach vollständigen C2C-Stack kontrolliert auf Staging anwenden und dort abnehmen.

**Unverändert verboten:** `main`, Produktion, Merge, Stripe Live, echte Zahlungen/Refunds/Payouts, produktive PStTG-/Sanktions-/AGB-Aktivierung.