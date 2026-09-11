"""Read-only, cached transport for the native diagnostic. No credentials or uploads."""
import hashlib, json, sys, urllib.request, urllib.error
from pathlib import Path
from urllib.parse import urlparse

url, directory = sys.argv[1:3]
if urlparse(url).scheme != 'https' or urlparse(url).hostname not in {
    'api.tcgdex.net', 'assets.tcgdex.net', 'optcgapi.com',
}:
    raise SystemExit('URL outside the public catalog allowlist')
root = Path(directory)
root.mkdir(parents=True, exist_ok=True)
key = hashlib.sha256(url.encode()).hexdigest()
meta, body = root / (key + '.json'), root / (key + '.body')
if not meta.exists():
    try:
        with urllib.request.urlopen(url, timeout=12) as response:
            payload = response.read()
            record = {'url': url, 'status': response.status, 'contentType': response.headers.get('Content-Type')}
    except urllib.error.HTTPError as error:
        payload = error.read()
        record = {'url': url, 'status': error.code, 'error': str(error)}
    except Exception as error:
        payload = b''
        record = {'url': url, 'status': 0, 'error': str(error)}
    body.write_bytes(payload)
    record.update(bodyFile=str(body.resolve()), sha256=hashlib.sha256(payload).hexdigest())
    meta.write_text(json.dumps(record))
print(meta.read_text())
