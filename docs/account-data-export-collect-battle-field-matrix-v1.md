# T2 – Tabellen-/Feldmatrix Scanner/BATTLE

Stand 26.09.2026. Isoliertes tatsächliches Schema aus versionierter Fixture plus P0-02; keine neue Liveattestierung. Jede katalogisierte Spalte ist einzeln zugeordnet. AUFNAHME bezeichnet technische Exportauswahl, keine pauschale rechtliche Vollständigkeit.

## battle_spectator_media_private.config

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| singleton | boolean | AUSSCHLUSS | Globale Medienkonfiguration, keine eigene Teilnahmezeile. |
| media_enabled | boolean | AUSSCHLUSS | Globale Medienkonfiguration, keine eigene Teilnahmezeile. |
| max_viewers_per_match | integer | AUSSCHLUSS | Globale Medienkonfiguration, keine eigene Teilnahmezeile. |
| consent_version | text | AUSSCHLUSS | Globale Medienkonfiguration, keine eigene Teilnahmezeile. |

## battle_spectator_media_private.consents

Owner: `user_id = auth.uid()`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| match_id | uuid | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| user_id | uuid | FILTER/ABLEITUNG | Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload. |
| consent_version | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| granted | boolean | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| updated_at | timestamp with time zone | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |

## battle_spectator_media_private.epochs

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| match_id | uuid | AUSSCHLUSS | Gemeinsamer Medien-/Revokationszustand; Epoch/Generation nicht exportieren. |
| epoch | uuid | AUSSCHLUSS | Gemeinsamer Medien-/Revokationszustand; Epoch/Generation nicht exportieren. |
| generation | uuid | AUSSCHLUSS | Gemeinsamer Medien-/Revokationszustand; Epoch/Generation nicht exportieren. |
| media_open | boolean | AUSSCHLUSS | Gemeinsamer Medien-/Revokationszustand; Epoch/Generation nicht exportieren. |
| updated_at | timestamp with time zone | AUSSCHLUSS | Gemeinsamer Medien-/Revokationszustand; Epoch/Generation nicht exportieren. |

## battle_spectator_media_private.revocations

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| id | bigint | AUSSCHLUSS | Gemeinsamer technischer Arbeitsauftrag/Revokationsgrund; kein sicherer einzelner Owner. Rest vor erweitertem Rechteexport gesondert prüfen. |
| match_id | uuid | AUSSCHLUSS | Gemeinsamer technischer Arbeitsauftrag/Revokationsgrund; kein sicherer einzelner Owner. Rest vor erweitertem Rechteexport gesondert prüfen. |
| epoch | uuid | AUSSCHLUSS | Gemeinsamer technischer Arbeitsauftrag/Revokationsgrund; kein sicherer einzelner Owner. Rest vor erweitertem Rechteexport gesondert prüfen. |
| reason | text | AUSSCHLUSS | Gemeinsamer technischer Arbeitsauftrag/Revokationsgrund; kein sicherer einzelner Owner. Rest vor erweitertem Rechteexport gesondert prüfen. |
| state | text | AUSSCHLUSS | Gemeinsamer technischer Arbeitsauftrag/Revokationsgrund; kein sicherer einzelner Owner. Rest vor erweitertem Rechteexport gesondert prüfen. |
| created_at | timestamp with time zone | AUSSCHLUSS | Gemeinsamer technischer Arbeitsauftrag/Revokationsgrund; kein sicherer einzelner Owner. Rest vor erweitertem Rechteexport gesondert prüfen. |

## battle_spectator_private.grants

Owner: `user_id = auth.uid()`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| match_id | uuid | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| user_id | uuid | FILTER/ABLEITUNG | Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload. |
| generation | uuid | AUSSCHLUSS | Generation, Session- und Tab-Identifikatoren ausgeschlossen. |

## battle_spectator_private.links

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| match_id | uuid | AUSSCHLUSS | Zugangslink/Secret und Generation, keine eindeutig eigene Datenzeile. |
| generation | uuid | AUSSCHLUSS | Zugangslink/Secret und Generation, keine eindeutig eigene Datenzeile. |
| secret_hash | text | AUSSCHLUSS | Zugangslink/Secret und Generation, keine eindeutig eigene Datenzeile. |
| enabled | boolean | AUSSCHLUSS | Zugangslink/Secret und Generation, keine eindeutig eigene Datenzeile. |
| updated_at | timestamp with time zone | AUSSCHLUSS | Zugangslink/Secret und Generation, keine eindeutig eigene Datenzeile. |

## battle_spectator_private.presence

Owner: `user_id = auth.uid()`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| match_id | uuid | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| user_id | uuid | FILTER/ABLEITUNG | Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload. |
| session_id | uuid | AUSSCHLUSS | Generation, Session- und Tab-Identifikatoren ausgeschlossen. |
| tab_id | uuid | AUSSCHLUSS | Generation, Session- und Tab-Identifikatoren ausgeschlossen. |
| expires_at | timestamp with time zone | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |

## dv_v16_private.credit_period

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| id | uuid | AUSSCHLUSS | Globaler Kreditbestand; keine eindeutige Nutzerzuordnung. Keine Zuordnung aggregierter Kosten erfinden. |
| starts_at | timestamp with time zone | AUSSCHLUSS | Globaler Kreditbestand; keine eindeutige Nutzerzuordnung. Keine Zuordnung aggregierter Kosten erfinden. |
| ends_at | timestamp with time zone | AUSSCHLUSS | Globaler Kreditbestand; keine eindeutige Nutzerzuordnung. Keine Zuordnung aggregierter Kosten erfinden. |
| credit_limit | integer | AUSSCHLUSS | Globaler Kreditbestand; keine eindeutige Nutzerzuordnung. Keine Zuordnung aggregierter Kosten erfinden. |
| prior_credits | integer | AUSSCHLUSS | Globaler Kreditbestand; keine eindeutige Nutzerzuordnung. Keine Zuordnung aggregierter Kosten erfinden. |
| reserved_credits | integer | AUSSCHLUSS | Globaler Kreditbestand; keine eindeutige Nutzerzuordnung. Keine Zuordnung aggregierter Kosten erfinden. |
| active | boolean | AUSSCHLUSS | Globaler Kreditbestand; keine eindeutige Nutzerzuordnung. Keine Zuordnung aggregierter Kosten erfinden. |

## dv_v16_private.openai_cost_import

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| source_id | text | AUSSCHLUSS | Historischer Gesamtimport ohne user_id; individueller Anteil nicht rekonstruierbar aus dieser Tabelle. |
| period_start | date | AUSSCHLUSS | Historischer Gesamtimport ohne user_id; individueller Anteil nicht rekonstruierbar aus dieser Tabelle. |
| estimated_eur_micros | bigint | AUSSCHLUSS | Historischer Gesamtimport ohne user_id; individueller Anteil nicht rekonstruierbar aus dieser Tabelle. |
| estimated_usd_micros | bigint | AUSSCHLUSS | Historischer Gesamtimport ohne user_id; individueller Anteil nicht rekonstruierbar aus dieser Tabelle. |
| successful_scans | integer | AUSSCHLUSS | Historischer Gesamtimport ohne user_id; individueller Anteil nicht rekonstruierbar aus dieser Tabelle. |
| source_note | text | AUSSCHLUSS | Historischer Gesamtimport ohne user_id; individueller Anteil nicht rekonstruierbar aus dieser Tabelle. |

## dv_v16_private.openai_monthly_cost

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| period_start | date | AUSSCHLUSS | Globales Monatsaggregat; enthält keine sichere individuelle Zuordnung. |
| settled_eur_micros | bigint | AUSSCHLUSS | Globales Monatsaggregat; enthält keine sichere individuelle Zuordnung. |
| reserved_eur_micros | bigint | AUSSCHLUSS | Globales Monatsaggregat; enthält keine sichere individuelle Zuordnung. |
| estimated_usd_micros | bigint | AUSSCHLUSS | Globales Monatsaggregat; enthält keine sichere individuelle Zuordnung. |
| input_tokens | bigint | AUSSCHLUSS | Globales Monatsaggregat; enthält keine sichere individuelle Zuordnung. |
| output_tokens | bigint | AUSSCHLUSS | Globales Monatsaggregat; enthält keine sichere individuelle Zuordnung. |
| successful_scans | integer | AUSSCHLUSS | Globales Monatsaggregat; enthält keine sichere individuelle Zuordnung. |

## dv_v16_private.openai_scan_policy

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| singleton | boolean | AUSSCHLUSS | Globale Policy/Budget und Accounting-Key-Hash; kein persönlicher Datensatz, keine Schlüssel exportieren. |
| enabled | boolean | AUSSCHLUSS | Globale Policy/Budget und Accounting-Key-Hash; kein persönlicher Datensatz, keine Schlüssel exportieren. |
| raw_weekly_limit | integer | AUSSCHLUSS | Globale Policy/Budget und Accounting-Key-Hash; kein persönlicher Datensatz, keine Schlüssel exportieren. |
| slab_weekly_limit | integer | AUSSCHLUSS | Globale Policy/Budget und Accounting-Key-Hash; kein persönlicher Datensatz, keine Schlüssel exportieren. |
| monthly_budget_eur_micros | bigint | AUSSCHLUSS | Globale Policy/Budget und Accounting-Key-Hash; kein persönlicher Datensatz, keine Schlüssel exportieren. |
| reservation_eur_micros | bigint | AUSSCHLUSS | Globale Policy/Budget und Accounting-Key-Hash; kein persönlicher Datensatz, keine Schlüssel exportieren. |
| accounting_key_sha256 | text | AUSSCHLUSS | Globale Policy/Budget und Accounting-Key-Hash; kein persönlicher Datensatz, keine Schlüssel exportieren. |
| eur_per_usd_micros | integer | AUSSCHLUSS | Globale Policy/Budget und Accounting-Key-Hash; kein persönlicher Datensatz, keine Schlüssel exportieren. |
| fx_date | date | AUSSCHLUSS | Globale Policy/Budget und Accounting-Key-Hash; kein persönlicher Datensatz, keine Schlüssel exportieren. |
| tracking_started_at | timestamp with time zone | AUSSCHLUSS | Globale Policy/Budget und Accounting-Key-Hash; kein persönlicher Datensatz, keine Schlüssel exportieren. |
| legacy_unclassified_attempts | integer | AUSSCHLUSS | Globale Policy/Budget und Accounting-Key-Hash; kein persönlicher Datensatz, keine Schlüssel exportieren. |

## dv_v16_private.openai_scan_reservation

Owner: `user_id = auth.uid()`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| user_id | uuid | FILTER/ABLEITUNG | Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload. |
| request_id | uuid | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| week_start | date | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| image_sha256 | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| tcg | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| kind | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| reserved_eur_micros | bigint | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| eur_per_usd_micros | integer | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| estimated_cost_eur_micros | bigint | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| estimated_cost_usd_micros | bigint | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| input_tokens | integer | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| output_tokens | integer | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| settled_at | timestamp with time zone | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| reserved_at | timestamp with time zone | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |

## dv_v16_private.openai_weekly_usage

Owner: `user_id = auth.uid()`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| user_id | uuid | FILTER/ABLEITUNG | Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload. |
| week_start | date | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| raw_used | integer | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| slab_used | integer | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |

## dv_v16_private.operator_identity_v1

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| singleton | boolean | AUSSCHLUSS | Interne Operator-/Sicherheitsbindung; kein Scanner-Accounting. |
| user_id | uuid | AUSSCHLUSS | Interne Operator-/Sicherheitsbindung; kein Scanner-Accounting. |
| created_at | timestamp with time zone | AUSSCHLUSS | Interne Operator-/Sicherheitsbindung; kein Scanner-Accounting. |

## dv_v16_private.scan_policy

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| singleton | boolean | AUSSCHLUSS | Globale Policy; keine persönliche Usage-Zeile. |
| enabled | boolean | AUSSCHLUSS | Globale Policy; keine persönliche Usage-Zeile. |
| raw_weekly_limit | integer | AUSSCHLUSS | Globale Policy; keine persönliche Usage-Zeile. |
| slab_weekly_limit | integer | AUSSCHLUSS | Globale Policy; keine persönliche Usage-Zeile. |

## dv_v16_private.scan_reservation

Owner: `user_id = auth.uid()`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| user_id | uuid | FILTER/ABLEITUNG | Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload. |
| request_id | uuid | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| period_id | uuid | AUSSCHLUSS | period_id verweist auf globalen Kreditbestand; keine persönlichen Verbrauchswerte verloren. |
| week_start | date | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| image_sha256 | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| tcg | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| kind | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| credits | integer | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| reserved_at | timestamp with time zone | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |

## dv_v16_private.weekly_usage

Owner: `user_id = auth.uid()`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| user_id | uuid | FILTER/ABLEITUNG | Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload. |
| week_start | date | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| raw_used | integer | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| slab_used | integer | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |

## public.admin_audit_log

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| id | bigint | REST/AUSSCHLUSS | REST: administrative Nachweise mit Akteur/Ziel/Freitext; nicht Teil dieses Exports. |
| actor_id | uuid | REST/AUSSCHLUSS | REST: administrative Nachweise mit Akteur/Ziel/Freitext; nicht Teil dieses Exports. |
| target_user_id | uuid | REST/AUSSCHLUSS | REST: administrative Nachweise mit Akteur/Ziel/Freitext; nicht Teil dieses Exports. |
| action | text | REST/AUSSCHLUSS | REST: administrative Nachweise mit Akteur/Ziel/Freitext; nicht Teil dieses Exports. |
| details | jsonb | REST/AUSSCHLUSS | REST: administrative Nachweise mit Akteur/Ziel/Freitext; nicht Teil dieses Exports. |
| created_at | timestamp with time zone | REST/AUSSCHLUSS | REST: administrative Nachweise mit Akteur/Ziel/Freitext; nicht Teil dieses Exports. |

## public.battle_matches

Owner: `host_id = auth.uid() OR guest_id = auth.uid()`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| id | uuid | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| host_id | uuid | FILTER/ABLEITUNG | Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload. |
| guest_id | uuid | FILTER/ABLEITUNG | Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload. |
| tcg | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| mode | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| visibility | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| invite_code | text | AUSSCHLUSS | Einladung/Freitext/Namens-/Founder-/Moderationsdaten ausgeschlossen; Staff/Review bleibt konkreter Rest. |
| title | text | AUSSCHLUSS | Einladung/Freitext/Namens-/Founder-/Moderationsdaten ausgeschlossen; Staff/Review bleibt konkreter Rest. |
| language | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| status | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| host_ready | boolean | EIGENE PROJEKTION | Nur eigener Seitenwert bzw. eigenes Ergebnis; keine Gegnerwerte/rohen winner_id. |
| guest_ready | boolean | EIGENE PROJEKTION | Nur eigener Seitenwert bzw. eigenes Ergebnis; keine Gegnerwerte/rohen winner_id. |
| host_result | text | EIGENE PROJEKTION | Nur eigener Seitenwert bzw. eigenes Ergebnis; keine Gegnerwerte/rohen winner_id. |
| guest_result | text | EIGENE PROJEKTION | Nur eigener Seitenwert bzw. eigenes Ergebnis; keine Gegnerwerte/rohen winner_id. |
| winner_id | uuid | EIGENE PROJEKTION | Nur eigener Seitenwert bzw. eigenes Ergebnis; keine Gegnerwerte/rohen winner_id. |
| host_display_name | text | AUSSCHLUSS | Einladung/Freitext/Namens-/Founder-/Moderationsdaten ausgeschlossen; Staff/Review bleibt konkreter Rest. |
| host_founder_number | integer | AUSSCHLUSS | Einladung/Freitext/Namens-/Founder-/Moderationsdaten ausgeschlossen; Staff/Review bleibt konkreter Rest. |
| guest_display_name | text | AUSSCHLUSS | Einladung/Freitext/Namens-/Founder-/Moderationsdaten ausgeschlossen; Staff/Review bleibt konkreter Rest. |
| guest_founder_number | integer | AUSSCHLUSS | Einladung/Freitext/Namens-/Founder-/Moderationsdaten ausgeschlossen; Staff/Review bleibt konkreter Rest. |
| started_at | timestamp with time zone | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| completed_at | timestamp with time zone | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| created_at | timestamp with time zone | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| updated_at | timestamp with time zone | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| moderator_id | uuid | AUSSCHLUSS | Einladung/Freitext/Namens-/Founder-/Moderationsdaten ausgeschlossen; Staff/Review bleibt konkreter Rest. |
| moderator_joined_at | timestamp with time zone | AUSSCHLUSS | Einladung/Freitext/Namens-/Founder-/Moderationsdaten ausgeschlossen; Staff/Review bleibt konkreter Rest. |
| moderation_state | text | AUSSCHLUSS | Einladung/Freitext/Namens-/Founder-/Moderationsdaten ausgeschlossen; Staff/Review bleibt konkreter Rest. |
| paused_at | timestamp with time zone | AUSSCHLUSS | Einladung/Freitext/Namens-/Founder-/Moderationsdaten ausgeschlossen; Staff/Review bleibt konkreter Rest. |
| paused_by | uuid | AUSSCHLUSS | Einladung/Freitext/Namens-/Founder-/Moderationsdaten ausgeschlossen; Staff/Review bleibt konkreter Rest. |
| moderation_note | text | AUSSCHLUSS | Einladung/Freitext/Namens-/Founder-/Moderationsdaten ausgeschlossen; Staff/Review bleibt konkreter Rest. |

## public.battle_rating_events

Owner: `host_id = auth.uid() OR guest_id = auth.uid()`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| id | bigint | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| match_id | uuid | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| tcg | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| host_id | uuid | FILTER/ABLEITUNG | Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload. |
| guest_id | uuid | FILTER/ABLEITUNG | Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload. |
| host_before | integer | EIGENE PROJEKTION | Nur eigener Seitenwert bzw. eigenes Ergebnis; keine Gegnerwerte/rohen winner_id. |
| host_after | integer | EIGENE PROJEKTION | Nur eigener Seitenwert bzw. eigenes Ergebnis; keine Gegnerwerte/rohen winner_id. |
| guest_before | integer | EIGENE PROJEKTION | Nur eigener Seitenwert bzw. eigenes Ergebnis; keine Gegnerwerte/rohen winner_id. |
| guest_after | integer | EIGENE PROJEKTION | Nur eigener Seitenwert bzw. eigenes Ergebnis; keine Gegnerwerte/rohen winner_id. |
| host_delta | integer | EIGENE PROJEKTION | Nur eigener Seitenwert bzw. eigenes Ergebnis; keine Gegnerwerte/rohen winner_id. |
| guest_delta | integer | EIGENE PROJEKTION | Nur eigener Seitenwert bzw. eigenes Ergebnis; keine Gegnerwerte/rohen winner_id. |
| result | text | EIGENE PROJEKTION | Nur eigener Seitenwert bzw. eigenes Ergebnis; keine Gegnerwerte/rohen winner_id. |
| created_at | timestamp with time zone | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |

## public.battle_ratings

Owner: `user_id = auth.uid()`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| user_id | uuid | FILTER/ABLEITUNG | Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload. |
| tcg | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| rating | integer | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| games | integer | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| wins | integer | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| losses | integer | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| draws | integer | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| updated_at | timestamp with time zone | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |

## public.battle_reports

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| id | uuid | REST/AUSSCHLUSS | REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen. |
| match_id | uuid | REST/AUSSCHLUSS | REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen. |
| reporter_id | uuid | REST/AUSSCHLUSS | REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen. |
| reported_user_id | uuid | REST/AUSSCHLUSS | REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen. |
| category | text | REST/AUSSCHLUSS | REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen. |
| details | text | REST/AUSSCHLUSS | REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen. |
| status | text | REST/AUSSCHLUSS | REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen. |
| created_at | timestamp with time zone | REST/AUSSCHLUSS | REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen. |
| resolved_at | timestamp with time zone | REST/AUSSCHLUSS | REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen. |
| reviewer_id | uuid | REST/AUSSCHLUSS | REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen. |
| reviewer_note | text | REST/AUSSCHLUSS | REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen. |
| resolution_action | text | REST/AUSSCHLUSS | REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen. |
| reviewing_at | timestamp with time zone | REST/AUSSCHLUSS | REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen. |

## public.battle_signals

Owner: `sender_id = auth.uid()`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| id | bigint | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| match_id | uuid | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| sender_id | uuid | FILTER/ABLEITUNG | Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload. |
| signal_type | text | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |
| payload | jsonb | AUSSCHLUSS | SDP/ICE/Netzwerk- und potenzielle Zugangsdaten im Payload ausgeschlossen. |
| created_at | timestamp with time zone | AUFNAHME | Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion. |

## public.staff_applications

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| id | uuid | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| applicant_id | uuid | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| requested_role | text | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| tcg | text[] | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| experience | text | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| rules_knowledge | text | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| languages | text[] | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| availability | text | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| motivation | text | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| status | text | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| reviewer_id | uuid | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| reviewer_note | text | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| created_at | timestamp with time zone | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| updated_at | timestamp with time zone | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |
| reviewed_at | timestamp with time zone | REST/AUSSCHLUSS | REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben. |

## public.staff_permissions

Owner: `Keine eindeutige persönliche Zeile im gewählten Scope`.

| Feld | Typ | Entscheidung | Begründung |
|---|---|---|---|
| user_id | uuid | AUSSCHLUSS | Staff-/Grantor-Daten außerhalb dieses T2-Teilblocks. |
| permission | text | AUSSCHLUSS | Staff-/Grantor-Daten außerhalb dieses T2-Teilblocks. |
| granted_by | uuid | AUSSCHLUSS | Staff-/Grantor-Daten außerhalb dieses T2-Teilblocks. |
| granted_at | timestamp with time zone | AUSSCHLUSS | Staff-/Grantor-Daten außerhalb dieses T2-Teilblocks. |

## Abbildungs- und Restgrenzen

- Match `id` → `match_id`, eigene Host-/Gastseite → `participant_role`, `my_ready`, `my_reported_result` (self/opponent/draw), `winner_id` nur → `my_outcome` (won/lost/draw/null). Gemeinsame Match-Metadaten werden nur bei eigener Spielerbeteiligung ausgegeben; ein Zuschauergrant allein öffnet keine Matchzeile.
- Rating-Event `id` → `event_id`; ausschließlich eigene before/after/delta-Werte und eigenes Ergebnis. Signal `id` → `signal_id`; Payload bleibt vollständig ausgeschlossen.
- Historische Reservierungen/Usage bleiben auch ohne aktuellen OpenAI-Verbrauch enthalten. Bildhashes sind nutzerbezogene eigene Daten, nicht pauschal anonym. Token-Zahlen sind Verbrauchszähler, keine Zugangstokens. Globale Imports sind keine individuell zurechenbaren Providerrechnungen.
- Keine Aufrufe von Budget-, Cleanup-, Admission- oder Medienstatus-RPCs; ihre möglichen Nebenwirkungen sind für einen Export ungeeignet.
- Bestehende Collection-/Marketplace-/Widerrufsbereiche bleiben erhalten. Pickup wird ausschließlich über `dv_market_private.pickup_messages_for_export(auth.uid())` wieder eingebunden; dessen bestehende Konversation enthält self/other-Nachrichten ohne Gegenpartei-ID. Dies ist keine neu erlaubte Ausgabe fremder BATTLE-Daten.
- Offene Restbereiche: Reports/Staff/Judge, Signaling-Inhalte, gemeinsame Reconciler-/Revokationsdaten, nicht sicher zuordenbare Globalimporte sowie externe Providerkopien/Backups. T2-Gesamtvollständigkeit und gesetzlicher Auskunftsumfang werden damit nicht behauptet.
- Ein Audit-INSERT je erfolgreichem Gesamtaufruf bleibt gemäß Betreiberfreigabe 26.09. bestehen. Auditversion wird ausschließlich zur Kennzeichnung des V3-Payloads angepasst; kein neues Auditfeld, keine zweite Nachweiskette.
