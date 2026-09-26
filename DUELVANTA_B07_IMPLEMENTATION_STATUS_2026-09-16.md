# DUELVANTA – B07 Implementierungsstatus und External-Review-Ledger

Stand: 16.09.2026  
Grundlage: `DUELVANTA_MASTERHANDOUT_V15_2026-09-16.md`, `DUELVANTA_B07_L07-01_REVIEW_CATALOG_2026-09-15.md`, Entscheidung L07-01/54, Repository-Code, CI und Supabase-Staging-Abnahme.

## Zweck

Dieses Dokument beschreibt den aktuellen technischen B07-Stand. Es ist **keine Rechts-, Steuer- oder Paymentfreigabe** und ersetzt keine externe Prüfung. Kategorie-C-Punkte bleiben technisch deaktiviert oder auf `external_review_required` begrenzt.

## Aktueller technischer Checkpoint

Entwicklungsbranch: `marketplace-ux-v1`

Technischer Head nach C2C-Staging-Kompatibilitätskorrektur:

`de8fcb12e790a09f0e2bf10f3d49009dab49e294`

Produktions-`main` bleibt unverändert:

`50f88213571be13255bb52eb489cc28cca660001`

PR #5 bleibt offen, Draft und nicht gemergt.

### CI

GitHub Actions `Scanner V16 Check` Run #411 / Run-ID `35089710430`:
- Gesamt: **SUCCESS**
- `validate`: **SUCCESS**
- `Trade contracts and mobile order flow`: **SUCCESS**
- `quota_database`: **SUCCESS**
- realer PostgreSQL-17-C2C-Gesamttest: **SUCCESS**
- separater `tests/b07-c2c-pickup-contract-test.mjs` läuft nun explizit im bestehenden `validate`-Block.

Der CI-Fixture bildet seit diesem Stand das reale Staging-`market_offers`-Schema ohne die zuvor künstlich vorhandene Spalte `reservation_expires_at` ab.

## Phase-3-Implementierung – Kategorie B

### Release-1 Eligibility / Deutschland-only / Anti-Circumvention

Implementiert:
- registrierte TRADE-Nutzung ab 18 Jahren und Wohnsitz Deutschland;
- private Käufereigenschaft getrennt von allgemeiner TRADE-/Seller-Berechtigung;
- DE-only-Grenzen in Seller-, Listing-, Deal- und Adresspfaden;
- technische Guards gegen öffentliche Kontakt-/Off-Platform-Zahlungsdaten vor Bindung.

Für den C2C-Staging-Stack wurde die tatsächlich benötigte Eligibility-Kernabhängigkeit persistent aktiviert. Der C2C-Stack setzt damit serverseitig `private + active + DE + 18+` voraus. Diese Aktivierung erweitert keine Payment-, PStTG- oder Sanktionswirkung.

### Preisvorschlag / 2-Stunden-Checkout-Reservierung

Implementiert:
- Verkäuferannahme erzeugt nur eine 2-Stunden-Reservierung;
- keine Order, kein Deal und kein Vertrag allein durch Angebotsannahme;
- Käufer muss den separaten verbindlichen Checkout ausführen;
- Ablauf gibt reservierte Menge wieder frei;
- parallele/Legacy-Deal-Erzeugung während Reservierung wird serverseitig blockiert.

### Versand / Delivery / persönliche Abholung

Implementiert:
- Trackingpflicht über 25 EUR bzw. bei Risikoflag;
- 3-Werktage-Versandfrist ab bestätigtem zahlungsrelevantem Ereignis;
- 72-Stunden-technischer Abschluss nach serverseitigem Zustellnachweis ohne offenen Problemfall;
- explizite Käuferaktion `Erhalten – alles in Ordnung`;
- persönliche Übergabe mit einmaligem, gehashtem Übergabecode und Versuchslimit;
- 7-Tage-Antwort-/Nachweisfristen;
- private C2C-Nicht-Erhalt-Regel bei ungetracktem Versand frühestens nach 14 Tagen;
- kein realer Payout-/Refund-Trigger.

### Privater C2C-Tausch

Implementiert:
- nur private, aktive, DE-berechtigte Nutzer;
- Ware-gegen-Ware ohne Geldkomponente und ohne DUELVANTA-Tauschgebühr;
- Vorschläge/Gegenvorschläge bleiben unverbindlich;
- jede Änderung erzeugt eine neue unveränderbare Revision;
- verbindlich erst nach beidseitiger Bestätigung desselben Revisionshashs;
- `fulfillment_mode = shipping|pickup` ist Bestandteil des unveränderbaren Revisionsinhalts;
- Wechsel Versand ↔ Abholung erzeugt eine neue Revision und verwirft den alten Bestätigungsstand;
- Versand: 3-Werktage-Frist, eingefrorene deutsche Versandadressen, Tracking nach Referenzwert;
- Abholung: keine Versandfrist, keine Versandadress-/Fulfillment-Zeilen, gehashter Einmalcode, 2 Stunden Gültigkeit, maximal 8 Fehlversuche, Bestätigung ausschließlich durch die andere Partei;
- je Tauschseite unveränderbarer EUR-Referenzwert, Bewertungsquelle/-methode/-zeitpunkt und Hash;
- Referenzwert ist ausdrücklich **keine** aktivierte PStTG-/Steuerbuchung;
- `psttg_evaluation_status = external_review_required`;
- `psttg_event_created_by_b07 = false`;
- jeder Nutzer trägt seine eigenen Versandkosten.

### C2C-Problemfälle

Implementiert:
- Problemfall an konkrete Tauschsendung/Senderseite gebunden;
- Kategorien `shipping`, `not_received`, `damaged`, `not_as_described`, `other`;
- nur Teilnehmer dürfen öffnen/antworten/zurückziehen;
- offener Fall setzt Thread auf `disputed`;
- Antwortfrist 7 Tage;
- Nachweisfrist 7 Tage;
- ungetracktes `not_received` erst 14 Tage nach `shipped_at`;
- Rücknahme des einzigen offenen Falls setzt den Thread wieder auf `bound`;
- keine Refund-, Payout-, Gebühren- oder automatische Schuldwirkung.

### Verkäuferstorno

Implementiert:
- Käufer-Storno bleibt Anfrage;
- Verkäufer kann nach bereits bezahlt bestätigtem Kauf nicht den normalen freien Stornopfad nutzen;
- bezahlt ausgelöster Verkäuferstorno wird nur als begründeter `seller_exception`-Vorgang angenommen;
- Mindestsubstanz der Begründung wird serverseitig verlangt;
- Zurechenbarkeit bleibt `external_review_required`;
- 4-%-Stornogebühr bleibt `external_review_required_disabled`;
- keine automatische Gebühr, Sanktion oder Kontosperre.

### Bewertungen

Implementiert:
- transaktionsübergreifendes Modell für Kauf/Verkauf und C2C-Tausch;
- 1–5 Sterne, optionaler Kommentar;
- genau eine Bewertung pro Nutzer/Transaktion;
- nur nach tatsächlich abgeschlossenem Vorgang;
- 30-Tage-Abgabefrist;
- Blind Review: sichtbar nach beiden Bewertungen oder nach Fristablauf;
- Sterne/Kommentar nach Abgabe unveränderbar;
- Meldung sichtbarer Bewertungen möglich;
- Meldung wird nur mit `external_review_required` erfasst; keine automatische Moderationsentscheidung.

### Share / Public Listing

Implementiert:
- öffentliche Route `/listing/:id`;
- datensparsamer Public-RPC nur für aktive/verfügbare Listings;
- keine privaten Seller-, Adress-, Transaktions- oder Storage-Pfaddaten im Public-RPC;
- serverseitige OG-/Twitter-Produktmetadaten;
- Artikelbild nur über kurzlebige signierte Storage-URL; Branding-Fallback;
- Native Share mit Link-kopieren-Fallback;
- 1080×1920-Story-Karte ohne private Verkäuferdaten.

## Supabase-Staging – C2C persistent aktiviert

Projekt: `xhmjxrcskfhbovhitdej` / `DUELVANTA-STAGING`

Persistente B07-C2C-Migrationen auf Staging:
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

Der Stack wurde technisch in der V15-Reihenfolge aufgebaut; große Repository-Dateien mussten wegen Tool-Limits teilweise funktionsweise als getrennte Staging-Migrationen eingespielt werden. Die resultierenden Funktionen entsprechen dem Repository-Stand plus den beiden dokumentierten Staging-Kompatibilitätsfixes.

### Sicherheitsgrenzen auf Staging

Direkt nach Aktivierung geprüft:
- zehn C2C-Privattabellen haben RLS aktiv;
- Tabellen-ACL jeweils nur `postgres`;
- `anon` und `authenticated` besitzen keinen direkten Tabellenzugriff;
- Browserzugriff erfolgt nur über die vorgesehenen participant-bound RPCs;
- keine C2C-RPC ist anonym freigegeben;
- keine Payment-/PStTG-Aktivierung durch C2C.

## Echte Staging-C2C-Abnahme

Alle folgenden Abnahmen wurden gegen das reale Staging-Schema ausgeführt und vollständig per `ROLLBACK` bereinigt.

### Versand – PASS

Geprüft:
- zwei private DE-Testnutzer;
- Proposal;
- Revision;
- beidseitige Bestätigung desselben Revisionsstands;
- Bindung;
- Versandmarkierung;
- beidseitige Empfangsbestätigung;
- technischer Abschluss.

Ergebnis: `PASS shipping rollback`.

### Problemfall – PASS

Geprüft:
- ungetrackter Versand;
- `not_received` vor 14 Tagen serverseitig blockiert;
- Öffnung nach simulierten 15 Tagen möglich;
- `response_due_at - created_at = 7 days`;
- `evidence_due_at - created_at = 7 days`;
- Problemantwort;
- Rücknahme;
- Rückkehr des Threads von `disputed` zu `bound`.

Ergebnis: `PASS problem rollback`.

### Pickup – PASS

Geprüft:
- Pickup-Revision;
- keine Versandfrist;
- keine Versandadress-Snapshots;
- keine Shipping-Fulfillment-Zeilen;
- gehashter Übergabecode;
- exakt 2 Stunden Gültigkeit;
- Codeersteller kann eigenen Code nicht bestätigen;
- 8 Fehlversuche werden gezählt;
- 9. Versuch wird serverseitig blockiert;
- neuer Code setzt Versuchszähler zurück;
- andere Partei bestätigt erfolgreich;
- Thread wird `completed`.

Ergebnis: `PASS pickup rollback`.

Nachkontrolle auf Staging:
- B07-Testlistings: `0`
- Swap-Threads aus den Rollback-Abnahmen: `0`
- Swap-Cases aus den Rollback-Abnahmen: `0`
- Pickup-Handovers aus den Rollback-Abnahmen: `0`

## Real-Staging-Befund und Korrektur

Die erste reale Staging-Abnahme deckte eine Abweichung des CI-Fixtures auf:

`public.market_offers.reservation_expires_at` existiert im tatsächlichen Staging-Schema nicht.

Der damalige C2C-Abschluss referenzierte diese künstlich im Test-Fixture vorhandene Spalte. Der Staging-Test brach transaktional ab; es blieb kein Testzustand zurück.

Korrektur im Repository:
- `database/b07-l07-01-c2c-swap-v1-completion-compat.sql`
- `database/b07-l07-01-c2c-swap-v1-pickup-completion-compat.sql`
- `tests/b07-c2c-staging-schema-overlay.sql`
- Wrapper `tests/b07-c2c-postgres-regression.sql` lädt das Overlay vor der C2C-Regression.

Danach Run #411 vollständig grün und alle drei realen Staging-Rollback-Abnahmen erfolgreich.

## Vercel-Preview / Browsernachweis

Aktuelles READY-Preview:
- Deployment: `dpl_HeGZoPnqAe9VxXCfeN2v6yRngws3`
- Branch: `marketplace-ux-v1`
- Commit: `de8fcb12e790a09f0e2bf10f3d49009dab49e294`

Nachweis:
- Vercel-Share-Zugriff funktioniert;
- DUELVANTA-`login.html` des aktuellen Previews wird ausgeliefert;
- Nutzer konnte den bestehenden privaten Staging-Testaccount `test-verkaeufer@duelvanta.de` erfolgreich im Preview anmelden;
- Supabase bestätigt dazu eine neue Staging-Auth-Session am 16.09.2026;
- der Account ist `private`, `active`, `DE`.

### Kategorie-D-Verifikationsrest

Ein vollständiger **browserseitiger Zwei-Rollen-C2C-E2E** wurde nicht künstlich erzwungen:
- im Staging existiert derzeit nur ein bereits freigegebener privater Verkäuferaccount mit verfügbarer Browseranmeldung;
- ein anderer vorhandener Testnutzer wird nicht per Roh-SQL oder direkter Auth-/Berechtigungsmanipulation zu einem C2C-Verkäufer hochgestuft;
- die funktionale Zwei-Parteien-Logik ist dagegen sowohl im echten PostgreSQL-17-CI als auch in drei realen Supabase-Staging-Rollback-Abnahmen grün.

Dieser Rest ist **Kategorie D / Verifikation**, kein aktuell nachgewiesener Kategorie-B-Codefehler. Er kann später mit zwei regulär onboardeten privaten Staging-Accounts browserseitig geschlossen werden.

## Kategorie C – verbindlicher External-Review-Ledger

Folgende Punkte sind **nicht freigegeben und nicht produktiv zu aktivieren**:

1. **Recht / Vertragsmodell**
   - finale Plattform-, Verkäufer-/TRADE-Bedingungen;
   - C2C/B2C-Vertragsschluss und Rückabwicklung;
   - zwingende B2C-Verbraucherinformationen und Widerrufs-/Gewährleistungsdarstellung;
   - rechtliche Wirkung von Zustell-, Übergabe- und Bestätigungsnachweisen.

2. **Payment**
   - Stripe Live / echte integrierte Zahlungen;
   - echte Refunds;
   - reale Auszahlungen und 72h-/Pickup-Payout-Freigabe;
   - echte Provider-Holds;
   - finale Gebühren-/Beleg-/Rechnungslogik.

3. **Verkäuferstorno / Sanktionen**
   - wirtschaftliche 4-%-Stornogebühr;
   - automatische Zurechenbarkeit;
   - 90-/14-/60-/180-Tage-Sanktionsleiter;
   - dauerhafte Sperren und schwere-Verstoß-Automatik.

4. **PStTG / DAC7 / Steuer**
   - rechtliche Einordnung von C2C-Tausch als relevante Tätigkeit/Vergütung im konkreten DUELVANTA-Modell;
   - verbindliche Wertermittlungsmethode für Tauschgeschäfte;
   - Übernahme von Tauschwerten in das bestehende PStTG-Ereignisledger;
   - Schwellen-/KYC-/TIN-Aufforderungs- und Sperrfolgen;
   - BZSt-XML-/Produktivmeldung.

5. **Identität / Bedingungen**
   - externer Identitäts-/Altersprovider;
   - produktive Identitätsfreigabe;
   - zentrale erzwungene Neuakzeptanz bei materiellen Bedingungsänderungen.

6. **Bewertungen / Moderation**
   - öffentliche Durchschnittsdarstellung und Mindestanzahl;
   - Löschung, Berichtigung, Gegendarstellung;
   - Moderationsentscheidung und Beschwerdeverfahren.

7. **Versand / Risiko**
   - konkrete zugelassene Versandprodukte;
   - Haftungs-/Versicherungsgrenzen für höherwertige Bestellungen;
   - finale Risikokriterien für erzwungenes Tracking.

## B07-Re-Review – aktueller A/B/C/D-Befund

### Kategorie A – bestehende belastbare Architektur

Weiter verwendbar und ohne neuen Befund:
- Sellerstatus-/Identitätsgrundlage;
- Checkout-/Contract-Snapshot-Grundarchitektur;
- transaktionsbezogene Problemstruktur;
- bestehende Shipping-/Order-Grundmodelle;
- GitHub-Main-Schutz und Required Checks.

### Kategorie B – intern technisch korrigierbare Befunde

**Kein aktuell offener konkreter Kategorie-B-Befund aus dem V15-Arbeitsauftrag.**

Die beim realen Staging-Test entdeckte `reservation_expires_at`-Abweichung wurde korrigiert, regressionsgetestet und auf Staging nachgezogen.

### Kategorie C – externe Freigaben

Bleibt offen wie oben dokumentiert. Diese Punkte blockieren den kommerziellen Produktivstart, nicht die interne B07-Entwicklung und Staging-Prüfung.

### Kategorie D – Verifikation / Evidenz

Offen:
- browserseitiger Zwei-Rollen-C2C-E2E mit zwei regulär onboardeten privaten Staging-Accounts für Versand + Problemfall + Pickup.

Bereits geschlossen:
- separate Pickup-Contract-Prüfung im `validate`-Job;
- realer PostgreSQL-C2C-Gesamttest;
- vollständiger C2C-Stack auf Supabase-Staging;
- Staging-RPC-/RLS-/Privilegienprüfung;
- echte Staging-Rollback-Abnahme für Versand, Problemfall und Pickup;
- aktuelles READY-Vercel-Preview und erfolgreicher DUELVANTA-Staging-Login.

## Verbindliche Statusaussage

B07 ist **intern technisch weitgehend geschlossen**, mit einem verbleibenden Kategorie-D-Browser-Evidenzpunkt. Kategorie C bleibt bewusst offen und extern freigabepflichtig.

Es darf **nicht** behauptet werden:
- `B07 vollständig freigegeben`;
- `rechtlich freigegeben`;
- `steuerlich freigegeben`;
- `Stripe/Payment produktionsbereit`.

## Sicherheitsgrenzen

- `main` unverändert lassen.
- Produktion unverändert lassen.
- PR #5 Draft und nicht mergen.
- kein Stripe Live;
- keine reale Zahlung, Auszahlung oder Erstattung;
- keine produktive PStTG-/Sanktions-/AGB-Aktivierung;
- keine künstliche Berechtigungseskalation von Staging-Nutzern nur zur Browserabnahme.

## Nächster B07-Schritt

Nur noch:
1. Kategorie-D-Browser-E2E mit zwei regulär onboardeten privaten Staging-Accounts schließen, sobald zwei nutzbare Testanmeldungen vorhanden sind;
2. danach B07 intern technisch als `A/B geschlossen, D geschlossen, C extern offen` dokumentieren;
3. kommerzieller Produktivstart bleibt bis externer Rechts-/Steuer-/Paymentfreigabe gesperrt.
