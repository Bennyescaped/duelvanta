# DUELVANTA – Masterhandout V21

Stand: 17.09.2026  
Status: **verbindlicher aktueller Übergabestand für die weitere DUELVANTA-Beta-Entwicklung**

V21 übernimmt den technischen Stand aus `DUELVANTA_MASTERHANDOUT_V20_2026-09-17.md` unverändert und ersetzt ausschließlich die bisher allgemein formulierte Kategorie-C-Strategie durch die nachfolgend konkretisierte Vorgehensweise. Widersprechende ältere Angaben gelten nicht mehr.

Dieses Dokument ist **keine Rechts-, Steuer-, Payment- oder kommerzielle Produktionsfreigabe**.

---

## 1. Technischer Stand unverändert

Repository: `Bennyescaped/duelvanta`  
Branch: `marketplace-ux-v1`  
PR #5: `open / Draft / nicht gemergt`  
Produktions-main: `50f88213571be13255bb52eb489cc28cca660001`

Letzter vollständig grün geprüfter technischer Checkpoint aus V20:

`71818b8b827a2513b1e86843fa1082b20d7c5e0a`

CI:

`Scanner V16 Check #502 / 35236508363 = SUCCESS`

TRADE Release-Lock bleibt umgesetzt:
- Production normale Nutzer: `COMING SOON 2027`;
- Owner-Bypass intern vorhanden;
- Preview/Staging vollständig testbar;
- öffentliche Production-Listing-Links gesperrt;
- kein Stripe Live;
- keine echten Payments/Refunds/Payouts;
- keine Production-Supabase-Änderung.

---

## 2. Statusmatrix

- Kategorie A: **geschlossen**
- Kategorie B: **geschlossen**
- Kategorie C: **extern offen, jetzt konkretisiert**
- Kategorie D: **geschlossen**

---

## 3. Kategorie C – neue verbindliche Strategie

### C1 – Rechtstexte / Plattform-Nutzungsbedingungen

Die Standard-Rechtstexte für DUELVANTA werden über das Schutzpaket der **IT-Recht Kanzlei** erzeugt und anschließend technisch passend in DUELVANTA eingebunden.

Der von der Kanzlei beschriebene Leistungsumfang passt zum DUELVANTA-Marktplatzmodell und umfasst insbesondere:
- Nutzungsberechtigung;
- Registrierung und Vertragsschluss;
- Leistungen des Plattformbetreibers;
- Ranking;
- Verantwortlichkeit der Nutzer für Inhalte;
- Moderation und Beschränkung von Inhalten;
- Sanktionen des Betreibers;
- ggf. internes Beschwerdemanagement;
- ggf. Bewertungen und Kommentare;
- Nutzungsrechte Betreiber/Nutzer;
- Vergütung;
- Haftung;
- Laufzeit/Kündigung;
- Änderungen der Nutzungsbedingungen;
- anwendbares Recht.

Der Konfigurator ist für Online-Plattformen geeignet, auf denen gewerbliche und ggf. private Anbieter Waren, Dienstleistungen oder digitale Produkte anbieten und Verträge entweder direkt über die Plattform oder außerhalb nach Vermittlung geschlossen werden.

**Verbindliche Konsequenz:**
Für die Erstellung der Rechtstexte wird **kein Steuerberater benötigt**. Steuerberatung und Rechtstexte werden organisatorisch getrennt behandelt.

Nach Erhalt der Texte werden diese nicht frei neu formuliert, sondern nur technisch und in den vorgesehenen, zulässigen Anpassungsbereichen an die tatsächlichen DUELVANTA-Flows angeglichen.

### C2 – DUELVANTA-Sonderfälle

Nur Sonderfragen, die durch den Standard-Konfigurator nicht eindeutig abgedeckt werden, bleiben für eine gezielte rechtliche Einzelklärung offen. Dazu können insbesondere gehören:
- spezielle C2C-Tauschkonstellationen;
- besondere Pickup-/Chat-Aufbewahrung;
- spezielle Stripe-Connect-/Plattformrollen;
- atypische DSA-/Moderations- oder Beschwerdefälle.

Keine pauschale anwaltliche Komplettprüfung über mehrere Tausend Euro wird derzeit als Standardweg eingeplant.

### C3 – Steuer / PStTG / DAC7

Die steuerliche Strategie lautet künftig:
- Stripe Connect als zentrale Zahlungs-/Connected-Account-Infrastruktur;
- Stripe Tax dort einsetzen, wo es für Umsatzsteuer-/Tax-Automatisierung sinnvoll ist;
- Stripe Platform Tax Reporting prüfen/nutzen, sofern der konkrete deutsche Meldeweg für DUELVANTA geeignet ist;
- das bereits vorhandene DUELVANTA-PStTG/DAC7-Ledger als eigene Kontroll- und Exportebene beibehalten;
- bei Bedarf Jahres-/Quartalsexporte aus DUELVANTA erzeugen;
- für die deutsche DAC7/PStTG-Meldung eine kostengünstige XML-/Reporting-Lösung verwenden und anschließend über den vorgesehenen BZSt-Meldeweg einreichen.

**Verbindliche Kostenstrategie:**
Kein laufender spezialisierter Plattform-Steuerberater wird als Standard vorausgesetzt. Externe Steuerberatung soll nur für konkrete Sonderfragen oder eine einmalige fachliche Bestätigung eingesetzt werden, falls Stripe/DUELVANTA/Reporting-Software einen Punkt nicht eindeutig abdecken.

Noch offen bleibt insbesondere die fachliche Bestätigung der endgültigen PStTG/DAC7-Einordnung für DUELVANTA-Sonderfälle, bevor eine echte Meldung produktiv erfolgt.

---

## 4. Was Kategorie C weiterhin blockiert

Vor kommerziellem TRADE-Produktivstart weiterhin erforderlich:
- finale IT-Recht-Kanzlei-Texte erzeugen und einpflegen;
- ggf. verbleibende DUELVANTA-Sonderfragen rechtlich klären;
- endgültigen Steuer-/PStTG-/DAC7-Prozess für die echte Produktion festlegen;
- Stripe-Live-Freigabe;
- echte Payments/Refunds/Payouts erst danach aktivieren.

Kategorie C blockiert weiterhin **nicht** die interne Staging-/Beta-Entwicklung.

---

## 5. Unverändert nicht freigegeben

Bis zu einer ausdrücklichen Freigabe:
- `main` nicht verändern;
- PR #5 nicht mergen;
- Stripe Live nicht aktivieren;
- keine echten Zahlungen, Refunds oder Payouts;
- keine produktive PStTG-/DAC7-Meldung auslösen;
- keine geschlossenen Kategorien A/B/D erneut aufrollen ohne neuen konkreten Befund.

---

## 6. Kurzstatus

`A geschlossen / B geschlossen / C extern offen mit kosteneffizienter Recht+Tax-Strategie / D geschlossen`

Technische Grundlage bleibt V20; V21 ist ab jetzt der verbindliche Übergabestand für Kategorie C und die weitere Beta-Planung.
