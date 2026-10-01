"""Private deterministic V129 regression. Offline; no DB or native W11 runner.

Run directly with python -B tests/psttg_wire/test_dip_lock.py.
Test facades delegate to public lxml methods; they never patch the C validator.
"""
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import json
from pathlib import Path
import sys
from threading import Event, Lock, Thread, get_ident, get_native_id, local
from time import monotonic_ns
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from psttg_wire.security import Schemas, Rejected, DIP, sha
from psttg_wire.envelope import EnvelopeSpec, build_envelope, secure_parse
from psttg_wire.signature_profile import sign_test, verify_signature
from psttg_wire.signed_validation import validate_bound_projection
from psttg_wire.test_m02 import material, make_edition
from psttg_wire.test_w11 import _N11Observation, context
from psttg_wire.w11_bridge import W11Bridge, _restore, SOURCES

EVENTS = []
CASES = []
TLS = local()
LOG_LOCK = Lock()
FIELDS = ('domain', 'domain_name', 'type', 'type_name', 'level', 'level_name',
          'message', 'line', 'column', 'path', 'filename')

def emit(kind, **fields):
    with LOG_LOCK:
        event = dict(seq=len(EVENTS) + 1, kind=kind, time_ns=monotonic_ns(),
            case=getattr(TLS, 'case', 'setup'), role=getattr(TLS, 'role', 'main'),
            thread_id=get_ident(), native_thread_id=get_native_id(), **fields)
        EVENTS.append(event)
        return event

def entries(snapshot):
    return [{k: getattr(e, k, None) for k in FIELDS} for e in snapshot]

def wait(event, label):
    emit('wait_begin', barrier=label)
    if not event.wait(10):
        raise TimeoutError(label)
    emit('wait_end', barrier=label)

class ProbedLock:
    """Observe the actual production Lock, including a decisive nonblocking try."""
    def __init__(self, original, attempted):
        self.original = original
        self.attempted = attempted
        self.owner = None

    def __enter__(self):
        emit('lock_attempt', lock_id=id(self.original))
        if getattr(TLS, 'role', None) == 'B':
            acquired = self.original.acquire(blocking=False)
            emit('B_nonblocking_acquire', lock_id=id(self.original), acquired=acquired)
            self.attempted.set()
        else:
            acquired = False
        if not acquired and not self.original.acquire(timeout=10):
            raise TimeoutError('production_lock_acquire')
        self.owner = get_ident()
        emit('lock_acquired', lock_id=id(self.original))
        return self

    def __exit__(self, *exc):
        emit('lock_release', lock_id=id(self.original), exception=exc[0].__name__ if exc[0] else None)
        self.owner = None
        self.original.release()

class CoordinatedValidator:
    def __init__(self, original, lock, a_ready, b_attempted, b_done, separate):
        self.original, self.lock = original, lock
        self.a_ready, self.b_attempted, self.b_done = a_ready, b_attempted, b_done
        self.separate = separate

    def held(self):
        if self.lock.owner != get_ident():
            raise AssertionError('validator_entered_without_own_instance_lock')

    def assertValid(self, root):
        self.held()
        emit('assertValid_enter', validator_id=id(self.original), lock_id=id(self.lock.original))
        result = self.original.assertValid(root)
        emit('assertValid_end', validator_id=id(self.original), result=result)
        if TLS.role == 'B':
            snapshot = self.original.error_log
            emit('B_consumed_error_log', validator_id=id(self.original), entries=entries(snapshot))
        return result

    def validate(self, root):
        self.held()
        emit('raw_validate_enter', validator_id=id(self.original))
        result = self.original.validate(root)
        emit('raw_validate_end', validator_id=id(self.original), result=result)
        return result

    @property
    def error_log(self):
        self.held()
        emit('A_pre_snapshot_barrier', validator_id=id(self.original))
        self.a_ready.set()
        wait(self.b_done if self.separate else self.b_attempted,
             'B_finished_independent' if self.separate else 'B_attempted_same_lock')
        started = monotonic_ns()
        snapshot = self.original.error_log  # Exactly one read; return this same copy.
        finished = monotonic_ns()
        emit('A_consumed_error_log', validator_id=id(self.original),
             read_start_ns=started, read_end_ns=finished, entries=entries(snapshot),
             snapshot_object_id=id(snapshot))
        return snapshot

class RawFault:
    """Fault injection only at the raw call, through a real public XSD API."""
    def __init__(self, original, unsigned, mode):
        self.original, self.unsigned, self.mode = original, unsigned, mode
        self.log_reads = 0

    def assertValid(self, root):
        return self.original.assertValid(root)

    def validate(self, root):
        if self.mode == 'validate_exception':
            return self.original.validate(object())  # Real lxml TypeError.
        if self.mode in ('wrong_reason', 'unexpected_pass'):
            root = secure_parse(self.unsigned)
            if self.mode == 'wrong_reason':
                root.set('version', 'INVALID-SYNTHETIC-VERSION')
        return self.original.validate(root)

    @property
    def error_log(self):
        self.log_reads += 1
        if self.mode == 'snapshot_exception':
            raise RuntimeError('synthetic_snapshot_failure')
        snapshot = self.original.error_log
        emit('fault_consumed_error_log', mode=self.mode, entries=entries(snapshot))
        return snapshot

class DIPLockTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schemas = Schemas()
        cls.edition = make_edition(cls.schemas)
        cls.spec = EnvelopeSpec('00000000-0000-0000-0000-000000001fc1',
                               '2026-09-30T10:00:00Z', 'SYNTHETIC-V129-OFFLINE-ONLY')
        cls.key = material()
        cls.unsigned = build_envelope(cls.edition, cls.spec, cls.schemas)
        cls.signed = sign_test(cls.unsigned, cls.key)
        cls.verified = verify_signature(cls.signed, cls.key.pin)

    def setUp(self):
        TLS.case = self._testMethodName
        TLS.role = 'main'

    def success(self, schemas=None):
        result = validate_bound_projection(self.verified, self.edition, self.spec,
                                           schemas or self.schemas)
        self.assertEqual(result.status, 'OFFLINE_PROFILE_VERIFIED')
        self.assertEqual(result.raw_xsd_error_type, 'SCHEMAV_ELEMENT_CONTENT')
        return result

    def test_01_A_and_B_alone(self):
        validator = self.schemas.validators['dip.xsd']
        with self.schemas._dip_lock:
            a = validator.validate(secure_parse(self.signed.xml))
            log_a = tuple(validator.error_log)
        self.assertIs(a, False)
        self.assertEqual(len(log_a), 1)
        self.assertEqual(log_a[0].type_name, 'SCHEMAV_ELEMENT_CONTENT')
        self.assertIn('{http://www.w3.org/2000/09/xmldsig#}Signature', log_a[0].message)
        with self.schemas._dip_lock:
            b = validator.validate(secure_parse(self.unsigned.xml))
            log_b = tuple(validator.error_log)
        self.assertIs(b, True)
        self.assertEqual(log_b, ())
        self.success()
        CASES.append(dict(case=TLS.case, status='PASS', A=a, A_entries=entries(log_a),
                          B=b, B_entries=entries(log_b)))

    def concurrent(self, separate):
        case = TLS.case
        a_schemas = self.schemas
        b_schemas = Schemas() if separate else a_schemas
        self.assertEqual(a_schemas._dip_lock is b_schemas._dip_lock, not separate)
        self.assertEqual(a_schemas.validators['dip.xsd'] is b_schemas.validators['dip.xsd'], not separate)
        a_ready, b_attempted, b_done = Event(), Event(), Event()
        originals = []
        results, failures = {}, []
        for schema in [a_schemas] + ([b_schemas] if separate else []):
            lock, validator = schema._dip_lock, schema.validators['dip.xsd']
            originals.append((schema, lock, validator))
            probe = ProbedLock(lock, b_attempted)
            schema._dip_lock = probe
            schema.validators['dip.xsd'] = CoordinatedValidator(validator, probe,
                a_ready, b_attempted, b_done, separate)
        def worker(role, action):
            TLS.case, TLS.role = case, role
            try:
                action()
            except BaseException as exc:
                failures.append((role, type(exc).__name__, str(exc)))
        def a():
            results['A'] = self.success(a_schemas).status
            emit('A_complete')
        def b():
            wait(a_ready, 'A_has_finished_raw_validate')
            b_schemas.validate(self.unsigned.xml, 'dip.xsd', '{' + DIP + '}dip')
            results['B'] = 'VALID'
            emit('B_complete')
            b_done.set()
        workers = [Thread(target=worker, args=('A', a), daemon=True),
                   Thread(target=worker, args=('B', b), daemon=True)]
        try:
            for thread in workers: thread.start()
            for thread in workers: thread.join(25)
            self.assertFalse(any(t.is_alive() for t in workers), 'deadlock')
            self.assertEqual(failures, [])
            events = [e for e in EVENTS if e['case'] == case]
            def one(kind, role):
                matches = [e for e in events if e['kind'] == kind and e['role'] == role]
                self.assertEqual(len(matches), 1, (kind, role))
                return matches[0]
            ae = one('raw_validate_end', 'A')
            snap = one('A_consumed_error_log', 'A')
            attempt = one('B_nonblocking_acquire', 'B')
            entered = one('assertValid_enter', 'B')
            bend = one('B_complete', 'B')
            self.assertIs(ae['result'], False)
            self.assertEqual(len(snap['entries']), 1)
            self.assertEqual(snap['entries'][0]['type_name'], 'SCHEMAV_ELEMENT_CONTENT')
            self.assertEqual(one('B_consumed_error_log', 'B')['entries'], [])
            self.assertLess(ae['time_ns'], attempt['time_ns'])
            self.assertNotEqual(ae['thread_id'], entered['thread_id'])
            if separate:
                self.assertIs(attempt['acquired'], True)
                self.assertLess(bend['time_ns'], snap['read_start_ns'])
                self.assertNotEqual(ae['validator_id'], entered['validator_id'])
            else:
                self.assertIs(attempt['acquired'], False)
                self.assertLess(attempt['time_ns'], snap['read_start_ns'])
                self.assertLess(snap['read_end_ns'], entered['time_ns'])
                self.assertEqual(ae['validator_id'], entered['validator_id'])
            self.assertEqual(results, dict(A='OFFLINE_PROFILE_VERIFIED', B='VALID'))
            CASES.append(dict(case=case, status='PASS', separate=separate,
                A=results['A'], B=results['B'], B_acquired_at_first_try=attempt['acquired'],
                A_snapshot=snap, order_verified=True))
        finally:
            for schema, lock, validator in originals:
                schema._dip_lock, schema.validators['dip.xsd'] = lock, validator

    def test_02_shared_forced_competition(self): self.concurrent(False)
    def test_03_separate_instances_independent(self): self.concurrent(True)

    def raw_fault(self, mode, error, message, expected_reads):
        original = self.schemas.validators['dip.xsd']
        fault = RawFault(original, self.unsigned.xml, mode)
        self.schemas.validators['dip.xsd'] = fault
        try:
            with self.assertRaises(error) as caught:
                self.success()
            if message is not None: self.assertEqual(str(caught.exception), message)
            self.assertEqual(fault.log_reads, expected_reads)
            self.assertFalse(self.schemas._dip_lock.locked())
        finally:
            self.schemas.validators['dip.xsd'] = original
        # A different worker must be able to run a full subsequent validation.
        with ThreadPoolExecutor(1) as pool:
            self.assertEqual(pool.submit(self.success).result(timeout=10).status,
                             'OFFLINE_PROFILE_VERIFIED')
        CASES.append(dict(case=TLS.case, status='PASS', expected_error=message or error.__name__,
                          snapshot_reads=fault.log_reads, subsequent_other_thread='PASS'))

    def test_04_wrong_raw_reason_rejected(self):
        self.raw_fault('wrong_reason', Rejected, 'm02_raw_reject_reason', 1)

    def test_05_unexpected_raw_pass_rejected(self):
        self.raw_fault('unexpected_pass', Rejected, 'm02_signed_raw_unexpected_xsd_pass', 0)

    def test_06_raw_validator_exception_releases(self):
        self.raw_fault('validate_exception', TypeError, None, 0)

    def test_07_snapshot_exception_releases(self):
        self.raw_fault('snapshot_exception', RuntimeError, 'synthetic_snapshot_failure', 1)

    def test_08_normal_validator_exception_releases(self):
        invalid = ('<dip xmlns="' + DIP + '" version="2.0"/>').encode()
        with self.assertRaisesRegex(Rejected, '^xsd_invalid:dip.xsd$'):
            self.schemas.validate(invalid, 'dip.xsd', '{' + DIP + '}dip')
        self.assertFalse(self.schemas._dip_lock.locked())
        with ThreadPoolExecutor(1) as pool:
            node = pool.submit(self.schemas.validate, self.unsigned.xml, 'dip.xsd',
                               '{' + DIP + '}dip').result(timeout=10)
        self.assertEqual(node.tag, '{' + DIP + '}dip')
        CASES.append(dict(case=TLS.case, status='PASS', subsequent_other_thread='PASS'))

    def test_09_v127_facade_and_dynamic_source_binding(self):
        bridge = W11Bridge(self.key.pin, b'x' * 32, 'synthetic-only-storage-secret-000000', self.schemas)
        first = context(self.spec)
        second = deepcopy(first)
        second['envelope']['proof_ref'] = '00000000-0000-0000-0000-000000001fc2'
        tokens = dict(marker=bridge.freeze(self.signed, first), conflict=bridge.freeze(self.signed, second))
        expected = {n: sha(Path(__file__).with_name(n).read_bytes()) for n in SOURCES}
        m = bridge._input(tokens['marker'])['m02']
        self.assertEqual(m['verifier_sources'], expected)
        for name, old in [('security.py', '5b856fe57b9e43001ff400f823246ece2d1e130a766d769290e2243f087fb308'),
                          ('signed_validation.py', '1e4b7edce0bf67d69aa2b50620b78b2527c240c9af67716e1667ee8def2aeed3')]:
            self.assertNotEqual(expected[name], old)
            bad = deepcopy(m)
            bad['verifier_sources'][name] = old
            with self.assertRaisesRegex(Rejected, '^w11_full_revalidation$'):
                _restore(bad, self.key.pin, self.schemas)
        original = self.schemas.validators['dip.xsd']
        original_lock = self.schemas._dip_lock
        observation = _N11Observation(original, bridge, tokens)
        self.schemas.validators['dip.xsd'] = observation
        try:
            with ThreadPoolExecutor(2) as pool:
                futures = {role: pool.submit(observation.future, role, bridge._input, token)
                           for role, token in tokens.items()}
                for future in futures.values():
                    self.assertEqual(future.result(timeout=15)['m02']['verifier_sources'], expected)
            observation.finish(futures)
            self.assertEqual(observation.incomplete, [])
            snapshots = [e for e in observation.events if e['kind'] == 'consumed_error_log']
            self.assertEqual(len(snapshots), 2)
            self.assertEqual({s['role'] for s in snapshots}, {'marker', 'conflict'})
            self.assertTrue(all(s['entry_count'] == 1 and s['entries'][0]['type_name'] == 'SCHEMAV_ELEMENT_CONTENT' for s in snapshots))
            self.assertIs(self.schemas._dip_lock, original_lock)
        finally:
            self.schemas.validators['dip.xsd'] = original
        CASES.append(dict(case=TLS.case, status='PASS', verifier_sources=expected,
            old_source_hashes='REJECTED', v127_status='OBSERVATION_CAPTURED', snapshots=snapshots,
            note='local facade compatibility; not an N11 or native execution'))

if __name__ == '__main__':
    blocked = []
    def offline(event, args):
        if event.startswith('socket.') or event in ('subprocess.Popen', 'os.system', 'os.fork', 'os.exec'):
            blocked.append(event)
            raise RuntimeError('offline_only:' + event)
    sys.addaudithook(offline)
    result = unittest.TextTestRunner(verbosity=2, failfast=True).run(
        unittest.defaultTestLoader.loadTestsFromTestCase(DIPLockTests))
    out = Path(__file__).resolve().parents[2] / 'test-results'
    out.mkdir(exist_ok=True)
    report = dict(profile='V129-DIP-lock-local/1', status='PASS' if result.wasSuccessful() and not blocked else 'FAIL',
        tests=result.testsRun, failures=len(result.failures), errors=len(result.errors),
        cases=CASES, events=EVENTS, forbidden_io_attempts=blocked, native_acceptance='NATIVE_NOT_RUN',
        test_sha256=sha(Path(__file__).read_bytes()))
    (out / 'w11-dip-lock-local.json').write_text(json.dumps(report, indent=2) + '\n')
    raise SystemExit(0 if report['status'] == 'PASS' else 1)
