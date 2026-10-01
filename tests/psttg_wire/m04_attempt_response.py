"""Private V131 correlation core: synthetic, single-caller, in-memory only.

No transport, database, signer, clock, endpoint, credential or retry facility.
ProofReference is a controlled upstream reference, NOT a database commit proof.
M02 verification is recomputed; the actual signed item's position is extracted.
Response identifiers are caller-observed synthetic claims, NOT parsed/authenticated
real receipts. BOUND means correlation only. All history dies with this object.
"""
from dataclasses import dataclass, field
from enum import Enum

from .security import DIP, require, sha, LIMIT
from .model import uid
from .envelope import secure_parse
from .signature_profile import VerifiedSignature
from .signed_validation import validate_bound_projection


class Status(str, Enum):
    BOUND = 'BOUND'
    REPLAY = 'REPLAY'
    CONFLICT = 'CONFLICT'
    UNRESOLVED = 'UNRESOLVED'
    UNKNOWN = 'UNKNOWN'


class Phase(str, Enum):
    PREPARED = 'attempt_prepared'
    START = 'start_response_observed'
    UPLOAD = 'upload_response_observed'
    FINISH = 'finish_response_observed'
    PROTOCOL = 'protocol_response_observed'
    NN = 'nn_response_observed'
    ACK = 'acknowledgement_response_observed'
    UNKNOWN = 'unknown_phase'


class Presence(str, Enum):
    NOT_OBSERVED = 'not_observed'
    POSSIBLY_LOST = 'possibly_lost'
    OBSERVED = 'observed_in_memory'


SERVICE_KINDS = frozenset(('datentransfernummer', 'responseTransferticketId',
                           'MessageRefId', 'DocRefId', 'messageNumber', 'messageId'))


def _label(value):
    require(type(value) is str and 0 < len(value) <= 200
            and value.isascii() and all(c.isalnum() or c in '-_.' for c in value),
            'm04_identifier')


@dataclass(frozen=True, slots=True)
class Scope:
    environment: str
    channel_profile: str
    account_profile: str | None

    def __post_init__(self):
        # OTHER is solely an inert synthetic negative-control namespace, not PROD.
        require(self.environment in ('TEST', 'SYNTHETIC_OTHER'), 'm04_environment')
        uid(self.channel_profile)
        if self.account_profile is not None:
            uid(self.account_profile)


@dataclass(frozen=True, slots=True)
class ProofReference:
    proof_id: str
    operation_ref: str
    attempt_ref: str
    input_revision: int
    envelope_revision: str
    edition_binding: str
    signed_sha256: str

    def __post_init__(self):
        for value in (self.proof_id, self.operation_ref, self.attempt_ref,
                      self.envelope_revision):
            uid(value)
        require(type(self.input_revision) is int and self.input_revision > 0,
                'm04_input_revision')
        for value in (self.edition_binding, self.signed_sha256):
            require(type(value) is str and len(value) == 64
                    and all(c in '0123456789abcdef' for c in value), 'm04_hash')


@dataclass(frozen=True, slots=True)
class AttemptBinding:
    proof: ProofReference
    delivery_revision: str
    source_revision: str
    message_ref: str
    doc_refs: tuple[str, ...]
    signed_bytes: bytes
    scope: Scope
    transfer_ticket: str
    item_position: str
    prepared_order: int
    phase: Phase = field(default=Phase.PREPARED, init=False)
    origin: str = field(default='synthetic_test', init=False)


@dataclass(frozen=True, slots=True)
class ServiceId:
    kind: str
    value: str

    def __post_init__(self):
        require(self.kind in SERVICE_KINDS, 'm04_service_kind')
        _label(self.value)


@dataclass(frozen=True, slots=True)
class ResponseInput:
    observation_ref: str
    scope: Scope
    phase: Phase
    presence: Presence
    original_bytes: bytes | None
    attempt_ref: str | None = None
    service_ids: tuple[ServiceId, ...] = ()
    # Echoes of the ORIGINAL request, distinct from response-owned service_ids.
    transfer_ticket: str | None = None
    message_ref: str | None = None
    doc_refs: tuple[str, ...] = ()
    item_position: str | None = None
    http_status: int | None = None
    origin: str = 'synthetic_test'

    def __post_init__(self):
        uid(self.observation_ref)
        require(type(self.scope) is Scope and type(self.phase) is Phase
                and self.phase is not Phase.PREPARED, 'm04_response_phase')
        require(type(self.presence) is Presence and self.origin == 'synthetic_test',
                'm04_synthetic_observation')
        if self.attempt_ref is not None:
            uid(self.attempt_ref)
        require(type(self.service_ids) is tuple and len(self.service_ids) <= len(SERVICE_KINDS)
                and all(type(x) is ServiceId for x in self.service_ids)
                and len({x.kind for x in self.service_ids}) == len(self.service_ids),
                'm04_service_ids')
        require(type(self.doc_refs) is tuple and len(self.doc_refs) <= 101
                and len(set(self.doc_refs)) == len(self.doc_refs), 'm04_doc_refs')
        for value in self.doc_refs:
            _label(value)
        for value in (self.transfer_ticket, self.message_ref, self.item_position):
            if value is not None:
                _label(value)
        if self.presence is Presence.OBSERVED:
            require(type(self.original_bytes) is bytes and len(self.original_bytes) <= LIMIT,
                    'm04_response_bytes')
            require(self.http_status is None or (type(self.http_status) is int
                    and 100 <= self.http_status <= 599), 'm04_synthetic_http_status')
        else:
            require(self.original_bytes is None and self.http_status is None
                    and not self.service_ids and self.transfer_ticket is None
                    and self.message_ref is None and not self.doc_refs
                    and self.item_position is None, 'm04_missing_not_response')


@dataclass(frozen=True, slots=True)
class ResponseObservation:
    input: ResponseInput
    original_sha256: str | None
    order: int
    attempt_ref: str | None
    correlation_status: Status
    reason: str


@dataclass(frozen=True, slots=True)
class Decision:
    status: Status
    reason: str
    attempt: AttemptBinding | None = None
    observation: ResponseObservation | None = None
    external_ack_performed: bool = field(default=False, init=False)
    real_receipt_adapter: bool = field(default=False, init=False)


class AttemptBook:
    """Serial calls only. Append-only evidence, no conflict resolution facility.

    Service ownership and byte identity: (scope, phase, kind, value).
    A phase transition needs its own unambiguous anchor; no cross-phase alias
    is inferred from a number alone. Echoed Message/Doc/item/ticket values
    are constraints, not globally unique service identifiers.
    Missing hints -> UNRESOLVED; intersecting hints with >1 candidate ->
    UNRESOLVED; contradictory nonempty hints -> sticky CONFLICT. No latest-win.
    """
    def __init__(self):
        self._attempts = {}
        self._attempt_events = []
        self._observations = []
        self._by_ref = {}
        self._seen = {}
        self._owners = {}
        self._responses = {}
        self._blocked = set()
        self._order = 0

    @property
    def attempts(self):
        return tuple(self._attempts.values())

    @property
    def attempt_events(self):
        return tuple(self._attempt_events)

    @property
    def observations(self):
        return tuple(self._observations)

    def _next(self):
        self._order += 1
        return self._order

    def prepare(self, verified, proof, scope, schemas):
        require(type(verified) is VerifiedSignature and type(proof) is ProofReference
                and type(scope) is Scope, 'm04_bound_input')
        signed = verified.signed
        u = signed.unsigned
        e = u.edition
        # Recompute existing verification, never accept a caller's PASS string.
        validate_bound_projection(verified, e, u.spec, schemas)
        require(proof.signed_sha256 == sha(signed.xml)
                and proof.edition_binding == e.binding
                and proof.envelope_revision == u.spec.revision, 'm04_proof_binding')
        require(scope.environment == u.spec.environment, 'm04_scope_envelope')
        root = secure_parse(signed.xml)
        items = root.findall('{'+DIP+'}body/{'+DIP+'}consignmentItem')
        require(len(items) == 1, 'm04_single_item')
        position = items[0].get('consignmentItemPosition')
        require(position == u.spec.item_position, 'm04_item_binding')
        old = self._attempts.get(proof.attempt_ref)
        candidate = AttemptBinding(proof, e.delivery.revision, e.delivery.source_revision,
            e.delivery.message_ref, tuple(d.doc_ref for d in
            (e.delivery.operator_doc,) + e.delivery.seller_docs), signed.xml, scope,
            u.spec.transfer_ticket, position, old.prepared_order if old else self._order+1)
        if old is not None:
            if old != candidate:
                self._blocked.add(proof.attempt_ref)
                self._attempt_events.append((self._next(), Status.CONFLICT, candidate))
                return Decision(Status.CONFLICT, 'attempt_changed_binding', old)
            status = Status.CONFLICT if proof.attempt_ref in self._blocked else Status.REPLAY
            return Decision(status, 'attempt_blocked' if status is Status.CONFLICT
                            else 'identical_attempt', old)
        self._next()
        self._attempts[proof.attempt_ref] = candidate
        self._attempt_events.append((candidate.prepared_order, Status.BOUND, candidate))
        return Decision(Status.BOUND, 'prepared_in_memory_only', candidate)

    def _choose(self, request):
        candidates = {k: a for k, a in self._attempts.items() if a.scope == request.scope}
        hints = []
        if request.attempt_ref is not None:
            if request.attempt_ref not in candidates:
                return Status.UNRESOLVED, 'unknown_attempt_or_scope', None, set()
            hints.append({request.attempt_ref})
        for identity in request.service_ids:
            owner = self._owners.get((request.scope, request.phase, identity.kind, identity.value))
            if owner is not None:
                hints.append({owner})
        for attr, value in (('transfer_ticket', request.transfer_ticket),
                            ('message_ref', request.message_ref)):
            if value is not None:
                match = {k for k, a in candidates.items() if getattr(a, attr) == value}
                if not match:
                    return Status.UNRESOLVED, 'foreign_'+attr, None, set()
                hints.append(match)
        if request.doc_refs:
            match = {k for k, a in candidates.items() if set(request.doc_refs) <= set(a.doc_refs)}
            if not match:
                return Status.UNRESOLVED, 'foreign_doc_ref', None, set()
            hints.append(match)
        if not hints:
            return Status.UNRESOLVED, 'no_unique_anchor', None, set()
        intersection = set.intersection(*hints)
        involved = set.union(*hints)
        if not intersection:
            return Status.CONFLICT, 'contradictory_attempt_anchors', None, involved
        if len(intersection) > 1:
            return Status.UNRESOLVED, 'ambiguous_attempt', None, set()
        key = next(iter(intersection))
        a = candidates[key]
        if request.item_position is not None and request.item_position != a.item_position:
            return Status.UNRESOLVED, 'wrong_item_position', None, set()
        if key in self._blocked:
            return Status.CONFLICT, 'attempt_blocked', key, {key}
        return Status.BOUND, 'unique_synthetic_correlation', key, set()

    @staticmethod
    def _body_claims(r):
        return (r.original_bytes, r.http_status, r.transfer_ticket, r.message_ref,
                r.doc_refs, r.item_position)

    def observe(self, request):
        require(type(request) is ResponseInput, 'm04_response_type')
        prior = self._by_ref.get(request.observation_ref)
        seen = self._seen.get(request)
        if seen is not None:
            blocked = seen.attempt_ref in self._blocked or seen.correlation_status is Status.CONFLICT
            return Decision(Status.CONFLICT if blocked else Status.REPLAY,
                            'observation_blocked' if blocked else 'identical_observation',
                            self._attempts.get(seen.attempt_ref), seen)
        status, reason, key, involved = self._choose(request)
        # An already known scoped identity cannot evade a byte conflict by adding
        # a wrong echo field. Other environments/accounts remain separate keys.
        for identity in request.service_ids:
            old = self._responses.get((request.scope, request.phase, identity.kind, identity.value))
            if old is not None and self._body_claims(old.input) != self._body_claims(request):
                status, reason = Status.CONFLICT, 'service_identity_changed_response'
                involved.update(k for k in (old.attempt_ref, key) if k is not None)
        if prior is not None:
            status, reason = Status.CONFLICT, 'observation_ref_changed'
            involved.update(k for k in (prior.attempt_ref, key) if k is not None)
        if status is Status.BOUND:
            if request.presence is not Presence.OBSERVED:
                status, reason = Status.UNKNOWN, request.presence.value
            elif request.phase is Phase.UNKNOWN:
                status, reason = Status.UNKNOWN, 'phase_not_known'
            else:
                replay = False
                for identity in request.service_ids:
                    byte_key = (request.scope, request.phase, identity.kind, identity.value)
                    old = self._responses.get(byte_key)
                    if old is not None:
                        if self._body_claims(old.input) != self._body_claims(request):
                            status, reason = Status.CONFLICT, 'service_identity_changed_response'
                            involved.add(key)
                        else:
                            replay = True
                if status is Status.BOUND and replay:
                    status, reason = Status.REPLAY, 'identical_scoped_response'
        self._blocked.update(involved)
        observation = ResponseObservation(request,
            sha(request.original_bytes) if request.original_bytes is not None else None,
            self._next(), key, status, reason)
        self._observations.append(observation)
        self._seen[request] = observation
        self._by_ref.setdefault(request.observation_ref, observation)
        if status in (Status.BOUND, Status.REPLAY):
            for identity in request.service_ids:
                self._owners.setdefault((request.scope, request.phase, identity.kind, identity.value), key)
                self._responses.setdefault((request.scope, request.phase, identity.kind,
                                            identity.value), observation)
        return Decision(status, reason, self._attempts.get(key), observation)
