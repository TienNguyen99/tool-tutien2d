const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');const window={};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../extension/daily-activities.js'),'utf8'),{window,document:{querySelector:()=>({getAttribute:()=> 'Hôm nay từ quái: 2/3000'})}});
const P={Quest:{today:()=> '2026-10-03',seedTaskInfo:()=>({id:'fish'}),seedQuestComplete:()=>true,
  seedTaskList:()=>[{def:{id:'fish',name:'Câu cá',kind:'fishing'},runsLeft:1,runsToday:2,dailyLimit:3},
    {def:{id:'arena',name:'Đại Hội',kind:'tournament'},runsLeft:1,runsToday:0,dailyLimit:1}]},Progress:{duocCong:12}};
const result=window.__tienloDailyActivities(P);assert.equal(result.tasks[0].complete,true);assert.equal(result.tasks[0].remaining,1);
assert.equal(result.tasks[1].limit,1);assert.equal(result.date,'2026-10-03');assert.equal(result.duocCong,12);
assert.equal(result.monsterStones.earned,2);assert.equal(result.monsterStones.limit,3000);
assert.equal(window.__tienloDailyActivities({}).tasks,null,'Missing runtime is unknown, not completed');
console.log('Daily real quotas, active turn-in, tournament and unknown-data regressions passed');
