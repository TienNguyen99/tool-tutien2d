(() => {
  const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
  function observe(button,plan){
    const slot=button.matches('.forge-slot'),title=button.title||button.getAttribute('aria-label')||'';
    const name=slot?title:button.closest('.bag-detail-card')?.querySelector('h3')?.textContent||'';
    const label=button.textContent.trim();
    return {action:slot?'open_recipe':/^luyen$/.test(fold(label))?'craft_item':'select_option',
      name,label:slot?`Xem đan ${title}`:name&&/^luyen$/.test(fold(label))?`Luyện ${name}`:label,
      itemId:plan?.craftItemId||'',expectedName:plan?.autoChoice||''};
  }
  function snapshot(P,document,itemId){
    const detail=document.querySelector('#dialog .forge-detail');
    const visible=detail&&detail.getClientRects().length;
    return {detailName:visible?(detail.querySelector('h3')?.textContent||''): '',
      count:itemId&&P.Inventory?.count?Number(P.Inventory.count(itemId)):null};
  }
  function evaluate(step,before,after){
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
  function attempt(context,label){
    const key=JSON.stringify([context,label]),count=attempts.get(key)||0;
    if(count>=4)return false;
    attempts.set(key,count+1);
    if(attempts.size>500)attempts.delete(attempts.keys().next().value);
    return true;
  }
  window.__tienloWorkflow={observe,snapshot,evaluate,record,canExecute,attempt};
})();
