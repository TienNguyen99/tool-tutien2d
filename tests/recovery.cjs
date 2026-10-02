const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
let now=10000,meditateCalls=0,lastPath=[],stops=0;
const player={x:0,y:0,hp:25,hpMax:100,state:'idle',setPath:path=>{lastPath=path;}};
const enemy={x:40,y:0,hp:100,def:{contactDmg:4}};
const scene={player,map:{data:{id:'map'}},enemies:[enemy]};
const context=vm.createContext({
  window:{PNTT:{SceneWorld:scene,Player:{stand:p=>p.state='idle'},Input:{pressMeditate:()=>meditateCalls++}}},
  Date:{now:()=>now},mode:'quest',config:{recoverHealth:true,recoverHpThreshold:30,recoverHpResume:85,recoverSafeRadius:200},
  recoveryState:{phase:'idle'},meditating:false,kiteUntil:0,lastQuestRouteAt:0,lastMovedAt:0,
  safe:(fn,fallback)=>{try{return fn()??fallback}catch{return fallback}},setNativeAuto:()=>{},visibleElement:()=>null,
  safePathRoute:(_map,_x,_y,x,y)=>[{x,y}],routeDistance:(p,r)=>Math.hypot(r[0].x-p.x,r[0].y-p.y),
  report:()=>{},reportOnce:()=>{},stop:()=>{stops++;context.recoveryState.phase='idle';context.meditating=false;player.setPath([]);}
});
vm.runInContext(source.slice(source.indexOf('  function recoveryTick('),source.indexOf('  function safetyTick(')),context);
assert.equal(context.recoveryTick(),true);assert.equal(context.recoveryState.phase,'seeking');
assert.ok(lastPath.length,'Find a safe collision-checked route before sitting');
assert.equal(meditateCalls,0,'Never meditate next to enemy');
assert.ok(Math.hypot(lastPath.at(-1).x-enemy.x,lastPath.at(-1).y-enemy.y)>=200);
player.x=lastPath.at(-1).x;player.y=lastPath.at(-1).y;now+=1500;
context.recoveryTick();assert.equal(meditateCalls,1,'Press Q after reaching safe area');
now+=100;context.recoveryTick();assert.equal(meditateCalls,1,'Do not toggle Q repeatedly while pending');
player.state='sit';player.hp=40;context.recoveryTick();assert.equal(context.recoveryState.phase,'sitting');
assert.equal(context.meditating,'recovering','Block combat until resume threshold');
player.hp=85;now+=1000;assert.equal(context.recoveryTick(),false);
assert.equal(context.meditating,false);assert.equal(player.state,'idle');assert.equal(lastPath.length,0);
player.hp=20;context.recoveryTick();player.state='sit';now+=100;context.recoveryTick();
enemy.x=player.x+30;enemy.y=player.y;now+=100;
context.recoveryTick();assert.equal(context.recoveryState.phase,'seeking','Threat interrupts meditation');
assert.equal(player.state,'idle');
context.config.recoverHealth=false;context.recoveryTick();assert.equal(context.meditating,false);
assert.equal(context.recoveryState.phase,'idle');
context.config.recoverHealth=true;scene.enemies=[];context.recoveryTick();player.state='sit';context.recoveryTick();
now+=21000;context.recoveryTick();assert.equal(stops,1,'Stop if sitting does not restore HP');
console.log('Safe meditation, resume, interruption and timeout regressions passed');
