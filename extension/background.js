importScripts('vision-capture.js');
chrome.action.onClicked.addListener(()=>{}); // User click grants activeTab for the game tab.
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!sender.tab?.url?.startsWith('https://tutien2d.online/')||message?.type!=='TIENLO_LOCAL_REQUEST')return;
  const routes={heartbeat:'/api/clones/heartbeat',login:'/api/clones/login-ticket',record:'/api/quest-failures',memory:'/api/choice-memory',plan:'/api/ai/plan',planVision:'/api/ai/plan'};
  const route=routes[message.operation];if(!route)return;
  Promise.resolve().then(async()=>{
    const payload={...message.payload};
    delete payload.image;
    if(message.operation==='planVision')payload.image=await captureDialog(sender,payload.region);
    delete payload.region;
    return fetch(`http://127.0.0.1:8765${route}`,{method:message.operation==='memory'?'GET':'POST',headers:{'Content-Type':'application/json'},
      body:message.operation==='memory'?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(5000)});
  })
    .then(async response=>{if(!response.ok)throw Error(`HTTP ${response.status}`);reply({ok:true,data:await response.json()});})
    .catch(error=>reply({ok:false,error:error.message}));
  return true;
});
