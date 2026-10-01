"""Executable offline XSD/business tests. No database/real-origin PASS claimed."""
import sys,json,copy,io,zipfile,tempfile,shutil
from pathlib import Path
from dataclasses import asdict
from lxml import etree as ET
from psttg_wire.security import Schemas,Rejected,parse,unzip,DPI,STF,DIP,DSM,NN,sha
from psttg_wire.serializer import EditionBook
from psttg_wire.receipts import ReceiptBook
from psttg_wire import fixtures as f

schemas=Schemas();cases=[]
def check(name,fn):
    fn();cases.append(name);print('PASS',name)
def deny(fn):
    try:fn()
    except (Rejected,TypeError):return
    raise AssertionError('expected rejection')
def setup(count=2):
    book=EditionBook(schemas);p=f.source(count);book.register_source(p);e=book.build(f.delivery(p));return book,p,e
def receipt(e):
    r=ReceiptBook(schemas);c=f.context(e);k=r.register(e,c);return r,c,k
def expect(value,want):
    assert value==want,(value,want)
def mutation_source(edit):
    b=EditionBook(schemas);p=f.source();edit(p)
    def run():b.register_source(p);b.build(f.delivery(p))
    deny(run)

check('W01 eight original pinned schemas including DSM catalog',lambda:expect(len(schemas.validators),8))
for count in (1,2):
    def run(count=count):
        b,p,e=setup(count);expect(len(parse(e.xml).findall('{'+DPI+'}DPIBody')),1)
        expect(len(parse(e.xml).findall('.//{'+DPI+'}ReportableSeller')),count)
        expect(e.xml,b.build(f.delivery(p)).xml)
        assert b'ConsQ1 currCode="EUR">10<' in e.xml and b'TaxQ4 currCode="EUR">0<' in e.xml
        assert b'Etage 2' in e.xml and b'01234' in e.xml and b'BuildingIdentifier' not in e.xml
    check(f'W02 W04 W05 complete {count}-seller batch deterministic roundtrip',run)

for name,edit in [
 ('extra_field',lambda p:p['positions'][0]['subject'].update(Nationality='DE')),
 ('missing_first_name',lambda p:p['positions'][0]['subject'].pop('first_name')),
 ('empty_name',lambda p:p['positions'][0]['subject'].update(first_name='')),
 ('long_address',lambda p:p['positions'][0]['subject']['address'].update(street_line1='a'*201)),
 ('GVS',lambda p:p['positions'][0]['subject'].update(gvs_used=True)),
 ('entity',lambda p:p['positions'][0]['subject'].update(subject_type='entity')),
 ('unknown_tax',lambda p:p['positions'][0]['events'][0].update(tax_cents=None)),
 ('float_cents',lambda p:p['positions'][0]['events'][0].update(gross_cents=600.0)),
 ('unsupported_currency',lambda p:p['positions'][0]['events'][0].update(currency='USD')),
 ('missing_person',lambda p:p['known_person_refs'].append(f.uid(299))),
 ('missing_account',lambda p:p['known_seller_ids'].append(f.uid(199))),
 ('missing_event',lambda p:p['known_event_ids'].append(f.uid(1999))),
 ('duplicate_person',lambda p:p['positions'][1]['subject'].update(person_ref=p['positions'][0]['subject']['person_ref'])),
 ('kind_unknown',lambda p:p['positions'][0]['subject']['tins'][0].update(kind='UNKNOWN')),
 ('missing_allocation_evidence',lambda p:p['positions'][0]['subject']['tins'][0].update(allocation_evidence='')),
 ('no_tin_without_basis',lambda p:p['positions'][0]['subject'].update(tins=[])),
 ('placeholder_date',lambda p:p['positions'][0]['subject'].update(birth_date='1900-01-01')),
 ('unknown_vat',lambda p:p['positions'][0]['subject'].update(vat_evidence='')),
 ('source_not_synthetic',lambda p:p.update(origin='real')),
 ('source_PROD',lambda p:p.update(environment='PROD')),
 ('unknown_financial',lambda p:p['positions'][0]['decision'].update(financial_mode='unknown')),
 ('count_quantity',lambda p:p['positions'][0]['events'][0].update(activities=2)),
 ('wrong_quarter',lambda p:p['positions'][0]['events'][0].update(quarter=2)),
 ('annual_control',lambda p:p['positions'][0].update(annual_gross_cents='1300'))]:
    check('W03 W06 source reject '+name,lambda edit=edit:mutation_source(edit))

def cent_remainder():
    def edit(p):
        x=p['positions'][0];x['events'][0]['consideration_cents']='501';x['events'][0]['gross_cents']='601'
        x['annual_gross_cents']='1201';x['annual_consideration_cents']='1001'
    mutation_source(edit)
check('W04 M01 nonintegral quarter rejected without rounding',cent_remainder)

def cents_sum():
    b=EditionBook(schemas);p=f.source(1)
    p['positions'][0]['events'][0].update(consideration_cents='501',gross_cents='601')
    p['positions'][0]['events'][1].update(consideration_cents='499',gross_cents='599')
    b.register_source(p);e=b.build(f.delivery(p));assert b'ConsQ1 currCode="EUR">10<' in e.xml
check('W04 separate cents exactly sum to whole EUR',cents_sum)

def consolidated():
    b=EditionBook(schemas);p=f.source(1);s=f.uid(102);p['positions'][0]['subject']['seller_ids'].append(s)
    p['known_seller_ids'].append(s);p['positions'][0]['events'][1]['seller_id']=s;b.register_source(p)
    e=b.build(f.delivery(p));expect(len(parse(e.xml).findall('.//{'+DPI+'}ReportableSeller')),1)
check('W02 two accounts consolidated into one person',consolidated)

def conditional():
    b=EditionBook(schemas);p=f.source(1);s=p['positions'][0]['subject']
    s.update(residence_countries=['FR'],tins=[],no_tin_basis='not_issued_by_residence_country',no_tin_evidence='synthetic-no-issued-TIN/1',
             birth_place={'city':'Testville','subentity':None,'country_code':'FR','former_country':None},vat_id='FR-SYNTHETIC')
    pos=p['positions'][0];pos['decision'].update(financial_mode='known_accounts')
    pos['financial_accounts']=[{'identifier':'SYNTHETIC-ACCOUNT','kind':'OTHER_QUALIFIED_ACCOUNT','holder_name':'Fiktiver Inhaber',
        'holder_identifiers':['synthetic-holder-1'],'other_info':'synthetic-holder-1','applicability_evidence':'synthetic-known/1','projection_evidence':'synthetic-exact-holder/1'}]
    b.register_source(p);e=b.build(f.delivery(p));assert b'AccountHolderName' in e.xml and b'unknown="true"' in e.xml
check('W02 F17 F18 F20 F21 conditional complete path',conditional)

b,p,e=setup()
for name,replace in [('namespace',(DPI,'urn:wrong')),('stf_namespace',(STF,DPI)),('TaxesQ',('TaxQ','TaxesQ')),
                     ('DAC7_message',('>DPI<','>DAC7<')),('missing_quarter',('<dpi:TaxQ4 currCode="EUR">0</dpi:TaxQ4>','')),
                     ('missing_name',('<dpi:FirstName>Fiktiva1</dpi:FirstName>',''))]:
    bad=e.xml.decode().replace(*replace).encode()
    check('W05 XSD negative '+name,lambda bad=bad:deny(lambda:schemas.validate(bad,'DPIXML_v1.0.xsd','{'+DPI+'}DPI_OECD')))
for name,replace in [('DPI403',('DPI401','DPI403')),('test_doc',('OECD1','OECD11')),('missing_sender',('<dpi:SendingEntityIN>12345678901</dpi:SendingEntityIN>','')),
                     ('unapproved_value',('Fiktiva1','Fiktiva9')),('numeric_boolean',('>false<','>0<'))]:
    bad=e.xml.decode().replace(*replace).encode()
    def run(bad=bad):
        schemas.validate(bad,'DPIXML_v1.0.xsd','{'+DPI+'}DPI_OECD');deny(lambda:b.check_xml(e,bad))
    check('W03 W06 XSD-valid but business-invalid '+name,run)

def chain():
    b,p,e=setup();r,c,k=receipt(e);rr=r.dip(k,f.dip(c));b.accept_synthetic(e,rr)
    p2=copy.deepcopy(p);p2['revision']=f.uid(11)
    for pos in p2['positions']:
        pos['content_revision']=2;pos['predecessor_ref']=pos['position_ref'];pos['subject']['last_name']='Neue Testfassung'
    b.register_source(p2);e2=b.build(f.delivery(p2,2,'correction',e));assert b'OECD2' in e2.xml and b'ConsQ4' in e2.xml
    r2,c2,k2=receipt(e2);b.accept_synthetic(e2,r2.dip(k2,f.dip(c2)))
    p3=copy.deepcopy(p2);p3['revision']=f.uid(12)
    for pos in p3['positions']:pos['content_revision']=3
    b.register_source(p3)
    deny(lambda:b.build(f.delivery(p3,3,'correction',e)))
    deleted=b.build(f.delivery(p3,3,'deletion_reference',e2));assert b'OECD3' in deleted.xml
    expect(b._editions[e.delivery.revision].xml,e.xml)
check('W07 latest accepted correction and synthetic OECD3 preserve historical bytes',chain)

def supplement():
    b,p,e=setup();r,c,k=receipt(e);first=e.delivery.seller_docs[0].doc_ref
    partial=r.dip(k,f.dip(c,'PARTIALLY_REJECTED',f.dsm(c,errors=[(first,)])))
    expect(partial.outcome,'PARTIAL');b.accept_synthetic(e,partial)
    p2=copy.deepcopy(p);p2['revision']=f.uid(11);p2['due_position_refs']=[p2['positions'][0]['position_ref']]
    b.register_source(p2);d=f.delivery(p2,2,'supplement');e2=b.build(d)
    expect(len(e2.positions),1);assert b'OECD0' in e2.xml and b'OECD1' in e2.xml
    bad=f.delivery(p2,3,'correction',e);deny(lambda:b.build(bad))
check('W07 rejected seller resubmitted as OECD1 with accepted OECD0',supplement)

def chain_reject(kind):
    b,p,e=setup();r,c,k=receipt(e);b.accept_synthetic(e,r.dip(k,f.dip(c)))
    p2=copy.deepcopy(p);p2['revision']=f.uid(11)
    for pos in p2['positions']:pos['content_revision']=2;pos['predecessor_ref']=pos['position_ref']
    if kind=='residence':p2['positions'][0]['subject']['residence_countries']=['FR'];p2['positions'][0]['decision']['financial_mode']='none_known_verified'
    b.register_source(p2);d=f.delivery(p2,2,'correction',e)
    if kind=='mixed':d['seller_docs'][0]['doc_type']='OECD1'
    if kind=='operator_change':d['operator_doc']['doc_ref']='DE2025-new-operator'
    if kind=='wrong_kind':d['seller_docs'][0]['corr_doc_ref']=d['operator_doc']['doc_ref']
    if kind=='year':d['reporting_year']=2024
    deny(lambda:b.build(d))
for kind in ('residence','mixed','operator_change','wrong_kind','year'):
    check('W07 correction reject '+kind,lambda kind=kind:chain_reject(kind))

def revisions():
    b,p,e=setup();changed=copy.deepcopy(p);changed['positions'][0]['subject']['first_name']='Anders'
    deny(lambda:b.register_source(changed));assert b.conflicts and b._editions[e.delivery.revision].xml==e.xml
    d=f.delivery(p);d['timestamp']='2026-01-04T12:00:00Z';deny(lambda:b.build(d))
    d=f.delivery(p);d['position_refs']=d['position_refs'][:1];deny(lambda:b.build(d))
    d=f.delivery(p,2);d['message_ref']=e.delivery.message_ref;deny(lambda:b.build(d))
check('W13 source edition batch ID conflicts and old bytes stable',revisions)

for name,status,dsm_status,scope,want in [
 ('final_OK_without_DSM','OK',None,None,'ACCEPTED'),('OK_with_DSM','OK','Accepted',None,'ACCEPTED'),
 ('partial_seller','PARTIALLY_REJECTED','Accepted','seller','PARTIAL'),('operator','PARTIALLY_REJECTED','Accepted','operator','REJECTED'),
 ('file_error','ERROR','Rejected','file','REJECTED'),('whole_error','ERROR',None,None,'REJECTED'),
 ('contradictory_OK','OK','Rejected','seller','UNRESOLVED'),('contradictory_ERROR','ERROR','Accepted',None,'UNRESOLVED'),
 ('unknown_doc','PARTIALLY_REJECTED','Accepted','foreign','UNRESOLVED'),('missing_refs','PARTIALLY_REJECTED','Accepted','empty','UNRESOLVED'),
 ('partial_no_DSM','PARTIALLY_REJECTED',None,None,'UNRESOLVED'),('partial_Rejected','PARTIALLY_REJECTED','Rejected','seller','UNRESOLVED')]:
    def run(status=status,ds=dsm_status,scope=scope,want=want):
        _,_,e=setup();r,c,k=receipt(e)
        refs={'seller':[(e.delivery.seller_docs[0].doc_ref,)],'operator':[(e.delivery.operator_doc.doc_ref,)],'foreign':[('foreign',)],'empty':[()]}.get(scope,())
        msg=f.dsm(c,ds,refs,['10001'] if scope=='file' else ()) if ds else None
        result=r.dip(k,f.dip(c,status,msg));expect(result.outcome,want)
        expect(len(result.accepted)+len(result.rejected)+len(result.unresolved),2)
        if want=='PARTIAL':expect(result.rejected,(e.delivery.seller_docs[0].doc_ref,))
    check('W08 '+name,run)

for field in ('response_id','transfer_ticket','customer_id','item_position','message_ref'):
    def run(field=field):
        _,_,e=setup();r,c,k=receipt(e);bad=dict(c);bad[field]='9' if field=='item_position' else 'WRONG'
        result=r.dip(k,f.dip(bad,'PARTIALLY_REJECTED',f.dsm(bad,errors=[(e.delivery.seller_docs[0].doc_ref,)])))
        expect(result.outcome,'UNRESOLVED');expect(result.accepted,())
    check('W09 distinct correlation '+field,run)

def early():
    _,_,e=setup();r,c,k=receipt(e)
    expect(r.dip(k,f.dip(c,'ERROR',consignment=False,transport_error=True)).reason,'early_error_without_consignment')
    r,c,k=receipt(e);expect(r.dip(k,f.dip(c,'PARTIALLY_REJECTED',f.dsm(c,errors=[(e.delivery.seller_docs[0].doc_ref,)],original=False))).outcome,'UNRESOLVED')
    for stage in ('start','upload','finish'):expect(r.http(k,stage,200).outcome,'UNKNOWN')
    expect(r.missing(k).outcome,'UNKNOWN')
check('W09 early errors missing OriginalMessage and HTTP are not acceptance',early)

def duplicate():
    _,_,e=setup();r,c,k=receipt(e);raw=f.dip(c);a=r.dip(k,raw);expect(r.dip(k,raw),a)
    b=r.dip(k,f.dip(c,'ERROR'));expect(b.outcome,'CONFLICT');expect(r.dip(k,raw).outcome,'CONFLICT')
    expect(len(r.evidence(('DIP','TEST','ELSTER',c['customer_id']),c['response_id'])),2)
check('W11 same bytes idempotent different bytes sticky conflict retained',duplicate)

def nn_cases():
    _,_,e=setup();r,c,k=receipt(e);raw=f.nn(c,f.dip(c));a=r.nn(k,raw);expect(a.outcome,'ACCEPTED')
    assert a.metadata_sha256 and a.data_sha256;expect(r.nn(k,raw),a)
    for typ in ('NACHRICHT','VERWALTUNGSAKT'):
        r=ReceiptBook(schemas);cc=dict(c,nn_message_type=typ);k=r.register(e,cc)
        expect(r.nn(k,f.nn(cc,f.dip(cc))).outcome,'UNRESOLVED')
    r,c,k=receipt(e);expect(r.nn(k,f.nn(c,b'<unknown/>')).outcome,'UNRESOLVED')
    r,c,k=receipt(e);expect(r.nn(k,f.nn(c,ET.tostring(f.dsm(c)))).outcome,'UNRESOLVED')
    for field,value in [('environment','PROD'),('senderApplicationCode','OTHER'),('messageId','OTHER')]:
        r,c,k=receipt(e)
        raw=f.nn(c,f.dip(c),lambda root: setattr(root.find('{'+NN+'}'+field),'text',value))
        expect(r.nn(k,raw).outcome,'UNRESOLVED')
    r,c,k=receipt(e)
    deny(lambda:r.nn(k,f.nn(c,f.dip(c),lambda root:setattr(root.find('{'+NN+'}messageType'),'text','PROTOCOL'))))
check('W10 NN metadata content and real enums kept distinct',nn_cases)

for raw in [b'<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><x>&e;</x>',
            '<?xml version="1.0" encoding="UTF-16"?><!DOCTYPE x [<!ENTITY e "x">]><x>&e;</x>'.encode('utf-16'),
            b'<x xmlns:xi="http://www.w3.org/2001/XMLSchema-instance" xi:schemaLocation="x https://example.com/a.xsd"/>',
            b'<x>'*40+b'</x>'*40,b'<x>' + b'a'*(4*1024*1024)+b'</x>']:
    check('W10 malicious XML '+sha(raw)[:10],lambda raw=raw:deny(lambda:parse(raw)))

def zip_bad(names,content=b'x'):
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for name in names:z.writestr(name,content)
    deny(lambda:unzip(out.getvalue()))
for names in [('metadaten.xml','../daten.xml'),('metadaten.xml','/daten.xml'),('metadaten.xml','daten.xml','anhang.zip'),('a','b','c','d'),('metadaten.xml','metadaten.xml')]:
    check('W10 closed ZIP '+str(names),lambda names=names:zip_bad(names))
check('W10 ZIP expansion bomb',lambda:zip_bad(('metadaten.xml','daten.xml'),b'0'*(4*1024*1024)))

def catalog_tamper():
    with tempfile.TemporaryDirectory() as td:
        shutil.copytree(Path(__file__).with_name('psttg_wire')/'schemas',Path(td)/'s')
        p=Path(td)/'s'/'isodpitypes_v1.0.xsd';p.write_bytes(p.read_bytes()+b'\n')
        deny(lambda:Schemas(Path(td)/'s'))
check('W01 schema bytes cannot drift',catalog_tamper)

def de_kinds():
    for kind,value in [('W_ID','DE123456789-00001'),('TAX_NUMBER','12/345/67890')]:
        b=EditionBook(schemas);p=f.source(1);p['positions'][0]['subject']['tins'][0].update(kind=kind,value=value)
        b.register_source(p);b.build(f.delivery(p))
check('W02 F16 W-ID and tax number are not coerced to eleven digits',de_kinds)

def refund():
    b=EditionBook(schemas);p=f.source(1);pos=p['positions'][0]
    for i,old in enumerate(list(pos['events'])):
        ev=copy.deepcopy(old);ev.update(event_id=f.uid(2000+i),event_key=f'refund-{i}',source_type='synthetic_full_refund',
            occurred_at='2025-07-01T12:00:00Z',created_at='2025-07-01T12:00:01Z',activities=-1,correction_of=old['event_id'])
        for k in ('gross_cents','platform_cents','commission_cents','tax_cents','consideration_cents'):ev[k]=str(-int(ev[k]))
        pos['events'].append(ev)
    p['known_event_ids']=[v['event_id'] for v in pos['events']];pos['annual_gross_cents']='0';pos['annual_consideration_cents']='0'
    b.register_source(p);e=b.build(f.delivery(p));assert b'ConsQ1 currCode="EUR">0<' in e.xml
    require_refund=copy.deepcopy(p);require_refund['revision']=f.uid(20);require_refund['positions'][0]['events'][-1]['quarter']=3
    deny(lambda:b.register_source(require_refund))
check('W04 F30 refund uses original period with later event time',refund)

for field in ('platform_cents','tax_cents'):
    def run(field=field):
        def edit(p):
            pos=p['positions'][0];ev=pos['events'][0];ev[field]=str(int(ev[field])+1);ev['gross_cents']='601';pos['annual_gross_cents']='1201'
        mutation_source(edit)
    check('W04 M01 rejects remainder in '+field,run)

def inventory():
    b=EditionBook(schemas);p=f.source();p['due_position_refs']=p['due_position_refs'][:1];b.register_source(p)
    deny(lambda:b.build(f.delivery(p)))
check('W02 initial cannot hide known position by shortening due list',inventory)

def correction_state():
    b,p,e=setup();r,c,k=receipt(e);rr=r.dip(k,f.dip(c));b.accept_synthetic(e,rr)
    p2=copy.deepcopy(p);p2['revision']=f.uid(11)
    for pos in p2['positions']:pos['content_revision']=2;pos['predecessor_ref']=pos['position_ref']
    b.register_source(p2);e2=b.build(f.delivery(p2,2,'correction',e));r2,c2,k2=receipt(e2);rr2=r2.dip(k2,f.dip(c2));b.accept_synthetic(e2,rr2)
    before=copy.deepcopy(b._accepted);b.accept_synthetic(e,rr);expect(b._accepted,before)
    p3=copy.deepcopy(p2);p3['revision']=f.uid(12)
    for pos in p3['positions']:pos['content_revision']=3
    b.register_source(p3);e3=b.build(f.delivery(p3,3,'deletion_reference',e2));r3,c3,k3=receipt(e3);b.accept_synthetic(e3,r3.dip(k3,f.dip(c3)))
    p4=copy.deepcopy(p3);p4['revision']=f.uid(13)
    for pos in p4['positions']:pos['content_revision']=4
    b.register_source(p4);deny(lambda:b.build(f.delivery(p4,4,'correction',e3)))
    expect(b._editions[e.delivery.revision].xml,e.xml)
check('W07 accepted receipt replay cannot rewind chain and deleted ref cannot correct',correction_state)

def correlation_collision():
    _,_,e=setup();r,c,k=receipt(e);bad=dict(c,attempt_ref=f.uid(5001));deny(lambda:r.register(e,bad))
check('W09 transfer response and NN identities cannot bind another attempt',correlation_collision)

def dangerous_receipts():
    _,_,e=setup();r,c,k=receipt(e);raw=f.dip(c,'PARTIALLY_REJECTED',f.dsm(c,errors=[(e.delivery.seller_docs[0].doc_ref,)]))
    for old,new in [('DocRefIDInError','DocRefIdInError'),('OriginalMessageRefID','OriginalMessageRefId'),(DSM,'urn:wrong:dsm')]:
        mutated=raw.decode().replace(old,new).encode()
        if old==DSM:expect(r.dip(k,mutated).outcome,'UNRESOLVED')
        else:deny(lambda:r.dip(k,mutated))
    for old,new in [('processStatus','ProcessStatus'),('PARTIALLY_REJECTED','SUCCESS')]:
        deny(lambda:r.dip(k,raw.decode().replace(old,new).encode()))
check('W05 W09 no silent receipt tag namespace enum aliases',dangerous_receipts)

def zip_symlink():
    o=io.BytesIO()
    with zipfile.ZipFile(o,'w') as z:
        a=zipfile.ZipInfo('metadaten.xml');a.create_system=3;a.external_attr=0o120777<<16;z.writestr(a,b'daten.xml');z.writestr('daten.xml',b'<x/>')
    deny(lambda:unzip(o.getvalue()))
check('W10 ZIP symlink rejected without extraction',zip_symlink)
check('W10 XML processing instruction outside root rejected',lambda:deny(lambda:parse(b'<?outside x?><root/>')))

def schema_remote_import():
    with tempfile.TemporaryDirectory() as td:
        root=Path(td)/'s';shutil.copytree(Path(__file__).with_name('psttg_wire')/'schemas',root)
        name='erweiterung_amtlichen_datensatz.xml';p=root/name;p.write_bytes(p.read_bytes().replace(b'isodpitypes_v1.0.xsd',b'https://example.com/isodpitypes_v1.0.xsd'))
        manifest=json.loads((root/'catalog.json').read_bytes())
        for entry in manifest['files']:
            if entry['file']==name:entry['sha256']=sha(p.read_bytes())
        (root/'catalog.json').write_text(json.dumps(manifest));deny(lambda:Schemas(root))
check('W01 remote import rejected even with changed manifest',schema_remote_import)


# Controlled artifact for the native V114 counterparty test. No product ingestion.
_,_,edition=setup();r,c,k=receipt(edition);raw=f.dip(c);result=r.dip(k,raw)
out=Path('test-results');out.mkdir(exist_ok=True)
(out/'psttg-wire-controlled.json').write_text(json.dumps({'origin':'synthetic_test','binding':edition.binding,'xml_sha256':sha(edition.xml),
    'source_hex':edition.source_bytes.hex(),'xml_hex':edition.xml.hex(),'receipt_sha256':sha(raw),'receipt_hex':raw.hex(),'outcome':result.outcome,'accepted':result.accepted},indent=2)+'\n')
(out/'psttg-wire-offline.json').write_text(json.dumps({'passed':True,'runtime':sys.version,'lxml':ET.LXML_VERSION,'cases':cases,
    'schema_binding':schemas.binding,'native_commit_proof':False,'W12':'OPEN','M01':'OPEN; nonintegral rejected','M02_M05':'OPEN'},indent=2)+'\n')
print('PASS offline cases',len(cases))
