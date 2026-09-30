"""Deterministic DPI only. In-memory edition book is NOT a durable commit proof."""
from dataclasses import dataclass, asdict
from lxml import etree as ET
from .security import DPI, STF, require, canonical, sha, parse
from .model import SourcePack, Delivery, decode, check_pack, quarters, text, uid, instant, RULES


def node(parent, name, value=None, attrs=None, namespace=DPI):
    child = ET.SubElement(parent, '{'+namespace+'}'+name, attrs or {})
    if value is not None:
        child.text = str(value)
    return child

def address(parent, value, operator=False):
    a = node(parent,'Address',attrs={'legalAddressType':'OECD304'} if operator else None)
    node(a,'CountryCode',value.country_code)
    fix = node(a,'AddressFix')
    node(fix,'PostCode',value.postal_code); node(fix,'City',value.city)
    # Preserve original street lines; do not guess a building identifier.
    node(a,'AddressFree','\n'.join(v for v in (value.street_line1,value.street_line2) if v is not None))

def tin(parent, values):
    if not values:
        node(parent,'TIN',attrs={'unknown':'true'})
    for value in values:
        node(parent,'TIN',value.value,{'issuedBy':value.issuing_country,'unknown':'false'})

def docspec(parent, doc):
    d = node(parent,'DocSpec')
    node(d,'DocTypeIndic',doc.doc_type,namespace=STF)
    node(d,'DocRefId',doc.doc_ref,namespace=STF)
    if doc.corr_doc_ref is not None:
        node(d,'CorrDocRefId',doc.corr_doc_ref,namespace=STF)

def make_xml(pack, delivery, positions):
    root = ET.Element('{'+DPI+'}DPI_OECD', nsmap={'dpi':DPI,'stf':STF}, version='1.0')
    sm = node(root,'MessageSpec')
    for k,v in [('SendingEntityIN',delivery.sending_entity_in),('TransmittingCountry','DE'),('ReceivingCountry','DE'),
                ('MessageType','DPI'),('MessageRefId',delivery.message_ref),
                ('MessageTypeIndic','DPI401' if delivery.mode in ('initial','supplement') else 'DPI402'),
                ('ReportingPeriod',str(delivery.reporting_year)+'-12-31'),('Timestamp',delivery.timestamp)]:
        node(sm,k,v)
    body = node(root,'DPIBody'); op = node(body,'PlatformOperator'); operator = pack.operator
    for c in operator.residence_countries:
        node(op,'ResCountryCode',c)
    tin(op,operator.tax_ids)
    if operator.vat_id is not None:
        node(op,'VAT',operator.vat_id)
    node(op,'Name',operator.legal_name)
    for name in operator.platform_names:
        node(op,'PlatformBusinessName',name)
    address(op,operator.address,True)
    node(op,'AssumedReporting','false')
    docspec(op,delivery.operator_doc)
    for p,doc in zip(positions,delivery.seller_docs,strict=True):
        rs = node(body,'ReportableSeller'); ident = node(node(node(rs,'Identity'),'IndividualSeller'),'Standard')
        person = node(ident,'IndSellerID'); s = p.subject
        for c in s.residence_countries:
            node(person,'ResCountryCode',c)
        tin(person,s.tins)
        if s.vat_id is not None:
            node(person,'VAT',s.vat_id)
        name = node(person,'Name'); node(name,'FirstName',s.first_name); node(name,'LastName',s.last_name)
        address(person,s.address)
        birth = node(person,'BirthInfo'); node(birth,'BirthDate',s.birth_date)
        if s.birth_place is not None:
            b=s.birth_place; place=node(birth,'BirthPlace');node(place,'City',b.city)
            if b.subentity is not None:
                node(place,'CitySubentity',b.subentity)
            country=node(place,'CountryInfo')
            node(country,'CountryCode' if b.country_code is not None else 'FormerCountryName',b.country_code or b.former_country)
        for account in p.financial_accounts:
            fi=node(ident,'FinancialIdentifier');node(fi,'Identifier',account.identifier,{'AccountNumberType':account.kind})
            if account.holder_name is not None:
                node(fi,'AccountHolderName',account.holder_name)
            if account.other_info is not None:
                node(fi,'OtherInfo',account.other_info)
        goods=node(node(rs,'RelevantActivities'),'SaleOfGoods')
        qs=quarters(p)
        for index,group,prefix in [(0,'Consideration','ConsQ'),(1,'NumberOfActivities','NumbQ'),(2,'Fees','FeesQ'),(3,'Taxes','TaxQ')]:
            g=node(goods,group)
            for q,values in enumerate(qs,1):
                node(g,prefix+str(q),values[index],None if index==1 else {'currCode':'EUR'})
        docspec(rs,doc)
    return root

def tree_projection(root):
    # Expanded names, attributes, text and exact child order; no ignored extensions.
    return (root.tag,tuple(sorted(root.attrib.items())),root.text or '',root.tail or '',
            tuple(tree_projection(c) for c in root))

@dataclass(frozen=True)
class Edition:
    delivery: Delivery
    source_bytes: bytes
    xml: bytes
    binding: str
    schema_binding: str
    positions: tuple

class EditionBook:
    def __init__(self, schemas):
        self.schemas=schemas
        self._sources={}; self._editions={}; self._messages={}; self._docs={}; self._accepted={}
        self.conflicts=[]; self._applied_receipts=set()

    def register_source(self, raw):
        pack=decode(SourcePack,raw);check_pack(pack);data=canonical(asdict(pack))
        old=self._sources.get(pack.revision)
        if old is not None and old[1]!=data:
            self.conflicts.append((pack.revision,old[1],data))
            require(False,'source_revision_conflict')
        self._sources[pack.revision]=(pack,data)
        return pack

    def build(self, raw):
        d=decode(Delivery,raw); uid(d.revision); instant(d.timestamp); text(d.sending_entity_in)
        require(d.rules==RULES,'rules_version')
        require(d.source_revision in self._sources,'source_not_registered')
        pack,source_bytes=self._sources[d.source_revision]
        require(d.position_refs==pack.due_position_refs,'full_ordered_batch')
        if d.mode=='initial':
            require(d.position_refs==tuple(p.position_ref for p in pack.positions),'initial_known_positions_missing')
        if d.mode=='supplement':
            expected=tuple(p.position_ref for p in pack.positions if ('seller',p.subject.person_ref,d.reporting_year) not in self._accepted)
            require(d.position_refs==expected,'supplement_known_positions_missing')
        positions=tuple(next(p for p in pack.positions if p.position_ref==ref) for ref in d.position_refs)
        require(all(p.reporting_year==d.reporting_year for p in positions),'year_mismatch')
        require(d.timestamp[:10] > f'{d.reporting_year}-12-31','reporting_period_not_finished')
        require(d.message_ref.startswith(f'DE{d.reporting_year}DE') and len(d.message_ref)>8,'message_ref_format')
        text(d.message_ref,170)
        require(d.sending_entity_in in [t.value for t in pack.operator.tax_ids],'sender_tax_binding')
        require(d.operator_doc.kind=='operator' and d.operator_doc.owner_ref==pack.operator.revision,'operator_doc')
        require(len(d.seller_docs)==len(positions),'seller_doc_count')
        docs=(d.operator_doc,)+d.seller_docs
        require(len({x.doc_ref for x in docs})==len(docs),'duplicate_doc_ref')
        for x in docs:
            text(x.doc_ref,200);require(x.doc_ref.startswith(f'DE{d.reporting_year}-') and len(x.doc_ref)>7,'doc_ref_format')
        request=canonical(asdict(d))
        if d.revision in self._editions:
            old=self._editions[d.revision]
            require(canonical(asdict(old.delivery))==request and old.source_bytes==source_bytes,'edition_conflict')
            return old
        require(d.message_ref not in self._messages,'message_reuse')
        op_payload=canonical(asdict(pack.operator))
        op_key=('operator',pack.operator.revision,d.reporting_year)
        accepted_op=self._accepted.get(op_key)
        if d.mode=='initial':
            require(d.operator_doc.doc_type=='OECD1' and not any(k[0]=='operator' and k[2]==d.reporting_year for k in self._accepted),'operator_initial')
        else:
            require(d.operator_doc.doc_type=='OECD0' and accepted_op is not None
                    and accepted_op==(d.operator_doc.doc_ref,op_payload),'operator_unchanged_accepted')
        require(d.operator_doc.corr_doc_ref is None,'operator_correction_outside_seller_profile')
        for p,x in zip(positions,d.seller_docs,strict=True):
            require(x.kind=='seller' and x.owner_ref==p.subject.person_ref,'typed_seller_doc')
            key=('seller',p.subject.person_ref,d.reporting_year)
            old=self._accepted.get(key)
            if d.mode in ('initial','supplement'):
                require(x.doc_type=='OECD1' and x.corr_doc_ref is None and old is None,'new_or_rejected_seller_only')
            else:
                require(x.doc_type==('OECD2' if d.mode=='correction' else 'OECD3') and old is not None
                        and x.corr_doc_ref==old[0],'latest_accepted_same_kind')
                previous=old[1]
                require(previous is not None,'deleted_reference')
                require(p.subject.residence_countries==previous.subject.residence_countries,'residence_change_special_route')
                require(p.content_revision>previous.content_revision and p.predecessor_ref==previous.position_ref,'internal_predecessor')
                require(p.reporting_year==previous.reporting_year,'year_change_special_route')
        for x in docs:
            if x.doc_type!='OECD0':
                require(x.doc_ref not in self._docs,'doc_ref_reuse')
        root=make_xml(pack,d,positions)
        xml=ET.tostring(root,encoding='UTF-8',xml_declaration=True)
        parsed=self.schemas.validate(xml,'DPIXML_v1.0.xsd','{'+DPI+'}DPI_OECD')
        require(tree_projection(parsed)==tree_projection(root),'roundtrip_projection')
        require(tuple(parsed.xpath('dpi:DPIBody/dpi:ReportableSeller/dpi:DocSpec/stf:DocRefId/text()',namespaces={'dpi':DPI,'stf':STF}))==tuple(x.doc_ref for x in d.seller_docs),'roundtrip_full_positions')
        binding=sha(canonical({'source':sha(source_bytes),'delivery':asdict(d),'schema':self.schemas.binding,'xml':sha(xml)}))
        result=Edition(d,source_bytes,xml,binding,self.schemas.binding,positions)
        self._editions[d.revision]=result;self._messages[d.message_ref]=d.revision
        for x in docs:
            if x.doc_type!='OECD0':
                self._docs[x.doc_ref]=d.revision
        return result

    def check_xml(self, edition, raw):
        actual=self.schemas.validate(raw,'DPIXML_v1.0.xsd','{'+DPI+'}DPI_OECD')
        expected=parse(edition.xml)
        require(tree_projection(actual)==tree_projection(expected),'closed_business_projection')

    def accept_synthetic(self, edition, receipt):
        # Private test book, no SQL/export/product imports or real acceptance route.
        require(receipt.origin=='synthetic_test' and receipt.binding==edition.binding
                and receipt.outcome in ('ACCEPTED','PARTIAL'),'synthetic_receipt_required')
        receipt_key=(edition.binding,receipt.identity,receipt.raw_sha256)
        if receipt_key in self._applied_receipts:
            return
        pack,_=self._sources[edition.delivery.source_revision]
        d=edition.delivery
        for p,doc in zip(edition.positions,d.seller_docs,strict=True):
            if doc.doc_ref in receipt.accepted:
                prior=self._accepted.get(('seller',p.subject.person_ref,d.reporting_year))
                require((doc.doc_type=='OECD1' and prior is None) or
                        (doc.doc_type in ('OECD2','OECD3') and prior is not None and prior[0]==doc.corr_doc_ref), 'stale_acceptance_chain')
        self._applied_receipts.add(receipt_key)
        require(set(receipt.accepted)<=set(x.doc_ref for x in d.seller_docs),'accepted_scope')
        self._accepted[('operator',pack.operator.revision,d.reporting_year)]=(d.operator_doc.doc_ref,canonical(asdict(pack.operator)))
        for p,doc in zip(edition.positions,d.seller_docs,strict=True):
            if doc.doc_ref in receipt.accepted:
                key=('seller',p.subject.person_ref,d.reporting_year)
                if doc.doc_type=='OECD3':
                    # Tombstone only in the ephemeral synthetic reference book, never physical erasure.
                    self._accepted[key]=(doc.doc_ref,None)
                else:
                    self._accepted[key]=(doc.doc_ref,p)
