const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
const rows=[],context=vm.createContext({window:{PNTT:{Quest:{stage:8},Farm:{hasWaterAccess:()=>true,state:{}}}},
 learnedChoices:new Map(),choiceValues:new Map(),policy:{dialog:{progressReward:20,failureReward:-20,learningRate:.2}},
 pendingChoice:null,HOOK_VERSION:'test',fold:s=>s.toLowerCase(),safe:(fn,fallback)=>{try{return fn()??fallback}catch{return fallback}},
 readHud:()=>({objectives:['Thu hái Linh Diệp 0/5']}),post:e=>rows.push(e.payload),reportOnce:()=>{},document:{querySelector:()=>null,addEventListener(){}}});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../extension/quest-workflow.js'),'utf8'),context);
vm.runInContext(source.slice(source.indexOf('  function choiceContext('),source.indexOf('  function clickQuestDialogDecision(')),context);
const plan={gardenStage8:true,objective:'Thu hái Linh Diệp',mapId:'vuon_ca_nhan'};
const key=context.choiceContext(plan,['Múc nước']);
assert.notEqual(key,context.choiceContext({...plan,gardenStage8:false},['Múc nước']));
context.pendingChoice={key,label:'Múc nước',dialog:'Múc nước',time:Date.now(),progress:JSON.stringify([8,['Thu hái Linh Diệp 0/5']]),
 workflow:{step:{action:'garden_scoop'},before:{waterAccess:false},chainKey:'garden'}};
context.settleChoiceMemory();assert.equal(rows.at(-1).outcome,'success');
assert.equal(context.choiceValues.get(JSON.stringify([key,'Múc nước'])),4);
console.log('Garden prerequisite confirmation and old failure isolation passed');

