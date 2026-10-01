import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sql=await readFile(new URL('../database/market-tax-transparency-v1.sql',import.meta.url),'utf8');
const must=(text,message)=>assert.ok(sql.includes(text),message);

for(const table of ['market_tax_events','market_tax_exports','market_tax_export_rows'])must(table,'missing '+table);
must("psttg_subject_type in ('unclassified','natural_person','legal_entity')",'PStTG subject type is inferred or unconstrained');
must('market_tax_evidence_is_immutable','tax evidence mutation is not blocked');
must('set search_path = pg_catalog, public, dv_market_private, extensions','pgcrypto extension schema is missing from tax hash functions');
must('alter table dv_market_private.market_tax_events enable row level security','private tax ledger lacks RLS defense in depth');
must("'contract_formed','remuneration_paid_or_credited','remuneration_correction'",'event lifecycle is incomplete');
must("'counted_as_remuneration',false",'manual-beta contract is incorrectly treated as remuneration');
must("event_type='remuneration_paid_or_credited'",'paid/credited remuneration boundary is missing');
must("p_source_type not in ('manual_verified','payment_provider')",'remuneration source is not restricted');
must('tax_activity_void_requires_full_reversal','activity counts can be voided without a full reversal');
must("event_type='remuneration_paid_or_credited' for update",'parallel corrections are not serialized on the original event');
must("coalesce(y.activity_count,0)<30 and coalesce(y.remuneration,0)<2000",'PStTG goods exception does not require both strict thresholds');
must("'exactly_30_activities'",'exact 30 boundary evidence is missing');
must("'exactly_2000_eur_remuneration'",'exact EUR 2,000 boundary evidence is missing');
must("export_format in ('json','csv')",'JSON/CSV export formats are missing');
must("'review_evidence_not_bzst_submission'",'review export could be mistaken for a filed BZSt report');
must("'tax_identifiers_remain_encrypted',true",'export does not declare encrypted tax identifiers');
must('grant execute on function public.record_market_tax_remuneration','backend remuneration function is not granted');
must('grant execute on function public.generate_market_tax_export','backend export function is not granted');
assert.ok(!/grant execute on function public\.(record_market_tax_remuneration|correct_market_tax_remuneration|generate_market_tax_export|get_market_tax_export)[^;]+authenticated/.test(sql),'browser role can access private PStTG operations');
assert.ok(!/grant (select|insert|update|delete)[^;]+market_tax_(events|exports|export_rows)[^;]+authenticated/.test(sql),'browser role has direct tax table access');

console.log('PASS: append-only PStTG/DAC7 ledger, strict thresholds and backend-only exports are contracted');
