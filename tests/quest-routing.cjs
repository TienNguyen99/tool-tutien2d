const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../extension/hook.js'), 'utf8');
function section(start, end) {
  return source.slice(source.indexOf(`  function ${start}(`), source.indexOf(`  function ${end}(`));
}
const context = vm.createContext({
  kiteUntil: 0,
  recoveryState: {phase:'idle'},
  policy: { priorities: {}, dialog: { exploreAfterMs: 6000 } },
  worldMaps: new Map(),
  document: { addEventListener() {} },
  window: { PNTT: {} },
  safe: (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } },
  objectiveRows: () => [{ text: 'Có 1 Luyện Khí Đan', done: false }],
  readHud: () => ({ objectives: ['Tích đủ Đạo Hạnh'] }),
  scanPlanLocation: () => 'fixture',
  knowledgeHint: () => ({ mapId: 'yen_lang_son', action: 'attack', entry: { name: 'Quái' } }),
  fold: value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd'),
});
vm.runInContext(section('analyzeQuest', 'chooseTarget') + section('mapDefinitions', 'navigateToMap')
  + section('inferTargetMap', 'inferInteractIds') + section('dailyDuocCongPlan','analyzeQuest'), context);

context.window.PNTT = {
  SceneWorld: { map: { data: { id: 'thanh_truc_lam' } } },
  Quest: { stage: 18, guidePlace: () => ({ mapId: 'duoc_vien', ids: ['dai_phu'] }),
    buocCuaQuan: () => ({ id: 'gap_dai_phu', hint: 'Nhận việc Dược Công',
      place: { mapId: 'duoc_vien', ids: ['dai_phu'] } }) },
};
let plan = context.analyzeQuest();
assert.equal(plan.mapId, 'duoc_vien');
assert.equal(plan.action, 'interact');
assert.equal(plan.autoChoice, 'Xem Sổ Việc Dược Công');
delete context.window.PNTT.Quest.buocCuaQuan;
plan = context.analyzeQuest();
assert.equal(plan.mapId, 'duoc_vien', 'Native NPC guide must beat broad encyclopedia matches');
assert.equal(context.inferTargetMap('Tích đủ Đạo Hạnh', 'duoc_vien'), 'duoc_vien');
assert.equal(context.inferTargetMap('Độc Đằng Yêu', ''), 'duoc_vien');

const definitions = {
  thanh_truc_lam: { id: 'thanh_truc_lam', portals: [{ toMap: 'bridge_map' }] },
  bridge_map: { id: 'bridge_map', portals: [{ toMap: 'yen_lang_son' }] },
  yen_lang_son: { id: 'yen_lang_son', portals: [] },
};
context.window.PNTT.MapData = { get: id => definitions[id] };
context.window.PNTT.SceneWorld.map.data = definitions.thanh_truc_lam;
assert.deepEqual(Array.from(context.mapRoute('thanh_truc_lam', 'yen_lang_son')),
  ['thanh_truc_lam', 'bridge_map', 'yen_lang_son']);
assert.equal(context.mapRoute('thanh_truc_lam', 'missing_map'), null);
definitions.bridge_map.portals[0].byHand = true;
assert.equal(context.mapRoute('thanh_truc_lam', 'yen_lang_son'), null,
  'Manual portals must not be treated as automatic transitions');
console.log('Quest routing regressions passed');

vm.runInContext(section('rankDialogChoices', 'clickQuestDialogDecision'), context);
const labels = ['Đổi Gói Hạt Tụ Khí Đan', 'Đổi Gói Hạt Luyện Khí Đan',
  'Đổi Gói Hạt Phá Cảnh Đan', 'Lui Bước'];
let decisions = context.rankDialogChoices(labels,
  { objective: 'Tích đủ Đạo Hạnh', autoChoice: 'Mở Quầy Đổi Hạt' }, 'Gói Hạt Luyện Khí Đan');
assert.equal(decisions[0].index, 1, 'Only exchange seeds required by the current step');
assert.equal(decisions[0].score, 200);
assert.ok(decisions.slice(1).every(row => row.score < 0));
decisions = context.rankDialogChoices(labels, { objective: 'Tích đủ Đạo Hạnh' });
assert.ok(decisions.every(row => row.score < 0), 'Unknown recipe must not spend credits');
decisions = context.rankDialogChoices(['Nói chuyện', 'Xem Sổ Việc Dược Công', 'Lui Bước'],
  { autoChoice: 'Xem Sổ Việc Dược Công' });
assert.equal(decisions[0].index, 1);
assert.ok(decisions[0].score - decisions[1].score >= 12);
decisions = context.rankDialogChoices(['Nhận việc hái nấm', 'Nhận việc hái cây'],
  { objective: 'Nhận việc hái' });
assert.equal(decisions[0].score, decisions[1].score, 'Ambiguous choices must remain tied');
console.log('Dialog choice regressions passed');
decisions = context.rankDialogChoices(['Gieo Hạt Thanh Tâm Hoa x1',
  'Gieo Hạt Linh Ngọc Diệp x3', 'Gieo Hạt Xích Dương Thảo x3', 'Lui Bước'],
  {}, '', ['Linh Ngọc Diệp', 'Xích Dương Thảo']);
assert.equal(decisions[0].index, 1);
assert.ok(decisions[0].score - decisions[1].score >= 12);
decisions = context.rankDialogChoices(['Gieo Hạt Linh Ngọc Diệp x3',
  'Gieo Hạt Xích Dương Thảo x3'], {}, '', ['Xích Dương Thảo']);
assert.equal(decisions[0].index, 1, 'Skip ingredients already available');
console.log('Recipe seed regressions passed');

let attacks = 0;
// Movement is mocked here; real grid/footprint checks live in pathfinding.cjs.
context.safePathRoute = (...args) => context.window.PNTT.Pathfinder?.route?.(...args) || [];
context.defenseState = { mapId: '', hp: null, bp: null, enemy: null, until: 0 };
context.visibleElement = () => null;
context.config = { skillSlots: [] };
context.reportOnce = () => {};
context.lastQuestTarget = '';
context.lastQuestRouteAt = 0;
context.window.PNTT = { SceneWorld: { map: { data: { id: 'garden' } },
  player: { x: 0, y: 0, hp: 100, bp: 80, setPath() {} },
  enemies: [{ id: 'beast', x: 40, y: 0, hp: 23, def: {} }] },
  Targeting: {}, Input: { pressAttack: () => attacks++ } };
vm.runInContext(section('questDefenseTick', 'safetyTick'), context);
assert.equal(context.questDefenseTick(), false, 'Do not attack before damage');
context.window.PNTT.SceneWorld.player.bp = 70;
assert.equal(context.questDefenseTick(), true, 'Armor damage triggers defense');
assert.equal(attacks, 1);
assert.equal(context.window.PNTT.Targeting.key, 'foe:beast');
context.window.PNTT.SceneWorld.enemies[0].dead = true;
assert.equal(context.questDefenseTick(), false, 'Resume quest after threat dies');
assert.equal(context.window.PNTT.Targeting.key, null, 'Clear defense target when resuming');
let routed = 0;
const beast = context.window.PNTT.SceneWorld.enemies[0];
beast.dead = false;
beast.x = 100;
context.window.PNTT.SceneWorld.player.bp = 60;
context.window.PNTT.Pathfinder = { route: () => [{ x: 80, y: 0 }] };
context.window.PNTT.SceneWorld.player.setPath = route => { if (route.length) routed++; };
assert.equal(context.questDefenseTick(), true);
assert.equal(routed, 1, 'Approach a threat outside attack range');
assert.equal(attacks, 1, 'Do not swing outside attack range');
context.window.PNTT.SceneWorld.player.x = 70;
assert.equal(context.questDefenseTick(), true);
assert.equal(attacks, 2, 'Attack after reaching the threat');
console.log('Self-defense regressions passed');
decisions = context.rankDialogChoices(['Phá Cảnh', 'Thiếu', 'Luyện Luyện Khí Đan', 'Lui Bước'],
  { stepId: 'luyen_dan', autoChoice: 'Luyện Khí Đan' });
assert.equal(decisions[0].index, 2, 'Brew the required pill before attempting breakthrough');
assert.ok(decisions.slice(1).every(row => row.score < 0));
decisions = context.rankDialogChoices(['Phá Cảnh', 'Luyện', 'Lui Bước'],
  { stepId: 'pha_quan', autoChoice: 'Phá Cảnh' });
assert.equal(decisions[0].index, 0);
console.log('Brew/breakthrough regressions passed');
vm.runInContext(section('dialogChoiceLabel', 'clickQuestDialogDecision'), context);
const brewPlan = { stepId: 'luyen_dan', autoChoice: 'Luyện Khí Đan' };
const slot = { textContent: 'Luyện', title: 'Luyện Khí Đan', matches: () => true,
  getAttribute: () => 'Luyện Khí Đan, luyện được' };
assert.equal(context.dialogChoiceLabel(slot, brewPlan), 'Luyện Luyện Khí Đan');
slot.textContent = 'Thiếu';
assert.equal(context.dialogChoiceLabel(slot, brewPlan), 'Thiếu');
const confirm = { textContent: 'Luyện', matches: () => false,
  closest: () => ({ querySelector: () => ({ textContent: 'Luyện Khí Đan' }) }) };
assert.equal(context.dialogChoiceLabel(confirm, brewPlan), 'Luyện Luyện Khí Đan');
console.log('DanLoUI accessible-label regressions passed');
const failureStorage = new Map();
context.localStorage = { getItem: key => failureStorage.get(key),
  setItem: (key, value) => failureStorage.set(key, value) };
context.HOOK_VERSION = 'test';
context.post = () => {};
context.dialogDecision = { signature: 'fixture', acted: new Set() };
const failureButton = { textContent: 'Luyện', title: 'Luyện Khí Đan', disabled: true,
  getAttribute: () => 'Thiếu nguyên liệu' };
for (let index = 0; index < 205; index++) context.logDialogFailure(brewPlan,
  { textContent: 'Đan Lô Cũ' }, [failureButton], 'no_confident_choice', 8000);
const failures = JSON.parse(failureStorage.get('tienlo-quest-failures-v1'));
assert.equal(failures.length, 200);
assert.equal(failures[0].outcome, 'fail');
assert.equal(failures[0].choices[0].disabled, true);
assert.equal(failures[0].recovery, 'back');
console.log('Failure history regressions passed');
context.window.PNTT = { SceneWorld: { map: { data: { id: 'vuon_ca_nhan' } },
  enemies: [{ def: { name: 'Dược Linh Thú' } }] },
  Quest: { stage: 18, guidePlace: () => ({ mapId: 'vuon_ca_nhan', ids: ['plot_1'] }),
    buocCuaQuan: () => ({ id: 'cham_soc', place: { mapId: 'vuon_ca_nhan', ids: ['plot_1'] } }) } };
context.objectiveRows = () => [{ text: 'Tích đủ Đạo Hạnh', cur: 10, max: 810 }];
plan = context.analyzeQuest();
assert.equal(plan.action, 'interact', 'Native next step must beat incomplete XP');
assert.equal(plan.stepId, 'cham_soc');
assert.equal(plan.mapId, 'vuon_ca_nhan');
context.window.PNTT.Quest.buocCuaQuan = () => ({ id: 'gap_dai_phu', hint: 'Đại Phu → nhận việc Dược Công',
  place: { mapId: 'duoc_vien', ids: ['dai_phu'] } });
plan = context.analyzeQuest();
assert.equal(plan.stepId, 'gap_dai_phu');
assert.equal(plan.autoChoice, 'Xem Sổ Việc Dược Công');
assert.equal(plan.mapId, 'duoc_vien');
delete context.window.PNTT.Quest.buocCuaQuan;
assert.equal(context.analyzeQuest().farmXp, true, 'Farm XP when no actionable native step remains');
context.objectiveRows = () => [{ text: 'Tích đủ Đạo Hạnh', cur: 810, max: 810, done: true }];
assert.equal(context.analyzeQuest().action, 'interact', 'Resume prerequisite after sufficient XP');
console.log('XP quest priority regressions passed');
context.retreatState = { mapId: '', hp: null, bp: null, hits: [], until: 0, routeAt: 0 };
context.avoidedEnemies = new Map();
context.setNativeAuto = () => {};
context.report = () => {};
context.mode = 'quest';
context.config.hpThreshold = 30;
context.window.PNTT = { SceneWorld: { map: { data: { id: 'test' } },
  player: { x: 0, y: 0, hp: 100, hpMax: 100, bp: 80, bpMax: 80,
    setPath: route => { routed += route.length > 0 ? 1 : 0; } },
  enemies: [{ id: 'strong', x: 40, y: 0, hp: 100, def: {} }] },
  Pathfinder: { route: (_map, _x, _y, x, y) => [{ x, y }] }, Targeting: {} };
vm.runInContext(section('retreatTick', 'safetyTick'), context);
assert.equal(context.retreatTick(), false);
context.window.PNTT.SceneWorld.player.hp = 75;
assert.equal(context.retreatTick(), true, 'Heavy damage must trigger retreat even above 20% HP');
context.window.PNTT.SceneWorld.player.hp = 19;
assert.equal(context.retreatTick(), true, 'Heavy damage below 20% must trigger retreat');
assert.ok(context.avoidedEnemies.get('test:strong') > Date.now());
assert.ok(routed > 1, 'Retreat must set a path');
context.window.PNTT.SceneWorld.enemies = [];
context.retreatState.until = Date.now() - 1;
assert.equal(context.retreatTick(), false, 'Resume after reaching safety');
console.log('Retreat regressions passed');
context.worldMaps.set('rung_mang_xa', { id:'rung_mang_xa', portals:[{toMap:'saved_bridge'}],
  enemies:[{type:'u_minh_cu_mang'}] });
context.worldMaps.set('saved_bridge', {id:'saved_bridge',portals:[{toMap:'mieu_hoang'}]});
assert.deepEqual(Array.from(context.mapRoute('rung_mang_xa','mieu_hoang')),
  ['rung_mang_xa','saved_bridge','mieu_hoang'],'Use saved map graph, not only hardcoded links');
context.window.PNTT.ENEMY_DEFS={u_minh_cu_mang:{name:'U Minh Cự Mãng'}};
context.window.PNTT.Quest={stage:21,guidePlace:()=>({mapId:'mieu_hoang',ids:['npc']})};
context.window.PNTT.SceneWorld.map.data={id:'rung_mang_xa',portals:[],enemies:[{type:'u_minh_cu_mang'}]};
context.objectiveRows=()=>[{text:'Hạ U Minh Cự Mãng ở Huyết Xích Cấm Địa (tự ra đòn chót)',done:false}];
plan=context.analyzeQuest();
assert.equal(plan.action,'attack');assert.equal(plan.mapId,'rung_mang_xa');
console.log('Persistent map graph and boss objective regressions passed');
context.window.PNTT.Quest={stage:3,guidePlace:()=>({mapId:'tan_vien',ids:['dan_lo']})};
context.window.PNTT.ITEMS={tay_tuy_thang:{name:'Tẩy Tuỷ Thang'}};
context.objectiveRows=()=>[{text:'Sắc thuốc ở đan lô trong sân nhà tranh',done:false}];
plan=context.analyzeQuest();
assert.equal(plan.stepId,'luyen_dan');assert.equal(plan.autoChoice,'Tẩy Tuỷ Thang');
decisions=context.rankDialogChoices(['Phá Cảnh','Luyện Tẩy Tuỷ Thang','Lui Bước'],plan);
assert.equal(decisions[0].index,1,'Stage 3 selects brew option, never first breakthrough tab');
assert.equal(decisions.find(row=>row.index===0).score,-1000);
console.log('Stage 3 brew dialog regressions passed');
context.window.PNTT.Quest={stage:9,guidePlace:()=>({mapId:'vuon_ca_nhan',ids:['dan_lo_linh_dien']})};
context.objectiveRows=()=>[{text:'Sắc Linh Dược ở đan lô trong vườn',done:false}];
plan=context.analyzeQuest();assert.equal(plan.stepId,'luyen_dan');assert.equal(plan.craftItemId,'tu_khi_duoc');
assert.equal(plan.autoChoice,'Linh Dược');assert.equal(plan.mapId,'vuon_ca_nhan');
console.log('Stage 9 Linh Duoc workflow plan passed');
context.window.PNTT.Quest={stage:12,guidePlace:()=>({mapId:'vuon_ca_nhan',ids:['dan_lo_linh_dien']})};
context.objectiveRows=()=>[{text:'Luyện Tụ Khí Đan ở đan lô trong vườn',done:false}];
plan=context.analyzeQuest();assert.equal(plan.stepId,'luyen_dan');assert.equal(plan.autoChoice,'Tụ Khí Đan');
assert.equal(plan.craftItemId,'tu_khi_dan');
console.log('Stage 12 brew slot plan passed');
let oreCount=1;
context.window.PNTT.Quest={stage:20,FORGE_STAGE:20,flags:{hang_dong_da_lay_ruong:true},
  guidePlace:()=>({mapId:'hang_dong_co'})};
context.window.PNTT.Inventory={count:id=>id==='huyen_thiet_khoang'?oreCount:0};
context.objectiveRows=()=>[{text:'Rèn 1 vũ khí ở Thợ Rèn làng Tản Viên',done:false}];
plan=context.analyzeQuest();assert.equal(plan.action,'attack');assert.equal(plan.stepId,'forge_ore');
assert.equal(plan.mapId,'hang_dong_co');assert.equal(plan.itemIds[0],'huyen_thiet_khoang');
oreCount=2;plan=context.analyzeQuest();assert.equal(plan.stepId,'forge_weapon');
assert.equal(plan.ids[0],'tho_ren');assert.equal(plan.craftItemId,'thiet_kiem');
assert.equal(plan.mapId,'tan_vien');
context.window.PNTT.Progress={stones:49};
assert.equal(context.analyzeQuest().stepId,'forge_stones','Missing currency must be gathered before opening forge');
context.window.PNTT.Progress.stones=50;
assert.equal(context.analyzeQuest().stepId,'forge_weapon');
context.window.PNTT.Inventory.count=id=>id==='thiet_kiem'?1:0;
assert.equal(context.analyzeQuest().stepId,'forge_equip','Owned weapon must be equipped instead of forged twice');
context.window.PNTT.Inventory.count=id=>id==='huyen_thiet_khoang'?oreCount:0;
context.window.PNTT.Quest.flags.ren_vu_khi_chinh=true;
context.knowledgeHint=()=>null;
assert.notEqual(context.analyzeQuest().stepId,'forge_weapon','Never forge a second quest weapon after completion');
console.log('Stage 20 ore prerequisite, forge routing and completed flag passed');
for(const dailyPlan of [{dailyTask:{shortName:'Linh Chi'}},{stepId:'daily_turn_in',autoChoice:'Giao Nguyên Liệu'}]) {
  const choices=context.rankDialogChoices(['Mở Quầy Đổi Hạt','Đổi Gói Hạt Tụ Khí Đan','Vẫn đổi Gói Hạt Tụ Khí Đan','Giao Nguyên Liệu'],dailyPlan);
  assert.ok(choices.filter(row=>row.index<3).every(row=>row.score===-1000),'Daily work never trades seed credits');
}
console.log('Daily quest excludes exchange and confirmation choices passed');

context.window.PNTT={SceneWorld:{map:{data:{id:'vuon_ca_nhan'}}},Farm:{hasWaterAccess:()=>false},
 Quest:{stage:8,guidePlace:()=>({mapId:'vuon_ca_nhan',ids:['ho_bich_thuy']})}};
plan=context.analyzeQuest();assert.equal(plan.autoChoice,'Múc nước');assert.equal(plan.stepId,'garden_scoop_water');
context.window.PNTT.Farm.hasWaterAccess=()=>true;
context.window.PNTT.Quest.guidePlace=()=>({mapId:'vuon_ca_nhan',ids:['plot_1']});
plan=context.analyzeQuest();assert.equal(plan.ids[0],'plot_1','Opened water source moves on to garden plot');

context.window.PNTT.Quest.guidePlace=()=>({mapId:'vuon_ca_nhan',ids:['plot_1']});
context.window.PNTT.Farm={state:{},isEmpty:()=>true};
plan=context.analyzeQuest();assert.equal(plan.stepId,'garden_plant');assert.equal(plan.gardenStage8,true);
context.window.PNTT.Farm={state:{plot_1:{seed:'hat_linh_diep',wet:true}},isEmpty:()=>false,ready:()=>false,canWater:()=>false};
assert.equal(context.analyzeQuest().stepId,'garden_wait','Growing plants are a legitimate wait');

decisions=context.rankDialogChoices(['Báo Công','Để Sau'],{objective:'Quay về gặp Đại Phu để trả nhiệm vụ',ids:['dai_phu']});
assert.equal(decisions[0].index,0);assert.equal(decisions[0].score,210);
decisions=context.rankDialogChoices(['Nhận Việc','Để Sau'],{objective:'Gặp Huấn Sư Huynh',ids:['ly_thanh']});
assert.equal(decisions[0].score,210);
context.window.PNTT={SceneWorld:{map:{data:{id:'duoc_vien'}}},Quest:{stage:20,guidePlace:()=>({mapId:'duoc_vien',ids:['dai_phu']}),
 buocCuaQuan:()=>({id:'gap_dai_phu',place:{mapId:'duoc_vien',ids:['dai_phu']}}),canOpenSeedMenu:()=>true,
 seedTaskList:()=>[{def:{id:'linh_chi',name:'Linh Chi',kind:'collect'},runsLeft:1}]} };
context.config={dailyDuocCongTournament:false};
assert.equal(context.analyzeQuest().dailyTask.id,'linh_chi','Seed credit prerequisite chooses a remaining daily job');

context.reportOnce=()=>{};context.config={dailyDuocCong:true};
context.window.PNTT={SceneWorld:{map:{data:{id:'tan_vien'}}},Inventory:{count:()=>0},Quest:{stage:20,flags:{hang_dong_da_lay_ruong:true},guidePlace:()=>null,canOpenSeedMenu:()=>true,seedTaskList:()=>[],objectives:()=>[{text:'Rèn 1 vũ khí ở Thợ Rèn',done:false}]}};
assert.equal(context.analyzeQuest().stepId,'forge_ore');assert.equal(context.config.dailyDuocCong,false,'Exhausted daily quotas resume main quest');
context.config.dailyDuocCong=true;context.window.PNTT.Quest.seedTaskInfo=()=>({kind:'tournament'});
assert.equal(context.analyzeQuest().stepId,'forge_ore','Pending manual tournament must not block main quest');

const newMaps={new_a:{id:'new_a',portals:[{toMap:'new_b',tx:2,ty:3}]},new_b:{id:'new_b',portals:[{toMap:'new_c',tx:4,ty:5}]},new_c:{id:'new_c',portals:[]}};
context.window.PNTT={MapData:{get:id=>newMaps[id],stale:{id:'new_a',portals:[{toMap:'wrong_map'}]}},SceneWorld:{map:{data:newMaps.new_a,portals:newMaps.new_a.portals}}};
assert.deepEqual(Array.from(context.mapRoute('new_a','new_c')),['new_a','new_b','new_c'],'Discover new maps recursively through native get');
assert.equal(context.mapRoute('new_a','wrong_map'),null,'Live map portals override stale enumerable definitions');
context.window.PNTT.SceneWorld.map={data:{id:'tan_vien',portals:[]},portals:[]};
assert.equal(context.mapRoute('tan_vien','mieu_hoang'),null,'Authoritative empty portals must not gain invented fallback edges');
console.log('New map discovery, live precedence and authoritative graph regressions passed');
