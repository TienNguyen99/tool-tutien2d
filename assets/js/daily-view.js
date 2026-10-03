export function renderDailyActivities(root,data){
  root.replaceChildren();
  const title=document.createElement('h3');title.textContent='Việc hôm nay'+(data?.date?' · '+data.date:'');root.append(title);
  const note=document.createElement('p');
  note.textContent=data?.tasks?`Dược Công hiện có: ${data.duocCong??'—'} · Còn ${data.tasks.reduce((sum,row)=>sum+row.remaining,0)} lượt`:'Chờ dữ liệu hoạt động hôm nay từ extension mới.';root.append(note);
  for(const row of data?.tasks||[]){
    const item=document.createElement('p');
    item.textContent=`${row.remaining===0?'✓':'○'} ${row.name} · còn ${row.remaining}/${row.limit} lượt`+
      (row.active?(row.complete?' · đã đủ, về Đại Phu giao việc':' · đang làm'):'')+
      (row.kind==='tournament'&&row.remaining>0?' · cần tham gia Đại Hội và thắng trận':'');root.append(item);
  }
  if(data?.monsterStones){const item=document.createElement('p');item.textContent=`Linh Thạch từ quái hôm nay: ${data.monsterStones.earned}/${data.monsterStones.limit} · farm thêm nếu muốn`;root.append(item);}
  const advice=document.createElement('p');advice.textContent='Nhiệm vụ chính: tiếp tục mục tiêu hiện tại sau các lượt Dược Công. Hoạt động chưa có dữ liệu lượt cần kiểm tra trong game.';root.append(advice);
}
