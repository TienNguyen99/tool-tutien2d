const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const s=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
let now=10000,closes=0;
const zone={classList:{contains:()=>false},getClientRects:()=>[1],querySelector:()=>({disabled:false,click:()=>closes++})};
const c=vm.createContext({Date:{now:()=>now},document:{querySelector:q=>q==='#khu-panel'?zone:null},
  getComputedStyle:()=>({display:'block'}),lastDialogChoiceAt:0,lastQuestTarget:'portal',lastQuestRouteAt:5,
  report:()=>{},window:{}});
vm.runInContext(s.slice(s.indexOf('  function handleQuestOverlay('),s.indexOf('  function rankDialogChoices(')),c);
assert.equal(c.handleQuestOverlay(),true);assert.equal(closes,1);assert.equal(c.lastQuestTarget,'');
c.handleQuestOverlay();assert.equal(closes,1,'Do not spam the close button before the UI acknowledges it');
now+=1001;c.handleQuestOverlay();assert.equal(closes,2);
let crafts=0,stops=0;
const craft={textContent:'Rèn',click:()=>crafts++};
Object.assign(c,{plan:{stepId:'forge_weapon',craftItemId:'thiet_kiem',autoChoice:'Thiết Kiếm'},
  detail:{querySelector:()=>({textContent:'Thiết Kiếm'}),getClientRects:()=>[1]},
  allButtons:[craft],visibleButton:()=>true,fold:v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase(),
  pendingForgedWeapon:'',forgeAttempt:{count:0,at:0,before:0,equipCount:0},stop:()=>stops++,
  window:{PNTT:{Inventory:{count:()=>0}}}});
craft.matches=()=>false;
const start=s.indexOf("    if(plan?.stepId==='forge_weapon') {");
vm.runInContext('function forge(){'+s.slice(start,s.indexOf('    const buttons = allButtons',start))+'}',c);
c.forge();assert.equal(crafts,1);assert.equal(c.pendingForgedWeapon,'thiet_kiem');
now+=1000;c.forge();assert.equal(crafts,1,'Wait for inventory acknowledgement');
for(let i=0;i<4;i++){now+=8001;c.forge();}
assert.equal(crafts,4);assert.equal(stops,1,'Unacknowledged crafting is bounded');
let equipped=false,equipCalls=0;
Object.assign(c,{P:{Quest:{flags:{ren_vu_khi_chinh:true}},Inventory:{count:()=>1,
  isEquipped:()=>equipped,equip:()=>{equipCalls++;equipped=true;return {ok:true}}},ITEMS:{}},
  safe:fn=>fn(),reportOnce:()=>{},pendingForgedWeapon:'thiet_kiem',forgeAttempt:{before:0,at:0,equipCount:0}});
const equipStart=s.indexOf('    if(pendingForgedWeapon && (P.Quest');
vm.runInContext('function equipForged(){'+s.slice(equipStart,s.indexOf('    const plan = analyzeQuest();',equipStart))+'}',c);
c.equipForged();assert.equal(equipCalls,1);assert.equal(c.pendingForgedWeapon,'');
c.equipForged();assert.equal(equipCalls,1,'Confirmed equipment must not be equipped repeatedly');
console.log('Autonomous zone unblock, crafting acknowledgement wait and bounded retries passed');
