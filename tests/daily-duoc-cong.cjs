const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
const ctx=vm.createContext({config:{dailyDuocCongTournament:false},safe:(fn,d)=>{try{return fn()??d}catch{return d}}});
vm.runInContext(source.slice(source.indexOf('  function dailyDuocCongPlan('),source.indexOf('  function analyzeQuest(')),ctx);
let task=null,done=false;
const Q={seedTaskInfo:()=>task,seedQuestComplete:()=>done,canOpenSeedMenu:()=>true,
  seedTaskList:()=>[{def:{id:'linh_chi',kind:'collect',shortName:'Linh Chi'},runsLeft:0},
    {def:{id:'cau_ca',kind:'fishing',shortName:'Câu Cá'},runsLeft:2},
    {def:{id:'dai_hoi',kind:'tournament'},runsLeft:1}]};
let plan=ctx.dailyDuocCongPlan(Q);assert.equal(plan.dailyTask.id,'cau_ca');assert.ok(plan.targetLabel.includes('2'));
task={id:'cau_ca',kind:'fishing'};assert.equal(ctx.dailyDuocCongPlan(Q).mapId,'duoc_vien');
done=true;assert.equal(ctx.dailyDuocCongPlan(Q).autoChoice,'Giao Ba Cá');
task=null;Q.seedTaskList=()=>[{def:{id:'dai_hoi',kind:'tournament'},runsLeft:1}];
assert.equal(ctx.dailyDuocCongPlan(Q).action,'daily_done','Daily mode stops after ordinary quotas');
ctx.config.dailyDuocCongTournament=true;assert.equal(ctx.dailyDuocCongPlan(Q).dailyTask.id,'dai_hoi');
task={kind:'tournament'};assert.equal(ctx.dailyDuocCongPlan(Q).action,'manual','Tournament requires a real win');
console.log('Daily remaining quotas, active task, turn-in and optional tournament passed');
