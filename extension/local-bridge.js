window.addEventListener('message',async event=>{
  if(event.source!==window||event.origin!==location.origin||event.data?.type!=='TIENLO_LOCAL_REQUEST')return;
  const {id,operation,payload}=event.data;
  if(!['heartbeat','login','record','memory','plan','planVision'].includes(operation)||typeof id!=='string')return;
  try{const result=await chrome.runtime.sendMessage({type:'TIENLO_LOCAL_REQUEST',operation,payload});
    window.postMessage({type:'TIENLO_LOCAL_RESPONSE',id,...result},location.origin);
  }catch(error){window.postMessage({type:'TIENLO_LOCAL_RESPONSE',id,ok:false,error:error.message},location.origin);}
});
