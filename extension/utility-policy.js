(() => {
  function choosePlantAction(context) {
    const choices=[{id:'wait',score:50,reason:'Chờ cây, chưa có việc phù hợp'}];
    if(context.ready) choices.push({id:'harvest',score:800,reason:'Cây đã chín, quay lại thu hoạch'});
    if(context.dry) choices.push({id:'water',score:780,reason:'Tưới cây trước khi làm việc khác'});
    if(context.activeTask && context.activeTask !== 'tournament') choices.push({id:'active_task',
      score:context.taskComplete?850:550,reason:context.taskComplete?'Trả việc đã xong':'Tiếp tục việc đang nhận'});
    if(!context.activeTask && !context.ready && !context.dry && context.remaining>30 && context.needLinhThuy && context.hp>=65)
      choices.push({id:'hunt',score:650-context.threats*160,reason:'Săn Linh Thúy còn thiếu trong lúc cây lớn'});
    if(!context.activeTask && !context.ready && !context.dry && context.remaining>=120 && context.dailyAvailable)
      choices.push({id:'daily_task',score:420-context.threats*60,reason:'Nhận việc Dược Công khi còn đủ thời gian chờ'});
    choices.sort((a,b)=>b.score-a.score);
    return {selected:choices[0],choices};
  }
  window.__tienloUtility={choosePlantAction};
})();
