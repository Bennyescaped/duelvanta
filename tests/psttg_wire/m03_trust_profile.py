"""V141 private synthetic reference kernel. No real trust or durability.

Only inert UUID metadata and explicit input times. ReferenceCell owns one
role/purpose scope; its lock is also the admission/rotation linearization gate.
Canonical state consists entirely of frozen values/tuples, not mutable maps.
The M04 dependency supplies value types only: this module calls no verifier,
signer, parser, resolver, filesystem, environment, database or transport API.
"""
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta, timezone
from enum import Enum
from hashlib import sha256
from threading import RLock
from contextlib import ExitStack
from .m04_attempt_response import AttemptBinding, ProofReference, Scope as M04Scope

CONTRACT = 'V141-M03-synthetic-reference/1'
CODEC = 'm03-frozen-values/1'


class Rejected(ValueError):
    """Only fixed reason codes, never the rejected input."""


def require(ok, code):
    if not ok:
        raise Rejected(code)


def ref(x):
    # Reserved synthetic namespace: arbitrary UUID-looking secrets are not input.
    require(type(x) is str and len(x) == 36
            and x.startswith('00000000-0000-4000-8000-')
            and all(c in '0123456789abcdef' for c in x[24:])
            and x[24:] != '000000000000', 'REFERENCE_CODEC')


def number(x, minimum=1):
    require(type(x) is int and minimum <= x <= (1 << 63)-1, 'REVISION_CODEC')


def instant(x):
    require(type(x) is datetime and type(x.tzinfo) is timezone
            and x.utcoffset() == timedelta(0), 'TIME_CODEC')


def exact(x, cls):
    require(type(x) is cls, 'TYPE_CODEC')


def values(xs, cls):
    require(type(xs) is tuple and all(type(x) is cls for x in xs), 'TUPLE_CODEC')


class Role(str, Enum):
    SIGNATURE_TRUST = 'SIGNATURE_TRUST'
    TRANSPORT_AUTH = 'TRANSPORT_AUTH'
    PORTAL_ACCESS = 'PORTAL_ACCESS'


class Environment(str, Enum):
    TEST = 'TEST'
    SYNTHETIC_OTHER = 'SYNTHETIC_OTHER'
    OFFICIAL_INTEGRATION = 'OFFICIAL_INTEGRATION'
    PRODUCTION = 'PRODUCTION'


class Purpose(str, Enum):
    DAC7_REFERENCE = 'synthetic_dac7_reference'
    PORTAL_REFERENCE = 'synthetic_portal_reference'


class Algorithm(str, Enum):
    XML_PSS = 'synthetic_xml_rsa_pss'
    JWT_RS256 = 'synthetic_jwt_rs256'
    PORTAL_METADATA = 'synthetic_portal_metadata'


class State(str, Enum):
    UNRESOLVED_EXTERNAL = 'UNRESOLVED_EXTERNAL'
    CONFIGURED = 'CONFIGURED'
    ELIGIBLE_LOCAL = 'ELIGIBLE_LOCAL'
    EXPIRED = 'EXPIRED'
    REVOKED = 'REVOKED'
    SUPERSEDED = 'SUPERSEDED'
    DISABLED = 'DISABLED'


class EventKind(str, Enum):
    CONFIGURED = 'CONFIGURED'
    ACTIVATED = 'ACTIVATED'
    SUPERSEDED = 'SUPERSEDED'
    REVOKED = 'REVOKED'
    DISABLED = 'DISABLED'
    EXTERNAL_UNRESOLVED = 'EXTERNAL_UNRESOLVED'


class EvidenceKind(str, Enum):
    TRUST = 'TRUST'
    REGISTRATION = 'REGISTRATION'
    ENTITLEMENT = 'ENTITLEMENT'
    STATUS = 'STATUS'
    VALIDITY = 'VALIDITY'
    REVOCATION = 'REVOCATION'
    ROTATION = 'ROTATION'
    ALGORITHM = 'ALGORITHM'
    ACTIVATION = 'ACTIVATION'
    SIGNED_BINDING = 'SIGNED_BINDING'
    ACCOUNT_BLOCK = 'ACCOUNT_BLOCK'


class Result(str, Enum):
    BOUND = 'BOUND'
    REPLAY = 'REPLAY'
    CONFLICT = 'CONFLICT'
    REVISION_CONFLICT = 'REVISION_CONFLICT'


class Observation(str, Enum):
    NOT_OBSERVED = 'NOT_OBSERVED'
    UNKNOWN = 'UNKNOWN'


@dataclass(frozen=True, slots=True)
class Version:
    ref: str
    revision: int

    def __post_init__(self):
        ref(self.ref); number(self.revision)


@dataclass(frozen=True, slots=True)
class AccessScope:
    environment: Environment
    environment_ref: str
    provider_profile: Version
    operator_ref: str
    organization_ref: str
    reporting_entity_ref: str
    account_ref: str | None
    provider_account_ref: str | None
    origin: str = field(default='synthetic_test', init=False)

    def __post_init__(self):
        exact(self.environment, Environment); exact(self.provider_profile, Version)
        for x in (self.environment_ref, self.operator_ref, self.organization_ref,
                  self.reporting_entity_ref):
            ref(x)
        for x in (self.account_ref, self.provider_account_ref):
            if x is not None: ref(x)


@dataclass(frozen=True, slots=True)
class UsageScope:
    access: AccessScope
    role: Role
    purpose: Purpose

    def __post_init__(self):
        exact(self.access, AccessScope); exact(self.role, Role); exact(self.purpose, Purpose)


@dataclass(frozen=True, slots=True)
class TrustProfile:
    identity: Version
    scope: UsageScope
    signature_profile_revision: Version | None
    transport_auth_profile_revision: Version | None
    trust_anchor_ref: str
    validity_policy: Version
    revocation_policy: Version
    rotation_policy: Version
    registration_evidence_ref: str
    m2m_entitlement_ref: str
    provenance: str
    created_at: datetime
    created_order: int
    predecessor: Version | None = None
    successor: Version | None = None
    status: State = State.CONFIGURED
    contract: str = field(default=CONTRACT, init=False)
    codec: str = field(default=CODEC, init=False)

    def __post_init__(self):
        exact(self.identity, Version); exact(self.scope, UsageScope)
        for x in (self.validity_policy, self.revocation_policy, self.rotation_policy):
            exact(x, Version)
        for x in (self.signature_profile_revision, self.transport_auth_profile_revision,
                  self.predecessor, self.successor):
            if x is not None: exact(x, Version)
        for x in (self.trust_anchor_ref, self.registration_evidence_ref,
                  self.m2m_entitlement_ref, self.provenance): ref(x)
        instant(self.created_at); number(self.created_order); exact(self.status, State)
        require(self.status in (State.CONFIGURED, State.UNRESOLVED_EXTERNAL), 'INITIAL_STATUS')
        require(self.predecessor != self.identity and self.successor != self.identity, 'LINEAGE_CYCLE')
        require((self.signature_profile_revision is not None) ==
                (self.scope.role is Role.SIGNATURE_TRUST), 'PROFILE_ROLE')
        require((self.transport_auth_profile_revision is not None) ==
                (self.scope.role is Role.TRANSPORT_AUTH), 'PROFILE_ROLE')


@dataclass(frozen=True, slots=True)
class CredentialReference:
    identity: Version  # ref is new per instance; revision is generation
    rotation_lineage_ref: str
    trust_profile: Version
    scope: UsageScope
    opaque_locator: Version
    public_identifier: str  # inert synthetic identifier, NOT certificate bytes
    identifier_issuer: str
    key_profile: Version
    certificate_signature_profile: Version
    use_algorithm: Algorithm
    use_profile: Version
    not_before: datetime | None
    not_after: datetime | None
    provenance: str
    created_order: int
    predecessor: Version | None = None
    successor: Version | None = None
    revocation_marker: str | None = None
    status: State = State.CONFIGURED

    def __post_init__(self):
        for x in (self.identity, self.trust_profile, self.opaque_locator, self.key_profile,
                  self.certificate_signature_profile, self.use_profile): exact(x, Version)
        exact(self.scope, UsageScope); exact(self.use_algorithm, Algorithm)
        for x in (self.rotation_lineage_ref, self.public_identifier,
                  self.identifier_issuer, self.provenance): ref(x)
        for x in (self.predecessor, self.successor):
            if x is not None: exact(x, Version)
        if self.revocation_marker is not None: ref(self.revocation_marker)
        for x in (self.not_before, self.not_after):
            if x is not None: instant(x)
        if self.not_before is not None and self.not_after is not None:
            require(self.not_before < self.not_after, 'TIME_INTERVAL')
        number(self.created_order); exact(self.status, State)
        require(self.status in (State.CONFIGURED, State.UNRESOLVED_EXTERNAL), 'INITIAL_STATUS')
        require(self.predecessor != self.identity and self.successor != self.identity, 'LINEAGE_CYCLE')


def check_attempt(a):
    """Validate immutable upstream value shape/byte binding, NOT M02 revalidation.

    The private caller must supply its already bound V132 value. The synthetic
    SIGNED_BINDING evidence pins the ENTIRE value, not a free verified boolean.
    It is explicitly not evidence of real signing or W11 durability.
    """
    exact(a, AttemptBinding); exact(a.proof, ProofReference); exact(a.scope, M04Scope)
    require(type(a.signed_bytes) is bytes and bool(a.signed_bytes)
            and sha256(a.signed_bytes).hexdigest() == a.proof.signed_sha256, 'ATTEMPT_BYTES')
    require(type(a.doc_refs) is tuple and all(type(x) is str for x in a.doc_refs), 'ATTEMPT_DOCS')
    for x in (a.delivery_revision, a.source_revision, a.message_ref, a.transfer_ticket,
              a.item_position):
        require(type(x) is str and bool(x), 'ATTEMPT_FIELDS')
    number(a.prepared_order)
    require(a.origin == 'synthetic_test' and a.scope.environment in
            ('TEST', 'SYNTHETIC_OTHER'), 'REAL_PROFILE_FORBIDDEN')


@dataclass(frozen=True, slots=True)
class EvidenceReference:
    evidence_ref: str
    kind: EvidenceKind
    source_profile: Version
    scope: UsageScope
    credential: Version | None
    profile: Version
    observed_at: datetime
    effective_from: datetime
    effective_until: datetime
    provenance: str
    policy: Version | None = None
    subject_ref: str | None = None
    attempt: AttemptBinding | None = field(default=None, repr=False)
    endpoint_profile: Version | None = None
    channel_profile: str | None = None
    source_kind: str = field(default='synthetic_fixture', init=False)

    def __post_init__(self):
        ref(self.evidence_ref); exact(self.kind, EvidenceKind)
        exact(self.scope, UsageScope)
        for x in (self.source_profile, self.profile): exact(x, Version)
        if self.credential is not None: exact(self.credential, Version)
        else: require(self.kind in (EvidenceKind.REGISTRATION, EvidenceKind.ENTITLEMENT), 'EVIDENCE_TARGET')
        for x in (self.observed_at, self.effective_from, self.effective_until): instant(x)
        require(self.effective_from < self.effective_until, 'TIME_INTERVAL')
        ref(self.provenance)
        if self.policy is not None: exact(self.policy, Version)
        if self.subject_ref is not None: ref(self.subject_ref)
        if self.endpoint_profile is not None: exact(self.endpoint_profile, Version)
        if self.channel_profile is not None: ref(self.channel_profile)
        if self.endpoint_profile is not None or self.channel_profile is not None:
            require(self.kind is EvidenceKind.ALGORITHM and self.scope.role is Role.TRANSPORT_AUTH
                    and self.endpoint_profile is not None and self.channel_profile is not None,
                    'ENDPOINT_METADATA')
        require((self.attempt is not None) == (self.kind is EvidenceKind.SIGNED_BINDING), 'EVIDENCE_SHAPE')
        if self.attempt is not None: check_attempt(self.attempt)


@dataclass(frozen=True, slots=True)
class LifecycleEvidence:
    event_ref: str
    target: Version
    profile: Version
    scope: UsageScope
    kind: EventKind
    observed_at: datetime
    observed_order: int
    effective_at: datetime | None
    evidence_ref: str
    expected_state_revision: int
    expected_active: Version | None = None

    def __post_init__(self):
        ref(self.event_ref); ref(self.evidence_ref)
        exact(self.target, Version); exact(self.profile, Version)
        exact(self.scope, UsageScope); exact(self.kind, EventKind)
        instant(self.observed_at); number(self.observed_order)
        number(self.expected_state_revision, 0)
        if self.effective_at is not None: instant(self.effective_at)
        if self.expected_active is not None: exact(self.expected_active, Version)


@dataclass(frozen=True, slots=True)
class Snapshot:
    scope: UsageScope
    revision: int = 0
    profiles: tuple[TrustProfile, ...] = ()
    credentials: tuple[CredentialReference, ...] = ()
    evidence: tuple[EvidenceReference, ...] = ()
    lifecycle: tuple[LifecycleEvidence, ...] = ()
    active: Version | None = None
    conflicts: tuple[str, ...] = ()

    def __post_init__(self):
        exact(self.scope, UsageScope); number(self.revision, 0)
        for xs, cls in ((self.profiles, TrustProfile), (self.credentials, CredentialReference),
                        (self.evidence, EvidenceReference), (self.lifecycle, LifecycleEvidence)):
            values(xs, cls)
        require(type(self.conflicts) is tuple, 'TUPLE_CODEC')
        for x in self.conflicts: ref(x)
        if self.active is not None: exact(self.active, Version)


@dataclass(frozen=True, slots=True)
class UseContext:
    profile: Version
    credential: Version
    scope: UsageScope
    use_algorithm: Algorithm
    use_profile: Version

    def __post_init__(self):
        exact(self.profile, Version); exact(self.credential, Version)
        exact(self.scope, UsageScope); exact(self.use_algorithm, Algorithm); exact(self.use_profile, Version)


@dataclass(frozen=True, slots=True)
class EligibilityDecision:
    decision_ref: str
    evaluated_at: datetime
    state_revision: int
    context: UseContext
    result: State
    reasons: tuple[str, ...]
    evidence_refs: tuple[str, ...]
    expires_at: datetime | None
    real_use_authorized: bool = field(default=False, init=False)
    real_authentication_performed: bool = field(default=False, init=False)
    external_ack_performed: bool = field(default=False, init=False)

    def __post_init__(self):
        ref(self.decision_ref); instant(self.evaluated_at); number(self.state_revision, 0)
        exact(self.context, UseContext); exact(self.result, State)
        permitted = {'SCOPE_MISMATCH', 'REAL_PROFILE_FORBIDDEN', 'SCOPE_UNRESOLVED',
                     'REVISION_CONFLICT', 'IDENTITY_CONFLICT', 'PROFILE_UNRESOLVED',
                     'CREDENTIAL_UNRESOLVED', 'ROLE_PURPOSE_PROFILE_MISMATCH',
                     'STATUS_UNRESOLVED', 'TIME_UNRESOLVED', 'NOT_YET_VALID', 'EXPIRED',
                     'REVOKED', 'ACCESS_DISABLED', 'SUPERSEDED', 'NOT_ACTIVE'}
        permitted.update(k.value+'_UNRESOLVED' for k in EvidenceKind)
        require(type(self.reasons) is tuple and all(type(x) is str and x in permitted for x in self.reasons),
                'DECISION_CODEC')
        require(type(self.evidence_refs) is tuple, 'TUPLE_CODEC')
        for x in self.evidence_refs: ref(x)
        if self.expires_at is not None: instant(self.expires_at)
        require((self.result is State.ELIGIBLE_LOCAL) == (not self.reasons), 'DECISION_CODEC')


def one(xs, identity):
    found = tuple(x for x in xs if x.identity == identity)
    return found[0] if len(found) == 1 else None


def _fresh(e, at):
    return e.observed_at <= at and e.effective_from <= at < e.effective_until


def evaluate_usage(snapshot, context, evaluated_at, expected_state_revision, decision_ref):
    """Pure calculation on closed snapshots. Never an authorization capability."""
    exact(snapshot, Snapshot); exact(context, UseContext); instant(evaluated_at)
    number(expected_state_revision, 0); ref(decision_ref)
    s, u, at = snapshot, context, evaluated_at
    reasons = []
    p = one(s.profiles, u.profile); c = one(s.credentials, u.credential)
    if s.scope != u.scope: reasons.append('SCOPE_MISMATCH')
    if u.scope.access.environment not in (Environment.TEST, Environment.SYNTHETIC_OTHER):
        reasons.append('REAL_PROFILE_FORBIDDEN')
    if u.scope.access.account_ref is None or u.scope.access.provider_account_ref is None:
        reasons.append('SCOPE_UNRESOLVED')
    if s.revision != expected_state_revision: reasons.append('REVISION_CONFLICT')
    if s.conflicts: reasons.append('IDENTITY_CONFLICT')
    # Contradictory hand-built snapshots cannot bypass canonical registration.
    for xs, key in ((s.profiles, lambda x:x.identity), (s.credentials, lambda x:x.identity),
                    (s.evidence, lambda x:x.evidence_ref), (s.lifecycle, lambda x:x.event_ref)):
        if len({key(x) for x in xs}) != len(xs): reasons.append('IDENTITY_CONFLICT')
        if any(x.scope != s.scope for x in xs): reasons.append('SCOPE_MISMATCH')
    if (len({x.identity.ref for x in s.credentials}) != len(s.credentials) or
            len({(x.rotation_lineage_ref,x.identity.revision) for x in s.credentials}) != len(s.credentials)):
        reasons.append('IDENTITY_CONFLICT')
    previous_active = None
    previous_order = 0
    previous_revision = -1
    for event in s.lifecycle:
        target = one(s.credentials, event.target)
        source = tuple(e for e in s.evidence if e.evidence_ref == event.evidence_ref)
        if (target is None or target.trust_profile != event.profile or len(source) != 1
                or source[0].credential != event.target or source[0].profile != event.profile
                or source[0].observed_at > event.observed_at
                or event.expected_active != previous_active
                or not previous_revision < event.expected_state_revision < s.revision
                or event.observed_order <= previous_order):
            reasons.append('IDENTITY_CONFLICT')
        if event.kind is EventKind.ACTIVATED:
            if (not source or source[0].kind is not EvidenceKind.ACTIVATION
                    or event.effective_at != event.observed_at
                    or target is None or target.predecessor != previous_active):
                reasons.append('IDENTITY_CONFLICT')
            previous_active = event.target
        elif not source or source[0].kind is not EvidenceKind.STATUS:
            reasons.append('IDENTITY_CONFLICT')
        previous_order = event.observed_order
        previous_revision = event.expected_state_revision
    if s.active != previous_active: reasons.append('IDENTITY_CONFLICT')
    if p is None: reasons.append('PROFILE_UNRESOLVED')
    if c is None: reasons.append('CREDENTIAL_UNRESOLVED')
    used = []
    if p is not None and c is not None:
        if c.trust_profile != p.identity or c.scope != u.scope or p.scope != u.scope:
            reasons.append('SCOPE_MISMATCH')
        algorithm = {Role.SIGNATURE_TRUST: Algorithm.XML_PSS,
                     Role.TRANSPORT_AUTH: Algorithm.JWT_RS256,
                     Role.PORTAL_ACCESS: Algorithm.PORTAL_METADATA}[u.scope.role]
        policy = p.signature_profile_revision or p.transport_auth_profile_revision
        if (u.use_algorithm is not algorithm or c.use_algorithm is not algorithm
                or u.use_profile != c.use_profile or (policy is not None and policy != c.use_profile)):
            reasons.append('ROLE_PURPOSE_PROFILE_MISMATCH')
        if p.status is not State.CONFIGURED or c.status is not State.CONFIGURED:
            reasons.append('STATUS_UNRESOLVED')
        if p.created_at > at: reasons.append('STATUS_UNRESOLVED')
        if c.not_before is None or c.not_after is None: reasons.append('TIME_UNRESOLVED')
        else:
            if at < c.not_before: reasons.append('NOT_YET_VALID')
            if at >= c.not_after: reasons.append('EXPIRED')
        if c.revocation_marker is not None: reasons.append('REVOKED')
        for kind in (EvidenceKind.TRUST, EvidenceKind.REGISTRATION, EvidenceKind.ENTITLEMENT,
                     EvidenceKind.STATUS, EvidenceKind.VALIDITY, EvidenceKind.REVOCATION,
                     EvidenceKind.ROTATION, EvidenceKind.ALGORITHM):
            matches = tuple(e for e in s.evidence if e.kind is kind and e.credential in (None, c.identity)
                            and e.profile == p.identity and e.scope == u.scope and _fresh(e, at))
            if kind is EvidenceKind.REGISTRATION:
                matches = tuple(e for e in matches if e.evidence_ref == p.registration_evidence_ref)
            if kind is EvidenceKind.ENTITLEMENT:
                matches = tuple(e for e in matches if e.evidence_ref == p.m2m_entitlement_ref)
            target = {EvidenceKind.TRUST: p.trust_anchor_ref,
                      EvidenceKind.ALGORITHM: c.public_identifier}.get(kind)
            if target is not None: matches = tuple(e for e in matches if e.subject_ref == target)
            policy_target = {EvidenceKind.VALIDITY:p.validity_policy,
                             EvidenceKind.REVOCATION:p.revocation_policy,
                             EvidenceKind.ROTATION:p.rotation_policy,
                             EvidenceKind.ALGORITHM:c.use_profile}.get(kind)
            if policy_target is not None: matches = tuple(e for e in matches if e.policy == policy_target)
            if len(matches) != 1: reasons.append(kind.value+'_UNRESOLVED')
            else: used.append(matches[0].evidence_ref)
        if any(e.kind is EvidenceKind.ACCOUNT_BLOCK and e.observed_at <= at for e in s.evidence):
            reasons.append('ACCESS_DISABLED')
        activations = tuple(e for e in s.lifecycle if e.kind is EventKind.ACTIVATED)
        if s.active != (activations[-1].target if activations else None): reasons.append('IDENTITY_CONFLICT')
        if s.active != c.identity:
            reasons.append('SUPERSEDED' if any(e.target == c.identity for e in activations) else 'NOT_ACTIVE')
        if any(e.observed_at > at for e in s.lifecycle): reasons.append('STATUS_UNRESOLVED')
        for e in s.lifecycle:
            if e.target != c.identity: continue
            if e.kind is EventKind.REVOKED: reasons.append('REVOKED')
            if e.kind is EventKind.DISABLED: reasons.append('ACCESS_DISABLED')
            if e.kind is EventKind.EXTERNAL_UNRESOLVED: reasons.append('STATUS_UNRESOLVED')
    reasons = tuple(dict.fromkeys(reasons))
    state = State.ELIGIBLE_LOCAL
    for r, status in (('NOT_ACTIVE', State.CONFIGURED), ('SUPERSEDED', State.SUPERSEDED),
                      ('EXPIRED', State.EXPIRED), ('REVOKED', State.REVOKED),
                      ('ACCESS_DISABLED', State.DISABLED), ('IDENTITY_CONFLICT', State.DISABLED)):
        if r in reasons: state = status
    if reasons and state is State.ELIGIBLE_LOCAL: state = State.UNRESOLVED_EXTERNAL
    ends = tuple(e.effective_until for e in s.evidence if e.evidence_ref in used)
    expires = min((c.not_after,)+ends) if c and c.not_after is not None else None
    return EligibilityDecision(decision_ref, at, s.revision, u, state, reasons, tuple(used), expires)


class ReferenceCell:
    """One independently locked scope. No global store/clock/worker or persistence.

    All writes append frozen values. RLock is intentional: controlled admission
    holds this gate while reading snapshot; registration calls snapshot helpers.
    Private process ownership is the trust boundary, not a hostile Python API.
    """
    def __init__(self, scope):
        self._snapshot = Snapshot(scope)
        self._gate = RLock()

    @property
    def snapshot(self):
        with self._gate: return self._snapshot

    def _conflict(self, identity):
        s = self._snapshot
        self._snapshot = replace(s, revision=s.revision+1, conflicts=s.conflicts+(identity,))
        return Result.CONFLICT

    def register(self, value):
        with self._gate:
            s = self._snapshot
            require(type(value) in (TrustProfile, CredentialReference, EvidenceReference), 'TYPE_CODEC')
            exact(value.scope, UsageScope)
            require(value.scope == s.scope, 'SCOPE_MISMATCH')
            require(type(value) in (TrustProfile, CredentialReference, EvidenceReference), 'TYPE_CODEC')
            name = {TrustProfile:'profiles', CredentialReference:'credentials',
                    EvidenceReference:'evidence'}[type(value)]
            rows = getattr(s, name)
            key = value.evidence_ref if type(value) is EvidenceReference else value.identity
            old = tuple(x for x in rows if (x.evidence_ref if name == 'evidence' else x.identity) == key)
            if old:
                return Result.REPLAY if old == (value,) else self._conflict(key if type(key) is str else key.ref)
            if type(value) in (TrustProfile, CredentialReference):
                # Forward references are not silently trusted; relations are appended by activation.
                require(value.successor is None, 'LINEAGE_FORWARD_REFERENCE')
                if type(value) is TrustProfile:
                    require(all(x.scope == value.scope for x in s.profiles if x.identity.ref == value.identity.ref), 'PROFILE_LINEAGE')
                    if value.predecessor is not None:
                        p = one(s.profiles, value.predecessor)
                        require(p is not None and p.identity.ref == value.identity.ref
                                and value.identity.revision == p.identity.revision+1, 'LINEAGE_CYCLE')
                else:
                    require(one(s.profiles, value.trust_profile) is not None, 'PROFILE_UNRESOLVED')
                    if any(x.identity.ref == value.identity.ref or
                           (x.rotation_lineage_ref == value.rotation_lineage_ref and
                            x.identity.revision == value.identity.revision) for x in rows):
                        return self._conflict(value.identity.ref)
                    p = one(s.credentials, value.predecessor) if value.predecessor else None
                    require((value.identity.revision == 1 and value.predecessor is None) or
                            (p is not None and p.rotation_lineage_ref == value.rotation_lineage_ref
                             and value.identity.revision == p.identity.revision+1), 'LINEAGE_CYCLE')
            else:
                require((value.credential is None or one(s.credentials, value.credential) is not None) and
                        one(s.profiles, value.profile) is not None, 'EVIDENCE_TARGET')
            self._snapshot = replace(s, revision=s.revision+1, **{name:rows+(value,)})
            return Result.BOUND

    def rotate(self, credential, evidence, event):
        """Atomic candidate installation + activation CAS, no losing successor.

        The caller freezes the old revision and active generation before either
        contender runs. Losing CAS has no writes. Invalid proposals roll back
        only this in-memory operation; existing history is never replaced.
        """
        exact(credential, CredentialReference); values(evidence, EvidenceReference)
        exact(event, LifecycleEvidence)
        with self._gate:
            before = self._snapshot
            if event.expected_state_revision != before.revision or event.expected_active != before.active:
                return Result.REVISION_CONFLICT
            require(event.kind is EventKind.ACTIVATED and event.target == credential.identity,
                    'ACTIVATION_EVIDENCE')
            try:
                require(self.register(credential) is Result.BOUND, 'ROTATION_IDENTITY')
                for e in evidence:
                    require(self.register(e) in (Result.BOUND, Result.REPLAY), 'ROTATION_EVIDENCE')
                result = self.lifecycle(replace(event, expected_state_revision=self._snapshot.revision))
                require(result is Result.BOUND, 'ROTATION_CONFLICT')
                return result
            except Exception:
                self._snapshot = before
                raise

    def lifecycle(self, event):
        exact(event, LifecycleEvidence)
        with self._gate:
            s = self._snapshot
            prior = tuple(x for x in s.lifecycle if x.event_ref == event.event_ref)
            if prior:
                return Result.REPLAY if prior == (event,) else self._conflict(event.event_ref)
            if event.expected_state_revision != s.revision or event.expected_active != s.active:
                return Result.REVISION_CONFLICT
            require(event.scope == s.scope, 'SCOPE_MISMATCH')
            c = one(s.credentials, event.target)
            require(c is not None and c.trust_profile == event.profile, 'CREDENTIAL_UNRESOLVED')
            require(not s.lifecycle or (event.observed_order > s.lifecycle[-1].observed_order
                    and event.observed_at >= s.lifecycle[-1].observed_at), 'EVENT_ORDER')
            evidence = tuple(e for e in s.evidence if e.evidence_ref == event.evidence_ref)
            require(len(evidence) == 1 and evidence[0].credential == c.identity
                    and evidence[0].profile == c.trust_profile and
                    evidence[0].observed_at <= event.observed_at, 'EVENT_EVIDENCE')
            active = s.active
            if event.kind is EventKind.ACTIVATED:
                require(evidence[0].kind is EvidenceKind.ACTIVATION and _fresh(evidence[0], event.observed_at)
                        and event.effective_at == event.observed_at, 'ACTIVATION_EVIDENCE')
                require((active is None and c.predecessor is None) or c.predecessor == active, 'ROTATION_PREDECESSOR')
                u = UseContext(c.trust_profile, c.identity, c.scope, c.use_algorithm, c.use_profile)
                d = evaluate_usage(s, u, event.observed_at, s.revision, event.event_ref)
                require(set(d.reasons) <= {'NOT_ACTIVE'}, 'ACTIVATION_INELIGIBLE')
                active = c.identity
            else:
                require(event.kind in (EventKind.CONFIGURED, EventKind.REVOKED, EventKind.DISABLED,
                                       EventKind.EXTERNAL_UNRESOLVED), 'EVENT_KIND')
                require(evidence[0].kind is EvidenceKind.STATUS, 'EVENT_EVIDENCE')
            self._snapshot = replace(s, revision=s.revision+1, lifecycle=s.lifecycle+(event,), active=active)
            return Result.BOUND


@dataclass(frozen=True, slots=True)
class AccessRequest:
    attempt: AttemptBinding = field(repr=False)
    signature: UseContext
    transport: UseContext
    channel_profile: str
    endpoint_profile: Version
    signature_state_revision: int
    transport_state_revision: int
    signature_decision_ref: str
    transport_decision_ref: str
    evaluated_at: datetime

    def __post_init__(self):
        check_attempt(self.attempt)
        exact(self.signature, UseContext); exact(self.transport, UseContext)
        ref(self.channel_profile); exact(self.endpoint_profile, Version)
        number(self.signature_state_revision, 0); number(self.transport_state_revision, 0)
        ref(self.signature_decision_ref); ref(self.transport_decision_ref); instant(self.evaluated_at)


@dataclass(frozen=True, slots=True)
class AttemptAccessBinding:
    # Entire upstream frozen value retains proof, original bytes, item, edition,
    # envelope, delivery/source revision and operation/attempt/input identities.
    request: AccessRequest = field(repr=False)
    signature_decision: EligibilityDecision
    transport_decision: EligibilityDecision
    admission_order: int
    signed_length: int
    auth_attempt_ref: Observation = field(default=Observation.NOT_OBSERVED, init=False)
    auth_observation_ref: Observation = field(default=Observation.NOT_OBSERVED, init=False)
    external_ack_performed: bool = field(default=False, init=False)
    real_receipt_adapter: bool = field(default=False, init=False)

    def __post_init__(self):
        exact(self.request, AccessRequest)
        exact(self.signature_decision, EligibilityDecision); exact(self.transport_decision, EligibilityDecision)
        number(self.admission_order); number(self.signed_length)
        require(self.signed_length == len(self.request.attempt.signed_bytes), 'ATTEMPT_BYTES')
        for d, u, revision, identity in (
                (self.signature_decision,self.request.signature,self.request.signature_state_revision,
                 self.request.signature_decision_ref),
                (self.transport_decision,self.request.transport,self.request.transport_state_revision,
                 self.request.transport_decision_ref)):
            require(d.context == u and d.state_revision == revision and d.decision_ref == identity
                    and d.evaluated_at == self.request.evaluated_at and d.result is State.ELIGIBLE_LOCAL,
                    'DECISION_BINDING')


def bind_access(request, signature_snapshot, transport_snapshot, admission_order):
    """Pure side binding. Recompute; never consume a caller's positive decision."""
    exact(request, AccessRequest); number(admission_order)
    r = request; a = r.attempt
    require(r.signature.scope.role is Role.SIGNATURE_TRUST and
            r.transport.scope.role is Role.TRANSPORT_AUTH, 'ROLE_PURPOSE_PROFILE_MISMATCH')
    require(r.signature.profile.ref != r.transport.profile.ref and
            r.signature.credential.ref != r.transport.credential.ref, 'ROLE_IDENTITY_CONFLICT')
    require(r.signature.scope.access == r.transport.scope.access and
            r.signature.scope.purpose == r.transport.scope.purpose, 'SCOPE_MISMATCH')
    access = r.transport.scope.access
    require(a.scope.environment == access.environment.value and a.scope.account_profile == access.account_ref
            and a.scope.channel_profile == r.channel_profile, 'ATTEMPT_SCOPE')
    ds = evaluate_usage(signature_snapshot, r.signature, r.evaluated_at,
                        r.signature_state_revision, r.signature_decision_ref)
    dt = evaluate_usage(transport_snapshot, r.transport, r.evaluated_at,
                        r.transport_state_revision, r.transport_decision_ref)
    require(ds.result is State.ELIGIBLE_LOCAL and dt.result is State.ELIGIBLE_LOCAL, 'ACCESS_INELIGIBLE')
    witnesses = tuple(e for e in signature_snapshot.evidence if e.kind is EvidenceKind.SIGNED_BINDING
                      and e.credential == r.signature.credential and e.profile == r.signature.profile
                      and e.scope == r.signature.scope and e.attempt == a and _fresh(e, r.evaluated_at)
                      and e.subject_ref == one(signature_snapshot.credentials,r.signature.credential).public_identifier)
    require(len(witnesses) == 1, 'SIGNATURE_ASSOCIATION_UNRESOLVED')
    # Endpoint/channel are policy-bound, inert references, never URLs.
    endpoints = tuple(e for e in transport_snapshot.evidence if e.kind is EvidenceKind.ALGORITHM
                      and e.credential == r.transport.credential and e.profile == r.transport.profile
                      and e.endpoint_profile == r.endpoint_profile and e.channel_profile == r.channel_profile
                      and _fresh(e, r.evaluated_at))
    require(len(endpoints) == 1, 'ENDPOINT_PROFILE_UNRESOLVED')
    return AttemptAccessBinding(r, ds, dt, admission_order, len(a.signed_bytes))


class AccessBook:
    """Private in-memory side bindings, no changes to M04 history.

    One book per bound pair of role scopes. Ordered reentrant gates are shared
    with rotation. No global lock; disjoint cells/books progress independently.
    Replay returns historical evidence, not renewed eligibility permission.
    """
    def __init__(self, signature_cell, transport_cell):
        exact(signature_cell, ReferenceCell); exact(transport_cell, ReferenceCell)
        require(signature_cell is not transport_cell, 'ROLE_PURPOSE_PROFILE_MISMATCH')
        self._signature = signature_cell; self._transport = transport_cell
        self._bindings = (); self._conflicts = ()

    @property
    def bindings(self):
        with self._signature._gate: return self._bindings

    @property
    def conflicts(self):
        with self._signature._gate: return self._conflicts

    def admit(self, request):
        exact(request, AccessRequest)
        cells = sorted((self._signature, self._transport), key=lambda c:repr(c.snapshot.scope))
        with ExitStack() as stack:
            for cell in cells: stack.enter_context(cell._gate)
            identity = request.attempt.proof.attempt_ref
            old = tuple(b for b in self._bindings if b.request.attempt.proof.attempt_ref == identity)
            if old:
                if old[0].request == request: return Result.REPLAY, old[0]
                self._conflicts += (identity,)
                return Result.CONFLICT, old[0]
            require(identity not in self._conflicts, 'IDENTITY_CONFLICT')
            binding = bind_access(request, self._signature.snapshot, self._transport.snapshot,
                                  len(self._bindings)+1)
            self._bindings += (binding,)
            return Result.BOUND, binding


class ReferenceDomain:
    """Fixed private cell inventory; account blocks cover every known role.

    All accounts/scopes must be declared at construction. There is no lazy
    account discovery, dynamic real registration or unknown-cell fallback.
    Each block is backed by a distinct scoped evidence value, never a boolean.
    """
    def __init__(self, cells):
        values(cells, ReferenceCell)
        require(len({c.snapshot.scope for c in cells}) == len(cells), 'IDENTITY_CONFLICT')
        self.cells = cells

    def block_account(self, access, evidence):
        exact(access, AccessScope); values(evidence, EvidenceReference)
        targets = tuple(c for c in self.cells if c.snapshot.scope.access == access)
        require(bool(targets) and len(evidence) == len(targets)
                and {e.scope for e in evidence} == {c.snapshot.scope for c in targets}
                and all(e.kind is EvidenceKind.ACCOUNT_BLOCK for e in evidence), 'ACCOUNT_BLOCK_SCOPE')
        with ExitStack() as stack:
            for c in sorted(targets, key=lambda c:repr(c.snapshot.scope)): stack.enter_context(c._gate)
            old = tuple(c.snapshot for c in targets)
            try:
                result = tuple(c.register(next(e for e in evidence if e.scope == c.snapshot.scope)) for c in targets)
                require(all(r in (Result.BOUND, Result.REPLAY) for r in result), 'ACCOUNT_BLOCK_CONFLICT')
            except Exception:
                for c, s in zip(targets, old): c._snapshot = s
                raise
            return result
