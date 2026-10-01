"""V133 P01-P32 native specification; default mode performs local preflight only.

The runtime blocker is not bypassed. --native requires the separate disposable
PG17 runner. No skipped test is a PASS. Synthetic setup signs fixtures once;
the store, replay, commit recovery and restart paths never sign.
"""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from pathlib import Path
import ast
import json
import subprocess
import sys
import threading
from time import monotonic
import unittest
from unittest.mock import patch
from uuid import uuid4

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests'))
from psttg_wire import m04_response_store as store_module
from psttg_wire.m04_response_store import (ResponseStore, ProofInput, StoreCommitUnknown,
    encode_response, decode_response, CONTRACT, CODEC, source_hashes)
from psttg_wire.m04_attempt_response import Scope, ResponseInput, ServiceId, Phase, Presence, Status
from psttg_wire.security import Schemas, Rejected, sha, canonical
from psttg_wire.envelope import EnvelopeSpec, build_envelope
from psttg_wire.signature_profile import sign_test, TestKeyRef
from psttg_wire.test_m02 import material, make_edition
from psttg_wire.w11_bridge import W11Bridge
from psttg_wire.w11_test_transport import TestDatabase

NATIVE='--native' in sys.argv
EVIDENCE={}


class NativeDatabase(TestDatabase):
    def __init__(self):
        self.process=subprocess.Popen(['node',str(ROOT/'tests/helpers/m04-db-harness.mjs'),'--native'],
            cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=None,text=True,bufsize=1)
        line=self.process.stdout.readline()
        if not line:raise RuntimeError('M04 explicit native PG17 runtime unavailable')
        self.ready=json.loads(line);self._lock=threading.Lock();self._pending={};self._id=0
        self._reader=threading.Thread(target=self._read,daemon=True);self._reader.start()


def response(scope, attempt=None, **changes):
    return replace(ResponseInput(str(uuid4()),scope,Phase.START,Presence.OBSERVED,b'<synthetic-response/>',
        attempt_ref=attempt,service_ids=(ServiceId('datentransfernummer','synthetic-number'),)),**changes)


class Local(unittest.TestCase):
    def test_fixture_and_v132_projection_only(self):
        # Pure V132 projection check, NOT a fabricated persistent proof admission.
        from psttg_wire.test_w11 import context
        from psttg_wire.m04_attempt_response import AttemptBook
        schemas=Schemas();key=material();edition=make_edition(schemas)
        spec=EnvelopeSpec(str(uuid4()),'2026-10-01T10:00:00Z','SYNTHETIC-M04-PREFLIGHT')
        signed=sign_test(build_envelope(edition,spec,schemas),key)
        bridge=W11Bridge(key.pin,b's'*32,'synthetic-local-storage-reference-only',schemas)
        c=context(spec);token=bridge.freeze(signed,c)
        projected={'bundle':{'input':bridge._input(token)}}
        decision=ResponseStore._prepare(AttemptBook(),signed,projected,Scope('TEST',str(uuid4()),None),bridge)
        self.assertEqual(decision.attempt.item_position,spec.item_position)
        self.assertNotEqual(decision.attempt.item_position,'0')
        self.assertEqual(decision.attempt.signed_bytes,signed.xml)

    def test_codec_forbidden_io(self):
        active=[True]
        def audit(event,args):
            if active[0] and (event.startswith('socket.') or event in ('subprocess.Popen','os.system')):
                raise AssertionError('forbidden I/O in local codec scope: '+event)
        sys.addaudithook(audit)
        try:
            r=response(Scope('TEST',str(uuid4()),None))
            self.assertEqual(decode_response(encode_response(r)),r)
        finally:active[0]=False

    def test_codec_null_empty_binary(self):
        scope=Scope('TEST',str(uuid4()),None)
        for raw in (b'',b'\x00\xff\r\n',None):
            r=response(scope,original_bytes=raw,presence=Presence.NOT_OBSERVED if raw is None else Presence.OBSERVED,
                       service_ids=() if raw is None else (ServiceId('messageId','Exact.Case'),))
            self.assertEqual(decode_response(encode_response(r)),r)
        self.assertNotEqual(encode_response(response(scope,original_bytes=b''))['original_hex'],None)

    def test_codec_closed_and_profile(self):
        d=encode_response(response(Scope('TEST',str(uuid4()),None)))
        for change in ({'origin':'real'},{'extra':True},{'original_hex':'AA'},{'original_hex':'0'}):
            with self.assertRaises((Rejected,TypeError,ValueError)):decode_response(d|change)
        with self.assertRaises(Rejected):Scope('PROD',str(uuid4()),None)

    def test_frozen_v132_hashes(self):
        expected={'m04_attempt_response.py':'86e1649f052928eaf91a773054202e6e08ba19a072ecaff88798539e561e963b',
                  'test_m04_attempt_response.py':'3c031eb8395d27546265605f5b7c1202f9ba76664dcba34b63b8c7d86bb29af5'}
        for name,digest in expected.items():self.assertEqual(sha(Path(__file__).with_name(name).read_bytes()),digest)
        self.assertEqual(source_hashes()['m04_attempt_response.py'],expected['m04_attempt_response.py'])

    def test_closed_store_io_scope(self):
        path=Path(store_module.__file__);tree=ast.parse(path.read_text())
        modules={x.module for x in ast.walk(tree) if isinstance(x,ast.ImportFrom)}
        modules|={a.name for x in ast.walk(tree) if isinstance(x,ast.Import) for a in x.names}
        self.assertFalse(modules & {'socket','requests','urllib','http','subprocess','os','psycopg','psycopg2'})
        calls={x.func.attr if isinstance(x.func,ast.Attribute) else x.func.id for x in ast.walk(tree)
               if isinstance(x,ast.Call) and isinstance(x.func,(ast.Attribute,ast.Name))}
        self.assertFalse(calls & {'sign_test','urlopen','getaddrinfo','create_connection','getenv','system','Popen'})
        self.assertNotIn('external_ack_attempted',path.read_text());self.assertNotIn('external_ack_confirmed',path.read_text())

    def test_sql_structure_and_gates(self):
        sql=(ROOT/'database/psttg-m04-response-store-v1.sql').read_text()
        self.assertEqual(sql.count('create table '),3)
        self.assertIn('unique nulls not distinct',sql)
        self.assertIn('on delete restrict',sql);self.assertNotIn('on delete cascade',sql)
        self.assertNotIn('grant ',sql.lower());self.assertIn('enable row level security',sql)
        self.assertIn('from public,anon,authenticated,service_role',sql)
        self.assertLess(sql.index('pg_advisory_xact_lock(13301'),sql.index('pg_advisory_xact_lock(13302'))
        self.assertIn('language plpgsql stable security definer',sql)
        self.assertNotIn('signed_bytes bytea',sql);self.assertNotIn('update dv_market_private',sql.lower())
        self.assertIn('m04_private_decision',sql);self.assertNotIn('verified=true',sql.replace(' ',''))

    def test_p01_p32_are_concrete(self):
        methods=[n for n in Native.__dict__ if n.startswith('test_P')]
        self.assertEqual(sorted(n[5:8] for n in methods),[f'P{i:02}' for i in range(1,33)])
        tree=ast.parse(Path(__file__).read_text())
        for node in ast.walk(tree):
            if isinstance(node,ast.FunctionDef) and node.name.startswith('test_P'):
                self.assertGreater(len(node.body),1)
                self.assertFalse(any(isinstance(x,ast.Pass) for x in ast.walk(node)))


@unittest.skipUnless(NATIVE,'NATIVE_NOT_RUN: accepted V134 runtime blocker')
class Native(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db=NativeDatabase();cls.schemas=Schemas();cls.key=material();cls.edition=make_edition(cls.schemas)
        cls.scope=Scope('TEST',str(uuid4()),None);cls.proofs=[];cls.signed=[];cls.contexts=[]
        for i in range(3):
            spec=EnvelopeSpec(str(uuid4()),'2026-10-01T10:00:00Z','SYNTHETIC-M04-'+str(i))
            signed=sign_test(build_envelope(cls.edition,spec,cls.schemas),cls.key)
            fixture=cls.db.request('context',revision=spec.revision)
            bridge=W11Bridge(cls.key.pin,bytes.fromhex(fixture['key']),fixture['secret'],cls.schemas)
            token=bridge.freeze(signed,fixture['context']);c=cls.db.connect()
            try:result=bridge.commit(c,token)
            finally:c.close()
            assert result['record_kind']=='BOUND'
            cls.proofs.append(ProofInput.make(bridge,bridge.expectation(token),cls.scope))
            cls.signed.append(signed);cls.contexts.append(fixture['context'])
        # A real, separately committed alternative W11 byte source; the proposed
        # proof identity is deliberately NOT its physical conflict-row identity.
        bridge=cls.proofs[0].bridge
        fresh_key=TestKeyRef(cls.key.pin,cls.key.private_key)
        alt=sign_test(build_envelope(cls.edition,replace(cls.signed[0].unsigned.spec,
            creation_time='2026-10-01T10:01:00Z'),cls.schemas),fresh_key)
        token=bridge.freeze(alt,cls.contexts[0]);c=cls.db.connect()
        try:result=bridge.commit(c,token)
        finally:c.close()
        assert result['record_kind']=='CONFLICT'
        cls.alternative=ProofInput.make(bridge,bridge.expectation(token,result['proof_id']),cls.scope)
        cls.authority=json.loads(cls.proofs[0].expectation_bytes)['proof_id']
        EVIDENCE['runtime']=cls.db.ready

    @classmethod
    def tearDownClass(cls):cls.db.close()

    def setUp(self):
        self.store=ResponseStore(str(uuid4()),self.authority,self.proofs[0].bridge,self.db.connect)

    def prepare(self,i=0,scope=None,store=None,alternative=False):
        s=store or self.store;p=self.alternative if alternative else self.proofs[i]
        if scope is not None:p=replace(p,scope=scope)
        return s.commit(s.freeze_attempt(p))

    def obs(self,request,store=None):
        s=store or self.store;return s.commit(s.freeze_response(request))

    def ready(self,i=0):
        result=self.prepare(i);return result['decision'].attempt.proof.attempt_ref

    def assertStatus(self,result,status):
        self.assertEqual(result['decision'].status,Status(status))
        self.assertFalse(result['decision'].external_ack_performed);self.assertFalse(result['decision'].real_receipt_adapter)

    def snapshot(self,store=None):
        recovered=(store or self.store).recover()
        return recovered['state']

    def raw(self,sql,params=None):
        c=self.db.connect()
        try:return c.query(sql,params)
        finally:c.close()

    def wait_blocked(self,pid):
        # Only an observed PostgreSQL blocking edge permits success; timeout is
        # a failure bound, not a scheduling-based acceptance heuristic.
        deadline=monotonic()+10
        while monotonic()<deadline:
            if self.raw('select cardinality(pg_blocking_pids($1)) n',[pid])[0]['n']>0:return
        self.fail('expected native lock edge was not observed')

    def concurrent(self,left,right,expected):
        a=self.db.connect();b=self.db.connect()
        try:
            a.query('begin');b.query('begin');pid=b.query('select pg_backend_pid() p')[0]['p']
            first=self.store.in_transaction(a,left)
            with ThreadPoolExecutor(max_workers=1) as pool:
                future=pool.submit(self.store.in_transaction,b,right)
                try:self.wait_blocked(pid)
                finally:a.query('commit')
                second=future.result(timeout=25);b.query('commit')
            self.assertStatus(first,'BOUND');self.assertStatus(second,expected)
            self.snapshot()
        finally:
            for c in (a,b):
                try:c.query('rollback')
                finally:c.close()

    def test_P01_attempt_commit(self):
        result=self.prepare();self.assertStatus(result,'BOUND');state=self.snapshot()
        self.assertEqual(len(state['attempts']),1);a=state['attempts'][0]
        self.assertEqual(a['binding']['item_position'],self.signed[0].unsigned.spec.item_position)
        self.assertNotEqual(a['binding']['item_position'],'0');self.assertNotIn('signed_bytes',a['binding'])
        self.assertEqual(a['physical_proof_id'],self.authority)
        self.assertEqual(a['binding']['proof']['signed_sha256'],sha(self.signed[0].xml))

    def test_P02_attempt_replay(self):
        first=self.prepare();before=self.snapshot();again=self.prepare()
        self.assertStatus(again,'REPLAY');self.assertEqual(first['commit']['commit_ref'],again['commit']['commit_ref'])
        self.assertEqual(self.snapshot(),before)

    def test_P03_attempt_conflict(self):
        self.prepare();before=self.snapshot()['attempts'];self.assertStatus(self.prepare(alternative=True),'CONFLICT')
        state=self.snapshot();self.assertEqual(state['attempts'],before)
        self.assertEqual(state['journal'][0]['physical_proof_id'],json.loads(self.alternative.expectation_bytes)['proof_id'])
        self.assertNotEqual(state['journal'][0]['physical_proof_id'],self.authority)
        self.assertStatus(self.prepare(),'CONFLICT')

    def test_P04_response_commit(self):
        ref=self.ready();raw=b'\x00<synthetic/>\r\n\xff';r=response(self.scope,ref,original_bytes=raw)
        self.assertStatus(self.obs(r),'BOUND');j=self.snapshot()['journal'][0]
        self.assertEqual(j['original_response'],'\\x'+raw.hex());self.assertEqual(j['response_sha256'],sha(raw));self.assertEqual(j['response_length'],len(raw))
        self.assertEqual(len(self.snapshot()['services']),1)

    def test_P05_observation_replay(self):
        r=response(self.scope,self.ready());first=self.obs(r);before=self.snapshot();again=self.obs(r)
        self.assertStatus(again,'REPLAY');self.assertEqual(first['commit']['event_ref'],again['commit']['event_ref']);self.assertEqual(before,self.snapshot())

    def test_P06_scoped_replay(self):
        r=response(self.scope,self.ready());self.obs(r);self.assertStatus(self.obs(replace(r,observation_ref=str(uuid4()))),'REPLAY')
        state=self.snapshot();self.assertEqual(len(state['journal']),2);self.assertEqual(len(state['services']),1)

    def test_P07_bytes_claims_conflict(self):
        r=response(self.scope,self.ready());self.obs(r);old=self.snapshot()['services']
        self.assertStatus(self.obs(replace(r,observation_ref=str(uuid4()),original_bytes=b'other')),'CONFLICT')
        self.assertStatus(self.obs(replace(r,observation_ref=str(uuid4()),http_status=201)),'CONFLICT')
        self.assertEqual(old,self.snapshot()['services'])

    def test_P08_other_attempt(self):
        a=self.ready();b=self.ready(1);r=response(self.scope,a);self.obs(r)
        self.assertStatus(self.obs(replace(r,observation_ref=str(uuid4()),attempt_ref=b)),'CONFLICT')
        self.assertEqual(self.store.recover()['book']._blocked,{a,b})

    def test_P09_scopes(self):
        r=response(self.scope,self.ready());self.obs(r)
        for scope in (replace(self.scope,environment='SYNTHETIC_OTHER'),replace(self.scope,channel_profile=str(uuid4())),replace(self.scope,account_profile=str(uuid4()))):
            self.assertStatus(self.obs(replace(r,observation_ref=str(uuid4()),scope=scope)),'UNRESOLVED')
        self.assertStatus(self.obs(replace(r,observation_ref=str(uuid4()),phase=Phase.UPLOAD)),'BOUND')
        self.assertStatus(self.obs(replace(r,observation_ref=str(uuid4()),service_ids=(ServiceId('messageId','synthetic-number'),))),'BOUND')
        self.assertEqual(len(self.snapshot()['services']),3)

    def test_P10_null_account(self):
        a=self.ready();scope=replace(self.scope,account_profile=str(uuid4()));b=self.prepare(1,scope)['decision'].attempt.proof.attempt_ref
        self.assertStatus(self.obs(response(self.scope,a)),'BOUND');self.assertStatus(self.obs(response(scope,b)),'BOUND')
        self.assertStatus(self.obs(response(scope,a)),'UNRESOLVED');self.assertEqual(len(self.snapshot()['services']),2)

    def test_P11_item_position(self):
        a=self.ready();self.assertStatus(self.obs(response(self.scope,a,item_position='0')),'UNRESOLVED')
        self.assertStatus(self.obs(response(self.scope,a,item_position=self.signed[0].unsigned.spec.item_position)),'BOUND');self.snapshot()

    def test_P12_delayed(self):
        a=self.ready();b=self.ready(1);r=self.obs(response(self.scope,a))
        self.assertStatus(r,'BOUND');self.assertEqual(r['decision'].observation.attempt_ref,a);self.assertNotEqual(a,b);self.snapshot()

    def test_P13_swapped(self):
        a=self.ready();b=self.ready(1)
        self.assertStatus(self.obs(response(self.scope,a,transfer_ticket=self.signed[1].unsigned.spec.transfer_ticket)),'CONFLICT')
        self.assertStatus(self.obs(response(self.scope,b,transfer_ticket=self.signed[0].unsigned.spec.transfer_ticket)),'CONFLICT')
        self.assertEqual(self.store.recover()['book']._blocked,{a,b})

    def test_P14_missing_ambiguous(self):
        self.ready();self.ready(1)
        self.assertStatus(self.obs(response(self.scope,service_ids=())),'UNRESOLVED')
        d=self.obs(response(self.scope,message_ref=self.edition.delivery.message_ref))
        self.assertStatus(d,'UNRESOLVED');self.assertEqual(d['decision'].reason,'ambiguous_attempt');self.snapshot()

    def test_P15_unknown(self):
        a=self.ready()
        for presence in (Presence.NOT_OBSERVED,Presence.POSSIBLY_LOST):
            self.assertStatus(self.obs(response(self.scope,a,presence=presence,original_bytes=None,service_ids=())),'UNKNOWN')
        self.assertStatus(self.obs(response(self.scope,a,phase=Phase.UNKNOWN)),'UNKNOWN')
        book=self.store.recover()['book'];self.assertEqual(len(book.attempts),1)
        self.assertEqual([o.reason for o in book.observations],['not_observed','possibly_lost','phase_not_known'])

    def test_P16_later_append(self):
        a=self.ready();old=self.obs(response(self.scope,a,presence=Presence.POSSIBLY_LOST,original_bytes=None,service_ids=()))
        before=self.snapshot()['journal'];op=self.store.freeze_response(response(self.scope,a),old['commit']['event_ref'])
        self.assertStatus(self.store.commit(op),'BOUND');self.assertEqual(self.snapshot()['journal'][:1],before)
        self.assertEqual(self.snapshot()['journal'][1]['prior_event_ref'],old['commit']['event_ref'])

    def test_P17_crash_before_commit(self):
        op=self.store.freeze_attempt(self.proofs[0]);c=self.db.connect();c.query('begin')
        pid=c.query('select pg_backend_pid() p')[0]['p'];self.store.in_transaction(c,op)
        try:self.assertTrue(self.raw('select pg_terminate_backend($1) killed',[pid])[0]['killed'])
        finally:c.close()
        self.assertFalse(self.store.resolve(op)['found']);self.assertEqual(self.snapshot()['attempts'],[])

    def test_P18_lost_commit_answer(self):
        a=self.ready();op=self.store.freeze_response(response(self.scope,a));original=self.store.connect
        class Lost:
            def __init__(inner):inner.c=original()
            def query(inner,sql,params=None):
                result=inner.c.query(sql,params)
                if sql=='commit':raise RuntimeError('synthetic lost local commit answer')
                return result
            def close(inner):inner.c.close()
        self.store.connect=Lost
        try:
            with self.assertRaises(StoreCommitUnknown) as error:self.store.commit(op)
            self.assertIs(error.exception.operation,op)
        finally:self.store.connect=original
        resolved=self.store.resolve(op);self.assertTrue(resolved['found'])
        self.assertStatus(self.store.commit(op),'REPLAY');self.assertEqual(len(self.snapshot()['journal']),1)

    def test_P19_parallel_identical_attempts(self):
        op=self.store.freeze_attempt(self.proofs[0])
        self.concurrent(op,op,'REPLAY')

    def test_P20_parallel_attempt_conflict(self):
        a=self.store.freeze_attempt(self.proofs[0]);b=self.store.freeze_attempt(self.alternative)
        self.concurrent(a,b,'CONFLICT')

    def test_P21_parallel_identical_response(self):
        op=self.store.freeze_response(response(self.scope,self.ready()))
        self.concurrent(op,op,'REPLAY')

    def test_P22_parallel_response_conflict(self):
        r=response(self.scope,self.ready());a=self.store.freeze_response(r);b=self.store.freeze_response(replace(r,observation_ref=str(uuid4()),original_bytes=b'changed'))
        self.concurrent(a,b,'CONFLICT')

    def test_P23_phantom_and_sorted_gates(self):
        self.ready();a=self.db.connect();b=self.db.connect()
        try:
            a.query('begin');b.query('begin');pid=b.query('select pg_backend_pid() p')[0]['p']
            self.store.in_transaction(a,self.store.freeze_attempt(self.proofs[1]))
            op=self.store.freeze_response(response(self.scope,message_ref=self.edition.delivery.message_ref))
            with ThreadPoolExecutor(max_workers=1) as pool:
                future=pool.submit(self.store.in_transaction,b,op)
                try:self.wait_blocked(pid)
                finally:a.query('commit')
                result=future.result(timeout=25);b.query('commit')
            self.assertStatus(result,'UNRESOLVED');self.assertEqual(result['decision'].reason,'ambiguous_attempt')
            self.snapshot()
        finally:
            for c in (a,b):
                try:c.query('rollback')
                finally:c.close()

    def test_P24_independent_parallel(self):
        op=self.store.freeze_attempt(self.proofs[0]);scope=replace(self.scope,channel_profile=str(uuid4()))
        independent=self.store.freeze_attempt(replace(self.proofs[1],scope=scope));c=self.db.connect()
        try:
            c.query('begin');self.store.in_transaction(c,op)
            with ThreadPoolExecutor(max_workers=1) as pool:
                result=pool.submit(self.store.commit,independent).result(timeout=15)
            self.assertStatus(result,'BOUND');self.assertEqual(len(self.snapshot()['attempts']),1)
            c.query('commit');self.assertEqual(len(self.snapshot()['attempts']),2)
        finally:
            try:c.query('rollback')
            finally:c.close()

    def test_P25_observation_variant(self):
        a=self.ready();r=response(self.scope,a);first=self.obs(r)
        changed=replace(r,original_bytes=b'variant');self.assertStatus(self.obs(changed),'CONFLICT')
        state=self.snapshot();self.assertEqual(len(state['journal']),2)
        self.assertEqual(state['journal'][1]['canonical_event_ref'],first['commit']['event_ref'])
        self.assertStatus(self.obs(changed),'CONFLICT');self.assertEqual(self.snapshot(),state)

    def test_P26_same_cluster_restart(self):
        a=self.ready();b=self.ready(1)
        self.obs(response(self.scope,a,original_bytes=b'\x00restart\xff'))
        self.obs(response(self.scope,b,presence=Presence.POSSIBLY_LOST,original_bytes=None,service_ids=()))
        self.obs(response(self.scope,service_ids=()))
        self.prepare(alternative=True)
        before=self.store.recover();type(self).restart_store=self.store;type(self).restart_state=before['state']
        type(self).restart_blocked=before['book']._blocked.copy()
        EVIDENCE['P26_before']=before['state'];EVIDENCE['P26']=self.db.request('restart')
        self.assertTrue(EVIDENCE['P26']['old_postmaster_ended']);self.assertFalse(EVIDENCE['P26']['initdb_during_restart'])

    def test_P27_full_recovery(self):
        recovered=self.restart_store.recover();self.assertEqual(recovered['state'],self.restart_state)
        self.assertEqual(recovered['book']._blocked,self.restart_blocked)
        for o in recovered['book'].observations:
            replay=self.restart_store.commit(self.restart_store.freeze_response(o.input))
            self.assertEqual(replay['decision'].observation,o)
            self.assertIn(replay['decision'].status,(Status.REPLAY,Status.CONFLICT))
        self.assertEqual(self.restart_store.recover()['state'],self.restart_state)
        EVIDENCE['P27']={'exact_history':True,'independent_connection':True,'revalidated_proofs':len(recovered['state']['attempts']),
                         'response_hashes':[j['response_sha256'] for j in recovered['state']['journal']],
                         'blocked':sorted(recovered['book']._blocked),'external_ack_performed':False,'real_receipt_adapter':False}

    def test_P28_proof_fail_closed(self):
        for mutation in ({'proof_id':str(uuid4())},{'input_sha256_canonical':'0'*64}):
            p=self.proofs[0];expected=json.loads(p.expectation_bytes)|mutation
            with self.assertRaises((Rejected,RuntimeError)):
                self.store.freeze_attempt(ProofInput.make(p.bridge,expected,p.scope))
        self.assertEqual(self.snapshot()['attempts'],[])
        # Independently test corruption inside a rolled-back, disposable DBA
        # negative-control transaction; this is not an application capability.
        self.ready();c=self.db.connect()
        try:
            c.query('begin');c.query('alter table dv_market_private.psttg_w11_envelope_proof_v1 disable trigger user')
            c.query("update dv_market_private.psttg_w11_envelope_proof_v1 set cipher_commitment=decode(repeat('00',32),'hex') where proof_id=$1::uuid",[self.authority])
            with self.assertRaises((Rejected,RuntimeError)):self.store._restore(c,self.store._state(c))
        finally:c.query('rollback');c.close()

    def test_P29_acl_rls_append_only(self):
        ref=self.ready();self.obs(response(self.scope,ref))
        tables=['m04_attempt_v1','m04_journal_v1','m04_service_v1']
        for role in ('anon','authenticated','service_role'):
            for table in tables:
                for sql in (f'select * from dv_market_private.{table}',f'insert into dv_market_private.{table} default values',
                            f'update dv_market_private.{table} set store_profile=store_profile',f'delete from dv_market_private.{table}',f'truncate dv_market_private.{table}'):
                    c=self.db.connect()
                    try:
                        c.query('begin');c.query('set local role '+role)
                        with self.assertRaises(RuntimeError):c.query(sql)
                    finally:c.query('rollback');c.close()
            c=self.db.connect()
            try:
                c.query('begin');c.query('set local role '+role)
                with self.assertRaises(RuntimeError):self.store._state(c)
            finally:c.query('rollback');c.close()
        for table in tables:
            for verb in (f'update dv_market_private.{table} set store_profile=store_profile',f'delete from dv_market_private.{table}',f'truncate dv_market_private.{table}'):
                c=self.db.connect()
                try:
                    c.query('begin');c.query('set local role dv_psttg_core_owner')
                    with self.assertRaises(RuntimeError):c.query(verb)
                finally:c.query('rollback');c.close()
        rows=self.raw("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='dv_market_private' and relname=any($1::text[])",[tables])
        self.assertTrue(all(r['relrowsecurity'] for r in rows))
        functions=self.raw("select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and proname like 'm04_%' and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute') or has_function_privilege('service_role',p.oid,'execute'))")
        self.assertEqual(functions,[])
        # Isolate RLS from ACL using transaction-local, rolled-back test grants.
        c=self.db.connect()
        try:
            c.query('begin');c.query('grant usage on schema dv_market_private to anon')
            for table in tables:c.query('grant select on dv_market_private.'+table+' to anon')
            c.query('set local role anon')
            for table in tables:self.assertEqual(c.query('select * from dv_market_private.'+table),[])
        finally:c.query('rollback');c.close()
        self.snapshot()

    def test_P30_null_empty_codec_collision(self):
        a=self.ready();self.obs(response(self.scope,a,original_bytes=None,presence=Presence.NOT_OBSERVED,service_ids=()))
        self.obs(response(self.scope,a,original_bytes=b'',service_ids=()))
        rows=self.snapshot()['journal'];self.assertIsNone(rows[0]['original_response']);self.assertEqual(rows[1]['original_response'],'\\x')
        true_sha=store_module.sha
        def fingerprint_collision(raw):
            return 'c'*64 if raw.startswith(b'{') and b'"observation_ref"' in raw else true_sha(raw)
        # Collision of the lookup fingerprint ONLY; byte hashes remain actual
        # SHA256. V132 complete-input equality must still separate both inputs.
        s=ResponseStore(str(uuid4()),self.authority,self.proofs[0].bridge,self.db.connect)
        ref=self.prepare(store=s)['decision'].attempt.proof.attempt_ref;r=response(self.scope,ref)
        with patch.object(store_module,'sha',side_effect=fingerprint_collision):
            self.assertStatus(self.obs(r,s),'BOUND')
            self.assertStatus(self.obs(replace(r,observation_ref=str(uuid4()),original_bytes=b'collision-other'),s),'CONFLICT')
            state=s.recover()['state'];self.assertEqual(state['journal'][0]['input_fingerprint'],state['journal'][1]['input_fingerprint'])
            self.assertNotEqual(state['journal'][0]['original_response'],state['journal'][1]['original_response'])

    def test_P31_profile_boundary(self):
        a=self.ready();d=encode_response(response(self.scope,a));before=self.snapshot()
        for mutation in ({'origin':'real'},{'scope':dict(environment='PROD',channel_profile=self.scope.channel_profile,account_profile=None)}):
            with self.assertRaises(Rejected):decode_response(d|mutation)
        c=self.db.connect()
        try:
            c.query('begin')
            with self.assertRaises(RuntimeError):self.store._call(c,'m04_scope_v1',[json.dumps(d['scope']|{'environment':'PROD'})],['jsonb'])
        finally:c.query('rollback');c.close()
        self.assertEqual(before,self.snapshot())

    def test_P32_no_side_effect(self):
        # W11 rows are compared, not merely their counts; no marker mutation.
        before=self.raw('select to_jsonb(p) v from dv_market_private.psttg_w11_envelope_proof_v1 p order by proof_id')
        with patch('psttg_wire.signature_profile.sign_test',side_effect=AssertionError('store must not sign')):
            a=self.ready();self.assertStatus(self.obs(response(self.scope,a)),'BOUND');recovered=self.store.recover()
        after=self.raw('select to_jsonb(p) v from dv_market_private.psttg_w11_envelope_proof_v1 p order by proof_id')
        self.assertEqual(before,after);self.assertFalse(recovered['external_ack_performed']);self.assertFalse(recovered['real_receipt_adapter'])
        Local('test_closed_store_io_scope').test_closed_store_io_scope()


class RecordedResult(unittest.TextTestResult):
    def __init__(self,*args,**kwargs):super().__init__(*args,**kwargs);self.outcomes={}
    def addSuccess(self,test):super().addSuccess(test);self.outcomes[test.id()]='PASS'
    def addFailure(self,test,err):super().addFailure(test,err);self.outcomes[test.id()]='FAIL'
    def addError(self,test,err):super().addError(test,err);self.outcomes[test.id()]='ERROR'
    def addSkip(self,test,reason):super().addSkip(test,reason);self.outcomes[test.id()]='NATIVE_NOT_RUN'


if __name__=='__main__':
    suite=unittest.TestSuite([unittest.defaultTestLoader.loadTestsFromTestCase(Local),unittest.defaultTestLoader.loadTestsFromTestCase(Native)])
    result=unittest.TextTestRunner(verbosity=2,failfast=True,resultclass=RecordedResult).run(suite)
    cases={n[5:8]:next((v for k,v in result.outcomes.items() if k.endswith('.'+n)),
                      'NOT_EXECUTED' if NATIVE else 'NATIVE_NOT_RUN') for n in Native.__dict__ if n.startswith('test_P')}
    report={'contract':CONTRACT,'codec':CODEC,'mode':'NATIVE_PG17' if NATIVE else 'LOCAL_PREFLIGHT_ONLY',
            'native_acceptance':'COMPLETE' if NATIVE and result.wasSuccessful() and set(cases.values())=={'PASS'} else 'NATIVE_NOT_RUN' if not NATIVE else 'INCOMPLETE',
            'P01_P32':cases,'outcomes':result.outcomes,
            'tests_run':result.testsRun,'skipped':len(result.skipped),'success':result.wasSuccessful(),'evidence':EVIDENCE,
            'external_ack_performed':False,'real_receipt_adapter':False}
    out=ROOT/'test-results';out.mkdir(exist_ok=True)
    (out/'m04-response-store.json').write_text(json.dumps(report,indent=2)+'\n')
    sys.exit(0 if result.wasSuccessful() else 1)
