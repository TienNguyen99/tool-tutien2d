const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'../data/game-updates.json');
let state;
try{state=JSON.parse(fs.readFileSync(file,'utf8'));}catch{state={scripts:{},notes:[]};}
let lastCheck=0,pending;
async function check(){
  if(pending)return pending;
  if(Date.now()-lastCheck<60000)return {...state,source:'https://tutien2d.online/?choi'};
  pending=(async()=>{
    const response=await fetch('https://tutien2d.online/?choi',{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error(`Game HTTP ${response.status}`);
    const html=await response.text(),scripts={};
    for(const match of html.matchAll(/src="(src\/[^" ]+\.js\?v=([^" ]+))"/g))scripts[match[1].split('?')[0]]=match[2];
    if(!Object.keys(scripts).length)throw Error('Không đọc được phiên bản module game');
    const changes=[];
    for(const [name,hash] of Object.entries(scripts))if(state.scripts[name]&&state.scripts[name]!==hash)
      changes.push(`${name}: ${state.scripts[name]} → ${hash}`);
    for(const name of Object.keys(scripts))if(Object.keys(state.scripts).length&&!state.scripts[name])changes.push(`Module mới: ${name}`);
    for(const name of Object.keys(state.scripts))if(!scripts[name])changes.push(`Module không còn được khai báo: ${name}`);
    if(changes.length)state.notes.unshift({version:new Date().toISOString(),title:'Phát hiện thay đổi bản client game',changes,
      status:'detected',verification:'So sánh mã phiên bản module trên website chính thức. Đây không phải nội dung patch note do admin game công bố.'});
    state.scripts=scripts;state.checkedAt=new Date().toISOString();state.notes=state.notes.slice(0,100);
    fs.writeFileSync(file,JSON.stringify(state,null,2));lastCheck=Date.now();
    return {...state,source:'https://tutien2d.online/?choi'};
  })();
  try{return await pending;}finally{pending=null;}
}
module.exports={check};
