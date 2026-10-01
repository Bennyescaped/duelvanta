# DUELVANTA – Legal Schritt 2: bestehenden Privatkäuferzugang wiederverwenden

Prüfdatum: **22.09.2026**. Repository: `Bennyescaped/duelvanta`. Einziger Entwicklungsbranch: `marketplace-ux-v1`.

**Status: Schritt-2-Patch veröffentlicht, Scanner CI #651 und Battle CI #127 erfolgreich. Die Legal-Migration bleibt unangewandt. Ein angemeldeter Nachtest der neuen Preview ist noch nicht durchgeführt. Keine Gesamt-, Rechts-, Migrations- oder Produktionsfreigabe; Schritt 3 wurde nicht begonnen.**

## 1. Verbindliche Grundlage und Git-Stand

V32 bleibt verbindlich. Vollständig gelesen wurden V32, der Schritt-1-Veröffentlichungs-/CI-Bericht und der anschließende manuelle Preview-Bericht. Dieser Bericht ergänzt ausschließlich den nun beauftragten Schritt 2; er ersetzt keine anderen V32-Abnahmegrenzen.

| Kennung | Bedeutung |
|---|---|
| `43df268446ee7d075319d89721e919701cd238e5` | Erneut gelesener Ausgangs-Head; dokumentierter Schritt-1-Preview-Nachtest |
| `3e688494d1029465e9dc8700a314363f9fd65508` | V32-Dokumentations-Head darunter |
| `822f4b9b32b2d00806ab2c152cbd3d71c5fc688c` | Vorheriger technischer Schritt-1-Stand |
| `92518079021369e64b2719c55fc86d4494dd5ae4` | Schritt-2-Anwendungs-/SQL-/Testpatch, 13 Zielpfade |
| `6ed31d7c9b9c9076968d5220bee236a21ca9cc3e` | Abschließend CI-geprüfter technischer Head einschließlich vier enger Testkorrekturen |
| `036278ffb7f0743dc34629ea80683f25d41e5690` | Synthetischer PR-Test-Merge; Vergleich zum technischen Head: keine Dateidifferenz |
| `50f88213571be13255bb52eb489cc28cca660001` | Nach den technischen Veröffentlichungen unveränderter main-Head |
| PR #5 | Erneut gelesen: offen, Draft, unmerged; Ziel main unverändert |

Die fünf technischen Commits sind Nachfolger von `43df268…`. Die Gesamtdifferenz umfasst **17 Pfade: fünf Browser-/Loaderdateien, den unangewandten SQL-Entwurf und elf Testdateien**. Die vier Folgecommits ändern ausschließlich Tests; Anwendungs- und SQL-Inhalte bleiben auf dem Stand von `9251807…`. Der Dokumentationscommit dieses Berichts ist davon getrennt.

In den zugänglichen lokalen Arbeitsbereichen wurde keine bestehende Git-Arbeitskopie gefunden. Verwendete Originaldateien wurden separat und schreibgeschützt unter `/mnt/data/duelvanta_step2/original` gesichert, Änderungen unter `work` vorbereitet. Die 13 ersten veröffentlichten Git-Blob-IDs wurden gegen die lokalen Bytes geprüft. Vier spätere Testkorrekturen wurden gegen die jeweils zuvor über GitHub gelesenen Original-Blobs veröffentlicht. Keine alte `work`-/Codex-Arbeitskopie übernommen, kein Reset, Force-Push oder Branchwechsel.

## 2. Begrenzte Änderung

### 2.1 Unangewandter Datenbankentwurf

Aus `supabase/migrations/20260921190000_trade_legal_contract_model_v1.sql` entfernt wurden die zusätzliche Tabelle `market_buyer_profiles`, deren Getter/Setter, der dazugehörige separate Löschhelfer sowie die neuen Geschäftskäufer-Klassifikationen B2B/C2B.

`dv_market_private.require_market_buyer_type(p_buyer_id)` verwendet jetzt die bestehende `require_trade_eligibility(p_buyer_id,true)`. Volljährigkeit, Deutschland und die vorhandene ausdrückliche Privatkäuferbestätigung werden nicht ersetzt oder automatisch gesetzt. Ergänzend wird am tatsächlichen Käuferprofil geprüft, ob der Account aktiv/beta und nicht sicherheits-, schließungs- oder verarbeitungsgesperrt ist. Verkäufer- und Service-Aufrufe dürfen nicht versehentlich die Berechtigung des Aufrufers statt des Käufers verwenden.

Neue unterstützte Klassifikationen sind ausschließlich `private + consumer → c2c` und `trader + consumer → b2c`. Unbekannte Kombinationen werden nicht auf eine erlaubte Klasse zurückgeführt. Dies bildet den bestehenden technischen Release-Scope ab und ist keine neue rechtliche Entscheidung über den Verbraucherstatus oder einen Ausschluss von Schutzrechten.

Neue Angebotssnapshots enthalten nur den bestätigten privaten Käuferstatus. Die neuen Annahme-/Snapshot-Pfade lehnen fehlende oder inkompatible Angebotssnapshots ab. Historische NULL-Angebotssnapshots werden nicht stillschweigend nachklassifiziert. Bestehende Vertragsnachweise bleiben einschließlich Text, Prüfsumme, Zeitpunkt und Klasse unverändert; vorhandene Replay-Grenzen bleiben erhalten.

**SQL-Datei nur geändert, nicht angewandt.** Git-Blob: `d9c13714c92c947490afb92a85ebc4c94d9ab528`. SHA-256: `2be33f4285dbee35f28e1d09bc2f5757a5739964fc32050211a6757d5423236a`.

### 2.2 Profil, Checkout und Schutz

Die doppelte Auswahl „privat / geschäftlich kaufen“ einschließlich Speichern und optionaler Käuferprofilabfrage wurde aus `profile.html`/`profile.js` entfernt. Normale Profil-, Adress-, Sicherheits- und Privatsphäre-Funktionen bleiben bestehen. Es wurde keine zweite Bestätigung in das Profil eingebaut; der vorhandene TRADE-Berechtigungsablauf bleibt zuständig.

`trade-checkout.js` akzeptiert für neue Checkout-Reviews nur `buyer_type='consumer'` mit `c2c` oder `b2c`. Unvollständige oder geschäftliche Review-Antworten bleiben gesperrt; Fehlermeldungen verweisen auf den bestehenden TRADE-Zugang. Betrags-, Provider-, Vertragsereignis- und Wiederaufnahmelogik wurden in diesem Block nicht weiterentwickelt.

Cacheversionen wurden in tatsächlich ausgeführtem Loader und HTML-Manifest abgeglichen: Profil `1.5`, Checkout `2.1`, Release-Loader `1.3`.

**Der Schritt-1-Schema-Guard selbst bleibt unverändert (Version 1.1).** Er prüft weiterhin ausschließlich lesend `get_my_market_buyer_profile` mit `{get:true}` und verlangt seinen exakten versionierten Kompatibilitätsnachweis. Es wurde kein Ersatz-Getter, kein Schema-Freigabemarker und keine Freischaltung ergänzt. Auch der jetzige unangewandte Entwurf öffnet den Guard daher nicht. Ein späterer vollständiger Kandidat benötigt eine gesondert geprüfte, versionierte Readiness-Lösung; die vorhandene Privatkäuferberechtigung allein darf nicht als Legal-Schemafreigabe dienen.

## 3. Ausgeführte Tests und Ergebnisse

| Prüfumfang | Ergebnis | Nachweisgrenze |
|---|---|---|
| Lokale Syntax- und Dateiidentitätsprüfung | PASS | 13 initiale Patchdateien; keine gemeinsame Datenbank |
| Tatsächliches Profilskript mit strikten DOM-/Service-Fixtures | PASS, 52 Prüfungen | Profilstart, vorhandene Lesepfade, Fehler-/Login-/Konfigurationsgrenzen; keine zweite Käuferabfrage/Bestätigung |
| Private Checkout-Review-Prädikate und Handler | PASS, 50 Prüfungen | Gültige private Reviews; fehlende/falsche/geschäftliche Reviews gesperrt; keine Provideraufrufe |
| Neue SQL-/Rollenszenarien | PASS, 35 Szenarien in CI | Tatsächliche Funktionen in isoliertem PGlite; anon/authenticated/service_role; kein Staging |
| Neues Profil/Guard in Chromium | PASS, 4 Szenarien | 390 und 1363 CSS-Pixel, fehlendes Schema und explizit synthetische Kompatibilität; tatsächliches Profil-HTML/-JS, Services als Fixtures |
| Vorhandene Guard-/Bestellleseprüfungen | PASS | 40 Guard- und 92 Bestellleseprüfungen; neue Käuferwahl nicht mehr Bestandteil des tatsächlichen Profils |
| Vollständiger bestehender validate-Job | PASS | TRADE-DOM/Browser, Guard-/Bestellbrowser, Runtime-/Datenrechte-/Marketplace-Regressionen und nachfolgende COLLECT-/Mobile-Prüfschritte |
| Bestehende native Datenbankjobs | PASS | Isolierte PostgreSQL-Regressionsjobs; keine neue praktische COLLECT-/BATTLE-Abnahme |
| Angemeldeter Nachtest der neuen Preview | **OFFEN / nicht durchgeführt** | Keine Übertragung des alten Schritt-1-Screenshot-PASS auf den neuen Quellstand |
| Anwendung der Legal-Migration auf Staging | **Nicht durchgeführt, weiterhin gesperrt** | Separater späterer Übernahmeentscheid erforderlich |

Die 35 neuen SQL-Szenarien prüfen unter anderem fehlende Anmeldung/Berechtigung, Alters-/Ländergrenzen, fehlende Privatkäuferbestätigung, Account-Sperren, erlaubte Beta-Konten, private/gewerbliche Verkäufer bei privatem Käufer, neue Consumer-Snapshots, geschützte private Funktionen/Tabellen sowie unveränderte historische Nachweise. Ein Service-Aufrufer ohne eigene Käuferkennung kann einen gesperrten tatsächlichen Käufer nicht umgehen. Die ausdrückliche bestehende Käuferbestätigung wird wiederverwendet, ihre Daten/Zeitstempel werden durch Review/Angebot nicht verändert.

Das ist **kein Test der gesamten neuen Migration** und kein nativer Mehrverbindungs-/Parallelitätsnachweis für die offenen Festpreisprozesse. Es wurden gezielt tatsächliche Schritt-2-Funktionen und bestehende Tabellen-/RPC-Definitionen in einer isolierten Fixture-Umgebung ausgeführt. Annahme-/Snapshot-/Provider-Zeitpunkte, verlorene Antworten und Widerruf bleiben im V32-Folgeumfang offen.

## 4. GitHub-CI und Korrekturverlauf

| Endlauf auf `6ed31d7…` | Ergebnis |
|---|---|
| Scanner V16 Check #651, Run `35730092667` | SUCCESS |
| validate, Job `106753224816` | SUCCESS |
| quota_database, Job `106753224283` | SUCCESS |
| collect_f3_database, Job `106753224685` | SUCCESS |
| Battle WebRTC Check #127, Run `35730092747` | SUCCESS |

Die neuen Tests werden vom bereits vorhandenen `trade-legal-contract-model-test.mjs` geladen. Workflow, CI-Abhängigkeiten und Lockdateien wurden nicht verändert. Die zwei bestehenden push-only-Prüfschritte für echte Kartenreferenzen/Live-Katalog wurden im PR-Ereignis erwartungsgemäß übersprungen; das Scanner-Release-Gate bleibt unverändert.

Die Zwischenläufe Scanner #647–#650 waren nicht grün. Sie stoppten nacheinander an veralteten Cache-/Versionsassertionen bzw. der früher erwarteten B2B/C2B-Klassifikation. Korrigiert wurden ausschließlich die passenden Erwartungen in `trade-marketplace-ux-contract-test.mjs`, `trade-legal-readiness-test.mjs`, `market-checkout-compliance-contract-test.mjs` und `supabase-runtime-config-test.mjs`. Die Geschäfts-Käufer-Korrektur enthält zusätzlich eine ausdrückliche Negativprüfung auf den entfernten Scope. Keine Testabschaltung und keine Abschwächung von Auth-, Unveränderbarkeits- oder Environment-Grenzen.

Artefakt des erfolgreichen Endlaufs: `v16-mobile-recognition`, ID `10694484229`, 6.260.481 Bytes. Von GitHub gemeldeter Archiv-Digest: `sha256:fe86d76bd846abb607cb663c930a26cc6c6d40e836a93fced1922e3a0b3d5d07`. Metadaten wurden gelesen; das Archiv wurde in diesem Block nicht heruntergeladen. Neue Ergebnisdateien werden unter `test-results/trade-legal-step2/` erzeugt. Die Einzelzähler wurden bereits in den tatsächlichen CI-Logs der identischen neuen Testdateien beobachtet; der Endlauf bestätigte danach den vollständigen Job.

## 5. Automatische Preview und verbleibender Nachtest

| Merkmal | Tatsächlich gelesener Stand |
|---|---|
| Deployment | `dpl_4pLcvd4917tie4UDAasZA2A1Q3rH` |
| Fester Host | `duelvantav5vision-5r81q7fcp-bennyescaped-3783.vercel.app` |
| Quell-SHA | `6ed31d7c9b9c9076968d5220bee236a21ca9cc3e` |
| Zustand / Herkunft | READY, source=git, target=null, Branch marketplace-ux-v1 |
| Projekt / Team | `prj_dAtH0I1mwiHhOsA64J3iq97SoVnd` / `team_VHCwSwfBWANJvmS3qdkpJ0dK` |
| Browserzugang in diesem Block | Keine angemeldete neue Preview-Abnahme; TinyFish nicht verwendet |

READY ist nur Deployment-Metadaten-Evidenz. Der manuelle Nachweis aus Schritt 1 gilt für `822f4b9b…`, nicht automatisch für diesen neuen Stand. Ein nachfolgender begrenzter Read-only-Nachtest muss auf der neuen, quellgeprüften Preview insbesondere das normale Profil ohne doppelte Käuferstatusauswahl, den weiter geschlossenen Legal-Guard und die vorhandene Bestell-/Nachweiseinsicht kontrollieren. Keine Käuferbestätigung, Bestellung, Zahlung oder sonstige Datenänderung dafür auslösen. Der Branch-Alias kann durch diesen Dokumentationscommit erneut weiterwandern.

## 6. Unveränderte Grenzen / Übergabe

main und PR-Status wurden nach der technischen Veröffentlichung erneut gelesen: main unverändert, PR #5 offen/Draft/unmerged. Keine Aktionen auf Production oder Production-Supabase. Keine gemeinsame DB-Abfrage oder DB-Änderung in diesem Block, keine Migration, kein Marker, keine Stripe-Aktivierung, keine echten Payments/Refunds/Payouts/E-Mails und kein manueller Deployment-Auftrag. Eine erneute Inventur von Staging-DB-Werten wurde nicht vorgenommen.

COLLECT-/BATTLE-Laufzeitcode, bisherige Abnahmen und Scanner-Release-Gate wurden nicht angefasst. Die existierende Käuferberechtigung und die alte Step-1-Transportdatei wurden nicht ersetzt. Keine historischen Bestellungen oder Vertragssnapshots umgeschrieben. Keine Rechtsentscheidung ergänzt.

**Fortsetzungsstand: Schritt 2 implementiert/veröffentlicht + CI PASS; neue angemeldete Preview-Prüfung offen; gesamte Legal-Migration weiterhin unangewandt. Schritt 3 und die übrigen V32-Folgeblöcke nicht begonnen.**

## Quellen

- Vorgaben: `DUELVANTA_MASTERHANDOUT_V32_2026-09-22.md`, insbesondere 7.2 und 10.
- Vorabnahme: `DUELVANTA_LEGAL_SCHRITT1_PREVIEW_NACHTEST_2026-09-22.md`.
- Patch: https://github.com/Bennyescaped/duelvanta/commit/92518079021369e64b2719c55fc86d4494dd5ae4
- Gesamtvergleich: https://github.com/Bennyescaped/duelvanta/compare/43df268446ee7d075319d89721e919701cd238e5...6ed31d7c9b9c9076968d5220bee236a21ca9cc3e
- Scanner #651: https://github.com/Bennyescaped/duelvanta/actions/runs/35730092667
- Battle #127: https://github.com/Bennyescaped/duelvanta/actions/runs/35730092747
- PR: https://github.com/Bennyescaped/duelvanta/pull/5
