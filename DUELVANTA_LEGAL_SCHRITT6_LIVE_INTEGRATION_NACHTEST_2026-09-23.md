# DUELVANTA – Schritt 6: Live-Integrationsnachtest

**Aktueller Stand 09:11 UTC: Anmeldung erfolgt, Lesewege teilweise PASS; reproduzierbarer Archiv-Order-FAIL, deshalb STOP. Verbindlicher Nachtrag am Ende.**

Historischer erster Durchlauf: 23.09.2026, 08:43 UTC. Die damalige Klassifikation ist durch den nachstehenden angemeldeten Nachtrag teilweise überholt. **Live-Basis PASS; Preview-Zugang bis zur DUELVANTA-Loginseite PASS; angemeldete Integration BLOCKIERT mangels sicherer vorhandener Testsession. Kein beobachteter Anwendungs-FAIL, aber keine vollständige Integrationsabnahme.**

## Verbindliche Basis und Git

V39, Staging-Migrationsabnahme, V38 und Katalog-/Readiness-Fixbericht vollständig gelesen. V39 bleibt maßgeblich für die bereits erfolgreich angewandte Migration. Ausgangs-Remote-Head frisch exakt `464408a05f5bca25fa5e01c852dd8fac8976732f`, Branch ausschließlich `marketplace-ux-v1`, Repository `Bennyescaped/duelvanta`. Technischer Kandidatenhead `91bad0f6546d579f4d8adc99f26027e45a36e891` unverändert.

main remote `50f88213571be13255bb52eb489cc28cca660001`. PR #5 open, draft=true, merged=false. Arbeitskopie zu Beginn sauber; lokaler Dokumentationshead `396423ebb1ba9d2b03fef61f8bfaace5ca06256f` und Remote haben identischen Tree `48f6deacc654e04a3d9778ce84641eaaeef67b69`. Unterschiedliche Commit-IDs stammen aus vorheriger API-Veröffentlichung; keine Dateidifferenz. Fetch ohne Reset/Branchwechsel. Vorbestehende Arbeitskopien/Sicherungen nicht verändert. Dieser Block ergänzt ausschließlich Dokumentation/Evidenz.

## Frische Live-Basis

Ausschließlich Staging `xhmjxrcskfhbovhitdej`, SQL jeweils in `BEGIN READ ONLY`. Production `enifiaqsnqtbzylnfrpi` ausschließlich Negativgrenze, keine Verbindung.

- PostgreSQL 17.6.
- Migration History bestätigt: `20260923081953 / trade_legal_contract_model_v1`.
- Readiness vor und nach Browserprüfung: `compatible=true`, `revision=trade-legal-contract-model-v1.2`.
- Stripe vor/nach: `sandbox_enabled=false`, `live_mode=false`.
- Private Tabellen-Grants an anon/authenticated: 0; Schema-USAGE für beide Rollen false. Dies ist eine Katalogprüfung über den SQL-Connector, **kein Zugriffstest einer angemeldeten Browserrolle**.
- Weiterhin sieben C2C- und ein B2C-Snapshot, sämtlich `checkout-contract-v1`, `withdrawal_eligible=false`. Null `price-offer-contract-v1`-Snapshots und null berechtigte Widerrufssnapshots.

Die Migration wurde nicht erneut angewandt. Unveränderter angewandter Kandidat: `supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql`, Blob `c7b5df68a6d4dd37804e0efd59f9a076957b3dc8`, SHA256 `c7d061943629d692ada147ba27c9909105507929756deacc6a3a8cedb259b5c6`. Die vollständige 266/266-Katalogabnahme und der Katalog-SHA256 `f8e0e4cf5e000d60776a26e5bbd5275318fde632d8e3f55c5bd9a6cf42a33604` bleiben V39-Evidenz; hier wurde die echte Readiness erneut ausgeführt, kein neuer vollständiger Fingerprintvergleich behauptet.

## Preview und Authentisierung

Vorhandenes READY-Preview-Deployment `dpl_36h91ZCxYFKV54erdj8wruQmUq78`, target=null, Branch marketplace-ux-v1, Commit `464408a05f5bca25fa5e01c852dd8fac8976732f`.

URL: https://duelvantav5vision-ig00rh9hf-bennyescaped-3783.vercel.app

Read-only Runtime-GET über autorisierten Vercel-Connector: HTTP 200, `environment=preview`, Supabase-URL ausschließlich `https://xhmjxrcskfhbovhitdej.supabase.co`, Cache-Control private/no-store. Kein Schlüssel dokumentiert.

Temporärer autorisierter Share-Link öffnete die Landingpage. Anschließender normaler Klick auf LOGIN öffnete erfolgreich `/login.html`, Titel „Login · DUELVANTA“. Damit ist die frühere V39-Zugangssperre für diese Navigation überwunden. Deployment-Schutz unverändert, kein neues Deployment für diesen Test ausgelöst. Temporärer Zugangstoken nicht dokumentiert.

Die vorhandenen Browser-Tabs hatten keine angemeldete DUELVANTA-Sitzung; die Preview zeigt das Zugangformular mit leerem E-Mail-/Passwortfeld. Keine sichere vorhandene Käufer-Testsession verfügbar. **Verwendete Browserrolle: nicht angemeldet; kein Käuferkonto verwendet.** Keine Credentials, keine Admin-/Owner-Ersatzsession, kein neuer Nutzer, kein Passwort-Reset, kein Magic-/E-Mail-Link, kein Formular abgesendet.

Im tatsächlichen Login-DOM referenzierte Skripte: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`, `/api/compliance-message-dispatch?runtime_config=1`, `https://vercel.live/_next-live/feedback/feedback.js`. Kein ausgeliefertes TRADE-Guard-/Loader-Asset erreicht; dessen tatsächliche Version und Cachezustand deshalb nicht abgenommen. Version 1.2 aus dem technischen Stand wird nicht als Browsernachweis umetikettiert.

## Einzelklassifikation

| Teil | Status | Tatsächlicher Umfang / Grenze |
|---|---|---|
| A Git, History, Readiness, Stripe | PASS | Frisch read-only bestätigt |
| B Preview-Zugang und Runtime | PASS | Vorhandene Preview, Landingpage und Login erreichbar; ausschließlich Staging |
| C Authentisierte Käufer-Testsession | BLOCKIERT | Keine sichere bestehende Sitzung verfügbar |
| D Live-Guard / Loader / Cache | BLOCKIERT | Kein angemeldeter TRADE-Aufruf; kein Mock, Marker oder Bypass |
| E Profil / Privatkäufer | BLOCKIERT | Keine Käufer-Sitzung; keine Profiländerung |
| F Orders / Details / Contract Documents | BLOCKIERT | Keine Käufer-Sitzung; keine Aussage über Darstellung, zweite Checkout-Aktion oder Duplikate aus bloßen Gesamtzahlen |
| G Private Tabellen im normalen Browser | BLOCKIERT | Kataloggrenzen PASS; direkte Browserzugriffe auf market_contract_snapshots, market_withdrawal_drafts, market_withdrawals und marketplace_message_outbox sowie sichere RPC-Lesewege nicht getestet |
| H Bestehende Preisangebote / Legacy fail-closed | BLOCKIERT | Keine Sitzung; positiver neuer Snapshot zusätzlich nicht vorhanden; keine Angebotserstellung oder Annahme |
| I Festpreis-Review vor Bindung | BLOCKIERT | Kein angemeldeter Kaufdialog geöffnet; keine Reservation, keine Bestellung, keine Legacy-RPC ausgelöst |
| J C2C / alter B2C ohne Widerruf | BLOCKIERT | Datenbestand bestätigt; Buttondarstellung nicht getestet |
| J B2C-Widerruf positiv | BLOCKIERT | Kein berechtigter vorhandener Snapshot; keiner erzeugt |
| K Stripe OFF / E-Mail OFF | PASS | Stripe frisch read-only; E-Mail manuelle Nutzerevidenz wie unten |
| L Datenzahlen vor/nach | PASS | Alle angeforderten Zahlen unverändert; kein vollständiger Netzwerk-Trace behauptet |
| M Klassifikation | PASS | Keine BLOCKIERT-Prüfung als bestanden dargestellt; kein beobachteter reproduzierbarer FAIL |

## Datenvergleich und Seiteneffekte

| Objekt | Vorher 08:41:47 UTC | Nachher 08:43:02 UTC |
|---|---:|---:|
| Listings | 14 | 14 |
| Offers | 2 | 2 |
| Deals | 8 | 8 |
| Orders | 6 | 6 |
| Contract snapshots | 8 | 8 |
| Withdrawal drafts | 0 | 0 |
| Withdrawals | 0 | 0 |
| Payment attempts | 2 | 2 |

Stripe-Konfiguration ebenfalls unverändert false/false. Nur Landing-/Login-Navigation und read-only Abfragen ausgeführt. Kein wirtschaftlicher Handler aufgerufen. Gleichbleibende Zahlen belegen keine allgemeine Unveränderlichkeit jeder einzelnen Zeile; sie sind der angeforderte Mengenvergleich für den tatsächlich begrenzten Testumfang. Keine Checkout Session, Payment API, Zahlung, Refund, Payout oder Widerruf. Kein Cleanup und keine Datenkorrektur.

`COMPLIANCE_EMAIL_DELIVERY_ENABLED=unset`: **manuell im Vercel-Dashboard bestätigt**, laut Nutzer am 23.09.2026 unter Project Environment Variables (All Environments, Suche COMPLIANCE: No Results Found) und Shared Environment Variables. Kein Connector-/API-gelesener Environment-Wert. Default-off unverändert; keine Variable verändert, keine POST-Probe, kein Dispatch-Secret und keine E-Mail.

## Abschluss und verbleibende Grenze

Evidenz: `evidence/legal-step6-integration-20260923/live-readonly.json` enthält bereinigte Vor-/Nachwerte, SQL und Preview-Zuordnung ohne Credentials/Share-Token. Keine technische Repositoryänderung, deshalb keine zusätzliche technische CI notwendig. V38 Scanner #685 / 35832063879 und Battle #161 / 35832063873 bleiben technische Kandidatenevidenz, keine angemeldete Live-Integration.

main unverändert, Production durch diesen Block unverändert und nicht verbunden, PR #5 offen/Draft/unmerged. Kein Merge, Force-Push, Production-Deploy oder Schemaeingriff. Die Dokumentationsveröffentlichung kann die bestehende automatische Preview-CI auslösen; kein Deployment wurde eigens für den Test angefordert.

**Schritt 6 erhält hier keine vollständige technische Integrationsabschlussaussage.** Die Migration bleibt erfolgreich abgenommen; die wesentlichen angemeldeten Wege sind weiterhin offen. Für deren Fortsetzung wird eine sicher vorhandene normale Staging-Käufer-Testsession benötigt. Fehlende positive Preisangebots-/Widerrufsfixtures bleiben zusätzlich BLOCKIERT. Keine künstlichen Testdaten erzeugen. V40 erstellen, danach STOP. Keine Produktions-, Rechts-, Stripe-Live-, Merge- oder kommerzielle Freigabe.

## Verbindlicher Nachtrag: angemeldeter Test, 09:08–09:11 UTC

**FAIL – Archivierte Order lässt sich über „ORDER ÖFFNEN“ nicht sichtbar öffnen. Nach zweimaliger Reproduktion STOP, keine Reparatur.** Dieser Nachtrag hat Vorrang vor den historischen BLOCKIERT-Aussagen des ersten Durchlaufs.

Ausgangsremote dieser Fortsetzung frisch `8ea7964143e790336d0a736fb893477ee571e3d5`; main weiterhin `50f88213571be13255bb52eb489cc28cca660001`. Vorhandene Preview unverändert `dpl_36h91ZCxYFKV54erdj8wruQmUq78` auf 464408a; zwischenzeitlicher Remote-Commit ausschließlich Dokumentation. Nutzer hat sich über die sichere Anmeldefunktion mit dem bereits vorhandenen Testkäufer angemeldet und bestätigt: Judge, keine zusätzlichen Marketplace-Rechte. Kein Admin-/Owner-Ersatz. Keine Credentials dokumentiert. Sichtbarer DOM-Freigabestatus `internal-preview`, kein `owner-bypass`.

| Teil | Aktueller Status | Frische Evidenz / verbleibende Grenze |
|---|---|---|
| Anmeldung | PASS | Angemeldeter bestehender Testkäufer, sichtbarer Accountbereich und Abmelden |
| Profil | PASS | Gewöhnliche Identitäts-/Adressfelder geladen; keine Business-Buyer-Auswahl oder zweites Käuferprofil; nichts gespeichert |
| TRADE-Leseansicht | PASS | Marketplace, Bestellungen, Preisangebote und Archiv laden |
| Guard/Loader-Assets | PASS im Teilumfang | DOM referenziert trade-legal-readiness.js?v=1.2, trade-release-gate.js?v=1.4, trade-orders.js?v=1.9, trade-checkout.js?v=2.2; Runtime-Handler vorhanden, kein Schema-Sperrhinweis |
| Exakter Browser-RPC-/Guard-Zustand und Reihenfolge | BLOCKIERT | Kein Zugriff auf versteckte JS-Zustände/Tokens, kein Browser-Netzwerkbeleg; SQL-Readiness true ersetzt ihn nicht. Keine Fail-closed-Fehler künstlich injiziert |
| Aktive Orders | PASS | Drei verschiedene bestehende Ordernummern 000007, 000006, 000004 mit Details sichtbar; keine zweite Checkout-Aktion sichtbar |
| Bestellbestätigung | PASS im Teilumfang | Bei B2C-Order DV-260913-000006 lädt Dialog einen Vertragsnachweis, checkout-contract-v1, Downloadaktion vorhanden. Dateiinhalt/Download nicht abgenommen |
| Archivierte Order öffnen | FAIL | DV-260917-000010 zweimal aus Archiv angeklickt; Bestellseite zeigt nur aktive Orders, Zielorder bleibt unsichtbar |
| Private Browsertabellen-Zugriffsprobe | BLOCKIERT | Vor STOP nicht ausgeführt; historische Katalogprüfung bleibt getrennt |
| Preisangebote | PASS für leeren aktiven Lesezustand | „Keine aktiven Vorgänge“; keine Darstellung eines geeigneten bestehenden Angebots nachgewiesen, Positivfall BLOCKIERT |
| Festpreis-Review | BLOCKIERT | Markt zeigt „Noch keine passenden Angebote“; kein Kaufdialog und keine Reservation ausgelöst |
| C2C / alter B2C | PASS im sichtbaren Umfang | Bei den sichtbaren alten Orders kein Widerrufsbutton; kein aktiver elektronischer Widerruf beim alten B2C-Vertrag |
| B2C positiv / neuer Preisangebotssnapshot | BLOCKIERT | Geeignete bestehende Zustände fehlen weiterhin |
| Stripe / Datenvergleich | PASS | Frische Vor-/Nachwerte unverändert, siehe unten |

### Reproduzierbarer FAIL und Abbruch

1. Angemeldet TRADE → ARCHIV: drei abgeschlossene Orders sichtbar, darunter DV-260917-000010.
2. Bei dieser Order „ORDER ÖFFNEN“ klicken.
3. Wechsel zur Ansicht „Käufe und Verkäufe“, aber Zielorder nicht sichtbar; kein Dialog geöffnet.
4. Über ARCHIV denselben vorhandenen Eintrag erneut öffnen: gleiches Ergebnis.

DOM bestätigt `targetVisible=false`, `openDialogs=0`. Die Ordernummer ist zwar in versteckten DOM-Elementen vorhanden, nicht im sichtbaren Seitentext. Deshalb kein Datenverlust behauptet. Read-only Quelleneingrenzung: trade-search-archive.js ruft DV_TRADE_ORDERS.open(id); trade-orders.js wechselt zu orders/renderOrders(id). Vermutung: Zusammenspiel mit Ausblendung abgeschlossener Orders; Ursache noch nicht abschließend isoliert. Keine spontane Code-/Schema-/Datenreparatur. Keine weiteren funktionalen Tests nach der Reproduktion, nur read-only Abschlusszählung und Dokumentation.

Vorher 09:08:25 UTC / nachher 09:11:14 UTC jeweils: Listings14, Offers2, Deals8, Orders6, Contract snapshots8, Withdrawal drafts0, Withdrawals0, Payment attempts2. Readiness beide Male compatible=true / trade-legal-contract-model-v1.2. Migration History unverändert 20260923081953 / trade_legal_contract_model_v1. Stripe false/false. E-Mail weiterhin ausschließlich manuell bestätigtes unset gemäß Nutzerevidenz, keine POST-Probe.

Keine wirtschaftlichen Aktionen, Formularbestätigungen, Profiländerungen, Reservationen, neuen Angebote/Deals, Payments, Refunds, Payouts oder E-Mails. Keine erneute Migration. Evidenz: evidence/legal-step6-integration-20260923/authenticated-followup.json. Nur Dokumentationsnachtrag, keine technische CI als neue Live-Abnahme ausgegeben. main/Production unverändert, PR #5 offen/Draft/unmerged. Schritt 6 nicht vollständig abgeschlossen; separater Fixauftrag für den reproduzierten Archivfehler erforderlich. Danach erneuter gezielter Nachtest. STOP.
