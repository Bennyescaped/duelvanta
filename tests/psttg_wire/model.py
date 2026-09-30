"""Closed synthetic source editions; never a seller/tax export adapter."""
from dataclasses import dataclass, fields, asdict, is_dataclass
from typing import Literal, get_type_hints, get_origin, get_args
from types import UnionType
from datetime import date, datetime
from uuid import UUID
import re
from .security import require, canonical, sha, Rejected

PROFILE = 'reported-goods-natural-eur/1'
RULES = 'V116-business/1;boolean-60020-effective-2027-01-01'
EU = frozenset('AT BE BG HR CY CZ DE DK EE ES FI FR GR HU IE IT LT LU LV MT NL PL PT RO SE SI SK'.split())

def decode(cls, value):
    """No extra keys, coercion, missing-as-null or mutable objects inside editions."""
    origin = get_origin(cls)
    args = get_args(cls)
    if origin is Literal:
        require(value in args and any(type(value) is type(a) for a in args), 'input_literal')
        return value
    if origin is UnionType:
        for option in args:
            try:
                return decode(option, value)
            except Rejected:
                pass
        raise Rejected('input_union')
    if origin is tuple:
        require(type(value) is list and len(value) <= 1000, 'input_array')
        return tuple(decode(args[0], v) for v in value)
    if is_dataclass(cls):
        hints = get_type_hints(cls)
        require(type(value) is dict and set(value) == set(hints), 'input_fields:' + cls.__name__)
        return cls(**{k: decode(t, value[k]) for k, t in hints.items()})
    require(type(value) is cls, 'input_type')
    if cls is str:
        require(len(value) <= 4000 and '\r' not in value and '\x00' not in value, 'input_text')
    return value

def text(value, limit=200):
    require(type(value) is str and 0 < len(value) <= limit and value == value.strip(), 'text_required')
    require(value.casefold() not in {'unknown', 'notin', 'n/a', 'null', 'none', 'placeholder'}, 'placeholder')

def uid(value):
    try:
        require(str(UUID(value)) == value, 'uuid')
    except (ValueError, AttributeError) as exc:
        raise Rejected('uuid') from exc

def instant(value):
    try:
        require(datetime.fromisoformat(value.replace('Z', '+00:00')).utcoffset() is not None, 'instant_zone')
    except ValueError as exc:
        raise Rejected('instant') from exc

def at(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))

def sorted_unique(values):
    require(tuple(sorted(set(values))) == values, 'ordered_unique')

def cents(value):
    require(type(value) is str and re.fullmatch(r'-?(0|[1-9][0-9]{0,15})', value) is not None, 'exact_cent_source')
    return int(value)

@dataclass(frozen=True)
class Address:
    street_line1: str
    street_line2: str | None
    postal_code: str
    city: str
    country_code: str

@dataclass(frozen=True)
class Tin:
    value: str
    issuing_country: str
    kind: Literal['W_ID', 'IDNR', 'TAX_NUMBER', 'FOREIGN_TIN']
    allocation_evidence: str
    priority_evidence: str

@dataclass(frozen=True)
class BirthPlace:
    city: str
    subentity: str | None
    country_code: str | None
    former_country: str | None

@dataclass(frozen=True)
class Subject:
    person_ref: str
    seller_ids: tuple[str, ...]
    subject_type: Literal['natural_person']
    first_name: str
    last_name: str
    address: Address
    birth_date: str
    tins: tuple[Tin, ...]
    no_tin_basis: Literal['not_applicable', 'not_issued_by_residence_country']
    no_tin_evidence: str | None
    birth_place: BirthPlace | None
    vat_id: str | None
    vat_evidence: str
    residence_countries: tuple[str, ...]
    gvs_used: Literal[False]

@dataclass(frozen=True)
class FinancialAccount:
    identifier: str
    kind: Literal['IBAN', 'OTHER_QUALIFIED_ACCOUNT']
    holder_name: str | None
    holder_identifiers: tuple[str, ...]
    other_info: str | None
    applicability_evidence: str
    projection_evidence: str

@dataclass(frozen=True)
class Operator:
    revision: str
    legal_name: str
    address: Address
    tax_ids: tuple[Tin, ...]
    registration: Literal['not_applicable_domestic']
    platform_names: tuple[str, ...]
    residence_countries: tuple[str, ...]
    vat_id: str | None
    applicability_evidence: str
    nexus: Literal['not_applicable']
    assumed_reporting: Literal[False]

@dataclass(frozen=True)
class Event:
    event_id: str
    event_key: str
    version: int
    seller_id: str
    snapshot_ref: str
    allocation_ref: str
    source_type: Literal['synthetic_remuneration', 'synthetic_full_refund']
    source_reference: str
    evidence_binding: str
    occurred_at: str
    created_at: str
    reporting_year: int
    quarter: int
    currency: Literal['EUR']
    gross_cents: str
    platform_cents: str
    commission_cents: str
    tax_cents: str
    consideration_cents: str
    activities: int
    correction_of: str | None

@dataclass(frozen=True)
class Decision:
    eligibility_ref: str
    assessment_version: str
    assessed_at: str
    source_cutoff: str
    completeness_ref: str
    account_evidence: str
    activity_count_basis: Literal['paid_contract_snapshot_one_activity']
    financial_evidence: str
    financial_mode: Literal['known_accounts', 'DE_exemption', 'none_known_verified']

@dataclass(frozen=True)
class Position:
    position_ref: str
    content_revision: int
    predecessor_ref: str | None
    reporting_year: int
    activity_kind: Literal['GOODS_SALE']
    subject: Subject
    financial_accounts: tuple[FinancialAccount, ...]
    decision: Decision
    events: tuple[Event, ...]
    annual_gross_cents: str
    annual_consideration_cents: str

@dataclass(frozen=True)
class SourcePack:
    origin: Literal['synthetic_test']
    environment: Literal['TEST']
    attestation: str
    producer: Literal['offline-synthetic-fixture/1']
    revision: str
    operator: Operator
    positions: tuple[Position, ...]
    known_person_refs: tuple[str, ...]
    known_seller_ids: tuple[str, ...]
    known_event_ids: tuple[str, ...]
    due_position_refs: tuple[str, ...]
    completeness_evidence: str

@dataclass(frozen=True)
class Doc:
    kind: Literal['operator', 'seller']
    owner_ref: str
    doc_type: Literal['OECD0', 'OECD1', 'OECD2', 'OECD3']
    doc_ref: str
    corr_doc_ref: str | None

@dataclass(frozen=True)
class Delivery:
    profile: Literal['reported-goods-natural-eur/1']
    revision: str
    source_revision: str
    reporting_year: int
    position_refs: tuple[str, ...]
    message_ref: str
    timestamp: str
    sending_entity_in: str
    mode: Literal['initial', 'supplement', 'correction', 'deletion_reference']
    operator_doc: Doc
    seller_docs: tuple[Doc, ...]
    rules: str


def check_address(a):
    for v in [a.street_line1, a.postal_code, a.city]:
        text(v)
    if a.street_line2 is not None:
        text(a.street_line2)
    require(re.fullmatch('[A-Z]{2}', a.country_code) is not None, 'address_country')

def check_tins(items):
    require(len(items) > 0, 'tin_required')
    require(len({(t.value,t.issuing_country) for t in items}) == len(items), 'duplicate_tin')
    for t in items:
        text(t.value); text(t.allocation_evidence); text(t.priority_evidence)
        require(re.fullmatch('[A-Z]{2}', t.issuing_country) is not None, 'tin_country')
        require((t.issuing_country == 'DE') == (t.kind != 'FOREIGN_TIN'), 'tin_kind_country')
        # Kind/applicability evidence remains mandatory; eleven digits is not a universal rule.
        if t.kind == 'IDNR':
            require(re.fullmatch('[0-9]{11}', t.value) is not None, 'idnr_format')
        if t.kind == 'W_ID':
            require(re.fullmatch('DE[0-9]{9}(-[0-9]{5})?', t.value) is not None, 'wid_format')
    de = [t.kind for t in items if t.issuing_country == 'DE']
    require(len(de) <= 1, 'tin_priority_conflict')

def check_pack(pack):
    text(pack.attestation); text(pack.completeness_evidence); uid(pack.revision)
    op = pack.operator
    text(op.revision); text(op.legal_name); text(op.applicability_evidence)
    check_address(op.address); check_tins(op.tax_ids)
    require(op.address.country_code == 'DE' and op.residence_countries == ('DE',), 'domestic_operator')
    require(bool(op.platform_names), 'platform_names')
    sorted_unique(op.platform_names)
    for n in op.platform_names:
        text(n)
    if op.vat_id is not None:
        text(op.vat_id)
    require(0 < len(pack.positions) <= 100, 'batch_limit')
    require(tuple(sorted(p.position_ref for p in pack.positions)) == tuple(p.position_ref for p in pack.positions), 'source_order')
    require(len({p.position_ref for p in pack.positions}) == len(pack.positions), 'position_duplicate')
    for actual, known in [(tuple(sorted(p.subject.person_ref for p in pack.positions)),pack.known_person_refs),
                          (tuple(sorted(s for p in pack.positions for s in p.subject.seller_ids)),pack.known_seller_ids),
                          (tuple(sorted(e.event_id for p in pack.positions for e in p.events)),pack.known_event_ids)]:
        sorted_unique(known); require(actual == known, 'source_inventory_incomplete_or_duplicate')
    sorted_unique(pack.due_position_refs)
    require(bool(pack.due_position_refs) and set(pack.due_position_refs) <= {p.position_ref for p in pack.positions}, 'due_inventory')
    for p in pack.positions:
        uid(p.position_ref); require(p.content_revision >= 1, 'content_revision')
        if p.predecessor_ref is not None:
            uid(p.predecessor_ref)
        require(2000 <= p.reporting_year <= 9998, 'reporting_year')
        s = p.subject
        uid(s.person_ref); sorted_unique(s.seller_ids); require(bool(s.seller_ids), 'seller_accounts')
        for account in s.seller_ids:
            uid(account)
        text(s.first_name); text(s.last_name); check_address(s.address)
        try:
            born = date.fromisoformat(s.birth_date)
        except ValueError as exc:
            raise Rejected('birth_date') from exc
        require(date(1900,1,1) < born <= date(p.reporting_year,12,31), 'birth_plausibility')
        sorted_unique(s.residence_countries)
        require(bool(EU.intersection(s.residence_countries)), 'EU_connection')
        if s.tins:
            check_tins(s.tins); require(s.no_tin_basis == 'not_applicable' and s.no_tin_evidence is None, 'tin_choice')
        else:
            require(s.no_tin_basis == 'not_issued_by_residence_country' and s.no_tin_evidence is not None
                    and s.birth_place is not None and 'DE' not in s.residence_countries, 'no_tin_basis')
            text(s.no_tin_evidence)
        if s.birth_place:
            bp = s.birth_place; text(bp.city)
            require((bp.country_code is None) != (bp.former_country is None), 'birth_country_choice')
            for v in [bp.subentity,bp.former_country]:
                if v is not None:
                    text(v)
        text(s.vat_evidence)
        if s.vat_id is not None:
            text(s.vat_id)
        d = p.decision
        for v in [d.eligibility_ref,d.assessment_version,d.completeness_ref,d.account_evidence,d.financial_evidence]:
            text(v)
        instant(d.assessed_at); instant(d.source_cutoff)
        require(at(d.assessed_at) >= at(d.source_cutoff), 'assessment_cutoff')
        if d.financial_mode == 'DE_exemption':
            require(s.residence_countries == ('DE',) and not p.financial_accounts, 'financial_exemption')
        elif d.financial_mode == 'none_known_verified':
            require(not p.financial_accounts, 'financial_absence')
        else:
            require(bool(p.financial_accounts), 'financial_missing')
        for a in p.financial_accounts:
            text(a.identifier); text(a.applicability_evidence); text(a.projection_evidence)
            require(not a.identifier.startswith('acct_'), 'not_financial_identifier')
            if a.holder_name is not None:
                text(a.holder_name)
            for v in a.holder_identifiers:
                text(v)
            require((a.other_info is None) == (not a.holder_identifiers), 'holder_projection')
            if a.other_info is not None:
                text(a.other_info,400)
                require(a.other_info == '\n'.join(a.holder_identifiers), 'holder_lossless_projection')
        sorted_unique(tuple(e.event_id for e in p.events))
        originals = {e.event_id:e for e in p.events if e.correction_of is None}
        refunded = set()
        for e in p.events:
            uid(e.event_id); uid(e.seller_id)
            for v in [e.event_key,e.snapshot_ref,e.allocation_ref,e.source_reference,e.evidence_binding]:
                text(v)
            instant(e.occurred_at); instant(e.created_at)
            require(e.version >= 1 and e.seller_id in s.seller_ids and e.reporting_year == p.reporting_year
                    and 1 <= e.quarter <= 4, 'event_scope')
            require(at(e.created_at) <= at(d.source_cutoff) and at(e.occurred_at) <= at(d.source_cutoff), 'event_cutoff')
            amounts = [cents(getattr(e,k)) for k in ('gross_cents','platform_cents','commission_cents','tax_cents','consideration_cents')]
            require(amounts[0]-sum(amounts[1:4]) == amounts[4], 'gross_control')
            if e.correction_of is None:
                require(e.source_type == 'synthetic_remuneration' and e.activities == 1 and min(amounts) >= 0, 'positive_event')
                from zoneinfo import ZoneInfo
                local = datetime.fromisoformat(e.occurred_at.replace('Z','+00:00')).astimezone(ZoneInfo('Europe/Berlin'))
                require(local.year == p.reporting_year and (local.month-1)//3+1 == e.quarter, 'event_period')
            else:
                require(e.source_type == 'synthetic_full_refund' and e.activities == -1
                        and e.correction_of in originals and e.correction_of not in refunded, 'refund_original')
                old = originals[e.correction_of]; refunded.add(e.correction_of)
                require(e.seller_id == old.seller_id and e.snapshot_ref == old.snapshot_ref and e.quarter == old.quarter
                        and at(e.occurred_at) >= at(old.occurred_at), 'refund_period')
                for k in ('gross_cents','platform_cents','commission_cents','tax_cents','consideration_cents'):
                    require(cents(getattr(e,k)) == -cents(getattr(old,k)), 'full_refund')
        require(len({e.event_key for e in p.events}) == len(p.events), 'event_key_duplicate')
        require(sum(cents(e.gross_cents) for e in p.events) == cents(p.annual_gross_cents), 'annual_gross')
        require(sum(cents(e.consideration_cents) for e in p.events) == cents(p.annual_consideration_cents), 'annual_consideration')

def quarters(position):
    result = []
    for q in range(1,5):
        events = [e for e in position.events if e.quarter == q]
        cons = sum(cents(e.consideration_cents) for e in events)
        fees = sum(cents(e.platform_cents)+cents(e.commission_cents) for e in events)
        taxes = sum(cents(e.tax_cents) for e in events)
        count = sum(e.activities for e in events)
        require(min(cons,fees,taxes,count) >= 0, 'negative_quarter')
        require(all(v % 100 == 0 for v in (cons,fees,taxes)), 'M01_nonintegral_quarter')
        result.append((cons//100,count,fees//100,taxes//100))
    return tuple(result)
