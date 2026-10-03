const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'../dist/leon-project');
if(!fs.existsSync(root)){console.log('Build cloud first to test cloud extension');process.exit(0);}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8'));
assert.deepEqual(manifest.host_permissions,['https://leon-project.pages.dev/*']);
assert.ok(!fs.existsSync(path.join(root,'data')),'Build contains no local personal data directory');
assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/cloud-session.js/);
assert.ok(!fs.readFileSync(path.join(root,'extension/hook.js'),'utf8').includes('http://127.0.0.1:8765'));
let listener,fetchCount=0,requestBody,requestHeaders;
vm.runInNewContext(fs.readFileSync(path.join(root,'extension/background.js'),'utf8'),{importScripts(){},AbortSignal,
  chrome:{action:{onClicked:{addListener(){}}},runtime:{onMessage:{addListener(fn){listener=fn;}}}},
  fetch:async(url,options)=>{fetchCount++;requestBody=JSON.parse(options.body);requestHeaders=options.headers;return {ok:true,json:async()=>({source:'memory'})};}});
const call=payload=>new Promise(resolve=>listener({type:'TIENLO_LOCAL_REQUEST',operation:'planVision',payload},
  {tab:{url:'https://tutien2d.online/?choi'}},resolve));
(async()=>{
  assert.equal((await call({dialog:'NPC'})).ok,false);assert.equal(fetchCount,0,'No request without paired user session');
  assert.equal((await call({_sessionToken:'a'.repeat(64),dialog:'NPC',image:'private',region:{x:0}})).ok,true);
  assert.equal(requestHeaders.Authorization,'Bearer '+'a'.repeat(64));assert.equal(requestBody._sessionToken,undefined);
  assert.equal(requestBody.image,undefined);assert.equal(requestBody.region,undefined);
  console.log('Cloud origin, auth bridge, no unpaired requests and text-only payload regressions passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
