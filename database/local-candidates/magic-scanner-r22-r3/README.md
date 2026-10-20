# R22-R3: isolierter Kandidat, nicht angewendet

History74 bleibt unverändert. Für einen realen Apply ist eine neue ausdrückliche
Betreiberfreigabe erforderlich. Kein Migrationslauf dieses Auftrags verwendet diese Datei.

`dv_collect_move_card` tauscht belegte Ziele bzw. entfernt deren feste Zuordnung.
Ein clientseitiger Vorabcheck verhindert konkurrierende Änderungen nicht.
Der Kandidat ergänzt daher eine eigentümergebundene Platzierung ohne Tausch.
Er prüft die bestehende Magic-Zulassung, Eigentum, Seitenzahl, leere Zielposition
und implizit belegte Altplätze. Der vorhandene eindeutige Index schützt zusätzlich
gegen konkurrierende Platzbelegung. Bereits anderswo platzierte Karten werden abgewiesen.
Wiederholung derselben Platzierung ist idempotent; es wird kein Collection-Eintrag erzeugt.

Magic-Einträge entstehen weiterhin ausschließlich über
`save_my_tcg_collection_item_v1`. Vor dem Binder-Save prüft die Oberfläche die
Verfügbarkeit der neuen Platzierung read-only. Fehlt sie, bleibt die lokale
Warteschlange erhalten und es wird kein Eintrag angelegt. Scheitert die Platzierung
nach einem Save, bleibt die gespeicherte ID sichtbar; nur die Platzierung kann
bewusst erneut versucht werden. Unklare Save-Antworten sperren erneute Imports.
Binder-Saves bleiben zunächst ohne folder_id. Erst die atomare Platzierung weist
Zielbinder und exakten Slot gemeinsam zu. Bei einem Platzierungsfehler bleibt
die Karte in der Master Collection; sie kann keinen impliziten Binderplatz belegen.
Der vorhandene Ordnerwechsel-Trigger wird durch zwei Updates innerhalb derselben
Transaktion berücksichtigt. Beide Änderungen werden bei Fehler zurückgerollt.

Keine Änderungen an Admission, Holds, Quoten, Transportpolicy, RLS oder Storage.
Der Kandidat ist SECURITY INVOKER; bestehende RLS und Trigger bleiben wirksam.
Isolierte SQL-Tests verwenden synthetische Identitäten, Tabellen und Gates.
Sie ersetzen keinen Real-Staging-Abgleich vor einem später genehmigten Apply.
