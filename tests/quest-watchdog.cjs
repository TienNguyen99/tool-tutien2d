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

const signatureContext=vm.createContext({window:{PNTT:{Quest:{stage:18},Progress:{exp:613,realmId:'luyen_khi_5'},SceneWorld:{player:{exp:673,state:'sit',meditateBonusExp:true}}}},readHud:()=>({objectives:['Tích đủ Đạo Hạnh 613/810']}),fold:s=>String(s).toLowerCase()});
vm.runInContext(source.slice(source.indexOf('  function questProgressSignature('),source.indexOf('  function resetQuestWatchdog(')),signatureContext);
const xpPlan={questMeditation:true};const firstSignature=signatureContext.questProgressSignature(xpPlan);
signatureContext.window.PNTT.SceneWorld.player.exp=733;
assert.notEqual(signatureContext.questProgressSignature(xpPlan),firstSignature,'Native player XP progress resets watchdog even with unchanged HUD/progress XP');
const secondSignature=signatureContext.questProgressSignature(xpPlan);
assert.equal(signatureContext.questProgressSignature(xpPlan),secondSignature,'Real lack of progress still produces stable signature');

now=1000;logs.length=0;context.questWatchdog={key:'quest12',signature:'same',progressAt:now,snapshotAt:0,recoveries:0};
context.window.PNTT.SceneWorld={player:{x:0,y:16},map:{data:{id:'duoc_vien'}}};context.lastQuestTarget='portal:duoc_vien:thanh_truc_lam:13,0';
const travelPlan={mapId:'hang_dong_co'};context.questWatchdogTick(travelPlan);
now=19000;context.window.PNTT.SceneWorld.player.x=100;context.questWatchdogTick(travelPlan);assert.equal(context.questWatchdog.progressAt,now);assert.equal(logs.length,0);
now=35000;context.window.PNTT.SceneWorld.map.data.id='thanh_truc_lam';context.questWatchdogTick(travelPlan);assert.equal(context.questWatchdog.progressAt,now);assert.equal(logs.length,0);
now+=21000;context.questWatchdogTick(travelPlan);assert.equal(logs.length,1,'Stationary travel still triggers watchdog');
console.log('Portal approach and intermediate map progress do not falsely stall; stationary travel does');
