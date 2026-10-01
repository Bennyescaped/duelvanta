"""Private offline XML/ZIP boundary. No network or external entity fallback."""
from pathlib import Path, PurePosixPath
from contextlib import nullcontext
from threading import Lock
import hashlib
import io
import json
import zipfile
from lxml import etree as ET

DPI = 'urn:oecd:ties:dpi:v1'
STF = 'urn:oecd:ties:dpistf:v1'
DSM = 'urn:oecd:ties:dsm:v1'
DIP = 'http://itzbund.de/ozg/bzst/post/dip/v2/'
NN = 'http://itzbund.de/ozg/bzst/post/dipmsg/v1/'
XSD = 'http://www.w3.org/2001/XMLSchema'
LIMIT = 4 * 1024 * 1024

class Rejected(ValueError):
    pass

def require(ok, code):
    if not ok:
        raise Rejected(code)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()

def parse(data):
    require(type(data) is bytes and 0 < len(data) <= LIMIT, 'xml_size')
    parser = ET.XMLParser(resolve_entities=False, load_dtd=False, no_network=True,
                          huge_tree=False, remove_comments=False, remove_pis=False)
    try:
        root = ET.fromstring(data, parser)
    except ET.XMLSyntaxError as exc:
        raise Rejected('xml_syntax') from exc
    require(not root.getroottree().docinfo.doctype, 'xml_dtd')
    require(root.getprevious() is None and root.getnext() is None, 'xml_outer_pi_comment')
    nodes = list(root.iter())
    require(len(nodes) <= 40000, 'xml_nodes')
    for node in nodes:
        require(type(node.tag) is str, 'xml_entity_comment_pi')
        require(len(list(node.iterancestors())) < 32, 'xml_depth')
        require(not any(k.startswith('{http://www.w3.org/2001/XMLSchema-instance}') for k in node.attrib), 'xml_xsi')
    return root

class Schemas:
    def __init__(self, directory=None):
        self.directory = Path(directory or Path(__file__).with_name('schemas')).resolve()
        manifest = json.loads((self.directory / 'catalog.json').read_bytes())
        self.entries = {e['file']: e for e in manifest['files']}
        self.bytes = {}
        for name, entry in self.entries.items():
            require(Path(name).name == name, 'catalog_path')
            raw = (self.directory / name).read_bytes()
            require(sha(raw) == entry['sha256'], 'schema_hash')
            root = ET.fromstring(raw, ET.XMLParser(resolve_entities=False, no_network=True))
            require(root.get('targetNamespace') == entry['namespace'], 'schema_namespace')
            self.bytes[name] = raw
        # Validate every include/import's declared namespace, exact filename and pinned bytes.
        for name, raw in self.bytes.items():
            root = ET.fromstring(raw)
            for dep in root.findall(f'{{{XSD}}}import') + root.findall(f'{{{XSD}}}include'):
                target = dep.get('schemaLocation')
                require(target in self.entries, 'schema_catalog_closed')
                ns = dep.get('namespace') if dep.tag.endswith('import') else root.get('targetNamespace')
                require(ns == self.entries[target]['namespace'], 'schema_import_namespace')
        owner = self
        class Resolver(ET.Resolver):
            def resolve(self, url, public_id, context):
                # Only a catalog pseudo-URL or the exact relative catalog filename is accepted.
                name = url.removeprefix('catalog:///')
                require(name in owner.bytes, 'schema_external_resolution')
                return self.resolve_string(owner.bytes[name], context, base_url='catalog:///' + name)
        self.parser = ET.XMLParser(resolve_entities=False, load_dtd=False, no_network=True)
        self.parser.resolvers.add(Resolver())
        self.validators = {}
        self._dip_lock = Lock()
        for name in self.entries:
            self.validators[name] = ET.XMLSchema(ET.fromstring(self.bytes[name], self.parser, base_url='catalog:///' + name))
        self.binding = sha(canonical(manifest))
        require(self.binding == 'b75bf9ca483040ef1ddb4ce901be2a190c486df40969dd429e73143b79961ba9', 'catalog_pin')

    def validate(self, data, name, root_tag):
        root = parse(data)
        require(root.tag == root_tag, 'xml_root_namespace')
        try:
            with self._dip_lock if name == 'dip.xsd' else nullcontext():
                self.validators[name].assertValid(root)
        except ET.DocumentInvalid as exc:
            # Do not put sensitive values in error output.
            raise Rejected('xsd_invalid:' + name) from exc
        return root

def unzip(data):
    require(type(data) is bytes and 0 < len(data) <= LIMIT, 'zip_size')
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            members = archive.infolist()
            require(1 <= len(members) <= 3, 'zip_count')
            require(sum(m.file_size for m in members) <= LIMIT, 'zip_expanded_size')
            names = [m.filename for m in members]
            require(len(set(names)) == len(names), 'zip_duplicate')
            require(set(names) == {'metadaten.xml', 'daten.xml'}, 'zip_members_or_nested_archive')
            result = {}
            for member in members:
                p = PurePosixPath(member.filename)
                require(not p.is_absolute() and len(p.parts) == 1 and '..' not in p.parts
                        and '\\' not in member.filename, 'zip_path')
                require((member.external_attr >> 16) & 0o170000 != 0o120000, 'zip_symlink')
                require(not member.flag_bits & 1 and member.compress_type in (0, 8), 'zip_encoding')
                require(member.file_size <= LIMIT and member.file_size <= max(1, member.compress_size) * 200, 'zip_ratio')
                with archive.open(member) as stream:
                    raw = stream.read(LIMIT + 1)
                require(len(raw) == member.file_size and len(raw) <= LIMIT, 'zip_actual_size')
                result[member.filename] = raw
            return result
    except (zipfile.BadZipFile, RuntimeError, NotImplementedError) as exc:
        raise Rejected('zip_invalid') from exc
