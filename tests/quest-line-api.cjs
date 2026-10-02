const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tienlo-quest-test-'));
const failureFile=path.join(dir,'quest-failures.jsonl');
fs.writeFileSync(failureFile,JSON.stringify({at:new Date().toISOString(),quest:{stage:8},reason:'quest_stuck',outcome:'fail',character:'test',analysis:'too far'})+'\n');
let handler;const server=http.createServer((req,res)=>handler(req,res));
server.listen(0,'127.0.0.1',async()=>{
  const port=server.address().port,url=`http://127.0.0.1:${port}`;
  handler=require('../tools/quest-line.cjs').handler({root:path.join(__dirname,'..'),logDir:dir,failureFile,port});
  try{
    const response=await fetch(url+'/api/quest-line?character=test'),data=await response.json();
    assert.equal(response.status,200);assert.ok(data.quests.length>=30);assert.equal(data.quests.find(q=>q.stage===8).failCount,1);
    const body=JSON.stringify({stage:8,status:'fixed',note:'Approach range fix'});
    assert.equal((await fetch(url,{method:'POST',body,headers:{Origin:'https://evil.example'}})).status,403);
    assert.equal((await fetch(url,{method:'POST',body,headers:{Origin:url}})).status,200);
    const saved=await (await fetch(url)).json();assert.equal(saved.fixes[8].status,'fixed');
    assert.equal((await fetch(url,{method:'POST',headers:{Origin:url},body:JSON.stringify({stage:8,status:'completed'})})).status,400);
    console.log('Quest-line API, persistent fixes and origin validation passed');
  }catch(error){console.error(error);process.exitCode=1;}finally{server.close();}
});
