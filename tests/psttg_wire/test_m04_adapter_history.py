"""R01-R36: explicit native PG17 acceptance; default is NATIVE_NOT_RUN.

Local codec tests are named separately. Native tests never use Mock/PGlite.
The real disposable harness supplies independent backend connections and a
same-data-directory pg_ctl restart. No production endpoint is discoverable.
"""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from datetime import timedelta
import ast
from copy import deepcopy
import io
import json
from pathlib import Path
import subprocess
import sys
import threading
from time import monotonic
import unittest
from unittest.mock import patch
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'tests'))
from psttg_wire import m04_adapter_history as h
from psttg_wire import m04_history_codec as c
from psttg_wire import m04_transport_state as t
from psttg_wire import m03_trust_profile as m
from psttg_wire import m04_response_store as old
from psttg_wire import test_m04_response_store as p
from psttg_wire import test_m04_transport_state as a
from psttg_wire import test_m03_trust_profile as f
from psttg_wire.security import canonical, sha

NATIVE = '--native' in sys.argv
EVIDENCE = {}


class Database(p.NativeDatabase):
    def __init__(self):
        self.process = subprocess.Popen(['node', str(ROOT/'tests/helpers/m04-history-db-harness.mjs'), '--native'],
            cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=None, text=True, bufsize=1)
        line = self.process.stdout.readline()
        if not line: raise RuntimeError('V147 native PG17 harness unavailable')
        self.ready = json.loads(line); self._lock = threading.Lock(); self._pending = {}; self._id = 0
        self._reader = threading.Thread(target=self._read, daemon=True); self._reader.start()


class Local(unittest.TestCase):
    def test_transaction_payload_structure_only(self):
        # Explicit STRUCTURE DOUBLE: no W11 verification, database, COMMIT or
        # durability evidence. Check typed RQ/SE/RC/RI payloads and their links.
        request, _, sig, trans, *_ = a.setup()
        cut=h.Cut();cut.book._attempts[request.attempt_ref]=request.attempt
        cut.attachment={'event_ref':h.identity()}
        for snap in (sig.snapshot,trans.snapshot):
            cut.snapshots[canonical(c.encode(snap.scope))]=({'event_ref':h.identity()},snap)
        adapter=object.__new__(h.AdapterHistory);adapter.profile=h.identity();counter=[100]
        class MacShape:
            def _mac(self,db,value):return b'structure-only-never-submitted'
        adapter.bridge=MacShape()
        def gate(db,op):
            snapshot=deepcopy(cut);value=c.thaw(op.value,snapshot.book._attempts)
            return {'challenge':{'operation':adapter._gate_input(op,value,snapshot)}},{},snapshot,value
        def call(db,name,params,casts):
            if name=='m04_order_next_v1':counter[0]+=1;return counter[0]
            self.assertEqual(name,'m04_history_write_v1');return json.loads(params[1])
        adapter._gate_history=gate;adapter._call=call
        def shape(op):
            payload=adapter.in_transaction(None,op)
            for row in payload['rows']:adapter._apply(adapter._as_stored(row,adapter.profile),cut)
            return payload
        rq=shape(adapter.freeze_request(request,f.NOW))
        self.assertEqual([r['kind'] for r in rq['rows']],['REQUEST','SEND_EVIDENCE'])
        self.assertNotIn(request.body.hex(),json.dumps(rq['rows']))
        proj=t.advance(t.project(request,cut.histories[request.request_ref].events),t.Event.SEND_STARTED)
        ev=t.SendEvidence(h.identity(),request.request_ref,1,t.Event.SEND_STARTED,2,f.NOW,
            proj.progress,None,request.access.transport.credential,proj.effect)
        se=shape(adapter.freeze_send(ev,f.NOW,h.identity(),h.identity()))
        self.assertEqual(len(se['rows']),1);self.assertIn('fence_ref',se['rows'][0]['evidence'])
        capture=a.capture(request);rc=shape(adapter.freeze_capture(capture,f.NOW))
        self.assertEqual([r['kind'] for r in rc['rows']],['RAW_CAPTURE','SEND_EVIDENCE','SEND_EVIDENCE'])
        self.assertEqual(rc['rows'][0]['original_hex'],capture.raw.hex())
        self.assertNotIn(capture.raw.hex(),json.dumps(rc['rows'][0]['evidence']))
        port=a.port(request,capture)
        interpretation=t.ReceiptInterpretation(capture.capture_ref,capture.raw_sha256,port.parser_revision,
            port.schema_revision,port.policy_revision,port.claims,port.service_ids,t.Code.UNRESOLVED,
            t.Fact.ACCEPTED_SYNTHETIC,request.attempt.doc_refs,t.Reason.UNCORRELATED,t.Terminal.FINAL)
        ref=h.identity();ri=shape(h.operation('RECEIPT_INTERPRETATION',ref,(ref,interpretation),f.NOW))
        self.assertEqual(len(ri['new_services']),1)
        self.assertNotIn(capture.raw.hex(),json.dumps(ri['rows']))
        self.assertEqual(ri['rows'][0]['prior_event_ref'],rc['rows'][0]['event_ref'])
        for stage in (t.AckStage.REVALIDATED,t.AckStage.FINAL_UNDERSTOOD,t.AckStage.INTENT,t.AckStage.CONFIRMATION_COMMITTED):
            sources=tuple(sorted((ref_,row['commit_ref'],sha(canonical(row))) for ref_,row in cut.rows.items()))
            value=(stage,request.request_ref,capture.capture_ref,ref,capture.raw_sha256,capture.scope,sources)
            shape(h.operation('EVIDENCE_ASSERTION',h.identity(),value,f.NOW))
        adapter.recover=lambda:{'cut':cut}
        self.assertTrue(adapter.ack(ref).eligible_local)
        changed=replace(capture,raw=b'changed',raw_sha256=sha(b'changed'),length=7)
        conflict=shape(adapter.freeze_capture(changed,f.NOW))
        self.assertEqual([r['kind'] for r in conflict['rows']],['RAW_CAPTURE','ADAPTER_CONFLICT'])
        self.assertEqual(cut.captures[capture.capture_ref][1].raw,capture.raw)
        self.assertFalse(adapter.ack(ref).eligible_local)

    def test_closed_codec_and_original_reference(self):
        request, _, sig, trans, *_ = a.setup()
        attempts = {request.attempt_ref:request.attempt}
        for value in (request, sig.snapshot, trans.snapshot):
            raw = c.frozen(value)
            self.assertEqual(c.thaw(raw, attempts), value)
            self.assertNotIn(request.body.hex().encode(), raw)
        with self.assertRaises(ValueError): c.thaw(c.frozen(request), {})
        with self.assertRaises(ValueError): c.decode({'type':'caller.event','fields':{}}, {})
        for bad in (1.1, object(), t.AuthHandle(request.access.transport.credential)):
            with self.assertRaises(ValueError): c.encode(bad)

    def test_event_set_and_native_inventory(self):
        self.assertEqual(c.KINDS, {'ADAPTER_ATTACHMENT','REQUEST','SEND_EVIDENCE','M03_SNAPSHOT',
            'RAW_CAPTURE','RECEIPT_INTERPRETATION','EVIDENCE_ASSERTION','ADAPTER_CONFLICT'})
        methods = [n[5:8] for n in Native.__dict__ if n.startswith('test_R')]
        self.assertEqual(sorted(methods), ['R'+str(i).zfill(2) for i in range(1,37)])
        tree = ast.parse(Path(__file__).read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name.startswith('test_R'):
                self.assertGreater(len(node.body), 1, node.name)

    def test_m03_controlled_chain(self):
        cell, _, _ = f.fixture()
        s = cell.snapshot
        commands = s.profiles+s.credentials+s.evidence+s.lifecycle
        self.assertEqual(c.replay_m03(m.Snapshot(s.scope), commands), s)
        with self.assertRaises(ValueError): c.replay_m03(s, (True,))


@unittest.skipUnless(NATIVE, 'NATIVE_NOT_RUN')
class Native(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch.object(p, 'NativeDatabase', Database):
            p.Native.setUpClass.__func__(cls)
        EVIDENCE['runtime'] = cls.db.ready

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def setUp(self):
        self.profile = h.identity()
        self.store = h.AdapterHistory(self.profile, self.authority, self.proofs[0].bridge, self.db.connect)
        self.store.commit(self.store.freeze_attachment(f.NOW))
        self.req, self.sig, self.trans, self.sc, self.tc = self.request()

    def request(self, index=0, account=6):
        scope = p.Scope('TEST', f.r(460), f.r(account))
        result = self.store.commit(self.store.freeze_attempt(replace(self.proofs[index], scope=scope)))
        attempt = result['decision'].attempt
        sig, _, sc = f.fixture(account=account)
        trans, _, tc = f.fixture(m.Role.TRANSPORT_AUTH, 100, account=account)
        f.witness(sig, sc, attempt, index)
        for cell in (sig, trans):
            snap = cell.snapshot
            key = canonical(c.encode(snap.scope))
            cut = self.cut()
            previous = cut.snapshots.get(key)
            if previous:
                # A second Attempt adds only its new SIGNED_BINDING evidence.
                fresh = tuple(x for x in snap.evidence if x not in previous[1].evidence)
                if fresh:
                    self.store.commit(self.store.freeze_snapshot(h.identity(), snap.scope, previous[1].revision, fresh, f.NOW))
                cell._snapshot = self.cut().snapshots[key][1]
            else:
                commands = snap.profiles+snap.credentials+tuple(e for e in snap.evidence if e.kind is not m.EvidenceKind.SIGNED_BINDING)+snap.lifecycle
                commands += tuple(e for e in snap.evidence if e.kind is m.EvidenceKind.SIGNED_BINDING)
                self.store.commit(self.store.freeze_snapshot(h.identity(), snap.scope, 0, commands, f.NOW))
        access = f.request(sig, trans, sc, tc, attempt, index)
        req = t.RequestBinding(h.identity(), access, p.Phase.UPLOAD, t.Method.PUT, t.Target.UPLOAD,
                               h.identity(), attempt.signed_bytes, sha(attempt.signed_bytes), len(attempt.signed_bytes), 1)
        return req, sig, trans, sc, tc

    def cut(self): return self.store.recover()['cut']
    def state(self): return self.store.recover()['state']
    def rq(self, req=None):
        op = self.store.freeze_request(req or self.req, f.NOW)
        self.store.commit(op); return op

    def send(self, kind=t.Event.SEND_STARTED, req=None, commit=True):
        req = req or self.req; hist = self.cut().histories[req.request_ref]
        pr = t.project(req, hist.events)
        error = t.Error.TIMEOUT_UNKNOWN if kind is t.Event.TIMEOUT else None
        nxt = t.advance(pr, kind, error)
        ev = t.SendEvidence(h.identity(), req.request_ref, pr.revision, kind, pr.revision+1, f.NOW,
                            nxt.progress, error, req.access.transport.credential, nxt.effect)
        op = self.store.freeze_send(ev, f.NOW, h.identity() if kind is t.Event.SEND_STARTED else None,
                                    h.identity() if kind is t.Event.SEND_STARTED else None)
        if commit: self.store.commit(op)
        return op

    def raw(self, req=None, data=b'SYNTHETIC-RESPONSE', completeness=t.Completeness.COMPLETE, ref=None, commit=True):
        req = req or self.req
        cap = replace(a.capture(req, raw=data, complete=completeness), capture_ref=ref or h.identity())
        op = self.store.freeze_capture(cap, f.NOW)
        if commit: self.store.commit(op)
        return cap, op

    def complete(self, req=None, fact=t.ReceiptKind.DIP_OK, data=b'SYNTHETIC-RESPONSE'):
        req = req or self.req; self.rq(req); self.send(req=req); cap, _ = self.raw(req, data=data)
        ref = h.identity(); op = self.store.parse(cap.capture_ref, a.port(req, cap, kind=fact), ref, f.NOW)
        self.store.commit(op); return cap, ref, op

    def query(self, sql, params=None):
        db = self.db.connect()
        try: return db.query(sql, params)
        finally: db.close()

    def lost(self, op):
        connect = self.store.connect
        class Lost:
            def __init__(self): self.db = connect()
            def query(self, sql, params=None):
                result = self.db.query(sql, params)
                if sql == 'commit': raise RuntimeError('synthetic lost database commit answer')
                return result
            def close(self): self.db.close()
        self.store.connect = Lost
        try:
            with self.assertRaises(h.CommitUnknown) as caught: self.store.commit(op)
            self.assertEqual(caught.exception.operation, op)
        finally: self.store.connect = connect
        self.assertTrue(self.store.resolve(op)['found'])

    def wait_blocked(self, pid):
        end = monotonic()+15
        while monotonic() < end:
            row = self.query('select cardinality(pg_blocking_pids($1)) n', [pid])[0]
            if row['n'] > 0: return
        self.fail('native blocking relation not observed')

    def test_R01_request_commit(self):
        self.rq(); cut = self.cut(); hist = cut.histories[self.req.request_ref]
        self.assertEqual(hist.request, self.req); self.assertEqual(len(hist.events), 1)
        self.assertIs(hist.events[0].kind, t.Event.LOCAL_COMMIT)

    def test_R02_request_replay(self):
        op = self.rq(); before = self.state(); self.assertTrue(self.store.commit(op)['replay'])
        self.assertEqual(self.state(), before)

    def test_R03_request_conflict(self):
        self.rq(); oldreq = self.cut().requests[self.req.request_ref]
        changed = replace(self.req, body_ref=h.identity())
        self.store.commit(self.store.freeze_request(changed, f.NOW))
        self.assertEqual(self.cut().requests[self.req.request_ref], oldreq)
        self.assertIn(self.req.attempt_ref, self.cut().blocked)

    def test_R04_byteidentity(self):
        for raw in (self.req.body+b' ', b' '+self.req.body, self.req.body.hex().encode(), b'',
                    b'<wrapper>'+self.req.body+b'</wrapper>', self.req.body.replace(b'\n',b'\r\n')+b'\r',
                    b'PK\x03\x04'+self.req.body, b'--multipart\r\n'+self.req.body):
            bad = replace(self.req, body=raw, body_sha256=sha(raw), body_length=len(raw))
            with self.assertRaises(ValueError): self.store.freeze_request(bad, f.NOW)
        before = self.state()
        broken = replace(self.req, access=replace(self.req.access, attempt=replace(self.req.attempt,
                            proof=replace(self.req.attempt.proof, proof_id=h.identity()))))
        with self.assertRaises(ValueError): self.store.commit(self.store.freeze_request(broken, f.NOW))
        self.assertEqual(self.state(), before)

    def test_R05_stale_m03(self):
        self.rq(); op = self.send(commit=False)
        event = f.event(self.trans, self.tc, m.EventKind.REVOKED)
        snap = self.trans.snapshot
        self.store.commit(self.store.freeze_snapshot(h.identity(), snap.scope, snap.revision, (event,), f.NOW))
        with self.assertRaises(ValueError): self.store.commit(op)
        self.assertEqual(self.cut().fences, {})

    def test_R06_concurrent_dispatch(self):
        self.rq(); other = replace(self.req, request_ref=h.identity())
        self.rq(other); left = self.send(commit=False); right = self.send(req=other, commit=False)
        db1 = self.db.connect(); db2 = self.db.connect()
        try:
            db1.query('begin'); db2.query('begin'); pid = db2.query('select pg_backend_pid() p')[0]['p']
            self.store.in_transaction(db1, left)
            with ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(self.store.in_transaction, db2, right)
                try: self.wait_blocked(pid)
                finally: db1.query('commit')
                with self.assertRaises(ValueError): future.result(timeout=20)
            db2.query('rollback'); self.assertEqual(len(self.cut().fences), 1)
        finally:
            db1.close(); db2.close()
        newcred,proofs,event=f.proposal(self.trans,f.m.one(self.trans.snapshot.profiles,self.tc.trust_profile),self.tc)
        self.store.commit(self.store.freeze_snapshot(h.identity(),self.trans.snapshot.scope,
            self.trans.snapshot.revision,((newcred,proofs,event),),f.NOW))
        latest=self.cut().snapshots[canonical(c.encode(self.trans.snapshot.scope))][1]
        rotated=replace(other,request_ref=h.identity(),access=replace(other.access,
            transport=f.context(newcred),transport_state_revision=latest.revision))
        self.rq(rotated)
        with self.assertRaises(ValueError):self.send(req=rotated)
        self.assertEqual(len(self.cut().fences),1)

    def test_R07_worker_crash(self):
        self.rq(); op = self.send(commit=False); db = self.db.connect(); db.query('begin')
        pid = db.query('select pg_backend_pid() p')[0]['p']; self.store.in_transaction(db, op)
        self.assertTrue(self.query('select pg_terminate_backend($1) killed', [pid])[0]['killed']); db.close()
        self.assertFalse(self.store.resolve(op)['found']); self.assertEqual(self.cut().fences, {})
        self.lost(op); self.assertEqual(len(self.cut().fences), 1)
        self.assertFalse(self.store.commit(op)['dispatch_authorized'])

    def test_R08_send_append_only(self):
        self.rq(); self.send(); before = self.state()
        for sql in ('update dv_market_private.m04_journal_v1 set reason=reason where store_profile=$1',
                    'delete from dv_market_private.m04_journal_v1 where store_profile=$1'):
            with self.assertRaises(Exception): self.query(sql, [self.profile])
        self.assertEqual(self.state(), before)
        with self.assertRaises(ValueError): self.send()
        valid=self.send(t.Event.WRITE_COMPLETE,commit=False)
        event,_,_=c.thaw(valid.value,self.cut().book._attempts)
        for bad in (replace(event,predecessor_revision=0),replace(event,credential=f.v(99999))):
            with self.assertRaises(ValueError):self.store.commit(self.store.freeze_send(bad,f.NOW))
        self.assertEqual(self.state(),before)

    def test_R09_timeout_unknown(self):
        self.rq(); self.send(); self.send(t.Event.TIMEOUT)
        d = self.store.recover()['recovery'][self.req.request_ref]
        self.assertIs(d.state, t.State.UNKNOWN); self.assertEqual(d.auto_retry, 'AUTO_RETRY_FORBIDDEN')

    def test_R10_observed_before_commit(self):
        self.rq(); self.send(); self.send(t.Event.RESPONSE_OBSERVED)
        cap, _ = self.raw(commit=False)
        with self.assertRaises(ValueError): self.store.parse(cap.capture_ref, a.port(self.req,cap), h.identity(), f.NOW)
        self.assertEqual(self.cut().interpretations, {})

    def test_R11_raw_commit(self):
        self.rq(); self.send(); cap, op = self.raw(data=b'\x00\xffexact\r\n')
        row, actual = self.cut().captures[cap.capture_ref]
        self.assertEqual(actual.raw, cap.raw); self.assertEqual(row['response_sha256'], sha(cap.raw))
        self.assertEqual(row['response_length'], len(cap.raw)); self.assertTrue(self.store.resolve(op)['found'])

    def test_R12_raw_replay(self):
        self.rq(); self.send(); _, op = self.raw(); before = self.state()
        self.assertTrue(self.store.commit(op)['replay']); self.assertEqual(before,self.state())

    def test_R13_raw_conflict(self):
        self.rq(); self.send(); cap, _ = self.raw(); before = self.cut().captures[cap.capture_ref]
        self.raw(data=b'changed', ref=cap.capture_ref)
        self.assertEqual(self.cut().captures[cap.capture_ref],before)
        self.assertIn(self.req.attempt_ref,self.cut().blocked)

    def test_R14_null_empty_fragment(self):
        self.rq(); self.send()
        for raw, complete in ((None,t.Completeness.ABSENT),(b'',t.Completeness.COMPLETE),(b'part',t.Completeness.FRAGMENT)):
            cap, _ = self.raw(data=raw,completeness=complete)
            actual=self.cut().captures[cap.capture_ref][1];self.assertEqual(actual.raw,raw)
            self.assertIs(actual.completeness,complete)
            if complete is not t.Completeness.COMPLETE:
                with self.assertRaises(ValueError): self.store.parse(cap.capture_ref,a.port(self.req,replace(cap,raw=b'',raw_sha256=sha(b''),length=0,completeness=t.Completeness.COMPLETE)),h.identity(),f.NOW)

    def test_R15_raw_lost_result(self):
        self.rq();self.send();_,op=self.raw(commit=False);self.lost(op)
        before=self.state();self.store.commit(op);self.assertEqual(self.state(),before)
        _,rollback=self.raw(data=b'rolled back',commit=False);db=self.db.connect()
        try:db.query('begin');self.store.in_transaction(db,rollback);db.query('rollback')
        finally:db.close()
        self.assertFalse(self.store.resolve(rollback)['found'])

    def test_R16_parser_blocked_writer(self):
        self.rq();self.send();cap,op=self.raw(commit=False);db=self.db.connect()
        try:
            db.query('begin');self.store.in_transaction(db,op)
            with self.assertRaises(ValueError):self.store.parse(cap.capture_ref,a.port(self.req,cap),h.identity(),f.NOW)
            db.query('commit')
        finally:db.close()
        parsed=self.store.parse(cap.capture_ref,a.port(self.req,cap),h.identity(),f.NOW)
        self.assertEqual(parsed.kind,'RECEIPT_INTERPRETATION')

    def test_R17_parser_crash(self):
        self.rq();self.send();cap,_=self.raw();before=self.state()
        with self.assertRaises(ValueError):self.store.parse(cap.capture_ref,a.port(self.req,cap,kind=t.ReceiptKind.PARSER_CRASH),h.identity(),f.NOW)
        self.assertEqual(before,self.state())
        self.store.commit(self.store.parse(cap.capture_ref,a.port(self.req,cap),h.identity(),f.NOW))
        self.assertEqual(self.cut().captures[cap.capture_ref][1].raw,cap.raw)

    def test_R18_interpretation_atomic(self):
        self.rq();self.send();cap,_=self.raw();op=self.store.parse(cap.capture_ref,a.port(self.req,cap),h.identity(),f.NOW)
        before=self.state();db=self.db.connect()
        try:db.query('begin');self.store.in_transaction(db,op);db.query('rollback')
        finally:db.close()
        self.assertEqual(before,self.state())
        admin=self.db.connect()
        try:
            admin.query("create function dv_market_private.m04_r18_fault() returns trigger language plpgsql set search_path='' as $$begin raise exception 'R18 controlled rollback';end$$")
            for table,when in (('m04_journal_v1',"when (new.kind='RECEIPT_INTERPRETATION')"),('m04_service_v1','')):
                admin.query('create trigger m04_r18_fault after insert on dv_market_private.'+table+' for each row '+when+' execute function dv_market_private.m04_r18_fault()')
                try:
                    with self.assertRaises(Exception):self.store.commit(op)
                    self.assertEqual(before,self.state())
                finally:admin.query('drop trigger m04_r18_fault on dv_market_private.'+table)
        finally:
            admin.query('drop function dv_market_private.m04_r18_fault()');admin.close()
        self.store.commit(op)
        self.assertEqual(len(self.cut().interpretations),1);self.assertEqual(len(self.cut().services),1)

    def test_R19_interpretation_replay_lost(self):
        self.rq();self.send();cap,_=self.raw();op=self.store.parse(cap.capture_ref,a.port(self.req,cap),h.identity(),f.NOW)
        self.lost(op);before=self.state();self.store.commit(op);self.assertEqual(before,self.state())
        with self.assertRaises(ValueError):self.store.resolve(replace(op,at=op.at+timedelta(seconds=1)))

    def test_R20_parser_revision(self):
        cap,_,_=self.complete();before=self.state()['journal']
        port=replace(a.port(self.req,cap),parser_revision=f.v(33000,2))
        self.store.commit(self.store.parse(cap.capture_ref,port,h.identity(),f.NOW))
        self.assertEqual(self.state()['journal'][:len(before)],before);self.assertEqual(len(self.cut().interpretations),2)

    def test_R21_service_replay(self):
        cap,_,_=self.complete();before=list(self.cut().services.values())
        cap2,_=self.raw();self.store.commit(self.store.parse(cap2.capture_ref,a.port(self.req,cap2),h.identity(),f.NOW))
        self.assertEqual(list(self.cut().services.values()),before)
        self.assertTrue(any(row.decision is t.Code.REPLAY for _,row in self.cut().interpretations.values()))
        response=p.ResponseInput(h.identity(),self.req.scope,self.req.phase,p.Presence.OBSERVED,cap.raw,
            self.req.attempt_ref,(p.ServiceId(t.ServiceKind.RESPONSE_TICKET.value,'SYNTHETIC-RESPONSE-ID'),),
            transfer_ticket=self.req.attempt.transfer_ticket,item_position=self.req.attempt.item_position,http_status=cap.http_status)
        result=self.store.commit(self.store.freeze_response(response))
        self.assertIs(result['decision'].status,p.Status.REPLAY)
        self.assertEqual(list(self.cut().services.values()),before)

    def test_R22_service_conflict(self):
        self.complete();before=list(self.cut().services.values());cap,_=self.raw(data=b'changed')
        self.store.commit(self.store.parse(cap.capture_ref,a.port(self.req,cap),h.identity(),f.NOW))
        self.assertIn(self.req.attempt_ref,self.cut().blocked);self.assertEqual(list(self.cut().services.values()),before)
        legacy=p.response(self.req.scope,self.req.attempt_ref,phase=self.req.phase)
        self.assertIs(self.store.commit(self.store.freeze_response(legacy))['decision'].status,p.Status.CONFLICT)

    def test_R23_late_old_response(self):
        self.rq();self.send();new,*_=self.request(index=1);self.rq(new)
        cap,_=self.raw();ref=h.identity();self.store.commit(self.store.parse(cap.capture_ref,a.port(self.req,cap),ref,f.NOW))
        self.assertEqual(self.cut().interpretations[ref][1].resolved_attempt,self.req.attempt_ref)

    def test_R24_swapped_response(self):
        self.rq();self.send();other,*_=self.request(index=1);self.rq(other);cap,_=self.raw()
        claims=(t.Claim(t.ClaimKind.ORIGINAL_TICKET,other.attempt.transfer_ticket,h.identity()),
                t.Claim(t.ClaimKind.ITEM,self.req.attempt.item_position,h.identity()))
        self.store.commit(self.store.parse(cap.capture_ref,a.port(self.req,cap,claims=claims),h.identity(),f.NOW))
        self.assertTrue({self.req.attempt_ref,other.attempt_ref}<=self.cut().blocked)

    def test_R25_cross_phase(self):
        self.complete();req=replace(self.req,request_ref=h.identity(),phase=p.Phase.PROTOCOL,
            method=t.Method.GET,target=t.Target.PROTOCOL,body=None,body_sha256=None,body_length=None)
        self.complete(req);self.assertEqual(len(self.cut().services),2)
        self.assertNotEqual(t.ServiceKind.DSM_MESSAGE.value,'MessageRefId')

    def test_R26_ack_incomplete(self):
        cap,ref,_=self.complete();self.assertFalse(self.store.ack(ref).eligible_local)
        for stage in (t.AckStage.REVALIDATED,t.AckStage.FINAL_UNDERSTOOD,t.AckStage.INTENT):
            self.store.commit(self.store.freeze_assertion(stage,ref,f.NOW))
            self.assertFalse(self.store.ack(ref).eligible_local)
        self.assertFalse(self.store.ack(ref).external_ack_performed)
        self.send(t.Event.COMMIT_UNKNOWN)
        self.assertIs(self.store.ack(ref).state,t.AckState.ACK_UNKNOWN)
        self.store.commit(self.store.freeze_assertion(t.AckStage.CONFIRMATION_COMMITTED,ref,f.NOW))
        cut=self.cut();rirow,result=cut.interpretations[ref];capture=result.capture
        observed=next(e for e in cut.histories[capture.request_ref].events
                      if e.kind is t.Event.RESPONSE_OBSERVED and e.related_ref==capture.capture_ref)
        references={t.AckStage.OBSERVED:observed.event_ref,
                    t.AckStage.COMMITTED:cut.captures[capture.capture_ref][0]['event_ref'],
                    t.AckStage.PARSED_CORRELATED:rirow['event_ref']}
        references.update({v[0]:r['event_ref'] for r,v in cut.assertions.values() if v[3]==ref})
        witnesses=tuple(t.AckWitness(references[stage],stage,capture.request_ref,capture.capture_ref,capture.raw_sha256,capture.scope)
                        for stage in t.AckStage)
        self.assertEqual(len({w.evidence_ref for w in witnesses}),7)
        for missing in t.AckStage:
            decision=t._ack_decision(result,tuple(w for w in witnesses if w.stage is not missing),
                confirmation=t.Commit.CONFIRMED,confirm_synthetic=False,blocked_attempts=tuple(cut.blocked))
            self.assertFalse(decision.eligible_local,missing.value)
        changed,_=self.raw(data=b'CONFLICT')
        self.store.commit(self.store.parse(changed.capture_ref,a.port(self.req,changed),h.identity(),f.NOW))
        self.assertFalse(self.store.ack(ref).eligible_local)

    def test_R27_ack_local(self):
        _,ref,_=self.complete(fact=t.ReceiptKind.DIP_ERROR)
        for stage in (t.AckStage.REVALIDATED,t.AckStage.FINAL_UNDERSTOOD,t.AckStage.INTENT,t.AckStage.CONFIRMATION_COMMITTED):
            self.store.commit(self.store.freeze_assertion(stage,ref,f.NOW))
        decision=self.store.ack(ref);self.assertTrue(decision.eligible_local)
        self.assertIs(decision.fact,t.Fact.REJECTED_SYNTHETIC);self.assertFalse(decision.external_ack_performed)

    def test_R28_same_cluster_restart(self):
        _,ref,_=self.complete()
        for stage in (t.AckStage.REVALIDATED,t.AckStage.FINAL_UNDERSTOOD,t.AckStage.INTENT,t.AckStage.CONFIRMATION_COMMITTED):
            self.store.commit(self.store.freeze_assertion(stage,ref,f.NOW))
        cap,_=self.raw(data=b'CONFLICT')
        self.store.commit(self.store.parse(cap.capture_ref,a.port(self.req,cap),h.identity(),f.NOW))
        other,*_=self.request(index=1);self.rq(other);self.send(req=other);self.send(t.Event.TIMEOUT,req=other)
        third,*_=self.request(index=2);self.rq(third);self.send(req=third)
        cap,unknown=self.raw(third,commit=False);db=self.db.connect()
        try:db.query('begin');self.store.in_transaction(db,unknown);db.query('commit')
        finally:db.close()
        self.store.commit(self.store.parse(cap.capture_ref,a.port(third,cap,kind=t.ReceiptKind.UNKNOWN_STATUS,ids=()),h.identity(),f.NOW))
        type(self).restart_unknown_operation=unknown
        cls=type(self);cls.restart_store=self.store;cls.restart_before=self.state();cls.restart_request=other.request_ref
        EVIDENCE['R28_before']=cls.restart_before;result=self.db.request('restart');EVIDENCE['R28_restart']=result
        for key in ('data_directory','system_identifier','socket','port','current_user','session_user'):
            self.assertEqual(result['before'][key],result['after'][key])
        self.assertNotEqual(result['before']['pid'],result['after']['pid']);self.assertNotEqual(result['before']['start_time'],result['after']['start_time'])
        self.assertTrue(result['old_postmaster_ended']);self.assertFalse(result['initdb_during_restart'])

    def test_R29_complete_recovery(self):
        cls=type(self);recovered=cls.restart_store.recover();self.assertEqual(recovered['state'],cls.restart_before)
        self.assertTrue(recovered['cut'].requests and recovered['cut'].fences and recovered['cut'].snapshots)
        self.assertTrue(recovered['cut'].captures and recovered['cut'].interpretations and recovered['cut'].services)
        self.assertTrue(recovered['cut'].blocked and recovered['cut'].assertions)
        self.assertTrue(any(row.decision is t.Code.UNRESOLVED for _,row in recovered['cut'].interpretations.values()))
        EVIDENCE['R29_after']=recovered['state'];self.assertFalse(recovered['external_ack_performed'])

    def test_R30_unknown_restart(self):
        cls=type(self);before=cls.restart_store.recover();d=before['recovery'][cls.restart_request]
        self.assertIs(d.state,t.State.UNKNOWN);self.assertEqual(d.auto_retry,'AUTO_RETRY_FORBIDDEN')
        self.assertFalse(d.new_attempt or d.new_ticket or d.new_signature)
        self.assertTrue(cls.restart_store.resolve(cls.restart_unknown_operation)['found'])
        self.assertEqual(cls.restart_store.recover_operation(cls.restart_unknown_operation.operation_ref),cls.restart_unknown_operation)
        self.assertEqual(before['state'],cls.restart_store.recover()['state'])

    def test_R31_independent_scopes(self):
        self.rq();other,*_=self.request(index=1,account=7);self.rq(other)
        left=self.send(commit=False);right=self.send(req=other,commit=False);db=self.db.connect()
        try:
            db.query('begin');self.store.in_transaction(db,left)
            with ThreadPoolExecutor(max_workers=1) as pool:pool.submit(self.store.commit,right).result(timeout=15)
            self.assertEqual(len(self.cut().fences),1);db.query('commit')
        finally:db.close()
        self.assertEqual(len(self.cut().fences),2)
        cap,_=self.raw();ri=self.store.parse(cap.capture_ref,a.port(self.req,cap),h.identity(),f.NOW)
        admission=self.store.freeze_attempt(replace(self.proofs[2],scope=self.req.scope))
        leftdb=self.db.connect();rightdb=self.db.connect()
        try:
            leftdb.query('begin');rightdb.query('begin');pid=rightdb.query('select pg_backend_pid() p')[0]['p']
            self.store.in_transaction(leftdb,admission)
            with ThreadPoolExecutor(max_workers=1) as pool:
                future=pool.submit(self.store.in_transaction,rightdb,ri)
                try:self.wait_blocked(pid)
                finally:leftdb.query('commit')
                future.result(timeout=20);rightdb.query('commit')
            self.assertEqual(len(self.cut().book.attempts),3)
        finally:leftdb.close();rightdb.close()

    def test_R32_acl_rls(self):
        rows=self.query("select relrowsecurity from pg_class where oid in ('dv_market_private.m04_attempt_v1'::regclass,'dv_market_private.m04_journal_v1'::regclass,'dv_market_private.m04_service_v1'::regclass)")
        self.assertEqual(len(rows),3);self.assertTrue(all(r['relrowsecurity'] for r in rows))
        for role in ('anon','authenticated','service_role'):
            db=self.db.connect()
            try:
                db.query('set role '+role)
                for sql in ('select * from dv_market_private.m04_journal_v1',
                            'insert into dv_market_private.m04_journal_v1 default values',
                            'update dv_market_private.m04_journal_v1 set reason=reason',
                            'delete from dv_market_private.m04_journal_v1',
                            'truncate dv_market_private.m04_journal_v1',
                            'select dv_market_private.m04_state_base_v1($1::uuid)'):
                    with self.assertRaises(Exception):db.query(sql,[self.profile] if '$1' in sql else [])
            finally:db.close()
        grants=self.query("select p.proname,coalesce(bool_or(a.grantee=0 and a.privilege_type='EXECUTE'),false) public_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace left join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a on true where n.nspname='dv_market_private' and p.proname like 'm04_%' group by p.proname")
        self.assertTrue(grants);self.assertFalse(any(x['public_execute'] for x in grants))

    def test_R33_real_boundary(self):
        before=self.state();snap=self.sig.snapshot
        real=replace(snap.scope,access=replace(snap.scope.access,environment=m.Environment.OFFICIAL_INTEGRATION))
        op=self.store.freeze_snapshot(h.identity(),real,0,(),f.NOW)
        with self.assertRaises(ValueError):self.store.commit(op)
        self.assertEqual(self.state(),before)

    def test_R34_forbidden_io(self):
        import socket
        with (patch.object(socket,'socket',side_effect=AssertionError('forbidden external socket')),
              patch.object(socket,'getaddrinfo',side_effect=AssertionError('forbidden DNS'))):
            self.rq();self.send();self.send(t.Event.TIMEOUT)
        recovered=self.store.recover();self.assertFalse(recovered['external_ack_performed'] or recovered['real_receipt_adapter'])

    def test_R35_v140_native(self):
        output=io.StringIO();result=unittest.TextTestRunner(stream=output,verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(p.Native))
        EVIDENCE['R35_native_log']=output.getvalue();self.assertEqual(result.testsRun,32)
        self.assertTrue(result.wasSuccessful());self.assertFalse(result.skipped)
        legacy=old.ResponseStore(self.profile,self.authority,self.proofs[0].bridge,self.db.connect)
        with self.assertRaises(Exception):legacy.recover()
        self.rq();self.assertEqual(self.cut().requests[self.req.request_ref],self.req)

    def test_R36_v146(self):
        output=io.StringIO();suite=unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromTestCase(a.ContractTests),unittest.defaultTestLoader.loadTestsFromTestCase(a.CodecTests)])
        result=unittest.TextTestRunner(stream=output,verbosity=2).run(suite)
        EVIDENCE['R36_log']=output.getvalue();self.assertEqual(result.testsRun,38)
        self.assertTrue(result.wasSuccessful());self.assertFalse(result.skipped)


if __name__ == '__main__':
    suite=unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromTestCase(Local),unittest.defaultTestLoader.loadTestsFromTestCase(Native)])
    result=unittest.TextTestRunner(verbosity=2,failfast=True,resultclass=p.RecordedResult).run(suite)
    cases={f'R{i:02}':next((v for k,v in result.outcomes.items() if f'.test_R{i:02}_' in k),
                          'NOT_EXECUTED' if NATIVE else 'NATIVE_NOT_RUN') for i in range(1,37)}
    report=dict(contract=c.CONTRACT,codec=c.CODEC,mode='NATIVE_PG17' if NATIVE else 'LOCAL_PREFLIGHT_ONLY',
                R01_R36=cases,evidence=EVIDENCE,external_ack_performed=False,real_receipt_adapter=False)
    out=ROOT/'test-results';out.mkdir(exist_ok=True)
    encoded=json.dumps(report,indent=2)+'\n'
    (out/'m04-adapter-history.json').write_text(encoded)
    (out/'m04-history-result.log').write_text(encoded)
    sys.exit(0 if result.wasSuccessful() else 1)
