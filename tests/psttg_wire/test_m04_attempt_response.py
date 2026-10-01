"""Private synthetic M04 regression; direct execution, no transport or DB.

Audit guard covers this process, including imports/fixture setup. Canary audit
events test the guard without making a network/process call. Random ephemeral
test-key generation does not affect case decisions or their deterministic order.
"""
import ast
from dataclasses import FrozenInstanceError, replace
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

FORBIDDEN = []


def forbid_io(event, args):
    if event.startswith(('socket.', 'subprocess.', 'os.exec', 'os.spawn',
                         'os.posix_spawn')) or event in ('os.system', 'os.fork'):
        FORBIDDEN.append(event)
        raise RuntimeError('m04_forbidden_io:' + event)


sys.addaudithook(forbid_io)
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from psttg_wire import fixtures as f
from psttg_wire.security import Schemas, Rejected, sha
from psttg_wire.envelope import EnvelopeSpec, build_envelope, secure_parse
from psttg_wire.signature_profile import sign_test, verify_signature
from psttg_wire.test_m02 import material, make_edition
from psttg_wire.m04_attempt_response import (
    AttemptBook, Scope, ProofReference, ResponseInput, ServiceId,
    Status, Phase, Presence,
)


class M04Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schemas = Schemas()
        cls.key = material()
        cls.edition = make_edition(cls.schemas)
        cls.verified = []
        # Same edition, distinct envelope revisions/tickets/signed original bytes.
        for n in (1, 2):
            spec = EnvelopeSpec(f.uid(8000+n), '2026-09-30T10:00:00Z',
                                'SYNTHETIC-M04-ATTEMPT-'+str(n))
            signed = sign_test(build_envelope(cls.edition, spec, cls.schemas), cls.key)
            cls.verified.append(verify_signature(signed, cls.key.pin))

    def setUp(self):
        self.book = AttemptBook()
        self.scope = Scope('TEST', f.uid(8501), f.uid(8502))
        self.proofs = [ProofReference(f.uid(8600+n), f.uid(8700+n), f.uid(8800+n),
            n, v.signed.unsigned.spec.revision, self.edition.binding, sha(v.signed.xml))
            for n, v in enumerate(self.verified, 1)]
        self.seq = 9000
        self.start_io = len(FORBIDDEN)

    def tearDown(self):
        self.assertEqual(len(FORBIDDEN), self.start_io, 'unexpected forbidden I/O')

    def prepare(self, n=0, scope=None):
        return self.book.prepare(self.verified[n], self.proofs[n], scope or self.scope,
                                 self.schemas)

    def response(self, n=0, **changes):
        self.seq += 1
        r = ResponseInput(f.uid(self.seq), self.scope, Phase.START, Presence.OBSERVED,
                          b'{"synthetic":"response-A"}', self.proofs[n].attempt_ref)
        return replace(r, **changes)

    def service(self, value='SYNTHETIC-DTN-A', kind='datentransfernummer'):
        return (ServiceId(kind, value),)

    def test_01_exact_bound_input_and_actual_position(self):
        a = self.prepare().attempt
        self.assertEqual(a.proof, self.proofs[0])
        self.assertEqual(a.signed_bytes, self.verified[0].signed.xml)
        self.assertEqual(sha(a.signed_bytes), a.proof.signed_sha256)
        self.assertEqual(a.delivery_revision, self.edition.delivery.revision)
        self.assertEqual(a.source_revision, self.edition.delivery.source_revision)
        self.assertEqual(a.item_position, secure_parse(a.signed_bytes)[1][0].get('consignmentItemPosition'))
        self.assertEqual(a.item_position, '1')
        self.assertNotEqual(a.item_position, '0')
        self.assertEqual(a.transfer_ticket, self.verified[0].signed.unsigned.spec.transfer_ticket)
        self.assertEqual(a.prepared_order, 1)

    def test_02_identical_attempt_canonical_replay(self):
        a = self.prepare().attempt
        d = self.prepare()
        self.assertEqual(d.status, Status.REPLAY)
        self.assertIs(d.attempt, a)
        self.assertEqual(len(self.book.attempt_events), 1)

    def test_03_same_attempt_changed_valid_signed_bytes_conflict(self):
        a = self.prepare().attempt
        changed = replace(self.proofs[1], attempt_ref=self.proofs[0].attempt_ref)
        d = self.book.prepare(self.verified[1], changed, self.scope, self.schemas)
        self.assertEqual(d.status, Status.CONFLICT)
        self.assertIs(self.book.attempts[0], a)
        self.assertEqual(len(self.book.attempt_events), 2)
        self.assertEqual(self.prepare().status, Status.CONFLICT)

    def test_04_first_observed_service_id_and_exact_replay(self):
        self.prepare()
        r = self.response(service_ids=self.service())
        d = self.book.observe(r)
        self.assertEqual(d.status, Status.BOUND)
        self.assertEqual(d.observation.original_sha256, sha(r.original_bytes))
        self.assertEqual(d.observation.order, 2)
        replay = self.book.observe(r)
        self.assertEqual(replay.status, Status.REPLAY)
        self.assertIs(replay.observation, d.observation)
        self.assertEqual(len(self.book.observations), 1)

    def test_05_scoped_id_identical_bytes_new_observation_idempotent(self):
        self.prepare()
        self.book.observe(self.response(service_ids=self.service()))
        d = self.book.observe(self.response(attempt_ref=None, service_ids=self.service()))
        self.assertEqual(d.status, Status.REPLAY)
        self.assertEqual(d.attempt.proof.attempt_ref, self.proofs[0].attempt_ref)
        self.assertEqual(len(self.book.observations), 2)

    def test_06_same_service_id_other_bytes_conflict_no_overwrite(self):
        self.prepare()
        r = self.response(service_ids=self.service())
        old = self.book.observe(r).observation
        d = self.book.observe(self.response(service_ids=self.service(), original_bytes=b'changed'))
        self.assertEqual(d.status, Status.CONFLICT)
        self.assertIs(self.book.observations[0], old)
        self.assertEqual(old.original_sha256, sha(r.original_bytes))
        self.assertEqual(self.book.observe(r).status, Status.CONFLICT)

    def test_07_other_environment_not_global_identity(self):
        self.prepare()
        r = self.response(service_ids=self.service())
        self.book.observe(r)
        other = replace(self.scope, environment='SYNTHETIC_OTHER')
        d = self.book.observe(self.response(scope=other, service_ids=self.service(), original_bytes=b'other'))
        self.assertEqual(d.status, Status.UNRESOLVED)
        self.assertEqual(self.book.observe(r).status, Status.REPLAY)
        # No prepared OTHER envelope is possible under the unchanged TEST-only M02 contract.
        with self.assertRaises(Rejected):
            self.prepare(scope=other)

    def test_08_wrong_account_not_positive(self):
        self.prepare()
        d = self.book.observe(self.response(scope=replace(self.scope, account_profile=f.uid(8999))))
        self.assertEqual(d.status, Status.UNRESOLVED)

    def test_09_channel_and_account_scopes_independent(self):
        self.prepare()
        other = Scope('TEST', f.uid(8998), f.uid(8999))
        self.prepare(1, other)
        a = self.book.observe(self.response(service_ids=self.service()))
        b = self.book.observe(self.response(1, scope=other, service_ids=self.service(), original_bytes=b'B'))
        self.assertEqual((a.status, b.status), (Status.BOUND, Status.BOUND))

    def test_10_wrong_item_position_never_fixture_zero(self):
        self.prepare()
        self.assertEqual(self.book.observe(self.response(item_position='0', service_ids=self.service())).status,
                         Status.UNRESOLVED)
        self.assertEqual(self.book.observe(self.response(item_position='1', service_ids=self.service())).status,
                         Status.BOUND)

    def test_11_late_response_keeps_old_attempt(self):
        self.prepare()
        self.book.observe(self.response(service_ids=self.service()))
        self.prepare(1)
        d = self.book.observe(self.response(attempt_ref=None, phase=Phase.START,
                                          service_ids=self.service()))
        self.assertEqual(d.status, Status.REPLAY)
        self.assertEqual(d.attempt.proof.attempt_ref, self.proofs[0].attempt_ref)
        d = self.book.observe(self.response(attempt_ref=None, phase=Phase.PROTOCOL,
                                          transfer_ticket=self.book.attempts[0].transfer_ticket,
                                          service_ids=self.service(), original_bytes=b'late'))
        self.assertEqual(d.status, Status.BOUND)
        self.assertEqual(d.attempt.proof.attempt_ref, self.proofs[0].attempt_ref)

    def test_12_swapped_known_service_responses_conflict(self):
        self.prepare(); self.prepare(1)
        self.book.observe(self.response(service_ids=self.service('A')))
        self.book.observe(self.response(1, service_ids=self.service('B'), original_bytes=b'B'))
        d = self.book.observe(self.response(1, service_ids=self.service('A')))
        self.assertEqual(d.status, Status.CONFLICT)
        self.assertEqual(self.book.observe(self.response(service_ids=self.service('B'), original_bytes=b'B')).status,
                         Status.CONFLICT)

    def test_13_swapped_first_responses_ticket_constraints(self):
        a = self.prepare().attempt; b = self.prepare(1).attempt
        d = self.book.observe(self.response(service_ids=self.service(), transfer_ticket=b.transfer_ticket))
        self.assertEqual(d.status, Status.CONFLICT)
        self.assertNotEqual(a.transfer_ticket, b.transfer_ticket)

    def test_14_no_anchor_unresolved(self):
        self.prepare()
        for ids in ((), self.service()):
            self.assertEqual(self.book.observe(self.response(attempt_ref=None, service_ids=ids)).status,
                             Status.UNRESOLVED)

    def test_15_service_ids_not_mandatory_with_explicit_anchor(self):
        self.prepare()
        self.assertEqual(self.book.observe(self.response()).status, Status.BOUND)

    def test_16_shared_edition_message_is_ambiguous_not_latest(self):
        a = self.prepare().attempt; self.prepare(1)
        d = self.book.observe(self.response(attempt_ref=None, message_ref=a.message_ref))
        self.assertEqual(d.status, Status.UNRESOLVED)
        self.assertEqual(d.reason, 'ambiguous_attempt')

    def test_17_contradictory_known_ids_conflict(self):
        self.prepare(); self.prepare(1)
        self.book.observe(self.response(service_ids=self.service('A')))
        self.book.observe(self.response(1, service_ids=self.service('B', 'messageId')))
        ids = self.service('A') + self.service('B', 'messageId')
        self.assertEqual(self.book.observe(self.response(attempt_ref=None, service_ids=ids)).status, Status.CONFLICT)

    def test_18_absent_and_lost_are_distinct_unknown_no_retry_no_sign(self):
        a = self.prepare().attempt
        with patch('psttg_wire.signature_profile.sign_test', side_effect=AssertionError('resign')):
            for presence in (Presence.NOT_OBSERVED, Presence.POSSIBLY_LOST):
                d = self.book.observe(self.response(presence=presence, original_bytes=None))
                self.assertEqual(d.status, Status.UNKNOWN)
                self.assertIsNone(d.observation.original_sha256)
                self.assertEqual(d.reason, presence.value)
                self.assertFalse(d.external_ack_performed)
                self.assertFalse(d.real_receipt_adapter)
        self.assertEqual(self.book.attempts, (a,))
        self.assertEqual(len(self.book.attempt_events), 1)
        self.assertEqual(a.signed_bytes, self.verified[0].signed.xml)

    def test_19_unknown_phase_kept_even_with_bytes(self):
        self.prepare()
        d = self.book.observe(self.response(phase=Phase.UNKNOWN, service_ids=self.service()))
        self.assertEqual(d.status, Status.UNKNOWN)
        self.assertEqual(self.book.observe(self.response(attempt_ref=None, service_ids=self.service())).status,
                         Status.UNRESOLVED)

    def test_20_neutral_phases_http_status_never_authority_ack(self):
        self.prepare()
        for phase in (Phase.START, Phase.UPLOAD, Phase.FINISH, Phase.PROTOCOL, Phase.NN, Phase.ACK):
            d = self.book.observe(self.response(phase=phase, http_status=201))
            self.assertEqual(d.status, Status.BOUND)
            self.assertFalse(d.external_ack_performed)
            self.assertFalse(d.real_receipt_adapter)
        self.assertEqual({s.value for s in Status}, {'BOUND','REPLAY','CONFLICT','UNRESOLVED','UNKNOWN'})

    def test_21_same_service_id_different_phase_different_body(self):
        self.prepare()
        self.book.observe(self.response(service_ids=self.service()))
        d = self.book.observe(self.response(phase=Phase.UPLOAD, service_ids=self.service(), original_bytes=b'upload'))
        self.assertEqual(d.status, Status.BOUND)

    def test_22_observation_ref_conflict_preserves_canonical(self):
        self.prepare()
        r = self.response()
        old = self.book.observe(r).observation
        changed = replace(r, original_bytes=b'changed')
        self.assertEqual(self.book.observe(changed).status, Status.CONFLICT)
        count = len(self.book.observations)
        self.assertEqual(self.book.observe(changed).status, Status.CONFLICT)
        self.assertEqual(len(self.book.observations), count)
        self.assertIs(self.book.observations[0], old)

    def test_23_immutable_values_and_rejected_mutable_inputs(self):
        a = self.prepare().attempt
        with self.assertRaises(FrozenInstanceError):
            a.item_position = '0'
        for changes in ({'original_bytes': bytearray(b'bad')}, {'service_ids': []},
                        {'doc_refs': []}, {'origin': 'real'}, {'http_status': True}):
            with self.assertRaises(Rejected):
                self.response(**changes)
        self.assertIsInstance(self.book.attempts, tuple)
        self.assertIsInstance(self.book.observations, tuple)

    def test_24_proof_hash_revision_edition_binding_enforced(self):
        for changes in ({'signed_sha256': '0'*64}, {'edition_binding': '0'*64},
                        {'envelope_revision': f.uid(9990)}):
            with self.assertRaises(Rejected):
                self.book.prepare(self.verified[0], replace(self.proofs[0], **changes), self.scope, self.schemas)
        self.assertEqual(self.book.attempts, ())

    def test_25_scope_and_identity_type_and_echo_boundaries(self):
        self.prepare()
        for field, value in (('message_ref','foreign'), ('doc_refs',('foreign',)),
                             ('transfer_ticket','SYNTHETIC-FOREIGN')):
            self.assertEqual(self.book.observe(self.response(**{field:value})).status, Status.UNRESOLVED)
        with self.assertRaises(Rejected):
            self.response(service_ids=self.service()+self.service('another'))
        with self.assertRaises(Rejected):
            Scope('PROD', f.uid(1), None)

    def test_26_repeated_unresolved_is_not_positive_correlation(self):
        r = self.response(attempt_ref=None)
        first = self.book.observe(r)
        second = self.book.observe(r)
        self.assertEqual(first.status, Status.UNRESOLVED)
        self.assertEqual(second.status, Status.REPLAY)
        self.assertIs(second.observation, first.observation)
        self.assertEqual(second.observation.correlation_status, Status.UNRESOLVED)
        self.assertIsNone(second.attempt)

    def test_27_no_network_process_endpoint_or_secret_dependency(self):
        core = Path(__file__).with_name('m04_attempt_response.py').read_text()
        tree = ast.parse(core)
        imports = {n.module for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)}
        self.assertEqual(imports, {'dataclasses','enum','security','model','envelope',
                                  'signature_profile','signed_validation'})
        self.assertFalse(any(isinstance(n, ast.Import) for n in ast.walk(tree)))
        names = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)}
        self.assertFalse(names & {'open','eval','exec','__import__','sign_test'})
        attributes = {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)}
        self.assertFalse(attributes & {'getenv', 'environ'})
        for token in ('http://','https://','subprocess','socket','requests','urllib'):
            self.assertNotIn(token, core)
        # These are audit-only canaries, no DNS/socket/process operation occurs.
        for event in ('socket.connect','socket.getaddrinfo','subprocess.Popen','os.system'):
            with self.assertRaisesRegex(RuntimeError, 'm04_forbidden_io'):
                sys.audit(event)
        self.assertEqual(FORBIDDEN[self.start_io:],
                         ['socket.connect','socket.getaddrinfo','subprocess.Popen','os.system'])
        self.start_io = len(FORBIDDEN)

    def test_28_actual_w11_frozen_reference_without_database(self):
        from psttg_wire.w11_bridge import W11Bridge
        signed = self.verified[0].signed
        c = {k: f.uid(10000+i) for i, k in enumerate(('proof_id','channel_id',
            'operating_incarnation','operation_ref','admission_id','attempt_transition_id',
            'admission_commit_ref','transition_commit_ref'))}
        c.update(envelope_revision=signed.unsigned.spec.revision, input_revision=1,
            transition_revision=1, scope_ids=[f.uid(10100)], configuration_revision=1,
            receipt_revision=0, mapping_revision=0, stop_revision=0, predecessor_proof_id=None)
        e = dict(contract='synthetic-unit-result/1', channel=c['channel_id'],
            system_ref=f.uid(10101), environment_ref=f.uid(10102), account_ref=f.uid(10103),
            event_ref=f.uid(10104), operation_ref=c['operation_ref'], attempt_ref=f.uid(10105),
            target_ref=c['admission_id'], operating_incarnation=c['operating_incarnation'],
            epoch=1, result='SIMULATED', proof_ref=f.uid(10106), payload={'detail_ref':c['proof_id']})
        c['envelope'] = e
        c['environment_binding'] = dict(origin='synthetic_test', environment='TEST',
            application='DAC7', dip_version='2.0', environment_ref=e['environment_ref'],
            account_ref=e['account_ref'], system_ref=e['system_ref'])
        bridge = W11Bridge(self.key.pin, b'x'*32, 'synthetic-only-storage-secret-000000', self.schemas)
        token = bridge.freeze(signed, c)
        frozen = bridge._input(token)
        proof = ProofReference(c['proof_id'], c['operation_ref'], e['attempt_ref'],
            c['input_revision'], c['envelope_revision'], frozen['m02']['edition_binding'],
            frozen['m02']['byte_hashes']['signed'])
        scope = Scope('TEST', c['channel_id'], e['account_ref'])
        a = self.book.prepare(self.verified[0], proof, scope, self.schemas).attempt
        self.assertEqual(a.proof.proof_id, bridge.expectation(token)['proof_id'])
        self.assertEqual(a.proof.edition_binding, bridge.expectation(token)['edition_binding'])
        self.assertEqual(a.scope.account_profile, frozen['context']['environment_binding']['account_ref'])
        self.assertEqual(a.item_position, frozen['m02']['spec']['item_position'])
        self.assertEqual(a.proof.attempt_ref, frozen['context']['envelope']['attempt_ref'])
        self.assertNotEqual(a.proof.proof_id, frozen['context']['envelope']['proof_ref'])

    def test_29_phase_and_identifier_type_are_scoped(self):
        self.prepare(); self.prepare(1)
        self.book.observe(self.response(service_ids=self.service('same')))
        # An unknown phase scope cannot borrow the START-phase owner.
        self.assertEqual(self.book.observe(self.response(attempt_ref=None, phase=Phase.UPLOAD,
            service_ids=self.service('same'))).status, Status.UNRESOLVED)
        self.assertEqual(self.book.observe(self.response(1, phase=Phase.UPLOAD,
            service_ids=self.service('same'), original_bytes=b'B')).status, Status.BOUND)
        self.assertEqual(self.book.observe(self.response(1,
            service_ids=self.service('same', 'messageId'), original_bytes=b'C')).status, Status.BOUND)

    def test_30_response_owned_message_doc_ids_are_not_request_echoes(self):
        a = self.prepare().attempt
        ids = self.service('NEW-RESPONSE-MESSAGE', 'MessageRefId') + self.service('NEW-RESPONSE-DOC', 'DocRefId')
        self.assertNotEqual(ids[0].value, a.message_ref)
        self.assertNotIn(ids[1].value, a.doc_refs)
        r = self.response(service_ids=ids, message_ref=a.message_ref, doc_refs=a.doc_refs)
        self.assertEqual(self.book.observe(r).status, Status.BOUND)
        self.assertEqual(self.book.observe(replace(r, observation_ref=f.uid(9901), attempt_ref=None)).status,
                         Status.REPLAY)


if __name__ == '__main__':
    unittest.main(verbosity=2)
