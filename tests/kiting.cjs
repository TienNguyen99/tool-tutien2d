const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
let route, attacks=0;
const enemy={x:40,y:0,hp:10,def:{contactDmg:5,speed:40}};
const player={x:0,y:0,state:'attack',attackFired:false,setPath:p=>route=p};
const context=vm.createContext({window:{PNTT:{SceneWorld:{player,map:{},enemies:[enemy]},
  Targeting:{currentEnemy:()=>enemy},Player:{reach:()=>60,stand:()=>{}},Input:{pressAttack:()=>attacks++}}},
  mode:'quest',meditating:false,retreatState:{until:0},kiteUntil:0,kiteRouteAt:0,kiteAttackAt:0,
  skillIndex:0,config:{skillSlots:[]},setNativeAuto:()=>{},visibleElement:()=>null,
  safe:(fn,fallback)=>{try{return fn()??fallback}catch{return fallback}},
  safePathRoute:(map,sx,sy,x,y)=>[{x,y}],routeDistance:(p,r)=>Math.hypot(r[0].x-p.x,r[0].y-p.y),
  lastQuestRouteAt:100,reportOnce:()=>{}});
vm.runInContext(source.slice(source.indexOf('  function kiteTick('),source.indexOf('  function safetyTick(')),context);
context.kiteTick();
assert.equal(route,undefined,'Do not dodge before strike fires');
player.attackFired=true;context.kiteTick();
assert.equal(attacks,0,'Kite observes the strike, never issues another attack');
assert.ok(route && Math.hypot(route[0].x-enemy.x,route[0].y-enemy.y)>40,'Dodge increases separation');
assert.ok(Math.hypot(route[0].x,route[0].y)<=36.001,'Micro dodge, not a long retreat');
const until=context.kiteUntil;
context.kiteTick();assert.equal(context.kiteUntil,until,'Do not prolong the dodge');
context.kiteUntil=Date.now()-1;context.questTick=()=>{};context.kiteTick();
assert.equal(context.kiteUntil,0,'Release quest after bounded dodge');
assert.equal(route.length,0,'Stop moving after dodge');
context.kiteRouteAt=0;route=null;context.safePathRoute=()=>[];
context.kiteTick();assert.equal(route,null,'No unsafe direct fallback when routes blocked');
context.mode='off';context.kiteUntil=0;context.kiteTick();assert.equal(context.kiteUntil,0);
console.log('Hit-and-run regressions passed');
