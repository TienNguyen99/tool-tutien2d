const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
let now=10000,presses=0,allowed=true,blocked=false;
const player={hp:100,flying:false,state:'idle'};
const ctx=vm.createContext({window:{PNTT:{SceneWorld:{player,map:{data:{id:'test'}}},
  Player:{canFly:()=>allowed,inNoFlyZone:()=>blocked},Input:{pressFlyToggle:()=>presses++}}},
  mode:'quest',config:{autoFly:true},meditating:false,recoveryState:{phase:'idle'},
  visibleDialog:()=>null,lastFlyAttemptAt:0,Date:{now:()=>now},reportOnce:()=>{}});
vm.runInContext(source.slice(source.indexOf('  function flightTick('),source.indexOf('  function reviveTick(')),ctx);
ctx.flightTick();assert.equal(presses,1);
ctx.flightTick();assert.equal(presses,1,'Wait for toggle confirmation');
now+=6000;player.flying=true;ctx.flightTick();assert.equal(presses,1,'Never toggle off existing flight');
player.flying=false;blocked=true;ctx.flightTick();assert.equal(presses,1);
blocked=false;allowed=false;ctx.flightTick();assert.equal(presses,1);
allowed=true;ctx.recoveryState.phase='sitting';ctx.flightTick();assert.equal(presses,1);
ctx.recoveryState.phase='idle';ctx.config.autoFly=false;ctx.flightTick();assert.equal(presses,1);
ctx.config.autoFly=true;ctx.mode='off';ctx.flightTick();assert.equal(presses,1);
console.log('Auto flight eligibility, no-fly, toggle confirmation and disabled mode passed');
