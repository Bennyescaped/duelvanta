# DUELVANTA – Masterhandout V14

Stand: 15.09.2026, nach Abschluss des internen L07-01-Geschäftsmodell-Entscheidungsteils bis Entscheidung /53.

Status: **B07 OFFEN / BLOCKIERT – interne B07-Vorbereitung läuft weiter; keine externe Rechts-, Steuer- oder Paymentfreigabe**

Dieses Handout ist ab sofort der verbindliche Übergabestand und ersetzt widersprechende Status-, Head-, Arbeits- und Reihenfolgeangaben aus älteren Masterhandouts. Inhaltlich gelten die detaillierten B07-Entscheidungs- und Prüfdokumente ergänzend weiter.

## 1. Verbindlicher Repository-Stand

- Repository: `Bennyescaped/duelvanta`
- Entwicklungsbranch: `marketplace-ux-v1`
- aktueller Branch-Head / V14-Ausgangsstand: `024f22f12cb51ac5023b8f6eae94621252ea826c`
- Produktions-`main`: `50f88213571be13255bb52eb489cc28cca660001`
- PR #5: **open, Draft, nicht gemergt**
- PR Base: `main`
- PR Head: `marketplace-ux-v1`
- seit dem letzten technischen Post-V12-Stand wurden innerhalb B07 ausschließlich Dokumentations-/Entscheidungsdateien geändert; keine Produktfunktion wurde aufgrund der L07-01-Entscheidungen bereits umgesetzt.

## 2. Unveränderter technischer Referenzstand

Der letzte vollständig geprüfte technische Produktstand vor der B07-Entscheidungsserie bleibt:

- technischer Post-V12-Stand: `236934602c20a4131cdf48ed76672bef560bbfe6`
- Scanner V16 Check #284
- Run-ID `34985488806`
- `validate`: success
- `quota_database`: success
- gesamter Workflow: success

Festes geprüftes Preview:

- Deployment: `dpl_2Y8P9ZgZniuLZ2dA9fj8e6zbGVop`
- Preview: `https://duelvantav5vision-esnj6mr53-bennyescaped-3783.vercel.app`
- Login: `https://duelvantav5vision-esnj6mr53-bennyescaped-3783.vercel.app/login.html`
- Preview-Supabase: `xhmjxrcskfhbovhitdej`
- Produktions-Supabase: `enifiaqsnqtbzylnfrpi`

Ohne konkreten technischen B07-Befund keine unnötige Wiederholung von CI, Preview-, Browser- oder Login-Prüfungen.

## 3. Blockstatus

- B01: geschlossen
- B02: geschlossen
- B03: geschlossen
- B04: geschlossen
- B05: geschlossen
- B06: geschlossen
- B07: **OFFEN / BLOCKIERT**
- B08–B12: **NICHT BEGINNEN**

B01–B06 nicht erneut bearbeiten, außer ein konkreter B07-Befund beweist eine echte Regression.

## 4. Verbindliche B07-Grundlage

Vor weiterer Arbeit berücksichtigen:

1. `DUELVANTA_MASTERHANDOUT_V14_2026-09-15.md`
2. `DUELVANTA_B07_LEGAL_FINAL_REVIEW_2026-09-15.md`
3. `DUELVANTA_B07_L07-01_REVIEW_CATALOG_2026-09-15.md`
4. sämtliche `DUELVANTA_B07_DECISIONS...`-Dateien mit L07-01-Entscheidungen bis einschließlich `/53`
5. `MARKETPLACE_COMPLIANCE_REQUIREMENTS.md`
6. technischer Referenzstand `236934602c20a4131cdf48ed76672bef560bbfe6`

Der Prüfkatalog und die Entscheidungsdateien sind interne Fachgrundlage, keine Rechts-, Steuer- oder Zahlungsdienstfreigabe.

## 5. L07-01 – interner Entscheidungsstand

Der interne Geschäftsmodell-Entscheidungsteil von L07-01 ist im Wesentlichen abgeschlossen. Maßgeblich sind die Entscheidungen /01 bis /53. Zusammengefasst gilt für Release 1:

### Betreiber- und Vertragsmodell

- DUELVANTA ist Plattformbetreiber/Vermittler, nicht Verkäufer oder Käufer der Nutzerware.
- Warenvertrag: Verkäufer ↔ Käufer.
- Tauschvertrag: Nutzer ↔ Nutzer.
- Käufer in Release 1 nur private Verbraucher.
- Verkäufer privat oder gewerblich.
- Release 1 ausschließlich Deutschland.
- TRADE-Kauf, Verkauf und Tausch nur ab 18 Jahren und mit registriertem Konto.
- Kein Gastcheckout.
- Nur Trading-Card-Produkte: Einzelkarten, professionell gegradete Slabs und original versiegelte TCG-Produkte.

### Gebühren und Payment

- Verkäuferprovision: **4 % des tatsächlich bezahlten Warenpreises**.
- Versandkosten nicht provisionspflichtig.
- Kein Käuferentgelt, keine Listinggebühr, kein Pflichtabo.
- Reiner privater C2C-Tausch provisionsfrei.
- Kein Mindestangebotspreis und kein allgemeiner Mindestbestellwert.
- Mehrere Artikel desselben Verkäufers soweit sinnvoll in einer Bestellung/Zahlung bündeln.
- Bezahlte Verkäufe ausschließlich über den später freigegebenen integrierten Zahlungsweg.
- Kein Off-Platform-Zahlungsweg für Marketplace-Verkäufe.
- Verkäuferauszahlungen grundsätzlich wöchentlich ab 20 EUR Guthaben; kleinere Guthaben sammeln und spätestens monatlich auszahlen.
- endgültige Tragung von Payment-/Connect-/Refund-/Chargebackkosten bleibt bis Paymentfreigabe offen.

### Kauf und Preisverhandlung

- Annahme eines Preisvorschlags durch Verkäufer schließt noch keinen Kaufvertrag.
- Danach 2 Stunden exklusive Reservierung für den Käufer.
- Vertragsschluss erst durch finalen Checkout mit verbindlicher Bestellhandlung.
- Festpreisangebote benötigen danach keine zusätzliche Verkäuferannahme.
- Cross-Listing erlaubt, aber externe Verkäufe unverzüglich bei DUELVANTA nachführen.
- Während Reservierung oder nach verbindlichem Verkauf kein anderweitiger Verkauf.

### Versand

- Verkäufer versendet grundsätzlich binnen 3 Werktagen nach bestätigter Zahlung.
- Bis einschließlich **25 EUR Warenwert** darf ungetrackter Versand angeboten werden.
- Käufer kann freiwillig Tracking wählen und trägt die transparent ausgewiesenen Versandkosten.
- Über 25 EUR Warenwert ist Tracking verpflichtend.
- DUELVANTA darf bei Risikofällen auch unter 25 EUR Tracking verlangen.
- höherwertige Sendungen benötigen zum Warenwert passende Haftung/Versicherung.
- C2C-ungetrackt: Nicht-Erhalt frühestens 14 Tage nach Versand als Problemfall meldbar; keine automatische Käuferentscheidung.
- Tracking `zugestellt`, Käufer bestreitet Erhalt: Problemfall, Betrag gesperrt, keine automatische Entscheidung allein aufgrund Tracking oder Käuferbehauptung; beide Seiten müssen bei Nachforschung mitwirken.

### Zustellung und Auszahlung

- Bei nachgewiesener Zustellung beginnt grundsätzlich ein 72-Stunden-Problemfenster.
- bestätigt Käufer vorher aktiv `Erhalten – alles in Ordnung`, wird der Betrag sofort auszahlbar.
- ohne Problemfall wird der Betrag nach 72 Stunden auszahlbar.
- Problemfall sperrt nur den betroffenen Transaktionsbetrag.
- persönliche Abholung: einmaliger QR-/Übergabecode + beidseitige Bestätigung; danach ohne zusätzliche 72-Stunden-Frist sofort auszahlbar.

### C2C-Tausch

- nur privater Ware-gegen-Ware-Tausch.
- kein gewerblicher Tausch, kein Ware-plus-Geld-Mischmodell.
- verbindlich erst nach ausdrücklicher finaler Bestätigung durch beide Seiten.
- danach 3 Werktage Versandfrist für beide Seiten.
- jeder trägt eigene Versandkosten.
- Tracking bzw. Abholnachweis nach festgelegtem Modell.

### Verkäuferpflichten und Status

- reale Identität und belastbare Adresse gegenüber DUELVANTA vor Verkauf.
- privater oder gewerblicher Status muss wahrheitsgemäß gewählt und aktuell gehalten werden.
- gewerbliche Anbieter liefern erforderliche Unternehmens-/Anbieterinformationen.
- Verkäufer müssen verfügungsberechtigt sein.
- nur authentische Ware; keine Fälschungen, Proxies als Originale, manipulierte Slabs oder resealte Ware als original versiegelt.
- Zustand, Sprache, Edition, Grading und relevante Mängel müssen zutreffend beschrieben werden.

### Storno und Problemfälle

- Verkäufer darf nach verbindlichem bezahltem Kauf nicht frei stornieren.
- zurechenbares Verkäuferstorno: Käufer vollständig erstatten; wirtschaftlich soll eine Stornogebühr in Höhe der 4-%-Verkäuferprovision verbleiben; externe Rechtsprüfung zwingend.
- C2C-Käufer kann nach Vertragsschluss nur Storno anfragen; kein freies einseitiges Storno.
- bei Zustimmung des privaten Verkäufers vollständige Rückabwicklung und Provisionsrückrechnung.
- Problemfall: beide Seiten grundsätzlich 7 Tage für Antworten/Nachweise; laufende Versandnachforschung kann länger dauern.
- DUELVANTA unterstützt technisch/organisatorisch, trifft aber keine abschließende zivilrechtliche Haftungsentscheidung.

### Verkäufer-Sanktionsleiter

Für zurechenbare Verkäuferstornos innerhalb des Eskalationsmodells:

- 1. Fall: 4-%-Stornogebühr + Verwarnung.
- 2. Fall: 14 Tage Verkaufssperre.
- 3. Fall: 60 Tage Verkaufssperre + manuelle Kontoprüfung.
- 4. Fall: grundsätzlich dauerhafte Verkaufssperre, vorbehaltlich Überprüfung.
- nach 180 Tagen ohne neuen Verkäuferstorno reduziert sich die Eskalationsstufe um eine Stufe.

Schwere Verstöße wie begründeter Verdacht auf Fälschungen, Betrug, manipulierte Versandnachweise, Identitätsmissbrauch oder systematische Zahlungsumgehung dürfen sofort zu vorläufiger Verkaufssperre führen; bestätigte gravierende Verstöße können bereits beim ersten Fall dauerhaft sanktioniert werden. Laufende Bestellungen, Rückzahlungen und Problemfälle bleiben zugänglich. Begründung und Beschwerdeweg sind vorzusehen.

### Plattformbedingungen und Kommunikation

- allgemeine Plattformbedingungen versioniert für alle registrierten Nutzer.
- zusätzliche Verkäufer-/TRADE-Bedingungen für Verkauf/Tausch.
- Version + Zustimmungszeitpunkt beweisbar speichern.
- wesentliche Änderungen erfordern erneute aktive Zustimmung vor weiterer Nutzung betroffener Funktionen.
- rein redaktionelle Änderungen benötigen keine erneute Zustimmung.
- Vor Kauf/Tausch Kommunikation grundsätzlich innerhalb DUELVANTA.
- öffentliche Kontakt-/Zahlungsdaten zur Umgehung des Marktplatzes nicht vorgesehen.
- nach verbindlicher Transaktion nur erforderliche Versand-/Abholdaten freigeben.
- Anti-Circumvention-Regel bleibt Bestandteil des Modells.

### Bewertungen

- nur nach abgeschlossener Kauf- oder Tauschtransaktion.
- genau eine Bewertung je Nutzer und Transaktion.
- Bewertungsfrist 30 Tage.
- 5-Sterne-Gesamtbewertung + optionaler kurzer Kommentar.
- keine frei bewertbaren Unterkategorien.
- Blind-Review: Veröffentlichung gleichzeitig, sobald beide bewertet haben; bewertet nur eine Seite, Veröffentlichung nach Ablauf der 30-Tage-Frist.
- Sternebewertung grundsätzlich nicht nachträglich durch Nutzer änderbar.
- rechtswidrige/missbräuchliche Bewertungen meldbar und moderierbar.

### Share-Funktion

Release-1-Anforderung:

- Angebote teilbar.
- native Share-Funktion, z. B. WhatsApp.
- öffentliche Angebots-URL.
- Link-kopieren-Fallback.
- Social-/Messenger-Vorschau mit Artikelbild, Daten, Preis und DUELVANTA-Branding.
- Instagram-taugliche Story-Share-Karte.
- keine privaten Verkäuferdaten in Share-Metadaten.
- Share-Funktion darf keine Zahlungsumgehung fördern.

## 6. Zentraler Prüfkatalog

`DUELVANTA_B07_L07-01_REVIEW_CATALOG_2026-09-15.md` ist der zentrale L07-01-Prüfkatalog. Er muss bei der nächsten Bearbeitung als Soll-Basis verwendet und nach neuen belastbaren Entscheidungen oder Befunden aktualisiert werden.

Der Katalog trennt:

- intern festgelegtes Geschäftsmodell;
- sicher zu behandelnde gesetzliche Themen;
- externe Rechtsfreigabepunkte;
- externe Steuerfreigabepunkte;
- Payment-/Stripe-Freigabepunkte;
- Evidenz für die spätere externe Prüfung.

## 7. Nächster Arbeitsauftrag – verpflichtende Reihenfolge

Die nächste Sitzung arbeitet **ausschließlich innerhalb B07** und beginnt NICHT mit neuen Produktideen oder B08.

### Phase 1 – Soll-Ist-Abgleich gegen L07-01

Vergleiche den aktuellen Repository-Code und die aktuelle UX gezielt gegen den jetzt festgelegten L07-01-Sollzustand.

Mindestens prüfen:

1. `seller-onboarding.html`
2. Verkäuferstatus-/Identitätsfluss
3. `trade-checkout.js`
4. `trade-payment-flow.js`
5. Preisvorschlags-/Verhandlungsflow
6. Festpreisvertragsschluss
7. Warenkorb-/Bestellbündelung je Verkäufer
8. Versandarten/25-EUR-Trackinggrenze
9. 3-Werktage-Versandfrist
10. Zustellstatus + 72-Stunden-Freigabe
11. Käuferbestätigung `Erhalten – alles in Ordnung`
12. persönliche Abholung mit QR-/Übergabecode
13. C2C-Tausch mit beidseitiger finaler Bestätigung
14. Problemfall-/Nachweisfristen
15. transaktionsbezogene Auszahlungssperre
16. Verkäuferstorno + Stornogebührmodell
17. Verkäufer-Sanktionsleiter
18. Bedingungen-Versionierung und erneute Zustimmung
19. Kommunikations-/Anti-Circumvention-Regeln
20. Bewertungsmodell inklusive Blind-Review
21. Share-Funktion und öffentliche Listing-URLs/Metadaten
22. Deutschland-only-, 18+- und registrierter-Konto-Enforcement

### Phase 2 – klassifizierte Änderungsliste

Für jeden Soll-Ist-Befund genau eine Kategorie vergeben:

- **A – bereits korrekt vorhanden**
- **B – sichere technische Anpassung innerhalb des beschlossenen Geschäftsmodells möglich**
- **C – Umsetzung technisch möglich, aber erst nach externer Rechts-/Steuer-/Paymentfreigabe aktivierbar**
- **D – widersprüchlicher/unklarer Punkt, zuerst erneut fachlich entscheiden**

Keine pauschale Komplettüberarbeitung starten. Erst vollständige Änderungsliste erstellen.

### Phase 3 – sichere B07-Korrekturen

Nur Kategorie-B-Punkte dürfen danach gezielt auf `marketplace-ux-v1` umgesetzt werden. Minimal-invasiv arbeiten, vorhandene Architektur nutzen, keine unnötigen Komplett-Rewrites.

Kategorie-C-Punkte dürfen vorbereitet oder als deaktivierter/gesicherter Codepfad dokumentiert werden, aber nicht so aktiviert werden, dass daraus echte rechtliche, steuerliche oder Paymentwirkung entsteht.

## 8. Noch nicht extern freigegeben

Vor kommerziellem Release bleiben insbesondere externe Prüfungen erforderlich zu:

### Recht

- Vermittlerrolle/Vertragsstruktur;
- Plattform- und Verkäufer-/TRADE-Bedingungen;
- C2C/B2C-Vertragsschluss und Storno;
- B2C-Verbraucherinformationen/Widerruf;
- 4-%-Verkäufer-Stornogebühr;
- Moderation, Sperren, Begründungs-/Beschwerdeprozess;
- DSA/P2B-Scope;
- Anbieterstatus/Identitätsdarstellung;
- Bewertungsmodell;
- Versand-/Gefahrtragungsregeln C2C/B2C;
- Datenschutz/GPSR/weitere im B07-Review benannte Releasepflichten.

### Steuer

- Umsatzsteuer auf Plattformvergütung;
- Rechnungs-/Gutschriftenmodell;
- Refunds/Stornogebühren;
- PStTG/DAC7/UStG-Melde- und Dokumentationspflichten;
- C2C-Tauschwerte, soweit relevant.

### Payment

- finales Stripe-Connect-Modell;
- zulässiger Geldfluss;
- Payment-/Connect-/Refund-/Chargebackkosten;
- Holds und Sammelauszahlungen;
- Refunds nach Auszahlung;
- Vermeidung eigener unerlaubter Treuhand-/Zahlungsdienstrolle.

## 9. Budgetstrategie bleibt gültig

- vollständige interne B07-Vorbereitung zuerst im Chat;
- danach kompakte externe Rechtsprüfung statt Projektneustart durch Berater;
- unverbindlicher interner Zielkorridor Rechtsprüfung etwa `1.000–2.500 EUR netto`;
- Steuerprüfung später, sobald das entgeltliche Modell technisch final ist; unverbindlicher interner Zielkorridor etwa `300–800 EUR netto`;
- keine externe Beauftragung oder Ausgabe ohne ausdrückliche Betreiberentscheidung.

## 10. Unveränderte Stop-Regeln

- kein Merge;
- `main` nicht verändern;
- Produktion nicht verändern;
- Produktions-Supabase `enifiaqsnqtbzylnfrpi` nicht verändern;
- Preview-Supabase und Produktion strikt trennen;
- kein Stripe Live;
- keine echten Payments;
- keine echten Refunds;
- keine echten Payouts;
- keine Produktionsmigration;
- keine Domain-Promotion;
- PR #5 bleibt Draft;
- `database/auth-privileged-step-up-v1.sql` bleibt REVIEW ONLY;
- `v-logo.svg` niemals verändern;
- Slogan bleibt exakt `COLLECT. TRADE. BATTLE.`;
- keine unnötigen CI-, Deployment-, Browser- oder Login-Wiederholungen;
- B08–B12 nicht beginnen.

## 11. B07-Abschlussregel

B07 darf weiterhin nur geschlossen werden, wenn:

1. die qualifizierte externe rechtliche Schlussfreigabe für den tatsächlichen Releaseumfang dokumentiert ist;
2. die qualifizierte steuerliche Freigabe für die aktivierten steuerrelevanten Abläufe dokumentiert ist;
3. die erforderliche Payment-/Stripe-Freigabe für den finalen Geldfluss vorliegt;
4. alle zwingenden daraus folgenden B07-Korrekturen umgesetzt und nachgewiesen sind;
5. die Freigaben konkrete Dokument-/Versions-/Commitstände referenzieren.

Bis dahin gilt unverändert:

**B07 = OFFEN / BLOCKIERT.**

## 12. Übergabehinweis für den nächsten Chat

Der nächste Chat soll nicht erneut die 53 Geschäftsentscheidungen diskutieren. Diese gelten als verbindliche interne Soll-Vorgabe, sofern kein echter Widerspruch oder neuer externer Befund festgestellt wird.

Erste konkrete Aufgabe des nächsten Chats:

> Führe einen vollständigen, aber gezielten Soll-Ist-Abgleich des aktuellen `marketplace-ux-v1`-Codes gegen `DUELVANTA_B07_L07-01_REVIEW_CATALOG_2026-09-15.md` und die Entscheidungen L07-01/01–/53 durch. Erstelle zuerst eine klassifizierte Änderungsliste A/B/C/D. Verändere vor dieser Bestandsaufnahme keinen Produktcode. Danach setze nur sichere Kategorie-B-B07-Korrekturen minimal-invasiv um. `main`, Produktion, Stripe Live und B08–B12 bleiben tabu.
