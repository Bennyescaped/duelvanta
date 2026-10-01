# DUELVANTA – MASTERHANDOUT V61

25.09.2026. **P0-05 als versionierter Branch-Kandidat veröffentlicht und isoliert einschließlich nativer PostgreSQL-17-CI PASS. Kein Production-/Staging-Rollout. STOP.**

## Verbindlichkeit und Auftrag

Dieses Handout und `DUELVANTA_PRODUCTION_P0_05_ABSCHLUSS_2026-09-25.md` vollständig lesen. V59 bleibt für alle nicht ausdrücklich fortgeschriebenen Anforderungen verbindlich. V60 und `DUELVANTA_PRODUCTION_P0_05_TRADE_LOCK_2026-09-25.md` dokumentieren die vorausgehende lokale Implementierung; deren Veröffentlichungs-/Native-CI-Blocker sind jetzt erledigt. V59/P0-04, V57/P0-01 und V55/V56 behalten ihre übrigen Grenzen und NO-GO-Bedingungen.

Der Folgeauftrag autorisierte ausschließlich Veröffentlichung des getesteten P0-05-Kandidaten auf `marketplace-ux-v1`, vollständige Scanner-/Battle-/native-PG17-CI, gegebenenfalls minimale Korrekturen und danach Abschluss/Handout. Automatische Vercel-Previews ausdrücklich erlaubt. Production-Deployment, Production-Migration, Staging-Migration, Merge, Stripe-Aktivierung und echte Zahlungen weiterhin verboten. Keine nachfolgende Phase autorisiert.

## Repository und abgeschlossene Abnahme

Repository `Bennyescaped/duelvanta`; einziger veröffentlichter Arbeitsbranch `marketplace-ux-v1`. PR #5 open/Draft/unmerged. Main unverändert `50f88213571be13255bb52eb489cc28cca660001`.

- V59-Basis vor Veröffentlichung frisch bestätigt: `d72334c31376aed549beed879102f58491b72b5e`; Scanner #732 und Battle #208 SUCCESS.
- Veröffentlichter P0-05-Kandidat: **`47f2a7c83103fc63e2fe249131ce707549f04b74`**. Git-Tree `a4793ef9f64843ce7d1256927e9a8f65b5a0c299` identisch zu lokalem V60-Head `dd95d7cb699fef3b8784da67353bab6f8b6e8422`. Technischer lokaler Vorläufer `46de590a150722b2e0ae77c401561425512f3725`. Veröffentlichung über GitHub-Schnittstelle mangels CLI-Anmeldedaten; Fast-forward ohne Force. Alte lokale Commits/Bundles erhalten.
- **Scanner #733 / 36140299326 SUCCESS**, alle vier Jobs. **Battle #209 / 36140299360 SUCCESS**, beide Jobs. Native Prüfung Job `108088193660`: PostgreSQL **17.11**, P0-01 leer/Bestand und P0-05 vollständig PASS. Keine Codekorrektur notwendig.
- Native **20 P0-05-Testgruppen**, 17 Eröffnungs-RPC-Signaturen je anon/authenticated/service_role. Echte PostgreSQL-Rollen, tatsächliche Funktionen und Trigger, echte API mit DB-Testadapter; keine echten Provideraufrufe. Vollständige Abdeckung und genaue Grenzen im Abschluss.
- Dieses V61 liegt im nachfolgenden Dokumentationscommit. Dessen finaler SHA und erneut geprüfte Abschlussläufe stehen im Übergabeexport `final-publication.json` und der Work-Chat-Abschlussmeldung. Bei Fortsetzung den aktuellen Remote-Head und seine CI frisch lesen; nicht den technischen Vorgänger mit dem finalen Dokumentationshead verwechseln.

## P0-05-Verhalten

Elf ALWAYS-Trigger verhindern neue Listings/Offers/Deals/Orders/Items/Bilder und stillgelegte Swap-Eröffnungen auch über privilegierte Schreibpfade. Reine Eröffnungs-RPCs sind auch service_role entzogen. Fixed-Price-Prepare/-Accept verweigern neue oder nur vorbereitete Requests; akzeptierte Replays mit Bestandsorder bleiben validiert möglich. Kein Frontend-Flag-/RLS-Bypass; Bestandsumwidmung, neue Reservierung und unzulässige Reaktivierung gesperrt.

Notwendige Bestandswege nativ bestanden: Rücknahme/Ablehnung, Reservierungsfreigabe, Listing-Abschluss, bestehende Payment-Vorbereitung, Problem/Dispute/Storno, Widerruf/Refund-Vorbereitung, Datenrechte und Order-Abschluss. Separater gesperrter Readiness-Vertrag hält die Bestandsoberfläche schema-kompatibel; deaktivierter Guard ergibt `compatible=false`. Atomare Installation, Rollback und Wiederholung getestet.

Ausgangspunkt und gezielte Ergänzung bleiben `database/market-production-trade-lock-v1.sql` plus vorhandene Tests; zusätzlicher Lock-Readiness-Vertrag und native Runner-Integration. Ursprünglicher unverriegelter Readiness-Vertrag, 60-Schritt-P0-01-Manifest und bestehende API-Handler unverändert. Nachweise lokal/WASM in `evidence/production-trade-lock-p0-05-20260925/`, nativ in `evidence/production-trade-lock-p0-05-native-20260925/`.

## Außenwelt und harte Grenzen

Production `enifiaqsnqtbzylnfrpi` erneut read-only: 72 Migrationen bis `20260911181702`, null P0-05-Trigger. Staging `xhmjxrcskfhbovhitdej`: 53 Migrationen bis `20260924113153`, null P0-05-Trigger. Production-Domain unverändert READY auf `dpl_ENc313pWZJMSn6y21VbURMEWLMkt`, main50f8821. Kandidaten-Preview `dpl_5EkbBVJ4q99m9K5fLBwJZCr7tvVL` READY und autorisiert. Keine Production-/Staging-Datenbankänderung oder Hosting-/Environmentänderung.

V59s vier Production-Environment-Einträge und seine Keyquellen-/Write-only-Grenze bleiben unverändert; hier keine neue Byte-/Runtime-Keyattestierung. Die zuvor gelesenen sieben Edge-Funktionsquellen enthalten keinen zusätzlichen TRADE-Eröffnungspfad. Keine Edge-Ausführung oder Änderung, keine tatsächliche Zahlung/Erstattung oder Auth-/Storage-Mutation.

Kein echter PostgREST/JWT-/Provider-End-to-End- und kein mehrprozessiger P0-05-Installations-/In-flight-Race-Nachweis. Die native Funktionsabnahme beseitigt den V60-Native-CI-Blocker, nicht diese Grenzen. Extern bereits laufende Providerrequests werden nicht atomar zurückgerufen. Scanner-Push-only-Live-Prüfungen wurden im PR-Lauf regulär übersprungen, nicht als ausgeführt ausgegeben.

Spätere gesondert autorisierte Anwendung: Lock und eigener Readiness-Vertrag zuletzt nach der geprüften Upgrade-Kette gemeinsam transaktional ausführen; äußere BEGIN/COMMIT wie im Runner behandeln. Fehlende Voraussetzungen, Source-Drift oder Readiness-Fehler bedeuten Abbruch. Kein online aufrufbarer Unlock. Kein automatischer Staging-Test/Rollout.

**P0-05-Branch-Kandidat abgeschlossen. Weiterhin kein Production-GO. Nach finaler Abschluss-CI STOP; keine Migration, Production-Deployment, Merge, Stripe-Aktivierung oder Folgephase ohne neuen Auftrag.**
