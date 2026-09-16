# DUELVANTA – B07 Implementierungsstatus und External-Review-Ledger

Stand: 16.09.2026  
Grundlage: `DUELVANTA_MASTERHANDOUT_V14_2026-09-15.md`, `DUELVANTA_B07_L07-01_REVIEW_CATALOG_2026-09-15.md`, Soll-Ist-Abgleich und Entscheidungen L07-01/01–/53.

## Zweck

Dieses Dokument konsolidiert Phase 4 und Phase 6 des V14-Arbeitsauftrags. Es ist **keine Rechts-, Steuer- oder Paymentfreigabe** und ersetzt keine externe Prüfung. Kategorie-C-Punkte bleiben technisch deaktiviert oder auf Reviewstatus begrenzt.

## Phase-3-Implementierung – Kategorie B

### Release-1 Eligibility / Deutschland-only / Anti-Circumvention

Implementiert:
- registrierte TRADE-Nutzung ab 18 Jahren und Wohnsitz Deutschland;
- private Käufereigenschaft getrennt von allgemeiner TRADE-/Seller-Berechtigung;
- DE-only-Grenzen in Seller-, Listing-, Deal- und Adresspfaden;
- technische Guards gegen öffentliche Kontakt-/Off-Platform-Zahlungsdaten vor Bindung.

Rationale: Release-1-Scope technisch erzwingen, ohne externe Identitätsprovider oder materielle AGB-Neuakzeptanz zu aktivieren.

### Preisvorschlag / 2-Stunden-Checkout-Reservierung

Implementiert:
- Verkäuferannahme erzeugt nur eine 2-Stunden-Reservierung;
- keine Order, kein Deal und kein Vertrag allein durch Angebotsannahme;
- Käufer muss den separaten verbindlichen Checkout ausführen;
- Ablauf gibt reservierte Menge wieder frei;
- parallele/Legacy-Deal-Erzeugung während Reservierung wird serverseitig blockiert.

Rationale: Verhandlung und Vertragsschluss technisch eindeutig trennen.

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

Rationale: technische Transaktionszustände und Fristen abbilden, Geldbewegung aber bis zur externen Paymentfreigabe strikt getrennt halten.

### Privater C2C-Tausch

Implementiert:
- nur private, aktive, DE-berechtigte Nutzer;
- Ware-gegen-Ware ohne Geldkomponente und ohne DUELVANTA-Tauschgebühr;
- Vorschläge/Gegenvorschläge bleiben unverbindlich;
- jede Änderung erzeugt eine neue unveränderbare Revision;
- verbindlich erst nach beidseitiger Bestätigung desselben Revisionshashs;
- 3-Werktage-Versandfrist ab Bindung;
- eingefrorene deutsche Versandadressen erst ab Bindung;
- je Tauschseite unveränderbarer EUR-Referenzwert, Bewertungsquelle/-methode/-zeitpunkt und Hash;
- Referenzwert ist ausdrücklich **keine** aktivierte PStTG-/Steuerbuchung;
- `psttg_evaluation_status = external_review_required`;
- `psttg_event_created_by_b07 = false`;
- Tracking bei unbekanntem oder >25-EUR-Referenzwert;
- jeder Nutzer trägt seine eigenen Versandkosten.

Rationale: vollständiger technischer Tauschflow plus auditierbare Wertegrundlage, ohne steuerliche Klassifikation oder Gebührenwirkung vorwegzunehmen.

### Verkäuferstorno

Implementiert:
- Käufer-Storno bleibt Anfrage;
- Verkäufer kann nach bereits bezahlt bestätigtem Kauf nicht den normalen freien Stornopfad nutzen;
- bezahlt ausgelöster Verkäuferstorno wird nur als begründeter `seller_exception`-Vorgang angenommen;
- Mindestsubstanz der Begründung wird serverseitig verlangt;
- Zurechenbarkeit bleibt `external_review_required`;
- 4-%-Stornogebühr bleibt `external_review_required_disabled`;
- keine automatische Gebühr, Sanktion oder Kontosperre.

Rationale: beschlossene Produktgrenze technisch erzwingen, ohne Kategorie-C-Sanktions-/Gebührenfolgen zu aktivieren.

### Bewertungen

Implementiert:
- neues transaktionsübergreifendes Modell für Kauf/Verkauf und C2C-Tausch;
- 1–5 Sterne, optionaler Kommentar;
- genau eine Bewertung pro Nutzer/Transaktion;
- nur nach tatsächlich abgeschlossenem Vorgang;
- 30-Tage-Abgabefrist;
- Blind Review: sichtbar nach beiden Bewertungen oder nach Fristablauf;
- Sterne/Kommentar nach Abgabe unveränderbar;
- Meldung sichtbarer Bewertungen möglich;
- Meldung wird nur mit `external_review_required` erfasst; keine automatische Moderationsentscheidung;
- Legacy-Schreib-RPC `positive/neutral/negative` wird bei Aktivierung des neuen Modells entzogen.

Rationale: Release-1-Bewertungsmodell vollständig abbilden, Moderations-/Berichtigungsfolgen aber extern prüfen lassen.

### Share / Public Listing

Implementiert:
- öffentliche Route `/listing/:id`;
- separater, datensparsamer Public-RPC nur für aktive/verfügbare Listings;
- keine Seller-ID, Verkäuferanzeige, Seller-Notiz, Kontakt-, Adress-, Transaktions- oder Storage-Pfaddaten im Public-RPC;
- serverseitige OG-/Twitter-Produktmetadaten;
- Artikelbild nur über kurzlebige signierte Storage-URL; sicherer Branding-Fallback;
- bestehender Serverless-Handler wird als klar getrennte GET-Route wiederverwendet, damit die Vercel-Hobby-Funktionsgrenze nicht überschritten wird;
- Native Share mit Link-kopieren-Fallback;
- 1080×1920-Story-Karte aus Artikelbild, Produktdaten, Preis und DUELVANTA-Branding;
- Story enthält keine privaten Verkäuferdaten;
- öffentliche Seite enthält nur CTA zurück zu DUELVANTA und keine Off-Platform-Kontakt-/Zahlungsdaten.

Rationale: Release-1-Sharepflicht erfüllen, ohne zusätzliche Serverless-Funktion oder unnötige Verkäuferdatenexposition.

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
   - BZSt-XML-/Produktivmeldung;
   - steuerliche Behandlung einer späteren Tauschgebühr, falls das Geschäftsmodell jemals geändert wird.

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

## Sicherheitsgrenzen

- `main` und Produktion bleiben unverändert.
- PR #5 bleibt Draft.
- neue SQL-Dateien sind Review-/Staging-Dateien und nicht produktiv angewandt.
- Staging-Prüfungen für neue Datenbankpfade werden transaktional mit `ROLLBACK` ausgeführt, sofern keine explizite persistente Migration beschlossen wurde.
- kein Stripe Live, keine reale Zahlung, Auszahlung, Erstattung oder Tauschgebühr.
- C2C-EUR-Werte sind technische Referenzevidenz, keine aktivierte Steuer-/PStTG-Buchung.

## Nächste B07-Schritte

1. aktuellen Branch-Head vollständig durch CI laufen lassen;
2. Phase-5-End-to-End-Regressionsstand auswerten und reale Befunde korrigieren;
3. zentralen L07-01-Prüfkatalog als Implementierungscheckliste aktualisieren;
4. abschließenden B07-Re-Review durchführen;
5. anschließend neues Masterhandout als verbindlichen Übergabestand erzeugen.
