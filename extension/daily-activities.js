(() => {
  window.__tienloDailyActivities=P=>{
    const Q=P.Quest||{},active=Q.seedTaskInfo?.();
    const tasks=Q.seedTaskList?.().map(row=>({id:row.def.id,name:row.def.shortName||row.def.name,
      kind:row.def.kind,remaining:row.runsLeft,done:row.runsToday,limit:row.dailyLimit,
      active:active?.id===row.def.id,complete:active?.id===row.def.id&&!!Q.seedQuestComplete?.()}))||null;
    const wallet=document.querySelector('#hud-wallet')?.getAttribute('aria-label')||'';
    const quota=wallet.match(/Hôm nay từ quái:\s*(\d+)\s*\/\s*(\d+)/i);
    return {date:Q.today?.()||null,updatedAt:Date.now(),tasks,duocCong:P.Progress?.duocCong??null,
      monsterStones:quota?{earned:Number(quota[1]),limit:Number(quota[2])}:null,
      backgroundEnabled:!!window.__tienloBackgroundRun?.enabled};
  };
})();
