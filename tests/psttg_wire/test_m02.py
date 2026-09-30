"""Run: python -m unittest discover -s tests/psttg_wire -p test_m02.py -v

Ephemeral synthetic keys only, kept in process memory. Never serialize a private key.
No database, receipt worker, network, environment credentials, or real certificate.
"""
import base64
from copy import deepcopy
from dataclasses import asdict, replace
from datetime import datetime, timezone
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.backends.openssl.backend import backend
from lxml import etree as ET
import cryptography
from psttg_wire import fixtures as f
from psttg_wire.security import Schemas, Rejected, DIP, DPI, STF, sha, LIMIT
from psttg_wire.serializer import EditionBook
from psttg_wire.envelope import (EnvelopeSpec, build_envelope, secure_parse, c14n, xml,
                                namespace_binding)
from psttg_wire.signature_profile import (DS, C14N, PSS, SHA256, ENVELOPED, SYNTHETIC_SUBJECT,
    ExpectedTestPin, TestKeyRef, SignedEnvelope, public_der, b64, pss, sign_test,
    verify_signature, remove_verified_signature)
from psttg_wire.signed_validation import validate_bound_projection, check_projection_octets

CLOCK = datetime(2026, 9, 30, 10, 0, tzinfo=timezone.utc)
RESULTS = []
EVIDENCE = []

def retain_public_evidence(label, signed, pin):
    out = Path(__file__).resolve().parents[2]/'test-results'/'psttg-m02-public'/label
    out.mkdir(parents=True, exist_ok=True)
    root = secure_parse(signed.xml)
    files = {'original-dpi.xml':signed.unsigned.edition.xml, 'unsigned.xml':signed.unsigned.xml,
             'signed.xml':signed.xml, 'projection.xml':xml(remove_verified_signature(root,2)),
             'reference.c14n':signed.unsigned.reference_octets,
             'synthetic-certificate.der':pin.certificate_der, 'synthetic-public-key.der':pin.public_key_der}
    for name,raw in files.items():
        (out/name).write_bytes(raw)
    (out/'manifest.json').write_text(json.dumps({'synthetic_only':True, 'checked_at':pin.checked_at.isoformat(),
        'files':{name:sha(raw) for name,raw in files.items()}},indent=2)+'\n')

def material(bits=4096, key=None, serial=1, expired=False, cert_padding=None):
    key = key or rsa.generate_private_key(public_exponent=65537, key_size=bits)
    cert = (x509.CertificateBuilder().subject_name(SYNTHETIC_SUBJECT).issuer_name(SYNTHETIC_SUBJECT)
        .public_key(key.public_key()).serial_number(serial)
        .not_valid_before(datetime(2026, 1, 1, tzinfo=timezone.utc))
        .not_valid_after(datetime(2026, 2, 1, tzinfo=timezone.utc) if expired
                         else datetime(2027, 1, 1, tzinfo=timezone.utc))
        .sign(key, hashes.SHA256(), rsa_padding=cert_padding or pss()))
    return TestKeyRef(ExpectedTestPin(cert.public_bytes(serialization.Encoding.DER),
                                     public_der(key.public_key()), CLOCK), key)

def make_edition(schemas, count=1, multi=False, number=1):
    pack = f.source(count)
    if multi:
        seller = f.uid(900)
        pack['positions'][0]['subject']['seller_ids'].append(seller)
        pack['known_seller_ids'].append(seller)
        pack['positions'][0]['events'][1]['seller_id'] = seller
    book = EditionBook(schemas); book.register_source(pack)
    return book.build(f.delivery(pack, number))

class M02Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schemas = Schemas()
        cls.key = material(); cls.other = material(serial=2)
        cls.edition = make_edition(cls.schemas)
        cls.spec = EnvelopeSpec(f.uid(8001), '2026-09-30T10:00:00Z', 'SYNTHETIC-TICKET-1')
        cls.unsigned = build_envelope(cls.edition, cls.spec, cls.schemas)
        cls.signed = sign_test(cls.unsigned, cls.key)
        cls.verified = verify_signature(cls.signed, cls.key.pin)

    def success(self, signed=None, pin=None, edition=None, spec=None):
        v = verify_signature(signed or self.signed, pin or self.key.pin)
        e = validate_bound_projection(v, edition or self.edition, spec or self.spec, self.schemas)
        self.assertEqual(e.status, 'OFFLINE_PROFILE_VERIFIED')
        self.assertEqual(e.original_signed_dip_xsd, 'NOT_CONFORMING_TO_PINNED_ROOT_CONTENT_MODEL')
        return e

    def forged(self, mutate, resign=False, key=None, pad=None):
        """Adversarial fixture generator, deliberately bypassing the closed signer."""
        root = secure_parse(self.signed.xml); mutate(root)
        if resign:
            sig = root[-1]; si = sig[0]; ref = si[2]
            ref[2].text = b64(bytes.fromhex(sha(c14n(remove_verified_signature(root, 2)))))
            sig[1].text = b64((key or self.key).private_key.sign(c14n(si), pad or pss(), hashes.SHA256()))
        raw = xml(root)
        return replace(self.signed, xml=raw, sha256=sha(raw))

    def reject(self, name, signed=None, code=None, fn=None):
        with self.subTest(case=name):
            try:
                (fn or (lambda: self.success(signed=signed)))()
            except Rejected as exc:
                if code:
                    self.assertEqual(str(exc), code)
                RESULTS.append({'case':name, 'result':'PASS', 'observed_reject':str(exc), 'stages':getattr(exc,'stages',None), 'payload_released':False})
                return
            self.fail('expected closed rejection: '+name)

    def test_01_single_full_binding(self):
        e = self.success(); EVIDENCE.append(asdict(e))
        retain_public_evidence('single',self.signed,self.key.pin)
        self.assertEqual(self.verified.reference_octets, self.unsigned.reference_octets)
        self.assertEqual(e.signed_sha256, e.derived_from_signed_sha256)
        self.assertTrue(all(s == 'PASS' for _,s in e.stages))
        self.assertEqual(e.authority_acceptance, 'NOT_EVALUATED')
        self.assertEqual(self.edition.xml, self.unsigned.edition.xml)
        RESULTS.append({'case':'single_whole_eur_complete_bindings','result':'PASS'})

    def test_02_multiple_sellers_accounts(self):
        edition = make_edition(self.schemas, 2, True, 2)
        spec = replace(self.spec, revision=f.uid(8002), transfer_ticket='SYNTHETIC-TICKET-2')
        u = build_envelope(edition, spec, self.schemas); s = sign_test(u, self.key)
        self.assertEqual(len(edition.positions), 2)
        self.assertEqual(len(edition.positions[0].subject.seller_ids), 2)
        EVIDENCE.append(asdict(self.success(s, edition=edition, spec=spec)))
        retain_public_evidence('multiple',s,self.key.pin)
        RESULTS.append({'case':'two_sellers_two_consolidated_accounts','result':'PASS'})

    def test_03_replay_and_history(self):
        # A signing object that would fail immediately if replay signs again.
        from unittest.mock import patch
        old = self.signed.xml
        with patch('psttg_wire.signature_profile._sign_signed_info', side_effect=AssertionError('replay must not sign')):
            replay = sign_test(self.unsigned, self.key)
        self.assertIs(replay, self.signed)
        self.assertEqual(old, replay.xml)
        altered_spec = replace(self.spec, creation_time='2026-09-30T10:01:00Z')
        u = build_envelope(self.edition, altered_spec, self.schemas)
        self.reject('same_revision_different_unsigned', code='m02_envelope_revision_conflict', fn=lambda:sign_test(u,self.key))
        u = build_envelope(self.edition, replace(self.spec, revision=f.uid(8999)), self.schemas)
        self.reject('ticket_reuse', code='m02_ticket_reuse', fn=lambda:sign_test(u,self.key))
        self.assertEqual(self.signed.xml, old)
        # Probabilistic PSS, no deterministic salt rule; different bytes cannot overwrite history.
        fresh = sign_test(self.unsigned, TestKeyRef(self.key.pin, self.key.private_key))
        self.assertNotEqual(fresh.xml, old)
        self.success(fresh)
        self.assertIs(self.key._history[self.spec.revision], self.signed)
        RESULTS.append({'case':'replay_stored_object_no_resign_and_original_retained','result':'PASS'})

    def test_04_tampered_data_header_and_refs(self):
        mutations = {
            'header_time':lambda r:setattr(r[0][0][1],'text','2026-09-30T10:01:00Z'),
            'amount':lambda r:setattr(r.find('.//{'+DPI+'}ConsQ1'),'text','11'),
            'doc_ref':lambda r:setattr(r.find('.//{'+STF+'}DocRefId'),'text','DE2025-changed'),
            'TEST_to_PROD':lambda r:r[0].set('environment','PROD'),
            'DAC7_to_CESOP':lambda r:r[0][1].set('code','CESOP'),
            'item_position':lambda r:r[1][0].set('consignmentItemPosition','2')}
        for name, mutate in mutations.items():
            self.reject(name, self.forged(mutate), 'm02_digest')
        for name in ('TEST_to_PROD','DAC7_to_CESOP','item_position'):
            s = self.forged(mutations[name], resign=True)
            verify_signature(s, self.key.pin)  # mathematically valid, but not the bound envelope
            self.reject('resigned_'+name,s,'m02_projection_unsigned')

    def test_05_keys_and_certificates(self):
        self.reject('wrong_external_pin',fn=lambda:verify_signature(self.signed,self.other.pin),code='m02_certificate_pin')
        s = self.forged(lambda r:None,resign=True,key=self.other)
        self.reject('wrong_private_key',s,'m02_signature_value')
        self.reject('signer_key_mismatch',fn=lambda:sign_test(self.unsigned,TestKeyRef(self.key.pin,self.other.private_key)),code='m02_private_key_pin')
        alternate = material(key=self.key.private_key,serial=3)
        s = self.forged(lambda r:setattr(r[-1][2][0][0],'text',b64(alternate.pin.certificate_der)))
        self.reject('same_public_key_changed_certificate_der',s,'m02_certificate_pin')
        s = self.forged(lambda r:setattr(r[-1][2][0][0],'text',b64(self.other.pin.certificate_der)),resign=True,key=self.other)
        verify_signature(s,self.other.pin)
        self.reject('mathematically_valid_unpinned_key',s,'m02_certificate_pin')
        for name,key in [('rsa2048',material(2048)),('expired',material(key=self.key.private_key,serial=4,expired=True)),
                         ('certificate_salt20',material(key=self.key.private_key,serial=5,cert_padding=padding.PSS(mgf=padding.MGF1(hashes.SHA256()),salt_length=20)))]:
            self.reject(name,fn=lambda key=key:sign_test(self.unsigned,key))
        self.reject('wrong_public_pin',fn=lambda:verify_signature(self.signed,replace(self.key.pin,public_key_der=self.other.pin.public_key_der)),code='m02_public_pin')

    def test_06_closed_signature_structure(self):
        def move(r):
            s=r[-1];r.remove(s);r[1].append(s)
        mutations = {
            'second_signature':lambda r:r.append(deepcopy(r[-1])),
            'nested_signature':lambda r:r[1].append(deepcopy(r[-1])),
            'moved_signature':move,
            'signature_first':lambda r:r.insert(0,r[-1]),
            'signature_id':lambda r:r[-1].set('Id','anything'),
            'signature_object':lambda r:ET.SubElement(r[-1],'{'+DS+'}Object'),
            'second_reference':lambda r:r[-1][0].append(deepcopy(r[-1][0][2])),
            'missing_reference':lambda r:r[-1][0].remove(r[-1][0][2]),
            'missing_URI':lambda r:r[-1][0][2].attrib.pop('URI'),
            'PSS_xml_parameters':lambda r:ET.SubElement(r[-1][0][1],'{'+DS+'}RSAPSSParams'),
            'second_certificate':lambda r:r[-1][2][0].append(deepcopy(r[-1][2][0][0])),
            'keyvalue':lambda r:ET.SubElement(r[-1][2],'{'+DS+'}KeyValue'),
            'signature_tail':lambda r:setattr(r[-1],'tail',' '),
            'bad_base64':lambda r:setattr(r[-1][1],'text','%%%'),
            'short_digest':lambda r:setattr(r[-1][0][2][2],'text',b64(b'a'))}
        for name,m in mutations.items():self.reject(name,self.forged(m))
        for uri in ('#id', '#xpointer(/)', 'https://example.invalid/x','file:///x','data:abc'):
            self.reject('uri_'+uri,self.forged(lambda r,u=uri:r[-1][0][2].set('URI',u)))

    def test_07_algorithms(self):
        for alg in (C14N+'#WithComments','http://www.w3.org/2001/10/xml-exc-c14n#','http://www.w3.org/2006/12/xml-c14n11'):
            self.reject('c14n_'+alg,self.forged(lambda r,a=alg:r[-1][0][0].set('Algorithm',a)))
        for alg in (DS+'base64','http://www.w3.org/TR/1999/REC-xpath-19991116','http://www.w3.org/TR/1999/REC-xslt-19991116',C14N):
            self.reject('transform_'+alg,self.forged(lambda r,a=alg:r[-1][0][2][0][0].set('Algorithm',a)))
        self.reject('extra_transform',self.forged(lambda r:r[-1][0][2][0].append(deepcopy(r[-1][0][2][0][0]))))
        self.reject('wrong_digest_algorithm',self.forged(lambda r:r[-1][0][2][1].set('Algorithm',DS+'sha1')))
        self.reject('wrong_signature_algorithm',self.forged(lambda r:r[-1][0][1].set('Algorithm',DS+'rsa-sha256')))
        for name,pad in [('salt20',padding.PSS(mgf=padding.MGF1(hashes.SHA256()),salt_length=20)),
                         ('mgf_sha384',padding.PSS(mgf=padding.MGF1(hashes.SHA384()),salt_length=32)),
                         ('pkcs1',padding.PKCS1v15())]:
            self.reject(name,self.forged(lambda r:None,True,pad=pad),'m02_signature_value')

    def test_08_schema_namespaces_and_business(self):
        mutations = {
            'second_body':lambda r:r.insert(2,deepcopy(r[1])),
            'extra_header':lambda r:r.insert(1,deepcopy(r[0])),
            'extra_DPI':lambda r:r[1][0][0].append(deepcopy(r[1][0][0][0])),
            'extra_DPI_field':lambda r:ET.SubElement(r[1][0][0][0],'{'+DPI+'}Unknown'),
            'wrong_DPI_namespace':lambda r:setattr(r[1][0][0][0],'tag','{urn:wrong}DPI_OECD'),
            'root_namespace':lambda r:setattr(r,'tag','{urn:wrong}dip'),
            'root_attribute':lambda r:r.set('extra','x'),
            'reordered_DPI':lambda r:r[1][0][0][0].insert(0,r[1][0][0][0][-1]),
            'wrong_header_namespace':lambda r:setattr(r[0],'tag','{urn:wrong}header'),
            'missing_creationTime':lambda r:r[0][0].remove(r[0][0][1])}
        for name,m in mutations.items(): self.reject(name,self.forged(m))
        for name in ('extra_DPI','extra_DPI_field','wrong_DPI_namespace','reordered_DPI','missing_creationTime'):
            self.reject('resigned_'+name,self.forged(mutations[name],True),'m02_projection_unsigned')
        def add_alias(r):
            old = r[-1]
            replacement = ET.Element(old.tag, nsmap={'ds':DS,'alias':DS})
            replacement.extend(deepcopy(list(old)))
            r.replace(old,replacement)
        self.reject('signature_namespace_alias', self.forged(add_alias), 'm02_signature_namespaces')
        self.reject('invalid_unsigned_environment',fn=lambda:build_envelope(self.edition,replace(self.spec,environment='PROD'),self.schemas))
        self.reject('unsigned_changed_bytes',fn=lambda:sign_test(replace(self.unsigned,xml=self.unsigned.xml.replace(b'TEST',b'PROD')),self.key))

    def test_09_hostile_xml(self):
        raw = self.signed.xml
        variants = {
            'DTD':raw.replace(b'<dip:dip',b'<!DOCTYPE dip:dip><dip:dip',1),
            'external_entity':raw.replace(b'<dip:dip',b'<!DOCTYPE dip:dip [<!ENTITY x SYSTEM "file:///never-read">]><dip:dip',1),
            'PI':raw+b'<?bad instruction?>', 'comment':raw+b'<!--bad-->',
            'oversize':b' '*(LIMIT+1),
            'utf16':raw.decode().replace("encoding='UTF-8'","encoding='UTF-16'").encode('utf-16'),
            'depth':b'<a>'*34+b'</a>'*34,
            'nodes':b'<a>'+b'<b/>'*40001+b'</a>'}
        for name,v in variants.items():
            self.reject(name,replace(self.signed,xml=v,sha256=sha(v)))
        for name,m in {
            'internal_PI':lambda r:r[1].append(ET.ProcessingInstruction('bad','data')),
            'internal_comment':lambda r:r[1].append(ET.Comment('bad')),
            'xinclude':lambda r:ET.SubElement(r[1],'{http://www.w3.org/2001/XInclude}include',href='https://example.invalid/'),
            'xml_base':lambda r:r.set('{http://www.w3.org/XML/1998/namespace}base','https://example.invalid/'),
            'schema_location':lambda r:r.set('{http://www.w3.org/2001/XMLSchema-instance}schemaLocation','https://example.invalid/x')}.items():
            self.reject(name,self.forged(m))

    def test_10_projection_and_different_edition(self):
        projection = remove_verified_signature(secure_parse(self.signed.xml),2)
        check_projection_octets(projection,self.verified,self.unsigned)
        for name,m in {
            'projection_drop_body':lambda r:r.remove(r[1]),
            'projection_tail':lambda r:setattr(r[1],'tail',' '),
            'projection_namespace':lambda r:setattr(r[1],'tag','{urn:other}body')}.items():
            p=deepcopy(projection);m(p)
            self.reject(name,fn=lambda p=p:check_projection_octets(p,self.verified,self.unsigned))
        altered = ET.fromstring(xml(projection).replace(b'<dip:dip ',b'<dip:dip xmlns:extra="urn:extra" ',1))
        self.reject('projection_added_namespace_declaration',fn=lambda:check_projection_octets(altered,self.verified,self.unsigned))
        root=secure_parse(self.signed.xml);root[-1].tail='preserved-tail'
        p=remove_verified_signature(root,2)
        self.assertEqual(p[-1].tail,'preserved-tail')
        self.reject('forged_verifier_reference',fn=lambda:validate_bound_projection(replace(self.verified,reference_octets=b'fake'),self.edition,self.spec,self.schemas))
        other=make_edition(self.schemas,2,False,8)
        spec=replace(self.spec,revision=f.uid(8010),transfer_ticket='SYNTHETIC-TICKET-10')
        s=sign_test(build_envelope(other,spec,self.schemas),self.key)
        verify_signature(s,self.key.pin)
        self.reject('signed_other_valid_edition',fn=lambda:self.success(s,edition=self.edition,spec=spec),code='m02_expected_edition_spec')
        # Byte metadata cannot disguise another edition as the expected source.
        self.reject('edition_xml_mutated',fn=lambda:build_envelope(replace(self.edition,xml=other.xml),self.spec,self.schemas))

    def test_11_failure_stages_no_payload(self):
        s = self.forged(lambda r:setattr(r.find('.//{'+DPI+'}ConsQ1'),'text','11'))
        with self.assertRaises(Rejected) as caught:
            verify_signature(s, self.key.pin)
        states = dict(caught.exception.stages)
        self.assertEqual(states['test_key_pin'], 'PASS')
        self.assertEqual(states['digest'], 'FAIL')
        self.assertEqual(states['signature_value'], 'NOT_EVALUATED')
        self.assertEqual(states['v117_full_model'], 'NOT_EVALUATED')
        self.assertFalse(hasattr(caught.exception, 'reference_octets'))
        self.assertFalse(hasattr(caught.exception, 'payload'))
        RESULTS.append({'case':'failure_stages_no_payload_release','result':'PASS'})

    def test_12_c14n_and_independent_openssl(self):
        root=ET.fromstring(b'<a xmlns="urn:a" xmlns:z="urn:z" z:v="2" b="1"><c> A&#xD;B </c></a>')
        expected=b'<a xmlns="urn:a" xmlns:z="urn:z" b="1" z:v="2"><c> A&#xD;B </c></a>'
        self.assertEqual(c14n(root),expected)
        root=secure_parse(self.signed.xml)
        # A separate CLI consumes exactly the SignedInfo octets, only public material on disk.
        with tempfile.TemporaryDirectory(prefix='duelvanta-m02-public-') as d:
            p=Path(d)
            (p/'public.pem').write_bytes(self.key.private_key.public_key().public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo))
            (p/'signature.bin').write_bytes(base64.b64decode(root[-1][1].text))
            (p/'signedinfo.c14n').write_bytes(c14n(root[-1][0]))
            run=subprocess.run(['openssl','dgst','-sha256','-verify',str(p/'public.pem'),'-signature',str(p/'signature.bin'),
                '-sigopt','rsa_padding_mode:pss','-sigopt','rsa_pss_saltlen:32','-sigopt','rsa_mgf1_md:sha256',str(p/'signedinfo.c14n')],capture_output=True,text=True)
            self.assertEqual(run.returncode,0,run.stderr)
            self.assertEqual(run.stdout.strip(),'Verified OK')
        RESULTS.append({'case':'fixed_c14n_octets_and_independent_openssl_pss_verification','result':'PASS'})

    @classmethod
    def tearDownClass(cls):
        out=Path(__file__).resolve().parents[2]/'test-results'/'psttg-m02-offline.json'
        out.parent.mkdir(exist_ok=True)
        out.write_text(json.dumps({'profile':'V119-M02-offline-envelope/1','scope':'offline_synthetic_only',
            'cases':RESULTS,'bindings':EVIDENCE,'runtime':{'python':sys.version.split()[0],
            'lxml':ET.LXML_VERSION,'libxml':ET.LIBXML_VERSION,'cryptography':cryptography.__version__,
            'openssl_backend':backend.openssl_version_text()},'private_key_serialized':False,
            'native_database':'NOT_RUN','new_ci':'NOT_RUN'},indent=2)+'\n')
        # Process lifetime only: no private key file or certificate fixture is produced.
        cls.key=cls.other=None

if __name__=='__main__':
    unittest.main()
