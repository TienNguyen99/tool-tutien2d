window.__tienloLocalRequest=(operation,payload)=>new Promise((resolve,reject)=>{
  const id=crypto.randomUUID();
  const handler=event=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.type!=='TIENLO_LOCAL_RESPONSE'||event.data.id!==id)return;
    clearTimeout(timer);window.removeEventListener('message',handler);
    event.data.ok?resolve(event.data.data):reject(Error(event.data.error||'Local server error'));
  };
  const timer=setTimeout(()=>{window.removeEventListener('message',handler);reject(Error('Extension bridge timeout'));},7000);
  window.addEventListener('message',handler);window.postMessage({type:'TIENLO_LOCAL_REQUEST',id,operation,payload},location.origin);
});
