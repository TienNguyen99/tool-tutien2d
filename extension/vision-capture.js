// Runs only in the extension service worker. Never returns image data to the game page.
async function captureDialog(sender,region) {
  const tab=sender.tab;
  if(!tab || new URL(tab.url).origin!=='https://tutien2d.online')throw Error('Game tab required');
  const active=await chrome.tabs.query({active:true,windowId:tab.windowId});
  if(active[0]?.id!==tab.id)throw Error('Hãy đưa tab game cần phân tích ra trước');
  if(!region || !['x','y','width','height','viewportWidth','viewportHeight'].every(k=>Number.isFinite(region[k])) ||
    region.width<=0||region.height<=0||region.viewportWidth<=0||region.viewportHeight<=0||
    region.x<0||region.y<0||region.x+region.width>region.viewportWidth+1||region.y+region.height>region.viewportHeight+1)
    throw Error('Invalid dialog crop');
  const url=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'jpeg',quality:80});
  if((await chrome.tabs.query({active:true,windowId:tab.windowId}))[0]?.id!==tab.id)throw Error('Tab changed; image discarded');
  const bitmap=await createImageBitmap(await (await fetch(url)).blob());
  const sx=bitmap.width/region.viewportWidth,sy=bitmap.height/region.viewportHeight;
  const scale=Math.min(1,1200/(region.width*sx),800/(region.height*sy));
  const canvas=new OffscreenCanvas(Math.max(1,Math.round(region.width*sx*scale)),Math.max(1,Math.round(region.height*sy*scale)));
  canvas.getContext('2d').drawImage(bitmap,region.x*sx,region.y*sy,region.width*sx,region.height*sy,0,0,canvas.width,canvas.height);
  bitmap.close();
  const bytes=new Uint8Array(await (await canvas.convertToBlob({type:'image/jpeg',quality:.8})).arrayBuffer());
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
