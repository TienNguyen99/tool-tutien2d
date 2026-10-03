const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const ctx=vm.createContext({window:{},config:{utilityWhileGrowing:true,dailyDuocCongTournament:false},
  cropWaitStage:null,safe:(fn,d)=>{try{return fn()??d}catch{return d}},inferEnemyTypes:()=>['duoc_linh_thu']});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/utility-policy.js'),'utf8'),ctx);
const choose=ctx.window.__tienloUtility.choosePlantAction;
const base={ready:false,dry:false,remaining:300,hp:100,threats:0,needLinhThuy:true,dailyAvailable:true};
assert.equal(choose(base).selected.id,'hunt');
assert.equal(choose({...base,threats:3}).selected.id,'daily_task','Risk lowers combat utility');
assert.equal(choose({...base,ready:true}).selected.id,'harvest');
assert.equal(choose({...base,dry:true}).selected.id,'water');
assert.equal(choose({...base,remaining:20}).selected.id,'wait','Do not start side work right before ripening');
assert.equal(choose({...base,activeTask:'collect',taskComplete:true,ready:true}).selected.id,'active_task');
assert.equal(choose({...base,activeTask:'tournament',hp:20}).selected.id,'wait');
assert.equal(choose({...base,hp:40}).selected.id,'daily_task','Do not hunt with low health');
const hook=fs.readFileSync(path.join(__dirname,'../extension/hook.js'),'utf8');
vm.runInContext(hook.slice(hook.indexOf('  function dailyDuocCongPlan('),hook.indexOf('  function analyzeQuest(')),ctx);
let ripe=false,wet=true;
const P={Farm:{state:{plot_1:{wet:true}},ready:()=>ripe,remain:()=>300},
  SceneWorld:{player:{x:0,y:0,hp:100,hpMax:100},enemies:[]},Inventory:{count:()=>5}};
const Q={stage:18,buocCuaQuan:()=>({id:'cham_soc'}),seedTaskInfo:()=>null,
  canOpenSeedMenu:()=>true,seedTaskList:()=>[{def:{id:'duoc_moc',kind:'collect'},runsLeft:3}]};
assert.equal(ctx.cropUtilityPlan(P,Q).dailyTask.id,'duoc_moc');
ripe=true;assert.equal(ctx.cropUtilityPlan(P,Q).utility.selected.id,'harvest');
assert.equal(ctx.cropUtilityPlan(P,Q).ids[0],'plot_1','Return to actual ripe plot');
P.Farm.state={};assert.equal(ctx.cropUtilityPlan(P,Q),null,'Resume normal quest after crops harvested');
ctx.config.utilityWhileGrowing=false;P.Farm.state={plot_1:{wet}};
assert.equal(ctx.cropUtilityPlan(P,Q),null,'Setting restores original quest behavior');
console.log('Growing utility scores, risk, ripening preemption, plot routing and toggle passed');
