# Schritt 9A – bewusstes Berechtigungs-Soll v1

Review-Kandidat vom 24.09.2026. Keine Staging-/Production-Anwendung. Basis V51/f5088c32a38e25c762d200a253b798618fd73212. Ist-Kataloge sind ausschließlich adversariale Testeingabe, niemals Berechtigungs-Soll.

## SQL-Rollen und Objektmatrix

`owner/admin/moderator/judge/player` sind Profilrollen, keine PostgreSQL-LOGIN-Rollen. Alle menschlichen Browser verwenden `authenticated`. Privilegierte RPCs verlangen zusätzlich signierte authenticated-AAL2-Claims, dieselbe aktive auth.sessions-Zeile, deren aal2/factor_id, passenden verifizierten Faktor sowie einen aktiven/beta, nicht eingeschränkten Staff-Account. Fehlende/gelöschte/fremde/abgelaufene Session oder Faktorentfernung verweigern. Anonyme Auth-Nutzer sind ausgeschlossen. Rollen werden aus aktuellen Profilen, nicht user_metadata gelesen. Bestehende Objekt-/Staff-Permission-Prüfungen bleiben erhalten.

| Objekte | anon | authenticated | service_role |
|---|---|---|---|
| profiles | keine | SELECT eigene Zeile; UPDATE eigene sichere Felder; Owner darf weitere Profile nur mit AAL2 lesen | SELECT für serverseitige Sichtbarkeitsprüfung |
| collection_folders | keine | SELECT/INSERT/UPDATE eigene; DELETE ausschließlich F3-RPC | SELECT für signierte Bildzugriffe |
| collection_items | keine | SELECT/INSERT/UPDATE/DELETE eigene | SELECT für signierte Bildzugriffe |
| market_listings | keine | SELECT aktive/eigene; INSERT/UPDATE/DELETE eigene, bestehende Trigger gelten | SELECT für Listing-Bildroute |
| market_offers | keine | SELECT Beteiligte; DELETE nur eigene unreservierte pending Preisangebote | keine direkten Tabellenrechte |
| market_seller_accounts | keine | SELECT eigener freigegebener öffentlicher Datensatz | keine direkten Tabellenrechte |
| battle_matches | keine | SELECT Lobby/eigene; Staff-Erweiterung nur AAL2 | keine direkten Tabellenrechte |
| battle_ratings | keine | SELECT eigene | keine direkten Tabellenrechte |
| battle_reports | keine | INSERT eigene; SELECT eigene oder berechtigte Staff-Sicht mit AAL2 | keine direkten Tabellenrechte |
| battle_signals | keine | SELECT/INSERT Beteiligte, bestehende Sender-/Matchprüfung | keine direkten Tabellenrechte |
| staff_applications | keine | SELECT eigene oder Admin/Owner mit AAL2 | keine direkten Tabellenrechte |
| staff_permissions | keine | SELECT eigene oder Owner mit AAL2 | keine direkten Tabellenrechte |
| admin_audit_log | keine | SELECT Owner mit AAL2 | INSERT ausschließlich actor_id,target_user_id,action,details nach authentisierter Edge-Prüfung |
| beta_waitlist | INSERT ausschließlich email,consent,source; consent=true/source=landingpage | Owner+AAL2 SELECT und UPDATE ausschließlich beta_status,founder_eligible,founder_number,founder_generation,invited_at,activated_at | keine direkten Tabellenrechte |
| market_seller_stats | SELECT (security_invoker, Basistabellenrechte/RLS gelten) | SELECT (security_invoker) | keine direkten Tabellenrechte |
| sämtliche übrigen Anwendungstabellen, insbesondere private Schemas | keine | keine | keine direkten Tabellenrechte; explizite Worker-RPCs |
| Sequenzen | USAGE beta_waitlist_id_seq | USAGE battle_signals_id_seq | USAGE admin_audit_log_id_seq |

Keine Browser-/Service-TRUNCATE-, MAINTAIN-, REFERENCES-, TRIGGER-, Schema-CREATE- oder Sequenz-UPDATE-Rechte. Ownerrechte/Grantoption des Datenbankobjektbesitzers postgres werden nicht entzogen. Kein Browser erhält Auth-Session-/Faktortabellenzugriff. Service BYPASSRLS ersetzt kein fehlendes Tabellenrecht.

RLS wird für `dv_market_private.market_pickup_handovers`, `dv_market_private.trade_user_eligibility`, `public.market_notification_sync_state` aktiviert. Bewusst **keine** Browser-Policies: Zugriff nur über vorhandene SECURITY-DEFINER-Geschäftslogik. Das ist kein fehlendes Ownership-Policy-Design und kein Anlass, Advisor-Warnungen pauschal zu unterdrücken.

## Funktionen und Alternativpfade

20 konkrete Implementierungen werden unter Erhalt von OID, Signatur, Geschäftslogik und bestehenden Rollenprüfungen um den Session-Guard ergänzt:

- ursprüngliche acht: join_battle_as_moderator, leave_battle_moderation, moderate_battle_report, review_battle_report, review_staff_application, set_battle_moderation_pause, set_staff_permission, set_staff_role;
- Judge: get_battle_disputes_for_moderation, resolve_battle_dispute;
- TRADE: review_market_seller_onboarding, set_marketplace_seller_onboarding_enforcement, get_owner_marketplace_notices, decide_marketplace_listing_notice, review_marketplace_notice_appeal, get_owner_market_seller_reviews, get_owner_market_delivery_reviews_b07, review_market_order_delivery_b07;
- Scanner **private Implementierungen**: owner_openai_scan_settings_for_caller, update_openai_scan_policy_for_caller; damit werden auch direkte Aufrufe hinter den öffentlichen SQL-Fassaden abgesichert.

Keine pauschale service_role-Ausnahme für menschliche Staff-Aktionen. Die acht alten dv_core-Namen werden nicht neu erzeugt; vorhandene dv_core_*-Funktionen verlieren PUBLIC/anon/authenticated/service_role-EXECUTE. Triggerfunktionen verlieren direkte Browser-/Service-EXECUTE-Rechte; Trigger laufen weiterhin normal. Pure Identitätshelfer is_duelvanta_owner/is_duelvanta_admin/has_staff_permission dürfen keine MFA-Seiteneffekte erhalten: auch Zielkonto-/Owner-Schutz hängt davon ab. Sie sind keine Autorisierung zum Service-Eskalieren. get_my_market_owner_access bleibt bloße Rollenerkennung.

Legitime öffentliche RPCs (öffentliche Profile/Sammlungen/Rankings/Listings/Reviews, Username-Verfügbarkeit sowie codegebundene Notice-/Appeal-Pfade) behalten ihre vorgesehenen ACLs. Selbstbezogene History-/Deal-RPCs verlieren anon/PUBLIC, behalten authenticated. Normale Käufer/Verkäufer können weiter AAL1 verwenden. Service-Worker behalten die vorhandenen expliziten RPC-Freigaben für Outbox, Payment/Refund/Reconciliation, Account-Erasure und Battle-Media; deren fachliche Gates werden nicht aktiviert oder abgeschwächt.

Die Edge-Einladung prüft `get_my_privileged_access_v1()` **mit dem Benutzer-JWT**, bevor der Service-Client erzeugt wird. Der historische Name `invite-beta-user` hat einen versionierten Einstieg in dieselbe Implementierung. Beide Namen sind vor einem späteren Rollout gemeinsam abzugleichen/abzusichern; die heutige nicht neu deployte Production-Funktion gilt nicht als behoben. Ein Test hat außerdem die fehlerhafte doppelte Regex-Escapierung der vorhandenen Mailvalidierung aufgedeckt; minimale Korrektur, ausschließlich mit synthetischem Handler-Test.

## Default Privileges

Für zukünftige, durch postgres angelegte Anwendungstabellen/Sequenzen/Funktionen keine automatischen PUBLIC/anon/authenticated/service_role-Rechte. Jede neue API benötigt expliziten GRANT und Test. Die implizite globale PUBLIC-EXECUTE-Vorgabe für postgres-Funktionen wird ausdrücklich entzogen, weil ein Schema-REVOKE diese nicht aufheben kann. Das betrifft künftig durch **postgres** erstellte Funktionen auch außerhalb der Anwendungsschemas; bestehende Supabase-verwaltete Objekte und Defaults anderer Eigentümer bleiben unverändert. Künftige Erweiterungs-/Migrationsschritte müssen benötigte Grants ausdrücklich setzen. Kein ALTER ROLE, kein globaler Session-/JWT-Schalter, keine Mutation an auth/storage/realtime/vault-Objekten im Kandidaten.

## Reihenfolge und Readiness

1. Vollständige V51-Baseline (keine Production-Migrationsabkürzung).
2. database/auth-privileged-step-up-v1.sql.
3. database/security-privilege-mfa-hardening-v1.sql.
4. database/security-readiness-v1.sql.
5. Beide Readiness-RPCs sowie fachliche Negativ-/Positivtests.

Die historische Legal-Migration und ihr Generator bleiben unverändert. Der neue Generator rekonstruiert eine datenfreie, versionierte Ausgangsbasis und wendet ausschließlich die obigen Solländerungen an. Legal-Semantik bleibt trade-legal-contract-model-v1.2; Security erhält privilege-mfa-v1. Der neue Legal-Check verlangt zusätzlich den Security-Check. Keine Runtime-Marker, keine Profil-Fixtures als Bereitschaftsnachweis und kein Einlesen einer Live-Fingerprint-Sollliste. Separate Tests prüfen Rechte/Verhalten und injizieren unzulässige Änderungen; ein neuer Hash allein kann diese Tests nicht erfüllen.

## Enrollment, Recovery und Abnahmegrenze

Vor echter Anwendung: Betreiber richtet selbst im richtigen Projekt TOTP über mfa.html ein, bestätigt Challenge, prüft AAL2 und tatsächliche serverseitige Session-/Faktorzuordnung. Zweiter unabhängig gesicherter Faktor bzw. dokumentierter zugriffsgeschützter Wiederherstellungsweg; verifizierter Supabase-Projektzugang des verantwortlichen Betreibers, keine Secrets im Repository. Enrollment/Recovery muss vor dem Schließen des letzten administrativen Zugangs praktisch bestätigt sein.

Verlust: privilegierte Endpunkte bleiben gesperrt. Betreiberidentität und Projektzuordnung über den separat gesicherten Projektzugang verifizieren; betroffene Sessions widerrufen, kontrolliert verlorenen Faktor nach Betreiberentscheidung entfernen, neuen echten Faktor anmelden/verifizieren, neues AAL2 und Audit prüfen. Kein Abschalten des Guards, kein künstliches Einfügen in auth.sessions/auth.mfa_factors, kein geteiltes Owner-Passwort oder Service-Key als Benutzerersatz. Keine pauschale Down-Migration auf breite Browserrechte.

Die Tests legen ausschließlich wegwerfbare synthetische Auth-Zeilen an, um SQL-Zustände zu prüfen. Das ist **kein echtes MFA-Enrollment und kein Live-PASS**. Kein Staging-Auftrag ohne erfüllten echten Zugangsnachweis; Production bleibt gesondert freizugeben und in diesem Block read-only/unverändert.

Fachquellen (24.09.2026): https://supabase.com/docs/guides/auth/sessions ; https://supabase.com/docs/guides/auth/auth-mfa ; https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html ; https://www.postgresql.org/docs/17/ddl-rowsecurity.html . Supabase-Changelog auf relevante Änderungen geprüft; kein Auth-Session-Vertragswechsel für diesen Kandidaten festgestellt.
