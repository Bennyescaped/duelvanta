# DUELVANTA – Legal Schritt 3: Preisangebotsmodell

Stand: **22.09.2026** · Repository: `Bennyescaped/duelvanta` · Entwicklungsbranch: `marketplace-ux-v1`

**Status: Schritt 3 technisch umgesetzt, veröffentlicht und in GitHub-CI vollständig grün. Die Legal-Migration bleibt unangewandt. Der bestehende Legal-Schema-Guard bleibt geschlossen. Keine Gesamt-, Rechts-, Migrations- oder Produktionsfreigabe. Schritt 4 wurde in diesem Block nicht begonnen.**

## 1. Ausgangs- und Endstand

| Kennung | Bedeutung |
|---|---|
| `1e5d5c54eaa245b2a8e173c7ce609e662cdb6355` | Ausgangs-Head: dokumentierter Schritt-2-Preview-Nachtest |
| `2cab1572eec0e8a83e423c8633dcb57fc14ffa2b` | CI-geprüfter technischer Schritt-3-Endstand |
| `50f88213571be13255bb52eb489cc28cca660001` | Unveränderter `main`-Stand / PR-Basis |
| PR #5 | offen, Draft, unmerged |
| Vercel Deployment | `dpl_4nSdJk825JBdiiXPqLnZbDsaqyQ6`, READY |
| Fester Preview-Host | `duelvantav5vision-fl2akx555-bennyescaped-3783.vercel.app` |

Der Vergleich vom Ausgangs- zum technischen Endstand umfasst 13 Pfade. Davon sind die Laufzeitänderungen auf TRADE/Preisangebote und den weiterhin **unangewandten** Legal-Migrationsentwurf begrenzt; die übrigen Änderungen sind Tests und Cache-/Loader-Revisionen. Keine Production-Datei oder Production-Datenbank wurde verändert.

## 2. Preisangebot vor Käuferbindung vollständig eingefroren

Der unangewandte Migrationskandidat enthält neu `review_market_price_offer_v1`. Die serverseitige Review-Antwort friert vor dem Senden des verbindlichen Käuferangebots insbesondere ein:

- konkreten Verkäufer / Verkäuferrolle und Verkäufer-Snapshot,
- Produkt-Snapshot,
- Menge,
- angebotenen Warenwert und Angebotspreis je Stück,
- referenzierten Inseratspreis,
- Versandart, Versandkosten und Versandhinweis,
- **Gesamtpreis einschließlich Versand**,
- Währung,
- bestehenden privaten Käuferstatus und C2C/B2C-Klassifikation,
- Fulfillment-Metadaten,
- `listing_updated_at` und einen Hash des Angebots-Reviews.

Die Browser-UI zeigt diesen geprüften Stand vor dem Senden als **„VERBINDLICHES PREISANGEBOT“** einschließlich Vertragspartner, Ware/Menge, Warenangebot, Versand und Gesamtpreis. Der Sendebutton bleibt bis zu einer gültigen serverseitigen Review-Antwort deaktiviert.

Der Hinweis stellt klar: Das Senden ist das verbindliche Käuferangebot; der Vertrag entsteht erst durch Annahme des Verkäufers. Dieser Techniktext bildet die mitgeteilte Zielvorgabe ab und ist keine neue anwaltliche Textfreigabe.

## 3. Veraltete oder geänderte Daten können nicht stillschweigend gebunden werden

Der neue browserseitige Schreibpfad ist `create_market_offer_v3`.

Er verlangt:
- den erwarteten `listing_updated_at`,
- den Hash des unmittelbar vorher geprüften Angebots-Reviews.

Die Funktion sperrt das Listing, berechnet die Review erneut und bricht mit `offer_review_changed` ab, wenn Listing-/Vertragsdaten zwischen Review und Senden verändert wurden. Erst danach wird das Angebot zusammen mit `contract_review_snapshot`, `offer_review_hash` und dem bestehenden Consumer-Snapshot gespeichert.

Der ältere unreviewte Browserpfad `create_market_offer_v2` wird im neuen Kandidaten für `public`, `anon` und `authenticated` widerrufen. Er kann nach Anwendung dieses Kandidaten nicht als Browser-Bypass für neue Preisangebote dienen.

## 4. Verkäuferannahme ist der einzige Vertragsschluss des Preisangebots

`respond_to_market_offer(...,'accepted')` verwendet für neue Preisangebote ausschließlich den beim Käuferangebot gespeicherten Vertrags-Snapshot:

- Hash und Snapshot-Version werden geprüft.
- Angebot, Käuferstatus, Verkäufer, Menge, Warenwert und Währung müssen zum Snapshot passen.
- Versandkosten/-art und die für die Abwicklung relevanten Produktdaten stammen aus dem eingefrorenen Käuferangebot, nicht aus später veränderten Listing-Werten.
- Erst die Verkäuferannahme setzt das Angebot auf `accepted` und erzeugt den Deal.
- Es gibt für angenommene Preisangebote **keinen zweiten vertragsschließenden Checkout**.

Der Deal-Insert bleibt an `offer_id` eindeutig und nutzt `ON CONFLICT (offer_id) DO NOTHING`. Ein Replay derselben Annahme erzeugt keinen zweiten Deal. Der vorhandene Order-Anhängepfad besitzt ebenfalls eine eindeutige Deal-Bindung; der neue Regressionstest weist genau einen Deal und genau eine synthetische Order nach.

Ältere noch offene Angebote ohne den neuen vollständigen Vertrags-Snapshot werden im neuen UI nicht mit einem Annahmebutton freigegeben. Sie können damit nicht stillschweigend nach dem neuen Modell angenommen werden.

## 5. Unveränderbarer Vertragsnachweis

Für neue Preisangebote verwendet `capture_market_contract_snapshot` den eingefrorenen Verkäufer- und Produkt-Snapshot aus dem ursprünglichen Käuferangebot. Es wird nicht erst bei Verkäuferannahme ein inzwischen geänderter Verkäufer-/Listingstand als Vertragsinhalt neu gelesen.

Zusätzlich werden Menge, Warenwert, Versand, Währung und Käuferstatus gegen den eingefrorenen Angebotsstand geprüft. Widersprüche führen fail-closed zu `offer_contract_snapshot_mismatch`.

Historische vorhandene Vertragssnapshots werden durch Schritt 3 nicht umgeschrieben.

## 6. Tests und tatsächliche CI-Evidenz

Neuer isolierter Datenbanktest:

`tests/trade-legal-price-offer-database-test.mjs`

Tatsächlich im erfolgreichen CI-Lauf beobachtetes Ergebnis:

> PASS: price-offer review freezes total/shipping, stale review fails, repeated seller acceptance creates one deal/order

Der Test weist unter anderem nach:
- Review-Gesamtpreis enthält Versand.
- Änderung zwischen Review und Käufer-Senden wird abgewiesen.
- Nach dem Käuferangebot veränderte Listingpreise/Versandkosten ersetzen den eingefrorenen Vertragsstand nicht.
- Verkäuferannahme verwendet den eingefrorenen Warenwert und Versand.
- Wiederholte Verkäuferannahme erzeugt genau einen Deal und genau eine Order.

Weitere im selben Validate-Lauf tatsächlich bestandene relevante Prüfungen:
- 40 Legal-Guard-Assertions,
- 52 Profil-Fixture-Prüfungen,
- 50 Private-Buyer-Checkout-Prüfungen,
- 92 Bestelllese-Grenzen,
- 35 isolierte Private-Buyer-SQL-/Rollenszenarien,
- 4 reale Chromium-Profil/Guard-Szenarien,
- Marketplace-/DOM-/Mobile-/Bestell-/Stripe-/Datenrechte-/Seller-/Notice-Regressionspakete.

GitHub Actions auf `2cab157…`:

| Workflow / Job | Ergebnis |
|---|---|
| Scanner V16 Check #661 · Run `35745101362` | **SUCCESS** |
| validate · Job `106804547100` | **SUCCESS** |
| quota_database · Job `106804547631` | **SUCCESS** |
| collect_f3_database · Job `106804547422` | **SUCCESS** |
| Battle WebRTC Check #137 · Run `35745101502` | **SUCCESS** |
| battle_webrtc · Job `106804549276` | **SUCCESS** |
| spectator_database · Job `106804549721` | **SUCCESS** |

Die zwei bekannten push-only Scanner-Schritte bleiben vom PR-Ereignis abhängig und sind keine neue Scanner-Releasefreigabe.

## 7. Korrekturverlauf

Die Zwischenläufe #654–#660 legten ausschließlich enge Regression-/Fixtureprobleme offen:

- veraltete Loader-Versionserwartung,
- Schritt-2-Fixture erwartete noch `create_market_offer_v2`,
- SQL-Blockdelimiter für den bestehenden Test-Extractor,
- fehlende reale Listing-Spalten in einer synthetischen Fixture,
- fehlerhafte UUID-Interpolation in der neu hinzugefügten Fixture,
- veraltete UI-Selbsttest-Kopie.

Diese Punkte wurden jeweils gezielt korrigiert. Es wurden keine Schutztests abgeschaltet und keine Auth-, Guard-, Staging-, Immutable- oder Replay-Grenzen abgeschwächt.

## 8. Preview und unveränderte Grenzen

Vercel meldet das automatische Preview-Deployment `dpl_4nSdJk825JBdiiXPqLnZbDsaqyQ6` als **READY**, `source=git`, `target=null`, Branch `marketplace-ux-v1`, Quell-SHA exakt `2cab1572eec0e8a83e423c8633dcb57fc14ffa2b`.

Dies ist keine praktische Freigabe des neuen Preisangebotsmodells: Die Legal-Migration ist weiterhin **nicht auf Staging angewandt**, und der vorhandene Guard bleibt deshalb absichtlich geschlossen. Es wurde kein neues Preisangebot, keine Angebotsannahme, Bestellung, Zahlung oder E-Mail auf Staging erzeugt.

Unverändert:
- kein Schema-Freigabemarker,
- keine Migration auf Staging,
- kein Stripe-Sandbox-/Live-Aktivieren,
- keine Payments, Refunds oder Payouts,
- keine E-Mails,
- kein manueller Deploy,
- kein Merge nach `main`,
- keine Änderung an Production/Production-Supabase,
- keine rückwirkende Umklassifizierung historischer Nachweise.

## 9. Fortsetzung

**Schritt 3 ist technisch abgeschlossen: veröffentlicht + vollständige CI PASS.**

Nächster begrenzter Block gemäß V32 ist **Schritt 4 – Festpreisablauf absichern**: durchgehende Snapshot-/Betragsbindung, unbekannte Provider-/RPC-Antworten, sichere Wiederaufnahme/Idempotenz und Parallelität unter echten getrennten PostgreSQL-Verbindungen. Diese Punkte werden nicht aus dem Schritt-3-Ergebnis als bestanden abgeleitet.

Die Gesamtmigration bleibt bis zur Abnahme der vorherigen Blöcke und einem separaten Übernahmeentscheid unangewandt.
