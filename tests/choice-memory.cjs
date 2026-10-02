const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
const rows=[], context=vm.createContext({window:{PNTT:{Quest:{stage:20}}},
  learnedChoices:new Map(),choiceValues:new Map(),policy:{dialog:{progressReward:20,failureReward:-20,learningRate:.2}},pendingChoice:null,HOOK_VERSION:'test',fold:s=>s.toLowerCase(),
  readHud:()=>({objectives:['new objective']}),post:event=>rows.push(event.payload),reportOnce:()=>{},
  document:{addEventListener(){}}});
vm.runInContext(source.slice(source.indexOf('  function choiceContext('),source.indexOf('  function clickQuestDialogDecision(')),context);
context.pendingChoice={key:'a',label:'Bước Vào Hang',dialog:'Hang',time:Date.now(),progress:'old'};
context.settleChoiceMemory();assert.equal(context.learnedChoices.get('a'),'Bước Vào Hang');
assert.equal(rows[0].outcome,'success');
assert.equal(rows[0].value,4,'Reward updates action value');
context.pendingChoice={key:'a',label:'Bước Vào Hang',dialog:'Hang',time:Date.now()-16000,
  progress:JSON.stringify([20,['new objective']])};
context.settleChoiceMemory();assert.equal(context.learnedChoices.has('a'),false);
assert.equal(rows[1].outcome,'fail');
assert.ok(rows[1].value < 0,'Failure lowers action value below untried choices');
console.log('Choice memory regressions passed');
context.pendingChoice={key:'timeout',label:'First',dialog:'Dialog',time:Date.now(),
  progress:JSON.stringify([20,['new objective']])};
context.settleChoiceMemory('dialog_timeout');
assert.equal(rows.at(-1).outcome,'fail','Timeout logs failure before backing out');
assert.equal(rows.at(-1).failureReason,'dialog_timeout');
const plan={stepId:'step',objective:'Nhặt đồ 1/3',mapId:'map'};
const key=context.choiceContext(plan,['First','Second']);
assert.equal(key,context.choiceContext({...plan,objective:'Nhặt đồ 2/3'},['Second','First']),
  'Option reorder and progress counters do not erase failed choices');
// Use the actual dialog decision function to ensure even a high base score
// cannot repeatedly pick a known failed option.
let now=10000,clicked=[];
context.Date={now:()=>now};context.lastDialogChoiceAt=0;
context.policy.dialog.exploreAfterMs=6000;
context.dialogDecision={signature:'',observedAt:0,acted:new Set()};
context.getComputedStyle=()=>({display:'block',visibility:'visible'});
const buttons=['First','Second','Lui Bước'].map(textContent=>({textContent,disabled:false,
  title:'',getClientRects:()=>[{}],getAttribute:()=>null,matches:()=>false,
  click:()=>clicked.push(textContent)}));
const root={textContent:'Dialog',classList:{contains:()=>false},getClientRects:()=>[{}],
  querySelector:()=>null,querySelectorAll:()=>buttons};
context.document.querySelector=()=>root;
context.rankDialogChoices=()=>[{index:0,score:180,reason:'match'},{index:1,score:0,reason:'test'},{index:2,score:-1000,reason:'back'}];
context.dialogChoiceLabel=b=>b.textContent;
context.handleBachKhoaDialog=()=>false;context.safe=(fn,fallback)=>{try{return fn()??fallback}catch{return fallback}};
context.report=()=>{};context.config={aiPlanner:false};
const dialogKey=context.choiceContext(plan,buttons.map(b=>b.textContent));
context.choiceValues.set(JSON.stringify([dialogKey,'First']),-4);
vm.runInContext(source.slice(source.indexOf('  function clickQuestDialogDecision('),source.indexOf('  function visibleDialog(')),context);
context.clickQuestDialogDecision(plan);now+=6500;context.clickQuestDialogDecision(plan);
assert.deepEqual(clicked,['Second'],'Skip failed first option, try second after waiting');
now+=1500;context.clickQuestDialogDecision(plan);
assert.deepEqual(clicked,['Second'],'Do not repeatedly click second option');
console.log('Timeout failure and sequential option regressions passed');
// An unknown planting option must not be excluded by recipe-only semantic rules.
clicked=[];now+=20000;context.dialogDecision={signature:'',observedAt:0,acted:new Set()};
context.choiceValues.clear();context.learnedChoices.clear();
buttons[0].textContent='Gieo Hạt Linh Điệp ×5';buttons[1].textContent='Gieo Hạt Huyết Thảo ×5';
for (const button of buttons) button.click=()=>clicked.push(button.textContent);
context.rankDialogChoices=()=>[{index:1,score:10,reason:'weak match'},
  {index:0,score:-1000,reason:'Not a brew ingredient'},{index:2,score:-1000,reason:'back'}];
context.clickQuestDialogDecision(plan);now+=6100;context.clickQuestDialogDecision(plan);
assert.deepEqual(clicked,['Gieo Hạt Linh Điệp ×5'],'Unknown dialog picks first visible actionable option, not semantic rank');
now+=1500;context.clickQuestDialogDecision(plan);
assert.equal(clicked.length,1,'Fallback never spams an unchanged dialog');
console.log('Unknown planting dialog first-option regression passed');
(async()=>{
  clicked=[];now+=20000;context.config.aiPlanner=true;
  context.dialogDecision={signature:'',observedAt:0,acted:new Set()};
  let payload;
  context.window.__tienloLocalRequest=async(operation,input)=>{assert.equal(operation,'plan');payload=input;
    return {source:'llm',decision:{action:'select_dialog_option',optionIndex:1,label:buttons[1].textContent,confidence:.9,reason:'Quest needs herb'}};};
  context.clickQuestDialogDecision(plan);now+=1500;context.clickQuestDialogDecision(plan);
  await new Promise(resolve=>setImmediate(resolve));now+=100;
  context.clickQuestDialogDecision(plan);
  assert.deepEqual(clicked,['Gieo Hạt Huyết Thảo ×5'],'Validated AI overrides first-button exploration');
  assert.equal(payload.options.length,3);
  now+=1500;context.clickQuestDialogDecision(plan);assert.equal(clicked.length,1,'AI result cannot spam clicks');
  console.log('Extension AI planner bridge and one-click regression passed');
  now+=1500;clicked=[];buttons[2].id='dialog-close';root.querySelectorAll=()=>[buttons[2]];
  context.window.__tienloLocalRequest=()=>{throw Error('Empty dialog must not ask AI')};
  context.clickQuestDialogDecision(plan);
  assert.deepEqual(clicked,['Lui Bước'],'Close empty interaction panel immediately to approach again');
  assert.equal(context.dialogDecision.signature,'');
  console.log('Empty interaction panel recovery passed');
})().catch(error=>{console.error(error);process.exitCode=1});
