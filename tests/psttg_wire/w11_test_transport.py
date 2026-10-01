"""Isolated test transport to the existing Node pg runtime, never an app driver."""
from concurrent.futures import Future
from pathlib import Path
import json
import subprocess
import threading

class TestDatabase:
    def __init__(self, native=False):
        root=Path(__file__).resolve().parents[2]
        self.process=subprocess.Popen(['node',str(root/'tests/helpers/w11-db-harness.mjs'),
            '--native' if native else '--pglite'],cwd=root,stdin=subprocess.PIPE,stdout=subprocess.PIPE,
            stderr=None,text=True,bufsize=1)
        first=self.process.stdout.readline()
        if not first: raise RuntimeError('isolated database harness failed to initialize')
        self.ready=json.loads(first);self._lock=threading.Lock();self._pending={};self._id=0
        self._reader=threading.Thread(target=self._read,daemon=True);self._reader.start()
    def _read(self):
        try:
            for line in self.process.stdout:
                msg=json.loads(line);f=self._pending.pop(msg['id'])
                if msg.get('error'): f.set_exception(RuntimeError(msg['error']['message']))
                else:f.set_result(msg.get('result'))
        finally:
            for f in list(self._pending.values()):
                if not f.done():f.set_exception(RuntimeError('isolated transport closed'))
    def request(self, op, **kw):
        with self._lock:
            self._id+=1;n=self._id;f=Future();self._pending[n]=f
            self.process.stdin.write(json.dumps(dict(id=n,op=op,**kw))+'\n');self.process.stdin.flush()
        return f.result(timeout=90)
    def connect(self):
        return Connection(self,self.request('open'))
    def close(self):
        try:self.request('close')
        finally:
            self.process.stdin.close();self.process.wait(timeout=20)

class Connection:
    def __init__(self,owner,identity):self.owner=owner;self.identity=identity;self._closed=False
    def query(self,sql,params=None):
        if self._closed:raise RuntimeError('w11_connection_closed')
        return self.owner.request('query',connection=self.identity,sql=sql,params=params or [])
    def close(self):
        if self._closed:return True
        result=self.owner.request('release',connection=self.identity)
        self._closed=True
        return result
