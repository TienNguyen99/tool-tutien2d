const notes=document.querySelector('#notes'),sync=document.querySelector('#sync');
let signature='',busy=false;
const element=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
async function refresh(){
  if(busy)return;busy=true;
  try{
    const response=await fetch('/api/game-updates',{cache:'no-store',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const payload=await response.json();
    const data=Array.isArray(payload)?{notes:payload}:payload;
    if(!Array.isArray(data.notes))throw new Error('Dữ liệu không hợp lệ');
    const next=JSON.stringify(data.notes);
    if(next!==signature){
      const fragment=document.createDocumentFragment();
      for(const row of data.notes){
        const article=element('article',''),badge=element('span','Thay đổi client được phát hiện');badge.className='status';
        article.append(badge,element('h2',`${row.version} · ${row.title}`));
        const list=element('ul','');for(const change of row.changes||[])list.append(element('li',change));article.append(list);
        const verified=element('p',row.verification||'Chưa ghi nhận kiểm chứng');verified.className='verification';article.append(verified);fragment.append(article);
      }
      if(!data.notes.length)fragment.append(element('p','Đã ghi nhận bản client hiện tại làm mốc. Chưa phát hiện thay đổi kể từ mốc này; chưa tìm thấy nguồn patch note chính thức của admin game.'));
      notes.replaceChildren(fragment);signature=next;
    }
    sync.textContent=`Kiểm tra game: ${data.checkedAt?new Date(data.checkedAt).toLocaleString('vi-VN'):'—'} · ${data.notes.length} lần thay đổi`;
  }catch(error){sync.textContent=`Mất đồng bộ · ${error.message} · đang giữ bản đã tải`;}finally{busy=false;}
}
document.querySelector('#refresh').addEventListener('click',refresh);
setInterval(refresh,5000);void refresh();
