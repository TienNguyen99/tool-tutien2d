const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
let stood=0,toggled=0;
const context=vm.createContext({window:{PNTT:{SceneWorld:{player:{}},Player:{stand:()=>stood++},Input:{pressMeditate:()=>toggled++}}},
  config:{meditate:true,spThreshold:20,spResumeThreshold:85,recoverHpResume:85},meditating:true,mode:'quest',reviveState:{since:0},
  readState:()=>({hpPercent:100,spPercent:100,playerState:'sit'}),updateKills:()=>{},$:()=>null,
  retreatTick:()=>false,recoveryTick:()=>false,stats:{},safe:fn=>fn(),setNativeAuto:()=>{},report:()=>{},reportOnce:()=>{},
  lastQuestTarget:'old',lastQuestRouteAt:1,lastMovedAt:0,sendState:()=>{},analyzeQuest:()=>({objective:'Luyện đan'}),
  fold:s=>s.toLowerCase(),meditateRetryAt:0});
vm.runInContext(source.slice(source.indexOf('  function safetyTick('),source.indexOf('  function start(')),context);
context.safetyTick();assert.ok(stood>0);assert.equal(toggled,0,'Never toggle Q to end sitting');assert.equal(context.meditating,false);
stood=0;context.safetyTick();assert.equal(stood,1,'Recover orphaned sitting after health/mana refill');
stood=0;context.analyzeQuest=()=>({objective:'da toa o dai da'});context.safetyTick();assert.equal(stood,0,'Preserve quest-required sitting');
console.log('Mana completion, orphan sitting and quest meditation exit checks passed');
