"""Private V119-M02 offline envelope. No transport or receipt integration."""
from copy import deepcopy
from contextlib import contextmanager
from dataclasses import dataclass, asdict
import json
from lxml import etree as ET
from .security import DIP, DPI, require, sha, canonical, parse, Schemas, Rejected
from .serializer import Edition, EditionBook, make_xml, tree_projection
from .model import SourcePack, decode, check_pack, instant, uid

STAGES = ('structure', 'test_key_pin', 'digest', 'signature_value',
          'projection_equality', 'dip_projection_xsd', 'dpi_xsd',
          'v117_full_model', 'environment_binding')

class OfflineRejected(Rejected):
    """Stage evidence only; deliberately no payload/DOM member."""
    def __init__(self, code, failed, passed):
        super().__init__(code)
        self.stages = tuple((name, 'FAIL' if name == failed else
                            'PASS' if name in passed else 'NOT_EVALUATED') for name in STAGES)

@contextmanager
def stage(name, passed):
    try:
        yield
    except OfflineRejected:
        raise
    except Rejected as exc:
        raise OfflineRejected(str(exc), name, passed) from exc
    else:
        passed.append(name)

PROFILE = 'V119-M02-offline-envelope/1'
DS = 'http://www.w3.org/2000/09/xmldsig#'

def c14n(root):
    return ET.tostring(root, method='c14n', exclusive=False, with_comments=False)

def xml(root):
    return ET.tostring(root, encoding='UTF-8', xml_declaration=True, pretty_print=False)

def secure_parse(raw):
    root = parse(raw)
    try:
        raw.decode('utf-8')
    except UnicodeError as exc:
        raise Rejected('m02_utf8') from exc
    require(root.getroottree().docinfo.encoding.upper() == 'UTF-8', 'm02_utf8')
    for n in root.iter():
        require(not n.tag.startswith('{http://www.w3.org/2001/XInclude}'), 'm02_xinclude')
        require(not any(k.startswith('{http://www.w3.org/XML/1998/namespace}') for k in n.attrib), 'm02_xml_inheritance')
    return root

def namespace_binding(root):
    return sha(canonical([sorted(n.nsmap.items(), key=lambda x: x[0] or '') for n in root.iter()]))

@dataclass(frozen=True)
class EnvelopeSpec:
    revision: str
    creation_time: str
    transfer_ticket: str
    origin: str = 'synthetic_test'
    customer_identifier: str = 'SYNTHETIC-01'
    identity_provider: str = 'ELSTER'
    environment: str = 'TEST'
    application: str = 'DAC7'
    item_position: str = '1'
    profile: str = PROFILE

@dataclass(frozen=True)
class UnsignedEnvelope:
    edition: Edition
    spec: EnvelopeSpec
    xml: bytes
    reference_octets: bytes
    namespace_sha256: str
    binding: str


def check_edition(edition, schemas):
    require(type(edition) is Edition and edition.schema_binding == schemas.binding, 'm02_edition_schema')
    pack = decode(SourcePack, json.loads(edition.source_bytes))
    check_pack(pack)
    require(canonical(asdict(pack)) == edition.source_bytes, 'm02_source_bytes')
    d = edition.delivery
    require(d.source_revision == pack.revision and d.position_refs == pack.due_position_refs, 'm02_source_delivery')
    positions = tuple(p for ref in d.position_refs for p in pack.positions if p.position_ref == ref)
    require(positions == edition.positions and len(positions) == len(d.position_refs), 'm02_positions')
    expected = make_xml(pack, d, positions)
    require(tree_projection(expected) == tree_projection(secure_parse(edition.xml)), 'm02_edition_model')
    require(namespace_binding(expected) == namespace_binding(secure_parse(edition.xml)), 'm02_edition_namespaces')
    binding = sha(canonical({'source': sha(edition.source_bytes), 'delivery': asdict(d),
                             'schema': schemas.binding, 'xml': sha(edition.xml)}))
    require(binding == edition.binding, 'm02_edition_binding')
    EditionBook(schemas).check_xml(edition, edition.xml)


def build_envelope(edition, spec, schemas=None):
    schemas = schemas or Schemas()
    require(type(spec) is EnvelopeSpec, 'm02_spec_type')
    uid(spec.revision); instant(spec.creation_time)
    require(spec == EnvelopeSpec(spec.revision, spec.creation_time, spec.transfer_ticket), 'm02_closed_spec')
    require(type(spec.transfer_ticket) is str and spec.transfer_ticket.startswith('SYNTHETIC-')
            and 10 < len(spec.transfer_ticket) <= 170 and spec.transfer_ticket.isascii()
            and all(c.isalnum() or c == '-' for c in spec.transfer_ticket), 'm02_synthetic_ticket')
    check_edition(edition, schemas)
    root = ET.Element('{'+DIP+'}dip', nsmap={'dip': DIP}, version='2.0')
    def add(parent, name, value=None, **attrs):
        n = ET.SubElement(parent, '{'+DIP+'}'+name, attrs)
        n.text = value
        return n
    header = add(root, 'header', environment=spec.environment)
    con = add(header, 'consignment'); customer = add(con, 'customerIdentifier')
    add(customer, 'identityProvider', spec.identity_provider)
    add(customer, 'identifier', spec.customer_identifier)
    add(con, 'creationTime', spec.creation_time); add(con, 'transferticketId', spec.transfer_ticket)
    add(header, 'application', code=spec.application)
    data = add(add(add(root, 'body'), 'consignmentItem', consignmentItemPosition=spec.item_position), 'data')
    dpi = deepcopy(secure_parse(edition.xml)); data.append(dpi)
    require(tree_projection(dpi) == tree_projection(secure_parse(edition.xml)), 'm02_embedded_model')
    raw = xml(root)
    schemas.validate(raw, 'dip.xsd', '{'+DIP+'}dip')
    EditionBook(schemas).check_xml(edition, xml(dpi))
    parsed = secure_parse(raw)
    octets = c14n(parsed); ns = namespace_binding(parsed)
    binding = sha(canonical({'profile': PROFILE, 'edition': edition.binding, 'spec': asdict(spec),
                             'xml': sha(raw), 'reference': sha(octets), 'namespaces': ns}))
    return UnsignedEnvelope(edition, spec, raw, octets, ns, binding)


def check_unsigned(unsigned, schemas=None):
    require(type(unsigned) is UnsignedEnvelope, 'm02_unsigned_type')
    expected = build_envelope(unsigned.edition, unsigned.spec, schemas)
    require(unsigned == expected, 'm02_unsigned_binding')
    return expected
