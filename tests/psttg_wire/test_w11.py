"""Local contract preflight; --native is selected only by psttg-w11-test.py.
Every N01-N22 remains NATIVE_NOT_RUN in local mode, even if PGlite passes.
"""
import copy
from contextlib import contextmanager
from time import monotonic, sleep
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from uuid import uuid4
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from psttg_wire.security import Rejected, Schemas, sha, canonical, LIMIT
from psttg_wire.envelope import EnvelopeSpec, build_envelope
from psttg_wire.signature_profile import sign_test, TestKeyRef
from psttg_wire.test_m02 import material, make_edition
from psttg_wire.w11_bridge import W11Bridge, _Frozen, _json, _b64, _unb64, _restore, CommitUnknown
from psttg_wire.w11_test_transport import TestDatabase

NATIVE=False
RESULTS=[]
ROOT=Path(__file__).resolve().parents[2]

@contextmanager
def closed_connection(db, on_open=None):
    """Own one test handle, including BEGIN failure; never mask its first error."""
    conn=db.connect();primary=None
    try:
        if on_open is not None:on_open(conn)
        yield conn
    except BaseException as exc:
        primary=exc
        raise
    finally:
        errors=[]
        for cleanup in (lambda:conn.query('rollback'),conn.close):
            try:cleanup()
            except BaseException as exc:errors.append(exc)
        if errors:
            if primary is not None:
                for exc in errors:primary.add_note('connection cleanup: '+repr(exc))
            else:
                for exc in errors[1:]:errors[0].add_note('connection cleanup: '+repr(exc))
                raise errors[0]

def context(spec):
    c={k:str(uuid4()) for k in ('proof_id','channel_id','operating_incarnation','operation_ref',
        'admission_id','attempt_transition_id','admission_commit_ref','transition_commit_ref')}
    c.update(envelope_revision=spec.revision,input_revision=1,transition_revision=1,
        scope_ids=[str(uuid4())],configuration_revision=1,receipt_revision=0,mapping_revision=0,
        stop_revision=0,predecessor_proof_id=None)
    e=dict(contract='synthetic-unit-result/1',channel=c['channel_id'],system_ref=str(uuid4()),
        environment_ref=str(uuid4()),account_ref=str(uuid4()),event_ref=str(uuid4()),
        operation_ref=c['operation_ref'],attempt_ref=str(uuid4()),target_ref=c['admission_id'],
        operating_incarnation=c['operating_incarnation'],epoch=1,result='SIMULATED',
        proof_ref=str(uuid4()),payload={'detail_ref':c['proof_id']})
    c['envelope']=e;c['environment_binding']=dict(origin='synthetic_test',environment='TEST',application='DAC7',dip_version='2.0',
        environment_ref=e['environment_ref'],account_ref=e['account_ref'],system_ref=e['system_ref'])
    return c

class Local(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schemas=Schemas();cls.key=material();cls.spec=EnvelopeSpec(str(uuid4()),'2026-09-30T10:00:00Z','SYNTHETIC-W11-1')
        cls.edition=make_edition(cls.schemas)
        cls.signed=sign_test(build_envelope(cls.edition,cls.spec,cls.schemas),cls.key)
    def setUp(self):
        self.bridge=W11Bridge(self.key.pin,b'x'*32,'synthetic-only-storage-secret-000000',self.schemas)
        self.c=context(self.spec);self.token=self.bridge.freeze(self.signed,self.c)
    def test_01_complete_originals(self):
        d=self.bridge._input(self.token);m=d['m02']
        self.assertEqual(_unb64(m['bytes']['signed']),self.signed.xml)
        self.assertEqual(_unb64(m['bytes']['unsigned']),self.signed.unsigned.xml)
        self.assertEqual(_unb64(m['bytes']['dpi']),self.edition.xml)
        self.assertEqual(_unb64(m['bytes']['source']),self.edition.source_bytes)
        self.assertEqual(_unb64(m['bytes']['reference']),_unb64(m['bytes']['projection_c14n']))
        self.assertEqual(_restore(m,self.key.pin,self.schemas),self.signed)
        self.assertEqual(m['evidence']['original_signed_dip_xsd'],'NOT_CONFORMING_TO_PINNED_ROOT_CONTENT_MODEL')
    def test_02_multi(self):
        e=make_edition(self.schemas,2,True,2);s=replace(self.spec,revision=str(uuid4()),transfer_ticket='SYNTHETIC-W11-2')
        signed=sign_test(build_envelope(e,s,self.schemas),self.key)
        token=self.bridge.freeze(signed,context(s))
        restored=_restore(self.bridge._input(token)['m02'],self.key.pin,self.schemas)
        self.assertEqual(len(restored.unsigned.edition.positions),2)
        self.assertEqual(len(restored.unsigned.edition.positions[0].subject.seller_ids),2)
    def test_03_no_free_pass_or_path(self):
        for obj in ('file.xml',b'<dip/>',{'status':'OFFLINE_PROFILE_VERIFIED'},object()):
            with self.subTest(kind=type(obj).__name__),self.assertRaises(Rejected):self.bridge.freeze(obj,self.c)
        with self.assertRaises(Rejected):_Frozen()
        with self.assertRaises(Rejected):self.bridge._input(object.__new__(_Frozen))
        with self.assertRaises(Rejected):self.bridge._input('file.xml')
    def test_04_replay_no_signing(self):
        before=self.bridge.expectation(self.token)
        with patch('psttg_wire.signature_profile._sign_signed_info',side_effect=AssertionError('no signing')):
            self.assertEqual(self.bridge.expectation(self.token),before)
    def test_05_mutation_rejected(self):
        with self.assertRaises(Rejected):self.bridge.freeze(replace(self.signed,xml=self.signed.xml.replace(b'DAC7',b'CESOP')),self.c)
    def test_06_every_binary_and_binder_checked(self):
        m=self.bridge._input(self.token)['m02']
        for name in m['bytes']:
            bad=copy.deepcopy(m);bad['bytes'][name]=_b64(_unb64(bad['bytes'][name])+b' ')
            with self.subTest(name=name),self.assertRaises(Rejected):_restore(bad,self.key.pin,self.schemas)
        for name in ('edition_binding','schema_binding','unsigned_binding','namespace_sha256'):
            bad=copy.deepcopy(m);bad[name]='0'*64
            with self.subTest(name=name),self.assertRaises(Rejected):_restore(bad,self.key.pin,self.schemas)
        bad=copy.deepcopy(m);bad['evidence']['authority_acceptance']='PASS'
        with self.assertRaises(Rejected):_restore(bad,self.key.pin,self.schemas)
    def test_07_pin_catalog(self):
        m=self.bridge._input(self.token)['m02'];bad=copy.deepcopy(m);bad['pin']['checked_at']='2027-01-02T00:00:00+00:00'
        with self.assertRaises(Rejected):_restore(bad,self.key.pin,self.schemas)
        bad=copy.deepcopy(m);bad['catalog']={}
        with self.assertRaises(Rejected):_restore(bad,self.key.pin,self.schemas)
    def test_08_context_codec_limits(self):
        for k,value in [('envelope_revision',str(uuid4())),('input_revision',True),('predecessor_proof_id',self.c['proof_id'])]:
            c=copy.deepcopy(self.c);c[k]=value
            with self.subTest(k=k),self.assertRaises(Rejected):self.bridge.freeze(self.signed,c)
        for raw in (b'{"a":1,"a":2}',b'{ "a": 1}',b'{"a":NaN}'):
            with self.assertRaises(Rejected):_json(raw)
        for raw in ('YQ==\n','YQ','!!!!',''):
            with self.assertRaises(Rejected):_unb64(raw)
        with self.assertRaises(Rejected):_b64(b'a'*(LIMIT+1))
    def test_09_input_is_frozen(self):
        before=self.bridge.expectation(self.token);self.c['envelope']['result']='UNKNOWN'
        self.assertEqual(self.bridge.expectation(self.token),before)
    def test_10_sql_static_no_existing_changes(self):
        sql=(ROOT/'database/psttg-w11-envelope-commit-v1.sql').read_text()
        self.assertEqual(sql.lower().count('security definer'),3)
        self.assertNotIn('create or replace',sql.lower());self.assertNotIn('grant execute',sql.lower())
        self.assertNotIn('unlogged',sql.lower());self.assertNotIn('external_ack_performed:=true',sql)
        for n in ('bind_verified','read_bound','mark_ack_ready'):
            self.assertIn('psttg_w11_'+n+'_v1',sql)
        self.assertIn("external_ack_performed=false",sql)
        for forbidden in ('requests','urllib','http.client','sign_test','private_bytes','os.environ','PATCH'):
            self.assertNotIn(forbidden,(ROOT/'tests/psttg_wire/w11_bridge.py').read_text())

    def test_11_connection_cleanup_paths(self):
        for failure in ('none','begin','assertion','rollback','close','primary_and_cleanup'):
            with self.subTest(failure=failure):
                events=[];primary=RuntimeError('primary');cleanup=RuntimeError('cleanup')
                class Conn:
                    def query(inner,sql):
                        events.append(sql)
                        if sql=='begin' and failure in ('begin','primary_and_cleanup'):raise primary
                        if sql=='rollback' and failure in ('rollback','primary_and_cleanup'):raise cleanup
                    def close(inner):
                        events.append('close')
                        if failure in ('close','primary_and_cleanup'):raise cleanup
                class DB:
                    def connect(inner):return Conn()
                caught=None
                try:
                    with closed_connection(DB()) as conn:
                        conn.query('begin')
                        if failure=='assertion':raise primary
                except RuntimeError as exc:caught=exc
                self.assertEqual(events,['begin','rollback','close'])
                self.assertIs(caught,None if failure=='none' else primary if failure in ('begin','assertion','primary_and_cleanup') else cleanup)

class Database(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db=TestDatabase(native=NATIVE);cls.schemas=Schemas();cls.key=material()
        cls.edition=make_edition(cls.schemas);cls.multi=make_edition(cls.schemas,2,True,2)
        cls.admin=cls.db.connect()
        # A failed real SQL context gate prevents the N01-N22 matrix from starting.
        # Local PGlite deliberately cannot certify this native prerequisite.
        try:
            cls('test_N01_commit').connection_lifecycle_gate()
            if NATIVE:cls('test_N01_commit').context_boundary_gate()
        except BaseException as exc:
            try:cls.db.close()
            except BaseException as cleanup:exc.add_note('global cleanup: '+repr(cleanup))
            raise
    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        out=ROOT/'test-results'/'w11-connection-lifecycle.json'
        report=json.loads(out.read_text());report['global_cleanup']='PASS'
        out.write_text(json.dumps(report,indent=2)+'\n')
    def setUp(self):
        if not NATIVE and self._testMethodName.startswith('test_N') and self._testMethodName not in ('test_N20_environment','test_N21_free_input'):
            self.skipTest('NATIVE_NOT_RUN: native durability gate deliberately not bypassed in PGlite')
    def new(self,multi=False,predecessor=None):
        spec=EnvelopeSpec(str(uuid4()),'2026-09-30T10:00:00Z','SYNTHETIC-W11-'+str(uuid4()))
        signed=sign_test(build_envelope(self.multi if multi else self.edition,spec,self.schemas),self.key)
        f=self.db.request('context',revision=spec.revision,predecessor=predecessor)
        bridge=W11Bridge(self.key.pin,bytes.fromhex(f['key']),f['secret'],self.schemas)
        return bridge,bridge.freeze(signed,f['context']),signed,f
    def native(self):
        if not NATIVE:self.skipTest('NATIVE_NOT_RUN: independent PG17/transaction requirement')
    def count(self,table):return self.admin.query('select count(*)::int n from dv_market_private.'+table)[0]['n']
    def assert_backends_gone(self,pids):
        deadline=monotonic()+5
        while True:
            rows=self.admin.query('select pid from pg_stat_activity where pid = any($1::int[])',[pids])
            if not rows:return
            if monotonic()>=deadline:self.fail('test connections still active: '+repr(rows))
            sleep(0.05)
    def connection_lifecycle_gate(self):
        report={'gate':'W11-single-connection-close/1','mode':'native' if NATIVE else 'local',
            'status':'RUNNING','native_backend_end':'NATIVE_NOT_RUN','global_cleanup':'NOT_RUN'}
        out=ROOT/'test-results'/'w11-connection-lifecycle.json';out.parent.mkdir(exist_ok=True)
        def save():out.write_text(json.dumps(report,indent=2)+'\n')
        save()
        try:
            # Explicitly own both handles. Closing one never tears down the harness.
            a=self.db.connect()
            try:
                with closed_connection(self.db) as b:
                    self.assertEqual(a.query('select 1 as n')[0]['n'],1)
                    self.assertEqual(b.query('select 2 as n')[0]['n'],2)
                    pid=a.query('select pg_backend_pid() as pid')[0]['pid'] if NATIVE else None
                    self.assertTrue(a.close());self.assertTrue(a.close())
                    self.assertTrue(self.db.request('release',connection=a.identity))
                    with self.assertRaisesRegex(RuntimeError,'w11_connection_closed'):a.query('select 1')
                    with self.assertRaisesRegex(RuntimeError,'unknown or closed isolated connection'):
                        self.db.request('query',connection=a.identity,sql='select 1',params=[])
                    for identity in ('999999999','wrong',None,1):
                        with self.assertRaisesRegex(RuntimeError,'invalid isolated connection|unknown isolated connection'):
                            self.db.request('release',connection=identity)
                    self.assertEqual(b.query('select 3 as n')[0]['n'],3)
                    if NATIVE:
                        self.assert_backends_gone([pid]);report.update(native_backend_end='PASS',closed_backend_pid=pid)
            except BaseException as exc:
                try:a.close()
                except BaseException as cleanup:exc.add_note('connection cleanup: '+repr(cleanup))
                raise
            else:a.close()
            report['status']='PASS'
        except BaseException as exc:
            report.update(status='FAIL',error=repr(exc));save();raise
        save();print('W11_CONNECTION_LIFECYCLE '+json.dumps(report),flush=True)
    def context_boundary_gate(self):
        report={'gate':'V125-W11-context/1','mode':'native','status':'RUNNING','cases':[]}
        out=ROOT/'test-results'/'w11-shape-boundary.json';out.parent.mkdir(exist_ok=True)
        handles=[];pids=[]
        max_connections=self.admin.query('show max_connections')[0]['max_connections']
        def track(conn):
            handles.append(conn);pids.append(conn.query('select pg_backend_pid() as pid')[0]['pid'])
        def save():out.write_text(json.dumps(report,indent=2)+'\n')
        def run(name,operation):
            row={'case':name,'status':'RUNNING'};report['cases'].append(row);save()
            try:
                detail=operation()
                row.update(status='PASS',detail=detail)
            except Exception as exc:
                row.update(status='FAIL',error=str(exc));report['status']='FAIL';save()
                raise
            save();print('W11_SHAPE '+json.dumps(row),flush=True)
        tables=('psttg_w11_envelope_proof_v1','psttg_v2_ingress_v1','psttg_w11_ack_ready_v1')
        def counts():return {name:self.count(name) for name in tables}
        def reject(operation,pattern):
            before=counts()
            with closed_connection(self.db,track) as conn:
                conn.query('begin isolation level read committed')
                with self.assertRaisesRegex(RuntimeError,pattern) as caught:operation(conn)
            self.assertEqual(counts(),before)
            return {'error':str(caught.exception),'no_persistent_partial_write':True}
        def bind_raw(conn,bridge,data):
            # Negative tests only: mutate a verified fixture at the actual SQL gate.
            # The application bridge and its closed payload interface stay unchanged.
            return conn.query('select dv_market_private.psttg_w11_bind_verified_v1($1::jsonb,$2::bytea,$3::text) v',
                [json.dumps(data),bridge._mac(conn,['w11-verified-input/1',data]),bridge._secret])[0]['v']
        b,t,s,f=self.new();first={}
        def first_commit():
            self.assertIsNone(b._input(t)['context']['predecessor_proof_id'])
            with closed_connection(self.db,track) as conn:first.update(b.commit(conn,t))
            self.assertEqual(first['record_kind'],'BOUND');self.assertFalse(first['replay'])
            self.assertFalse(first['external_ack_performed'])
            return {'proof_id':first['proof_id'],'receipt_id':first['receipt_id']}
        run('first_null_commits_original_19_key_context',first_commit)
        history={}
        def committed_parent():
            hb,ht,hs,hf=self.new(predecessor=first['proof_id'])
            with closed_connection(self.db,track) as conn:result=hb.commit(conn,ht)
            self.assertEqual(result['record_kind'],'BOUND')
            history.update(bridge=hb,token=ht,signed=hs,fixture=hf,result=result)
            return {'proof_id':result['proof_id'],'predecessor_proof_id':first['proof_id']}
        run('committed_same_channel_bound_predecessor',committed_parent)
        nb,nt,ns,nf=self.new();valid=nb._input(nt)
        self.assertEqual(len(valid['context']),19)
        def bad_context(name,mutate,pattern):
            data=copy.deepcopy(valid);mutate(data['context'])
            run(name,lambda:reject(lambda conn:bind_raw(conn,nb,data),pattern))
        bad_context('missing_predecessor',lambda c:c.pop('predecessor_proof_id'),'w11_predecessor_shape')
        bad_context('extra_context_key',lambda c:c.update(extra=True),'v2_schema')
        for key in valid['context']:
            if key!='predecessor_proof_id':
                bad_context('null_'+key,lambda c,k=key:c.update({k:None}),'v2_schema')
                bad_context('missing_'+key,lambda c,k=key:c.pop(k),'v2_schema')
        for name,value in [('array',[]),('object',{}),('boolean',True),('number',1)]:
            bad_context('predecessor_'+name,lambda c,v=value:c.update(predecessor_proof_id=v),'w11_predecessor_shape')
        for name,value in [('empty',''),('invalid_uuid','not-a-uuid')]:
            bad_context('predecessor_'+name,lambda c,v=value:c.update(predecessor_proof_id=v),'invalid input syntax for type uuid')
        bad_context('foreign_channel_predecessor',lambda c:c.update(predecessor_proof_id=first['proof_id']),'w11_predecessor')
        bad_context('nonexistent_predecessor',lambda c:c.update(predecessor_proof_id=str(uuid4())),'query returned no rows')
        hb=history['bridge'];ht=history['token']
        self_ref=hb._input(ht);self_ref['context']['predecessor_proof_id']=history['result']['proof_id']
        run('self_predecessor',lambda:reject(lambda conn:bind_raw(conn,hb,self_ref),'w11_predecessor'))
        def uncommitted(conn):
            result=nb.bind_in_transaction(conn,nt)
            self.assertEqual(result['record_kind'],'BOUND')
            data=copy.deepcopy(valid);c=data['context'];c['proof_id']=str(uuid4())
            c['envelope']['payload']['detail_ref']=c['proof_id']
            c['predecessor_proof_id']=result['proof_id']
            return bind_raw(conn,nb,data)
        run('same_transaction_uncommitted_predecessor',lambda:reject(uncommitted,'w11_predecessor'))
        def conflict_parent():
            c=copy.deepcopy(history['fixture']['context']);c['envelope']['proof_ref']=str(uuid4())
            with closed_connection(self.db,track) as conn:conflict=hb.commit(conn,hb.freeze(history['signed'],c))
            self.assertEqual(conflict['record_kind'],'CONFLICT')
            data=hb._input(ht);data['context']['predecessor_proof_id']=conflict['proof_id']
            return reject(lambda conn:bind_raw(conn,hb,data),'w11_predecessor')
        run('conflict_record_not_a_bound_predecessor',conflict_parent)
        for name,obj in [('null',{'x':None}),('extra',{'x':1,'extra':1}),('missing',{})]:
            run('unchanged_v2_shape_'+name,lambda obj=obj:reject(lambda conn:conn.query(
                "select dv_market_private.psttg_v2_shape($1::jsonb,array['x'])",[json.dumps(obj)]),'v2_schema'))
        for name in ('root_null','root_extra','payload_null','payload_extra'):
            envelope=copy.deepcopy(valid['context']['envelope'])
            if name=='root_null':envelope['proof_ref']=None
            elif name=='root_extra':envelope['extra']=True
            elif name=='payload_null':envelope['payload']['detail_ref']=None
            else:envelope['payload']['extra']=True
            run('unchanged_receiver_'+name,lambda e=envelope:reject(lambda conn:conn.query(
                'select dv_market_private.psttg_v2_receive_v1($1::uuid,$2::jsonb,$3::bytea,$4::text)',
                [valid['context']['channel_id'],json.dumps(e),nb._mac(conn,e),nb._secret]),'v2_schema'))
        self.assertEqual(len(report['cases']),58)
        self.assertTrue(all(conn._closed for conn in handles))
        self.assert_backends_gone(pids)
        self.assertEqual(self.admin.query('show max_connections')[0]['max_connections'],max_connections)
        report['connection_budget']={'owned_handles':len(handles),'closed_handles':len(handles),
            'backend_pids':pids,'remaining_owned_backends':0,'max_connections':max_connections,
            'fixture_observer_connections':'outside Shape-gate handle ownership; unchanged'}
        report['status']='PASS';save()
        print('W11_SHAPE_CONNECTION_BUDGET '+json.dumps(report['connection_budget']),flush=True)
    def test_local_schema_and_durability_gate(self):
        if NATIVE:
            self.assertEqual(self.admin.query('show fsync')[0]['fsync'],'on')
            return
        rows=self.admin.query("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='dv_market_private' and c.relname in ('psttg_w11_envelope_proof_v1','psttg_w11_ack_ready_v1')")
        self.assertEqual(len(rows),2);self.assertTrue(all(r['relrowsecurity'] for r in rows))
        self.assertEqual(self.admin.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and proname like 'psttg_w11_%' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))"),[])
        fns=self.admin.query("select proname,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and proname like 'psttg_w11_%' and prosecdef")
        self.assertEqual(sorted(x['proname'] for x in fns),['psttg_w11_bind_verified_v1','psttg_w11_mark_ack_ready_v1','psttg_w11_read_bound_v1'])
        self.assertTrue(all('search_path=""' in x['proconfig'] for x in fns))
        b,t,s,f=self.new()
        with self.assertRaisesRegex(RuntimeError,'w11_durability'):b.commit(self.db.connect(),t)
        self.assertEqual(self.count('psttg_w11_envelope_proof_v1'),0)
        self.assertEqual(self.count('psttg_w11_ack_ready_v1'),0)
        for table in ('psttg_w11_envelope_proof_v1','psttg_w11_ack_ready_v1'):
            with self.assertRaisesRegex(RuntimeError,'w11_append_only|cannot truncate'):self.admin.query('truncate dv_market_private.'+table)
            with self.assertRaisesRegex(RuntimeError,'w11_private_entry'):self.admin.query('insert into dv_market_private.'+table+' default values')
    def test_N01_commit(self):
        b,t,s,f=self.new();r=b.commit(self.db.connect(),t)
        self.assertEqual(r['record_kind'],'BOUND');self.assertFalse(r['external_ack_performed'])
    def test_N02_multi(self):
        b,t,s,f=self.new(True);r=b.commit(self.db.connect(),t);self.assertEqual(r['record_kind'],'BOUND')
        read=b.observe_and_mark(self.db.connect(),b.expectation(t),False)
        restored=b.revalidate(read,b.expectation(t))
        self.assertEqual(restored,s)
        self.assertEqual(len(restored.unsigned.edition.positions),2)
        self.assertEqual(len(restored.unsigned.edition.positions[0].subject.seller_ids),2)
    def test_N03_independent(self):
        self.native();b,t,s,f=self.new();b.commit(self.db.connect(),t)
        out=b.observe_and_mark(self.db.connect(),b.expectation(t),False)
        self.assertEqual(_unb64(out['bundle']['input']['m02']['bytes']['signed']),s.xml)
    def test_N04_replay(self):
        b,t,s,f=self.new();a=b.commit(self.db.connect(),t);n=self.count('psttg_w11_envelope_proof_v1')
        with patch('psttg_wire.signature_profile._sign_signed_info',side_effect=AssertionError('no signing')):r=b.commit(self.db.connect(),t)
        self.assertEqual(a['proof_id'],r['proof_id']);self.assertTrue(r['replay']);self.assertEqual(n,self.count('psttg_w11_envelope_proof_v1'))
    def conflict(self,b,t,s,f,binders=False):
        c=copy.deepcopy(f['context'])
        if binders:
            c['envelope']['proof_ref']=str(uuid4());other=s
        else:
            spec=replace(s.unsigned.spec,creation_time='2026-09-30T10:00:01Z')
            # Different valid original signature, same logical K. New ephemeral signer history.
            other=sign_test(build_envelope(s.unsigned.edition,spec,self.schemas),TestKeyRef(self.key.pin,self.key.private_key))
        token=b.freeze(other,c);r=b.commit(self.db.connect(),token)
        self.assertEqual(r['record_kind'],'CONFLICT')
        self.assertNotEqual(r['proof_id'],c['proof_id'])
        replay=b.commit(self.db.connect(),token)
        self.assertTrue(replay['replay']);self.assertEqual(replay['proof_id'],r['proof_id'])
        read=b.observe_and_mark(self.db.connect(),b.expectation(token,r['proof_id']),False)
        self.assertEqual(_unb64(read['bundle']['input']['m02']['bytes']['signed']),other.xml)
        if NATIVE:
            with self.assertRaises((Rejected,RuntimeError)):b.observe_and_mark(self.db.connect(),b.expectation(t))
        return token,r
    def test_N05_other_bytes(self):
        b,t,s,f=self.new();b.commit(self.db.connect(),t);self.conflict(b,t,s,f)
    def test_N06_other_binder(self):
        b,t,s,f=self.new();b.commit(self.db.connect(),t);self.conflict(b,t,s,f,True)
    def test_N07_crash_precommit(self):
        self.native();b,t,s,f=self.new();w=self.db.connect()
        tables=('psttg_w11_envelope_proof_v1','psttg_v2_ingress_v1','psttg_w11_ack_ready_v1')
        before=[self.count(x) for x in tables]
        w.query('begin');b.bind_in_transaction(w,t)
        pid=w.query('select pg_backend_pid() p')[0]['p']
        self.admin.query('select pg_terminate_backend($1)',[pid])
        rows=self.admin.query('select * from dv_market_private.psttg_w11_envelope_proof_v1 where proof_id=$1',[f['context']['proof_id']]);self.assertEqual(rows,[])
        self.assertEqual(before,[self.count(x) for x in tables])
    def test_N08_fault_rollback(self):
        b,t,s,f=self.new();w=self.db.connect();before=[self.count(x) for x in ('psttg_w11_envelope_proof_v1','psttg_v2_ingress_v1')]
        w.query('begin');b.bind_in_transaction(w,t)
        with self.assertRaises(RuntimeError):w.query('select 1/0')
        w.query('rollback');self.assertEqual(before,[self.count(x) for x in ('psttg_w11_envelope_proof_v1','psttg_v2_ingress_v1')])
    def test_N09_retry(self):
        b,t,s,f=self.new();w=self.db.connect();w.query('begin');b.bind_in_transaction(w,t);w.query('rollback')
        self.assertFalse(b.commit(w,t)['replay']);self.assertTrue(b.commit(w,t)['replay'])
    def test_N10_parallel_identical(self):
        self.native();b,t,s,f=self.new();cs=[self.db.connect(),self.db.connect()]
        with ThreadPoolExecutor(2) as pool:rs=list(pool.map(lambda c:b.commit(c,t),cs))
        self.assertEqual(rs[0]['proof_id'],rs[1]['proof_id']);self.assertEqual(sorted(x['replay'] for x in rs),[False,True])
    def test_N11_parallel_conflict(self):
        self.native();b,t,s,f=self.new();c=copy.deepcopy(f['context']);c['proof_id']=str(uuid4());c['envelope']['payload']['detail_ref']=c['proof_id'];c['envelope']['proof_ref']=str(uuid4());other=b.freeze(s,c)
        cs=[self.db.connect(),self.db.connect()]
        with ThreadPoolExecutor(2) as pool:rs=list(pool.map(lambda pair:b.commit(*pair),zip(cs,[t,other])))
        self.assertEqual(sorted(x['record_kind'] for x in rs),['BOUND','CONFLICT'])
        for tok in (t,other):
            with self.assertRaises((Rejected,RuntimeError)):b.observe_and_mark(self.db.connect(),b.expectation(tok))
        # Race a new verified conflict against TX2. A pre-existing marker may
        # survive as history; it must never remain effective after the conflict.
        b,t,s,f=self.new();b.commit(self.db.connect(),t)
        c=copy.deepcopy(f['context']);c['envelope']['proof_ref']=str(uuid4());other=b.freeze(s,c)
        def marker_race():
            try:return b.observe_and_mark(self.db.connect(),b.expectation(t))
            except (Rejected,RuntimeError):return None
        with ThreadPoolExecutor(2) as pool:
            marker=pool.submit(marker_race);conflict=pool.submit(b.commit,self.db.connect(),other)
            self.assertEqual(conflict.result()['record_kind'],'CONFLICT');marker.result()
        read=b.observe_and_mark(self.db.connect(),b.expectation(t),False)
        self.assertFalse(read['eligible'])
    def test_N12_history(self):
        self.native();b,t,s,f=self.new();b.commit(self.db.connect(),t)
        b2,t2,s2,f2=self.new(True,predecessor=f['context']['proof_id']);b2.commit(self.db.connect(),t2)
        self.assertEqual(f2['context']['channel_id'],f['context']['channel_id'])
        out=b.observe_and_mark(self.db.connect(),b.expectation(t),False)
        self.assertEqual(_unb64(out['bundle']['input']['m02']['bytes']['signed']),s.xml)
    def corrupt(self,field):
        self.native();b,t,s,f=self.new();b.commit(self.db.connect(),t);c=self.db.connect();c.query('begin')
        c.query('alter table dv_market_private.psttg_w11_envelope_proof_v1 disable trigger w11_append_only')
        value="decode('00','hex')" if field=='ciphertext' else "gen_random_uuid()"
        c.query('update dv_market_private.psttg_w11_envelope_proof_v1 set '+field+'='+value+' where proof_id=$1',[f['context']['proof_id']])
        # Independent read requires committed corruption in this disposable database only.
        c.query('alter table dv_market_private.psttg_w11_envelope_proof_v1 enable trigger w11_append_only');c.query('commit')
        with self.assertRaises(RuntimeError):b.observe_and_mark(self.db.connect(),b.expectation(t),False)
    def test_N13_bytes(self):self.corrupt('ciphertext')
    def test_N14_binder(self):self.corrupt('envelope_revision')
    def test_N15_marker(self):
        self.native();b,t,s,f=self.new();b.commit(self.db.connect(),t)
        m=b.observe_and_mark(self.db.connect(),b.expectation(t));n=b.observe_and_mark(self.db.connect(),b.expectation(t))
        self.assertEqual(m['marker_id'],n['marker_id']);self.assertFalse(m['external_ack_performed'])
    def test_N16_same_backend_cannot_ack(self):
        b,t,s,f=self.new();w=self.db.connect();w.query('begin');b.bind_in_transaction(w,t)
        with self.assertRaises(RuntimeError):w.query('select dv_market_private.psttg_w11_read_bound_v1($1,$2)',[f['context']['proof_id'],f['secret']])
        w.query('rollback')
        b.commit(w,t)
        with self.assertRaises(RuntimeError):b.observe_and_mark(w,b.expectation(t))
        observer=self.db.connect();observer.query('begin')
        read=observer.query('select dv_market_private.psttg_w11_read_bound_v1($1,$2) v',[f['context']['proof_id'],f['secret']])[0]['v']
        o=read['observation'];o['observation_id']=str(uuid4())
        with self.assertRaises(RuntimeError):observer.query('select dv_market_private.psttg_w11_mark_ack_ready_v1($1::jsonb,$2::bytea,$3::bytea,$4)',[json.dumps(o),'\\x'+'00'*32,'\\x'+'00'*32,f['secret']])
        observer.query('rollback')
    def test_N17_no_external_action(self):
        self.native();b,t,s,f=self.new();b.commit(self.db.connect(),t);m=b.observe_and_mark(self.db.connect(),b.expectation(t));self.assertFalse(m['external_ack_performed'])
        r=b.observe_and_mark(self.db.connect(),b.expectation(t),False);self.assertFalse(r['real_receipt_adapter']);self.assertFalse(r['external_ack_performed'])
    def test_N18_lost_response(self):
        self.native();b,t,s,f=self.new();w=self.db.connect()
        class Lost:
            def query(self,sql,params=None):
                r=w.query(sql,params)
                if sql=='commit':raise OSError('synthetic reply lost after real commit')
                return r
        with self.assertRaises(CommitUnknown):b.commit(Lost(),t)
        b.observe_and_mark(self.db.connect(),b.expectation(t),False)
        self.assertTrue(b.commit(self.db.connect(),t)['replay'])
        observer=self.db.connect()
        class LostMarker:
            def query(self,sql,params=None):
                r=observer.query(sql,params)
                if sql=='commit':raise OSError('synthetic marker reply lost')
                return r
        with self.assertRaises(CommitUnknown):b.observe_and_mark(LostMarker(),b.expectation(t))
        self.assertIsNotNone(b.observe_and_mark(self.db.connect(),b.expectation(t),False)['marker'])
    def test_N19_restart(self):
        self.native();b,t,s,f=self.new();b.commit(self.db.connect(),t)
        self.assertTrue(self.db.request('restart')['restarted']);self.__class__.admin=self.db.connect()
        out=b.observe_and_mark(self.db.connect(),b.expectation(t),False)
        self.assertEqual(_unb64(out['bundle']['input']['m02']['bytes']['signed']),s.xml)
    def test_N20_environment(self):
        b,t,s,f=self.new();bad=copy.deepcopy(f['context']);bad['environment_binding']['environment']='PROD'
        with self.assertRaises(Rejected):b.freeze(s,bad)
        if NATIVE:
            b.commit(self.db.connect(),t)
            read=b.observe_and_mark(self.db.connect(),b.expectation(t),False)
            wrong=W11Bridge(replace(self.key.pin,checked_at=self.key.pin.checked_at.replace(year=2027)),bytes.fromhex(f['key']),f['secret'],self.schemas)
            with self.assertRaises(Rejected):wrong.revalidate(read,b.expectation(t))
            badread=copy.deepcopy(read);badread['bundle']['input']['m02']['catalog']={}
            with self.assertRaises(Rejected):b.revalidate(badread,b.expectation(t))
            bad=copy.deepcopy(f['context']);bad['attempt_transition_id']=str(uuid4())
            wrong_token=b.freeze(s,bad)
            with self.assertRaises(RuntimeError):b.commit(self.db.connect(),wrong_token)
    def test_N21_free_input(self):
        b,t,s,f=self.new()
        with self.assertRaises(Rejected):b.commit(self.db.connect(),{'status':'PASS'})
    def test_N22_acl_and_immutable(self):
        b,t,s,f=self.new();b.commit(self.db.connect(),t)
        b.observe_and_mark(self.db.connect(),b.expectation(t))
        rows=self.admin.query("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='dv_market_private' and c.relname in ('psttg_w11_envelope_proof_v1','psttg_w11_ack_ready_v1')")
        self.assertEqual(len(rows),2);self.assertTrue(all(x['relrowsecurity'] for x in rows))
        rows=self.admin.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='dv_market_private' and proname like 'psttg_w11_%' and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'))")
        self.assertEqual(rows,[])
        for table in ('psttg_w11_envelope_proof_v1','psttg_w11_ack_ready_v1'):
            acl=self.admin.query("select has_table_privilege(r,$1,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') allowed from unnest(array['anon','authenticated','service_role']) r",['dv_market_private.'+table])
            self.assertTrue(all(not row['allowed'] for row in acl))
            for operation in ('update '+table+' set contract=contract','delete from '+table,'truncate '+table,'insert into '+table+' select * from dv_market_private.'+table):
                # Fully qualify only the leading object; all operations are denied.
                sql=operation.replace(table,'dv_market_private.'+table,1)
                with self.subTest(operation=operation),self.assertRaises(RuntimeError):self.admin.query(sql)
        for sql in ('update dv_market_private.psttg_w11_envelope_proof_v1 set event_ref=gen_random_uuid()',
                    'delete from dv_market_private.psttg_w11_envelope_proof_v1',
                    'truncate dv_market_private.psttg_w11_envelope_proof_v1',
                    'insert into dv_market_private.psttg_w11_envelope_proof_v1 select * from dv_market_private.psttg_w11_envelope_proof_v1'):
            with self.subTest(sql=sql),self.assertRaises(RuntimeError):self.admin.query(sql)
        self.db.request('quarantine',channel=f['context']['channel_id'])
        if NATIVE:
            with self.assertRaises((Rejected,RuntimeError)):b.observe_and_mark(self.db.connect(),b.expectation(t))
