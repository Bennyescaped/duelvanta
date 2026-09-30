"""Bound post-signature projection, never an unsigned replacement for transport."""
from dataclasses import dataclass
from lxml import etree as ET
from .security import DIP, DPI, require, sha, Schemas
from .serializer import EditionBook
from .envelope import (PROFILE, secure_parse, c14n, xml, namespace_binding,
                       build_envelope, check_unsigned, stage, STAGES)
from .signature_profile import (DS, VerifiedSignature, verify_signature, remove_verified_signature)

@dataclass(frozen=True)
class OfflineEnvelopeEvidence:
    status: str
    stages: tuple
    edition_binding: str
    source_sha256: str
    schema_binding: str
    profile: str
    original_dpi_sha256: str
    unsigned_sha256: str
    unsigned_binding: str
    signed_sha256: str
    projection_sha256: str
    derived_from_signed_sha256: str
    reference_sha256: str
    signed_info_sha256: str
    namespace_sha256: str
    certificate_sha256: str
    public_key_sha256: str
    original_signed_dip_xsd: str
    raw_xsd_error_type: str
    real_key_trust: str = 'NOT_EVALUATED'
    registration: str = 'NOT_EVALUATED'
    authentication: str = 'NOT_EVALUATED'
    transmission: str = 'NOT_EVALUATED'
    authority_acceptance: str = 'NOT_EVALUATED'


def check_projection_octets(projection, verified, unsigned):
    octets = c14n(projection)
    require(octets == verified.reference_octets, 'm02_projection_reference')
    require(octets == unsigned.reference_octets, 'm02_projection_unsigned')
    require(namespace_binding(projection) == unsigned.namespace_sha256, 'm02_projection_namespaces')
    return octets


def validate_bound_projection(verified, edition, spec, schemas=None):
    schemas = schemas or Schemas()
    require(type(verified) is VerifiedSignature, 'm02_verified_type')
    # Recompute to reject caller-constructed/replaced result objects; no mutable DOM capability.
    require(verify_signature(verified.signed, verified.pin) == verified, 'm02_verified_binding')
    passed = list(STAGES[:4])
    with stage('projection_equality', passed):
        unsigned = check_unsigned(verified.signed.unsigned, schemas)
        expected = build_envelope(edition, spec, schemas)
        require(unsigned == expected, 'm02_expected_edition_spec')
        original = secure_parse(verified.signed.xml)
        projection = remove_verified_signature(original, verified.signature_path[0])
        check_projection_octets(projection, verified, unsigned)
        raw = xml(projection)
    with stage('dip_projection_xsd', passed):
        schemas.validate(raw, 'dip.xsd', '{'+DIP+'}dip')
    with stage('dpi_xsd', passed):
        dpi = projection[1][0][0][0]
        require(dpi.tag == '{'+DPI+'}DPI_OECD', 'm02_exact_dpi')
        schemas.validate(xml(dpi), 'DPIXML_v1.0.xsd', '{'+DPI+'}DPI_OECD')
    with stage('v117_full_model', passed):
        EditionBook(schemas).check_xml(edition, xml(dpi))
    with stage('environment_binding', passed):
        require(c14n(projection) == c14n(secure_parse(expected.xml)), 'm02_closed_envelope')
    # This reject is required evidence, not a PASS of the signed original.
    validator = schemas.validators['dip.xsd']
    require(not validator.validate(original), 'm02_signed_raw_unexpected_xsd_pass')
    errors = tuple(validator.error_log)
    require(len(errors) == 1 and errors[0].type_name == 'SCHEMAV_ELEMENT_CONTENT'
            and '{'+DS+'}Signature' in errors[0].message, 'm02_raw_reject_reason')
    stages = tuple((name, 'PASS') for name in STAGES)
    return OfflineEnvelopeEvidence('OFFLINE_PROFILE_VERIFIED', stages, edition.binding,
        sha(edition.source_bytes), schemas.binding, PROFILE, sha(edition.xml), sha(unsigned.xml),
        unsigned.binding, verified.signed.sha256, sha(raw), verified.signed.sha256,
        sha(verified.reference_octets), verified.signed_info_sha256, unsigned.namespace_sha256,
        verified.certificate_sha256, verified.public_key_sha256,
        'NOT_CONFORMING_TO_PINNED_ROOT_CONTENT_MODEL', errors[0].type_name)
