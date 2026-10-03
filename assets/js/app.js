import { defaults, EXPECTED_HOOK_VERSION } from './config.js';
import { persist, ratio, state } from './state.js';
import { gameRuntimeHook } from './runtime-hook.js';
import { queueFailure } from './failure-log.js';
import { initSettings } from './settings.js';
const memorySynced = new WeakSet();
async function syncChoiceMemory(source) {
  if (!source || memorySynced.has(source)) return;
  memorySynced.add(source);
  try {
    const response = await fetch('/api/choice-memory');
    if (!response.ok) throw new Error('Memory unavailable');
    const rows = await response.json();
    source.postMessage({ type: 'TIENLO_CHOICE_MEMORY', rows }, 'https://tutien2d.online');
  } catch { memorySynced.delete(source); }
}

const isMiniMode=new URLSearchParams(location.search).get('mini')==='1';
window.name=isMiniMode?'tienlo-companion-mini':'tienlo-companion';
if(isMiniMode)document.body.classList.add('mini-mode');
document.querySelector('#miniOpen').addEventListener('click',()=>{const url=location.origin+location.pathname+'?mini=1';const popup=window.open(url,'tienlo-companion-mini','popup=yes,width=440,height=720,resizable=yes,scrollbars=yes');if(!popup)toast('Trình duyệt đang chặn tiểu cửa sổ');else popup.focus()});
function toast(message='Đã lưu trên thiết bị'){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800)}
let lastLiveAt=0;
const LIVE_TIMEOUT_MS=15000;
let connectionLost=false;
let lastQuestKey=state.live?[state.live.questStage,...(state.live.objectives||[])].join('|'):'';
const ruleCooldown={};
function addAutoEvent(message,warn=false){const log=document.querySelector('#autoLog');if(log.children.length===1&&log.textContent.includes('Nhật ký quyết định'))log.innerHTML='';const row=document.createElement('div');row.className='auto-event'+(warn?' warn':'');row.innerHTML=`<strong>${new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</strong> · ${message}`;log.prepend(row);while(log.children.length>8)log.lastElementChild.remove()}
function fireRule(key,message){if(Date.now()-(ruleCooldown[key]||0)<15000)return;ruleCooldown[key]=Date.now();addAutoEvent(message,true);toast(message)}
function renderQuest(data){
  if(!data)return;
  const objectives=Array.isArray(data.objectives)?data.objectives.filter(Boolean):[];
  document.querySelector('#mainQuestTitle').textContent=data.questStage||'Tiên vụ chưa hiển thị';
  document.querySelector('#mainQuestCopy').textContent=[data.map,data.pos,'Tiến độ được tiếp nhận tự động từ HUD'].filter(Boolean).join(' · ');
  const list=document.querySelector('#questTasks');list.innerHTML='';let current=0,total=0,completed=0;
  objectives.forEach(text=>{const match=text.match(/\((\d+)\s*\/\s*(\d+)\)/),now=match?+match[1]:0,max=match?+match[2]:0,done=max>0&&now>=max;current+=now;total+=max;if(done)completed++;
    const row=document.createElement('div');row.className='task'+(done?' done':'');const mark=document.createElement('em'),label=document.createElement('label'),count=document.createElement('em');mark.textContent=done?'✓':'○';label.textContent=text.replace(/^\s*[○●✓]\s*/,'');count.textContent=match?`${now}/${max}`:'Đang thực hiện';row.append(mark,label,count);list.append(row)});
  if(!objectives.length){const row=document.createElement('div');row.className='task';row.innerHTML='<em>○</em><label>Không có mục tiêu đang hiển thị</label><em>—</em>';list.append(row)}
  const pct=total?Math.round(current/total*100):0;document.querySelector('#progressText').textContent=pct+'%';document.querySelector('#progressRing').style.background=`conic-gradient(var(--gold) 0 ${pct}%,#22180f ${pct}% 100%)`;
  document.querySelector('#liveXpStat').textContent=data.xpPercent||data.xpLabel||'—';document.querySelector('#liveObjectiveStat').textContent=objectives.length?`${completed}/${objectives.length}`:'—';document.querySelector('#liveMapStat').textContent=data.map||'—';document.querySelector('#liveSyncStat').textContent='Thời thực';
}
function evaluateAuto(data){
  const hp=ratio(data.hp),sp=ratio(data.sp),questKey=[data.questStage,...(data.objectives||[])].join('|');let advice='HUD ổn định. Tiếp tục theo dõi nhiệm vụ hiện tại.';
  if(String(data.source||'').includes('PNTT extension')&&data.hookVersion!==EXPECTED_HOOK_VERSION){advice=`Engine ${data.hookVersion||'không rõ phiên bản'} đã cũ — tải lại extension rồi tải lại tab game để dùng ${EXPECTED_HOOK_VERSION}.`;fireRule('hook-version',advice)}
  if(state.autoRules.hp&&hp&&hp<state.autoRules.hpThreshold){advice=`Khí Huyết còn ${Math.round(hp)}% — nên dừng giao tranh và hồi phục.`;fireRule('hp',advice)}
  else if(state.autoRules.sp&&sp&&sp<state.autoRules.spThreshold){advice=`Thần Thức còn ${Math.round(sp)}% — ưu tiên công thường hoặc nghỉ hồi.`;fireRule('sp',advice)}
  if(state.autoRules.quest&&lastQuestKey&&questKey&&questKey!==lastQuestKey){fireRule('quest','Nhiệm vụ HUD vừa thay đổi — kiểm tra mục tiêu mới.');addAutoEvent('Đã cập nhật mục tiêu: '+(data.questStage||data.objectives?.[0]||'Nhiệm vụ mới'))}
  if(questKey)lastQuestKey=questKey;
  if(!['quest','farm'].includes(data.mode))document.querySelector('#autoLiveState').textContent=`Đang phân tích · ${data.map||'không rõ bản đồ'} · ${data.pos||'không rõ vị trí'}`;
  document.querySelector('#liveAutoAdvice').innerHTML='<strong>Khuyến nghị hiện tại:</strong> '+advice;
}
function renderLive(data,isFresh=false){
  if(!data)return;
  const put=(id,value)=>{document.querySelector(id).textContent=value||'—'};
  put('#charName',data.name);put('#charRealm',data.realm);put('#charMap',data.map);put('#liveName',data.name);put('#liveStones',data.stones);put('#controlName',data.name);put('#controlRealm',data.realm);put('#controlMap',data.map);
  put('#charHp',data.hp);put('#charSp',data.sp);put('#charArmor',data.armor);put('#livePos',[data.pos,data.fps].filter(Boolean).join(' · '));put('#liveXp',[data.xpLabel,data.xpPercent].filter(Boolean).join(' · '));
  put('#liveSource',data.source);put('#liveTarget',data.target);put('#liveEnemies',data.enemiesAlive==null?'—':String(data.enemiesAlive));put('#controlHp',data.hp);put('#controlSp',data.sp);put('#controlQuest',data.questPlan?.objective||data.questStage||data.objectives?.[0]||'Không có nhiệm vụ');put('#controlTarget',data.questPlan?.summary||data.target);document.querySelector('#controlTarget').title=data.questPlan?.summary||data.target||'';
  const session=data.session||{};put('#sessionTime',session.elapsed||'00:00');put('#sessionKills',String(session.kills||0));put('#sessionXp',String(session.xpGained||0));put('#sessionStones',String(session.stonesGained||0));put('#sessionStuck',String(session.stuckCount||0));
  put('#sessionCharacter',data.name||'Chưa kết nối');
  const duration=seconds=>`${String(Math.floor(seconds/3600)).padStart(2,'0')}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(Math.floor(seconds)%60).padStart(2,'0')}`;
  const number=value=>value==null?'—':Number(value).toLocaleString('vi-VN');
  if(session.seconds!=null)put('#sessionTime',duration(session.seconds));
  put('#sessionKills',session.killSource==='server'?number(session.kills):'Chưa xác nhận');
  put('#sessionKillRate',session.killSource==='server'?number(session.killsPerHour):'—');
  put('#sessionXpRate',number(session.xpPerHour));put('#sessionStoneRate',number(session.stonesPerHour));
  put('#sessionSpent',number(session.stonesSpent));
  put('#sessionXpProgress',session.xpMax>0?`${number(session.xpCurrent)} / ${number(session.xpMax)}`:'—');
  put('#sessionXpEta',session.xpMax>0&&session.xpCurrent>=session.xpMax?'Đã đầy':session.fullXpSeconds==null?'—':duration(session.fullXpSeconds));
  const questRows=(data.objectives||[]);put('#sessionQuestProgress',`${questRows.filter(row=>/^[✓✔☑]/.test(row.trim())).length} / ${questRows.length}`);
  document.querySelector('#charHpBar').style.width=ratio(data.hp)+'%';document.querySelector('#charSpBar').style.width=ratio(data.sp)+'%';document.querySelector('#charArmorBar').style.width=ratio(data.armor)+'%';
  const objectives=Array.isArray(data.objectives)?data.objectives.filter(Boolean):[];put('#liveQuest',[data.questStage,...objectives].filter(Boolean).join(' · ')||'Không có nhiệm vụ đang hiển thị');
  renderQuest(data);if(isFresh){document.querySelector('#liveStatus').textContent='Đồng bộ thời thực';document.querySelector('#liveChip').classList.add('live')}
}
const companionOrigin=location.origin;
const companionUrl=new URL(location.href);companionUrl.searchParams.delete('mini');companionUrl.hash='';
const bookmarkCode='('+gameRuntimeHook.toString()+')('+JSON.stringify(companionUrl.href)+','+JSON.stringify(companionOrigin)+')';
const translatedBookmarkCode=bookmarkCode.replaceAll('Đã dừng auto','Đã thu công').replaceAll('Đã dừng vì nhân vật gục','Đã thu công vì nhân vật trọng thương').replaceAll('Không thể bật auto khi nhân vật đang gục','Không thể hành công khi nhân vật đang trọng thương').replaceAll('Đang làm quest và tìm điểm tương tác','Đang tự hành tiên vụ và tìm điểm tương tác').replaceAll('Đang farm quái và tuần tra','Đang tuần sát yêu thú').replaceAll('Đã kết nối điều khiển','Đã thiết lập liên kết điều khiển').replaceAll('Auto Quest hoặc Farm Quái','Tự Hành Tiên Vụ hoặc Tuần Sát Yêu Thú');
const bookmarkUrl='javascript:'+translatedBookmarkCode;
document.querySelector('#bookmarklet').href=bookmarkUrl;
document.querySelector('#copyBookmarklet').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(bookmarkUrl);toast('Đã sao chép · hãy tạo dấu trang mới và dán vào URL')}catch{toast('Hãy kéo linh phù lên thanh dấu trang')}});
document.querySelector('#bookmarklet').addEventListener('click',e=>{e.preventDefault();toast('Hãy kéo linh phù này lên thanh dấu trang')});
let gameWindow=null;
const commandButtons=['#startQuestAuto','#startFarmAuto','#stopGameAuto'].map(id=>document.querySelector(id));
document.querySelector('#startQuestAuto').textContent='▶ Auto Quest';document.querySelector('#startFarmAuto').textContent='⚔ Auto Farm';document.querySelector('#stopGameAuto').textContent='■ Dừng';
function setConnected(connected){document.body.classList.toggle('connected',connected);commandButtons.forEach(button=>button.disabled=!connected)}
function setActiveMode(nextMode){commandButtons.forEach(button=>button.classList.remove('mode-active'));if(nextMode==='quest')document.querySelector('#startQuestAuto').classList.add('mode-active');else if(nextMode==='farm')document.querySelector('#startFarmAuto').classList.add('mode-active')}
setConnected(false);
function getAutoConfig(){return {...state.autoRules,priority:state.priority,skillSlots:String(state.autoRules.skillSlots||'').split(',').map(Number).filter(x=>x>=1&&x<=8)}}
function sendGameCommand(command){if(!gameWindow||!lastLiveAt||Date.now()-lastLiveAt>LIVE_TIMEOUT_MS)return toast('Chưa liên kết · hãy bấm nút ✦ Trợ Thủ trong game');gameWindow.postMessage({type:'TIENLO_COMMAND_V1',command,config:getAutoConfig()},'https://tutien2d.online');if(command==='quest'||command==='farm')setActiveMode(command);else if(command==='stop')setActiveMode('off');addAutoEvent(command==='stop'?'Đã truyền lệnh Thu Công':command==='config'?'Đã đồng bộ cấu hình':command==='quest'?'Đã khai mở Tự Hành Tiên Vụ':'Đã khai mở Tuần Sát Yêu Thú')}
function pingGame(){
  const target=gameWindow&&!gameWindow.closed?gameWindow:window.opener;
  if(!target||target.closed)return;
  try{target.postMessage({type:'TIENLO_LINK_PING'},'https://tutien2d.online')}catch{}
}
document.querySelector('#startQuestAuto').addEventListener('click',()=>sendGameCommand('quest'));document.querySelector('#startFarmAuto').addEventListener('click',()=>sendGameCommand('farm'));document.querySelector('#stopGameAuto').addEventListener('click',()=>sendGameCommand('stop'));
document.querySelector('#returnGame').addEventListener('click',()=>{if(gameWindow&&!gameWindow.closed)gameWindow.focus();else toast('Tab trò chơi không còn mở')});
window.addEventListener('message',event=>{
  if(event.origin!=='https://tutien2d.online')return;
  if(event.data?.type==='TIENLO_QUEST_FAILURE'){queueFailure(event.data.payload);return}
  if(event.data?.type==='TIENLO_LIVE_V3'){
    void syncChoiceMemory(event.source);
  }
  if(event.data?.type==='TIENLO_AUTO_STATUS'){const message=event.data.message||'Trạng thái hành công đã biến đổi';document.querySelector('#autoLiveState').textContent=message;if(['quest','farm','off','safe'].includes(event.data.mode))setActiveMode(event.data.mode);if(event.data.mode==='ready')document.querySelector('#liveStatus').textContent='Đã bắt tay · chờ dữ liệu';if(event.data.mode==='error'){document.querySelector('#liveStatus').textContent='Hook gặp lỗi';document.querySelector('#liveChip').classList.remove('live')}addAutoEvent(message,event.data.mode==='error');return}
  if(!['TIENLO_LIVE_V1','TIENLO_LIVE_V2','TIENLO_LIVE_V3'].includes(event.data?.type)||!event.data.payload)return;
  gameWindow=event.source;
  const allowed=['source','hookVersion','name','realm','stones','hp','mp','sp','armor','hpPercent','spPercent','pos','x','y','fps','map','mapId','questId','questStage','questStageIndex','objectives','questPlan','questWatchdog','xpLabel','xpPercent','playerState','downed','autoOn','online','enemiesAlive','target','targetDistance','mode','session'];const clean={};allowed.forEach(key=>clean[key]=event.data.payload[key]);
  const reconnected=connectionLost;
  state.live=clean;lastLiveAt=Date.now();connectionLost=false;setConnected(true);setActiveMode(clean.mode);document.querySelector('#returnGame').hidden=false;persist();renderLive(clean,true);evaluateAuto(clean);
  if(reconnected){document.querySelector('#autoLiveState').textContent='Đã kết nối lại · '+(clean.mode==='quest'?'Auto Quest':clean.mode==='farm'?'Auto Farm':'đang theo dõi');addAutoEvent('Đã kết nối lại tab game')}
});
setInterval(()=>{
  pingGame();
  if(lastLiveAt&&Date.now()-lastLiveAt>LIVE_TIMEOUT_MS&&!connectionLost){
    connectionLost=true;setConnected(false);
    document.querySelector('#liveStatus').textContent='Đang kết nối lại tab game';
    document.querySelector('#liveChip').classList.remove('live');
    document.querySelector('#autoLiveState').textContent='Mất đồng bộ tạm thời · đang thử kết nối lại';
    addAutoEvent('Mất đồng bộ tab game — đang kết nối lại',true);
  }
},3000);
pingGame();
window.addEventListener('focus',pingGame);
window.addEventListener('pageshow',pingGame);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pingGame()});
document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav-btn,.view').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.querySelector('#'+btn.dataset.view).classList.add('active')}));
const timerEnds=[...document.querySelectorAll('.timer[data-seconds]')].map(el=>({el,end:Date.now()+Number(el.dataset.seconds)*1000}));
function tick(){timerEnds.forEach(({el,end})=>{const s=Math.max(0,Math.floor((end-Date.now())/1000));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60;el.textContent=s?`Hồi sau ${h?String(h).padStart(2,'0')+':':''}${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`:'Có thể xuất hiện'});const now=new Date();let target=new Date(now);target.setDate(now.getDate()+((6-now.getDay()+7)%7));target.setHours(21,0,0,0);if(target<=now)target.setDate(target.getDate()+7);const d=target-now,days=Math.floor(d/86400000),hours=Math.floor(d%86400000/3600000);document.querySelector('#saturdayTimer').textContent=`Còn ${days} ngày ${hours} giờ`}
setInterval(tick,1000);tick();
function calculate(){const b={atk:+document.querySelector('#atk').value||0,hp:+document.querySelector('#hp').value||0,sp:+document.querySelector('#sp').value||0,armor:+document.querySelector('#armor').value||0};state.build=b;persist();const score=Math.round(b.atk*42+b.hp*.55+b.sp*1.4+b.armor*.8);document.querySelector('#buildScore').textContent=score;let advice=b.atk<4?'Ưu tiên tìm một vũ khí cơ bản để tăng tốc độ hoàn thành nhiệm vụ.':b.armor+b.hp<40?'Sát thương đã ổn; bổ sung Giáp và Khí Huyết trước khi săn Boss.':'Build cân bằng cho hoạt động thường; tiếp theo có thể tích tài nguyên cho Bí Tịch.';document.querySelector('#buildAdvice').innerHTML='<strong>Nhận định:</strong> '+advice;toast('Đã tính và lưu build')}
Object.entries(state.build||defaults.build).forEach(([k,v])=>{const el=document.querySelector('#'+k);if(el)el.value=v});document.querySelector('#calcBuild').addEventListener('click',calculate);
document.querySelectorAll('.priority').forEach(btn=>{if(btn.textContent===state.priority){document.querySelectorAll('.priority').forEach(x=>x.classList.remove('active'));btn.classList.add('active')}btn.addEventListener('click',()=>{document.querySelectorAll('.priority').forEach(x=>x.classList.remove('active'));btn.classList.add('active');state.priority=btn.textContent;persist();const map={'Yêu Vương':'Chỉ nên chọn Yêu Vương khi đã lĩnh ngộ pháp thuật, trang bị hồi phục và chủ động săn tìm.','Yêu Thú':'Thích hợp nhất để hành nhiệm vụ và tăng tiến tu vi ở cảnh giới hiện tại.','Tu Sĩ':'Dành cho tỉ thí hoặc đấu pháp; không thích hợp khi đang hành nhiệm vụ.','Khí Huyết thấp':'Hữu dụng khi có nhiều mục tiêu và cần kết liễu nhanh từng yêu thú.','Tự động':'Duy trì thiết lập cân bằng; trò chơi sẽ chọn mục tiêu gần và thích hợp.'};document.querySelector('#autoAdvice').innerHTML=`<strong>${btn.textContent}:</strong> ${map[btn.textContent]}`});});
document.querySelectorAll('.switch').forEach(x=>x.addEventListener('click',()=>x.classList.toggle('on')));document.querySelector('#saveAuto').addEventListener('click',()=>{persist();sendGameCommand('config');toast('Đã lưu và đồng bộ phương án')});
const ruleMap={ruleHp:'hp',ruleSp:'sp',ruleQuest:'quest',ruleNearest:'nearest',ruleAvoidBoss:'avoidBoss',ruleStopHp:'stopLowHp',ruleMeditate:'meditate',ruleDisconnect:'disconnect',ruleAntiStuck:'antiStuck'};Object.entries(ruleMap).forEach(([id,key])=>{const el=document.querySelector('#'+id);el.classList.toggle('on',state.autoRules[key]);el.addEventListener('click',()=>{state.autoRules[key]=el.classList.contains('on');persist()})});
['hp','sp'].forEach(key=>{const el=document.querySelector('#'+key+'Threshold');el.value=state.autoRules[key+'Threshold'];el.addEventListener('change',()=>{state.autoRules[key+'Threshold']=Math.max(1,Math.min(99,+el.value||defaults.autoRules[key+'Threshold']));el.value=state.autoRules[key+'Threshold'];persist()})});
const maxDistance=document.querySelector('#maxTargetDistance');maxDistance.value=state.autoRules.maxDistance;maxDistance.addEventListener('input',()=>{const value=+maxDistance.value;if(Number.isFinite(value)&&value>0){state.autoRules.maxDistance=value;persist()}});maxDistance.addEventListener('change',()=>{state.autoRules.maxDistance=Math.max(60,Math.min(600,+maxDistance.value||defaults.autoRules.maxDistance));maxDistance.value=state.autoRules.maxDistance;persist()});
const skillSlots=document.querySelector('#skillSlots');skillSlots.value=state.autoRules.skillSlots;skillSlots.addEventListener('input',()=>{state.autoRules.skillSlots=skillSlots.value;persist()});skillSlots.addEventListener('change',()=>{const slots=skillSlots.value.split(',').map(x=>+x.trim()).filter(x=>x>=1&&x<=8);state.autoRules.skillSlots=(slots.length?slots:[1]).join(',');skillSlots.value=state.autoRules.skillSlots;persist()});
initSettings(()=>{if(gameWindow&&lastLiveAt&&Date.now()-lastLiveAt<LIVE_TIMEOUT_MS)sendGameCommand('config');});
calculate();renderLive(state.live);
if(document.modelContext?.registerTool){
  const schema={type:'object',properties:{},additionalProperties:false};
  document.modelContext.registerTool({name:'get_companion_state',title:'Xem trạng thái trợ thủ',description:'Đọc tiên vụ thời thực, ưu tiên hành công và pháp trang đang lưu trên thiết bị.',inputSchema:schema,annotations:{readOnlyHint:true,untrustedContentHint:false},execute(){return {live:state.live,priority:state.priority,build:state.build}}});
  document.modelContext.registerTool({name:'get_live_character',title:'Xem nhân vật realtime',description:'Đọc bản HUD nhân vật gần nhất được import bằng bookmarklet.',inputSchema:schema,annotations:{readOnlyHint:true,untrustedContentHint:true},execute(){return {connected:!!lastLiveAt&&Date.now()-lastLiveAt<LIVE_TIMEOUT_MS,character:state.live}}});
}
