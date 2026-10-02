const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
let now=10000,routes=0,stopped=0,path=[];
const player={x:0,y:0,hp:21,hpMax:100,bp:80,bpMax:80,setPath:p=>{path=p;if(p.length)routes++;}};
const enemy={id:'strong',x:40,y:0,hp:100,def:{}};
const context=vm.createContext({window:{PNTT:{SceneWorld:{map:{data:{id:'test'}},player,enemies:[enemy]},Targeting:{}}},
  Date:{now:()=>now},retreatState:{mapId:'',hits:[],until:0,routeAt:0},config:{hpThreshold:30,stopLowHp:true},
  avoidedEnemies:new Map(),defenseState:{},kiteUntil:0,mode:'quest',lastQuestTarget:'',lastQuestRouteAt:0,
  recoveryState:{phase:'idle'},
  safe:(fn,fallback)=>{try{return fn()??fallback}catch{return fallback}},setNativeAuto:()=>{},
  report:()=>{},reportOnce:()=>{},visibleElement:()=>null,
  safePathRoute:(_map,_x,_y,x,y)=>[{x,y}],routeDistance:(p,r)=>Math.hypot(r[0].x-p.x,r[0].y-p.y),
  stop:()=>{stopped++;}});
vm.runInContext(source.slice(source.indexOf('  function retreatTick('),source.indexOf('  function kiteTick(')),context);
assert.equal(context.retreatTick(),false,'Low HP alone must never start running');
assert.equal(routes,0);assert.equal(context.avoidedEnemies.size,0);
player.hp=100;context.retreatTick();now+=100;player.hp=75;
assert.equal(context.retreatTick(),false,'Heavy damage above 20% must not start retreat');
now+=100;player.hp=20;
assert.equal(context.retreatTick(),false,'Exactly 20% must not start retreat');
now+=100;player.hp=19;
assert.equal(context.retreatTick(),true,'Fresh heavy damage below 20% starts retreat');
const deadline=context.retreatState.until;now+=100;
context.retreatTick();assert.equal(context.retreatState.until,deadline,'Old damage never extends retreat');
// Even with an enemy nearby and low HP, reaching the deadline stops movement.
player.hp=18;now+=100;context.retreatTick();const finalDeadline=context.retreatState.until;
now=finalDeadline+1;context.retreatTick();
assert.equal(context.retreatState.until,0);assert.equal(path.length,0);assert.equal(stopped,1);
// After reset, remaining low HP does not trigger another escape.
context.retreatTick();assert.equal(context.retreatState.until,0);
console.log('Low HP and bounded retreat regressions passed');
