"""V144 A01-A36: deterministic, inert ports; no real persistence/transport.

Uses V143's existing metadata fixture builders, not its unittest cases. The
byte fixture is intentionally NOT a cryptographic signature/W11 commit proof.
Separate unchanged upstream regressions retain their own verification scope.
"""
import ast
import builtins
from contextlib import ExitStack
from dataclasses import FrozenInstanceError, fields, replace
from datetime import timedelta
import io
import os
from pathlib import Path
import pickle
import socket
import sqlite3
import subprocess
import sys
from threading import Barrier, Event as ThreadEvent, Thread
import unittest
from unittest.mock import patch

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from psttg_wire import m04_transport_state as k
from psttg_wire import test_m03_trust_profile as f
from psttg_wire import m03_trust_profile as m

r,v,NOW=f.r,f.v,f.NOW
RAW=b'<synthetic><item position="7"/><Signature>INERT-TEST</Signature></synthetic>'


def setup(n=0, phase=k.Phase.UPLOAD):
    sig,sp,sc=f.fixture()
    trans,tp,tc=f.fixture(m.Role.TRANSPORT_AUTH,100)
    a=f.attempt(n)
    a=replace(a,proof=replace(a.proof,signed_sha256=k.digest(RAW)),signed_bytes=RAW,
              message_ref='SYNTHETIC-MESSAGE-'+str(n),transfer_ticket='SYNTHETIC-TICKET-'+str(n))
    f.witness(sig,sc,a)
    access=f.request(sig,trans,sc,tc,a)
    method,target={k.Phase.UPLOAD:(k.Method.PUT,k.Target.UPLOAD),
                   k.Phase.PROTOCOL:(k.Method.GET,k.Target.PROTOCOL),
                   k.Phase.NN:(k.Method.GET,k.Target.NN),
                   k.Phase.ACK:(k.Method.PATCH,k.Target.ACK)}[phase]
    body=RAW if phase is k.Phase.UPLOAD else None
    req=k.RequestBinding(r(20000+n),access,phase,method,target,r(21000+n),body,
                         k.digest(body) if body is not None else None,
                         len(body) if body is not None else None,1)
    witness=k.AttemptWitness(a,r(22000+n),r(23000+n),r(24000+n),r(25000+n))
    return req,witness,sig,trans,sc,tc,tp


def cell_for(data, book=None):
    req,witness,sig,trans,sc,tc,tp=data
    book=book or k.CorrelationBook((req,))
    return k.RequestCell(req,witness,sig,trans,book),book


def started(data=None):
    data=data or setup(); cell,book=cell_for(data)
    cell.commit_request(r(30001),NOW)
    d=cell.admit(NOW); assert d.code is k.Code.ALLOWED_SYNTHETIC
    result=cell.dispatch(d.admission,k.CredentialResolverPort(data[5]),r(30002),NOW)
    assert result.code is k.Code.ALLOWED_SYNTHETIC
    return data,cell,book


def capture(req,n=0,raw=b'SYNTHETIC-RESPONSE',complete=k.Completeness.COMPLETE,code=200):
    return k.RawResponseCapture(r(31000+n),req.request_ref,req.attempt_ref,req.scope,req.phase,
        raw,None if raw is None else k.digest(raw),None if raw is None else len(raw),
        complete,None if raw is None else code,1,NOW,r(32000+n))


def port(req,c,kind=k.ReceiptKind.DIP_OK,ids=None,claims=None):
    return k.ReceiptAdapterPort(c.capture_ref,c.raw,v(33000),v(34000),v(35000),kind,
        claims if claims is not None else (
            k.Claim(k.ClaimKind.ORIGINAL_TICKET,req.attempt.transfer_ticket,r(36000)),
            k.Claim(k.ClaimKind.ITEM,req.attempt.item_position,r(36001))),
        ids if ids is not None else (k.ServiceID(k.ServiceKind.RESPONSE_TICKET,'SYNTHETIC-RESPONSE-ID'),))


def complete(data=None,kind=k.ReceiptKind.DIP_OK):
    data,cell,book=started(data)
    c=capture(data[0]); cell.capture(c,r(30003))
    saved=cell.commit_capture(c.capture_ref,k.ResponseCapturePort(k.Commit.CONFIRMED,r(30004)),r(30005),NOW)
    i=cell.parse(port(data[0],c,kind))
    row=book.correlate(saved,i)
    return data,cell,book,saved,i,row


def ack_witnesses(c):
    return tuple(k.AckWitness(r(40000+j),stage,c.request_ref,c.capture_ref,c.raw_sha256,c.scope)
                 for j,stage in enumerate(k.AckStage))


class ContractTests(unittest.TestCase):
    def test_A01_missing_attempt_proof(self):
        data=list(setup()); data[1]=None
        cell,_=cell_for(data)
        self.assertEqual(cell.admit(NOW).reason,k.Reason.MISSING_WITNESS)
        data=list(setup()); data[1]=replace(data[1],attempt=f.attempt(1))
        self.assertEqual(cell_for(data)[0].admit(NOW).reason,k.Reason.BYTE_BINDING)

    def test_A02_no_real_port(self):
        data=list(setup()); req=data[0]
        real=replace(req.access.transport.scope.access,environment=m.Environment.PRODUCTION)
        data[0]=replace(req,access=replace(req.access,transport=replace(req.access.transport,
                          scope=replace(req.access.transport.scope,access=real))))
        self.assertEqual(cell_for(data)[0].admit(NOW).code,k.Code.BLOCKED)
        _,cell,_=started()
        class ExecutablePort:
            def send(self): raise AssertionError('must never run')
        with self.assertRaises(k.Rejected): cell.step(ExecutablePort(),r(30100),NOW)
        self.assertFalse(hasattr(k,'RealTransportPort'))

    def test_A03_exact_request_bytes(self):
        data=setup(); req=data[0]; cell,_=cell_for(data)
        d=cell.admit(NOW)
        self.assertEqual(d.code,k.Code.ALLOWED_SYNTHETIC)
        self.assertEqual((req.body,req.body_sha256,req.body_length,req.proof_ref),
                         (data[1].attempt.signed_bytes,req.signed_sha256,req.signed_length,data[1].attempt.proof.proof_id))
        self.assertEqual(req.attempt.item_position,'7')
        self.assertEqual(req.attempt.proof.edition_binding,data[1].attempt.proof.edition_binding)

    def test_A04_transform_reject(self):
        variations=(RAW+b' ',RAW.replace(b'/>',b' />'),RAW.decode().encode('utf-16'),
                    b'<wrapper>'+RAW+b'</wrapper>',b'BASE64-PHNjcmlwdD4=',b'PK\x03\x04'+RAW,
                    b'--multipart\r\n'+RAW,RAW.replace(b'<Signature>INERT-TEST</Signature>',b''))
        for raw in variations:
            with self.subTest(raw_length=len(raw)):
                data=list(setup()); data[0]=replace(data[0],body=raw,body_sha256=k.digest(raw),body_length=len(raw))
                self.assertEqual(cell_for(data)[0].admit(NOW).reason,k.Reason.BYTE_BINDING)

    def test_A05_ephemeral_resolver_handle(self):
        data,cell,_=started(); resolver=k.CredentialResolverPort(data[5])
        h=resolver.resolve(data[5].identity)
        self.assertNotIn(data[5].identity.ref,repr(h))
        with self.assertRaises(k.Rejected): pickle.dumps(h)
        self.assertNotIn('AuthHandle',repr(cell.history))
        self.assertFalse(any(field.name in ('token','password','secret','pem') for field in fields(h)))

    def test_A06_scope_roles_endpoint(self):
        for name in ('environment','operator_ref','account_ref','provider_account_ref'):
            data=list(setup()); req=data[0]; old=req.access.transport.scope
            value=m.Environment.SYNTHETIC_OTHER if name=='environment' else r(45000)
            changed=replace(old,access=replace(old.access,**{name:value}))
            data[0]=replace(req,access=replace(req.access,transport=replace(req.access.transport,scope=changed)))
            self.assertEqual(cell_for(data)[0].admit(NOW).code,k.Code.BLOCKED)
        for name,value in (('role',m.Role.PORTAL_ACCESS),('purpose',m.Purpose.PORTAL_REFERENCE)):
            data=list(setup()); req=data[0]
            ctx=replace(req.access.transport,scope=replace(req.access.transport.scope,**{name:value}))
            data[0]=replace(req,access=replace(req.access,transport=ctx))
            self.assertEqual(cell_for(data)[0].admit(NOW).code,k.Code.BLOCKED)
        for change in ({'endpoint_profile':v(800,2)},{'channel_profile':r(45001)}):
            data=list(setup()); data[0]=replace(data[0],access=replace(data[0].access,**change))
            self.assertEqual(cell_for(data)[0].admit(NOW).code,k.Code.BLOCKED)

    def test_A07_lifecycle_and_evidence(self):
        data=setup(); self.assertEqual(cell_for(data)[0].admit(f.AFTER).code,k.Code.BLOCKED)
        for kind in (m.EventKind.REVOKED,m.EventKind.DISABLED,m.EventKind.EXTERNAL_UNRESOLVED):
            data=setup(); data[3].lifecycle(f.event(data[3],data[5],kind,r(45100)))
            self.assertEqual(cell_for(data)[0].admit(NOW).code,k.Code.BLOCKED)
        data=setup(); t=data[3]; t._snapshot=replace(t.snapshot,evidence=tuple(e for e in t.snapshot.evidence if e.kind is not m.EvidenceKind.ENTITLEMENT))
        self.assertEqual(cell_for(data)[0].admit(NOW).code,k.Code.BLOCKED)
        data=setup(); t=data[3]; t.rotate(*f.proposal(t,data[6],data[5]))
        self.assertEqual(cell_for(data)[0].admit(NOW).code,k.Code.BLOCKED)

    def test_A08_rotation_before_dispatch(self):
        data=setup(); cell,_=cell_for(data); cell.commit_request(r(30001),NOW)
        d=cell.admit(NOW); t=data[3]
        self.assertEqual(t.rotate(*f.proposal(t,data[6],data[5])),m.Result.BOUND)
        result=cell.dispatch(d.admission,k.CredentialResolverPort(data[5]),r(30002),NOW)
        self.assertEqual(result.code,k.Code.BLOCKED)
        self.assertFalse(any(e.kind is k.Event.SEND_STARTED for e in cell.history.events))
        # Revocation is the same gate, not a separate unsynchronized flag.
        data=setup(); cell,_=cell_for(data); cell.commit_request(r(30001),NOW); d=cell.admit(NOW)
        data[3].lifecycle(f.event(data[3],data[5],m.EventKind.REVOKED,r(45200)))
        self.assertEqual(cell.dispatch(d.admission,k.CredentialResolverPort(data[5]),r(30002),NOW).code,k.Code.BLOCKED)

    def test_A09_concurrent_dispatch_CAS(self):
        data=setup(); cell,_=cell_for(data); cell.commit_request(r(30001),NOW)
        a=cell.admit(NOW).admission; b=cell.admit(NOW).admission
        barrier=Barrier(3); first_done=ThreadEvent(); result=[]; errors=[]
        def worker(first, admission, eid):
            try:
                barrier.wait(5)
                if not first: self.assertTrue(first_done.wait(5))
                d=cell.dispatch(admission,k.CredentialResolverPort(data[5]),eid,NOW)
                result.append((first,d.code))
            except BaseException as exc: errors.append(exc)
            finally:
                if first: first_done.set()
        threads=(Thread(target=worker,args=(True,a,r(30002))),Thread(target=worker,args=(False,b,r(30003))))
        for t in threads: t.start()
        barrier.wait(5)
        for t in threads: t.join(5); self.assertFalse(t.is_alive())
        self.assertEqual(errors,[])
        self.assertEqual(result,[(True,k.Code.ALLOWED_SYNTHETIC),(False,k.Code.STALE_REVISION)])
        self.assertEqual(sum(e.kind is k.Event.SEND_STARTED for e in cell.history.events),1)
        # A second cell cannot duplicate the same request in the same domain.
        data=setup(); book=k.CorrelationBook((data[0],))
        one,_=cell_for(data,book); two,_=cell_for(data,book)
        one.commit_request(r(30201),NOW); two.commit_request(r(30202),NOW)
        da,db=one.admit(NOW).admission,two.admit(NOW).admission
        self.assertEqual(one.dispatch(da,k.CredentialResolverPort(data[5]),r(30203),NOW).code,k.Code.ALLOWED_SYNTHETIC)
        self.assertEqual(two.dispatch(db,k.CredentialResolverPort(data[5]),r(30204),NOW).code,k.Code.CONFLICT)
        self.assertEqual(len(book.dispatches),1)

    def test_A10_auth_failure_unknown(self):
        for outcome,state in ((k.PortOutcome.FAILURE,k.State.TRANSPORT_FAILED),(k.PortOutcome.UNKNOWN,k.State.UNKNOWN)):
            data=setup(); cell,_=cell_for(data); cell.commit_request(r(30001),NOW)
            d=cell.dispatch(cell.admit(NOW).admission,k.CredentialResolverPort(data[5],outcome),r(30002),NOW)
            self.assertEqual(d.state,state); self.assertEqual(d.effect,k.Effect.NOT_DISPATCHED_PROVEN)
            self.assertFalse(any(e.kind is k.Event.SEND_STARTED for e in cell.history.events))

    def test_A11_tls_connect_preserve_unknown(self):
        for error in (k.Error.TLS_FAILURE,k.Error.CONNECT_FAILURE):
            _,cell,_=started()
            cell.step(k.TransportPort(k.Event.TIMEOUT,k.Error.TIMEOUT_UNKNOWN),r(30003),NOW)
            p=cell.step(k.TransportPort(k.Event.FAILURE,error),r(30004),NOW)
            self.assertEqual(p.state,k.State.UNKNOWN); self.assertTrue(p.unknown_seen)
            self.assertIn(error,p.errors)

    def test_A12_timeout_unknown(self):
        _,cell,_=started()
        p=cell.step(k.TransportPort(k.Event.TIMEOUT,k.Error.TIMEOUT_UNKNOWN),r(30003),NOW)
        self.assertEqual(p.state,k.State.UNKNOWN)
        self.assertEqual(k.recover(cell.history).auto_retry,'AUTO_RETRY_FORBIDDEN')

    def test_A13_crash_before_start(self):
        cell,_=cell_for(setup()); cell.interrupt(k.Event.CRASH,r(30001),NOW)
        d=k.recover(cell.history)
        self.assertEqual(d.effect,k.Effect.NOT_DISPATCHED_PROVEN)
        self.assertEqual(d.action,k.RecoveryAction.FRESH_ADMISSION)

    def test_A14_crash_after_start(self):
        _,cell,_=started(); cell.interrupt(k.Event.CRASH,r(30003),NOW)
        d=k.recover(cell.history); self.assertEqual(d.state,k.State.UNKNOWN)
        self.assertEqual(d.action,k.RecoveryAction.PRESERVE_UNKNOWN)

    def test_A15_write_complete_not_acceptance(self):
        _,cell,_=started(); p=cell.step(k.TransportPort(k.Event.WRITE_COMPLETE),r(30003),NOW)
        self.assertEqual(p.progress,k.Progress.LOCAL_WRITE_COMPLETE)
        self.assertEqual(p.effect,k.Effect.REMOTE_EFFECT_UNKNOWN)
        self.assertEqual(cell.history.interpretations,())

    def test_A16_response_lost_before_commit(self):
        data,cell,_=started(); cell.capture(capture(data[0]),r(30003))
        cell.interrupt(k.Event.LOST_RESPONSE,r(30004),NOW)
        d=k.recover(cell.history)
        self.assertEqual(d.state,k.State.UNKNOWN); self.assertEqual(d.raw_captures,())
        self.assertEqual(d.presence,k.Presence.POSSIBLY_LOST)

    def test_A17_raw_null_empty_fragment(self):
        for raw,extent in ((None,k.Completeness.ABSENT),(b'',k.Completeness.COMPLETE),(b'\x00\xff\r\n',k.Completeness.FRAGMENT)):
            data,cell,_=started(); c=capture(data[0],raw=raw,complete=extent)
            cell.capture(c,r(30003))
            saved=cell.commit_capture(c.capture_ref,k.ResponseCapturePort(k.Commit.CONFIRMED,r(30004)),r(30005),NOW)
            self.assertEqual(saved.raw,raw)
            self.assertEqual(saved.length,None if raw is None else len(raw))
            if extent is not k.Completeness.COMPLETE:
                p=port(data[0],capture(data[0],raw=b'') if raw is None else c)
                with self.assertRaisesRegex(k.Rejected,'PARSE_BEFORE_COMMIT'): cell.parse(p)

    def test_A18_capture_before_parser(self):
        data,cell,_=started(); c=capture(data[0]); p=port(data[0],c)
        with self.assertRaises(k.Rejected): cell.parse(p)
        cell.capture(c,r(30003))
        with self.assertRaises(k.Rejected): cell.parse(p)
        cell.commit_capture(c.capture_ref,k.ResponseCapturePort(k.Commit.UNKNOWN,r(30004)),r(30005),NOW)
        with self.assertRaises(k.Rejected): cell.parse(p)
        cell.commit_capture(c.capture_ref,k.ResponseCapturePort(k.Commit.CONFIRMED,r(30004)),r(30006),NOW)
        with self.assertRaises(k.Rejected): cell.parse(replace(p,kind=k.ReceiptKind.PARSER_CRASH))
        first=cell.parse(p); self.assertEqual(first,cell.parse(p))
        self.assertEqual(len(cell.history.interpretations),1)

    def test_A19_resolve_same_local_commit(self):
        data,cell,_=started(); c=capture(data[0]); cell.capture(c,r(30003))
        cell.commit_capture(c.capture_ref,k.ResponseCapturePort(k.Commit.UNKNOWN,r(30004)),r(30005),NOW)
        independent=replace(c,commit=k.Commit.CONFIRMED,commit_ref=r(30004))
        saved=cell.resolve_capture(c.capture_ref,independent,r(30006),r(30007),NOW)
        self.assertEqual(saved,independent)
        self.assertEqual(sum(e.kind is k.Event.SEND_STARTED for e in cell.history.events),1)
        changed=replace(independent,raw=b'OTHER',raw_sha256=k.digest(b'OTHER'),length=5)
        with self.assertRaises(k.Rejected): cell.resolve_capture(c.capture_ref,changed,r(30008),r(30009),NOW)

    def test_A20_replay(self):
        _,cell,book,c,i,row=complete()
        self.assertEqual(row.decision,k.Code.ALLOWED_SYNTHETIC)
        self.assertEqual(book.correlate(c,i).decision,k.Code.REPLAY)
        self.assertEqual(len(book.entries),1)
        c2=replace(c,capture_ref=r(31999),commit_ref=r(30999),received_order=2)
        i2=replace(i,capture_ref=c2.capture_ref)
        self.assertEqual(book.correlate(c2,i2).decision,k.Code.REPLAY)

    def test_A21_delayed_old_attempt(self):
        old,_,_,c,i,_=complete(setup(0)); newer=setup(1)[0]
        book=k.CorrelationBook((old[0],newer))
        row=book.correlate(c,i)
        self.assertEqual(row.resolved_attempt,old[0].attempt_ref)
        self.assertNotEqual(row.resolved_attempt,newer.attempt_ref)

    def test_A22_swapped_responses(self):
        old,_,_,c,i,_=complete(setup(0)); new=setup(1)[0]
        book=k.CorrelationBook((old[0],new))
        swapped=replace(i,claims=(k.Claim(k.ClaimKind.ORIGINAL_TICKET,new.attempt.transfer_ticket,r(36000)),k.Claim(k.ClaimKind.ITEM,'7',r(36001))))
        row=book.correlate(c,swapped)
        self.assertEqual(row.decision,k.Code.CONFLICT)
        self.assertEqual(book.blocked,{old[0].attempt_ref,new.attempt_ref})

    def test_A23_scoped_id_sticky_conflict(self):
        data,cell,book,c,i,_=complete()
        c2=replace(c,capture_ref=r(31999),raw=b'CHANGED',raw_sha256=k.digest(b'CHANGED'),length=7)
        i2=replace(i,capture_ref=c2.capture_ref,raw_sha256=c2.raw_sha256)
        row=book.correlate(c2,i2)
        self.assertEqual(row.decision,k.Code.CONFLICT)
        self.assertEqual(book.entries[0].capture,c)
        self.assertEqual(book.correlate(c,i).decision,k.Code.CONFLICT)
        self.assertEqual(cell.admit(NOW).code,k.Code.CONFLICT)
        self.assertEqual(k.recover(cell.history,blocked_attempts=tuple(book.blocked)).action,k.RecoveryAction.BLOCK_CONFLICT)
        # Claims and alternative attempts are conflicts even with equal bytes.
        new=setup(1)[0]; separate=k.CorrelationBook((data[0],new)); separate.correlate(c,i)
        c3=replace(c,capture_ref=r(31998),request_ref=new.request_ref,attempt_ref=new.attempt_ref)
        i3=replace(i,capture_ref=c3.capture_ref,claims=(k.Claim(k.ClaimKind.ORIGINAL_TICKET,new.attempt.transfer_ticket,r(36000)),i.claims[1]))
        self.assertEqual(separate.correlate(c3,i3).decision,k.Code.CONFLICT)
        self.assertEqual(separate.correlate(c3,i3).decision,k.Code.CONFLICT)

    def test_A24_missing_ambiguous_wrong_scope(self):
        data,_,_,c,i,_=complete(); req=data[0]
        bad=(replace(i,service_ids=()),replace(i,claims=()),
             replace(i,claims=(i.claims[0],k.Claim(k.ClaimKind.ITEM,'0',r(36001)))),
             replace(i,service_ids=i.service_ids+(k.ServiceID(k.ServiceKind.RESPONSE_TICKET,'OTHER'),)))
        for bad_i in bad:
            book=k.CorrelationBook((req,))
            self.assertEqual(book.correlate(c,bad_i).decision,k.Code.UNRESOLVED)
            replay=book.correlate(c,bad_i)
            self.assertEqual(replay.decision,k.Code.UNRESOLVED)
            self.assertFalse(k.ack_decision(replay,ack_witnesses(c),book).eligible_local)
        for account in (None,r(45999)):
            self.assertEqual(k.CorrelationBook((req,)).correlate(replace(c,scope=replace(c.scope,account_profile=account)),i).decision,k.Code.UNRESOLVED)

    def test_A25_parser_reject_formats(self):
        data,cell,_,c,_,_=complete()
        for kind in (k.ReceiptKind.FOREIGN_NAMESPACE,k.ReceiptKind.INVALID_ZIP,k.ReceiptKind.UNKNOWN_STATUS,k.ReceiptKind.PARTIAL_UNPROVEN):
            i=cell.parse(port(data[0],c,kind))
            self.assertEqual(i.fact,k.Fact.UNKNOWN); self.assertEqual(i.reason,k.Reason.PARSE_REJECT)
            self.assertEqual(cell.history.captures[-1].raw,c.raw)

    def test_A26_http_success_fach_reject(self):
        _,_,_,c,i,row=complete(kind=k.ReceiptKind.DIP_ERROR)
        self.assertEqual(c.http_status,200); self.assertEqual(i.fact,k.Fact.REJECTED_SYNTHETIC)
        self.assertEqual(row.decision,k.Code.ALLOWED_SYNTHETIC)

    def test_A27_dip_ok_without_dsm(self):
        data,cell,book,c,i,row=complete()
        self.assertEqual(i.fact,k.Fact.ACCEPTED_SYNTHETIC)
        self.assertFalse(any(x.kind is k.ServiceKind.DSM_MESSAGE for x in i.service_ids))
        self.assertEqual(row.decision,k.Code.ALLOWED_SYNTHETIC)
        unknown=cell.parse(port(data[0],c,k.ReceiptKind.PARTIAL_UNPROVEN))
        self.assertEqual(k.CorrelationBook((data[0],)).correlate(c,unknown).decision,k.Code.UNRESOLVED)

    def test_A28_cross_phase_no_alias(self):
        data,_,_,c,i,_=complete(); other=setup(1,k.Phase.NN)[0]
        book=k.CorrelationBook((data[0],other)); book.correlate(c,i)
        c2=replace(c,capture_ref=r(31999),request_ref=other.request_ref,attempt_ref=other.attempt_ref,phase=other.phase)
        i2=replace(i,capture_ref=c2.capture_ref,claims=(k.Claim(k.ClaimKind.ORIGINAL_TICKET,other.attempt.transfer_ticket,r(36000)),k.Claim(k.ClaimKind.ITEM,'7',r(36001))))
        self.assertEqual(book.correlate(c2,i2).decision,k.Code.ALLOWED_SYNTHETIC)
        self.assertNotEqual(k.ServiceKind.DSM_MESSAGE.value,k.ClaimKind.ORIGINAL_MESSAGE.value)
        self.assertFalse(any(x.value=='consignmentItemPosition' for x in k.ServiceKind))

    def test_A29_unknown_no_new_operations(self):
        data,cell,_=started(); cell.step(k.TransportPort(k.Event.TIMEOUT),r(30003),NOW)
        before=cell.history; d=k.recover(before)
        self.assertFalse(d.new_attempt or d.new_ticket or d.new_signature)
        self.assertEqual(d.auto_retry,'AUTO_RETRY_FORBIDDEN'); self.assertEqual(cell.history,before)
        self.assertIn(cell.admit(NOW).code,(k.Code.BLOCKED,k.Code.CONFLICT))

    def test_A30_full_history_reconstruction(self):
        _,cell,_,_,_,_=complete(); frozen=cell.history
        self.assertEqual(k.recover(frozen),k.recover(pickle.loads(pickle.dumps(frozen))))
        self.assertFalse(k.recover(frozen).durable)
        self.assertEqual(k.recover(frozen).action,k.RecoveryAction.REPARSE_RAW)
        self.assertEqual(k.recover(frozen,interpretation_commit=k.Commit.UNKNOWN).action,k.RecoveryAction.RESOLVE_LOCAL_COMMIT)
        cell.interrupt(k.Event.CRASH,r(30999),NOW)
        self.assertEqual(k.recover(cell.history).state,k.State.RESPONSE_COMMITTED)
        with self.assertRaises(k.Rejected): k.recover(replace(frozen,events=frozen.events[1:]))

    def test_A31_ack_missing_lost(self):
        _,_,book,c,_,row=complete(); witnesses=ack_witnesses(c)
        for j in range(7):
            d=k.ack_decision(row,witnesses[:j]+witnesses[j+1:],book)
            self.assertEqual(d.state,k.AckState.ACK_NOT_ELIGIBLE); self.assertFalse(d.eligible_local)
        self.assertEqual(k.ack_decision(row,witnesses,book,confirmation=k.Commit.UNKNOWN).state,k.AckState.ACK_UNKNOWN)
        self.assertEqual(k.ack_decision(row,witnesses,book).state,k.AckState.ACK_ELIGIBLE_LOCAL)
        self.assertFalse(k.ack_decision(row,witnesses,book).external_ack_performed)

    def test_A32_reject_ack_not_acceptance(self):
        _,_,book,c,i,row=complete(kind=k.ReceiptKind.DIP_ERROR)
        d=k.ack_decision(row,ack_witnesses(c),book,confirm_synthetic=True)
        self.assertEqual(d.state,k.AckState.ACK_CONFIRMED_SYNTHETIC)
        self.assertEqual(d.fact,k.Fact.REJECTED_SYNTHETIC)
        self.assertFalse(d.external_ack_performed or d.real_receipt_adapter)

    def test_A33_no_m05(self):
        data=setup(); req=data[0]
        self.assertEqual(req.attempt,data[1].attempt)
        self.assertFalse(any(x.name in ('tax_due','seller_identity','threshold','producer_admission','correction_required') for x in fields(req)))
        self.assertFalse(hasattr(k,'decide_reporting_duty'))

    def test_A34_forbidden_io(self):
        source=Path(k.__file__).read_text(); tree=ast.parse(source)
        allowed={'contextlib','dataclasses','datetime','enum','hashlib','threading',None,'m04_attempt_response'}
        for node in ast.walk(tree):
            if isinstance(node,ast.Import): self.fail('unbounded import')
            if isinstance(node,ast.ImportFrom): self.assertIn(node.module,allowed)
            if isinstance(node,ast.Call) and isinstance(node.func,ast.Name):
                self.assertNotIn(node.func.id,('open','eval','exec','compile','__import__'))
        self.assertNotIn('://',source)
        from psttg_wire import signature_profile, signed_validation, security, envelope
        def forbidden(*args,**kwargs): raise AssertionError('FORBIDDEN_IO_CANARY')
        with ExitStack() as stack:
            targets=((builtins,'open'),(io,'open'),(socket,'socket'),(socket,'create_connection'),
                     (socket,'getaddrinfo'),(subprocess,'Popen'),(subprocess,'run'),(os,'system'),
                     (os,'getenv'),(sqlite3,'connect'),(signature_profile,'sign_test'),
                     (signature_profile,'_sign_signed_info'),
                     (signature_profile,'verify_signature'),(signed_validation,'validate_bound_projection'),
                     (envelope,'build_envelope'),(security.Schemas,'validate'))
            for obj,name in targets: self.assertTrue(hasattr(obj,name))
            for obj,name in targets: stack.enter_context(patch.object(obj,name,forbidden))
            stack.enter_context(patch.dict(os.environ,{},clear=True))
            for obj,name in targets:
                with self.assertRaisesRegex(AssertionError,'FORBIDDEN_IO_CANARY'): getattr(obj,name)()
            data,cell,book,c,i,row=complete()
            self.assertEqual(row.decision,k.Code.ALLOWED_SYNTHETIC)
            self.assertFalse(k.ack_decision(row,ack_witnesses(c),book,confirm_synthetic=True).external_ack_performed)
            self.assertEqual(k.recover(cell.history).action,k.RecoveryAction.REPARSE_RAW)
            # Run every other contractual branch with active canaries, not only
            # the happy path. This nested run is coverage, not 35 new case IDs.
            guarded=unittest.TestSuite(ContractTests(name) for name in
                unittest.defaultTestLoader.getTestCaseNames(ContractTests)
                if name!='test_A34_forbidden_io')
            result=unittest.TestResult(); guarded.run(result)
            self.assertEqual(result.testsRun,35)
            self.assertEqual(result.errors,[]); self.assertEqual(result.failures,[])
            self.assertEqual(result.skipped,[])

    def test_A35_existing_values_immutable(self):
        data=setup(); before=(data[0],data[1],data[2].snapshot,data[3].snapshot)
        _,cell,_,_,_,_=complete(data)
        self.assertEqual(before,(data[0],data[1],data[2].snapshot,data[3].snapshot))
        with self.assertRaises(FrozenInstanceError): data[0].body=b'changed'
        with self.assertRaises(FrozenInstanceError): cell.history.events[0].order=9
        self.assertEqual(data[0].access.attempt,data[1].attempt)

    def test_A36_fake_not_real(self):
        data,cell,book,c,_,row=complete()
        ack=k.ack_decision(row,ack_witnesses(c),book,confirm_synthetic=True)
        self.assertFalse(ack.external_ack_performed or ack.real_receipt_adapter or k.recover(cell.history).durable)
        d=cell_for(setup())[0].admit(NOW)
        self.assertFalse(d.real_use_authorized)
        self.assertEqual(d.admission.access.auth_attempt_ref,m.Observation.NOT_OBSERVED)
        self.assertEqual(d.admission.access.auth_observation_ref,m.Observation.NOT_OBSERVED)


class CodecTests(unittest.TestCase):
    def test_closed_types_and_redaction(self):
        data=setup(); req=data[0]
        for value in (True,1.0,0,-1,'1'):
            with self.assertRaises(k.Rejected): replace(req,order=value)
        for bad in ('https://synthetic.invalid','PEM PRIVATE KEY','Bearer CANARY','/credential/file'):
            with self.assertRaises(k.Rejected) as caught: replace(req,body_ref=bad)
            self.assertNotIn(bad,str(caught.exception))
        with self.assertRaises(k.Rejected): replace(req,observed_service_ids=[])
        with self.assertRaises(k.Rejected): capture(req,code=True)
        with self.assertRaises(k.Rejected): replace(capture(req),at=NOW.replace(tzinfo=None))
        with self.assertRaises(k.Rejected): replace(req,target='/free/path')

    def test_history_and_output_forgery(self):
        _,cell,book,c,i,row=complete()
        bad=replace(cell.history.events[-1],predecessor_revision=0)
        with self.assertRaises(k.Rejected): k.recover(replace(cell.history,events=cell.history.events[:-1]+(bad,)))
        with self.assertRaises(k.Rejected): replace(c,raw_sha256='00'*32)
        with self.assertRaises(k.Rejected): k.TransportDecision('ALLOWED_SYNTHETIC',k.Reason.SYNTHETIC_ONLY,k.State.PREPARED,k.Effect.NOT_DISPATCHED_PROVEN)
        witnesses=ack_witnesses(c)
        changed=replace(c,capture_ref=r(49000),raw=b'NEW',raw_sha256=k.digest(b'NEW'),length=3)
        book.correlate(changed,replace(i,capture_ref=changed.capture_ref,raw_sha256=changed.raw_sha256))
        self.assertFalse(k.ack_decision(row,witnesses,book).eligible_local)
        # Even forging REPLAY on historical UNRESOLVED cannot create eligibility.
        data,_,_,c,i,_=complete(); fresh=k.CorrelationBook((data[0],))
        unresolved=fresh.correlate(c,replace(i,service_ids=()))
        self.assertFalse(k.ack_decision(replace(unresolved,decision=k.Code.REPLAY),ack_witnesses(c),fresh).eligible_local)


if __name__=='__main__': unittest.main(verbosity=2)
