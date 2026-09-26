# DUELVANTA – Schritt 6: finaler Browser-/Dokumentnachweis

23.09.2026, 11:50–11:52 UTC. **GESAMT: PASS im sichtbaren Diagnosemodus v1.1. Beide zuletzt blockierten Browsernachweise geschlossen; Dokumentdownload bereits zuvor PASS. Kein neuer FAIL.**

## Basis und Zielbindung

Repository Bennyescaped/duelvanta, ausschließlich marketplace-ux-v1. Ausgangsremote und Diagnose-Head frisch exakt `260f5f3133e354ae0dd1f875bb623714a77f3897`. V42, Archiv-Live-Nachtest und V41 vollständig im vorausgehenden Diagnoseblock gelesen; V42 bildet die bisherige Live-Basis. Vorheriger Diagnosehead be8d6a6 hatte noch BLOCKIERT/none und verfrühtes runtime-ready; dieser Befund bleibt historisch, er wurde nicht als bestanden umetikettiert.

Aktueller Remote enthält die autorisierte Diagnosekorrektur b30d37e und die zugehörigen Testkorrekturen 82455f5/c5be28e/260f5f3. Keine eigene Codeänderung in diesem Nachtest. Vorbestehende saubere lokale Arbeitskopie und andere Arbeiten nicht überschrieben; Fetch ohne Reset/Branchwechsel. Dokumentationsveröffentlichung ergänzt nur Bericht, V43 und bereinigte Evidenz auf dem aktuellen Remote-Tree.

main frisch unverändert `50f88213571be13255bb52eb489cc28cca660001`. PR #5 offen, draft=true, merged=false. Staging ausschließlich `xhmjxrcskfhbovhitdej`; Production `enifiaqsnqtbzylnfrpi` nur Negativgrenze, keine Verbindung.

Vercel-Connector bestätigt READY, target=null und exakt denselben Commit für Deployment `dpl_GRZaur1M6n6Hf2h2Mcw6npTWrLLy`:

https://duelvantav5vision-8bv09tebl-bennyescaped-3783.vercel.app

Vorhandenes Deployment verwendet, kein Deployment eigens für diesen Test. Autorisierter temporärer Preview-Zugang, Schutz unverändert. Test über `/trade.html?dv_legal_diag=1`. Diagnose ist laut versioniertem Code nur bei environment=preview aktiv; sichtbarer v1.1-Block tatsächlich vorhanden. Keine Production-Verbindung und keine Key-/Tokenausgabe.

## Testrolle und sichtbare Ergebnisse

Vorhandener normaler Staging-Testkäufer, über sichere Work-Anmeldung auf der neuen Preview-Origin angemeldet. Judge ohne Marketplace-Sonderrechte gemäß ausdrücklicher Nutzerbestätigung; keine Owner-/Admin-Ersatzsession. Keine Credentials dokumentiert, keine Registrierung, Passwortänderung oder Magic-Link. Work Cloud Browser, kein TinyFish.

Unmittelbar aus dem sichtbaren DOM abgelesen:

- LIVE-LEGAL-DIAGNOSE · READ ONLY · v1.1
- GESAMT: PASS
- Browser-Session: PASS
- Guard/RPC/Loader: PASS
- Readiness-RPC: GET get_market_legal_schema_readiness_v1
- compatible=true
- revision=trade-legal-contract-model-v1.2

| Private Browser-GET-Probe | Sichtbares Ergebnis |
|---|---|
| dv_market_private.market_contract_snapshots | PASS · HTTP_406/PGRST106 |
| dv_market_private.market_withdrawal_drafts | PASS · HTTP_406/PGRST106 |
| dv_market_private.market_withdrawals | PASS · HTTP_406/PGRST106 |
| dv_market_private.marketplace_message_outbox | PASS · HTTP_406/PGRST106 |

Alle vier direkten GETs mit Accept-Profile=dv_market_private werden auf Schemaebene abgewiesen. Kein ACCESS_ALLOWED, keine privaten Datensätze im Ergebnis. Die vorgesehene Anwendung verwendet die vorhandene Käufer-Session; kein Service-Role-/Admin-Client durch den Test erstellt. Nur angezeigte Status-/Fehlercodes übernommen. Keine internen Browserauthwerte oder privaten Antwortdaten ausgelesen/gespeichert.

## Tatsächliche Trace-Reihenfolge

1. guard/installed
2. guard/state
3. loader/release-start
4. loader/release-state
5. guard/probe-start
6. guard/probe-result
7. guard/state
8. loader/guard-settled
9. loader/loader-start
10. loader/loader-loaded
11. loader/runtime-ready

Der sichtbare Guard/RPC/Loader-PASS prüft im versionierten Diagnosecode den schema-compatible/available=true-Zustand an Position7 und dessen Reihenfolge. Die Trace-Kurzzeile selbst nennt dort nur guard/state. Die Readiness-Zeile zeigt das echte erfolgreiche Probe-Ergebnis samt GET, RPC-Namen und Revision. runtime-ready liegt eindeutig nach probe-result und guard-settled. Kein manuelles Guardsetzen, keine künstliche Antwort, kein Mock/Bypass. Fehler-/Timeoutfälle wurden nicht live injiziert; deren vorhandene CI-Evidenz bleibt getrennt.

## Dokumentdownload: bereits tatsächliches PASS

Vorheriger Nachtest am 23.09.2026 lud aus der bestehenden B2C-Testorder DV-260913-000006 die Datei `DUELVANTA-DV-260913-000006-Bestellbestaetigung.txt` herunter. 719Byte, gültiges UTF-8, nicht leer, keine Ersatzzeichen. Dokumentversion checkout-contract-v1, ausschließlich richtige Orderreferenz, erwarteter B2C-Testprodukttext, Vertragsangaben und SHA-256-Nachweis vorhanden. Kein fremder Orderverweis. Datei-SHA256 `8996d376d69be6d43ceb837b9bdd6c8c77e7b67012d07736ded264117ec3e85a`.

Das Downloadereignis der Browsersteuerung lief damals in einen Timeout; die tatsächlich gespeicherte Datei wurde anschließend lokal read-only geprüft. Das PASS beruht auf der Datei, nicht auf dem Ereignisstatus. Kein erneuter Download oder Vertrag in diesem Block. Keine Personen-/Adressdaten oder vollständige Datei ins Repository kopiert; nur strukturelle Evidenz übernommen. Der Datei-SHA256 ist vom im Dokument enthaltenen Vertragsnachweis-Hash zu unterscheiden.

## Datenzahlen vor/nach

Explizite read-only SQL-Transaktionen ausschließlich auf Staging. Vorher 11:50:58 UTC, nachher 11:52:35 UTC:

| Objekt | Vorher | Nachher |
|---|---:|---:|
| Listings | 14 | 14 |
| Offers | 2 | 2 |
| Deals | 8 | 8 |
| Orders | 6 | 6 |
| Contract snapshots | 8 | 8 |
| Withdrawal drafts | 0 | 0 |
| Withdrawals | 0 | 0 |
| Payment attempts | 2 | 2 |

PostgreSQL17.6. Beide Male Readiness compatible=true / trade-legal-contract-model-v1.2. Migration History unverändert `20260923081953 / trade_legal_contract_model_v1`. Stripe sandbox_enabled=false/live_mode=false vor und nach. Mengenvergleich und ausschließlich lesende Testaktionen; keine allgemeine Behauptung über die Unveränderlichkeit aller einzelnen Datenfelder.

COMPLIANCE_EMAIL_DELIVERY_ENABLED=unset weiterhin **manuell im Vercel-Dashboard bestätigt**, laut Nutzer unter Project und Shared Environment Variables. Kein API-Lesen dieses Werts behauptet. Keine E-Mail-/Dispatch-Probe und kein Dispatch-Secret.

## Abschlussklassifikation und Grenzen

PASS: echte Käufer-Session, Guard-RPC GET mit korrekter Antwort, Loader-Reihenfolge, vier private GET-Abweisungen, vorheriger Dokumentdownload sowie identischer Vor-/Nach-Datenstand. V42-Archiv-Live-PASS und zuvor abgenommene sichere Profil-/Order-/Widerrufs-Lesewege gelten weiter. Kein neuer FAIL.

Weiterhin BLOCKIERT ausschließlich mangels geeigneter vorhandener sicherer Testzustände: neuer Preisangebots-Positivfall, Festpreis-Reservation/Kauf, withdrawal_eligible B2C-Positivfall. Keine künstlichen Testdaten dafür erzeugt. Diese Fälle sind nicht als getestet ausgegeben.

**Schritt 6 – kontrollierte Legal-Gesamtmigration und die tatsächlich prüfbaren Staging-Integrationswege sind technisch abgeschlossen.**

Keine Produktionsfreigabe. Keine Rechtsfreigabe. Keine Stripe-Live-Freigabe. Keine kommerzielle Live-Freigabe. Keine Merge-Freigabe.

Keine erneute Migration, Schemaänderung, Datenreparatur, Marketplace-Aktion, Reservation, Zahlung, Refund, Payout oder Widerruf; keine Compliance-E-Mail. Keine technische Repositoryänderung in diesem Block, keine neue technische CI erforderlich. main und Production durch diesen Block unverändert, PR #5 offen/Draft/unmerged. Nur Dokumentation/Evidenz veröffentlicht; keine manuellen Deployments. Evidenz: `evidence/legal-step6-final-browser-20260923/proof.json`. Nach V43 STOP.
