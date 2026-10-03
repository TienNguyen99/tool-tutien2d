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
vm.runInContext(code,context);
context.interact();assert.equal(presses,1);assert.equal(paths,1);
assert.equal(scene.approach,null,'E owns interaction instead of synthetic approach');
now+=1000;context.interact();assert.equal(presses,1,'Wait before retrying E');
now+=3500;player.x=0;context.interact();assert.equal(presses,1,'Never press E outside range');
player.x=100;context.P.Input={};context.interact();
assert.equal(scene.approach.obj,context.target.obj,'Older runtime retains approach fallback');
console.log('Quest E input, range, retry cooldown and legacy fallback passed');
