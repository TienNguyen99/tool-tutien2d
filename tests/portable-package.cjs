const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=process.argv[2];
if(!root){console.log('Portable package smoke test: pass extracted package directory to run');process.exit(0);}
assert.ok(fs.existsSync(path.join(root,'runtime/NODE-LICENSE.txt')));
assert.ok(!fs.existsSync(path.join(root,'data/private')),'No accounts or browser profiles shipped');
assert.ok(!fs.existsSync(path.join(root,'data/logs')),'No personal logs shipped');
const child=spawn(path.join(root,'runtime/node.exe'),['tools/dev-server.cjs','18965'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
let errors='';child.stderr.on('data',chunk=>errors+=chunk);
(async()=>{
  try{
    let info;
    for(let n=0;n<40;n++){try{info=await fetch('http://127.0.0.1:18965/api/package-info').then(r=>r.json());break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
    assert.equal(info?.app,'tienlo-companion',errors);
    for(const file of ['setup.html','index.html','assets/js/daily-view.js','extension/background-run.js']){
      const response=await fetch('http://127.0.0.1:18965/'+file);assert.equal(response.status,200,file);
    }
    const catalog=await fetch('http://127.0.0.1:18965/api/quest-line').then(r=>r.json());
    assert.ok(JSON.stringify(catalog).includes('Hang Động'),'Quest catalog is present');
    const memory=await fetch('http://127.0.0.1:18965/api/choice-memory').then(r=>r.json());
    assert.ok(memory.some(row=>row.map),'Public pathfinding maps are present');
    console.log('Bundled runtime starts; setup/dashboard/extension/quest catalog/maps passed');
  }finally{child.kill();}
})().catch(error=>{console.error(error);process.exitCode=1;});
