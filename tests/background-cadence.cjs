const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
let now=10000;
const ctx=vm.createContext({Date:{now:()=>now},document:{hidden:false},window:{PNTT:{Game:{time:10}}},
  questCadenceAt:0,questGameTime:null,questWatchdog:{progressAt:1000,snapshotAt:2000},
  dialogDecision:{observedAt:3000},pendingChoice:{time:4000}});
vm.runInContext(source.slice(source.indexOf('  function accountQuestCadence('),source.indexOf('  function questTick(')),ctx);
ctx.accountQuestCadence();now+=1000;ctx.window.PNTT.Game.time++;ctx.accountQuestCadence();
assert.equal(ctx.questWatchdog.progressAt,1000,'Normal game execution retains stall detection');
now+=60000;ctx.accountQuestCadence();
assert.equal(ctx.questWatchdog.progressAt,61000,'Do not count suspended minute as quest failure');
assert.equal(ctx.pendingChoice.time,63000,'Do not time out pending dialog during suspension');
ctx.document.hidden=true;now+=1000;ctx.accountQuestCadence();
assert.equal(ctx.questWatchdog.progressAt,62000,'Frozen game clock does not count as a quest stall');
ctx.window.PNTT.Game.time++;now+=1000;ctx.accountQuestCadence();
assert.equal(ctx.questWatchdog.progressAt,62000,'Background game that runs still detects genuine stalls');
ctx.document.hidden=false;
const slowStart=ctx.questWatchdog.progressAt,slowWall=now;
for(let i=0;i<100;i++){now+=1000;ctx.window.PNTT.Game.time+=0.01;ctx.accountQuestCadence();}
assert.ok(Math.abs((ctx.questWatchdog.progressAt-slowStart)-99000)<0.001,
  'Slowly advancing game clock must not count 100 wall seconds as 100 gameplay seconds, even if visibility is unreliable');
assert.ok(Math.abs((now-slowWall)-(ctx.questWatchdog.progressAt-slowStart)-1000)<0.001);
ctx.window.PNTT.Game.time=0;now+=1000;const resetAt=ctx.questWatchdog.progressAt;ctx.accountQuestCadence();
assert.equal(ctx.questWatchdog.progressAt,resetAt,'Clock reset retains bounded stall detection');
console.log('Background suspension compensation and active watchdog timing passed');
