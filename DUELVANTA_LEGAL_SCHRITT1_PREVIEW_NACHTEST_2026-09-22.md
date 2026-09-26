# DUELVANTA – Legal Schritt 1: angemeldeter Preview-Nachtest

Stand: 22.09.2026 · tatsächlicher manueller Prüfzeitraum ca. 13:03–13:38 CEST  
Repository: `Bennyescaped/duelvanta` · Branch: `marketplace-ux-v1`

**Ergebnis: Der in Masterhandout V32 Abschnitt 5.1 geforderte begrenzte Read-only-Preview-Nachtest ist vollständig PASS. Dies ist keine Rechts-, Gesamt-, Migrations- oder Produktionsfreigabe. Schritt 2 wurde durch diesen Nachweis nicht begonnen.**

## 1. Unveränderte Prüfgrundlage

| Merkmal | Geprüfter Stand |
|---|---|
| Branch-Head vor Dokumentation | `3e688494d1029465e9dc8700a314363f9fd65508` |
| Branch-Head-Einordnung | Erwarteter V32-Dokumentationscommit; Parent ist der technische Schritt-1-Commit |
| Technischer Quellcommit | `822f4b9b32b2d00806ab2c152cbd3d71c5fc688c` |
| Deployment | `dpl_8tMuYUaMHvqppaJwuv95Rw9qGsZE` |
| Deployment-Hostname | `duelvantav5vision-jjo8zo1qr-bennyescaped-3783.vercel.app` |
| Vercel-Metadaten | READY, source=git, target=null, Branch `marketplace-ux-v1`, SHA `822f4b9b…` |
| Staging-Project-Ref | `xhmjxrcskfhbovhitdej` |
| Production-Project-Ref, nur Negativgrenze | `enifiaqsnqtbzylnfrpi` |

Es wurde bewusst das feste technische Deployment geprüft, nicht Production und nicht `duelvanta.de`. Es wurden keine Migration, kein Schema-Freigabemarker, keine Stripe-Aktivierung und kein manueller Deploy ausgelöst.

## 2. PASS/FAIL/BLOCKIERT

| Prüfschritt | Ergebnis | Tatsächliche Evidenz |
|---|---|---|
| Vercel-Preview-Zugang | **PASS** | Geschützte feste Preview wurde nach autorisierter Vercel-Freigabe bis zur DUELVANTA-Anmeldeseite geöffnet. |
| Autorisierte DUELVANTA-Sitzung | **PASS** | Vorhandenes autorisiertes Staging-Testkonto meldete sich an; TRADE und PROFILE wurden geladen. Keine Zugangsdaten wurden dokumentiert. |
| Deployment/Environment | **PASS** | Chrome Network zeigte beim realen Legal-RPC die Request-URL `https://xhmjxrcskfhbovhitdej.supabase.co/rest/v1/rpc/get_my_market_buyer_profile`. Damit ist für den tatsächlich geprüften Legal-/Profilpfad Staging direkt nachgewiesen; kein Production-Endpunkt wurde in diesem Prüfablauf beobachtet. |
| Fehlendes Legal-Schema / Fail-closed | **PASS** | `get_my_market_buyer_profile` antwortete real mit HTTP 404. TRADE zeigte gleichzeitig: „LEGAL-ENTWURF · Neue Vertragsaktionen sind in dieser Vorschau gesperrt. Das Datenbankschema fehlt oder seine Kompatibilität ist nicht bestätigt. Bestehende Bestellungen bleiben einsehbar.“ Es wurde keine Vertragsaktion ausgelöst. |
| Bestehende autorisierte Bestellung lesbar | **PASS** | Vorhandene Staging-Testbestellung `DV-260915-000007` wurde mit Position, Versand, Gesamtbetrag und Status geladen. Keine Bestellung wurde erstellt oder verändert. |
| Bestehender Bestellnachweis lesbar | **PASS** | Read-only-Dialog „Unveränderbare Bestellbestätigung“ öffnete sich; sichtbar waren „1 Vertragsnachweis“, Dokumentversion `checkout-contract-v1` und Hinweis auf gespeicherte SHA-256-Prüfsumme. Kein Download und keine Änderung erforderlich. |
| Normales Profil lädt | **PASS** | Profilidentität, Account/Sicherheit, vorhandene Standardadresse, Collection-Privatsphäre sowie Datenexport/Kontoschließungsbereiche wurden geladen. Keine Profilwerte wurden geändert oder gespeichert. |
| Unfreigegebener Käuferstatus bleibt zu | **PASS** | Käuferstatusbereich war sichtbar, aber mit „Käuferstatus derzeit gesperrt: Das zugehörige Datenbankschema ist nicht bestätigt.“ gekennzeichnet; Speichern wurde nicht ausgelöst. |

**Gesamtergebnis für V32 §5.1: PASS. Kein Prüfschritt FAIL oder BLOCKIERT.**

## 3. Wichtige Beobachtungen

Der reale 404 des noch nicht vorhandenen RPC ist in diesem Stand kein eigenständiger Smoke-Test-Fehler, sondern der erwartete fehlende-Schema-Zustand. Entscheidend für diesen Schritt war, dass der Kompatibilitätsschutz dabei geschlossen blieb, die neue Käuferstatusfunktion nicht freigab und die bereits vorhandenen lesenden Bestell-/Profilpfade weiter funktionierten.

Der Environment-Nachweis stammt aus dem realen Browser-Netzwerkverkehr des geprüften festen Deployments. Er belegt den beobachteten Legal-/Profilpfad gegen `xhmjxrcskfhbovhitdej`. Er ist keine pauschale Aussage über beliebige nicht aufgerufene zukünftige Pfade; das bestehende Environment-Routing-Hardening bleibt dafür die Code-/Regressionsebene.

## 4. Unveränderte Grenzen

- Keine neue Bestellung, kein Preisangebot, keine Angebotsannahme und keine Zahlung.
- Keine Storno-, Widerrufs-, Versand-, Adress-, Profil- oder Käuferstatusänderung.
- Keine neuen Testkonten oder Testdaten.
- Keine Migration und kein Schema-Freigabemarker.
- Keine Stripe-Aktivierung; keine Payments, Refunds oder Payouts.
- Keine E-Mails.
- Kein manueller Vercel-Deploy.
- `main`, Production und Production-Supabase unverändert.
- PR #5 bleibt Draft und unmerged.
- COLLECT-/BATTLE-Abnahmen und Scanner-Release-Gate wurden nicht erneut geöffnet.
- Keine Rechts- oder Produktionsfreigabe aus diesem Smoke-Test.

## 5. Folgestatus

Der zuvor in V32 dokumentierte Status **„VERÖFFENTLICHT + CI PASS / PREVIEW OFFEN“** kann für Schritt 1 nun präzisiert werden zu:

**SCHRITT 1: VERÖFFENTLICHT + CI PASS + ANGEMELDETER READ-ONLY-PREVIEW-NACHTEST PASS.**

Damit ist ausschließlich das in V32 definierte Ausstiegskriterium vor Schritt 2 erfüllt. Schritt 2 ist weiterhin ein separater, begrenzter Arbeitsblock und wurde in diesem Nachtest nicht vorweggenommen. Die unangewandte Legal-Migration bleibt unangewandt; aus diesem Ergebnis folgt keine Gesamt-, Rechts- oder Produktionsfreigabe.
