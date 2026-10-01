"""Private V147 journal adapter; injected local database, no transport.

Every read revalidates the W11 source. Commit uncertainty retains the entire
frozen operation. There is no retry executor, network port, or ACK performer.
"""
from dataclasses import asdict, dataclass, replace
from datetime import datetime
import json
from uuid import uuid4

from . import m03_trust_profile as m
from . import m04_transport_state as t
from . import m04_attempt_response as v
from . import m04_response_store as old
from . import m04_history_codec as codec
from .security import canonical, require, sha, Rejected
from .model import uid


@dataclass(frozen=True)
class Operation:
    operation_ref: str
    kind: str
    identity: str
    value: bytes
    at: datetime

    def __post_init__(self):
        uid(self.operation_ref); m.ref(self.identity); m.instant(self.at)
        require(self.kind in codec.KINDS - {'ADAPTER_CONFLICT'}, 'history_operation_kind')
        require(type(self.value) is bytes, 'history_operation_value')


class CommitUnknown(Rejected):
    def __init__(self, operation):
        super().__init__('history_commit_unknown')
        self.operation = operation


def identity():
    # V146's reserved synthetic reference grammar, not a real credential ID.
    return '00000000-0000-4000-8000-'+str(uuid4())[-12:]


def operation(kind, ref, value, at, operation_ref=None):
    return Operation(operation_ref or identity(), kind, ref, codec.frozen(value), at)


def _key(scope, phase, kind, value):
    return (scope, phase, kind, value)


def _slot(r):
    return [r.attempt_ref, r.phase.value, r.method.value, r.target.value,
            r.scope.channel_profile, codec.encode(r.access.endpoint_profile), r.scope.account_profile]


class Cut:
    def __init__(self):
        self.book = v.AttemptBook()
        self.events = {}
        self.requests = {}
        self.histories = {}
        self.snapshots = {}
        self.captures = {}
        self.interpretations = {}
        self.assertions = {}
        self.services = {}
        self.rows = {}
        self.operations = {}
        self.canonical = {}
        self.fences = {}
        self.attachment = None
        self.blocked = set()


class AdapterHistory(old.ResponseStore):
    def _call(self, db, name, params, casts):
        # Only this full mixed reader/writer routes through the private base
        # implementation. The public old-version entry functions stay guarded.
        name = {'m04_gate_v1':'m04_gate_base_v1', 'm04_write_v1':'m04_write_base_v1'}.get(name, name)
        result = super()._call(db, name, params, casts)
        if name == 'm04_write_base_v1':
            result = result | {'event_order': old._pg_int8(result['event_order'], minimum=1)}
        return result

    def _restore(self, db, state):
        cut = self._cut(db, state)
        return cut.book, cut.events

    def _state(self, db):
        state = self._call(db, 'm04_state_base_v1', [self.profile], ['uuid'])
        for name in ('attempts', 'journal'):
            state[name] = [r | {'event_order': old._pg_int8(r['event_order'], minimum=1)} for r in state[name]]
        return state

    def _source(self, db, row, cut):
        expected = row['expectation']
        signed, stored = self._load(db, expected)
        header = stored['bundle']['stored']
        require(header['proof_id'] == row['physical_proof_id'], 'history_physical_proof')
        require(row['proof_binding'] == dict(physical_proof_id=header['proof_id'],
            canonical_proof_id=header['canonical_proof_id'], record_kind=header['record_kind'],
            commit_ref=header['commit_ref'], cipher_commitment=stored['observation']['commitment'],
            input_sha256=stored['bundle']['input_sha256']), 'history_proof_commit')
        d = self._prepare(cut.book, signed, stored, v.Scope(**row['binding']['scope']), self.bridge)
        require(old.binding(cut.book.attempt_events[-1][2]) == row['binding'], 'history_original_source')
        return d

    def _legacy(self, db, row, kind, cut):
        require(row['contract'] == old.CONTRACT and row['codec'] == old.CODEC, 'history_legacy_version')
        book = cut.book; book._order = row['event_order'] - 1
        before = set(book._blocked)
        if kind in ('ATTEMPT', 'ATTEMPT_CONFLICT'):
            source = row if kind == 'ATTEMPT' else row['evidence']['source']
            d = self._source(db, source, cut)
            require(d.status.value == ('BOUND' if kind == 'ATTEMPT' else 'CONFLICT'), 'history_legacy_attempt')
            if kind == 'ATTEMPT':
                require(source['proof_binding']['record_kind'] == 'BOUND', 'history_bound_proof')
                return
        else:
            inp = dict(row['evidence']['input'])
            inp['original_hex'] = None if row['original_response'] is None else row['original_response'][2:]
            response = old.decode_response(inp)
            require(sha(canonical(dict(response=inp, prior_event_ref=row['prior_event_ref']))) == row['input_fingerprint'],
                    'history_legacy_input')
            require(old.involved_attempts(book, response) == row['evidence']['involved_attempts'], 'history_legacy_participants')
            prior_keys = set(book._owners)
            d = book.observe(response)
            require((d.status.value, d.reason, d.observation.order, d.observation.attempt_ref) ==
                    (row['status'], row['reason'], row['event_order'], row['resolved_attempt_ref']), 'history_legacy_decision')
            require(d.observation.original_sha256 == row['response_sha256'], 'history_legacy_bytes')
            cut.events[row['event_order']] = row['event_ref']
            for key in set(book._owners) - prior_keys:
                scope, phase, kind_, value = key
                cut.services[key] = dict(scope=asdict(scope), phase=phase.value, kind=kind_, value=value,
                    attempt_ref=book._owners[key], event_ref=row['event_ref'],
                    response_sha256=row['response_sha256'], claims_hash=old.claims_hash(response))
        require(sorted(book._blocked-before) == row['evidence']['blocked_added'], 'history_legacy_conflict')
        cut.blocked.update(book._blocked)

    def _request(self, value, cut):
        require(type(value) is t.RequestBinding and value.attempt_ref in cut.book._attempts, 'history_request')
        require(value.attempt == cut.book._attempts[value.attempt_ref], 'history_attempt_identity')
        require(value.scope.environment == 'TEST', 'history_test_only')
        require(value.body == (value.attempt.signed_bytes if value.phase is v.Phase.UPLOAD else None), 'history_exact_body')
        # Observed IDs need an existing shared-index witness for this Attempt.
        for i in value.observed_service_ids:
            require(any(s['attempt_ref'] == value.attempt_ref and s['kind'] == i.kind.value and s['value'] == i.value
                        for s in cut.services.values()), 'history_unproven_service')

    def _access(self, request, cut, at):
        scopes = [canonical(codec.encode(x.scope)) for x in (request.access.signature, request.access.transport)]
        require(all(s in cut.snapshots for s in scopes), 'history_m03_missing')
        sig, trans = (cut.snapshots[s][1] for s in scopes)
        access = replace(request.access, evaluated_at=at)
        return m.bind_access(access, sig, trans, request.order)

    def _correlate(self, cut, capture, interpretation):
        book = t.CorrelationBook(tuple(cut.requests.values()))
        book._entries = tuple(value[1] for value in cut.interpretations.values())
        result = book.correlate(capture, interpretation)
        blocked = set(result.blocked)
        decision = result.decision
        owner = result.resolved_attempt
        # The persistent index has ONE namespace, including the legacy branch.
        for i in interpretation.service_ids:
            key = _key(capture.scope, capture.phase, i.kind.value, i.value)
            prior = cut.services.get(key)
            if prior is None:
                continue
            oldrow = cut.rows[prior['event_ref']]
            if oldrow['kind'] == 'RESPONSE':
                p = dict(oldrow['evidence']['input'])
                raw = oldrow['original_response']
                p['original_hex'] = None if raw is None else raw[2:]
                legacy = old.decode_response(p)
                echoes = {kind: tuple(c.value for c in interpretation.claims if c.kind is kind) for kind in t.ClaimKind}
                same = (legacy.original_bytes == capture.raw and legacy.http_status == capture.http_status
                        and echoes[t.ClaimKind.ORIGINAL_TICKET] == (() if legacy.transfer_ticket is None else (legacy.transfer_ticket,))
                        and echoes[t.ClaimKind.ORIGINAL_MESSAGE] == (() if legacy.message_ref is None else (legacy.message_ref,))
                        and echoes[t.ClaimKind.ORIGINAL_DOC] == legacy.doc_refs
                        and echoes[t.ClaimKind.ITEM] == (() if legacy.item_position is None else (legacy.item_position,)))
                if not same or (owner is not None and owner != prior['attempt_ref']):
                    decision = t.Code.CONFLICT
                    blocked.update(x for x in (owner, prior['attempt_ref']) if x is not None)
                elif decision is t.Code.ALLOWED_SYNTHETIC:
                    decision = t.Code.REPLAY
            elif prior['attempt_ref'] != owner and owner is not None:
                decision = t.Code.CONFLICT; blocked.update((prior['attempt_ref'], owner))
        if owner in cut.blocked:
            decision = t.Code.CONFLICT; blocked.add(owner)
        for _, prior in cut.interpretations.values():
            p = prior.interpretation
            if (p.capture_ref, p.parser_revision, p.schema_revision, p.policy_revision) == (
                    interpretation.capture_ref, interpretation.parser_revision, interpretation.schema_revision, interpretation.policy_revision):
                if t.CorrelationBook._claims(p) != t.CorrelationBook._claims(interpretation):
                    decision = t.Code.CONFLICT
                    blocked.update(x for x in (owner, prior.resolved_attempt) if x is not None)
        return replace(result, decision=decision, blocked=tuple(sorted(blocked)))

    @staticmethod
    def _service_candidates(cut, result, event_ref):
        if result.decision not in (t.Code.ALLOWED_SYNTHETIC, t.Code.REPLAY):
            return []
        capture = result.capture; interpretation = result.interpretation
        return [dict(scope=asdict(capture.scope), phase=capture.phase.value,
            kind=i.kind.value, value=i.value, attempt_ref=result.resolved_attempt, event_ref=event_ref,
            response_sha256=capture.raw_sha256,
            claims_hash=sha(codec.frozen(t.CorrelationBook._claims(interpretation))))
            for i in interpretation.service_ids
            if _key(capture.scope, capture.phase, i.kind.value, i.value) not in cut.services]

    def _apply(self, row, cut):
        e = row['evidence']; kind = row['kind']
        require(row['contract'] == codec.CONTRACT and row['codec'] == codec.CODEC
                and kind in codec.KINDS and e['origin'] == 'synthetic_test', 'history_version')
        cut.rows[row['event_ref']] = row
        cut.operations.setdefault(e['operation_ref'], []).append(row)
        encoded = e['input']
        if kind == 'RAW_CAPTURE':
            require(encoded['fields']['raw'] == {'type': 'raw-original'}, 'history_raw_source')
            raw = None if row['original_response'] is None else bytes.fromhex(row['original_response'][2:])
            encoded = encoded | {'fields': encoded['fields'] | {'raw': codec.encode(raw)}}
        value = codec.decode(encoded, cut.book._attempts)
        if kind == 'ADAPTER_ATTACHMENT':
            require(cut.attachment is None and value == (codec.CONTRACT, codec.CODEC), 'history_attachment')
            cut.attachment = row
        elif kind == 'M03_SNAPSHOT':
            scope, predecessor, commands = value
            key = canonical(codec.encode(scope))
            previous = cut.snapshots.get(key)
            before = previous[1] if previous else m.Snapshot(scope)
            require(before.revision == predecessor and row['prior_event_ref'] == (previous[0]['event_ref'] if previous else None),
                    'history_snapshot_chain')
            snapshot = codec.replay_m03(before, commands)
            require(codec.encode(snapshot) == e['snapshot'] and snapshot.revision == e['revision'], 'history_snapshot_reconstruction')
            cut.snapshots[key] = (row, snapshot)
        elif kind == 'REQUEST':
            self._request(value, cut)
            self._access(value, cut, codec.decode(e['frozen_operation']['at'], cut.book._attempts))
            require(value.request_ref not in cut.requests and row['resolved_attempt_ref'] == value.attempt_ref, 'history_request_ref')
            cut.requests[value.request_ref] = value
            cut.histories[value.request_ref] = t.History(value)
        elif kind == 'SEND_EVIDENCE':
            require(type(value) is t.SendEvidence, 'history_send_type')
            h = cut.histories[value.request_ref]
            previous = h.events[-1].event_ref if h.events else cut.canonical[('REQUEST', value.request_ref)]['event_ref']
            require(row['prior_event_ref'] == previous, 'history_send_predecessor')
            h = replace(h, events=h.events+(value,))
            t.project(h.request, h.events)
            if value.kind is t.Event.SEND_STARTED:
                slot = canonical(_slot(h.request))
                require(slot not in cut.fences and e['dispatch_slot'] == _slot(h.request), 'history_dispatch_duplicate')
                require(codec.encode(self._access(h.request, cut, value.at)) == e['admission'], 'history_dispatch_admission')
                require(h.request.attempt_ref not in cut.blocked, 'history_dispatch_blocked')
                m.ref(e['fence_ref']); cut.fences[slot] = row
            cut.histories[value.request_ref] = h
        elif kind == 'RAW_CAPTURE':
            require(type(value) is t.RawResponseCapture and value.commit is t.Commit.OBSERVED, 'history_raw_metadata')
            require((value.raw_sha256, value.length) == (row['response_sha256'], row['response_length']), 'history_raw_integrity')
            value = replace(value, commit=t.Commit.CONFIRMED, commit_ref=row['commit_ref'])
            if row['canonical_event_ref'] is None:
                cut.captures[value.capture_ref] = (row, value)
                h = cut.histories[value.request_ref]
                if (value.attempt_ref, value.scope, value.phase) == (h.request.attempt_ref, h.request.scope, h.request.phase):
                    cut.histories[value.request_ref] = replace(h, captures=h.captures+(value,))
        elif kind == 'RECEIPT_INTERPRETATION':
            ref, interpretation = value
            rawrow, capture = cut.captures[interpretation.capture_ref]
            require(row['prior_event_ref'] == rawrow['event_ref'], 'history_interpretation_raw')
            result = self._correlate(cut, capture, interpretation)
            require(codec.encode((result.resolved_attempt, result.decision, result.blocked)) == e['correlation'], 'history_correlation_reconstruction')
            expected_status = {t.Code.ALLOWED_SYNTHETIC:'BOUND', t.Code.REPLAY:'REPLAY',
                               t.Code.CONFLICT:'CONFLICT', t.Code.UNRESOLVED:'UNRESOLVED'}[result.decision]
            require(row['status'] == expected_status and row['resolved_attempt_ref'] == result.resolved_attempt
                    and e['raw_sha256'] == capture.raw_sha256, 'history_interpretation_decision')
            require(e['new_services'] == self._service_candidates(cut, result, row['event_ref']), 'history_service_decision')
            cut.interpretations[ref] = (row, result)
            cut.blocked.update(result.blocked); cut.book._blocked.update(result.blocked)
            h = cut.histories[capture.request_ref]
            if any(x.capture_ref == capture.capture_ref for x in h.captures):
                cut.histories[capture.request_ref] = replace(h, interpretations=h.interpretations+(interpretation,))
            for s in e['new_services']:
                key = _key(v.Scope(**s['scope']), v.Phase(s['phase']), s['kind'], s['value'])
                require(key not in cut.services, 'history_service_rebinding')
                cut.services[key] = s
                # The old correlator sees only its OWN unchanged body-claim
                # grammar. The full C1 interpretation remains separately bound
                # in this same cut and is never serialized as a v1 response.
                if s['kind'] in v.SERVICE_KINDS:
                    claims = interpretation.claims
                    def echo(kind):
                        xs = tuple(c.value for c in claims if c.kind is kind)
                        require(len(xs) <= 1, 'history_legacy_echo_ambiguous')
                        return xs[0] if xs else None
                    inp = v.ResponseInput(row['event_ref'], capture.scope, capture.phase, v.Presence.OBSERVED,
                        capture.raw, result.resolved_attempt, (v.ServiceId(s['kind'], s['value']),),
                        echo(t.ClaimKind.ORIGINAL_TICKET), echo(t.ClaimKind.ORIGINAL_MESSAGE),
                        tuple(c.value for c in claims if c.kind is t.ClaimKind.ORIGINAL_DOC),
                        echo(t.ClaimKind.ITEM), capture.http_status)
                    cut.book._owners[key] = result.resolved_attempt
                    cut.book._responses[key] = v.ResponseObservation(inp, capture.raw_sha256,
                        row['event_order'], result.resolved_attempt, v.Status.BOUND, 'adapter_owner_anchor')
                    cut.events[row['event_order']] = row['event_ref']
        elif kind == 'ADAPTER_CONFLICT':
            require(row['status'] == 'CONFLICT' and row['canonical_event_ref'] in cut.rows, 'history_conflict_source')
            require(all(a in cut.book._attempts for a in e['blocked_added']), 'history_conflict_attempt')
            cut.blocked.update(e['blocked_added']); cut.book._blocked.update(e['blocked_added'])
        elif kind == 'EVIDENCE_ASSERTION':
            self._assertion(value, cut)
            cut.assertions[e['identity']] = (row, value)
        if row['canonical_event_ref'] is None:
            require((kind, e['identity']) not in cut.canonical, 'history_duplicate_identity')
            cut.canonical[(kind, e['identity'])] = row

    def _cut(self, db, state):
        cut = Cut()
        rows = [(r['event_order'], 'ATTEMPT', r) for r in state['attempts']]
        rows += [(r['event_order'], r['kind'], r) for r in state['journal']]
        require(len({n for n, _, _ in rows}) == len(rows), 'history_duplicate_order')
        for _, kind, row in sorted(rows):
            require(row['store_profile'] == self.profile, 'history_profile')
            if kind == 'ATTEMPT' or row['codec'] == old.CODEC:
                if kind != 'ATTEMPT': cut.rows[row['event_ref']] = row
                self._legacy(db, row, kind, cut)
            else:
                self._apply(row, cut)
        actual = [dict(scope=dict(environment=s['environment'], channel_profile=s['channel_profile'],
                    account_profile=s['account_profile']), phase=s['phase'], kind=s['id_type'], value=s['observed_value'],
                    attempt_ref=s['attempt_ref'], event_ref=s['event_ref'], response_sha256=s['response_sha256'],
                    claims_hash=s['claims_hash']) for s in state['services']]
        require(sorted(cut.services.values(), key=canonical) == sorted(actual, key=canonical), 'history_service_cut')
        return cut

    def recover(self):
        db = self.connect()
        try:
            db.query('begin isolation level read committed')
            state = self._state(db)
            cut = self._cut(db, state)
            db.query('commit')
            decisions = {ref: t.recover(h, blocked_attempts=tuple(sorted(cut.blocked)))
                         for ref, h in cut.histories.items()}
            return dict(state=state, cut=cut, recovery=decisions,
                        external_ack_performed=False, real_receipt_adapter=False)
        except Exception:
            db.query('rollback'); raise
        finally:
            db.close()

    def recover_operation(self, operation_ref):
        uid(operation_ref)
        cut = self.recover()['cut']
        rows = cut.operations[operation_ref]
        frozen = rows[0]['evidence']['frozen_operation']
        value = frozen['value']
        if frozen['kind'] == 'RAW_CAPTURE':
            rawrow = next(r for r in rows if r['kind'] == 'RAW_CAPTURE')
            raw = None if rawrow['original_response'] is None else bytes.fromhex(rawrow['original_response'][2:])
            value = value | {'fields': value['fields'] | {'raw': codec.encode(raw)}}
        op = Operation(operation_ref, frozen['kind'], frozen['identity'], canonical(value),
                       codec.decode(frozen['at'], cut.book._attempts))
        self._same_operation(op, rows)
        return op

    def freeze_request(self, request, at, operation_ref=None):
        require(type(request) is t.RequestBinding, 'history_request_type')
        return operation('REQUEST', request.request_ref, request, at, operation_ref)

    def freeze_send(self, evidence, at, fence_ref=None, worker_ref=None, operation_ref=None):
        require(type(evidence) is t.SendEvidence, 'history_send_type')
        if evidence.kind is t.Event.SEND_STARTED:
            m.ref(fence_ref); m.ref(worker_ref)
        else:
            require(fence_ref is None and worker_ref is None, 'history_no_detached_fence')
        return operation('SEND_EVIDENCE', evidence.event_ref, (evidence, fence_ref, worker_ref), at, operation_ref)

    def freeze_capture(self, capture, at, operation_ref=None):
        require(type(capture) is t.RawResponseCapture and capture.commit is t.Commit.OBSERVED, 'history_raw_entry')
        return operation('RAW_CAPTURE', capture.capture_ref, capture, at, operation_ref)

    def freeze_snapshot(self, evidence_ref, scope, predecessor, commands, at, operation_ref=None):
        require(type(scope) is m.UsageScope and type(commands) is tuple, 'history_snapshot_entry')
        m.number(predecessor, 0)
        return operation('M03_SNAPSHOT', evidence_ref, (scope, predecessor, commands), at, operation_ref)

    def freeze_attachment(self, at, operation_ref=None):
        return operation('ADAPTER_ATTACHMENT', identity(), (codec.CONTRACT, codec.CODEC), at, operation_ref)

    def freeze_assertion(self, stage, interpretation_ref, at, operation_ref=None):
        require(stage in (t.AckStage.REVALIDATED, t.AckStage.FINAL_UNDERSTOOD,
                          t.AckStage.INTENT, t.AckStage.CONFIRMATION_COMMITTED), 'history_assertion_stage')
        recovered = self.recover(); cut = recovered['cut']
        require(interpretation_ref in cut.interpretations, 'history_assertion_interpretation')
        _, result = cut.interpretations[interpretation_ref]
        c = result.capture
        sources = tuple(sorted((ref, row['commit_ref'], sha(canonical(row))) for ref, row in cut.rows.items()))
        value = (stage, c.request_ref, c.capture_ref, interpretation_ref, c.raw_sha256, c.scope, sources)
        self._assertion(value, cut)
        return operation('EVIDENCE_ASSERTION', identity(), value, at, operation_ref)

    def _assertion(self, value, cut):
        require(type(value) is tuple and len(value) == 7, 'history_assertion_shape')
        stage, request_ref, capture_ref, interpretation_ref, rawhash, scope, sources = value
        require(stage in (t.AckStage.REVALIDATED, t.AckStage.FINAL_UNDERSTOOD,
                          t.AckStage.INTENT, t.AckStage.CONFIRMATION_COMMITTED), 'history_assertion_stage')
        require(interpretation_ref in cut.interpretations and type(sources) is tuple and sources, 'history_assertion_source')
        rirow, result = cut.interpretations[interpretation_ref]; c = result.capture
        require((request_ref, capture_ref, rawhash, scope) == (c.request_ref, c.capture_ref, c.raw_sha256, c.scope),
                'history_assertion_binding')
        for ref, commit, fingerprint in sources:
            require(ref in cut.rows and cut.rows[ref]['commit_ref'] == commit
                    and sha(canonical(cut.rows[ref])) == fingerprint, 'history_assertion_cut')
        require(rirow['event_ref'] in {x[0] for x in sources}, 'history_assertion_cut_source')
        if stage is not t.AckStage.REVALIDATED:
            require(result.decision in (t.Code.ALLOWED_SYNTHETIC, t.Code.REPLAY)
                    and result.resolved_attempt not in cut.blocked
                    and result.interpretation.terminal is t.Terminal.FINAL
                    and result.interpretation.fact is not t.Fact.UNKNOWN, 'history_assertion_terminal')
        predecessor = {t.AckStage.FINAL_UNDERSTOOD:t.AckStage.REVALIDATED,
                       t.AckStage.INTENT:t.AckStage.FINAL_UNDERSTOOD,
                       t.AckStage.CONFIRMATION_COMMITTED:t.AckStage.INTENT}.get(stage)
        if predecessor:
            require(any(v[0] is predecessor and v[1:6] == value[1:6]
                        for _, v in cut.assertions.values()), 'history_assertion_predecessor')

    def ack(self, interpretation_ref):
        cut = self.recover()['cut']
        rirow, result = cut.interpretations[interpretation_ref]
        c = result.capture; h = cut.histories[c.request_ref]
        witnesses = []
        observed = next((e for e in h.events if e.kind is t.Event.RESPONSE_OBSERVED and e.related_ref == c.capture_ref), None)
        if observed:
            witnesses.append(t.AckWitness(observed.event_ref, t.AckStage.OBSERVED, c.request_ref, c.capture_ref, c.raw_sha256, c.scope))
        rawrow = cut.captures[c.capture_ref][0]
        witnesses.append(t.AckWitness(rawrow['event_ref'], t.AckStage.COMMITTED, c.request_ref, c.capture_ref, c.raw_sha256, c.scope))
        witnesses.append(t.AckWitness(rirow['event_ref'], t.AckStage.PARSED_CORRELATED, c.request_ref, c.capture_ref, c.raw_sha256, c.scope))
        for stage in (t.AckStage.REVALIDATED, t.AckStage.FINAL_UNDERSTOOD, t.AckStage.INTENT, t.AckStage.CONFIRMATION_COMMITTED):
            matches = [(r, val) for r, val in cut.assertions.values()
                       if val[:6] == (stage, c.request_ref, c.capture_ref, interpretation_ref, c.raw_sha256, c.scope)]
            if matches:
                r, _ = matches[0]
                witnesses.append(t.AckWitness(r['event_ref'], stage, c.request_ref, c.capture_ref, c.raw_sha256, c.scope))
        confirmation = t.Commit.CONFIRMED
        if not any(w.stage is t.AckStage.CONFIRMATION_COMMITTED for w in witnesses) and any(e.kind is t.Event.COMMIT_UNKNOWN for e in h.events):
            confirmation = t.Commit.UNKNOWN
        return t._ack_decision(result, tuple(witnesses), confirmation=confirmation,
                               confirm_synthetic=False, blocked_attempts=tuple(sorted(cut.blocked)))

    def parse(self, capture_ref, port, interpretation_ref, at, operation_ref=None):
        require(type(port) is t.ReceiptAdapterPort and port.capture_ref == capture_ref, 'history_parser_port')
        # This connection finishes its independent committed read before the
        # scripted parser is entered. A caller's Commit.CONFIRMED is not used.
        recovered = self.recover(); cut = recovered['cut']
        require(capture_ref in cut.captures, 'history_parse_before_commit')
        _, capture = cut.captures[capture_ref]
        require(capture.completeness is t.Completeness.COMPLETE and capture.raw == port.expected_raw,
                'history_parse_before_commit')
        require(port.kind is not t.ReceiptKind.PARSER_CRASH, 'history_parser_crash')
        request = cut.requests[capture.request_ref]
        valid = port.kind in (t.ReceiptKind.DIP_OK, t.ReceiptKind.DIP_ERROR)
        fact = (t.Fact.ACCEPTED_SYNTHETIC if port.kind is t.ReceiptKind.DIP_OK else
                t.Fact.REJECTED_SYNTHETIC if port.kind is t.ReceiptKind.DIP_ERROR else t.Fact.UNKNOWN)
        interpretation = t.ReceiptInterpretation(capture_ref, capture.raw_sha256,
            port.parser_revision, port.schema_revision, port.policy_revision, port.claims, port.service_ids,
            t.Code.UNRESOLVED, fact, request.attempt.doc_refs if valid else (),
            t.Reason.UNCORRELATED if valid else t.Reason.PARSE_REJECT,
            t.Terminal.FINAL if valid else t.Terminal.UNKNOWN)
        return operation('RECEIPT_INTERPRETATION', interpretation_ref, (interpretation_ref, interpretation), at, operation_ref)

    def _gate_input(self, op, value, cut):
        refs = set(); scopes = set(); m03_scopes = []; ids = {op.kind+':'+op.identity, 'OP:'+op.operation_ref}
        request = None
        if op.kind == 'ADAPTER_ATTACHMENT':
            ids.add('ATTACHMENT:'+self.profile)
        elif op.kind == 'REQUEST':
            request = value
        elif op.kind == 'SEND_EVIDENCE':
            request = cut.requests[value[0].request_ref]
        elif op.kind == 'RAW_CAPTURE':
            request = cut.requests[value.request_ref]
            refs.add(value.attempt_ref); scopes.add(canonical(asdict(value.scope)))
        elif op.kind == 'RECEIPT_INTERPRETATION':
            capture = cut.captures[value[1].capture_ref][1]
            request = cut.requests[capture.request_ref]
            refs.add(capture.attempt_ref); scopes.add(canonical(asdict(capture.scope)))
            ids.add('RAW_CAPTURE:'+value[1].capture_ref)
        elif op.kind == 'M03_SNAPSHOT':
            m03_scopes = [codec.encode(value[0])]
        elif op.kind == 'EVIDENCE_ASSERTION':
            request = cut.requests[value[1]]
            capture = cut.captures[value[2]][1]
            refs.add(capture.attempt_ref); scopes.add(canonical(asdict(capture.scope)))
        if request is not None:
            refs.add(request.attempt_ref); scopes.add(canonical(asdict(request.scope)))
            ids.add('REQUEST:'+request.request_ref)
            if op.kind in ('REQUEST', 'SEND_EVIDENCE'):
                m03_scopes = [codec.encode(x.scope) for x in (request.access.signature, request.access.transport)]
            if op.kind == 'SEND_EVIDENCE' and value[0].kind is t.Event.SEND_STARTED:
                ids.add('DISPATCH:'+canonical(_slot(request)).decode())
        return dict(operation_ref=op.operation_ref, kind=op.kind, identity=op.identity,
                    origin='synthetic_test', m03_scopes=m03_scopes,
                    attempt_refs=sorted(refs), scopes=[json.loads(s) for s in sorted(scopes)], identities=sorted(ids))

    def _gate_history(self, db, op):
        require(type(op) is Operation, 'history_frozen_operation')
        preliminary = self._cut(db, self._state(db))
        value = codec.thaw(op.value, preliminary.book._attempts)
        plan = self._gate_input(op, value, preliminary)
        ticket = self._call(db, 'm04_history_gate_v1', [self.profile, self.authority, json.dumps(plan)], ['uuid', 'uuid', 'jsonb'])
        # Fresh READ COMMITTED statement after ALL lock waits.
        state = self._state(db); cut = self._cut(db, state)
        value = codec.thaw(op.value, cut.book._attempts)
        require(self._gate_input(op, value, cut) == plan, 'history_gate_cut_changed')
        return ticket, state, cut, value

    def _new_row(self, db, op, kind, ref, value, *, prior=None, attempt=None, status=None, reason='synthetic_only', extra=None):
        seq = self._call(db, 'm04_order_next_v1', [], [])
        inp = codec.encode(value); raw = None
        if kind == 'RAW_CAPTURE':
            raw = None if value.raw is None else value.raw.hex()
            inp['fields']['raw'] = {'type': 'raw-original'}
        evidence = dict(origin='synthetic_test', operation_ref=op.operation_ref,
                        identity=ref, input=inp, frozen_operation=dict(kind=op.kind, identity=op.identity,
                        value=json.loads(op.value), at=codec.encode(op.at)))
        # Never duplicate original capture bytes in the frozen operation payload.
        if op.kind == 'RAW_CAPTURE':
            evidence['frozen_operation']['value']['fields']['raw'] = {'type': 'raw-original'}
        evidence.update(extra or {})
        return dict(event_ref=identity(), event_order=seq, kind=kind, evidence=evidence,
                    canonical_event_ref=None, prior_event_ref=prior, resolved_attempt_ref=attempt,
                    original_hex=raw, input_fingerprint=sha(op.value), status=status, reason=reason,
                    commit_ref=identity(), created_at=op.at.isoformat())

    def _send_row(self, db, op, cut, event, fence=None, worker=None):
        request = cut.requests[event.request_ref]; h = cut.histories[event.request_ref]
        projection = t.project(request, h.events+(event,))
        extra = dict(request_ref=event.request_ref, revision=projection.revision,
                     send_kind=event.kind.value, scope=asdict(request.scope))
        if event.kind is t.Event.SEND_STARTED:
            require(canonical(_slot(request)) not in cut.fences and request.attempt_ref not in cut.blocked, 'history_dispatch_claimed')
            extra.update(dispatch_slot=_slot(request), fence_ref=fence, worker_ref=worker,
                         admission=codec.encode(self._access(request, cut, event.at)))
        prior = h.events[-1].event_ref if h.events else cut.canonical[('REQUEST', event.request_ref)]['event_ref']
        row = self._new_row(db, op, 'SEND_EVIDENCE', event.event_ref, event, prior=prior,
                            attempt=request.attempt_ref, extra=extra)
        # SendEvidence's reference IS its journal reference; the predecessor FK
        # therefore follows the local chain independently of global event_order.
        row['event_ref'] = event.event_ref
        return row

    @staticmethod
    def _as_stored(row, profile):
        raw = row['original_hex']
        return row | dict(store_profile=profile, contract=codec.CONTRACT, codec=codec.CODEC,
            original_response=None if raw is None else '\\x'+raw,
            response_sha256=None if raw is None else sha(bytes.fromhex(raw)),
            response_length=None if raw is None else len(bytes.fromhex(raw)))

    def _same_operation(self, op, rows):
        expected = dict(kind=op.kind, identity=op.identity, value=json.loads(op.value), at=codec.encode(op.at))
        for row in rows:
            actual = row['evidence']['frozen_operation']
            if op.kind == 'RAW_CAPTURE':
                rawrow = next((r for r in rows if r['kind'] == 'RAW_CAPTURE'), None)
                require(rawrow is not None, 'history_resolve_raw_missing')
                raw = None if rawrow['original_response'] is None else bytes.fromhex(rawrow['original_response'][2:])
                actual = actual | {'value': actual['value'] | {'fields': actual['value']['fields'] | {'raw': codec.encode(raw)}}}
            require(actual == expected, 'history_resolve_full_input_conflict')

    def in_transaction(self, db, op):
        if type(op) is old.FrozenOperation:
            return old.ResponseStore.in_transaction(self, db, op)
        ticket, state, cut, value = self._gate_history(db, op)
        prior = cut.operations.get(op.operation_ref)
        if prior:
            self._same_operation(op, prior)
            return dict(rows=prior, replay=True, dispatch_authorized=False,
                        external_ack_performed=False, real_receipt_adapter=False)
        require(op.kind == 'ADAPTER_ATTACHMENT' or cut.attachment is not None, 'history_attachment_required')
        rows = []; services = []
        existing = cut.canonical.get((op.kind, op.identity))
        if existing is not None:
            # A new operation may refer to an identical immutable value. Compare
            # full input, never only its fingerprint.
            same = True
            try:
                self._same_operation(op, cut.operations[existing['evidence']['operation_ref']])
            except Rejected:
                same = False
            if same:
                return dict(rows=[existing], replay=True, dispatch_authorized=False,
                            external_ack_performed=False, real_receipt_adapter=False)
            require(op.kind in ('REQUEST', 'RAW_CAPTURE', 'RECEIPT_INTERPRETATION'), 'history_ref_reuse')
            if op.kind == 'REQUEST': self._request(value, cut)
            participants = {existing['resolved_attempt_ref']}
            if op.kind == 'REQUEST': participants.add(value.attempt_ref)
            if op.kind == 'RAW_CAPTURE': participants.add(value.attempt_ref)
            participants.discard(None)
            require(participants <= set(cut.book._attempts), 'history_conflict_source')
            conflict_value = value
            if op.kind == 'RAW_CAPTURE':
                variant = self._new_row(db, op, 'RAW_CAPTURE', op.identity, value,
                    prior=existing['prior_event_ref'], attempt=existing['resolved_attempt_ref'],
                    extra={'scope': asdict(value.scope), 'request_ref': value.request_ref, 'completeness': value.completeness.value})
                variant['canonical_event_ref'] = existing['event_ref']; rows.append(variant)
                conflict_value = ('RAW_CAPTURE', variant['event_ref'])
            row = self._new_row(db, op, 'ADAPTER_CONFLICT', op.operation_ref, conflict_value,
                attempt=existing['resolved_attempt_ref'], status='CONFLICT', reason='identity_changed',
                extra={'blocked_added': sorted(participants), 'canonical_kind': op.kind})
            row['canonical_event_ref'] = existing['event_ref']; rows.append(row)
        elif op.kind == 'ADAPTER_ATTACHMENT':
            require(cut.attachment is None and value == (codec.CONTRACT, codec.CODEC), 'history_attachment_exists')
            rows.append(self._new_row(db, op, op.kind, op.identity, value))
        elif op.kind == 'M03_SNAPSHOT':
            scope, revision, commands = value
            previous = cut.snapshots.get(canonical(codec.encode(scope)))
            before = previous[1] if previous else m.Snapshot(scope)
            require(before.revision == revision, 'history_m03_stale')
            after = codec.replay_m03(before, commands)
            rows.append(self._new_row(db, op, op.kind, op.identity, value,
                prior=previous[0]['event_ref'] if previous else None,
                extra={'snapshot': codec.encode(after), 'm03_scope': codec.encode(scope), 'revision': after.revision}))
        elif op.kind == 'REQUEST':
            self._request(value, cut); self._access(value, cut, op.at)
            require(value.attempt_ref not in cut.blocked, 'history_request_blocked')
            row = self._new_row(db, op, op.kind, op.identity, value, attempt=value.attempt_ref,
                                extra={'scope': asdict(value.scope)})
            rows.append(row); self._apply(self._as_stored(row, self.profile), cut)
            p = t.advance(t.Projection(), t.Event.LOCAL_COMMIT)
            event = t.SendEvidence(identity(), value.request_ref, 0, t.Event.LOCAL_COMMIT, 1, op.at,
                                  p.progress, None, value.access.transport.credential, p.effect)
            rows.append(self._send_row(db, op, cut, event))
        elif op.kind == 'SEND_EVIDENCE':
            event, fence, worker = value
            require(event.kind not in (t.Event.LOCAL_COMMIT, t.Event.RESPONSE_COMMITTED), 'history_send_controlled')
            rows.append(self._send_row(db, op, cut, event, fence, worker))
        elif op.kind == 'RAW_CAPTURE':
            request = cut.requests[value.request_ref]
            rawrow = self._new_row(db, op, op.kind, op.identity, value,
                prior=cut.canonical[('REQUEST', value.request_ref)]['event_ref'], attempt=request.attempt_ref,
                extra={'scope': asdict(value.scope), 'request_ref': value.request_ref, 'completeness': value.completeness.value})
            rows.append(rawrow)
            kinds = ((t.Event.RESPONSE_OBSERVED, t.Event.RESPONSE_COMMITTED)
                     if value.completeness is t.Completeness.COMPLETE else (t.Event.LOST_RESPONSE, t.Event.RESPONSE_COMMITTED))
            for kind in kinds:
                h = cut.histories[value.request_ref]; p = t.project(request, h.events); nextp = t.advance(p, kind)
                event = t.SendEvidence(identity(), value.request_ref, p.revision, kind, p.revision+1,
                    op.at, nextp.progress, None, request.access.transport.credential, nextp.effect, value.capture_ref)
                row = self._send_row(db, op, cut, event); rows.append(row)
                self._apply(self._as_stored(row, self.profile), cut)
        elif op.kind == 'RECEIPT_INTERPRETATION':
            ref, interpretation = value; rawrow, capture = cut.captures[interpretation.capture_ref]
            require(capture.completeness is t.Completeness.COMPLETE, 'history_complete_required')
            result = self._correlate(cut, capture, interpretation)
            status = {t.Code.ALLOWED_SYNTHETIC:'BOUND', t.Code.REPLAY:'REPLAY', t.Code.CONFLICT:'CONFLICT',
                      t.Code.UNRESOLVED:'UNRESOLVED'}[result.decision]
            row = self._new_row(db, op, op.kind, ref, value, prior=rawrow['event_ref'],
                attempt=result.resolved_attempt, status=status, reason=result.decision.value,
                extra={'raw_sha256': capture.raw_sha256, 'scope': asdict(capture.scope),
                       'correlation': codec.encode((result.resolved_attempt, result.decision, result.blocked)), 'new_services': []})
            services = self._service_candidates(cut, result, row['event_ref'])
            row['evidence']['new_services'] = services; rows.append(row)
            if status == 'CONFLICT':
                conflict = self._new_row(db, op, 'ADAPTER_CONFLICT', op.operation_ref, value,
                    attempt=result.resolved_attempt, status='CONFLICT', reason='correlation_conflict',
                    extra={'blocked_added': list(result.blocked)})
                conflict['canonical_event_ref'] = row['event_ref']; rows.append(conflict)
        elif op.kind == 'EVIDENCE_ASSERTION':
            self._assertion(value, cut)
            rirow, result = cut.interpretations[value[3]]
            rows.append(self._new_row(db, op, op.kind, op.identity, value, prior=rirow['event_ref'],
                attempt=result.resolved_attempt, extra={'scope': asdict(result.capture.scope)}))
        else:
            require(False, 'history_closed_operation')
        payload = dict(codec=codec.CODEC, operation=ticket['challenge']['operation'], rows=rows,
                       new_services=services, external_ack_performed=False, real_receipt_adapter=False)
        mac = self.bridge._mac(db, ['m04-history-decision/1', ticket['challenge'], payload])
        result = self._call(db, 'm04_history_write_v1', [json.dumps(ticket), json.dumps(payload), mac], ['jsonb', 'jsonb', 'bytea'])
        return result | {'operation': op, 'dispatch_authorized': False}

    def commit(self, op):
        if type(op) is old.FrozenOperation:
            return old.ResponseStore.commit(self, op)
        db = self.connect()
        try:
            db.query('begin isolation level read committed')
            try:
                result = self.in_transaction(db, op)
            except Exception:
                db.query('rollback'); raise
            try:
                db.query('commit')
            except Exception as exc:
                raise CommitUnknown(op) from exc
            return result
        finally:
            db.close()

    def resolve(self, op):
        if type(op) is old.FrozenOperation:
            return old.ResponseStore.resolve(self, op)
        db = self.connect()
        try:
            db.query('begin isolation level read committed')
            _, _, cut, _ = self._gate_history(db, op)
            rows = cut.operations.get(op.operation_ref)
            if rows: self._same_operation(op, rows)
            db.query('commit')
            return dict(found=rows is not None, rows=rows or [], operation=op, dispatch_authorized=False,
                        external_ack_performed=False, real_receipt_adapter=False)
        except Exception:
            db.query('rollback'); raise
        finally:
            db.close()
