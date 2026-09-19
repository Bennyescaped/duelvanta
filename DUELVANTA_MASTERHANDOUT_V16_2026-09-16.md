# DUELVANTA – Masterhandout V16

Stand: 16.09.2026  
Status: **verbindlicher Übergabestand für die Weiterarbeit ausschließlich an B07**

V16 ersetzt widersprechende ältere Statusangaben aus V15 und früheren Masterhandouts. Es basiert auf der abgeschlossenen CI-Härtung, dem persistent aktivierten C2C-Staging-Stack, den realen Staging-Rollback-Abnahmen und dem anschließenden B07-A/B/C/D-Re-Review.

Dieses Dokument ist **keine Rechts-, Steuer- oder Paymentfreigabe**.

---

## 1. Verbindlicher Repository-Stand

Repository: `Bennyescaped/duelvanta`

Entwicklungsbranch: `marketplace-ux-v1`

Technischer App-/Code-Checkpoint:

`de8fcb12e790a09f0e2bf10f3d49009dab49e294`

Nach diesem technischen Checkpoint folgten ausschließlich B07-Dokumentationscommits:
- `7bc3ee4555b3b539f77710a8b4a6f95cc1cd1628` – Implementierungsstatus nachgezogen;
- `a532908527128a323699c18314b2daf0c745a26f` – L07-01-Prüfkatalog nachgezogen;
- `55c713966e29208fdc504716ad585710a8afb0ce` – A/B/C/D-Re-Review dokumentiert.

Produktions-`main`:

`50f88213571be13255bb52eb489cc28cca660001`

PR #5:
- offen;
- Draft;
- nicht gemergt;
- Base `main`;
- Head `marketplace-ux-v1`.

**Verbindliche Grenze:** `main`, Produktion und Stripe Live nicht verändern. Kein Merge. Keine echten Zahlungen, Refunds, Payouts oder produktiven PStTG-/Sanktions-/AGB-Aktivierungen.

---

## 2. Letzter verbindlicher technischer CI-Stand

GitHub Actions Workflow: `Scanner V16 Check`

Run #411 / Run-ID `35089710430` auf technischem Checkpoint `de8fcb12e790a09f0e2bf10f3d49009dab49e294`:

- Gesamt: **SUCCESS**
- `validate`: **SUCCESS**
- `Trade contracts and mobile order flow`: **SUCCESS**
- `quota_database`: **SUCCESS**
- reale PostgreSQL-17-C2C-Regression: **SUCCESS**
- separater `tests/b07-c2c-pickup-contract-test.mjs`: explizit im bestehenden `validate`-Block enthalten und grün.

Keine erneute Ausführung dieser unveränderten grünen Tests nur wegen Dokumentationscommits erforderlich.

---

## 3. CI-Hardening C2C-Pickup – geschlossen

V15-Auftrag Schritt 1 ist erledigt.

Änderung:
- `tests/b07-c2c-pickup-contract-test.mjs` wurde in den bestehenden Workflow-Schritt `Trade contracts and mobile order flow` aufgenommen.
- keine neue Workflow-Datei.

Erster Lauf deckte eine zu enge statische Contract-Erwartung auf. Der Contract-Test wurde an die tatsächlich vorhandene äquivalente Pickup-Guard-Implementierung angepasst.

Danach Run #407 grün; spätere reale Staging-Schema-Härtung führte zu Run #411, ebenfalls vollständig grün.

---

## 4. Real-Staging-Schema-Befund – geschlossen

Die erste echte Supabase-Staging-Abnahme fand einen zuvor vom CI-Fixture verdeckten Unterschied:

`public.market_offers.reservation_expires_at` existiert im realen Staging-Schema nicht.

Der frühere C2C-Abschluss referenzierte diese nur im CI-Bootstrap vorhandene Spalte.

Korrektur im Repository:
- `database/b07-l07-01-c2c-swap-v1-completion-compat.sql`
- `database/b07-l07-01-c2c-swap-v1-pickup-completion-compat.sql`
- `tests/b07-c2c-staging-schema-overlay.sql`
- `tests/b07-c2c-postgres-regression.sql` lädt das reale Staging-Schema-Overlay.

Neue konservative Regel:
- vollständig reservierte C2C-Listings werden beim Abschluss nicht finalisiert, solange ein akzeptiertes Angebot ohne zugehörigen Deal existiert;
- keine Abhängigkeit mehr von einer nicht existierenden Ablaufspalte.

Run #411 bestätigt den Fix.

---

## 5. Supabase-Staging – C2C-Stack persistent aktiviert

Staging-Projekt:

`xhmjxrcskfhbovhitdej` / `DUELVANTA-STAGING`

V15-Auftrag Schritt 2 ist erledigt.

Aktivierte Migrationen:
- `b07_c2c_eligibility_dependency_v1`
- `b07_l07_01_c2c_swap_v1_schema`
- `b07_l07_01_c2c_swap_v1_binding`
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

Die großen Repository-Dateien wurden aufgrund Tool-Request-Limits teilweise funktionsweise als getrennte Staging-Migrationen ausgeführt. Fachliche Reihenfolge und resultierende Funktionen entsprechen dem Repository-Stack plus den dokumentierten Kompatibilitätsfixes.

### Staging-Sicherheitsgrenzen bestätigt

Alle zehn C2C-Privattabellen:
- RLS aktiv;
- direkte Tabellen-ACL nur `postgres`;
- keine direkten Tabellenrechte für `anon` oder `authenticated`.

Browserzugriff erfolgt ausschließlich über die vorgesehenen participant-bound RPCs.

Keine anonym freigegebene C2C-RPC festgestellt.

---

## 6. Echte Staging-C2C-Abnahme – geschlossen

V15-Auftrag Schritt 3 ist datenbank-/RPC-seitig vollständig erledigt.

Alle Tests liefen gegen das echte Staging-Schema und wurden vollständig per `ROLLBACK` bereinigt.

### Versand – PASS

Geprüft:
- zwei private DE-Testnutzer;
- Proposal;
- Revision;
- beidseitige Bestätigung;
- Bindung;
- Versandmarkierung;
- beidseitige Empfangsbestätigung;
- technischer Abschluss.

Ergebnis: `PASS shipping rollback`.

### Problemfall – PASS

Geprüft:
- ungetracktes `not_received` vor 14 Tagen blockiert;
- nach simulierten 15 Tagen erlaubt;
- 7-Tage-Antwortfrist;
- 7-Tage-Nachweisfrist;
- Antwort;
- Rücknahme;
- `disputed -> bound`.

Ergebnis: `PASS problem rollback`.

### Pickup – PASS

Geprüft:
- Pickup-Revision;
- keine Versandfrist;
- keine Shipping-Address-Snapshots;
- keine Shipping-Fulfillment-Zeilen;
- gehashter Einmalcode;
- exakt 2 Stunden Gültigkeit;
- eigener Code nicht selbst bestätigbar;
- 8 Fehlversuche gezählt;
- 9. Versuch blockiert;
- neuer Code setzt Versuchszähler zurück;
- Fremdpartei bestätigt;
- Thread `completed`.

Ergebnis: `PASS pickup rollback`.

Nachkontrolle:
- B07-Testlistings: `0`
- Swap-Threads aus Abnahme: `0`
- Swap-Cases aus Abnahme: `0`
- Pickup-Handovers aus Abnahme: `0`

---

## 7. Vercel / Preview – aktueller Stand

Funktional geprüfter App-Codecheckpoint:

`de8fcb12e790a09f0e2bf10f3d49009dab49e294`

Dessen READY-Deployment:

`dpl_HeGZoPnqAe9VxXCfeN2v6yRngws3`

Danach erzeugte Vercel automatisch weitere READY-Previews für reine Dokumentationscommits. Letzter vor V16 dokumentierter READY-Stand:

- Deployment `dpl_GuGQoEXoh2PLuNNezwsiUWuVu3ye`
- Commit `55c713966e29208fdc504716ad585710a8afb0ce`
- nur Dokumentationsänderung gegenüber dem technischen App-Codecheckpoint.

Es wurde kein zusätzlicher manueller Deploy ausgelöst.

### Preview-Zugang

Bestätigt:
- Vercel-Share-Link erreicht das Preview;
- DUELVANTA-`login.html` wird ausgeliefert;
- Nutzer konnte `test-verkaeufer@duelvanta.de` erfolgreich anmelden;
- Supabase-Staging bestätigte die neue Auth-Session;
- Accountstatus: `private`, `active`, `DE`.

---

## 8. Verbleibender Kategorie-D-Punkt

Ein vollständiger **browserseitiger Zwei-Rollen-C2C-E2E** bleibt offen:
- Proposal;
- Revision;
- beide Bestätigungen;
- Versand / Empfang;
- Problemfall;
- Pickup-Codeflow;

mit zwei **regulär onboardeten privaten Staging-Accounts**, die beide browserseitig nutzbar sind.

Aktuell existiert nur ein bereits freigegebener privater Staging-Verkäufer mit verfügbarer Browseranmeldung.

Verbindliche Grenze:
- keinen anderen vorhandenen Testnutzer per Roh-SQL, Auth-Tabellenmanipulation oder künstlicher Berechtigungseskalation nur für diesen Test zum C2C-Verkäufer machen;
- kein Passwort aus Auth-Tabellen setzen oder rekonstruieren;
- stattdessen später zweiten regulären privaten Staging-Testaccount über den normalen Onboardingpfad bereitstellen.

Dieser Punkt ist **Kategorie D / Evidenz**, kein aktuell nachgewiesener Kategorie-B-Codefehler.

---

## 9. B07-Re-Review – verbindliches Ergebnis

Dokument:

`DUELVANTA_B07_RE_REVIEW_2026-09-16.md`

### Kategorie A

**geschlossen / weiterverwendbar**

Kein neuer Befund in bestehender Architektur.

### Kategorie B

**geschlossen**

Kein aktuell offener konkreter technischer Codebefund aus dem V15-Arbeitsauftrag.

Der während der realen Staging-Abnahme entdeckte Schemafehler wurde korrigiert, regressionsgetestet und auf Staging nachgezogen.

### Kategorie C

**extern offen**

Rechts-, Steuer-, Payment-, PStTG-, Identitäts-, Sanktions-, Moderations- und finale Versand-/Risikofreigaben bleiben extern.

### Kategorie D

**ein Evidenzpunkt offen**

Nur der browserseitige Zwei-Rollen-C2C-E2E mit zwei regulär onboardeten privaten Staging-Accounts.

Verbindliche Kurzform:

**A geschlossen / B geschlossen / C extern offen / D Browser-Evidenz offen.**

---

## 10. Kategorie C – weiterhin strikt deaktiviert

Nicht produktiv aktivieren:
- Stripe Live;
- reale Zahlungen;
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
- finale Versandprodukte, Haftungs-/Versicherungsgrenzen und Risikokriterien.

Anwalt/Steuerberater sind kein technischer Blocker für interne Staging-Entwicklung. Sie bleiben Gate vor kommerziellem Produktivstart.

---

## 11. Aktualisierte B07-Dokumente

Verbindlich nachgezogen:
- `DUELVANTA_B07_IMPLEMENTATION_STATUS_2026-09-16.md`
- `DUELVANTA_B07_L07-01_REVIEW_CATALOG_2026-09-15.md`
- `DUELVANTA_B07_RE_REVIEW_2026-09-16.md`

Bei Widerspruch mit älteren Detailständen gilt:

**V16 + die expliziten Entscheidungsdokumente + aktueller Repository-Code + bestätigter Staging-/CI-Stand.**

---

## 12. Bereits geschlossene Bereiche – nicht erneut bearbeiten

Nicht ohne neuen konkreten Befund wiederholen:
- B01–B04;
- GitHub-Main-Ruleset;
- Release-1 Eligibility-Grundmodell;
- Anti-Circumvention-Grundguard im Repository;
- Preisangebot → 2h-Reservierung;
- Shipping-/Delivery-Entscheidung /54;
- Tracking >25 EUR / optional <=25 EUR;
- Owner-Zustellprüfung;
- 72h-Lifecycle;
- ungetrackter Order-Abschluss 40 Tage;
- Versandfrist-Hardening;
- Order-Pickup;
- C2C Revision/Binding;
- C2C Versand;
- C2C Problems;
- C2C Pickup;
- C2C PostgreSQL-Regression;
- C2C Pickup-Contract-CI-Hardening;
- C2C-Stack-Aktivierung auf Staging;
- Staging-RLS-/ACL-Prüfung;
- reale Staging-Rollback-Abnahme Versand/Problem/Pickup;
- `reservation_expires_at`-Staging-Kompatibilitätsfix;
- Seller-Cancellation Kategorie-B-Grenze;
- Blind Reviews Grundmodell;
- Public Listing Share Grundmodell.

---

## 13. Exakter Arbeitsauftrag für den nächsten Chat

Arbeite **ausschließlich an B07** auf `marketplace-ux-v1`.

### Priorität 1 – Kategorie D schließen, aber nur sauber

Nur wenn zwei regulär onboardete private Staging-Accounts mit nutzbaren Browseranmeldungen vorhanden sind:

1. aktuelles READY-Preview verwenden;
2. keine Produktion;
3. keine Stripe-/Payment-Aktion;
4. zwei Browserrollen / zwei Sessions verwenden;
5. C2C Versand browserseitig prüfen:
   - Proposal;
   - Revision;
   - beide Bestätigungen;
   - Versand;
   - Empfang;
6. Problemfall prüfen:
   - sichtbare 14-Tage-Grenze bei ungetracktem `not_received`;
   - Antwort-/Nachweisstatus;
7. Pickup prüfen:
   - Pickup-Revision;
   - Codeerzeugung;
   - Fremdpartei-Bestätigung;
   - Abschluss;
8. Testdaten danach bereinigen.

### Wenn kein zweiter regulärer privater Testaccount verfügbar ist

- **nicht** Berechtigungen per Roh-SQL eskalieren;
- **nicht** Auth-Passwörter manipulieren;
- Kategorie D offen dokumentiert lassen;
- keine bereits grünen DB-/CI-Tests wiederholen;
- auf einen regulär onboardeten zweiten Staging-Testaccount warten bzw. diesen über den normalen Produkt-Onboardingpfad erzeugen, sobald ein nutzbares Test-Login verfügbar ist.

### Danach

Wenn Kategorie D erfolgreich geschlossen wurde:
- `DUELVANTA_B07_RE_REVIEW_2026-09-16.md` nachziehen;
- Implementierungsstatus und Prüfkatalog auf `D geschlossen` setzen;
- neues Masterhandout erzeugen;
- Kategorie C weiterhin offen lassen.

Wenn Kategorie D nicht geschlossen werden kann, ist **kein weiterer Kategorie-B-Codechange allein deswegen erforderlich**.

---

## 14. Arbeitsweise / Budgetschutz

- Compact Development Mode beibehalten.
- keine Wiederholung grüner Tests ohne Codeänderung;
- keine unnötigen Vercel-Deployments;
- automatische Vercel-Dokumentationsdeployments nicht als neue App-Abnahme behandeln;
- keine Login-Schleifen;
- keine stillen Produktentscheidungen;
- keine Auth-/Berechtigungsmanipulation nur zum Testen;
- Category-C-Gates nicht technisch umgehen.

---

## 15. Kurzstatus

**Technischer B07-Stand:** C2C Binding + Versand + Problemfälle + Pickup implementiert, CI grün, vollständiger C2C-Stack auf Supabase-Staging aktiv, reale Staging-Rollback-Abnahmen grün, realer Schemafehler behoben.

**Re-Review:** A geschlossen / B geschlossen / C extern offen / D browserseitiger Zwei-Rollen-Evidenzpunkt offen.

**Nächster konkrete Schritt:** Nur noch Zwei-Rollen-Browser-E2E mit zwei regulär onboardeten privaten Staging-Testaccounts, sobald beide Browserlogins verfügbar sind.

**Unverändert verboten:** `main`, Produktion, Merge, Stripe Live, echte Zahlungen/Refunds/Payouts, produktive PStTG-/Sanktions-/AGB-Aktivierung.
