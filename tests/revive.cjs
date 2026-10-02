const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
let now=1000,clicked=[],stops=0;
const buttons=['Về làng','Hồi sinh tại chỗ'].map(textContent=>({textContent,disabled:false,getAttribute:()=>'',getClientRects:()=>[{}],click:()=>clicked.push(textContent)}));
const context=vm.createContext({window:{PNTT:{SceneWorld:{player:{setPath:()=>{}}}}},Date:{now:()=>now},
  mode:'quest',reviveState:{since:0,lastClick:0,attempts:0},meditating:false,kiteUntil:0,retreatState:{until:0},stats:{seenOnline:true},
  safe:fn=>fn(),setNativeAuto:()=>{},visibleElement:()=>({querySelectorAll:()=>buttons}),
  fold:s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),report:()=>{},reportOnce:()=>{},stop:()=>stops++});
vm.runInContext(source.slice(source.indexOf('  function reviveTick('),source.indexOf('  function safetyTick(')),context);
context.reviveTick({online:true});assert.deepEqual(clicked,['Hồi sinh tại chỗ']);
now+=1000;context.reviveTick({online:true});assert.equal(clicked.length,1,'No click spam');
buttons[1].disabled=true;now+=5000;context.reviveTick({online:true});assert.equal(clicked.length,1,'Never select alternate respawn');
now+=30000;context.reviveTick({online:true});assert.equal(stops,1,'Bounded waiting');
console.log('In-place revive selection, disabled button and timeout passed');
