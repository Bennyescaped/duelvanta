"""Synthetic DIP/DSM/NN interpretation, without transport, ack or product writers."""
from dataclasses import dataclass, replace
from .security import DIP, DSM, NN, require, sha, canonical, parse, unzip
from .model import decode, instant, text
from typing import Literal

@dataclass(frozen=True)
class Correlation:
    origin: Literal['synthetic_test']
    environment: Literal['TEST']
    fixture_evidence: str
    binding: str
    xml_sha256: str
    attempt_ref: str
    transfer_number: str
    transfer_ticket: str
    response_id: str
    item_position: str
    customer_provider: Literal['ELSTER','BZST-CERT']
    customer_id: str
    creation_time: str
    message_ref: str
    nn_message_number: str
    nn_message_id: str
    nn_message_type: Literal['PROTOKOLL','NACHRICHT','VERWALTUNGSAKT']

@dataclass(frozen=True)
class Result:
    origin: str
    binding: str
    identity: str
    raw_sha256: str
    outcome: str
    dip_status: str | None
    dsm_status: str | None
    accepted: tuple[str,...]
    rejected: tuple[str,...]
    unresolved: tuple[str,...]
    reason: str
    file_errors: tuple[str,...] = ()
    record_errors: tuple = ()
    metadata_sha256: str | None = None
    data_sha256: str | None = None

class ReceiptBook:
    """Ephemeral byte journal. Native durability is tested separately via V114."""
    def __init__(self, schemas):
        self.schemas=schemas;self._contexts={};self._evidence={};self._conflicts=set();self._identities={}

    def register(self, edition, raw):
        c=decode(Correlation,raw)
        require(c.binding==edition.binding and c.xml_sha256==sha(edition.xml)
                and c.message_ref==edition.delivery.message_ref,'correlation_input_binding')
        for v in [c.fixture_evidence,c.attempt_ref,c.transfer_number,c.transfer_ticket,c.response_id,
                  c.customer_id,c.nn_message_number,c.nn_message_id]:
            text(v)
        require(c.item_position=='0','single_item_position')
        instant(c.creation_time)
        require(len(c.customer_id)<=16 and len(c.nn_message_number)<=32,'correlation_length')
        key=c.attempt_ref
        require(key not in self._contexts or self._contexts[key]==(edition,c),'correlation_conflict')
        scope=(c.environment,c.customer_provider,c.customer_id)
        ids=[(scope,label,getattr(c,label)) for label in ('transfer_number','transfer_ticket','response_id','nn_message_number','nn_message_id')]
        for identity in ids:
            require(identity not in self._identities or self._identities[identity]==(key,edition.binding), 'ambiguous_correlation_identity')
        for identity in ids:
            self._identities[identity]=(key,edition.binding)
        self._contexts[key]=(edition,c)
        return key

    def _base(self, key, raw, identity, reason, dip=None, dsm=None, outcome='UNRESOLVED', failed=(), file_errors=(), record_errors=()):
        edition,c=self._contexts[key]
        docs=tuple(d.doc_ref for d in edition.delivery.seller_docs)
        accepted=tuple(d for d in docs if d not in failed) if outcome in ('ACCEPTED','PARTIAL') else ()
        rejected=docs if outcome=='REJECTED' else tuple(d for d in docs if d in failed) if outcome=='PARTIAL' else ()
        unresolved=tuple(d for d in docs if d not in accepted and d not in rejected)
        return Result('synthetic_test',edition.binding,identity,sha(raw),outcome,dip,dsm,accepted,rejected,unresolved,reason,file_errors,record_errors)

    def _journal(self, scope, raw, result):
        identity=(scope,result.identity)
        versions=self._evidence.setdefault(identity,[])
        if raw not in versions:
            if versions:
                self._conflicts.add(identity)
            versions.append(raw)
        if identity in self._conflicts:
            all_docs=tuple(dict.fromkeys(result.accepted+result.rejected+result.unresolved))
            return replace(result,outcome='CONFLICT',accepted=(),rejected=(),unresolved=all_docs,reason='identity_changed_bytes')
        return result

    def evidence(self, scope, identity):
        return tuple(self._evidence.get((scope,identity),()))

    def http(self, key, stage, code):
        require(stage in ('start','upload','finish') and type(code) is int,'http_stage')
        return self._base(key,canonical([stage,code]),stage,'transport_not_acceptance',outcome='UNKNOWN')

    def missing(self, key):
        return self._base(key,b'missing','missing','no_receipt_no_resend',outcome='UNKNOWN')

    def _dsm(self, raw, expected_message):
        r=self.schemas.validate(raw,'erweiterung_amtlichen_datensatz.xml','{'+DSM+'}DAC7StatusMessage')
        ns={'d':DSM}
        get=lambda path:r.findtext(path,namespaces=ns)
        require(get('d:MessageSpec/d:TransmittingCountry')=='DE' and get('d:MessageSpec/d:ReceivingCountry')=='DE','dsm_country')
        status=get('d:DSMBody/d:ValidationResult/d:Status')
        reference=get('d:DSMBody/d:OriginalMessage/d:OriginalMessageRefID')
        files=tuple(r.xpath('d:DSMBody/d:ValidationErrors/d:FileError/d:Code/text()',namespaces=ns))
        errors=[]
        for e in r.findall('d:DSMBody/d:ValidationErrors/d:RecordError',ns):
            errors.append((e.findtext('d:Code',namespaces=ns),tuple(e.xpath('d:DocRefIDInError/text()',namespaces=ns))))
        return reference==expected_message,status,files,tuple(errors),get('d:MessageSpec/d:MessageRefId')

    def dip(self, key, raw):
        require(key in self._contexts,'unknown_attempt')
        edition,c=self._contexts[key]
        root=self.schemas.validate(raw,'dipResponse.xsd','{'+DIP+'}dipResponse')
        ns={'d':DIP}
        get=lambda path:root.findtext(path,namespaces=ns)
        identity=get('d:responseTransferticketId')
        status=get('d:dipProtocol/d:processStatus')
        base=lambda reason,**kw:self._base(key,raw,identity,reason,dip=status,**kw)
        def finish(result):
            return self._journal(('DIP',c.environment,c.customer_provider,c.customer_id),raw,result)
        if identity!=c.response_id or root.get('version')!='2.0':
            return finish(base('response_identity_or_version'))
        cons=root.find('d:dipProtocol/d:consignment',ns)
        if cons is None:
            return finish(base('early_error_without_consignment' if status=='ERROR' else 'missing_consignment'))
        expected={'customerIdentifier/identityProvider':c.customer_provider,'customerIdentifier/identifier':c.customer_id,
                  'creationTime':c.creation_time,'transferticketId':c.transfer_ticket}
        for path,value in expected.items():
            if cons.findtext('/'.join('d:'+part for part in path.split('/')),namespaces=ns)!=value:
                return finish(base('consignment_correlation'))
        if cons.find('d:referenceId',ns) is not None:
            return finish(base('unregistered_reference_delivery'))
        transport=root.findall('d:dipProtocol/d:dipResult',ns)
        payload=root.findall('d:dipProtocol/d:payloadResult',ns)
        dsm_status=None;files=();errors=()
        if len(payload)>1:
            return finish(base('multiple_payload_items'))
        if payload:
            p=payload[0]
            if p.get('consignmentItemPosition')!=c.item_position or p.get('schemaVersion') not in (None,'1.0'):
                return finish(base('payload_item_correlation'))
            if len(p)!=1 or p[0].tag!='{'+DSM+'}DAC7StatusMessage' or (p.text or '').strip() or (p[0].tail or '').strip():
                return finish(base('unknown_payload_content'))
            from lxml import etree as ET
            matched,dsm_status,files,errors,dsm_id=self._dsm(ET.tostring(p[0],with_tail=False),c.message_ref)
            dsm_raw=ET.tostring(p[0],with_tail=False)
            dsm_result=self._journal(('DSM',c.environment,c.customer_provider,c.customer_id),dsm_raw,
                                     replace(base('dsm_observation'),identity=dsm_id,raw_sha256=sha(dsm_raw)))
            if dsm_result.outcome=='CONFLICT':
                return finish(base('dsm_identity_changed_bytes',outcome='CONFLICT'))
            if not matched:
                return finish(base('dsm_original_reference',dsm=dsm_status,file_errors=files,record_errors=errors))
        kwargs={'dsm':dsm_status,'file_errors':files,'record_errors':errors}
        known={x.doc_ref for x in edition.delivery.seller_docs};operator=edition.delivery.operator_doc.doc_ref
        refs={ref for _,items in errors for ref in items}
        if any(not items for _,items in errors) or not refs <= known|{operator}:
            return finish(base('incomplete_or_foreign_error_scope',**kwargs))
        if status=='OK':
            if transport or files or errors or dsm_status=='Rejected':
                return finish(base('contradictory_OK',**kwargs))
            # V116: a fully correlated final OK needs no invented mandatory DSM.
            return finish(base('final_DIP_OK',outcome='ACCEPTED',**kwargs))
        if status=='ERROR':
            if dsm_status=='Accepted' and not files and not errors:
                return finish(base('contradictory_ERROR',**kwargs))
            return finish(base('whole_delivery_error',outcome='REJECTED',**kwargs))
        # Whole-file/operator failure always prevents any acceptance.
        if files or operator in refs:
            return finish(base('file_or_operator_error',outcome='REJECTED',**kwargs))
        if transport or dsm_status!='Accepted' or not errors or not refs or refs==known:
            return finish(base('partial_scope_not_proven',**kwargs))
        return finish(base('fully_mapped_partial',outcome='PARTIAL',failed=refs,**kwargs))

    def nn(self,key,raw):
        require(key in self._contexts,'unknown_attempt')
        edition,c=self._contexts[key]
        files=unzip(raw);meta=files['metadaten.xml'];data=files['daten.xml']
        r=self.schemas.validate(meta,'dipMessage.xsd','{'+NN+'}dipMessage')
        ns={'n':NN};get=lambda path:r.findtext(path,namespaces=ns)
        identity=get('n:messageId');scope=('NN',c.environment,c.customer_provider,c.customer_id)
        def finish(result):
            return self._journal(scope,raw,replace(result,identity=identity,raw_sha256=sha(raw),metadata_sha256=sha(meta),data_sha256=sha(data)))
        expected={'environment':c.environment,'messageId':c.nn_message_id,'messageType':c.nn_message_type,
                  'senderApplicationCode':'DAC7','customerIdentifier/identityProvider':c.customer_provider,'customerIdentifier/identifier':c.customer_id}
        # Parse data regardless of its claimed metadata type; malicious XML is always rejected.
        content=parse(data)
        if any(get('/'.join('n:'+p for p in path.split('/')))!=value for path,value in expected.items()):
            return finish(self._base(key,raw,identity,'nn_metadata_mismatch'))
        if c.nn_message_type!='PROTOKOLL':
            return finish(self._base(key,raw,identity,'nn_not_final_protocol'))
        if content.tag=='{'+DIP+'}dipResponse':
            return finish(self.dip(key,data))
        if content.tag=='{'+DSM+'}DAC7StatusMessage':
            matched,status,fe,re,_=self._dsm(data,c.message_ref)
            # No final DIP status: retain DSM observation, do not infer an accepted rest set.
            return finish(self._base(key,raw,identity,'standalone_dsm_requires_final_correlation' if matched else 'dsm_original_reference',dsm=status,file_errors=fe,record_errors=re))
        return finish(self._base(key,raw,identity,'unknown_nn_content'))
