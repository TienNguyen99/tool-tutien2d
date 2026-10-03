const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/background.js'),'utf8');
async function run(capture){
  let listener,body;
  const context={importScripts(){},captureDialog:capture,AbortSignal,
    chrome:{action:{onClicked:{addListener(){}}},runtime:{onMessage:{addListener(fn){listener=fn;}}}},
    fetch:async(url,options)=>{body=JSON.parse(options.body);return {ok:true,json:async()=>({decision:{action:'select_dialog_option',optionIndex:0,label:'Nhận Việc Này',confidence:.9}})};}};
  vm.runInNewContext(source,context);
  const response=await new Promise(resolve=>listener({type:'TIENLO_LOCAL_REQUEST',operation:'planVision',
    payload:{quest:'Nhận việc',dialog:'Đại Phu',options:['Nhận Việc Này'],region:{x:0,y:0,width:100,height:100}}},
    {tab:{url:'https://tutien2d.online/?choi'}},resolve));
  return {response,body};
}
(async()=>{
  const fallback=await run(async()=>{throw Error("Either the '<all_urls>' or 'activeTab' permission is required.");});
  assert.equal(fallback.response.ok,true);
  assert.equal(fallback.body.dialog,'Đại Phu');
  assert.deepEqual(fallback.body.options,['Nhận Việc Này']);
  assert.equal(fallback.body.image,undefined);
  assert.equal(fallback.body.region,undefined);
  assert.match(fallback.response.data.visionFallback,/activeTab/);
  assert.equal(fallback.response.data.decision.optionIndex,0);
  const vision=await run(async()=>'data:image/png;base64,test');
  assert.equal(vision.body.image,'data:image/png;base64,test');
  assert.equal(vision.response.data.visionFallback,undefined);
  console.log('Vision permission fallback regressions passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
