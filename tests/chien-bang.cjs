const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
let now=10000,clicks=0;
const context=vm.createContext({window:{PNTT:{Quest:{stage:19,flags:{}}}},
  fold:s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase(),
  Date:{now:()=>now},chienBangAttemptAt:0,lastDialogChoiceAt:0,
  pendingChoice:{label:'Tán Tu Chiến Bảng'},dialogDecision:{acted:new Set(['old']),ai:{}},
  report:()=>{},reportOnce:()=>{}});
vm.runInContext(source.slice(source.indexOf('  function handleChienBangDialog('),source.indexOf('  function clickQuestDialogDecision(')),context);
const plan={objective:'Đấu 1 trận Tán Tu Chiến Bảng (thắng thua đều tính)'};
const board={querySelector:()=>({})};
const challenge={disabled:false,matches:s=>s==='.cb-fight',click:()=>clicks++};
const pager={disabled:false,matches:()=>false,click:()=>{throw Error('Must never paginate')}};
assert.equal(context.handleChienBangDialog(plan,board,[challenge,pager]),true);
assert.equal(clicks,1);assert.equal(context.pendingChoice,null);
now+=1000;context.handleChienBangDialog(plan,board,[challenge]);assert.equal(clicks,1);
now+=8000;challenge.disabled=true;context.handleChienBangDialog(plan,board,[challenge]);assert.equal(clicks,1);
const entry={textContent:'Tán Tu Chiến BảngNhiệm vụ: đấu 1 trận',click:()=>clicks++};
context.handleChienBangDialog(plan,{querySelector:()=>null},[entry]);assert.equal(clicks,2);
context.window.PNTT.Quest.stage=20;
assert.equal(context.handleChienBangDialog(plan,board,[challenge]),false);
console.log('Stage 19 board entry, challenge, pagination exclusion and cooldown passed');

vm.runInContext(source.slice(source.indexOf('  function handleChienBangRound('),source.indexOf('  function handleChienBangDialog(')),context);
let attacks=0,resets=0;context.holdQuestPosition=()=>{};context.setNativeAuto=value=>assert.equal(value,true);context.resetQuestWatchdog=()=>resets++;
const arena={SceneWorld:{map:{data:{id:'chien_bang_dai'}}},Input:{pressAttack:()=>attacks++}};
assert.equal(context.handleChienBangRound(arena,plan),true);assert.equal(attacks,1);assert.equal(resets,1);
arena.SceneWorld.map.data.id='tan_vien';assert.equal(context.handleChienBangRound(arena,plan),false);assert.equal(attacks,1);
console.log('Arena combat keeps the round active and releases control after server return');
