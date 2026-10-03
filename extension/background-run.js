(() => {
  const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
  const pending=new Map();let sequence=0,timer=null,enabled=false;
  function schedule(){
    if(timer!==null||!enabled||!document.hidden||!pending.size)return;
    timer=setTimeout(()=>{timer=null;
      if(enabled&&document.hidden){
        const frame=[...pending.entries()];
        for(const [id,row] of frame){if(!pending.delete(id))continue;cancel(row.native);row.callback(performance.now());}
      }
      schedule();
    },100);
  }
  window.requestAnimationFrame=callback=>{
    const id=--sequence,row={callback,native:null};pending.set(id,row);
    row.native=request(time=>{if(!pending.delete(id))return;callback(time);schedule();});
    schedule();return id;
  };
  window.cancelAnimationFrame=id=>{const row=pending.get(id);if(row){pending.delete(id);cancel(row.native);}else cancel(id);};
  window.__tienloBackgroundRun={set(value){enabled=!!value;
    if(!enabled&&timer!==null){clearTimeout(timer);timer=null;}schedule();return enabled;},
    get enabled(){return enabled;}};
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&timer!==null){clearTimeout(timer);timer=null;}schedule();
  });
})();
