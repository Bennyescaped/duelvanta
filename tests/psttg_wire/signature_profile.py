"""Closed XMLDSIG subset using lxml C14N + cryptography RSA-PSS. Offline only.

No URI resolver, key loader, credentials, signing CLI, or general XMLDSIG API.
Private synthetic key objects exist only in the test process, never serialized.
"""
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime
import base64
import binascii
import hmac
from cryptography import x509
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.x509.oid import NameOID, SignatureAlgorithmOID
from lxml import etree as ET
from .security import DIP, require, sha, Rejected
from .envelope import DS, PROFILE, UnsignedEnvelope, check_unsigned, secure_parse, c14n, xml, stage

C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
PSS = 'http://www.w3.org/2007/05/xmldsig-more#sha256-rsa-MGF1'
SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256'
ENVELOPED = DS + 'enveloped-signature'
SYNTHETIC_SUBJECT = x509.Name([
    x509.NameAttribute(NameOID.COMMON_NAME, 'offline.duelvanta.invalid'),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'SYNTHETIC OFFLINE TEST ONLY'),
    x509.NameAttribute(NameOID.LOCALITY_NAME, 'Teststadt'),
    x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, 'Testland'),
    x509.NameAttribute(NameOID.COUNTRY_NAME, 'DE')])

def pss():
    return padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=32)

def public_der(key):
    return key.public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)

def b64(raw):
    return base64.b64encode(raw).decode('ascii')

def unb64(value, limit):
    require(type(value) is str and 0 < len(value) <= limit * 2, 'm02_base64_size')
    try:
        result = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise Rejected('m02_base64') from exc
    require(0 < len(result) <= limit and b64(result) == value, 'm02_base64_canonical')
    return result

@dataclass(frozen=True)
class ExpectedTestPin:
    certificate_der: bytes
    public_key_der: bytes
    checked_at: datetime
    origin: str = 'synthetic_test'

@dataclass(frozen=True)
class TestKeyRef:
    pin: ExpectedTestPin
    private_key: rsa.RSAPrivateKey = field(repr=False, compare=False)
    _history: dict = field(default_factory=dict, repr=False, compare=False)
    _tickets: dict = field(default_factory=dict, repr=False, compare=False)

@dataclass(frozen=True)
class SignedEnvelope:
    unsigned: UnsignedEnvelope
    xml: bytes
    sha256: str
    profile: str = PROFILE

@dataclass(frozen=True)
class VerifiedSignature:
    signed: SignedEnvelope
    pin: ExpectedTestPin
    reference_octets: bytes
    signed_info_sha256: str
    signature_path: tuple
    certificate_sha256: str
    public_key_sha256: str
    reference_uri: str = ''
    transforms: tuple = (ENVELOPED,)


def check_pin(pin):
    require(type(pin) is ExpectedTestPin and pin.origin == 'synthetic_test', 'm02_test_pin')
    require(type(pin.certificate_der) is bytes and 0 < len(pin.certificate_der) <= 16384,
            'm02_certificate_size')
    require(type(pin.public_key_der) is bytes and len(pin.public_key_der) <= 8192, 'm02_key_size')
    require(type(pin.checked_at) is datetime and pin.checked_at.utcoffset() is not None, 'm02_fixed_clock')
    try:
        cert = x509.load_der_x509_certificate(pin.certificate_der)
        key = cert.public_key()
        require(cert.public_bytes(serialization.Encoding.DER) == pin.certificate_der, 'm02_der')
        require(isinstance(key, rsa.RSAPublicKey) and 4096 <= key.key_size <= 8192, 'm02_rsa_bits')
        require(key.public_numbers().e == 65537, 'm02_rsa_exponent')
        require(public_der(key) == pin.public_key_der, 'm02_public_pin')
        require(cert.subject == SYNTHETIC_SUBJECT and cert.issuer == SYNTHETIC_SUBJECT, 'm02_synthetic_identity')
        require(cert.not_valid_before_utc <= pin.checked_at <= cert.not_valid_after_utc, 'm02_certificate_time')
        require(cert.signature_algorithm_oid == SignatureAlgorithmOID.RSASSA_PSS
                and cert.signature_hash_algorithm.name == 'sha256', 'm02_certificate_pss')
        # The pinned DER fixes ASN.1 parameters; also reject a misleading parameter declaration.
        params = cert.signature_algorithm_parameters
        require(isinstance(params, padding.PSS) and isinstance(params.mgf, padding.MGF1)
                and params.mgf._algorithm.name == 'sha256' and params._salt_length == 32,
                'm02_certificate_pss_parameters')
        key.verify(cert.signature, cert.tbs_certificate_bytes, pss(), hashes.SHA256())
        return key
    except (ValueError, TypeError, InvalidSignature) as exc:
        if isinstance(exc, Rejected):
            raise
        raise Rejected('m02_certificate_invalid') from exc


def remove_verified_signature(root, index):
    """Exact node, preserving tail outside its subtree. No namespace cleanup."""
    require(index == 2 and len(root) == 3 and root[index].tag == '{'+DS+'}Signature', 'm02_projection_node')
    copy = deepcopy(root)
    target = copy[index]
    tail = target.tail
    copy.remove(target)
    if tail:
        copy[index-1].tail = (copy[index-1].tail or '') + tail
    return copy


def grammar(root):
    require(root.tag == '{'+DIP+'}dip' and dict(root.attrib) == {'version': '2.0'}, 'm02_signed_root')
    require([n.tag for n in root] == ['{'+DIP+'}header', '{'+DIP+'}body', '{'+DS+'}Signature'], 'm02_signature_position')
    require(sum(n.tag == '{'+DS+'}Signature' for n in root.iter()) == 1, 'm02_signature_unique')
    sig = root[2]
    require(root.text is None and all(n.tail is None for n in root), 'm02_root_layout')
    def shape(n, name, children=(), attrs=None, leaf=False):
        require(n.tag == '{'+DS+'}'+name and dict(n.attrib) == (attrs or {}), 'm02_ds_attributes:'+name)
        require([x.tag for x in n] == ['{'+DS+'}'+x for x in children], 'm02_ds_children:'+name)
        require(n.tail is None and (leaf or n.text is None), 'm02_ds_layout:'+name)
    shape(sig, 'Signature', ('SignedInfo', 'SignatureValue', 'KeyInfo'))
    si, sv, ki = sig
    shape(si, 'SignedInfo', ('CanonicalizationMethod', 'SignatureMethod', 'Reference'))
    shape(si[0], 'CanonicalizationMethod', attrs={'Algorithm': C14N})
    shape(si[1], 'SignatureMethod', attrs={'Algorithm': PSS})
    ref = si[2]
    shape(ref, 'Reference', ('Transforms', 'DigestMethod', 'DigestValue'), {'URI': ''})
    shape(ref[0], 'Transforms', ('Transform',))
    shape(ref[0][0], 'Transform', attrs={'Algorithm': ENVELOPED})
    shape(ref[1], 'DigestMethod', attrs={'Algorithm': SHA256})
    shape(ref[2], 'DigestValue', leaf=True)
    shape(sv, 'SignatureValue', leaf=True)
    shape(ki, 'KeyInfo', ('X509Data',)); shape(ki[0], 'X509Data', ('X509Certificate',))
    shape(ki[0][0], 'X509Certificate', leaf=True)
    require(sig.nsmap == {**root.nsmap, 'ds': DS}, 'm02_signature_namespaces')
    require(all(n.nsmap == sig.nsmap for n in sig.iter()), 'm02_ds_namespace_alias')
    return si, sv, ref[2], ki[0][0]


def verify_signature(signed, pin):
    passed = []
    with stage('structure', passed):
        require(type(signed) is SignedEnvelope and signed.profile == PROFILE, 'm02_signed_type')
        root = secure_parse(signed.xml)
        require(sha(signed.xml) == signed.sha256, 'm02_signed_hash')
        si, sv, dv, cert = grammar(root)
    with stage('test_key_pin', passed):
        key = check_pin(pin)
        require(hmac.compare_digest(unb64(cert.text, 16384), pin.certificate_der), 'm02_certificate_pin')
    with stage('digest', passed):
        digest = unb64(dv.text, 32)
        require(len(digest) == 32, 'm02_digest_length')
        # Entire empty-URI document node set, excluding exactly its Signature.
        reference_octets = c14n(remove_verified_signature(root, 2))
        require(hmac.compare_digest(digest, bytes.fromhex(sha(reference_octets))), 'm02_digest')
    with stage('signature_value', passed):
        signature = unb64(sv.text, 1024)
        require(len(signature) == key.key_size // 8, 'm02_signature_length')
        si_octets = c14n(si)
        try:
            key.verify(signature, si_octets, pss(), hashes.SHA256())
        except InvalidSignature as exc:
            raise Rejected('m02_signature_value') from exc
    # No DOM or payload is returned before all four stages succeed.
    return VerifiedSignature(signed, pin, reference_octets, sha(si_octets), (2,),
                             sha(pin.certificate_der), sha(pin.public_key_der))


def _sign_signed_info(key, octets):
    return key.sign(octets, pss(), hashes.SHA256())


def sign_test(unsigned, key_ref):
    check_unsigned(unsigned)
    require(type(key_ref) is TestKeyRef, 'm02_key_ref')
    pub = check_pin(key_ref.pin)
    require(isinstance(key_ref.private_key, rsa.RSAPrivateKey)
            and public_der(key_ref.private_key.public_key()) == public_der(pub), 'm02_private_key_pin')
    revision = unsigned.spec.revision
    old = key_ref._history.get(revision)
    if old is not None:
        require(old.unsigned == unsigned, 'm02_envelope_revision_conflict')
        verify_signature(old, key_ref.pin)
        return old
    ticket = unsigned.spec.transfer_ticket
    require(ticket not in key_ref._tickets, 'm02_ticket_reuse')
    root = secure_parse(unsigned.xml)
    sig = ET.SubElement(root, '{'+DS+'}Signature', nsmap={'ds': DS})
    def add(parent, name, value=None, **attrs):
        n = ET.SubElement(parent, '{'+DS+'}'+name, attrs); n.text = value; return n
    si = add(sig, 'SignedInfo')
    add(si, 'CanonicalizationMethod', Algorithm=C14N); add(si, 'SignatureMethod', Algorithm=PSS)
    ref = add(si, 'Reference', URI='')
    add(add(ref, 'Transforms'), 'Transform', Algorithm=ENVELOPED)
    add(ref, 'DigestMethod', Algorithm=SHA256)
    reference = c14n(remove_verified_signature(root, 2))
    require(reference == unsigned.reference_octets, 'm02_presign_reference')
    add(ref, 'DigestValue', b64(bytes.fromhex(sha(reference))))
    signature = _sign_signed_info(key_ref.private_key, c14n(si))
    add(sig, 'SignatureValue', b64(signature))
    add(add(add(sig, 'KeyInfo'), 'X509Data'), 'X509Certificate', b64(key_ref.pin.certificate_der))
    raw = xml(root); result = SignedEnvelope(unsigned, raw, sha(raw))
    verify_signature(result, key_ref.pin)
    key_ref._history[revision] = result; key_ref._tickets[ticket] = revision
    return result
