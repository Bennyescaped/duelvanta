"""Private V133 synthetic persistence adapter. Injected local DB only.

No driver, endpoint, credential discovery, signer or automatic retry. The
private W11 verifier/key holder is trusted exactly as in W11Bridge, not an app
caller. SQL functions are not granted to application roles. Native acceptance
is a separate gate; this module does not claim durability by existing/importing.
"""
from dataclasses import asdict, dataclass
import json
from pathlib import Path
from uuid import uuid4

from .security import require, Rejected, sha, canonical
from .model import uid
from .signature_profile import verify_signature
from .w11_bridge import W11Bridge
from .m04_attempt_response import (AttemptBook, ProofReference, Scope, ResponseInput,
                                   ServiceId, Phase, Presence, Status)

CONTRACT = 'V133-M04-synthetic-store/1'
CODEC = 'm04-json-hex/1'


def encode_response(r):
    require(type(r) is ResponseInput, 'm04_store_response')
    d = asdict(r)
    d['phase'] = r.phase.value
    d['presence'] = r.presence.value
    d['original_hex'] = None if r.original_bytes is None else r.original_bytes.hex()
    del d['original_bytes']
    return json.loads(canonical(d))


def decode_response(d):
    require(type(d) is dict, 'm04_store_codec')
    x = dict(d)
    raw = x.pop('original_hex')
    require(raw is None or (type(raw) is str and len(raw) <= 8388608
            and len(raw) % 2 == 0 and all(c in '0123456789abcdef' for c in raw)),
            'm04_store_hex')
    x['original_bytes'] = None if raw is None else bytes.fromhex(raw)
    x['scope'] = Scope(**x['scope'])
    x['phase'] = Phase(x['phase']); x['presence'] = Presence(x['presence'])
    x['doc_refs'] = tuple(x['doc_refs'])
    x['service_ids'] = tuple(ServiceId(**i) for i in x['service_ids'])
    r = ResponseInput(**x)
    require(encode_response(r) == d, 'm04_store_codec_roundtrip')
    return r


def binding(a):
    d = asdict(a); del d['signed_bytes']
    d['signed_length'] = len(a.signed_bytes)
    d['phase'] = a.phase.value
    return json.loads(canonical(d))


def claims_hash(r):
    return sha(canonical([None if r.original_bytes is None else r.original_bytes.hex(),
        r.http_status, r.transfer_ticket, r.message_ref, r.doc_refs, r.item_position]))


def service_rows(book, events):
    result = []
    for (scope, phase, kind, value), a in book._owners.items():
        obs = book._responses[(scope, phase, kind, value)]
        result.append(dict(scope=asdict(scope), phase=phase.value, kind=kind,
            value=value, attempt_ref=a, event_ref=events[obs.order],
            response_sha256=obs.original_sha256, claims_hash=claims_hash(obs.input)))
    return sorted(result, key=lambda x: canonical(x))


def involved_attempts(book, request):
    """Audit the V132 participants, not an alternative correlation decision."""
    _,_,key,involved = book._choose(request)
    for identity in request.service_ids:
        old=book._responses.get((request.scope,request.phase,identity.kind,identity.value))
        if old is not None and book._body_claims(old.input)!=book._body_claims(request):
            involved.update(k for k in (old.attempt_ref,key) if k is not None)
    prior=book._by_ref.get(request.observation_ref)
    if prior is not None:
        involved.update(k for k in (prior.attempt_ref,key) if k is not None)
    return sorted(involved)


@dataclass(frozen=True)
class ProofInput:
    """An expectation, never a PASS. Every use rereads and revalidates the proof."""
    bridge: W11Bridge
    expectation_bytes: bytes
    scope: Scope

    @classmethod
    def make(cls, bridge, expectation, scope):
        require(type(bridge) is W11Bridge and type(scope) is Scope, 'm04_store_proof_input')
        uid(expectation['proof_id'])
        return cls(bridge, canonical(expectation), scope)


@dataclass(frozen=True)
class FrozenOperation:
    kind: str
    identity: str
    scope: Scope
    response_bytes: bytes | None = None
    proof: ProofInput | None = None
    prior_event_ref: str | None = None


class StoreCommitUnknown(Rejected):
    def __init__(self, operation):
        super().__init__('m04_commit_unknown_resolve_same_operation')
        self.operation = operation


class ResponseStore:
    def __init__(self, profile, authority, bridge, connect):
        uid(profile); uid(authority)
        require(type(bridge) is W11Bridge and callable(connect), 'm04_store_private_constructor')
        self.profile = profile; self.authority = authority
        self.bridge = bridge; self.connect = connect

    def _call(self, db, name, params, casts):
        marks = ','.join('$'+str(i+1)+'::'+t for i,t in enumerate(casts))
        return db.query('select dv_market_private.'+name+'('+marks+') v', params)[0]['v']

    def _state(self, db):
        return self._call(db, 'm04_state_v1', [self.profile], ['uuid'])

    def _load(self, db, expectation, bridge=None):
        b = bridge or self.bridge
        stored = self._call(db, 'psttg_w11_read_bound_v1',
                            [expectation['proof_id'], b._secret], ['uuid','text'])
        signed = b.revalidate(stored, expectation)
        return signed, stored

    @staticmethod
    def _prepare(book, signed, stored, scope, bridge):
        c = stored['bundle']['input']['context']
        proof = ProofReference(c['proof_id'], c['operation_ref'], c['envelope']['attempt_ref'],
            c['input_revision'], signed.unsigned.spec.revision,
            signed.unsigned.edition.binding, sha(signed.xml))
        return book.prepare(verify_signature(signed, bridge._pin), proof, scope, bridge._schemas)

    def _restore(self, db, state):
        """Replay the complete committed cut, never an incremental max watermark."""
        book = AttemptBook(); events = {}
        rows = [(r['event_order'], 'ATTEMPT', r) for r in state['attempts']]
        rows += [(r['event_order'], r['kind'], r) for r in state['journal']]
        require(len({n for n,_,_ in rows}) == len(rows), 'm04_duplicate_order')
        for order, kind, row in sorted(rows):
            require(row['contract'] == CONTRACT and row['codec'] == CODEC, 'm04_store_version')
            require(row['store_profile'] == self.profile, 'm04_store_profile')
            book._order = order-1  # Persistent sequence is the adapter's order source.
            blocked_before = set(book._blocked)
            if kind in ('ATTEMPT','ATTEMPT_CONFLICT'):
                source = row if kind == 'ATTEMPT' else row['evidence']['source']
                expected = source['expectation']
                signed, stored = self._load(db, expected)
                header = stored['bundle']['stored']
                require(header['proof_id'] == source['physical_proof_id'], 'm04_physical_proof')
                if kind == 'ATTEMPT': require(header['record_kind'] == 'BOUND', 'm04_canonical_proof')
                pb = source['proof_binding']
                require(pb == dict(physical_proof_id=header['proof_id'],
                    canonical_proof_id=header['canonical_proof_id'],record_kind=header['record_kind'],
                    commit_ref=header['commit_ref'],cipher_commitment=stored['observation']['commitment'],
                    input_sha256=stored['bundle']['input_sha256']), 'm04_proof_commit_binding')
                decision = self._prepare(book, signed, stored, Scope(**source['binding']['scope']), self.bridge)
                require(binding(book.attempt_events[-1][2]) == source['binding'], 'm04_attempt_reconstruction')
                require(decision.status.value == ('BOUND' if kind == 'ATTEMPT' else 'CONFLICT'), 'm04_attempt_history')
                if kind == 'ATTEMPT_CONFLICT':
                    require(sorted(book._blocked-blocked_before) == row['evidence']['blocked_added'], 'm04_conflict_history')
                    require(row['evidence']['involved_attempts']==[source['binding']['proof']['attempt_ref']],
                            'm04_attempt_conflict_participants')
            else:
                e = row['evidence']; d = dict(e['input'])
                raw = row['original_response']
                d['original_hex'] = None if raw is None else raw[2:]
                r = decode_response(d)
                require(involved_attempts(book,r)==e['involved_attempts'],'m04_response_participants')
                require(sha(canonical(dict(response=d,prior_event_ref=row['prior_event_ref'])))
                        == row['input_fingerprint'], 'm04_input_fingerprint')
                decision = book.observe(r)
                obs = decision.observation
                require(obs.order == order and decision.status.value == row['status']
                        and decision.reason == row['reason'] and obs.attempt_ref == row['resolved_attempt_ref'],
                        'm04_decision_reconstruction')
                require(obs.original_sha256 == row['response_sha256']
                        and (None if r.original_bytes is None else len(r.original_bytes)) == row['response_length'],
                        'm04_response_reconstruction')
                require(sorted(book._blocked-blocked_before) == e['blocked_added'], 'm04_blocked_reconstruction')
                events[order] = row['event_ref']
        actual = [dict(scope=dict(environment=s['environment'],channel_profile=s['channel_profile'],
                 account_profile=s['account_profile']),phase=s['phase'],kind=s['id_type'],value=s['observed_value'],
                 attempt_ref=s['attempt_ref'],event_ref=s['event_ref'],response_sha256=s['response_sha256'],claims_hash=s['claims_hash'])
                 for s in state['services']]
        require(service_rows(book, events) == sorted(actual,key=lambda x:canonical(x)), 'm04_service_reconstruction')
        return book, events

    def recover(self):
        db = self.connect()
        try:
            db.query('begin isolation level read committed')
            # Single state function invocation supplies one committed MVCC cut.
            state = self._state(db)
            book, events = self._restore(db, state)
            db.query('commit')
            return dict(state=state, book=book, events=events,
                        response_revalidated=True, external_ack_performed=False, real_receipt_adapter=False)
        except Exception:
            db.query('rollback'); raise
        finally: db.close()

    def freeze_attempt(self, proof):
        require(type(proof) is ProofInput, 'm04_store_proof_input')
        require(proof.bridge._pin == self.bridge._pin and proof.bridge._secret == self.bridge._secret,
                'm04_store_fixed_synthetic_verifier_profile')
        # Scope and original W11 expectation are frozen; identity comes from a
        # real independent proof read, not from an invented caller attempt ID.
        db = self.connect()
        try:
            db.query('begin isolation level read committed')
            signed, stored = self._load(db, json.loads(proof.expectation_bytes), proof.bridge)
            ref = stored['bundle']['input']['context']['envelope']['attempt_ref']
            self._prepare(AttemptBook(), signed, stored, proof.scope, proof.bridge)
            db.query('commit')
            return FrozenOperation('ATTEMPT',ref,proof.scope,proof=proof)
        except Exception:
            db.query('rollback'); raise
        finally: db.close()

    def freeze_response(self, response, prior_event_ref=None):
        if prior_event_ref is not None: uid(prior_event_ref)
        raw = canonical(encode_response(response))
        return FrozenOperation('RESPONSE',response.observation_ref,response.scope,response_bytes=raw,
                               prior_event_ref=prior_event_ref)

    def _gate(self, db, op):
        require(type(op) is FrozenOperation, 'm04_store_operation')
        claim = None if op.kind == 'ATTEMPT' else json.loads(op.response_bytes)['attempt_ref']
        return self._call(db,'m04_gate_v1',[self.profile,self.authority,op.kind,op.identity,
            json.dumps(asdict(op.scope)),claim],['uuid','uuid','text','uuid','jsonb','uuid'])

    def in_transaction(self, db, op):
        """Caller owns TX only for private crash/concurrency harness. No commit here."""
        ticket = self._gate(db,op)
        state = self._state(db)  # Separate statement AFTER all lock waits.
        book, events = self._restore(db,state)
        seq = self._call(db,'m04_order_next_v1',[],[])
        book._order = seq-1
        payload = dict(contract=CONTRACT,codec=CODEC,kind=op.kind,event_ref=str(uuid4()),
            event_order=seq,external_ack_performed=False,real_receipt_adapter=False,new_services=[])
        before_services = set(book._owners)
        blocked_before = set(book._blocked)
        if op.kind == 'ATTEMPT':
            p = op.proof; expected = json.loads(p.expectation_bytes)
            signed, stored = self._load(db,expected,p.bridge)
            old_count = len(book.attempt_events)
            d = self._prepare(book,signed,stored,p.scope,p.bridge)
            new_event = len(book.attempt_events)>old_count
            a = book.attempt_events[-1][2] if new_event else d.attempt
            source = dict(physical_proof_id=expected['proof_id'],binding=binding(a),expectation=expected,
                observation=stored['observation'],observation_mac=stored['observation_mac'])
            source['revalidated_mac'] = p.bridge._mac(db,['m04-proof/1',source['observation'],source['binding'],expected])[2:]
            payload.update(source=source,new_event=new_event,input_fingerprint=sha(canonical(source['binding'])))
            payload['involved_attempts']=[op.identity] if d.status is Status.CONFLICT else []
        else:
            r = decode_response(json.loads(op.response_bytes)); old_count = len(book.observations)
            payload['involved_attempts']=involved_attempts(book,r)
            d = book.observe(r); new_event = len(book.observations)>old_count
            payload.update(input=encode_response(r),new_event=new_event,
                prior_event_ref=op.prior_event_ref,
                input_fingerprint=sha(canonical(dict(response=encode_response(r),prior_event_ref=op.prior_event_ref))),
                resolved_attempt_ref=d.observation.attempt_ref)
            if new_event:
                events[d.observation.order] = payload['event_ref']
                payload['new_services'] = [x for x in service_rows(book,events)
                    if (Scope(**x['scope']),Phase(x['phase']),x['kind'],x['value']) not in before_services]
            else: payload['replay_event_ref'] = events[d.observation.order]
        payload.update(status=d.status.value,reason=d.reason,blocked_added=sorted(book._blocked-blocked_before),
                       observed_order=d.observation.order if d.observation else None)
        mac = self.bridge._mac(db,['m04-decision/1',ticket['challenge'],payload])
        result = self._call(db,'m04_write_v1',[json.dumps(ticket),json.dumps(payload),mac,self.bridge._secret],
                           ['jsonb','jsonb','bytea','text'])
        require(result['external_ack_performed'] is False and result['real_receipt_adapter'] is False,'m04_store_ack_boundary')
        return dict(decision=d,commit=result,operation=op)

    def commit(self, op):
        db = self.connect()
        try:
            db.query('begin isolation level read committed')
            try: result = self.in_transaction(db,op)
            except Exception:
                db.query('rollback'); raise
            try: db.query('commit')
            except Exception as exc: raise StoreCommitUnknown(op) from exc
            result['attempt_committed' if op.kind=='ATTEMPT' else 'response_committed'] = True
            return result
        finally: db.close()

    def resolve(self, op):
        """Independent read after obtaining the same identity gate: no blind retry."""
        db = self.connect()
        try:
            db.query('begin isolation level read committed')
            self._gate(db,op)  # Waits until any previous transaction releases its gate.
            state=self._state(db);book,events=self._restore(db,state)
            if op.kind=='RESPONSE':
                request=decode_response(json.loads(op.response_bytes))
                obs=book._seen.get(request)
                if obs is not None:
                    historical=next(j for j in state['journal'] if j['event_ref']==events[obs.order])
                    require(historical['prior_event_ref']==op.prior_event_ref,'m04_resolve_changed_history_link')
                result = dict(found=obs is not None,observation=obs,
                              event_ref=events.get(obs.order) if obs else None)
                if obs is None:
                    require(request.observation_ref not in book._by_ref,'m04_resolve_different_input')
            else:
                p=op.proof;signed,stored=self._load(db,json.loads(p.expectation_bytes),p.bridge)
                canonical_attempt=book._attempts.get(op.identity)
                probe=AttemptBook();probe._order=(canonical_attempt.prepared_order-1) if canonical_attempt else 0
                candidate=self._prepare(probe,signed,stored,p.scope,p.bridge).attempt
                matches=[a for _,_,a in book.attempt_events if a==candidate]
                require(not canonical_attempt or matches,'m04_resolve_different_attempt')
                result=dict(found=bool(matches),attempt=canonical_attempt)
            db.query('commit')
            return result
        except Exception:
            db.query('rollback');raise
        finally:db.close()


def source_hashes():
    """New store binding only; never rewrites W11Bridge.SOURCES/history."""
    return {n:sha(Path(__file__).with_name(n).read_bytes())
            for n in ('m04_response_store.py','m04_attempt_response.py')}
