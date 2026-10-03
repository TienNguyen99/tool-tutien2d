const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
const start=source.indexOf('    const now = Date.now();',source.indexOf('    rememberSpot(plan, target.obj.x'));
const end=source.indexOf('  function updateKills()',start);
const code='function interact(){'+source.slice(start,end);
let presses=0,paths=0,now=10000;
const player={x:100,y:100,setPath:()=>paths++};
const scene={map:{},player};
const context=vm.createContext({Date:{now:()=>now},P:{Input:{pressInteract:()=>presses++}},
  scene,player,target:{key:'prop:quest',obj:{x:100,y:100}},plan:{targetLabel:'Quest'},
  forceRoute:false,lastQuestTarget:'',lastQuestRouteAt:0,questWatchdog:{recoveries:0},
  routeToInteractable:()=>({route:[],centerY:100,reach:48}),
  safe:fn=>fn(),reportOnce:()=>{},holdQuestPosition:()=>{}});
context.setNativeAuto=()=>{};
vm.runInContext(code,context);
context.interact();assert.equal(presses,1);assert.equal(paths,1);
assert.equal(scene.approach,null,'E owns interaction instead of synthetic approach');
now+=250;context.interact();assert.equal(presses,1,'Wait before retrying E');
now+=3500;player.x=0;context.interact();assert.equal(presses,1,'Never press E outside range');
player.x=100;context.P.Input={};context.interact();
assert.equal(scene.approach.obj,context.target.obj,'Older runtime retains approach fallback');
let meditations=0;context.plan.questMeditation=true;
context.P.Input={pressMeditate:()=>{throw Error('Q does not grant bonus XP')},pressInteract:()=>meditations++};
now+=4000;context.interact();assert.equal(meditations,1,'Activate stone XP meditation through E');
player.state='sit';player.meditateBonusExp=true;now+=4000;context.interact();assert.equal(meditations,1,'Do not interrupt confirmed XP meditation');
player.meditateBonusExp=false;context.P.Player={stand:()=>{player.state='idle'}};
now+=4000;context.interact();assert.equal(meditations,2,'Recover from Q-only sitting by interacting with stone');
assert.equal(player.state,'idle');
console.log('Quest E input, range, retry cooldown and legacy fallback passed');

context.plan.questMeditation=false;context.P.Input={pressInteract:()=>presses++};player.state='idle';player.x=45;
context.routeToInteractable=()=>({route:[],centerY:100,reach:48,interactionReach:63});
context.lastQuestTarget=context.target.key;context.lastQuestRouteAt=now-1500;const beforeNear=presses;
context.interact();assert.equal(presses,beforeNear+1,'55px NPC distance is inside native E reach despite being outside 48px route ring; route cooldown must not block E');
player.x=30;now+=2000;context.interact();assert.equal(presses,beforeNear+1,'70px remains outside native E reach');
