const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
let now=21000,stops=0;const logs=[];
const context=vm.createContext({window:{PNTT:{SceneWorld:{player:{cfg:{name:'test'}}}}},Date:{now:()=>now},
  questWatchdog:{key:'quest12',signature:'same',progressAt:1,snapshotAt:0,recoveries:0},
  planKey:()=> 'quest12',questProgressSignature:()=> 'same',resetQuestWatchdog:()=>{},stats:{stuckCount:0},
  diagnoseQuestStall:()=>({ui:{dialog:''},stalledSeconds:20,analysis:'no progress'}),post:row=>logs.push(row),
  report:()=>{},visibleElement:()=>null,settleChoiceMemory:()=>{},stop:()=>stops++,
  lastQuestTarget:'',lastQuestRouteAt:0,exploreState:{}});
vm.runInContext(source.slice(source.indexOf('  function questWatchdogTick('),source.indexOf('  function maybeSwitchQuietZone(')),context);
for(let i=0;i<4;i++){context.questWatchdogTick({});now+=15001;}
assert.equal(logs.length,4);assert.equal(logs[0].payload.character,'test');assert.equal(logs[0].payload.reason,'quest_stuck');
assert.equal(stops,1,'Repeated recovery must stop rather than loop indefinitely');
console.log('Watchdog server logging and four-recovery limit passed');
