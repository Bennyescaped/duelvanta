# DUELVANTA – B07 / L07-01 Prüfkatalog

Stand: 15.09.2026
Status: **B07 OFFEN / BLOCKIERT – keine Rechts-, Steuer- oder Paymentfreigabe**
Grundlage: `DUELVANTA_MASTERHANDOUT_V13_2026-09-15.md` sowie die dokumentierten L07-01-Entscheidungen /01 bis /53.

## 1. Festgelegtes Release-1-Geschäftsmodell

- DUELVANTA ist Plattformbetreiber/Vermittler, nicht Verkäufer oder Käufer der von Nutzern angebotenen Ware.
- Warenvertrag bei Verkäufen: Verkäufer ↔ Käufer.
- Tauschvertrag: Nutzer ↔ Nutzer.
- Käufer in Release 1 ausschließlich private Verbraucher.
- Verkäufer dürfen privat oder gewerblich sein; Status muss vor Verkauf erklärt und öffentlich kenntlich gemacht werden.
- Release 1 ausschließlich Deutschland.
- Nutzung von TRADE für Kauf, Verkauf und Tausch nur ab 18 Jahren und mit registriertem Konto.
- Nur Trading-Card-Produkte: Einzelkarten, professionell gegradete Slabs und original versiegelte TCG-Produkte.
- Kein Gastcheckout.

## 2. Gebühren- und Zahlungsmodell

- Verkäuferprovision: **4 % des tatsächlich bezahlten Warenpreises**.
- Versandkosten sind nicht provisionspflichtig.
- Kein Käuferentgelt, keine Listinggebühr, kein verpflichtendes Verkäuferabo.
- Reiner privater C2C-Tausch bleibt provisionsfrei.
- Kein Mindestangebotspreis und kein allgemeiner Mindestbestellwert.
- Mehrere Artikel desselben Verkäufers sollen soweit sinnvoll in einer Bestellung/Zahlung gebündelt werden.
- Bezahlte Verkäufe laufen ausschließlich über den später freigegebenen integrierten Zahlungsdienst.
- Keine private Überweisung, PayPal-Friends-, Bar- oder sonstige Off-Platform-Zahlung für Marketplace-Verkäufe.
- Verkäuferauszahlungen grundsätzlich gesammelt einmal wöchentlich ab 20 EUR Guthaben; kleinere Guthaben werden gesammelt und spätestens einmal monatlich ausgezahlt.
- DUELVANTA verwaltet Kundengelder nicht selbst; konkrete Stripe-Connect-/Payment-Architektur bleibt freigabepflichtig.

## 3. Kaufvertrag und Preisverhandlung

- Annahme eines Preisvorschlags durch den Verkäufer schließt noch keinen Kaufvertrag.
- Nach angenommener Preisverhandlung wird der Artikel 2 Stunden exklusiv für den Käufer reserviert.
- Vertragsschluss erst im vollständigen Checkout über die verbindliche Bestellhandlung.
- Bei Festpreisangeboten ebenfalls kein zusätzlicher Verkäufer-Accept nach der verbindlichen Käuferbestellung.
- Doppelverkauf innerhalb DUELVANTA muss technisch verhindert werden.
- Cross-Listing auf anderen Plattformen bleibt erlaubt; externe Verkäufe müssen unverzüglich bei DUELVANTA nachgeführt werden.
- Während DUELVANTA-Reservierung oder nach verbindlichem Verkauf darf die Ware nicht anderweitig verkauft werden.

## 4. Versand, Zustellung und Auszahlung

- Verkäufer muss bezahlte Versandbestellungen grundsätzlich innerhalb von 3 Werktagen versenden.
- Maßgeblich für die Versandpflicht ist der gesamte Warenwert der Bestellung.
- Bis einschließlich 25 EUR Warenwert darf ungetrackter Versand angeboten werden.
- Käufer dürfen freiwillig eine nachverfolgbare Versandart wählen und tragen die vor Checkout transparent ausgewiesenen Versandkosten.
- Über 25 EUR Warenwert ist nachverfolgbarer Versand verpflichtend.
- DUELVANTA darf bei Risikofällen auch unter 25 EUR Tracking verpflichtend machen.
- Bei höherwertigen Bestellungen muss zusätzlich eine zum Warenwert passende Haftung/Versicherung vorgesehen werden.
- Nach nachgewiesener Zustellung gilt grundsätzlich eine 72-Stunden-Problemfrist.
- Bestätigt der Käufer vorher aktiv „Erhalten – alles in Ordnung“, wird der Betrag sofort auszahlbar.
- Ohne Problemfall wird der Betrag spätestens nach Ablauf der 72 Stunden auszahlbar.
- Ein offener Problemfall sperrt nur den Betrag der betroffenen Transaktion, nicht das übrige Verkäuferguthaben.

## 5. Persönliche Abholung

- Persönliche Abholung bleibt zulässig; Zahlung trotzdem über den integrierten DUELVANTA-Zahlungsweg.
- Übergabe über einmaligen QR-/Übergabecode.
- Käufer und Verkäufer müssen die Übergabe beidseitig bestätigen.
- Bestätigung wird mit Auditdaten dokumentiert.
- Nach beidseitiger Bestätigung wird der Transaktionsbetrag ohne zusätzliche 72-Stunden-Frist sofort auszahlbar.
- Gesetzliche Käuferrechte werden durch diese technische Freigabe nicht ausgeschlossen.

## 6. C2C-Tausch

- Nur privater C2C-Ware-gegen-Ware-Tausch in Release 1.
- Kein gewerblicher Tausch und kein Mischmodell Ware + Geld.
- Tausch wird erst verbindlich, wenn beide Nutzer die endgültige Tauschzusammenstellung ausdrücklich bestätigen.
- Danach beginnt für beide Seiten eine 3-Werktage-Versandfrist.
- Beide Seiten verwenden Tracking bzw. bei Abholung den Übergabenachweis.
- Jeder Tauschpartner trägt seine eigenen Versandkosten.
- Keine DUELVANTA-Provision auf reinen C2C-Tausch.

## 7. Verkäuferpflichten

- Verkäufer müssen DUELVANTA gegenüber ihre reale Identität und belastbare Adresse angeben.
- Öffentlicher Nickname darf die interne Identität nicht ersetzen.
- Gewerbliche Verkäufer müssen die erforderlichen Unternehmens-/Anbieterinformationen liefern.
- Verkäufer müssen zum Verkauf berechtigt sein.
- Originale müssen authentisch sein; keine Fälschungen, Proxies als Originale, manipulierte Slabs oder resealte Ware als original versiegelt.
- Zustand, Sprache, Edition, Grading und relevante Mängel müssen zutreffend beschrieben werden.
- Verkäuferstatus privat/gewerblich muss wahrheitsgemäß angegeben und bei Änderungen aktualisiert werden.

## 8. Storno, Problemfälle und Sanktionen

- DUELVANTA stellt einen technischen/organisatorischen Problem- und Beschwerdeprozess bereit, ist aber keine Schiedsstelle und entscheidet zivilrechtliche Ansprüche nicht abschließend.
- Verkäufer darf nach verbindlichem bezahltem Kauf nicht frei stornieren.
- Verkäuferstorno nur bei nachvollziehbarem Ausnahmegrund; Käufer erhält vollständige Rückzahlung.
- Bei zurechenbarem Verkäuferstorno soll wirtschaftlich eine Stornogebühr in Höhe der 4-%-Verkäuferprovision verbleiben. Diese Konstruktion ist ausdrücklich extern rechtlich zu prüfen.
- Käufer kann bei C2C nach Vertragsschluss nur eine Stornoanfrage stellen; einseitiges freies Storno ist nicht vorgesehen.
- Stimmt der private Verkäufer zu, erfolgt vollständige Rückabwicklung und die DUELVANTA-Provision wird zurückgerechnet.
- Gesetzliche Verbraucherrechte bei gewerblichen Verkäufern bleiben unberührt und müssen separat korrekt umgesetzt werden.
- Nach Eröffnung eines Problemfalls haben beide Seiten grundsätzlich 7 Tage für Antworten und angeforderte Nachweise.
- Reagiert eine Seite nicht, darf DUELVANTA den Plattformprozess mit den vorhandenen Informationen fortführen.
- Laufende Versanddienstleister-Nachforschungen dürfen den Fall länger offen halten.
- 1. zurechenbarer Verkäuferstorno innerhalb von 90 Tagen: 4-%-Stornogebühr und Verwarnung.
- 2. zurechenbarer Verkäuferstorno: zusätzlich 14 Tage Verkaufssperre.
- 3. zurechenbarer Verkäuferstorno: 60 Tage Verkaufssperre und manuelle Kontoprüfung.
- Ab dem 4. zurechenbaren Verkäuferstorno ist grundsätzlich eine dauerhafte Marketplace-Verkaufssperre vorgesehen, vorbehaltlich Überprüfung.
- Nach 180 Tagen ohne neuen Verkäuferstorno wird die Eskalationsstufe um eine Stufe reduziert, nicht vollständig zurückgesetzt.
- Schwere Verstöße wie Fälschungen, Betrug, manipulierte Versandnachweise, falsche Identität oder systematische Zahlungsumgehung können sofortige vorläufige Sperren auslösen; bestätigte gravierende Verstöße können bereits beim ersten Fall dauerhaft sanktioniert werden.
- Laufende Bestellungen, Rückzahlungen, Problemfälle und notwendige Kommunikation bleiben trotz Verkaufssperre zugänglich.

## 9. Sonderfälle Nicht-Erhalt

- Bei privatem C2C-ungetracktem Versand bis einschließlich 25 EUR kann Nicht-Erhalt frühestens 14 Tage nach Versand als Problemfall gemeldet werden.
- Ungetrackter Versand führt weder automatisch zu Käufererstattung noch zu Verkäuferfreigabe; vorhandene Nachweise werden geprüft.
- Für B2C gilt diese C2C-Regel nicht; zwingendes Verbraucherrecht bleibt maßgeblich.
- Häufen sich verlorene ungetrackte Sendungen bei einem Konto, darf DUELVANTA künftig Tracking verpflichtend machen.
- Zeigt Tracking „zugestellt“, bestreitet der Käufer aber den Erhalt, wird ein Problemfall eröffnet und der betroffene Betrag gesperrt.
- Trackingstatus oder Käuferbehauptung entscheiden nicht automatisch.
- Verkäufer stellt Tracking-/Zustellinformationen bereit; Käufer bestätigt den Nicht-Erhalt konkret.
- Beide Seiten wirken bei erforderlicher Nachforschung/Reklamation mit; soweit vorgesehen soll sie innerhalb von 7 Tagen angestoßen werden.
- DUELVANTA unterstützt den Prozess organisatorisch, trifft aber keine abschließende zivilrechtliche Haftungsentscheidung.

## 10. Plattformregeln und Kommunikation

- Nutzer akzeptieren versionierte allgemeine DUELVANTA-Plattformbedingungen.
- Verkauf/Tausch erfordert zusätzlich versionierte Verkäufer-/TRADE-Bedingungen.
- Zustimmungszeitpunkt und Version müssen beweisbar gespeichert werden.
- Wesentliche Änderungen an Gebühren, Pflichten, Vertragsmodell, Sperren oder Auszahlungen werden versioniert angekündigt und erfordern vor weiterer Nutzung der betroffenen Funktion eine erneute aktive Zustimmung.
- Rein redaktionelle Änderungen erfordern keine erneute Zustimmung.
- Bestehende Transaktionen bleiben der bei Vertragsschluss gültigen Version zuordenbar.
- DUELVANTA darf rechtswidrige oder regelwidrige Angebote entfernen und Konten bei objektiven Gründen beschränken/sperren.
- Begründung und geeigneter Beschwerdeweg sind vorzusehen, soweit rechtlich erforderlich.
- Bewusstes Umgehen des DUELVANTA-Zahlungswegs bzw. der Verkäufergebühr bei über DUELVANTA angebahnten Verkäufen ist untersagt.
- Vor Kauf oder Tausch läuft die Kommunikation innerhalb DUELVANTA; öffentliche Kontakt- oder Zahlungsdaten zur Umgehung des Marktplatzes sind nicht vorgesehen.
- Erst nach verbindlicher Transaktion werden nur die für Versand oder Abholung erforderlichen Daten zwischen den Parteien freigegeben.
- Kündigung des Plattformkontos beendet offene Transaktionen, Gebühren-, Beschwerde- oder Aufbewahrungspflichten nicht automatisch.

## 11. Share-Funktion als Release-1-Anforderung

- Angebote müssen teilbar sein.
- Native Share-Funktion für unterstützte Geräte/Apps.
- Öffentliche Angebots-URL und Link-kopieren-Fallback.
- Social-/Messenger-Vorschau mit Artikelbild, Produktdaten, Preis und DUELVANTA-Branding.
- Instagram-taugliche Story-Share-Karte.
- Keine privaten Verkäuferdaten in Share-Metadaten.
- Share-Funktion darf nicht zur Umgehung des DUELVANTA-Zahlungswegs führen.

## 12. Bewertungsmodell

- Bewertungen sind nur nach tatsächlich abgeschlossener Kauf- oder Tauschtransaktion möglich.
- Jede Bewertung wird der konkreten Transaktion zugeordnet.
- Bewertungsfrist: 30 Tage nach Transaktionsabschluss.
- Pro Nutzer und Transaktion ist genau eine Bewertung vorgesehen.
- Bewertung: 5-Sterne-Gesamtbewertung plus optionaler kurzer Kommentar.
- Keine frei bewertbaren Unterkategorien.
- Blind-Review: Bewertungen bleiben zunächst verborgen und werden gleichzeitig veröffentlicht, sobald beide Parteien bewertet haben.
- Bewertet nur eine Partei, wird deren Bewertung nach Ablauf der 30-Tage-Frist sichtbar.
- Eine abgegebene Sternebewertung kann durch den Nutzer grundsätzlich nicht nachträglich geändert werden.
- Meldung und Moderation rechtswidriger, beleidigender oder missbräuchlicher Inhalte bleibt möglich.
- Interne objektive Transaktionssignale dürfen separat für Trust-, Risiko- und Moderationszwecke verarbeitet werden, soweit dies später rechtlich und datenschutzrechtlich freigegeben ist.

## 13. Sicher zu behandelnde gesetzliche Themen

Diese Punkte sind keine frei gestaltbaren Produktoptionen und müssen vor Release korrekt umgesetzt sein:

- wirksame Einbeziehung und Nachweisbarkeit von Plattform-/Verkäuferbedingungen;
- klare Identität des jeweiligen Vertragspartners;
- korrekte Verbraucherinformationen und zwingende Verbraucherrechte bei B2C;
- Datenschutz, Zweckbindung, Datenminimierung und Aufbewahrung;
- Plattformpflichten zu Anbieter-/Händlerstatus, Moderation und Beschwerdeverfahren, soweit anwendbar;
- steuerliche Melde-/Dokumentationspflichten einer Plattform, soweit anwendbar;
- zulässige Zahlungsabwicklung ohne unerlaubte eigene Zahlungsdienst-/Treuhandtätigkeit;
- produkt-/sicherheitsbezogene Informationspflichten für die angebotenen Waren, soweit anwendbar.

## 14. Externe Freigabepunkte

### Rechtsprüfung

1. Vermittlerrolle von DUELVANTA und Abgrenzung vom Warenverkäufer.
2. Struktur allgemeine Plattformbedingungen + zusätzliche Verkäufer-/TRADE-Bedingungen.
3. Einbeziehung, Versionierung und erneute Zustimmung bei wesentlichen Bedingungsänderungen.
4. Vertragsschluss Festpreis und Preisverhandlung inklusive 2-Stunden-Reservierung.
5. C2C- und B2C-Storno-/Rückabwicklungsregeln.
6. Verkäufer-Stornogebühr in Höhe von 4 %.
7. Versandmodell bis/über 25 EUR, Haftung/Versicherung und C2C-/B2C-Gefahrtragung.
8. Nicht-Erhalt, Zustellstreit, Nachforschung und Problemfallfristen.
9. 72-Stunden-Auszahlungs-/Problemfenster und sofortige Freigabe bei Käuferbestätigung bzw. Abholung.
10. Verkäufer-Sanktionsleiter, Sofortsperren, Begründungs- und Beschwerdeverfahren.
11. Anti-Circumvention-Regel und Grenzen der internen Kommunikation/Kontaktdatenfreigabe.
12. Händlerstatus, öffentliche Anbieterinformationen und Identitätsprüfung.
13. Pflichtinformationen im Checkout und auf Angeboten.
14. Bewertungsmodell einschließlich Blind-Review, Löschung, Berichtigung, Gegendarstellung und Moderation.

### Steuerprüfung

1. Umsatzsteuerliche Behandlung der 4-%-Plattformvergütung.
2. Rechnungsstellung/Gutschriften gegenüber privaten und gewerblichen Verkäufern.
3. Behandlung von Refunds und Verkäufer-Stornogebühren.
4. Plattformmeldepflichten einschließlich Verkäufen und C2C-Tauschwerten, soweit relevant.
5. Dokumentations-/Aufbewahrungsanforderungen.

### Payment-/Stripe-Prüfung

1. Geeignetes Stripe-Connect-Modell und zulässiger Geldfluss.
2. Wer trägt Payment-, Connect-, Refund- und Chargeback-Kosten.
3. Umsetzung von wöchentlicher Sammelauszahlung ab 20 EUR und monatlichem Restbetrag.
4. Transaktionsbezogene Holds bei Problemfällen.
5. Freigabe nach Käuferbestätigung, 72 Stunden oder QR-Abholung.
6. Refund-/Chargeback-Fähigkeit nach bereits erfolgter Auszahlung.
7. Sicherstellung, dass DUELVANTA keine unzulässige eigene Treuhand-/Zahlungsdienstrolle übernimmt.

## 15. Status des internen L07-01-Entscheidungsteils

Der interne Geschäftsmodell- und Regelteil von L07-01 ist mit den Entscheidungen /01 bis /53 **inhaltlich weitgehend entschieden**.

Nicht als freie interne Produktentscheidung abschließbar bleiben insbesondere:

- konkrete zugelassene Versandprodukte, Haftungsgrenzen und technische Carrier-Integration;
- genaue rechtliche C2C-/B2C-Haftungsverteilung bei Verlust/Nicht-Erhalt;
- exakte Darstellung und wirtschaftliche Tragung von Payment-/Connect-/Refund-/Chargebackkosten;
- rechtliche Finalisierung der Verkäufer-Stornogebühr und Sanktionsleiter;
- endgültige Vertrags-, Datenschutz-, DSA-/P2B-, Steuer- und Zahlungsdienstfreigabe.

Diese Punkte werden nicht durch weitere frei gestaltete L07-01-Entscheidungen ersetzt, sondern gehören in die externen Freigaben und anschließende Implementierung.

## 16. Evidenz für spätere Prüfung

Für die externe Prüfung vorzulegen:

- Masterhandout V13;
- sämtliche L07-01-Entscheidungsdateien /01–/53;
- Seller-Onboarding-Screens/Code;
- Checkout-Screens/Code;
- Payment-Flow-Dokumentation;
- Entwurf der Plattformbedingungen;
- Entwurf der Verkäufer-/TRADE-Bedingungen;
- Entwurf der Datenschutzerklärung;
- geplantes Stripe-Connect-Flussdiagramm;
- Screens der Verkäuferstatus-, Preis-, Versand-, Abhol-, Storno-, Problemfall-, Sanktions- und Bewertungsanzeigen.

**Hinweis:** Dieses Dokument ist ein interner Prüfkatalog und keine Rechts-, Steuer- oder Zahlungsdienstfreigabe. B07 bleibt bis zu den vorgesehenen externen Freigaben und den daraus folgenden Implementierungs-/Nachweisarbeiten offen/blockiert.
