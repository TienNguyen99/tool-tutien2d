const fs=require('node:fs'),path=require('node:path');
const {literal}=require('./crawl-game.cjs');
function catalog(source){
  const rows=new Map();
  for(const match of source.matchAll(/\{name:["']Giai đoạn \d+[^"']*["']/g)){
    try{const data=literal(source,match.index),stage=Number(data.name.match(/Giai đoạn (\d+)/)[1]);
      rows.set(stage,{stage,title:data.name,hint:data.hint||''});}catch{}
  }
  return [...rows.values()].sort((a,b)=>a.stage-b.stage);
}
function stageOf(row){
  const direct=row.quest?.stage;
  if(Number.isInteger(direct))return direct;
  try{const key=JSON.parse(row.key);return Number.isInteger(key[1])?key[1]:null}catch{return null}
}
function aggregate(quests,logs,character=''){
  const relevant=logs.filter(r=>!character||(r.character||'Không rõ nhân vật')===character);
  return quests.map(q=>{
    const events=relevant.filter(r=>stageOf(r)===q.stage);
    const observed=events.filter(r=>r.reason==='quest_observed').at(-1);
    const failures=events.filter(r=>r.outcome==='fail');
    return {...q,observed,failCount:failures.length,lastFailure:failures.at(-1),events:events.slice(-20)};
  });
}
module.exports={catalog,stageOf,aggregate};
module.exports.handler=function({root,logDir,failureFile,port}){
  const fixesFile=path.join(logDir,'quest-fixes.json');
  return (request,response)=>{
    const reply=(code,data)=>response.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(data));
    try{
      const fixes=fs.existsSync(fixesFile)?JSON.parse(fs.readFileSync(fixesFile,'utf8')):{};
      const sourceFile=path.join(root,'data/crawl/sources/src__systems__quest.js');
      const quests=fs.existsSync(sourceFile)?catalog(fs.readFileSync(sourceFile,'utf8')):[];
      if(request.method==='GET'){
        const logs=fs.existsSync(failureFile)?fs.readFileSync(failureFile,'utf8').split('\n').flatMap(line=>{try{return [JSON.parse(line)]}catch{return []}}):[];
        const character=new URL(request.url,'http://localhost').searchParams.get('character')||'';
        for(const row of logs){const stage=stageOf(row);if(stage!=null&&!quests.some(q=>q.stage===stage))
          quests.push({stage,title:row.quest?.title||`Giai đoạn ${stage} · mới quan sát`,hint:'Chưa trích xuất mô tả từ nguồn crawl'});}
        quests.sort((a,b)=>a.stage-b.stage);
        const stat=fs.existsSync(sourceFile)?fs.statSync(sourceFile):null;
        return reply(200,{quests:aggregate(quests,logs,character),fixes,
          characters:[...new Set(logs.filter(r=>stageOf(r)!=null).map(r=>r.character||'Không rõ nhân vật'))],
          sourceUpdatedAt:stat?.mtime.toISOString()||null,
          note:'Danh sách từ bản client đã crawl; chưa khẳng định bao gồm quest mới hoặc quest phụ. Đã quan sát/choice thành công không đồng nghĩa hoàn thành quest.'});
      }
      if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
      if(request.headers.origin!==`http://127.0.0.1:${port}`)return reply(403,{error:'Dashboard only'});
      let body='';request.on('data',chunk=>{body+=chunk;if(Buffer.byteLength(body)>4096)request.destroy();});
      request.on('end',()=>{try{
        const input=JSON.parse(body);
        if(!quests.some(q=>q.stage===input.stage)||!['todo','fixed','verified'].includes(input.status))throw Error('Invalid fix');
        const latest=fs.existsSync(fixesFile)?JSON.parse(fs.readFileSync(fixesFile,'utf8')):{};
        latest[input.stage]={status:input.status,note:String(input.note||'').slice(0,1000),at:new Date().toISOString()};
        fs.writeFileSync(fixesFile,JSON.stringify(latest,null,2));reply(200,{saved:true});
      }catch{reply(400,{error:'Invalid fix or save failed'});}});
    }catch{reply(500,{error:'Quest data unavailable'});}
  };
};
