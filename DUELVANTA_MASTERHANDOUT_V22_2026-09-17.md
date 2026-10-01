# DUELVANTA – Masterhandout V22

Stand: 17.09.2026  
Status: **verbindlicher aktueller Übergabestand für die weitere DUELVANTA-Beta-Entwicklung**

V22 übernimmt den technischen Stand aus V21/V20 und ersetzt die bisherige Produktstrategie für C2C-Tausch vollständig.

Dieses Dokument ist **keine Rechts-, Steuer-, Payment- oder kommerzielle Produktionsfreigabe**.

---

## 1. Verbindliche Produktentscheidung – kein Tausch mehr

DUELVANTA TRADE wird für den vorgesehenen Produktstart auf **Kauf und Verkauf** reduziert.

Nicht mehr Bestandteil des Release-Scopes:
- `trade`-only Listings;
- `sale_or_trade` als Tauschoption;
- C2C-Swap-Vorschläge;
- Gegenvorschläge / Revisionen;
- bilaterale Tauschbindung;
- Tausch-Pickup;
- Tausch-Versand;
- Tausch-Erhalt;
- Tausch-Problemfälle;
- Tausch-Bewertung bzw. sonstige tauschspezifische Folgeprozesse.

Grund für die Produktentscheidung ist die vom Betreiber festgelegte Risikoreduktion bei rechtlicher und steuerlicher Unsicherheit rund um Tauschgeschäfte. Es wird daraus keine allgemeine rechtliche Aussage über Tauschplattformen abgeleitet.

**Verbindliches Zielmodell:**

`DUELVANTA TRADE = Kaufen + Verkaufen`

Der Markenbereich `TRADE` bleibt bestehen; der Begriff bezeichnet künftig den Marktplatzbereich und nicht zwingend einen Kartentausch.

---

## 2. Umgang mit bereits gebauter Tauschfunktion

Die vorhandene Tauschimplementierung wird nicht unkontrolliert gelöscht.

Für die technische Stilllegung gilt:
1. Neue Tauschvorgänge müssen serverseitig und in der UI unmöglich werden.
2. Tausch-Einstiegspunkte und Tauschoptionen werden aus der Nutzeroberfläche entfernt.
3. Bestehende Tauschmodule, Migrationen und Tests dürfen zunächst im Repository verbleiben, solange sie nicht produktiv erreichbar sind und keine aktive Fachlogik mehr auslösen.
4. Bereits vorhandene Test-/Historikdaten werden nicht ohne gesonderte Prüfung gelöscht.
5. Erst nach vollständig grüner Regression kann ungenutzter Tauschcode später separat bereinigt werden.

Damit wird das Produktrisiko sofort reduziert, ohne durch eine vorschnelle Löschung neue technische Fehler zu erzeugen.

---

## 3. Kategorie C – Konsequenzen

### C1 Rechtstexte

Die Rechtstexte werden weiterhin über das Schutzpaket der **IT-Recht Kanzlei** erzeugt.

Der Konfigurator soll künftig ausschließlich das tatsächliche Zielmodell abbilden:
- Plattform/Online-Marktplatz;
- private und ggf. gewerbliche Verkäufer;
- Kauf und Verkauf von TCG-Produkten;
- keine Tauschfunktion.

Dadurch entfällt die bisherige DUELVANTA-Sonderfrage zum C2C-Tausch aus dem vorgesehenen Release-Scope.

### C2 Sonderfälle

Offen bleiben nur noch tatsächlich relevante Sonderfragen, insbesondere soweit sie nicht durch die Standardtexte abgedeckt werden:
- Pickup-/Chat-Aufbewahrung;
- spezielle Stripe-Connect-/Plattformrollen;
- atypische DSA-/Moderations-/Beschwerdefälle;
- sonstige Abweichungen des tatsächlichen Kauf-/Verkaufsflows vom Standard-Marktplatzmodell.

### C3 Steuer / PStTG / DAC7

Die kosteneffiziente Strategie aus V21 bleibt bestehen:
- Stripe Connect;
- Stripe Tax soweit sinnvoll;
- Stripe Platform Tax Reporting prüfen;
- eigenes DUELVANTA-PStTG/DAC7-Ledger als Kontroll-/Exportebene;
- kostengünstiger XML-/Reporting-Weg für die deutsche Meldung;
- externe Steuerberatung nur für konkrete verbleibende Sonderfragen oder einmalige Bestätigung.

Tauschgeschäfte sind nicht mehr Teil des geplanten Produktivmodells und müssen daher für den Release-Prozess nicht mehr als eigener DUELVANTA-Geschäftsfall gelöst werden.

---

## 4. Technischer Stand und Grenzen

Repository: `Bennyescaped/duelvanta`  
Branch: `marketplace-ux-v1`  
PR #5: `open / Draft / nicht gemergt`  
Produktions-main: `50f88213571be13255bb52eb489cc28cca660001`

Letzter vollständig grün geprüfter technischer Checkpoint aus V20:

`71818b8b827a2513b1e86843fa1082b20d7c5e0a`

CI:

`Scanner V16 Check #502 / 35236508363 = SUCCESS`

Der aktuelle Dokumentationsstand nach V21 lag auf:

`8b3eb5dff5e38b99092336e5a7ffbae56128ae40`

Unverändert:
- Production normale Nutzer: TRADE `COMING SOON 2027`;
- Owner-Bypass intern vorhanden;
- Preview/Staging testbar;
- kein Stripe Live;
- keine echten Payments/Refunds/Payouts;
- keine Production-Supabase-Änderung;
- `main` nicht verändern;
- PR #5 nicht mergen.

---

## 5. Nächster technischer Arbeitsblock

Als nächstes erfolgt eine **kontrollierte Tausch-Stilllegung** auf `marketplace-ux-v1`:
- Tauschoptionen aus Selling-/Listing-UI entfernen;
- Tausch-Navigation/CTAs entfernen;
- neue Tauschvorgänge serverseitig sperren;
- Kauf-/Verkaufsflows unverändert lassen;
- vorhandene historische Tauschdaten nicht löschen;
- gezielte Regressionen und anschließend vollständige CI;
- danach Staging gegenprüfen.

Keine unnötige Löschung alter Migrationen oder abgeschlossener Nachweise während dieses Blocks.

---

## 6. Statusmatrix

- Kategorie A: **geschlossen**
- Kategorie B: **geschlossen**
- Kategorie C: **extern offen, durch Wegfall des Tauschs vereinfacht**
- Kategorie D: **geschlossen für den bisherigen Release-1-Umfang; Tausch wird aus dem zukünftigen Release-Scope entfernt**

Kurzstatus:

`DUELVANTA TRADE = Kauf + Verkauf; kein Tausch im Produktiv-/Release-Scope.`
