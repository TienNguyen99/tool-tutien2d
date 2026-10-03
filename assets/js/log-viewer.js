export function initLogViewer(root) {
  const rows=[];
  let paused=false;
  const toolbar=document.createElement('div');toolbar.className='log-toolbar';
  toolbar.innerHTML='<div class="log-heading"><strong>Nhật ký hoạt động</strong><span id="logCount">0 sự kiện</span></div><div class="log-filters"><input type="search" aria-label="Tìm trong nhật ký" placeholder="Tìm nội dung log…"><select aria-label="Lọc nhật ký"><option value="all">Tất cả</option><option value="warn">Cảnh báo / lỗi</option><option value="utility">Utility AI</option><option value="combat">Chiến đấu / hồi phục</option></select></div><div class="log-actions"><button type="button" class="btn ghost" data-action="pause">Tạm dừng hiển thị</button><button type="button" class="btn ghost" data-action="copy">Sao chép</button><button type="button" class="btn ghost" data-action="clear">Xóa hiển thị</button></div>';
  root.before(toolbar);
  const search=toolbar.querySelector('input'),filter=toolbar.querySelector('select');
  const count=toolbar.querySelector('#logCount'),pause=toolbar.querySelector('[data-action=pause]');
  root.setAttribute('role','log');root.setAttribute('aria-label','Nhật ký hoạt động');
  function visibleRows(){
    const query=search.value.toLocaleLowerCase('vi');
    return rows.filter(row=>row.message.toLocaleLowerCase('vi').includes(query) &&
      (filter.value==='all' || filter.value==='warn'&&row.warn ||
       filter.value==='utility'&&/UTILITY/i.test(row.message) ||
       filter.value==='combat'&&/RÚT LUI|TỰ VỆ|HỒI|THIỀN|NÉ|ĐÁNH|TRỌNG THƯƠNG/i.test(row.message)));
  }
  function render(){
    if(paused){count.textContent=`${rows.length} sự kiện · đang tạm dừng`;return;}
    const visible=visibleRows(),fragment=document.createDocumentFragment();
    for(const row of visible){
      const el=document.createElement('div');el.className='auto-event'+(row.warn?' warn':'');
      const time=document.createElement('time');time.dateTime=row.at;time.textContent=row.time;
      const text=document.createElement('span');text.textContent=row.message;
      el.append(time,text);fragment.append(el);
    }
    if(!visible.length){const empty=document.createElement('p');empty.className='log-empty';empty.textContent=rows.length?'Không có log khớp bộ lọc.':'Chờ sự kiện từ game…';fragment.append(empty);}
    root.replaceChildren(fragment);count.textContent=`${visible.length} / ${rows.length} sự kiện`;
  }
  search.addEventListener('input',render);filter.addEventListener('change',render);
  pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'Tiếp tục hiển thị':'Tạm dừng hiển thị';pause.setAttribute('aria-pressed',String(paused));render();});
  toolbar.querySelector('[data-action=clear]').addEventListener('click',()=>{rows.length=0;paused=false;pause.textContent='Tạm dừng hiển thị';pause.setAttribute('aria-pressed','false');render();});
  toolbar.querySelector('[data-action=copy]').addEventListener('click',async event=>{
    const button=event.currentTarget;
    try{await navigator.clipboard.writeText(visibleRows().map(row=>`${row.at} · ${row.message}`).join('\n'));button.textContent='Đã sao chép';}
    catch{button.textContent='Không sao chép được';}
    setTimeout(()=>{button.textContent='Sao chép';},1800);
  });
  render();
  return (message,warn=false)=>{
    const date=new Date();rows.unshift({message:String(message),warn:warn||/FAIL|WATCHDOG|LỖI|KHÔNG CÓ ĐƯỜNG|MẤT ĐỒNG BỘ|TRỌNG THƯƠNG/i.test(message),
      at:date.toISOString(),time:date.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})});
    if(rows.length>500)rows.length=500;render();
  };
}
