const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
let cleared=0,stood=0;
const context=vm.createContext({window:{PNTT:{SceneWorld:{player:{setPath:()=>cleared++}},Player:{stand:()=>stood++}}},
  config:{},mode:'quest',kiteUntil:0,meditating:false,recoveryState:{phase:'idle'},
  safe:fn=>fn(),setNativeAuto:()=>{}});
vm.runInContext(source.slice(source.indexOf('  const DEFAULTS ='),source.indexOf('  let config =')),context);
vm.runInContext(source.slice(source.indexOf('  function configure('),source.indexOf('  function setNativeAuto(')),context);
context.configure({retreatHpThreshold:15,recoverHpThreshold:40,recoverHpResume:30,kiteMilliseconds:400,kiteDistance:24});
assert.equal(context.config.retreatHpThreshold,15);
assert.equal(context.config.recoverHpResume,41,'Recovery resume must exceed start');
assert.equal(context.config.kiteMilliseconds,400);
assert.equal(context.config.kiteDistance,24);
context.configure({recoverSafeRadius:900,kiteMilliseconds:1,damageHpThreshold:'bad',spThreshold:90,spResumeThreshold:20});
assert.equal(context.config.recoverSafeRadius,400);assert.equal(context.config.kiteMilliseconds,100);
assert.equal(context.config.damageHpThreshold,20);assert.equal(context.config.spResumeThreshold,91);
context.kiteUntil=999;context.configure({hitRunEnabled:false});
assert.equal(context.kiteUntil,0);assert.equal(cleared,1,'Disabling dodge clears its active path');
context.meditating='recovering';context.recoveryState.phase='sitting';
context.configure({recoverHealth:false});
assert.equal(context.recoveryState.phase,'idle');assert.equal(context.meditating,false);assert.equal(stood,1);
context.meditating=true;context.configure({meditate:false});assert.equal(context.meditating,false);assert.equal(stood,2);
console.log('Config bounds, thresholds and live toggle regressions passed');
