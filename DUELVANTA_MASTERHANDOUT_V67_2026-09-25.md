# DUELVANTA – MASTERHANDOUT V67

Dateiname 25.09.2026 gemäß Fortführung; tatsächlicher Abschluss und CI-Nachweis **26.09.2026**. T2-Exportteilblock PASS als Branch-Kandidat. Production NO-GO.

## 1. Verbindliche Ausgangsbasis

Zuerst diesen V67 und `DUELVANTA_T2_EXPORT_COLLECT_BATTLE_ABSCHLUSS_2026-09-25.md` vollständig lesen. Für technische Details: `docs/account-data-export-collect-battle-v1.md`, vollständige Feldmatrix/JSON und `evidence/t2-export-20260926/`. V66 und der IT-Recht-Scope-Abgleich bleiben für alle nicht geänderten fachlichen Grenzen verbindlich; V62 bleibt übergreifendes Readinessregister, V64 Providerbasis. Neuere konkrete Tatsachennachweise haben Vorrang.

IT-Recht-Texte stammen aus dem Konfigurator: keine bestätigte individuelle anwaltliche DUELVANTA-Prüfung, individuelle Release-Freigabe oder bestätigtes Beratungsmandat von RA Nagel. V65 einschließlich Anschreiben/Versandpaket bleibt internes Archiv: NICHT VERSENDEN. Keine pauschale externe Datenschutz-Schlussprüfung als Voraussetzung sämtlicher technischer Arbeit. Konkrete juristische Einzelfragen bleiben konkret offen.

## 2. Repository und bestandene Abnahme

- Einziger Entwicklungsbranch: `marketplace-ux-v1` in Bennyescaped/duelvanta.
- Frischer Ausgangshead: `556469f879d6104e33b37e721278a8f3d10678fd`.
- Technisch abgenommener, veröffentlichter Head: `2973b83a9d9a077406ca295d8a8669ceef3dd715`.
- main unverändert: `50f88213571be13255bb52eb489cc28cca660001`.
- PR #5 frisch geprüft: open, Draft, unmerged.
- Scanner #735 / Run 36226086945: vollständig SUCCESS, alle fünf Jobs erfolgreich.
- Battle #211 / Run 36226086946: vollständig SUCCESS.
- Automatischer Vercel-Preview: SUCCESS; kein Production-Deploy.
- Native PostgreSQL 17.11: zwei T2-Varianten je 14/14 PASS; vollständige P0-Rekonstruktion einschließlich 20/20 Lock-Testgruppen und T2 PASS.

Eine anschließende reine Dokumentationsrevision ergänzt Bericht, V67 und native Originale; der nächste Auftrag muss ihren dann tatsächlichen Remote-Head und CI frisch abfragen, statt den technischen Head als dauerhaft aktuellen Branch-Head anzunehmen. Vor Ende dieses Auftrags wird auch diese Revision vollständig CI-geprüft. Die alte PR-Beschreibung enthält historische Kopf-/Testangaben und ist keine aktuelle Handout-Evidenz.

## 3. Abgeschlossener T2-Teilblock

Eigene aktuelle/historische Scanner-Reservierungen, Usage und eindeutig zuordenbare Kosten-/Tokenanzahlen sowie eigene BATTLE-Teilnehmer-, Match-, Rating- und ausgewählte eigene Zuschauer-/Signalmetadaten werden explizit exportiert. Die Feldmatrix erfasst 196 Spalten aus 25 Tabellen einschließlich Ausschlüssen und Resten. Keine Gegenpartei-IDs/-Ratings, Signalingpayloads, Zugangstokens, Reports oder Staff-/Judge-Daten in der Erweiterung.

Tatsachenkorrektur gegenüber angenommener V2-Basis: Die spätere Legal-Migration hatte den Export auf V1 mit Widerrufen überschrieben. V3 erhält diese Basis und bindet Pickup ausschließlich über den unveränderten bestehenden sicheren Helfer wieder ein. Keine neue Pickup-Logik.

Die einzige persistente Export-Schreiboperation ist das ausdrücklich autorisierte bestehende Audit-INSERT in `dv_market_private.user_data_export_events`: unveränderte Mechanik, technisch passender Versionswert V3. 96 Tabellen und 15 Sequenzen pro Variante geprüft; genau ein neues korrekt gehashtes Audit-Event je erfolgreichem Aufruf, alle übrigen Bestände unverändert. Zwei befüllte Nutzer plus fremder, leerer, historischer und Owner-Fall; Negativ-/Secret-/Wiederholungsprüfungen bestanden.

Öffentliche Export-ACL einschließlich vorhandener service_role-Berechtigung bleibt unverändert; Auth-Subjekt begrenzt die Ausgabe. Der neue private Helfer ist nicht direkt nutzeraufrufbar. Keine Änderung von Fachdaten, Quoten, Budgets, Matchintegrität, Profilen, Holds, Retention oder Erasure. Der Nachweis ist keine pauschale Prüfung beliebiger historischer Freitextinhalte oder externer Providerkopien.

## 4. Weiterhin offene Einordnung

| Bereich | Stand / begrenzter Rest |
|---|---|
| T2 sicher eigene Scanner-/BATTLE-Exporte | CLOSED für den isoliert geprüften, versionierten Kandidaten; nicht live angewandt |
| T2 insgesamt | PARTIAL: unklare Dritt-/Reportdaten, Providerkopien und destruktive Datenrechte bleiben separat |
| T1 Texte | V66 unverändert: technische Vorbereitung möglich; konkrete ungeklärte Klauseln/Veröffentlichung zurückgestellt |
| T3 Holds | Bestehende Regeln technisch prüfbar; keine neue Rechtsentscheidung über Ausnahmezwecke/Reichweite |
| T4 Retention | Inventar/Dry-run vorbereitbar; keine erfundenen Fristen oder destruktiven Regeln |
| T5 Meldungen | Technische Vorbereitung möglich; ungeklärte Offenlegungs-/Sanktionsregeln offen |
| T6 Mail | Isolierte technische Bearbeitung möglich; keine echte Zustellung oder Provideränderung autorisiert |

P0-01 bis P0-05 bleiben in ihren bisherigen dokumentierten Grenzen PASS, P0-05 nur Kandidat. Ursprüngliche P0-Manifest-/SQL-/Readinessverträge bleiben unverändert. Der neue T2-Tail und sein passender Readinessvertrag müssen vor irgendeinem späteren Release ausdrücklich in die Rolloutplanung aufgenommen werden. Kein automatischer Rolloutauftrag. P0-02-Acceptancegrenzen und V56-Restore-/Storagegrenzen bleiben. PITR OFF. Kein erneutes Recovery-Rehearsal ohne neuen Befund. Provider-E2/E3/E7/E8/E9 sowie konkrete juristische Restfragen werden nicht durch diesen Exportabschluss geschlossen. Maximal vier Prozent Verkäufer-Gesamtgebühr inklusive Stripe bleibt separate P2-Vorgabe.

## 5. Exakt EIN nächster fachlicher Arbeitsblock

**T3-Teilblock: Isolierter Soll-/Ist-Nachweis der bestehenden Processing-Hold-Regeln auf COLLECT-/Scanner-/BATTLE-Verarbeitungspfaden.**

Begründung: Nach gesichertem eigenem Export ist die belegte Durchsetzung bereits vorhandener Verarbeitungssperren der nächste konkrete technische Datenrechte-Nachweis. Er hängt weder von neuen Löschfristen noch von einer pauschalen anwaltlichen Gesamtfreigabe ab. Eine Beweisaufnahme muss der Entscheidung über notwendige Guard-Ergänzungen vorausgehen.

Umfang ausschließlich für einen späteren ausdrücklichen Auftrag:

1. Tatsächlichen Remote-Head, main, PR #5, CI und geltende Hold-Quellen frisch prüfen; Abweichungen einordnen.
2. Bestehende Hold-Semantik anhand ihrer Quellen erfassen und COLLECT-, Scanner- und BATTLE-Einstiegs-/Fortsetzungspfade einschließlich RPC/API, service_role und direkter DML zuordnen. Keine neue Reichweite oder Ausnahme erfinden.
3. In isolierter synthetischer Datenbank positive und negative Pfadtests mit mindestens zwei Nutzern erstellen: keine Sperrübertragung auf fremde Nutzer, belegte gesperrte Verarbeitung unterbunden, bestehende notwendige Abschluss-/Nachweispfade getrennt ausweisen. Unklare Sollentscheidungen als konkrete Frage stehen lassen.
4. Ergebnis als Pfad-/Bypass-Matrix dokumentieren: bestanden, reproduzierbare Lücke oder fehlende konkrete fachliche Entscheidung. In diesem nächsten Nachweisblock keine fachlichen Hold-Regeln und keine produktiven Guards ändern; keine Live-Mutation. Daraus erst einen nachfolgenden, gesondert zu autorisierenden Umsetzungsbedarf ableiten.

Abschlusskriterium: reproduzierbarer isolierter Pfadnachweis und präzise Restliste zu den vorhandenen Regeln. Dieser eine Block umfasst keine Retention-, Erasure-, Rechts- oder Releaseentscheidung. **Nicht begonnen.**

## 6. Grenzen und STOP

PR #5 offen, Draft, unmerged; main unverändert. Production und Staging für diesen Auftrag ohne Mutation. Kein Merge, Production-Deploy, Live-Migration oder Live-Lock. Keine T1/T3–T6-Umsetzung, Rechtstextänderung, Erasure, Löschung, Anonymisierung, Retention-/Hold-Änderung. Kein Stripe/echte Zahlung/Refund/Payout, echte E-Mail oder Nachricht an Kanzlei/Provider/Steuerberatung. Keine kostenpflichtige Beauftragung, Vertrags-/AVV-/DPA-Annahme, Domain-/DNS-/SMTP-/Key-/Auth-Änderung, PITR-Aktivierung, Schutzabschaltung oder TinyFish.

Erlaubt und ausgeführt: isolierte T2-Tests, Veröffentlichung ausschließlich auf marketplace-ux-v1 nach isoliertem PASS und dadurch automatisch ausgelöstes Preview. Abschlussbericht und V67 zusätzlich in den gemeinsamen DUELVANTA-Projektdateien. Keine Nachricht an den Koordinator versandt.

**T2-Teilblock abgeschlossen. Exakt den oben definierten nächsten Block nicht beginnen. STOP.**
