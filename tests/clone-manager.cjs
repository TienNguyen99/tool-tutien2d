const assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const handle=require('../tools/clone-manager.cjs');
function request(url,body,origin='http://127.0.0.1:8765',method='POST'){
  const req=new EventEmitter();Object.assign(req,{method,headers:{origin},socket:{localPort:8765}});
  let code,result;const res={writeHead(c){code=c;return this;},end(text){result=JSON.parse(text);}};
  handle(req,res,url);if(method==='POST'){req.emit('data',JSON.stringify(body));req.emit('end');}return {code,result};
}
for(let i=1;i<=5;i++)assert.equal(request('/api/clones/heartbeat',{id:`clone${i}`,data:{name:`user${i}`}},'https://tutien2d.online').code,200);
assert.equal(request('/api/clones/heartbeat',{id:'sixth',data:{}},'https://tutien2d.online').code,409);
assert.equal(request('/api/clones/command',{id:'clone2',command:'farm'}).result.queued,1);
assert.equal(request('/api/clones/heartbeat',{id:'clone1',data:{}} ,'https://tutien2d.online').result.command,null);
assert.equal(request('/api/clones/heartbeat',{id:'clone2',data:{}} ,'https://tutien2d.online').result.command,'farm');
assert.equal(request('/api/clones/command',{id:'all',command:'stop'}).result.queued,5);
assert.equal(request('/api/clones/command',{id:'all',command:'farm'},'https://tutien2d.online').code,403);
const realNow=Date.now;
try{
  const baseline=realNow();
  Date.now=()=>baseline+9000;
  assert.equal(request('/api/clones',null,undefined,'GET').result.filter(row=>row.online).length,5,
    'Background-tab delay must not repeatedly mark clones offline');
  Date.now=()=>baseline+121000;
  assert.equal(request('/api/clones/heartbeat',{id:'replacement',data:{}},'https://tutien2d.online').code,200,
    'Expired clone slots must be reclaimed automatically');
}finally{Date.now=realNow;}
console.log('Five-session isolation and command regressions passed');
