// DOM-model integration tests, NOT a real-browser or live-payment test.
// Usage: node tests/trade-dom-test.mjs /absolute/path/to/node_modules/linkedom/esm/index.js
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const {parseHTML}=await import(pathToFileURL(process.argv[2]).href);
const html=await readFile(new URL('../trade.html',import.meta.url),'utf8');
const {window}=parseHTML(html),{document}=window;
// LinkeDOM deliberately omits native dialog/select behavior and capture phases.
// Model only these required DOM behaviors; actual browser verification is separate.
Object.defineProperties(window.HTMLElement.prototype,{
  open:{get(){return this.hasAttribute('open')}},
  showModal:{value(){this.setAttribute('open','')}},
  close:{value(){this.removeAttribute('open')}},
  scrollIntoView:{value(){}},
  reportValidity:{value(){return true}}
});
Object.defineProperty(window.HTMLSelectElement.prototype,'value',{
  get(){return this.querySelector('option[selected]')?.value??this.options[0]?.value??''},
  set(value){for(const option of this.options)option.toggleAttribute('selected',option.value===String(value))}
});
const captures=new WeakMap(),proto=window.EventTarget.prototype;
const add=proto.addEventListener,dispatch=proto.dispatchEvent;
proto.addEventListener=function(type,fn,options){
  if(options===true||options?.capture){let list=captures.get(this);if(!list)captures.set(this,list=[]);list.push({type,fn});return}
  return add.call(this,type,fn,options);
};
proto.dispatchEvent=function(event){
  const path=[];for(let n=this;n;n=n.parentNode)path.unshift(n);
  event.target=this;
  for(const node of path){for(const listener of captures.get(node)||[]){if(listener.type===event.type){event.currentTarget=node;listener.fn.call(node,event)}if(event._stopImmediatePropagationFlag)break}if(event.cancelBubble)break}
  delete event.currentTarget;delete event.target;
  return event.cancelBubble?!event.defaultPrevented:dispatch.call(this,event);
};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)}};
const timers=new Set();
const sandbox={document,console,URL,URLSearchParams,Intl,Date,JSON,Math,Number,String,Array,Object,Promise,Map,Set,Blob,crypto:webcrypto,
  MutationObserver:window.MutationObserver,Event:window.Event,HTMLElement:window.HTMLElement,
  location:{search:'?selftest=1',replace:()=>{throw Error('Unexpected navigation')}},localStorage:storage(),sessionStorage:storage(),
  setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);timers.add(t);return t},clearTimeout,
  setInterval:(fn,ms)=>{const t=setInterval(fn,ms);timers.add(t);return t},clearInterval,
  requestAnimationFrame:fn=>setTimeout(fn,0),cancelAnimationFrame:clearTimeout,
  addEventListener:()=>{},confirm:()=>true,alert:message=>{throw Error(String(message))},prompt:()=>null,
  CSS:{escape:s=>s},getComputedStyle:node=>({display:node.id==='daily'&&document.getElementById('app')?.dataset.tradeView!=='market'?'none':''}),fetch:()=>{throw Error('Remote requests forbidden in local tests')}
};
sandbox.window=sandbox;sandbox.globalThis=sandbox;
const context=vm.createContext(sandbox);
try{
  await run('tests/trade-ui-mock.js');
  for(const node of document.querySelectorAll('script[src]')){
    const path=node.getAttribute('src').split('?')[0];
    if(path.startsWith('https:')||['i18n.js','site-nav.js'].includes(path))continue;
    await run(path);
  }
  await run('tests/trade-ui-selftest.js');
  for(let n=0;n<140;n++){
    const result=document.getElementById('uiTestResults')?.textContent||'';
    if(result.includes('ALL UI TESTS PASSED')||result.includes('\nFAIL')){console.log(result);if(result.includes('\nFAIL'))process.exitCode=1;break}
    if(n===139)throw Error('DOM test timeout');
    await new Promise(resolve=>setTimeout(resolve,50));
  }
}finally{for(const timer of timers){clearInterval(timer);clearTimeout(timer)}}
async function run(path){vm.runInContext(await readFile(new URL('../'+path,import.meta.url),'utf8'),context,{filename:path})}
