"""V144 synthetic port/state reference. In-memory, no transport or durability.

Ports are CLOSED injected script values, not arbitrary executable callbacks.
Only exact port classes are admitted. The private Python process is trusted,
not a sandbox for hostile monkeypatching. All commit/provenance witnesses here
are explicitly synthetic fixtures, never substitutes for real W11/M03 evidence.
No clock, randomness, signer, parser, credential lookup, database or I/O calls.
"""
from contextlib import ExitStack
from dataclasses import dataclass, field, replace
from datetime import datetime
from enum import Enum
from hashlib import sha256
from threading import RLock
from . import m03_trust_profile as m03
from .m04_attempt_response import AttemptBinding, Phase, Presence, Scope

CONTRACT = 'V144-M04-sendfree-state/1'
CODEC = 'm04-frozen-script/1'
LIMIT = 4 * 1024 * 1024  # private bounded fixture limit, NOT a service limit


class Rejected(ValueError):
    """Closed codes only; never interpolate inputs or propagate port text."""


def need(ok, code='TYPE_CODEC'):
    if not ok: raise Rejected(code)


def exact(x, cls): need(type(x) is cls)
def ref(x):
    try: m03.ref(x)
    except m03.Rejected: raise Rejected('REFERENCE_CODEC') from None


def integer(x, minimum=1): need(type(x) is int and minimum <= x <= (1 << 63)-1, 'INTEGER_CODEC')
def instant(x):
    try: m03.instant(x)
    except m03.Rejected: raise Rejected('TIME_CODEC') from None


def digest(raw): return sha256(raw).hexdigest()
def hash_value(x): need(type(x) is str and len(x) == 64 and all(c in '0123456789abcdef' for c in x), 'HASH_CODEC')
def items(xs, cls): need(type(xs) is tuple and all(type(x) is cls for x in xs), 'TUPLE_CODEC')


class State(str, Enum):
    PREPARED = 'PREPARED'
    REQUEST_BYTES_COMMITTED_LOCAL = 'REQUEST_BYTES_COMMITTED_LOCAL'
    SEND_STARTED = 'SEND_STARTED'
    RESPONSE_OBSERVED = 'RESPONSE_OBSERVED'
    RESPONSE_COMMITTED = 'RESPONSE_COMMITTED'
    UNKNOWN = 'UNKNOWN'
    TRANSPORT_FAILED = 'TRANSPORT_FAILED'


class Effect(str, Enum):
    NOT_DISPATCHED_PROVEN = 'NOT_DISPATCHED_PROVEN'
    POSSIBLY_DISPATCHED = 'POSSIBLY_DISPATCHED'
    DISPATCHED_OBSERVED = 'DISPATCHED_OBSERVED'
    REMOTE_EFFECT_UNKNOWN = 'REMOTE_EFFECT_UNKNOWN'


class Progress(str, Enum):
    NONE = 'NONE'
    INTENT = 'INTENT'
    LOCAL_WRITE_COMPLETE = 'LOCAL_WRITE_COMPLETE'
    RESPONSE_SEEN = 'RESPONSE_SEEN'


class Error(str, Enum):
    LOCAL_PRE_SEND_FAILURE = 'LOCAL_PRE_SEND_FAILURE'
    AUTH_FAILURE = 'AUTH_FAILURE'
    TLS_FAILURE = 'TLS_FAILURE'
    CONNECT_FAILURE = 'CONNECT_FAILURE'
    TIMEOUT_UNKNOWN = 'TIMEOUT_UNKNOWN'
    REMOTE_TRANSPORT_ERROR = 'REMOTE_TRANSPORT_ERROR'
    HTTP_ERROR = 'HTTP_ERROR'
    RESPONSE_PARSE_ERROR = 'RESPONSE_PARSE_ERROR'
    RECEIPT_REJECTED = 'RECEIPT_REJECTED'
    RESPONSE_CORRELATION_CONFLICT = 'RESPONSE_CORRELATION_CONFLICT'
    REMOTE_STATUS_UNKNOWN = 'REMOTE_STATUS_UNKNOWN'


class Event(str, Enum):
    LOCAL_COMMIT = 'LOCAL_COMMIT'
    SEND_STARTED = 'SEND_STARTED'
    WRITE_COMPLETE = 'WRITE_COMPLETE'
    RESPONSE_OBSERVED = 'RESPONSE_OBSERVED'
    RESPONSE_COMMITTED = 'RESPONSE_COMMITTED'
    COMMIT_UNKNOWN = 'COMMIT_UNKNOWN'
    TIMEOUT = 'TIMEOUT'
    CRASH = 'CRASH'
    LOST_RESPONSE = 'LOST_RESPONSE'
    FAILURE = 'FAILURE'
    AUTH_UNKNOWN = 'AUTH_UNKNOWN'


class Code(str, Enum):
    ALLOWED_SYNTHETIC = 'ALLOWED_SYNTHETIC'
    BLOCKED = 'BLOCKED'
    STALE_REVISION = 'STALE_REVISION'
    CONFLICT = 'CONFLICT'
    REPLAY = 'REPLAY'
    UNRESOLVED = 'UNRESOLVED'


class Reason(str, Enum):
    SYNTHETIC_ONLY = 'SYNTHETIC_ONLY'
    MISSING_WITNESS = 'MISSING_WITNESS'
    BYTE_BINDING = 'BYTE_BINDING'
    SCOPE = 'SCOPE'
    INELIGIBLE = 'INELIGIBLE'
    STALE = 'STALE'
    CONFLICT = 'CONFLICT'
    STATE = 'STATE'
    AUTH = 'AUTH'
    UNKNOWN = 'UNKNOWN'
    IDENTICAL = 'IDENTICAL'
    MISSING_ANCHOR = 'MISSING_ANCHOR'
    PARSE_REJECT = 'PARSE_REJECT'
    UNCORRELATED = 'UNCORRELATED'
    INCOMPLETE = 'INCOMPLETE'


class Target(str, Enum):
    START = '/synthetic/start'
    UPLOAD = '/synthetic/upload'
    FINISH = '/synthetic/finish'
    PROTOCOL = '/synthetic/protocol'
    NN = '/synthetic/message'
    ACK = '/synthetic/ack'


class Method(str, Enum):
    POST = 'POST'
    PUT = 'PUT'
    PATCH = 'PATCH'  # inert metadata, no invocation facility
    GET = 'GET'


class Completeness(str, Enum):
    ABSENT = 'ABSENT'
    FRAGMENT = 'FRAGMENT'
    COMPLETE = 'COMPLETE'


class Commit(str, Enum):
    OBSERVED = 'OBSERVED_IN_MEMORY'
    UNKNOWN = 'COMMIT_UNKNOWN'
    CONFIRMED = 'COMMITTED_SYNTHETIC'


class PortOutcome(str, Enum):
    READY = 'READY'
    FAILURE = 'FAILURE'
    UNKNOWN = 'UNKNOWN'


class ServiceKind(str, Enum):
    TRANSFER = 'datentransfernummer'
    RESPONSE_TICKET = 'responseTransferticketId'
    DSM_MESSAGE = 'DSM_MessageRefId'
    MESSAGE_NUMBER = 'messageNumber'
    MESSAGE_ID = 'messageId'


class ClaimKind(str, Enum):
    ORIGINAL_TICKET = 'transfer_ticket'
    ORIGINAL_MESSAGE = 'OriginalMessageRefId'
    ORIGINAL_DOC = 'DocRefId'
    ITEM = 'consignmentItemPosition'


class Fact(str, Enum):
    UNKNOWN = 'UNKNOWN'
    ACCEPTED_SYNTHETIC = 'ACCEPTED_SYNTHETIC'
    REJECTED_SYNTHETIC = 'REJECTED_SYNTHETIC'


class Terminal(str, Enum):
    UNKNOWN = 'UNKNOWN'
    NONTERMINAL = 'NONTERMINAL'
    FINAL = 'FINAL'


class ReceiptKind(str, Enum):
    DIP_OK = 'DIP_OK'
    DIP_ERROR = 'DIP_ERROR'
    PARTIAL_UNPROVEN = 'PARTIAL_UNPROVEN'
    FOREIGN_NAMESPACE = 'FOREIGN_NAMESPACE'
    INVALID_ZIP = 'INVALID_ZIP'
    UNKNOWN_STATUS = 'UNKNOWN_STATUS'
    PARSER_CRASH = 'PARSER_CRASH'


def label(x):
    need(type(x) is str and 0 < len(x) <= 200 and x.isascii()
         and all(c.isalnum() or c in '-_.' for c in x), 'LABEL_CODEC')


@dataclass(frozen=True, slots=True)
class ServiceID:
    kind: ServiceKind
    value: str

    def __post_init__(self): exact(self.kind, ServiceKind); label(self.value)


@dataclass(frozen=True, slots=True)
class Claim:
    kind: ClaimKind
    value: str
    provenance_ref: str  # scripted extraction witness, not a real parser result

    def __post_init__(self): exact(self.kind, ClaimKind); label(self.value); ref(self.provenance_ref)


@dataclass(frozen=True, slots=True)
class AttemptWitness:
    attempt: AttemptBinding = field(repr=False)
    physical_proof_ref: str
    commit_ref: str
    independent_read_ref: str
    revalidation_ref: str
    origin: str = field(default='synthetic_fixture', init=False)

    def __post_init__(self):
        try: m03.check_attempt(self.attempt)
        except m03.Rejected: raise Rejected('ATTEMPT_CODEC') from None
        for x in (self.physical_proof_ref,self.commit_ref,self.independent_read_ref,self.revalidation_ref): ref(x)


@dataclass(frozen=True, slots=True)
class RequestBinding:
    request_ref: str
    access: m03.AccessRequest = field(repr=False)
    phase: Phase
    method: Method
    target: Target
    body_ref: str
    body: bytes | None = field(repr=False)
    body_sha256: str | None
    body_length: int | None
    order: int
    observed_service_ids: tuple[ServiceID, ...] = ()
    contract: str = field(default=CONTRACT, init=False)
    codec: str = field(default=CODEC, init=False)
    origin: str = field(default='synthetic_test', init=False)

    def __post_init__(self):
        ref(self.request_ref); ref(self.body_ref); integer(self.order)
        exact(self.access, m03.AccessRequest); exact(self.phase, Phase)
        exact(self.method, Method); exact(self.target, Target)
        expected = {Phase.START:(Method.POST,Target.START), Phase.UPLOAD:(Method.PUT,Target.UPLOAD),
                    Phase.FINISH:(Method.PATCH,Target.FINISH), Phase.PROTOCOL:(Method.GET,Target.PROTOCOL),
                    Phase.NN:(Method.GET,Target.NN), Phase.ACK:(Method.PATCH,Target.ACK)}
        need(expected.get(self.phase) == (self.method,self.target), 'PHASE_CODEC')
        if self.body is None: need(self.body_sha256 is None and self.body_length is None, 'BODY_CODEC')
        else:
            need(type(self.body) is bytes and len(self.body) <= LIMIT, 'BODY_CODEC')
            integer(self.body_length,0); hash_value(self.body_sha256)
            need(self.body_sha256 == digest(self.body) and self.body_length == len(self.body), 'BODY_CODEC')
        items(self.observed_service_ids, ServiceID)
        need(len(set(self.observed_service_ids)) == len(self.observed_service_ids), 'DUPLICATE_ID')

    # Complete nested V132/V143 values retain every original field without a
    # second lossy projection (including actual item position and source binding).
    @property
    def attempt(self): return self.access.attempt
    @property
    def attempt_ref(self): return self.attempt.proof.attempt_ref
    @property
    def operation_ref(self): return self.attempt.proof.operation_ref
    @property
    def input_revision(self): return self.attempt.proof.input_revision
    @property
    def proof_ref(self): return self.attempt.proof.proof_id
    @property
    def signed_sha256(self): return self.attempt.proof.signed_sha256
    @property
    def signed_length(self): return len(self.attempt.signed_bytes)
    @property
    def scope(self): return self.attempt.scope


@dataclass(frozen=True, slots=True)
class Admission:
    request: RequestBinding
    state_revision: int
    access: m03.AttemptAccessBinding

    def __post_init__(self):
        exact(self.request,RequestBinding); integer(self.state_revision,0); exact(self.access,m03.AttemptAccessBinding)


@dataclass(frozen=True, slots=True)
class TransportDecision:
    code: Code
    reason: Reason
    state: State
    effect: Effect
    error: Error | None = None
    admission: Admission | None = None
    real_use_authorized: bool = field(default=False, init=False)
    external_ack_performed: bool = field(default=False, init=False)
    real_receipt_adapter: bool = field(default=False, init=False)

    def __post_init__(self):
        for x,t in ((self.code,Code),(self.reason,Reason),(self.state,State),(self.effect,Effect)): exact(x,t)
        if self.error is not None: exact(self.error,Error)
        if self.admission is not None: exact(self.admission,Admission)


@dataclass(frozen=True, slots=True)
class SendEvidence:
    event_ref: str
    request_ref: str
    predecessor_revision: int
    kind: Event
    order: int
    at: datetime
    progress: Progress
    error: Error | None
    credential: m03.Version
    effect: Effect
    related_ref: str | None = None
    source: str = field(default='synthetic_script', init=False)

    def __post_init__(self):
        ref(self.event_ref); ref(self.request_ref); integer(self.predecessor_revision,0)
        integer(self.order); instant(self.at); exact(self.kind,Event); exact(self.progress,Progress)
        exact(self.credential,m03.Version); exact(self.effect,Effect)
        if self.error is not None: exact(self.error,Error)
        if self.related_ref is not None: ref(self.related_ref)


@dataclass(frozen=True, slots=True)
class Projection:
    state: State = State.PREPARED
    effect: Effect = Effect.NOT_DISPATCHED_PROVEN
    progress: Progress = Progress.NONE
    errors: tuple[Error, ...] = ()
    unknown_seen: bool = False
    revision: int = 0

    def __post_init__(self):
        exact(self.state,State); exact(self.effect,Effect); exact(self.progress,Progress)
        items(self.errors,Error); need(type(self.unknown_seen) is bool); integer(self.revision,0)


def advance(p, kind, error=None):
    exact(p,Projection); exact(kind,Event)
    if error is not None: exact(error,Error)
    s,e,b,u = p.state,p.effect,p.progress,p.unknown_seen
    if kind is Event.LOCAL_COMMIT:
        need(s is State.PREPARED,'STATE_TRANSITION'); s=State.REQUEST_BYTES_COMMITTED_LOCAL
    elif kind is Event.SEND_STARTED:
        need(s is State.REQUEST_BYTES_COMMITTED_LOCAL,'STATE_TRANSITION')
        s,e,b=State.SEND_STARTED,Effect.POSSIBLY_DISPATCHED,Progress.INTENT
    elif kind is Event.WRITE_COMPLETE:
        need(e is not Effect.NOT_DISPATCHED_PROVEN,'STATE_TRANSITION')
        need(s in (State.SEND_STARTED,State.UNKNOWN),'STATE_TRANSITION')
        b=Progress.LOCAL_WRITE_COMPLETE; e=Effect.REMOTE_EFFECT_UNKNOWN
    elif kind is Event.RESPONSE_OBSERVED:
        need(e is not Effect.NOT_DISPATCHED_PROVEN,'STATE_TRANSITION')
        s,e,b=State.RESPONSE_OBSERVED,Effect.DISPATCHED_OBSERVED,Progress.RESPONSE_SEEN
    elif kind is Event.RESPONSE_COMMITTED:
        need(s in (State.RESPONSE_OBSERVED,State.UNKNOWN),'STATE_TRANSITION')
        s,e,b=State.RESPONSE_COMMITTED,Effect.DISPATCHED_OBSERVED,Progress.RESPONSE_SEEN
    elif kind is Event.FAILURE:
        need(error is not None,'ERROR_REQUIRED')
        if s is not State.UNKNOWN: s=State.TRANSPORT_FAILED
    elif kind is Event.CRASH and (e is Effect.NOT_DISPATCHED_PROVEN or s is State.RESPONSE_COMMITTED):
        pass
    else:
        need(kind in (Event.CRASH,Event.TIMEOUT,Event.LOST_RESPONSE,Event.COMMIT_UNKNOWN,Event.AUTH_UNKNOWN), 'STATE_TRANSITION')
        s=State.UNKNOWN; u=True
        if e is not Effect.NOT_DISPATCHED_PROVEN: e=Effect.REMOTE_EFFECT_UNKNOWN
    return Projection(s,e,b,p.errors+((error,) if error else ()),u,p.revision+1)


def project(request, events):
    exact(request,RequestBinding); items(events,SendEvidence)
    p=Projection(); last=None; seen=set()
    for ev in events:
        need(ev.request_ref == request.request_ref and ev.event_ref not in seen
             and ev.predecessor_revision == p.revision and ev.order == p.revision+1
             and ev.credential == request.access.transport.credential
             and (last is None or last <= ev.at), 'HISTORY_BINDING')
        p=advance(p,ev.kind,ev.error)
        need((p.effect,p.progress) == (ev.effect,ev.progress),'HISTORY_BINDING')
        seen.add(ev.event_ref); last=ev.at
    return p


@dataclass(frozen=True, slots=True)
class AuthHandle:
    credential: m03.Version = field(repr=False)
    origin: str = field(default='synthetic_ephemeral_handle',init=False,repr=False)

    def __post_init__(self): exact(self.credential,m03.Version)
    def __repr__(self): return '<AuthHandle: redacted synthetic>'
    def __reduce_ex__(self, protocol): raise Rejected('HANDLE_NOT_SERIALIZABLE')


@dataclass(frozen=True, slots=True)
class CredentialResolverPort:
    credential: m03.CredentialReference
    outcome: PortOutcome = PortOutcome.READY

    def __post_init__(self): exact(self.credential,m03.CredentialReference); exact(self.outcome,PortOutcome)

    def resolve(self, identity):
        need(identity == self.credential.identity,'CREDENTIAL_BINDING')
        return AuthHandle(identity) if self.outcome is PortOutcome.READY else None


@dataclass(frozen=True, slots=True)
class TransportPort:
    """Injected CLOSED script. No callable/client/endpoint member exists."""
    event: Event
    error: Error | None = None

    def __post_init__(self):
        exact(self.event,Event)
        need(self.event in (Event.WRITE_COMPLETE,Event.TIMEOUT,Event.FAILURE,Event.CRASH), 'PORT_SCRIPT')
        if self.error is not None: exact(self.error,Error)
        need(self.event is not Event.FAILURE or self.error is not None,'ERROR_REQUIRED')


@dataclass(frozen=True, slots=True)
class RawResponseCapture:
    capture_ref: str
    request_ref: str
    attempt_ref: str
    scope: Scope
    phase: Phase
    raw: bytes | None = field(repr=False)
    raw_sha256: str | None
    length: int | None
    completeness: Completeness
    http_status: int | None
    received_order: int
    at: datetime
    channel_evidence_ref: str
    metadata: tuple[m03.Version, ...] = ()  # inert allowlisted profile refs, no header bags
    commit: Commit = Commit.OBSERVED
    commit_ref: str | None = None
    origin: str = field(default='synthetic_test',init=False)

    def __post_init__(self):
        for x in (self.capture_ref,self.request_ref,self.attempt_ref,self.channel_evidence_ref): ref(x)
        exact(self.scope,Scope); exact(self.phase,Phase); exact(self.completeness,Completeness)
        exact(self.commit,Commit); integer(self.received_order); instant(self.at); items(self.metadata,m03.Version)
        if self.raw is None:
            need(self.completeness is Completeness.ABSENT and self.raw_sha256 is None and self.length is None
                 and self.http_status is None,'CAPTURE_CODEC')
        else:
            need(type(self.raw) is bytes and len(self.raw) <= LIMIT and self.completeness is not Completeness.ABSENT,'CAPTURE_CODEC')
            hash_value(self.raw_sha256); integer(self.length,0)
            need(self.raw_sha256 == digest(self.raw) and self.length == len(self.raw),'CAPTURE_CODEC')
            need(self.http_status is None or (type(self.http_status) is int and 100 <= self.http_status <= 599),'STATUS_CODEC')
        need((self.commit is Commit.CONFIRMED) == (self.commit_ref is not None),'COMMIT_CODEC')
        if self.commit_ref is not None: ref(self.commit_ref)


@dataclass(frozen=True, slots=True)
class ResponseCapturePort:
    """A synthetic frozen storage response, NOT a persistence implementation."""
    outcome: Commit
    commit_ref: str

    def __post_init__(self):
        exact(self.outcome,Commit); ref(self.commit_ref)
        need(self.outcome in (Commit.UNKNOWN,Commit.CONFIRMED),'PORT_SCRIPT')


@dataclass(frozen=True, slots=True)
class ReceiptAdapterPort:
    capture_ref: str
    expected_raw: bytes = field(repr=False)
    parser_revision: m03.Version
    schema_revision: m03.Version
    policy_revision: m03.Version
    kind: ReceiptKind
    claims: tuple[Claim, ...]
    service_ids: tuple[ServiceID, ...]

    def __post_init__(self):
        ref(self.capture_ref); need(type(self.expected_raw) is bytes and len(self.expected_raw)<=LIMIT,'BODY_CODEC')
        for x in (self.parser_revision,self.schema_revision,self.policy_revision): exact(x,m03.Version)
        exact(self.kind,ReceiptKind); items(self.claims,Claim); items(self.service_ids,ServiceID)
        need(len(set(self.claims))==len(self.claims) and len(set(self.service_ids))==len(self.service_ids),'DUPLICATE_ID')


@dataclass(frozen=True, slots=True)
class ReceiptInterpretation:
    capture_ref: str
    raw_sha256: str
    parser_revision: m03.Version
    schema_revision: m03.Version
    policy_revision: m03.Version
    claims: tuple[Claim, ...]
    service_ids: tuple[ServiceID, ...]
    correlation: Code
    fact: Fact
    scope_docs: tuple[str, ...]
    reason: Reason
    terminal: Terminal

    def __post_init__(self):
        ref(self.capture_ref); hash_value(self.raw_sha256)
        for x in (self.parser_revision,self.schema_revision,self.policy_revision): exact(x,m03.Version)
        items(self.claims,Claim); items(self.service_ids,ServiceID)
        for x,t in ((self.correlation,Code),(self.fact,Fact),(self.reason,Reason),(self.terminal,Terminal)): exact(x,t)
        need(type(self.scope_docs) is tuple and all(type(x) is str for x in self.scope_docs),'TUPLE_CODEC')


@dataclass(frozen=True, slots=True)
class History:
    request: RequestBinding
    events: tuple[SendEvidence, ...] = ()
    captures: tuple[RawResponseCapture, ...] = ()
    interpretations: tuple[ReceiptInterpretation, ...] = ()

    def __post_init__(self):
        exact(self.request,RequestBinding); items(self.events,SendEvidence)
        items(self.captures,RawResponseCapture); items(self.interpretations,ReceiptInterpretation)


def pre_send(request, witness, sig, trans, at):
    exact(request,RequestBinding); instant(at)
    if witness is None: return Reason.MISSING_WITNESS
    exact(witness,AttemptWitness)
    if witness.attempt != request.attempt: return Reason.BYTE_BINDING
    if request.phase is Phase.UPLOAD and request.body != witness.attempt.signed_bytes: return Reason.BYTE_BINDING
    if request.phase is not Phase.UPLOAD and request.body is not None: return Reason.BYTE_BINDING
    try:
        return m03.bind_access(replace(request.access,evaluated_at=at),sig,trans,request.order)
    except m03.Rejected:
        return Reason.INELIGIBLE


class RequestCell:
    """One private owner per request. Fixed immutable request; no real port.

    M03 gates sorted exactly as V143, then the request gate. Dispatch rechecks
    under the SAME gates as rotation/revocation. RLocks allow snapshot reads.
    No port runs arbitrary code; execution is a pure script transition.
    """
    def __init__(self, request, witness, signature_cell, transport_cell, correlation_book):
        exact(request,RequestBinding)
        if witness is not None: exact(witness,AttemptWitness)
        exact(signature_cell,m03.ReferenceCell); exact(transport_cell,m03.ReferenceCell)
        need(signature_cell is not transport_cell,'ROLE_CODEC')
        exact(correlation_book,CorrelationBook)
        need(request in correlation_book.requests,'REQUEST_INVENTORY')
        self._correlation=correlation_book
        self._history=History(request); self._witness=witness
        self._sig=signature_cell; self._trans=transport_cell; self._gate=RLock()

    @property
    def history(self):
        with self._gate: return self._history

    def _append(self, kind, eid, at, error=None, related=None):
        h=self._history; p=advance(project(h.request,h.events),kind,error)
        ev=SendEvidence(eid,h.request.request_ref,p.revision-1,kind,p.revision,at,p.progress,
                        error,h.request.access.transport.credential,p.effect,related)
        events=h.events+(ev,); project(h.request,events)
        self._history=replace(h,events=events)
        return p

    def _gates(self):
        stack=ExitStack()
        for c in sorted((self._sig,self._trans),key=lambda x:repr(x.snapshot.scope)):
            stack.enter_context(c._gate)
        stack.enter_context(self._correlation._gate)
        stack.enter_context(self._gate)
        return stack

    def admit(self, at):
        with self._gates():
            h=self._history; p=project(h.request,h.events)
            if h.request.attempt_ref in self._correlation.blocked:
                return TransportDecision(Code.CONFLICT,Reason.CONFLICT,p.state,p.effect)
            if any(e.request_ref==h.request.request_ref for e in self._correlation.dispatches):
                return TransportDecision(Code.CONFLICT,Reason.CONFLICT,p.state,p.effect)
            value=pre_send(h.request,self._witness,self._sig.snapshot,self._trans.snapshot,at)
            if type(value) is Reason:
                return TransportDecision(Code.BLOCKED,value,p.state,p.effect,Error.LOCAL_PRE_SEND_FAILURE)
            if p.state not in (State.PREPARED,State.REQUEST_BYTES_COMMITTED_LOCAL):
                return TransportDecision(Code.BLOCKED,Reason.STATE,p.state,p.effect)
            return TransportDecision(Code.ALLOWED_SYNTHETIC,Reason.SYNTHETIC_ONLY,p.state,p.effect,
                                     admission=Admission(h.request,p.revision,value))

    def commit_request(self, eid, at):
        with self._gate: return self._append(Event.LOCAL_COMMIT,eid,at)

    def dispatch(self, admission, resolver, eid, at):
        exact(admission,Admission); exact(resolver,CredentialResolverPort)
        with self._gates():
            h=self._history; p=project(h.request,h.events)
            if h.request.attempt_ref in self._correlation.blocked:
                return TransportDecision(Code.CONFLICT,Reason.CONFLICT,p.state,p.effect)
            if admission.request != h.request or admission.state_revision != p.revision:
                return TransportDecision(Code.STALE_REVISION,Reason.STALE,p.state,p.effect)
            if any(e.request_ref==h.request.request_ref for e in self._correlation.dispatches):
                return TransportDecision(Code.CONFLICT,Reason.CONFLICT,p.state,p.effect)
            value=pre_send(h.request,self._witness,self._sig.snapshot,self._trans.snapshot,at)
            if type(value) is Reason:
                return TransportDecision(Code.BLOCKED,value,p.state,p.effect,Error.LOCAL_PRE_SEND_FAILURE)
            if value.signature_decision.state_revision != admission.access.signature_decision.state_revision or value.transport_decision.state_revision != admission.access.transport_decision.state_revision:
                return TransportDecision(Code.STALE_REVISION,Reason.STALE,p.state,p.effect)
            if p.state is not State.REQUEST_BYTES_COMMITTED_LOCAL:
                return TransportDecision(Code.BLOCKED,Reason.STATE,p.state,p.effect)
            # Full credential equality, not just caller-provided identity.
            current=m03.one(self._trans.snapshot.credentials,h.request.access.transport.credential)
            need(resolver.credential == current,'CREDENTIAL_BINDING')
            handle=resolver.resolve(current.identity)
            if handle is None:
                kind=Event.AUTH_UNKNOWN if resolver.outcome is PortOutcome.UNKNOWN else Event.FAILURE
                p=self._append(kind,eid,at,Error.AUTH_FAILURE)
                return TransportDecision(Code.BLOCKED,Reason.AUTH,p.state,p.effect,Error.AUTH_FAILURE)
            exact(handle,AuthHandle)  # never retained in history/decision
            p=self._append(Event.SEND_STARTED,eid,at)
            self._correlation._dispatches+=(self._history.events[-1],)
            return TransportDecision(Code.ALLOWED_SYNTHETIC,Reason.SYNTHETIC_ONLY,p.state,p.effect)

    def step(self, port, eid, at):
        exact(port,TransportPort)
        with self._gate:
            need(any(e.kind is Event.SEND_STARTED for e in self._history.events),'NOT_STARTED')
            return self._append(port.event,eid,at,port.error)

    def interrupt(self, kind, eid, at):
        need(kind in (Event.CRASH,Event.LOST_RESPONSE),'PORT_SCRIPT')
        with self._gate: return self._append(kind,eid,at)

    def capture(self, capture, eid):
        exact(capture,RawResponseCapture)
        with self._gate:
            h=self._history; r=h.request
            need(capture.commit is Commit.OBSERVED,'CAPTURE_ENTRY')
            need((capture.request_ref,capture.attempt_ref,capture.scope,capture.phase)==
                 (r.request_ref,r.attempt_ref,r.scope,r.phase),'CAPTURE_CORRELATION')
            previous=tuple(c for c in h.captures if c.capture_ref==capture.capture_ref and c.commit is Commit.OBSERVED)
            if previous:
                need(previous==(capture,),'CAPTURE_CONFLICT'); return Code.REPLAY
            self._append(Event.RESPONSE_OBSERVED if capture.completeness is Completeness.COMPLETE else Event.LOST_RESPONSE,
                         eid,capture.at,related=capture.capture_ref)
            self._history=replace(self._history,captures=h.captures+(capture,))
            return Code.ALLOWED_SYNTHETIC

    def commit_capture(self, capture_ref, port, eid, at):
        ref(capture_ref); exact(port,ResponseCapturePort)
        with self._gate:
            originals=tuple(c for c in self._history.captures if c.capture_ref==capture_ref and c.commit is Commit.OBSERVED)
            need(len(originals)==1,'CAPTURE_MISSING'); raw=originals[0]
            old=tuple(c for c in self._history.captures if c.capture_ref==capture_ref and c.commit is Commit.CONFIRMED)
            if old: return old[0]
            committed=replace(raw,commit=port.outcome,commit_ref=port.commit_ref if port.outcome is Commit.CONFIRMED else None)
            self._append(Event.RESPONSE_COMMITTED if port.outcome is Commit.CONFIRMED else Event.COMMIT_UNKNOWN,
                         eid,at,related=capture_ref)
            self._history=replace(self._history,captures=self._history.captures+(committed,))
            return committed

    def resolve_capture(self, capture_ref, independently_read, ended_gate_ref, eid, at):
        """Synthetic independent read + ended-writer witness; no retry executor."""
        ref(ended_gate_ref); exact(independently_read,RawResponseCapture)
        with self._gate:
            original=next((c for c in self._history.captures if c.capture_ref==capture_ref and c.commit is Commit.OBSERVED),None)
            need(original is not None and independently_read.commit is Commit.CONFIRMED and
                 replace(independently_read,commit=Commit.OBSERVED,commit_ref=None)==original,'RESOLUTION_CONFLICT')
            return self.commit_capture(capture_ref,ResponseCapturePort(Commit.CONFIRMED,independently_read.commit_ref),eid,at)

    def parse(self, port):
        exact(port,ReceiptAdapterPort)
        with self._gate:
            h=self._history
            captures=tuple(c for c in h.captures if c.capture_ref==port.capture_ref and c.commit is Commit.CONFIRMED)
            need(len(captures)==1 and captures[0].completeness is Completeness.COMPLETE,'PARSE_BEFORE_COMMIT')
            c=captures[0]; need(c.raw==port.expected_raw,'PARSER_BYTE_BINDING')
            need(port.kind is not ReceiptKind.PARSER_CRASH,'SCRIPTED_PARSER_CRASH')
            valid=port.kind in (ReceiptKind.DIP_OK,ReceiptKind.DIP_ERROR)
            fact=Fact.ACCEPTED_SYNTHETIC if port.kind is ReceiptKind.DIP_OK else Fact.REJECTED_SYNTHETIC if port.kind is ReceiptKind.DIP_ERROR else Fact.UNKNOWN
            result=ReceiptInterpretation(c.capture_ref,c.raw_sha256,port.parser_revision,port.schema_revision,
                port.policy_revision,port.claims,port.service_ids,Code.UNRESOLVED,fact,
                h.request.attempt.doc_refs if valid else (),Reason.UNCORRELATED if valid else Reason.PARSE_REJECT,
                Terminal.FINAL if valid else Terminal.UNKNOWN)
            if result not in h.interpretations:
                self._history=replace(h,interpretations=h.interpretations+(result,))
            return result


@dataclass(frozen=True, slots=True)
class CorrelationEvidence:
    capture: RawResponseCapture
    interpretation: ReceiptInterpretation
    resolved_attempt: str | None
    decision: Code
    blocked: tuple[str, ...] = ()

    def __post_init__(self):
        exact(self.capture,RawResponseCapture); exact(self.interpretation,ReceiptInterpretation); exact(self.decision,Code)
        if self.resolved_attempt is not None: ref(self.resolved_attempt)
        need(type(self.blocked) is tuple)
        for a in self.blocked: ref(a)


class CorrelationBook:
    """Frozen canonical entries and sticky conflicts; no mutable map model."""
    def __init__(self, requests):
        items(requests,RequestBinding)
        need(len({r.request_ref for r in requests})==len(requests),'REQUEST_CONFLICT')
        self.requests=requests; self._entries=(); self._dispatches=(); self._gate=RLock()

    @property
    def entries(self): return self._entries
    @property
    def dispatches(self): return self._dispatches
    @property
    def blocked(self): return frozenset(a for e in self._entries for a in e.blocked)

    @staticmethod
    def _key(c,i): return (CONTRACT,c.scope,c.phase,i.kind,i.value)

    @staticmethod
    def _claims(i): return (tuple((c.kind,c.value) for c in i.claims),i.fact,i.scope_docs,i.terminal)

    def correlate(self, capture, interpretation):
        exact(capture,RawResponseCapture); exact(interpretation,ReceiptInterpretation)
        c,i=capture,interpretation
        need(c.commit is Commit.CONFIRMED and c.completeness is Completeness.COMPLETE
             and i.capture_ref==c.capture_ref and i.raw_sha256==c.raw_sha256,'RECEIPT_BINDING')
        with self._gate:
            same=tuple(e for e in self._entries if e.capture==c and e.interpretation==i)
            if same:
                old=same[0]
                code=Code.CONFLICT if old.decision is Code.CONFLICT or old.resolved_attempt in self.blocked else (
                    Code.REPLAY if old.decision in (Code.ALLOWED_SYNTHETIC,Code.REPLAY) else old.decision)
                return replace(old,decision=code)
            request=next((r for r in self.requests if r.request_ref==c.request_ref),None)
            matches=tuple(r for r in self.requests if r.scope==c.scope and r.phase==c.phase)
            candidates={r.attempt_ref for r in matches}
            hints=[]; blocked=set(); decision=Code.ALLOWED_SYNTHETIC
            if request is None or request.scope!=c.scope or request.phase!=c.phase or request.attempt_ref!=c.attempt_ref:
                decision=Code.UNRESOLVED
            else: hints.append({request.attempt_ref})
            # Direct request alone is not a positive receipt. Require echoed
            # ticket/message/doc OR a previously owned scoped service identity.
            for claim in i.claims:
                if claim.kind is ClaimKind.ITEM: continue
                attr={ClaimKind.ORIGINAL_TICKET:'transfer_ticket',ClaimKind.ORIGINAL_MESSAGE:'message_ref',ClaimKind.ORIGINAL_DOC:'doc_refs'}[claim.kind]
                found={r.attempt_ref for r in matches if (claim.value in getattr(r.attempt,attr) if attr=='doc_refs' else claim.value==getattr(r.attempt,attr))}
                hints.append(found)
            service_prior=[]
            for identity in i.service_ids:
                key=self._key(c,identity)
                prior=tuple(e for e in self._entries if e.decision in (Code.ALLOWED_SYNTHETIC,Code.REPLAY)
                            and any(self._key(e.capture,j)==key for j in e.interpretation.service_ids))
                for old in prior:
                    service_prior.append(old); hints.append({old.resolved_attempt})
                    if (old.capture.raw,old.capture.http_status,self._claims(old.interpretation)) != (c.raw,c.http_status,self._claims(i)):
                        decision=Code.CONFLICT; blocked.add(old.resolved_attempt)
            if len(hints)<2: decision=Code.UNRESOLVED if decision is not Code.CONFLICT else decision
            if not i.service_ids or len({j.kind for j in i.service_ids}) != len(i.service_ids):
                if decision is not Code.CONFLICT: decision=Code.UNRESOLVED
            resolved=set.intersection(*hints) if hints else set()
            if hints and not resolved:
                if all(hints):
                    decision=Code.CONFLICT; blocked.update(set.union(*hints))
                elif decision is not Code.CONFLICT: decision=Code.UNRESOLVED
            if len(resolved)>1: decision=Code.UNRESOLVED
            owner=next(iter(resolved)) if len(resolved)==1 else None
            itemclaims=tuple(x.value for x in i.claims if x.kind is ClaimKind.ITEM)
            if request and itemclaims!=(request.attempt.item_position,):
                if decision is not Code.CONFLICT: decision=Code.UNRESOLVED
            if owner in self.blocked: decision=Code.CONFLICT; blocked.add(owner)
            if i.terminal is not Terminal.FINAL or i.fact is Fact.UNKNOWN:
                if decision is not Code.CONFLICT: decision=Code.UNRESOLVED
            if request and i.scope_docs != request.attempt.doc_refs:
                if decision is not Code.CONFLICT: decision=Code.UNRESOLVED
            for old in self._entries:
                if old.capture.capture_ref==c.capture_ref and old.capture!=c:
                    decision=Code.CONFLICT; blocked.update(x for x in (old.resolved_attempt,owner) if x)
            if decision is Code.CONFLICT:
                blocked.update(x for x in (owner,c.attempt_ref) if x in candidates)
            elif decision is Code.ALLOWED_SYNTHETIC and service_prior: decision=Code.REPLAY
            row=CorrelationEvidence(c,i,owner,decision,tuple(sorted(blocked)))
            self._entries+=(row,)
            return row


class RecoveryAction(str, Enum):
    FRESH_ADMISSION = 'FRESH_ADMISSION_REQUIRED'
    PRESERVE_UNKNOWN = 'PRESERVE_UNKNOWN'
    REPARSE_RAW = 'REPARSE_COMMITTED_RAW'
    RESOLVE_LOCAL_COMMIT = 'RESOLVE_IDENTICAL_LOCAL_OPERATION'
    BLOCK_CONFLICT = 'BLOCK_CONFLICT'


@dataclass(frozen=True, slots=True)
class RecoveryDecision:
    request_ref: str
    state: State
    effect: Effect
    action: RecoveryAction
    raw_captures: tuple[RawResponseCapture, ...]
    presence: Presence
    auto_retry: str = field(default='AUTO_RETRY_FORBIDDEN',init=False)
    durable: bool = field(default=False,init=False)
    new_attempt: bool = field(default=False,init=False)
    new_ticket: bool = field(default=False,init=False)
    new_signature: bool = field(default=False,init=False)

    def __post_init__(self):
        ref(self.request_ref); exact(self.state,State); exact(self.effect,Effect)
        exact(self.action,RecoveryAction); items(self.raw_captures,RawResponseCapture)
        exact(self.presence,Presence)


def recover(history, *, interpretation_commit=Commit.CONFIRMED, blocked_attempts=()):
    exact(history,History); exact(interpretation_commit,Commit)
    need(type(blocked_attempts) is tuple)
    for a in blocked_attempts: ref(a)
    p=project(history.request,history.events)
    r=history.request
    for c in history.captures:
        need((c.request_ref,c.attempt_ref,c.scope,c.phase)==(r.request_ref,r.attempt_ref,r.scope,r.phase),'HISTORY_BINDING')
        need(any(e.related_ref==c.capture_ref for e in history.events),'HISTORY_BINDING')
        if c.commit is Commit.CONFIRMED:
            need(any(e.kind is Event.RESPONSE_COMMITTED and e.related_ref==c.capture_ref for e in history.events),'HISTORY_BINDING')
    for i in history.interpretations:
        need(any(c.capture_ref==i.capture_ref and c.raw_sha256==i.raw_sha256 and c.commit is Commit.CONFIRMED for c in history.captures),'HISTORY_BINDING')
    raw=tuple(c for c in history.captures if c.commit is Commit.CONFIRMED and c.completeness is Completeness.COMPLETE)
    if r.attempt_ref in blocked_attempts: action=RecoveryAction.BLOCK_CONFLICT
    elif interpretation_commit is Commit.UNKNOWN: action=RecoveryAction.RESOLVE_LOCAL_COMMIT
    elif raw: action=RecoveryAction.REPARSE_RAW
    elif p.state is State.UNKNOWN or p.effect is not Effect.NOT_DISPATCHED_PROVEN: action=RecoveryAction.PRESERVE_UNKNOWN
    else: action=RecoveryAction.FRESH_ADMISSION
    state=State.UNKNOWN if action is RecoveryAction.PRESERVE_UNKNOWN else p.state
    presence=(Presence.OBSERVED if raw else Presence.POSSIBLY_LOST
              if p.effect is not Effect.NOT_DISPATCHED_PROVEN else Presence.NOT_OBSERVED)
    return RecoveryDecision(history.request.request_ref,state,p.effect,action,raw,presence)


class AckState(str, Enum):
    ACK_NOT_ELIGIBLE = 'ACK_NOT_ELIGIBLE'
    ACK_ELIGIBLE_LOCAL = 'ACK_ELIGIBLE_LOCAL'
    ACK_UNKNOWN = 'ACK_UNKNOWN'
    ACK_CONFIRMED_SYNTHETIC = 'ACK_CONFIRMED_SYNTHETIC'


class AckStage(str, Enum):
    OBSERVED = 'response_observed'
    COMMITTED = 'response_committed'
    REVALIDATED = 'response_revalidated'
    PARSED_CORRELATED = 'receipt_parsed_correlated'
    FINAL_UNDERSTOOD = 'terminal_result_understood'
    INTENT = 'ack_intent'
    CONFIRMATION_COMMITTED = 'ack_response_committed'


@dataclass(frozen=True, slots=True)
class AckWitness:
    evidence_ref: str
    stage: AckStage
    request_ref: str
    capture_ref: str
    raw_sha256: str
    scope: Scope
    origin: str = field(default='synthetic_fixture',init=False)

    def __post_init__(self):
        for x in (self.evidence_ref,self.request_ref,self.capture_ref): ref(x)
        exact(self.stage,AckStage); hash_value(self.raw_sha256); exact(self.scope,Scope)


@dataclass(frozen=True, slots=True)
class AckDecision:
    state: AckState
    fact: Fact
    eligible_local: bool
    external_ack_performed: bool = field(default=False,init=False)
    real_receipt_adapter: bool = field(default=False,init=False)

    def __post_init__(self):
        exact(self.state,AckState); exact(self.fact,Fact); need(type(self.eligible_local) is bool)


def ack_decision(row, witnesses, book, *, confirmation=Commit.CONFIRMED, confirm_synthetic=False):
    """Freeze current canonical correlation under its gate; old row is no ticket."""
    exact(row,CorrelationEvidence); items(witnesses,AckWitness); exact(book,CorrelationBook)
    exact(confirmation,Commit); need(type(confirm_synthetic) is bool)
    with book._gate:
        canonical=tuple(e for e in book.entries if e.capture==row.capture and e.interpretation==row.interpretation)
        if len(canonical)!=1 or canonical[0].resolved_attempt != row.resolved_attempt:
            return AckDecision(AckState.ACK_NOT_ELIGIBLE,row.interpretation.fact,False)
        # Use the canonical historical decision, not a caller-modified status.
        return _ack_decision(canonical[0],witnesses,confirmation=confirmation,
                             confirm_synthetic=confirm_synthetic,blocked_attempts=tuple(book.blocked))


def _ack_decision(row, witnesses, *, confirmation, confirm_synthetic, blocked_attempts):
    exact(row,CorrelationEvidence); items(witnesses,AckWitness); exact(confirmation,Commit)
    need(type(confirm_synthetic) is bool,'TYPE_CODEC')
    need(type(blocked_attempts) is tuple)
    for a in blocked_attempts: ref(a)
    c,i=row.capture,row.interpretation
    if confirmation is Commit.UNKNOWN: return AckDecision(AckState.ACK_UNKNOWN,i.fact,False)
    complete=(len(witnesses)==7 and {w.stage for w in witnesses}==set(AckStage)
              and len({w.evidence_ref for w in witnesses})==7
              and all((w.request_ref,w.capture_ref,w.raw_sha256,w.scope)==(c.request_ref,c.capture_ref,c.raw_sha256,c.scope) for w in witnesses)
              and c.commit is Commit.CONFIRMED and row.decision in (Code.ALLOWED_SYNTHETIC,Code.REPLAY)
              and row.resolved_attempt is not None
              and row.resolved_attempt not in blocked_attempts
              and i.terminal is Terminal.FINAL and i.fact is not Fact.UNKNOWN)
    return AckDecision((AckState.ACK_CONFIRMED_SYNTHETIC if confirm_synthetic else AckState.ACK_ELIGIBLE_LOCAL)
                       if complete else AckState.ACK_NOT_ELIGIBLE,i.fact,complete)
