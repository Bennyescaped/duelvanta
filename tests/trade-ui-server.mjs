// Local-only, deterministic UI verification. No credentials, real users, or remote writes.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root = resolve(new URL('..',import.meta.url).pathname);
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
  try {
    const url = new URL(req.url,'http://localhost');
    if(url.pathname==='/'){
      res.setHeader('Content-Type','text/html');
      res.end('<!doctype html><title>TRADE local verification</title><h1>Local UI tests — no real purchases</h1><iframe title="Mobile TRADE" src="/trade.html?selftest=1" style="width:393px;height:850px;border:1px solid #aaa"></iframe>');return;
    }
    const path=resolve(root,'.'+url.pathname);
    if(!path.startsWith(root+'/')){res.writeHead(403);res.end();return}
    let content=await readFile(path);
    if(url.pathname==='/trade.html'){
      content=content.toString().replace(/<script src="https:[^"]*supabase[^"]*"><\/script>/,'<script src="/tests/trade-ui-mock.js"></script>')
        .replace(/<script src="(?:i18n|site-nav)\.js"><\/script>/g,'')
        .replace('</body>','<script src="/tests/trade-ui-selftest.js"></script></body>');
    }
    res.setHeader('Content-Type',types[extname(path)]||'text/plain');
    res.setHeader('Content-Security-Policy',"default-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data: blob:");
    res.end(content);
  }catch{res.writeHead(404);res.end('Not found')}
}).listen(4173,'0.0.0.0',()=>console.log('Local UI-only tests: http://localhost:4173/'));
