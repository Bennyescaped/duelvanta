"""Private V123 verifier -> native transaction bridge. No signer or external ACK.

The DB transport is injected by the isolated harness; there is no HTTP client,
credential discovery, file payload, public API, or in-memory commit substitute.
Only freeze(SignedEnvelope, controlled_context) can issue a persistence handle.
"""
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from weakref import WeakKeyDictionary
import base64
import binascii
import hashlib
import hmac
import json

from .security import Schemas, Rejected, require, canonical, sha, LIMIT
from .model import decode, SourcePack, Delivery, uid
from .serializer import Edition
from .envelope import (PROFILE, EnvelopeSpec, UnsignedEnvelope, secure_parse,
                       c14n, xml)
from .signature_profile import (SignedEnvelope, ExpectedTestPin, verify_signature,
                                remove_verified_signature, C14N, PSS, SHA256, ENVELOPED)
from .signed_validation import validate_bound_projection

CONTRACT = 'V123-W11-verified-envelope-commit/1'
CODEC = 'w11-canonical-json-base64/1'
MAX_BUNDLE = 32 * 1024 * 1024
BINARY = ('signed', 'unsigned', 'dpi', 'source', 'reference', 'projection', 'projection_c14n')
CONTEXT = {'proof_id','channel_id','operating_incarnation','operation_ref','envelope_revision',
 'admission_id','attempt_transition_id','admission_commit_ref','input_revision',
 'transition_commit_ref','transition_revision','scope_ids','configuration_revision',
 'receipt_revision','mapping_revision','stop_revision','predecessor_proof_id',
 'envelope','environment_binding'}
SOURCES = ('security.py','model.py','serializer.py','envelope.py','signature_profile.py','signed_validation.py','w11_bridge.py')

class CommitUnknown(Rejected):
    """Caller must observe the same proof before deciding any local retry."""

class _Frozen:
    def __init__(self):
        raise Rejected('w11_handle_not_constructible')

def _json(raw):
    require(type(raw) is bytes and 0 < len(raw) <= MAX_BUNDLE, 'w11_bundle_size')
    def pairs(items):
        require(len({k for k,_ in items}) == len(items), 'w11_duplicate_key')
        return dict(items)
    try:
        value = json.loads(raw, object_pairs_hook=pairs,
                          parse_constant=lambda _: (_ for _ in ()).throw(Rejected('w11_json_constant')))
        require(canonical(value) == raw, 'w11_noncanonical_json')
        return value
    except (UnicodeError, ValueError, RecursionError) as exc:
        raise Rejected('w11_json') from exc

def _b64(raw):
    require(type(raw) is bytes and 0 < len(raw) <= LIMIT, 'w11_component_size')
    return base64.b64encode(raw).decode('ascii')

def _unb64(value):
    require(type(value) is str and 0 < len(value) <= ((LIMIT+2)//3)*4, 'w11_codec_size')
    try:
        raw = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise Rejected('w11_codec') from exc
    require(_b64(raw) == value, 'w11_codec_canonical')
    return raw

def _closed(value, keys, code):
    require(type(value) is dict and set(value) == set(keys), code)

def _context(c, spec):
    _closed(c, CONTEXT, 'w11_context_fields')
    for k in ('proof_id','channel_id','operating_incarnation','operation_ref','envelope_revision',
              'admission_id','attempt_transition_id','admission_commit_ref','transition_commit_ref'):
        uid(c[k])
    if c['predecessor_proof_id'] is not None:
        uid(c['predecessor_proof_id'])
        require(c['predecessor_proof_id'] != c['proof_id'], 'w11_predecessor')
    for k in ('input_revision','transition_revision','configuration_revision','receipt_revision','mapping_revision','stop_revision'):
        require(type(c[k]) is int and c[k] >= (1 if k in ('input_revision','transition_revision','configuration_revision') else 0), 'w11_revision')
    require(type(c['scope_ids']) is list and 0 < len(c['scope_ids']) <= 4096 and c['scope_ids']==sorted(set(c['scope_ids'])), 'w11_scopes')
    for s in c['scope_ids']: uid(s)
    require(c['envelope_revision']==spec.revision, 'w11_spec_revision')
    e=c['envelope']
    _closed(e, ('contract','channel','system_ref','environment_ref','account_ref','event_ref','operation_ref',
        'attempt_ref','target_ref','operating_incarnation','epoch','result','proof_ref','payload'), 'w11_envelope_fields')
    _closed(e['payload'], ('detail_ref',), 'w11_payload_fields')
    for k in ('channel','system_ref','environment_ref','account_ref','event_ref','operation_ref','attempt_ref','target_ref','operating_incarnation','proof_ref'):
        uid(e[k])
    require(e['contract']=='synthetic-unit-result/1' and e['result']=='SIMULATED'
        and type(e['epoch']) is int and e['epoch']>0, 'w11_simulated_only')
    require(e['payload']['detail_ref']==c['proof_id'] and e['channel']==c['channel_id']
        and e['operation_ref']==c['operation_ref'] and e['operating_incarnation']==c['operating_incarnation']
        and e['target_ref']==c['admission_id'], 'w11_context_binding')
    require(c['environment_binding']==dict(origin='synthetic_test',environment='TEST',application='DAC7',
        dip_version='2.0',environment_ref=e['environment_ref'],account_ref=e['account_ref'],system_ref=e['system_ref']), 'w11_environment')

def _m02(signed, pin, schemas):
    require(type(signed) is SignedEnvelope and type(pin) is ExpectedTestPin, 'w11_verified_object_required')
    v=verify_signature(signed,pin)
    u=signed.unsigned; edition=u.edition
    evidence=validate_bound_projection(v,edition,u.spec,schemas)
    projection=remove_verified_signature(secure_parse(signed.xml),v.signature_path[0])
    raw=dict(signed=signed.xml,unsigned=u.xml,dpi=edition.xml,source=edition.source_bytes,
        reference=v.reference_octets,projection=xml(projection),projection_c14n=c14n(projection))
    require(raw['projection_c14n']==raw['reference'], 'w11_reference_projection')
    return dict(profile=PROFILE,bytes={k:_b64(x) for k,x in raw.items()},
        byte_hashes={k:sha(x) for k,x in raw.items()}, delivery=asdict(edition.delivery),
        edition_binding=edition.binding,schema_binding=edition.schema_binding,
        spec=asdict(u.spec),unsigned_binding=u.binding,namespace_sha256=u.namespace_sha256,
        pin=dict(certificate=_b64(pin.certificate_der),public_key=_b64(pin.public_key_der),
                 checked_at=pin.checked_at.isoformat(),origin=pin.origin),
        signature=dict(uri=v.reference_uri,transforms=list(v.transforms),signed_info_c14n=C14N,
                       reference_c14n=C14N,signature_method=PSS,digest_method=SHA256,
                       mgf='MGF1-SHA256',salt_length=32,path=list(v.signature_path)),
        evidence=asdict(evidence),catalog=schemas.entries,
        verifier_sources={n:sha(Path(__file__).with_name(n).read_bytes()) for n in SOURCES})

def _restore(m, pin, schemas):
    _closed(m, ('profile','bytes','byte_hashes','delivery','edition_binding','schema_binding','spec',
       'unsigned_binding','namespace_sha256','pin','signature','evidence','catalog','verifier_sources'), 'w11_m02_fields')
    _closed(m['bytes'],BINARY,'w11_binary_fields');_closed(m['byte_hashes'],BINARY,'w11_hash_fields')
    raw={k:_unb64(m['bytes'][k]) for k in BINARY}
    require({k:sha(v) for k,v in raw.items()}==m['byte_hashes'], 'w11_byte_hash')
    require(m['pin']==dict(certificate=_b64(pin.certificate_der),public_key=_b64(pin.public_key_der),
        checked_at=pin.checked_at.isoformat(),origin=pin.origin), 'w11_historical_pin')
    pack=decode(SourcePack,_json(raw['source'])); d=decode(Delivery,m['delivery'])
    positions=tuple(p for ref in d.position_refs for p in pack.positions if p.position_ref==ref)
    edition=Edition(d,raw['source'],raw['dpi'],m['edition_binding'],m['schema_binding'],positions)
    spec=decode(EnvelopeSpec,m['spec'])
    u=UnsignedEnvelope(edition,spec,raw['unsigned'],raw['reference'],m['namespace_sha256'],m['unsigned_binding'])
    signed=SignedEnvelope(u,raw['signed'],sha(raw['signed']),m['profile'])
    # This also checks every evidence value, catalog/source hash and signature parameter.
    require(canonical(_m02(signed,pin,schemas))==canonical(m), 'w11_full_revalidation')
    return signed

class W11Bridge:
    def __init__(self, pin, channel_key, storage_secret, schemas=None):
        require(type(pin) is ExpectedTestPin, 'w11_test_pin')
        require(type(channel_key) is bytes and len(channel_key)==32, 'w11_test_channel_key')
        require(type(storage_secret) is str and len(storage_secret)>=32, 'w11_storage_secret')
        self._pin=pin;self._key=channel_key;self._secret=storage_secret
        self._schemas=schemas or Schemas();self._issued=WeakKeyDictionary()

    def freeze(self, signed, controlled_context):
        m=_m02(signed,self._pin,self._schemas)
        c=_json(canonical(controlled_context));_context(c,signed.unsigned.spec)
        raw=canonical(dict(contract=CONTRACT,codec=CODEC,m02=m,context=c))
        _json(raw)
        token=object.__new__(_Frozen);self._issued[token]=raw
        return token

    def _input(self, token):
        require(type(token) is _Frozen and token in self._issued, 'w11_unissued_handle')
        data=_json(self._issued[token])
        # Never rely on a caller supplied PASS or even a previously issued handle alone.
        s=_restore(data['m02'],self._pin,self._schemas);_context(data['context'],s.unsigned.spec)
        return data

    def expectation(self, token, conflict_proof_id=None):
        data=self._input(token)
        if conflict_proof_id is not None: uid(conflict_proof_id)
        return {'proof_id':conflict_proof_id or data['context']['proof_id'],'input_sha256_canonical':sha(canonical(data)),
                'edition_binding':data['m02']['edition_binding']}

    def _mac(self, db, value):
        # Match PostgreSQL's existing jsonb::text HMAC contract, not a guessed codec.
        raw=db.query('select ($1::jsonb)::text v',[json.dumps(value)])[0]['v'].encode()
        return '\\x'+hmac.new(self._key,raw,hashlib.sha256).hexdigest()

    def bind_in_transaction(self, db, token):
        data=self._input(token)
        return db.query('select dv_market_private.psttg_w11_bind_verified_v1($1::jsonb,$2::bytea,$3::text) v',
          [json.dumps(data),self._mac(db,['w11-verified-input/1',data]),self._secret])[0]['v']

    def commit(self, db, token):
        db.query('begin isolation level read committed')
        try:
            result=self.bind_in_transaction(db,token)
        except Exception:
            db.query('rollback');raise
        try:
            db.query('commit')
        except Exception as exc:
            # No implicit retry, no new id, no second attempt. Caller must reconnect/read.
            raise CommitUnknown('w11_commit_unknown_read_before_retry') from exc
        return result

    def revalidate(self, stored, expectation):
        _closed(expectation,('proof_id','input_sha256_canonical','edition_binding'),'w11_expectation')
        _closed(stored,('bundle','observation','observation_mac','marker','eligible','external_ack_performed','real_receipt_adapter'),'w11_read_fields')
        require(stored['external_ack_performed'] is False and stored['real_receipt_adapter'] is False,'w11_real_boundary')
        b=stored['bundle'];_closed(b,('input','input_sha256','ingress','stored'),'w11_stored_fields')
        data=_json(canonical(b['input']))
        _closed(data,('contract','codec','m02','context'),'w11_input_fields')
        require(data['contract']==CONTRACT and data['codec']==CODEC,'w11_contract')
        s=_restore(data['m02'],self._pin,self._schemas);c=data['context'];_context(c,s.unsigned.spec)
        require(expectation==dict(proof_id=b['stored']['proof_id'],input_sha256_canonical=sha(canonical(data)),
                edition_binding=s.unsigned.edition.binding), 'w11_expected_edition')
        h=b['stored'];o=stored['observation']
        require(h['record_kind'] in ('BOUND','CONFLICT'), 'w11_record_kind')
        if h['record_kind']=='BOUND': require(h['proof_id']==c['proof_id'] and h['canonical_proof_id'] is None,'w11_canonical_identity')
        else: require(h['canonical_proof_id'] is not None and h['canonical_proof_id']!=h['proof_id'],'w11_conflict_identity')
        ingress=_json(canonical(c['envelope']));ingress['payload']['detail_ref']=h['proof_id']
        require(b['ingress']==ingress,'w11_ingress_binding')
        for k in ('channel_id','operating_incarnation','operation_ref','envelope_revision','admission_id','attempt_transition_id','predecessor_proof_id'):
            require(h[k]==c[k],'w11_header_context')
        require(h['event_ref']==c['envelope']['event_ref'] and h['contract']==CONTRACT,'w11_header_event')
        require(o['proof_id']==h['proof_id'] and o['input_sha256']==b['input_sha256'],'w11_observation_binding')
        return s

    def observe_and_mark(self, observer, expectation, mark=True):
        observer.query('begin isolation level read committed')
        try:
            stored=observer.query('select dv_market_private.psttg_w11_read_bound_v1($1::uuid,$2::text) v',
              [expectation['proof_id'],self._secret])[0]['v']
            self.revalidate(stored,expectation)
            result=stored
            if mark:
                require(stored['eligible'] is True,'w11_ack_blocked')
                o=stored['observation']
                result=observer.query('select dv_market_private.psttg_w11_mark_ack_ready_v1($1::jsonb,$2::bytea,$3::bytea,$4::text) v',
                  [json.dumps(o),'\\x'+stored['observation_mac'],self._mac(observer,['w11-revalidated/1',o]),self._secret])[0]['v']
                require(result['external_ack_performed'] is False,'w11_external_ack')
        except Exception:
            observer.query('rollback');raise
        try: observer.query('commit')
        except Exception as exc: raise CommitUnknown('w11_marker_commit_unknown_read_before_retry') from exc
        return result
