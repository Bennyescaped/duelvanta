"""V141 T01-T30. Inert synthetic metadata, no key/certificate generation.

The M04 test value is a frozen boundary fixture, not a newly signed envelope or
M02/W11 verification claim. Existing M02/V132 verification has separate tests.
Run directly: python tests/psttg_wire/test_m03_trust_profile.py
"""
import ast
from contextlib import ExitStack
from dataclasses import FrozenInstanceError, replace
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
import builtins
import io
import os
import socket
import subprocess
import sys
from threading import Barrier, Event, Thread
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from psttg_wire import m03_trust_profile as m
from psttg_wire.m04_attempt_response import AttemptBinding, ProofReference, Scope

NOW = datetime(2026, 10, 1, 12, tzinfo=timezone.utc)
BEFORE = NOW - timedelta(days=1)
AFTER = NOW + timedelta(days=1)


def r(n): return '00000000-0000-4000-8000-' + format(n, '012x')
def v(n, revision=1): return m.Version(r(n), revision)


def fixture(role=m.Role.SIGNATURE_TRUST, offset=0, account=6):
    access = m.AccessScope(m.Environment.TEST, r(1), v(2), r(3), r(4), r(5), r(account), r(7))
    scope = m.UsageScope(access, role, m.Purpose.DAC7_REFERENCE)
    p = m.TrustProfile(v(100+offset), scope,
        v(110+offset) if role is m.Role.SIGNATURE_TRUST else None,
        v(120+offset) if role is m.Role.TRANSPORT_AUTH else None,
        r(130+offset), v(140+offset), v(150+offset), v(160+offset),
        r(170+offset), r(180+offset), r(190+offset), BEFORE, 1)
    algorithm = {m.Role.SIGNATURE_TRUST:m.Algorithm.XML_PSS,
                 m.Role.TRANSPORT_AUTH:m.Algorithm.JWT_RS256,
                 m.Role.PORTAL_ACCESS:m.Algorithm.PORTAL_METADATA}[role]
    c = m.CredentialReference(v(200+offset), r(210+offset), p.identity, scope,
        v(220+offset), r(230), r(240+offset), v(250+offset), v(260+offset),
        algorithm, p.signature_profile_revision or p.transport_auth_profile_revision or v(270+offset),
        BEFORE, AFTER, r(280+offset), 1)
    cell = m.ReferenceCell(scope)
    assert cell.register(p) is m.Result.BOUND
    assert cell.register(c) is m.Result.BOUND
    evs = evidence(p, c, 1000+offset*20)
    for e in evs: assert cell.register(e) is m.Result.BOUND
    e = event(cell, c, m.EventKind.ACTIVATED, r(300+offset), evs[-1].evidence_ref)
    assert cell.lifecycle(e) is m.Result.BOUND
    return cell, p, c


def evidence(p, c, base):
    result = []
    for i, kind in enumerate((m.EvidenceKind.TRUST, m.EvidenceKind.REGISTRATION,
            m.EvidenceKind.ENTITLEMENT, m.EvidenceKind.STATUS, m.EvidenceKind.VALIDITY,
            m.EvidenceKind.REVOCATION, m.EvidenceKind.ROTATION, m.EvidenceKind.ALGORITHM,
            m.EvidenceKind.ACTIVATION)):
        eid = {m.EvidenceKind.REGISTRATION:p.registration_evidence_ref,
               m.EvidenceKind.ENTITLEMENT:p.m2m_entitlement_ref}.get(kind, r(base+i))
        policy = {m.EvidenceKind.VALIDITY:p.validity_policy,
                  m.EvidenceKind.REVOCATION:p.revocation_policy,
                  m.EvidenceKind.ROTATION:p.rotation_policy,
                  m.EvidenceKind.ALGORITHM:c.use_profile}.get(kind)
        subject = {m.EvidenceKind.TRUST:p.trust_anchor_ref,
                   m.EvidenceKind.ALGORITHM:c.public_identifier}.get(kind)
        result.append(m.EvidenceReference(eid, kind, v(802), p.scope,
            None if kind in (m.EvidenceKind.REGISTRATION, m.EvidenceKind.ENTITLEMENT) else c.identity,
            p.identity, BEFORE, BEFORE, AFTER, r(801), policy, subject,
            endpoint_profile=v(800) if kind is m.EvidenceKind.ALGORITHM and p.scope.role is m.Role.TRANSPORT_AUTH else None,
            channel_profile=r(460) if kind is m.EvidenceKind.ALGORITHM and p.scope.role is m.Role.TRANSPORT_AUTH else None))
    return tuple(result)


def context(c): return m.UseContext(c.trust_profile, c.identity, c.scope, c.use_algorithm, c.use_profile)


def evaluate(cell, c, at=NOW, ctx=None, revision=None):
    s = cell.snapshot
    return m.evaluate_usage(s, ctx or context(c), at, s.revision if revision is None else revision, r(900))


def event(cell, c, kind, eid=r(999), source=None, at=NOW, effective=NOW):
    s = cell.snapshot
    if source is None:
        source = next(e.evidence_ref for e in s.evidence if e.kind is m.EvidenceKind.STATUS and e.credential == c.identity)
    return m.LifecycleEvidence(eid, c.identity, c.trust_profile, c.scope, kind, at,
        (s.lifecycle[-1].observed_order if s.lifecycle else 0)+1, effective, source, s.revision, s.active)


def proposal(cell, p, c, n=1):
    new = replace(c, identity=v(10000+n, c.identity.revision+1), opaque_locator=v(11000+n),
                  predecessor=c.identity, created_order=c.created_order+1)
    evs = evidence(p, new, 12000+n*100)
    ev = event(cell, new, m.EventKind.ACTIVATED, r(13000+n), evs[-1].evidence_ref)
    return new, evs, ev


def attempt(n=0):
    raw = b'SYNTHETIC M03 BOUNDARY VALUE - NOT A SIGNATURE OR REAL PROOF'
    proof = ProofReference(r(400+n), r(410+n), r(420+n), 1, r(430+n),
                           'ab'*32, sha256(raw).hexdigest())
    return AttemptBinding(proof, r(440+n), r(450+n), 'SYNTHETIC-MESSAGE',
                          ('SYNTHETIC-DOC',), raw, Scope('TEST', r(460), r(6)),
                          'SYNTHETIC-TICKET', '7', 1)


def witness(cell, c, a, n=0):
    e = m.EvidenceReference(r(500+n), m.EvidenceKind.SIGNED_BINDING, v(800), c.scope,
                           c.identity, c.trust_profile, BEFORE, BEFORE, AFTER, r(801),
                           subject_ref=c.public_identifier, attempt=a)
    assert cell.register(e) is m.Result.BOUND


def request(sig, transport, sc, tc, a, n=0, at=NOW):
    return m.AccessRequest(a, context(sc), context(tc), r(460), v(800),
                           sig.snapshot.revision, transport.snapshot.revision,
                           r(600+n), r(700+n), at)


def pair():
    s, sp, sc = fixture()
    t, tp, tc = fixture(m.Role.TRANSPORT_AUTH, 100)
    a = attempt(); witness(s, sc, a)
    return s, t, sp, tp, sc, tc, a, m.AccessBook(s, t)


class ContractTests(unittest.TestCase):
    def assertBlocked(self, d, reason=None):
        self.assertIsNot(d.result, m.State.ELIGIBLE_LOCAL)
        if reason: self.assertIn(reason, d.reasons)

    def test_T01_complete_synthetic_eligible(self):
        cell, p, c = fixture(); d = evaluate(cell, c)
        self.assertIs(d.result, m.State.ELIGIBLE_LOCAL)
        self.assertEqual(d.reasons, ())
        self.assertEqual(len(d.evidence_refs), 8)
        self.assertFalse(d.real_use_authorized or d.real_authentication_performed or d.external_ack_performed)
        with self.assertRaises(FrozenInstanceError): c.status = m.State.DISABLED

    def test_T02_roles_separate(self):
        s,t,sp,tp,sc,tc,a,book = pair()
        result,b = book.admit(request(s,t,sc,tc,a))
        self.assertIs(result, m.Result.BOUND)
        self.assertNotEqual(b.signature_decision.context.profile, b.transport_decision.context.profile)
        self.assertNotEqual(sc.identity, tc.identity)

    def test_T03_wrong_role(self):
        cell,p,c = fixture()
        for role in (m.Role.PORTAL_ACCESS, m.Role.TRANSPORT_AUTH):
            self.assertBlocked(evaluate(cell,c,ctx=replace(context(c),scope=replace(c.scope,role=role))))
        s,t,sp,tp,sc,tc,a,book = pair()
        with self.assertRaises(m.Rejected): book.admit(replace(request(s,t,sc,tc,a),transport=context(sc)))

    def test_T04_environment(self):
        cell,p,c = fixture()
        for env in (m.Environment.SYNTHETIC_OTHER, m.Environment.OFFICIAL_INTEGRATION):
            ctx = replace(context(c),scope=replace(c.scope,access=replace(c.scope.access,environment=env)))
            self.assertBlocked(evaluate(cell,c,ctx=ctx), 'SCOPE_MISMATCH')

    def test_T05_operator_organization_reporting(self):
        cell,p,c = fixture()
        for field in ('operator_ref','organization_ref','reporting_entity_ref'):
            ctx=replace(context(c),scope=replace(c.scope,access=replace(c.scope.access,**{field:r(9999)})))
            self.assertBlocked(evaluate(cell,c,ctx=ctx), 'SCOPE_MISMATCH')

    def test_T06_account_null(self):
        cell,p,c = fixture()
        for field in ('account_ref','provider_account_ref'):
            for value in (None,r(9999)):
                ctx=replace(context(c),scope=replace(c.scope,access=replace(c.scope.access,**{field:value})))
                self.assertBlocked(evaluate(cell,c,ctx=ctx))

    def test_T07_unknown_reference_revision(self):
        cell,p,c = fixture()
        for changes in ({'profile':v(9999)}, {'profile':replace(p.identity,revision=2)},
                        {'credential':v(9999)}, {'credential':replace(c.identity,revision=2)}):
            self.assertBlocked(evaluate(cell,c,ctx=replace(context(c),**changes)))

    def test_T08_time_boundaries(self):
        cell,p,c=fixture()
        self.assertIs(evaluate(cell,c,NOW).result,m.State.ELIGIBLE_LOCAL)
        self.assertBlocked(evaluate(cell,c,AFTER),'EXPIRED')
        self.assertBlocked(evaluate(cell,c,AFTER+timedelta(seconds=1)),'EXPIRED')
        self.assertBlocked(evaluate(cell,c,BEFORE-timedelta(microseconds=1)),'NOT_YET_VALID')
        # Credential equality at not_before; observation/activation has occurred.
        snap=cell.snapshot; active=snap.lifecycle[-1]
        snap=replace(snap,lifecycle=(replace(active,observed_at=BEFORE,effective_at=BEFORE),))
        self.assertIs(m.evaluate_usage(snap,context(c),BEFORE,snap.revision,r(901)).result,m.State.ELIGIBLE_LOCAL)

    def test_T09_revocation_block_stale(self):
        cell,p,c=fixture(); old=cell.snapshot
        self.assertIs(cell.lifecycle(event(cell,c,m.EventKind.REVOKED,effective=None)),m.Result.BOUND)
        self.assertBlocked(evaluate(cell,c),'REVOKED')
        self.assertBlocked(evaluate(cell,c,revision=old.revision),'REVISION_CONFLICT')
        cell,p,c=fixture(); snap=cell.snapshot
        stale=replace(snap,evidence=tuple(replace(e,effective_until=NOW) if e.kind is m.EvidenceKind.STATUS else e for e in snap.evidence))
        self.assertBlocked(m.evaluate_usage(stale,context(c),NOW,stale.revision,r(902)),'STATUS_UNRESOLVED')
        s,t,sp,tp,sc,tc,a,book=pair()
        domain=m.ReferenceDomain((s,t))
        blocks=tuple(m.EvidenceReference(r(910+i),m.EvidenceKind.ACCOUNT_BLOCK,v(800),c.scope,c.identity,
            c.trust_profile,NOW,BEFORE,AFTER,r(801)) for i,c in enumerate((sc,tc)))
        domain.block_account(sc.scope.access,blocks)
        self.assertBlocked(evaluate(s,sc),'ACCESS_DISABLED'); self.assertBlocked(evaluate(t,tc),'ACCESS_DISABLED')

    def test_T10_superseded(self):
        cell,p,c=fixture(); new,evs,ev=proposal(cell,p,c)
        self.assertIs(cell.rotate(new,evs,ev),m.Result.BOUND)
        self.assertBlocked(evaluate(cell,c),'SUPERSEDED')
        self.assertIs(evaluate(cell,new).result,m.State.ELIGIBLE_LOCAL)

    def test_T11_explicit_rotation(self):
        cell,p,c=fixture(); old=cell.snapshot; new,evs,ev=proposal(cell,p,c)
        self.assertEqual(cell.snapshot,old)
        self.assertIs(cell.rotate(new,evs,ev),m.Result.BOUND)
        self.assertIs(cell.snapshot.credentials[0],c)
        self.assertEqual(cell.snapshot.active,new.identity)
        self.assertEqual(cell.snapshot.lifecycle[:len(old.lifecycle)],old.lifecycle)

    def test_T12_history_after_rotation_expiry(self):
        s,t,sp,tp,sc,tc,a,book=pair(); req=request(s,t,sc,tc,a)
        _,b=book.admit(req); before=(a,b)
        t.rotate(*proposal(t,tp,tc))
        self.assertBlocked(evaluate(t,tc,AFTER),'EXPIRED')
        self.assertEqual((a,book.bindings[0]),before)
        self.assertEqual(book.bindings[0].request.transport.credential,tc.identity)

    def test_T13_two_successors_controlled_threads(self):
        cell,p,c=fixture(); a=proposal(cell,p,c,1); b=proposal(cell,p,c,2)
        barrier=Barrier(2); first_done=Event(); outcomes=[]; errors=[]
        def worker(proposal,first):
            try:
                barrier.wait(timeout=5)
                if not first: self.assertTrue(first_done.wait(5))
                outcomes.append(cell.rotate(*proposal))
                if first: first_done.set()
            except BaseException as exc: errors.append(exc); first_done.set()
        threads=[Thread(target=worker,args=(a,True)),Thread(target=worker,args=(b,False))]
        for th in threads: th.start()
        for th in threads: th.join(5); self.assertFalse(th.is_alive())
        self.assertEqual(errors,[])
        self.assertEqual(outcomes,[m.Result.BOUND,m.Result.REVISION_CONFLICT])
        self.assertEqual(cell.snapshot.active,a[0].identity)
        self.assertIsNone(m.one(cell.snapshot.credentials,b[0].identity))
        print('T13 TRACE: shared expected revision; barrier; A=BOUND; A releases event; B=REVISION_CONFLICT; one successor')

    def test_T14_attempt_before_after_rotation(self):
        s,t,sp,tp,sc,tc,a,book=pair()
        old_req=request(s,t,sc,tc,a); _,old=book.admit(old_req)
        new,evs,ev=proposal(t,tp,tc); t.rotate(new,evs,ev)
        b=attempt(1); witness(s,sc,b,1)
        stale=replace(old_req,attempt=b)
        with self.assertRaises(m.Rejected): book.admit(stale)
        _,fresh=book.admit(request(s,t,sc,new,b,1))
        self.assertEqual(old.request.transport.credential,tc.identity)
        self.assertEqual(fresh.request.transport.credential,new.identity)
        self.assertEqual((old.admission_order,fresh.admission_order),(1,2))
        print('T14 TRACE: admit generation 1/order 1; rotate to 2; stale admission rejected; admit generation 2/order 2')

    def test_T15_unknown_unchanged(self):
        s,t,sp,tp,sc,tc,a,book=pair(); _,b=book.admit(request(s,t,sc,tc,a))
        unknown=(a.proof.attempt_ref,m.Observation.UNKNOWN,a.transfer_ticket)
        t.rotate(*proposal(t,tp,tc)); s.lifecycle(event(s,sc,m.EventKind.REVOKED,effective=None))
        self.assertEqual(unknown,(a.proof.attempt_ref,m.Observation.UNKNOWN,a.transfer_ticket))
        self.assertEqual(book.bindings,(b,)); self.assertIs(b.auth_observation_ref,m.Observation.NOT_OBSERVED)

    def test_T16_secret_rejection_redaction(self):
        _,p,c=fixture()
        secrets=('-----BEGIN PRIVATE KEY-----SECRET', 'PFX:SECRET', 'PKCS#12:SECRET',
                 'password=SECRET','PIN=1234','Bearer SECRET','access_token=SECRET',
                 'client_secret=SECRET','${SECRET_ENV}','https://example.invalid/SECRET',
                 '/private/key.pem','1','',b'SECRET')
        for raw in secrets:
            for build in (lambda:m.Version(raw,1),lambda:replace(c,public_identifier=raw),
                          lambda:replace(c,opaque_locator=raw),lambda:replace(p,provenance=raw)):
                with self.assertRaises(m.Rejected) as exc: build()
                self.assertIn(str(exc.exception),('REFERENCE_CODEC','TYPE_CODEC'))
                self.assertNotIn('SECRET',str(exc.exception))

    def test_T17_real_always_forbidden(self):
        cell,p,c=fixture()
        for env in (m.Environment.OFFICIAL_INTEGRATION,m.Environment.PRODUCTION):
            sc=replace(c.scope,access=replace(c.scope.access,environment=env))
            snap=replace(cell.snapshot,scope=sc,profiles=(replace(p,scope=sc),),
                credentials=(replace(c,scope=sc),),evidence=tuple(replace(e,scope=sc) for e in cell.snapshot.evidence),
                lifecycle=tuple(replace(e,scope=sc) for e in cell.snapshot.lifecycle))
            self.assertBlocked(m.evaluate_usage(snap,replace(context(c),scope=sc),NOW,snap.revision,r(903)),
                               'REAL_PROFILE_FORBIDDEN')

    def test_T18_forbidden_io(self):
        source=Path(m.__file__).read_text()
        imports=[]
        for node in ast.walk(ast.parse(source)):
            if isinstance(node,ast.Import): imports.extend(n.name for n in node.names)
            if isinstance(node,ast.ImportFrom): imports.append(node.module)
        self.assertEqual(set(imports),{'dataclasses','datetime','enum','hashlib','threading','contextlib','m04_attempt_response'})
        def deny(*args,**kwargs): raise AssertionError('FORBIDDEN_IO')
        with ExitStack() as stack:
            for obj,name in ((builtins,'open'),(io,'open'),(socket,'socket'),(socket,'getaddrinfo'),
                             (subprocess,'Popen'),(os,'system'),(os,'getenv')):
                stack.enter_context(patch.object(obj,name,deny))
            # Existing transitive dependencies are forbidden to act, not reused.
            for name in ('sign_test','verify_signature','check_pin','_sign_signed_info'):
                stack.enter_context(patch('psttg_wire.signature_profile.'+name,deny))
            stack.enter_context(patch('psttg_wire.signed_validation.validate_bound_projection',deny))
            stack.enter_context(patch.dict(os.environ,{},clear=True))
            s,t,sp,tp,sc,tc,a,book=pair()
            _,b=book.admit(request(s,t,sc,tc,a)); t.rotate(*proposal(t,tp,tc))
            self.assertFalse(b.external_ack_performed or b.real_receipt_adapter)
            # Canary proves the boundary itself, with no real operation.
            for op in (lambda:open('forbidden'),lambda:socket.socket(),lambda:subprocess.Popen(['forbidden'])):
                with self.assertRaisesRegex(AssertionError,'FORBIDDEN_IO'): op()

    def test_T19_replay(self):
        s,t,sp,tp,sc,tc,a,book=pair()
        revision=s.snapshot.revision
        self.assertIs(s.register(sp),m.Result.REPLAY); self.assertIs(s.register(sc),m.Result.REPLAY)
        self.assertEqual(s.snapshot.revision,revision)
        req=request(s,t,sc,tc,a); _,b=book.admit(req)
        status,replayed=book.admit(req)
        self.assertIs(status,m.Result.REPLAY); self.assertIs(replayed,b)

    def test_T20_conflict_sticky(self):
        cell,p,c=fixture(); old=cell.snapshot
        self.assertIs(cell.register(replace(c,opaque_locator=v(9999))),m.Result.CONFLICT)
        self.assertEqual(cell.snapshot.credentials,old.credentials)
        self.assertBlocked(evaluate(cell,c),'IDENTITY_CONFLICT')
        s,t,sp,tp,sc,tc,a,book=pair(); req=request(s,t,sc,tc,a); _,b=book.admit(req)
        result,prior=book.admit(replace(req,endpoint_profile=v(9999)))
        self.assertIs(result,m.Result.CONFLICT); self.assertIs(prior,b)
        self.assertEqual(book.conflicts,(a.proof.attempt_ref,))

    def test_T21_missing_evidence(self):
        cell,p,c=fixture()
        for kind in (m.EvidenceKind.TRUST,m.EvidenceKind.REGISTRATION,m.EvidenceKind.ENTITLEMENT):
            s=replace(cell.snapshot,evidence=tuple(e for e in cell.snapshot.evidence if e.kind is not kind))
            self.assertBlocked(m.evaluate_usage(s,context(c),NOW,s.revision,r(904)),kind.value+'_UNRESOLVED')
        other_scope=replace(c.scope,purpose=m.Purpose.PORTAL_REFERENCE)
        s=replace(cell.snapshot,evidence=tuple(replace(e,scope=other_scope) if e.kind is m.EvidenceKind.TRUST else e for e in cell.snapshot.evidence))
        self.assertBlocked(m.evaluate_usage(s,context(c),NOW,s.revision,r(905)),'SCOPE_MISMATCH')

    def test_T22_fingerprint_not_role_identity(self):
        s,t,sp,tp,sc,tc,a,book=pair(); self.assertEqual(sc.public_identifier,tc.public_identifier)
        self.assertNotEqual(sc.identity,tc.identity)
        self.assertBlocked(evaluate(t,tc,ctx=context(sc)))
        # No signature witness for a second attempt, despite equal fingerprint.
        with self.assertRaisesRegex(m.Rejected,'SIGNATURE_ASSOCIATION_UNRESOLVED'):
            book.admit(request(s,t,sc,tc,attempt(1)))

    def test_T23_pss_not_rs256(self):
        cell,p,c=fixture(m.Role.TRANSPORT_AUTH,100)
        self.assertBlocked(evaluate(cell,c,ctx=replace(context(c),use_algorithm=m.Algorithm.XML_PSS)),
                           'ROLE_PURPOSE_PROFILE_MISMATCH')
        self.assertBlocked(evaluate(cell,c,ctx=replace(context(c),use_profile=c.certificate_signature_profile)),
                           'ROLE_PURPOSE_PROFILE_MISMATCH')

    def test_T24_late_retroactive_revocation(self):
        cell,p,c=fixture(); d=evaluate(cell,c); old=cell.snapshot
        e=event(cell,c,m.EventKind.REVOKED,at=NOW+timedelta(hours=1),effective=BEFORE)
        cell.lifecycle(e)
        self.assertEqual(e.effective_at,BEFORE); self.assertGreater(e.observed_at,e.effective_at)
        self.assertIs(d.result,m.State.ELIGIBLE_LOCAL)
        self.assertEqual(old.credentials,cell.snapshot.credentials)
        self.assertBlocked(evaluate(cell,c,NOW+timedelta(hours=1)),'REVOKED')

    def test_T25_time_revision_types(self):
        cell,p,c=fixture()
        for n in (True,False,1.0,0,-1,'1',None,1<<63):
            with self.assertRaises(m.Rejected): m.Version(r(1),n)
        for at in (None,NOW.replace(tzinfo=None),NOW.astimezone(timezone(timedelta(hours=1)))):
            with self.assertRaises(m.Rejected): evaluate(cell,c,at)
        with self.assertRaises(m.Rejected): replace(c,not_after=c.not_before)
        for field in ('not_before','not_after'):
            s=replace(cell.snapshot,credentials=(replace(c,**{field:None}),))
            self.assertBlocked(m.evaluate_usage(s,context(c),NOW,s.revision,r(906)),'TIME_UNRESOLVED')

    def test_T26_cycles(self):
        cell,p,c=fixture()
        with self.assertRaises(m.Rejected): replace(c,predecessor=c.identity)
        with self.assertRaises(m.Rejected): replace(p,successor=p.identity)
        with self.assertRaises(m.Rejected): cell.register(replace(c,identity=v(9999,2),predecessor=v(9998)))
        with self.assertRaises(m.Rejected): cell.register(replace(c,identity=v(9999,2),predecessor=c.identity,successor=v(9998)))
        self.assertEqual(cell.snapshot.credentials,(c,))

    def test_T27_independent_scopes_progress(self):
        a,p,c=fixture(); b,q,d=fixture(m.Role.TRANSPORT_AUTH,100,account=8)
        before=a.snapshot; done=Event(); errors=[]
        def progress():
            try: self.assertIs(b.rotate(*proposal(b,q,d)),m.Result.BOUND)
            except BaseException as exc: errors.append(exc)
            finally: done.set()
        # Hold A throughout B: completion demonstrates no global store gate.
        with a._gate:
            th=Thread(target=progress); th.start(); self.assertTrue(done.wait(5))
            self.assertEqual(a.snapshot,before)
        th.join(5); self.assertFalse(th.is_alive()); self.assertEqual(errors,[])
        print('T27 TRACE: scope A gate held; scope B activation completes; scope A snapshot unchanged; release A')

    def test_T28_m04_side_binding_exact(self):
        s,t,sp,tp,sc,tc,a,book=pair(); original=a
        _,b=book.admit(request(s,t,sc,tc,a))
        self.assertIs(b.request.attempt,original)
        self.assertEqual(b.request.attempt.item_position,'7')
        self.assertEqual(b.signed_length,len(a.signed_bytes))
        for bad in (replace(a,item_position='0'),replace(a,signed_bytes=b'changed'),
                    replace(a,scope=Scope('TEST',r(460),None))):
            with self.assertRaises(m.Rejected):
                m.bind_access(request(s,t,sc,tc,bad),s.snapshot,t.snapshot,2)

    def test_T29_auth_not_observed(self):
        s,t,sp,tp,sc,tc,a,book=pair(); _,b=book.admit(request(s,t,sc,tc,a))
        self.assertIs(b.auth_attempt_ref,m.Observation.NOT_OBSERVED)
        self.assertIs(b.auth_observation_ref,m.Observation.NOT_OBSERVED)
        self.assertFalse(b.transport_decision.real_authentication_performed)
        self.assertFalse(b.external_ack_performed)

    def test_T30_no_durability(self):
        s,t,sp,tp,sc,tc,a,book=pair(); book.admit(request(s,t,sc,tc,a))
        fresh=m.ReferenceCell(sc.scope)
        self.assertEqual(fresh.snapshot.credentials,())
        self.assertBlocked(evaluate(fresh,sc),'CREDENTIAL_UNRESOLVED')
        self.assertEqual(m.AccessBook(s,t).bindings,())


class CodecTests(unittest.TestCase):
    def test_closed_shapes_and_booleans(self):
        _,p,c=fixture()
        for changes in ({'scope':{}},{'use_algorithm':'JWT_RS256'},{'opaque_locator':{}},
                        {'status':m.State.ELIGIBLE_LOCAL}):
            with self.assertRaises(m.Rejected): replace(c,**changes)
        with self.assertRaises(TypeError): replace(c,verified=True)
        with self.assertRaises(m.Rejected): m.Snapshot(c.scope,profiles=[p])
        cell,p,c=fixture(); d=evaluate(cell,c)
        with self.assertRaises(m.Rejected): replace(d,evidence_refs=list(d.evidence_refs))
        with self.assertRaises(m.Rejected): replace(d,reasons=('Bearer SECRET',))

    def test_forged_decision_not_capability(self):
        s,t,sp,tp,sc,tc,a,book=pair()
        d=evaluate(t,tc); t.lifecycle(event(t,tc,m.EventKind.DISABLED))
        self.assertIs(d.result,m.State.ELIGIBLE_LOCAL)
        with self.assertRaises(m.Rejected): book.admit(request(s,t,sc,tc,a))

    def test_duplicate_snapshot_and_failed_rotation_rollback(self):
        cell,p,c=fixture(); s=cell.snapshot
        bad=replace(s,credentials=(c,replace(c,opaque_locator=v(9999))))
        self.assertIsNot(m.evaluate_usage(bad,context(c),NOW,bad.revision,r(907)).result,m.State.ELIGIBLE_LOCAL)
        new,evs,ev=proposal(cell,p,c)
        with self.assertRaises(m.Rejected): cell.rotate(new,evs[:-1],ev)
        self.assertEqual(cell.snapshot,s)
        bad=replace(s,lifecycle=(replace(s.lifecycle[0],expected_active=v(9999)),))
        self.assertIn('IDENTITY_CONFLICT',m.evaluate_usage(bad,context(c),NOW,bad.revision,r(908)).reasons)


if __name__ == '__main__':
    unittest.main(verbosity=2)
