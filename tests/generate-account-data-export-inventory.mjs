// Documentation only: expand the reviewed field policy against the isolated test
// catalog, never against live rows. The test subsequently requires exact coverage.
import {readFile,writeFile} from 'node:fs/promises';
const report=JSON.parse(await readFile('test-results/account-data-export-pglite.json','utf8'));
const own='user_id = auth.uid()';
const policies={
 'dv_v16_private.openai_scan_reservation':[own,'request_id week_start image_sha256 tcg kind reserved_eur_micros eur_per_usd_micros estimated_cost_eur_micros estimated_cost_usd_micros input_tokens output_tokens settled_at reserved_at','user_id',''],
 'dv_v16_private.openai_weekly_usage':[own,'week_start raw_used slab_used','user_id',''],
 'dv_v16_private.scan_reservation':[own,'request_id week_start image_sha256 tcg kind credits reserved_at','user_id',''],
 'dv_v16_private.weekly_usage':[own,'week_start raw_used slab_used','user_id',''],
 'public.battle_matches':['host_id = auth.uid() OR guest_id = auth.uid()','id tcg mode visibility language status started_at completed_at created_at updated_at','host_id guest_id','host_ready guest_ready host_result guest_result winner_id'],
 'public.battle_ratings':[own,'tcg rating games wins losses draws updated_at','user_id',''],
 'public.battle_rating_events':['host_id = auth.uid() OR guest_id = auth.uid()','id match_id tcg created_at','host_id guest_id','host_before host_after guest_before guest_after host_delta guest_delta result'],
 'public.battle_signals':['sender_id = auth.uid()','id match_id signal_type created_at','sender_id',''],
 'battle_spectator_private.grants':[own,'match_id','user_id',''],
 'battle_spectator_private.presence':[own,'match_id expires_at','user_id',''],
 'battle_spectator_media_private.consents':[own,'match_id consent_version granted updated_at','user_id','']
};
const excluded={
 'dv_v16_private.scan_policy':'Globale Policy; keine persönliche Usage-Zeile.',
 'dv_v16_private.credit_period':'Globaler Kreditbestand; keine eindeutige Nutzerzuordnung. Keine Zuordnung aggregierter Kosten erfinden.',
 'dv_v16_private.openai_scan_policy':'Globale Policy/Budget und Accounting-Key-Hash; kein persönlicher Datensatz, keine Schlüssel exportieren.',
 'dv_v16_private.openai_monthly_cost':'Globales Monatsaggregat; enthält keine sichere individuelle Zuordnung.',
 'dv_v16_private.openai_cost_import':'Historischer Gesamtimport ohne user_id; individueller Anteil nicht rekonstruierbar aus dieser Tabelle.',
 'dv_v16_private.operator_identity_v1':'Interne Operator-/Sicherheitsbindung; kein Scanner-Accounting.',
 'battle_spectator_private.links':'Zugangslink/Secret und Generation, keine eindeutig eigene Datenzeile.',
 'battle_spectator_media_private.config':'Globale Medienkonfiguration, keine eigene Teilnahmezeile.',
 'battle_spectator_media_private.epochs':'Gemeinsamer Medien-/Revokationszustand; Epoch/Generation nicht exportieren.',
 'battle_spectator_media_private.revocations':'Gemeinsamer technischer Arbeitsauftrag/Revokationsgrund; kein sicherer einzelner Owner. Rest vor erweitertem Rechteexport gesondert prüfen.',
 'public.battle_reports':'REST: Meldung/Fremdperson/Review/Staff gemischt. Vollständig ausgeschlossen, konkrete Fremdrechte-/Auskunftsentscheidung offen.',
 'public.staff_applications':'REST: Staff-/Bewerbungs-/Review-Daten außerhalb dieses T2-Teilblocks; nicht ungeprüft ausgeben.',
 'public.staff_permissions':'Staff-/Grantor-Daten außerhalb dieses T2-Teilblocks.',
 'public.admin_audit_log':'REST: administrative Nachweise mit Akteur/Ziel/Freitext; nicht Teil dieses Exports.'
};
const fields=report.columns.map(c=>{
 const table=c.schema+'.'+c.table_name,p=policies[table];
 let status,reason;
 if(p){
  if(p[1].split(' ').includes(c.column_name)){status='AUFNAHME';reason='Nur Zeilen gemäß Owner-Prädikat; explizite Feldprojektion.'}
  else if(p[2].split(' ').includes(c.column_name)){status='FILTER/ABLEITUNG';reason='Identität nur für Ownerprüfung bzw. eigene Host-/Gastrolle; rohe Kennung nicht im Zusatzpayload.'}
  else if(p[3].split(' ').includes(c.column_name)){status='EIGENE PROJEKTION';reason='Nur eigener Seitenwert bzw. eigenes Ergebnis; keine Gegnerwerte/rohen winner_id.'}
  else{status='AUSSCHLUSS';reason=table==='public.battle_matches'?'Einladung/Freitext/Namens-/Founder-/Moderationsdaten ausgeschlossen; Staff/Review bleibt konkreter Rest.':table==='public.battle_signals'?'SDP/ICE/Netzwerk- und potenzielle Zugangsdaten im Payload ausgeschlossen.':table==='dv_v16_private.scan_reservation'?'period_id verweist auf globalen Kreditbestand; keine persönlichen Verbrauchswerte verloren.':'Generation, Session- und Tab-Identifikatoren ausgeschlossen.'}
 }else{if(!excluded[table])throw Error('Unreviewed table '+table);status=excluded[table].startsWith('REST')?'REST/AUSSCHLUSS':'AUSSCHLUSS';reason=excluded[table]}
 return {...c,owner:p?.[0]||'Keine eindeutige persönliche Zeile im gewählten Scope',status,reason};
});
const inventory={source:'isolated reviewed P0-02 schema at 556469f879d6104e33b37e721278a8f3d10678fd; no live user rows',fields};
await writeFile('database/account-data-export-collect-battle-fields-v1.json',JSON.stringify(inventory,null,2)+'\n');
let md='# T2 – Tabellen-/Feldmatrix Scanner/BATTLE\n\nStand 26.09.2026. Isoliertes tatsächliches Schema aus versionierter Fixture plus P0-02; keine neue Liveattestierung. Jede katalogisierte Spalte ist einzeln zugeordnet. AUFNAHME bezeichnet technische Exportauswahl, keine pauschale rechtliche Vollständigkeit.\n\n';
for(const [t,cols] of Map.groupBy(fields,x=>x.schema+'.'+x.table_name)){
 md+='## '+t+'\n\nOwner: `'+cols[0].owner+'`.\n\n| Feld | Typ | Entscheidung | Begründung |\n|---|---|---|---|\n';
 for(const c of cols)md+=`| ${c.column_name} | ${c.type} | ${c.status} | ${c.reason} |\n`;
 md+='\n';
}
md+='## Abbildungs- und Restgrenzen\n\n';
md+='- Match `id` → `match_id`, eigene Host-/Gastseite → `participant_role`, `my_ready`, `my_reported_result` (self/opponent/draw), `winner_id` nur → `my_outcome` (won/lost/draw/null). Gemeinsame Match-Metadaten werden nur bei eigener Spielerbeteiligung ausgegeben; ein Zuschauergrant allein öffnet keine Matchzeile.\n';
md+='- Rating-Event `id` → `event_id`; ausschließlich eigene before/after/delta-Werte und eigenes Ergebnis. Signal `id` → `signal_id`; Payload bleibt vollständig ausgeschlossen.\n';
md+='- Historische Reservierungen/Usage bleiben auch ohne aktuellen OpenAI-Verbrauch enthalten. Bildhashes sind nutzerbezogene eigene Daten, nicht pauschal anonym. Token-Zahlen sind Verbrauchszähler, keine Zugangstokens. Globale Imports sind keine individuell zurechenbaren Providerrechnungen.\n';
md+='- Keine Aufrufe von Budget-, Cleanup-, Admission- oder Medienstatus-RPCs; ihre möglichen Nebenwirkungen sind für einen Export ungeeignet.\n';
md+='- Bestehende Collection-/Marketplace-/Widerrufsbereiche bleiben erhalten. Pickup wird ausschließlich über `dv_market_private.pickup_messages_for_export(auth.uid())` wieder eingebunden; dessen bestehende Konversation enthält self/other-Nachrichten ohne Gegenpartei-ID. Dies ist keine neu erlaubte Ausgabe fremder BATTLE-Daten.\n';
md+='- Offene Restbereiche: Reports/Staff/Judge, Signaling-Inhalte, gemeinsame Reconciler-/Revokationsdaten, nicht sicher zuordenbare Globalimporte sowie externe Providerkopien/Backups. T2-Gesamtvollständigkeit und gesetzlicher Auskunftsumfang werden damit nicht behauptet.\n';
md+='- Ein Audit-INSERT je erfolgreichem Gesamtaufruf bleibt gemäß Betreiberfreigabe 26.09. bestehen. Auditversion wird ausschließlich zur Kennzeichnung des V3-Payloads angepasst; kein neues Auditfeld, keine zweite Nachweiskette.\n';
await writeFile('docs/account-data-export-collect-battle-field-matrix-v1.md',md);
console.log('Wrote',fields.length,'field decisions across',new Set(fields.map(x=>x.schema+'.'+x.table_name)).size,'tables');
