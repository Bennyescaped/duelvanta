"""Fictional controlled sources and responses. No official example is an oracle."""
from copy import deepcopy
from uuid import UUID
from lxml import etree as ET
import io
import zipfile
from .model import PROFILE,RULES
from .security import DIP,DSM,NN,sha

def uid(n):
    return str(UUID(int=n))

def source(count=2):
    address={'street_line1':'Erfundene Straße 17 Hinterhaus','street_line2':'Etage 2', 'postal_code':'01234','city':'Teststadt','country_code':'DE'}
    tin={'value':'12345678901','issuing_country':'DE','kind':'IDNR','allocation_evidence':'synthetic-allocation/1','priority_evidence':'synthetic-no-W-ID/1'}
    operator={'revision':uid(1),'legal_name':'Fiktiver Testbetreiber','address':deepcopy(address),'tax_ids':[deepcopy(tin)],
              'registration':'not_applicable_domestic','platform_names':['Testplattform'],'residence_countries':['DE'],
              'vat_id':None,'applicability_evidence':'synthetic-domestic-no-VAT-no-nexus/1','nexus':'not_applicable','assumed_reporting':False}
    positions=[]
    for n in range(1,count+1):
        seller=uid(100+n);person=uid(200+n);position=uid(300+n)
        events=[]
        for j in range(2):
            # Individual cent values sum exactly to EUR 10 consideration / EUR 2 fees.
            events.append({'event_id':uid(1000+n*10+j),'event_key':f'event-{n}-{j}','version':1,'seller_id':seller,
                'snapshot_ref':f'snapshot-{n}-{j}','allocation_ref':f'allocation-{n}-{j}','source_type':'synthetic_remuneration',
                'source_reference':f'payment-{n}-{j}','evidence_binding':'synthetic-paid-complete/1','occurred_at':'2025-01-15T12:00:00Z',
                'created_at':'2025-01-15T12:00:01Z','reporting_year':2025,'quarter':1,'currency':'EUR','gross_cents':'600',
                'platform_cents':'50','commission_cents':'50','tax_cents':'0','consideration_cents':'500','activities':1,'correction_of':None})
        positions.append({'position_ref':position,'content_revision':1,'predecessor_ref':None,'reporting_year':2025,'activity_kind':'GOODS_SALE',
            'subject':{'person_ref':person,'seller_ids':[seller],'subject_type':'natural_person','first_name':f'Fiktiva{n}',
                'last_name':'Mustertest','address':deepcopy(address),'birth_date':'1988-05-04','tins':[deepcopy(tin)],
                'no_tin_basis':'not_applicable','no_tin_evidence':None,'birth_place':None,'vat_id':None,'vat_evidence':'synthetic-no-vat/1',
                'residence_countries':['DE'],'gvs_used':False},'financial_accounts':[],
            'decision':{'eligibility_ref':f'synthetic-eligible-{n}','assessment_version':'synthetic-decision/1','assessed_at':'2026-01-02T00:00:00Z',
                'source_cutoff':'2026-01-01T00:00:00Z','completeness_ref':f'synthetic-full-year-{n}',
                'account_evidence':f'synthetic-accounts-{n}','activity_count_basis':'paid_contract_snapshot_one_activity',
                'financial_evidence':'synthetic-DE-residence/1','financial_mode':'DE_exemption'},
            'events':events,'annual_gross_cents':'1200','annual_consideration_cents':'1000'})
    return {'origin':'synthetic_test','environment':'TEST','attestation':'fictional-fixture-never-real/1','producer':'offline-synthetic-fixture/1',
            'revision':uid(10),'operator':operator,'positions':positions,'known_person_refs':[p['subject']['person_ref'] for p in positions],
            'known_seller_ids':[s for p in positions for s in p['subject']['seller_ids']],
            'known_event_ids':[e['event_id'] for p in positions for e in p['events']],
            'due_position_refs':[p['position_ref'] for p in positions],'completeness_evidence':'synthetic-complete-inventory/1'}

def delivery(pack, number=1,mode='initial',previous=None):
    return {'profile':PROFILE,'revision':uid(4000+number),'source_revision':pack['revision'],'reporting_year':2025,
            'position_refs':pack['due_position_refs'],'message_ref':f'DE2025DEsynthetic-message-{number}','timestamp':'2026-01-03T12:00:00Z',
            'sending_entity_in':pack['operator']['tax_ids'][0]['value'],'mode':mode,'rules':RULES,
            'operator_doc':{'kind':'operator','owner_ref':pack['operator']['revision'],'doc_type':'OECD1' if mode=='initial' else 'OECD0',
                            'doc_ref':'DE2025-operator-1','corr_doc_ref':None},
            'seller_docs':[{'kind':'seller','owner_ref':p['subject']['person_ref'],
                           'doc_type':{'initial':'OECD1','supplement':'OECD1','correction':'OECD2','deletion_reference':'OECD3'}[mode],
                           'doc_ref':f'DE2025-seller-{number}-{i}',
                           'corr_doc_ref':previous.delivery.seller_docs[i].doc_ref if mode in ('correction','deletion_reference') else None}
                           for i,p in enumerate(pack['positions']) if p['position_ref'] in pack['due_position_refs']]}

def context(edition):
    return {'origin':'synthetic_test','environment':'TEST','fixture_evidence':'controlled-receipt-fixture/1','binding':edition.binding,
            'xml_sha256':sha(edition.xml),'attempt_ref':uid(5000),'transfer_number':'DTN-1','transfer_ticket':'TICKET-1',
            'response_id':'RESPONSE-1','item_position':'0','customer_provider':'ELSTER','customer_id':'SYNTHETIC-01',
            'creation_time':'2026-01-03T12:00:01Z','message_ref':edition.delivery.message_ref,
            'nn_message_number':'NN-NUMBER-1','nn_message_id':'NN-ID-1','nn_message_type':'PROTOKOLL'}

def element(parent,ns,name,value=None,attrs=None):
    n=ET.SubElement(parent,'{'+ns+'}'+name,attrs or {})
    if value is not None:n.text=value
    return n

def dsm(c,status='Accepted',errors=(),file_errors=(),original=True):
    r=ET.Element('{'+DSM+'}DAC7StatusMessage',nsmap={'dsm':DSM},version='1.0');m=element(r,DSM,'MessageSpec')
    for k,v in [('TransmittingCountry','DE'),('ReceivingCountry','DE'),('MessageType','DPI'),('MessageRefId','DSM-ID-1'),('Timestamp','2026-01-03T12:01:00Z')]:element(m,DSM,k,v)
    b=element(r,DSM,'DSMBody');o=element(b,DSM,'OriginalMessage')
    if original:element(o,DSM,'OriginalMessageRefID',c['message_ref'])
    err=element(b,DSM,'ValidationErrors')
    for code in file_errors:element(element(err,DSM,'FileError'),DSM,'Code',code)
    for refs in errors:
        e=element(err,DSM,'RecordError');element(e,DSM,'Code','40100')
        for ref in refs:element(e,DSM,'DocRefIDInError',ref)
    result=element(b,DSM,'ValidationResult');element(result,DSM,'Status',status);element(result,DSM,'ValidatedBy','synthetic-local-validator/1')
    return r

def dip(c,status='OK',status_message=None,consignment=True,transport_error=False):
    r=ET.Element('{'+DIP+'}dipResponse',nsmap={'dip':DIP},version='2.0');element(r,DIP,'responseTransferticketId',c['response_id']);p=element(r,DIP,'dipProtocol')
    if consignment:
        co=element(p,DIP,'consignment');customer=element(co,DIP,'customerIdentifier')
        element(customer,DIP,'identityProvider',c['customer_provider']);element(customer,DIP,'identifier',c['customer_id'])
        element(co,DIP,'creationTime',c['creation_time']);element(co,DIP,'transferticketId',c['transfer_ticket'])
    element(p,DIP,'processStatus',status)
    if transport_error:element(element(p,DIP,'dipResult'),DIP,'code','E0001')
    if status_message is not None:
        element(p,DIP,'payloadResult',attrs={'consignmentItemPosition':c['item_position'],'schemaVersion':'1.0'}).append(status_message)
    return ET.tostring(r,encoding='UTF-8',xml_declaration=True)

def nn(c,data,mutate=None):
    r=ET.Element('{'+NN+'}dipMessage',nsmap={'nn':NN})
    for k,v in [('environment',c['environment']),('messageId',c['nn_message_id']),('messageType',c['nn_message_type']),('senderApplicationCode','DAC7')]:element(r,NN,k,v)
    customer=element(r,NN,'customerIdentifier');element(customer,NN,'identityProvider',c['customer_provider']);element(customer,NN,'identifier',c['customer_id'])
    element(r,NN,'creationTime','2026-01-03T12:02:00Z')
    if mutate:mutate(r)
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:
        for name,raw in [('metadaten.xml',ET.tostring(r)),('daten.xml',data)]:
            item=zipfile.ZipInfo(name,date_time=(2026,1,3,12,2,0));z.writestr(item,raw)
    return out.getvalue()
