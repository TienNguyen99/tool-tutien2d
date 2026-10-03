import { buildQuestPrompt } from './quest-prompt.js';
const $=selector=>document.querySelector(selector);
let data=null,busy=false;
const node=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
function render(){
  const root=$('#quests');root.replaceChildren();
  const rows=data.quests.filter(q=>!$('#onlyFail').checked||q.failCount);
  $('#scope').textContent=`${data.note} · Nguồn: ${data.sourceUpdatedAt?new Date(data.sourceUpdatedAt).toLocaleString('vi-VN'): 'chưa crawl'}`;
  $('#summary').textContent=`${data.quests.length} giai đoạn · ${data.quests.filter(q=>q.failCount).length} có fail · đang hiển thị ${rows.length}`;
  if(!rows.length)root.append(node('p','Chưa có dữ liệu phù hợp. Không có fail không có nghĩa quest đã chạy tốt.'));
  for(const q of rows){
    const article=node('article','',q.failCount?'failed':'');
    const header=node('div','','quest-head');header.append(node('h2',q.title),node('span',q.failCount?`${q.failCount} fail`:q.observed?'Đã quan sát':'Chưa có log','badge'));article.append(header,node('p',q.hint,'hint'));
    if(q.observed)article.append(node('p',`Lần quan sát: ${q.observed.character||'Không rõ'} · ${new Date(q.observed.at).toLocaleString('vi-VN')} · ${(q.observed.quest?.objectives||[]).join(' / ')}`));
    if(q.lastFailure)article.append(node('p',`Fail gần nhất: ${q.lastFailure.analysis||q.lastFailure.failureReason||q.lastFailure.reason} · ${q.lastFailure.stalledSeconds||q.lastFailure.waitedMs/1000||0}s`,'failure'));
    const fix=data.fixes[q.stage]||{},label=node('label','Trạng thái sửa lỗi: '),select=node('select','');
    for(const [value,text]of [['todo','Cần kiểm tra/sửa'],['fixed','Đã sửa · chưa test game'],['verified','Đã kiểm chứng trong game']]){const option=node('option',text);option.value=value;select.append(option);}select.value=fix.status||'todo';label.append(select);
    const note=node('textarea','');note.value=fix.note||'';note.placeholder='Nguyên nhân / cách sửa / phiên bản / kết quả test';note.setAttribute('aria-label',`Ghi chú giai đoạn ${q.stage}`);
    const save=node('button','Lưu trạng thái fix');save.onclick=async()=>{save.disabled=true;try{const response=await fetch('/api/quest-line',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stage:q.stage,status:select.value,note:note.value})});if(!response.ok)throw Error();$('#sync').textContent='Đã lưu trạng thái fix trên server';}catch{$('#sync').textContent='Không lưu được trạng thái fix';}finally{save.disabled=false;}};
    article.append(label,note,save);
    const promptButton=node('button','Tạo prompt phân tích & sửa lỗi');
    const promptBox=node('textarea','');promptBox.hidden=true;promptBox.readOnly=true;promptBox.rows=12;promptBox.setAttribute('aria-label',`Prompt sửa lỗi giai đoạn ${q.stage}`);
    const copyPrompt=node('button','Sao chép prompt');copyPrompt.hidden=true;
    promptButton.onclick=()=>{promptBox.value=buildQuestPrompt(q,{status:select.value,note:note.value});promptBox.hidden=false;copyPrompt.hidden=false;promptBox.focus();$('#sync').textContent='Prompt đã tạo từ log hiện tại. Sao chép và gửi vào cuộc trò chuyện để phân tích, sửa lỗi.';};
    copyPrompt.onclick=async()=>{try{await navigator.clipboard.writeText(promptBox.value);$('#sync').textContent='Đã sao chép prompt — dán vào cuộc trò chuyện này.';}catch{promptBox.focus();promptBox.select();$('#sync').textContent='Không truy cập được clipboard. Nhấn Ctrl+C để sao chép prompt đã chọn.';}};
    article.append(promptButton,promptBox,copyPrompt);
    const details=node('details','');details.append(node('summary',`Log gần nhất (${q.events.length})`),node('pre',JSON.stringify(q.events,null,2)));article.append(details);root.append(article);
  }
}
async function refresh(){
  if(busy)return;busy=true;
  try{const response=await fetch(`/api/quest-line?character=${encodeURIComponent($('#character').value)}`,{signal:AbortSignal.timeout(4000)});if(!response.ok)throw Error(`HTTP ${response.status}`);data=await response.json();
    const selected=$('#character').value;$('#character').replaceChildren();const all=node('option','Tất cả');all.value='';$('#character').append(all);for(const name of data.characters){const option=node('option',name);option.value=name;$('#character').append(option);}$('#character').value=selected;
    render();$('#sync').textContent=`Đồng bộ ${new Date().toLocaleTimeString('vi-VN')}`;
  }catch(error){$('#sync').textContent=`Không đồng bộ: ${error.message} · cần restart server mới`;}finally{busy=false;}
}
$('#refresh').onclick=refresh;$('#character').onchange=refresh;$('#onlyFail').onchange=()=>data&&render();
setInterval(()=>{if(!document.activeElement?.matches('textarea,select,button'))void refresh();},5000);void refresh();
