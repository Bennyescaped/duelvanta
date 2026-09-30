"""Explicit local preflight or future native acceptance. Never starts a PG server."""
import json
from pathlib import Path
import sys
import unittest
import re
from psttg_wire import test_w11
test_w11.NATIVE='--native' in sys.argv
if len(sys.argv)>1 and sys.argv[1:] not in (['--native'],['--local']):
    raise SystemExit('Only --local or --native')
class RecordedResult(unittest.TextTestResult):
    def __init__(self,*a,**kw):super().__init__(*a,**kw);self.outcomes={}
    def addSuccess(self,test):super().addSuccess(test);self.outcomes[test.id()]='PASS'
    def addSkip(self,test,reason):super().addSkip(test,reason);self.outcomes[test.id()]='SKIP: '+reason
    def addError(self,test,err):super().addError(test,err);self.outcomes[test.id()]='ERROR'
    def addFailure(self,test,err):super().addFailure(test,err);self.outcomes[test.id()]='FAIL'
suite=unittest.defaultTestLoader.loadTestsFromModule(test_w11)
result=unittest.TextTestRunner(verbosity=2,resultclass=RecordedResult).run(suite)
out=Path(__file__).resolve().parents[1]/'test-results';out.mkdir(exist_ok=True)
native=test_w11.NATIVE
report=dict(contract='V123-W11-verified-envelope-commit/1',mode='native' if native else 'local-preflight',
    tests=result.testsRun,failures=len(result.failures),errors=len(result.errors),skipped=len(result.skipped),
    local_success=result.wasSuccessful(),native_acceptance='PASS' if native and result.wasSuccessful() and not result.skipped else 'NATIVE_NOT_RUN' if not native else 'FAIL',
    external_ack_performed=False,real_receipt_adapter=False,
    outcomes=result.outcomes,
    cases=[dict(case='N%02d'%n,native='NATIVE_NOT_RUN' if not native else next((v for k,v in result.outcomes.items() if re.search(r'\.test_N%02d_'%n,k)),'NOT_EXECUTED')) for n in range(1,23)])
(out/('psttg-w11-native.json' if native else 'psttg-w11-local.json')).write_text(json.dumps(report,indent=2)+'\n')
raise SystemExit(0 if result.wasSuccessful() else 1)
