"""Closed V147 value codec. No I/O; original signed bytes remain in W11.

Type tags are an explicit allowlist, never Python import/class names supplied
by a caller. Attempt values are restrictive references plus the complete V140
metadata projection; decoding needs an independently revalidated Attempt.
"""
from dataclasses import fields
from datetime import datetime
from enum import Enum
import json

from . import m03_trust_profile as m
from . import m04_transport_state as t
from . import m04_attempt_response as v
from .m04_response_store import binding
from .security import canonical, require

CONTRACT = 'V147-M04-synthetic-adapter-history/1'
CODEC = 'm04-adapter-history-json-hex/1'
KINDS = frozenset(('ADAPTER_ATTACHMENT', 'REQUEST', 'SEND_EVIDENCE',
    'M03_SNAPSHOT', 'RAW_CAPTURE', 'RECEIPT_INTERPRETATION',
    'EVIDENCE_ASSERTION', 'ADAPTER_CONFLICT'))

_CLASSES = (
    m.Version, m.AccessScope, m.UsageScope, m.TrustProfile,
    m.CredentialReference, m.EvidenceReference, m.LifecycleEvidence,
    m.Snapshot, m.UseContext, m.AccessRequest, m.EligibilityDecision,
    m.AttemptAccessBinding, v.Scope, t.RequestBinding, t.SendEvidence,
    t.RawResponseCapture, t.ReceiptInterpretation, t.ServiceID, t.Claim,
    t.CorrelationEvidence, t.Projection,
)
_ENUMS = (
    m.Role, m.Environment, m.Purpose, m.Algorithm, m.State, m.EventKind,
    m.EvidenceKind, m.Result, m.Observation, v.Phase, v.Presence,
    t.State, t.Effect, t.Progress, t.Error, t.Event, t.Code, t.Reason,
    t.Target, t.Method, t.Completeness, t.Commit, t.ServiceKind,
    t.ClaimKind, t.Fact, t.Terminal, t.ReceiptKind, t.AckStage,
)
_TAGS = {cls: ('m03.' if cls.__module__ == m.__name__ else
                   'v140.' if cls.__module__ == v.__name__ else 'm04.') + cls.__name__
         for cls in _CLASSES + _ENUMS}
_TYPES = {tag: cls for cls, tag in _TAGS.items()}


def encode(value):
    typ = type(value)
    if value is None or typ in (str, bool):
        return value
    if typ is int:
        require(-(1 << 63) <= value < (1 << 63), 'history_integer')
        return value
    if typ is datetime:
        m.instant(value)
        return {'type': 'aware-time', 'value': value.isoformat()}
    if typ is bytes:
        require(len(value) <= t.LIMIT, 'history_bytes')
        return {'type': 'bytes', 'hex': value.hex()}
    if typ is tuple:
        return {'type': 'tuple', 'items': [encode(x) for x in value]}
    if typ is v.AttemptBinding:
        m.check_attempt(value)
        return {'type': 'attempt-reference', 'binding': binding(value)}
    require(typ in _TAGS, 'history_closed_type')
    if isinstance(value, Enum):
        return {'type': _TAGS[typ], 'value': value.value}
    data = {f.name: encode(getattr(value, f.name)) for f in fields(value) if f.init}
    if typ is t.RequestBinding:
        # Validate byte identity before removing the only redundant body copy.
        require(value.body == (value.attempt.signed_bytes if value.phase is v.Phase.UPLOAD else None),
                'history_signed_original')
        data['body'] = {'type': 'signed-original'} if value.body is not None else None
    return {'type': _TAGS[typ], 'fields': data}


def decode(value, attempts):
    if value is None or type(value) in (str, bool, int):
        require(encode(value) == value, 'history_scalar')
        return value
    require(type(value) is dict and type(value.get('type')) is str, 'history_tag')
    tag = value['type']
    if tag == 'attempt-reference':
        require(set(value) == {'type', 'binding'}, 'history_attempt_shape')
        b = value['binding']
        a = attempts.get(b['proof']['attempt_ref'])
        require(a is not None and binding(a) == b, 'history_attempt_source')
        return a
    if tag == 'aware-time':
        require(set(value) == {'type', 'value'}, 'history_time_shape')
        result = datetime.fromisoformat(value['value']); m.instant(result)
    elif tag == 'bytes':
        require(set(value) == {'type', 'hex'}, 'history_bytes_shape')
        s = value['hex']
        require(type(s) is str and len(s) <= t.LIMIT * 2 and len(s) % 2 == 0
                and all(c in '0123456789abcdef' for c in s), 'history_hex')
        result = bytes.fromhex(s)
    elif tag == 'tuple':
        require(set(value) == {'type', 'items'} and type(value['items']) is list, 'history_tuple')
        result = tuple(decode(x, attempts) for x in value['items'])
    else:
        require(tag in _TYPES, 'history_closed_tag')
        cls = _TYPES[tag]
        if issubclass(cls, Enum):
            require(set(value) == {'type', 'value'}, 'history_enum_shape')
            result = cls(value['value'])
        else:
            require(set(value) == {'type', 'fields'} and type(value['fields']) is dict,
                    'history_fields')
            data = value['fields']
            require(set(data) == {f.name for f in fields(cls) if f.init}, 'history_closed_fields')
            if cls is t.RequestBinding:
                other = {k: decode(x, attempts) for k, x in data.items() if k != 'body'}
                original = other['access'].attempt.signed_bytes
                require(data['body'] in (None, {'type': 'signed-original'}), 'history_body_source')
                other['body'] = original if data['body'] is not None else None
                result = cls(**other)
            else:
                result = cls(**{k: decode(x, attempts) for k, x in data.items()})
    require(encode(result) == value, 'history_roundtrip')
    return result


def frozen(value):
    return canonical(encode(value))


def thaw(raw, attempts):
    require(type(raw) is bytes, 'history_frozen_bytes')
    value = json.loads(raw)
    require(canonical(value) == raw, 'history_canonical')
    return decode(value, attempts)


def replay_m03(before, commands):
    """Recompute lifecycle via V143's closed operations, including atomic rotation.

    A snapshot or positive caller boolean alone is never admission evidence.
    """
    require(type(before) is m.Snapshot and type(commands) is tuple, 'history_m03_input')
    require(before.scope.access.environment is m.Environment.TEST, 'history_real_forbidden')
    cell = m.ReferenceCell(before.scope)
    cell._snapshot = before
    for cmd in commands:
        if type(cmd) in (m.TrustProfile, m.CredentialReference, m.EvidenceReference):
            result = cell.register(cmd)
        elif type(cmd) is m.LifecycleEvidence:
            result = cell.lifecycle(cmd)
        elif type(cmd) is tuple and len(cmd) == 3:
            result = cell.rotate(*cmd)
        else:
            require(False, 'history_m03_command')
        require(result in (m.Result.BOUND, m.Result.REPLAY, m.Result.CONFLICT), 'history_m03_cas')
    require(cell.snapshot != before, 'history_m03_no_change')
    return cell.snapshot
