const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const s=fs.readFileSync('extension/hook.js','utf8');let objective='Hạ U Minh Cự Mãng ở Huyết Xích Cấm Địa';
const P={Quest:{guidePlace:()=>({mapId:'rung_mang_xa',ids:['wrong_boss_guide']})},SceneWorld:{map:{data:{id:'tan_vien'}}}};
const context=vm.createContext({window:{PNTT:P},safe:f=>f(),objectiveRows:()=>[{text:objective,done:false}],readHud:()=>({objectives:[]}),scanPlanLocation:()=>'',policy:{priorities:{}},fold:v=>String(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase()});
vm.runInContext(s.slice(s.indexOf('  function analyzeQuest('),s.indexOf('  function chooseTarget(')),context);
let plan=context.analyzeQuest();assert.equal(plan.stepId,'party_boss_approach');
P.SceneWorld.player={x:100,y:84};P.SceneWorld.map={data:{id:'mieu_hoang'},props:[{id:'nu_tu_mieu_hoang',x:100,y:100}]};
plan=context.analyzeQuest();assert.equal(plan.stepId,'party_boss_wait');assert.equal(plan.partyBoss.count,null);
P.Party={members:Array.from({length:5},(_,i)=>({id:i}))};assert.equal(context.analyzeQuest().partyBoss.count,5);assert.equal(context.analyzeQuest().action,'wait');
P.Party.members.push({id:5});plan=context.analyzeQuest();assert.equal(plan.stepId,'party_boss_register');assert.equal(plan.mapId,'mieu_hoang');assert.equal(plan.ids[0],'nu_tu_mieu_hoang');
P.SceneWorld.map.data={id:'rung_mang_xa'};delete P.Party;plan=context.analyzeQuest();assert.equal(plan.action,'attack');assert.equal(plan.requiredBoss,true);assert.equal(plan.enemyTypes[0],'u_minh_cu_mang');
P.SceneWorld.map.data={id:'mieu_hoang'};assert.equal(context.analyzeQuest().action,'wait','Leaving instance rechecks party');
console.log('Party unknown, five members, six members, correct registrar, instance combat and recheck passed');

P.Quest.buocCuaQuan=()=>({id:'day_dao_hanh',place:{mapId:'tan_vien',ids:['dai_da']},hint:'Tích Đạo Hạnh'});
plan=context.analyzeQuest();assert.notEqual(plan.stepId,'party_boss_wait','Future boss must not interrupt native realm prerequisite');assert.equal(plan.stepId,'day_dao_hanh');

context.config={dailyDuocCong:true};P.Quest.seedTaskList=()=>[];P.Quest.seedTaskInfo=()=>({kind:'tournament'});P.Quest.buocCuaQuan=()=>({id:'boss',place:{mapId:'dam_lay_boss',ids:['boss']}});
P.Party={members:Array.from({length:6},(_,id)=>({id}))};
plan=context.analyzeQuest();assert.equal(plan.stepId,'party_boss_register');assert.equal(plan.mapId,'mieu_hoang','Native instance guide must route through registration, never a tile portal to boss map');

P.SceneWorld.player.x=500;plan=context.analyzeQuest();assert.equal(plan.stepId,'party_boss_approach','Even a full party must approach registrar before registration');assert.equal(plan.partyBoss.nearRegistrar,false);
P.SceneWorld.player.x=100;assert.equal(context.analyzeQuest().stepId,'party_boss_register');

context.config.dailyDuocCong=false;P.Quest.stage=21;P.Quest.flags={huyet_sac_boss:true};P.Quest.seedTaskInfo=()=>null;P.Quest.buocCuaQuan=()=>null;
P.Quest.objectives=()=>[{text:'Hạ U Minh Cự Mãng ở Huyết Xích Cấm Địa',done:true},{text:'Thắng 1 trận Đại Hội Tu Tiên',done:false}];
P.Quest.guidePlace=()=>({mapId:'tan_vien',ids:['chap_su_dai_hoi']});P.SceneWorld.map.data={id:'dam_lay_boss'};
context.cropUtilityPlan=()=>null;context.knowledgeHint=()=>null;context.encyclopediaKnowledge=()=>[];context.config.skillSlots=[];
plan=context.analyzeQuest();assert.notEqual(plan.requiredBoss,true,'Confirmed boss flag must release instance combat despite stale HUD');assert.notEqual(plan.stepId,'party_boss_wait');
