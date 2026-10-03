(() => {
  const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
  function observe(button,plan){
    const slot=button.matches('.forge-slot'),title=button.title||button.getAttribute('aria-label')||'';
    const name=slot?title:button.closest('.bag-detail-card')?.querySelector('h3')?.textContent||'';
    const label=button.textContent.trim();
    if(/^tu dong cau|^tha cau/.test(fold(label)))return {action:'start_fishing',label,itemId:''};
    if(plan?.gardenStage8||plan?.gardenWorkflow){
      const normalized=fold(label);
      const action=/^muc nuoc/.test(normalized)?'garden_scoop':/^gieo hat /.test(normalized)?'garden_plant':/^tuoi/.test(normalized)?'garden_water':/^thu hoach/.test(normalized)?'garden_harvest':'select_option';
      const crop=/linh diep/.test(normalized)?'linh_diep':/huyet thao/.test(normalized)?'huyet_thao':'';
      return {action,label,itemId:crop,plotId:plan.ids?.find(id=>/^plot_/.test(id))||'',expectedName:plan.autoChoice||''};
    }
    if(plan?.dailyTask){
      const normalized=fold(label),expectedName=plan.dailyTask.shortName||plan.dailyTask.name;
      const action=/^(nhan viec duoc cong|xem so viec duoc cong)/.test(normalized)?'daily_open_menu':
        /^nhan viec nay/.test(normalized)?'daily_accept':
        expectedName&&normalized.startsWith(fold(expectedName))?'daily_open_task':'select_option';
      return {action,label,expectedName,itemId:plan.dailyTask.id||''};
    }
    return {action:slot?'open_recipe':/^luyen$/.test(fold(label))?'craft_item':'select_option',
      name,label:slot?`Xem đan ${title}`:name&&/^luyen$/.test(fold(label))?`Luyện ${name}`:label,
      itemId:plan?.craftItemId||'',expectedName:plan?.autoChoice||''};
  }
  function snapshot(P,document,itemId){
    const detail=document.querySelector('#dialog .forge-detail');
    const visible=detail&&detail.getClientRects().length;
    const dialog=document.querySelector('#dialog');
    return {dialog:dialog?.getClientRects().length?dialog.textContent||'':'',
      labels:dialog?.getClientRects().length?[...dialog.querySelectorAll('button')].filter(b=>!b.disabled&&b.getClientRects().length).map(b=>b.textContent.trim()):[],
      activeTask:P.Quest?.seedTaskInfo?.()?.id||'',
      fishing:!!P.SceneWorld?.fishing,
      waterAccess:!!P.Farm?.hasWaterAccess?.(),
      plots:JSON.parse(JSON.stringify(P.Farm?.state||{})),
      detailName:visible?(detail.querySelector('h3')?.textContent||''): '',
      count:itemId&&P.Inventory?.count?Number(P.Inventory.count(itemId)):null};
  }
  function evaluate(step,before,after){
    if(step.action==='start_fishing')return !before.fishing&&after.fishing?'success':'pending';
    if(step.action==='garden_scoop')return !before.waterAccess&&after.waterAccess?'success':'pending';
    if(step.action==='garden_plant')return Object.entries(after.plots||{}).some(([id,row])=>
      !before.plots?.[id]&&(!step.itemId||row.seed==='hat_'+step.itemId))?'success':'pending';
    if(step.action==='garden_water')return Object.entries(after.plots||{}).some(([id,row])=>
      before.plots?.[id]&&!before.plots[id].wet&&row.wet)?'success':'pending';
    if(step.action==='garden_harvest')return Object.keys(before.plots||{}).some(id=>!after.plots?.[id])?'success':'pending';
    if(step.action==='daily_open_menu')return after.labels?.some(label=>fold(label).startsWith(fold(step.expectedName)))?'success':'pending';
    if(step.action==='daily_open_task')return fold(after.dialog).includes(fold(step.expectedName))&&after.labels?.some(label=>/^nhan viec nay/.test(fold(label)))?'success':'pending';
    if(step.action==='daily_accept')return after.activeTask&&after.activeTask===step.itemId&&after.activeTask!==before.activeTask?'success':'pending';
    if(step.action==='open_recipe')return after.detailName&&fold(after.detailName).includes(fold(step.name||step.expectedName))?'success':'pending';
    if(step.action==='craft_item'&&step.itemId)return Number.isFinite(before.count)&&Number.isFinite(after.count)&&after.count>before.count?'success':'pending';
    return 'pending';
  }
  const chains=new Map();
  function record(key,step,outcome){
    const chain=chains.get(key)||[];
    chain.push({action:step.action,name:step.name,outcome});
    if(chains.size>100)chains.delete(chains.keys().next().value);
    chains.set(key,chain.slice(-10));
    return chain.slice(-10);
  }
  function canExecute(step){
    return step.action!=='craft_item'||!!step.name&&!!step.expectedName&&fold(step.name).includes(fold(step.expectedName));
  }
  const attempts=new Map();
  function success(context,label){attempts.delete(JSON.stringify([context,label]));}
  function dailyState(Q){
    try{return JSON.stringify([Q?.seedTaskInfo?.()?.id||'',Q?.seedTaskList?.().map(row=>[row.def.id,row.runsLeft])||[]]);}
    catch{return '';}
  }
  function attempt(context,label){
    const key=JSON.stringify([context,label]),count=attempts.get(key)||0;
    if(count>=4)return false;
    attempts.set(key,count+1);
    if(attempts.size>500)attempts.delete(attempts.keys().next().value);
    return true;
  }
  window.__tienloWorkflow={observe,snapshot,evaluate,record,canExecute,attempt,success,dailyState};
})();
