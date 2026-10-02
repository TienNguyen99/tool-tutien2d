// Public client data only. Downloaded JavaScript is never executed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../data/crawl');
function literal(source, start) {
  let i=start;
  const ws=()=>{while(/\s/.test(source[i]||'')&&i<source.length)i++;};
  function string() {
    const quote=source[i++];let value='';
    while(i<source.length){const c=source[i++];if(c===quote)return value;
      if(c==='\\'){const next=source[i++];value+=({n:'\n',r:'\r',t:'\t'})[next]??next;}else value+=c;}
    throw Error('Unclosed string');
  }
  function read() {
    ws();const c=source[i];
    if(c==='"'||c==="'")return string();
    if(c==='{'||c==='['){const object=c==='{',end=object?'}':']',result=object?{}:[];i++;ws();
      while(source[i]!==end){
        if(object){ws();const quoted=/["']/.test(source[i]);const key=quoted?string():source.slice(i).match(/^[\w$]+/)?.[0];
          if(key==null)throw Error('Unsupported key');if(!quoted)i+=key.length;
          ws();if(source[i++]!==':')throw Error('Unsupported property');result[key]=read();
        }else result.push(read());
        ws();if(source[i]===','){i++;ws();}else if(source[i]!==end)throw Error('Unsupported expression');
      }i++;return result;
    }
    const token=source.slice(i).match(/^(?:!\s*[01]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|true|false|null|[A-Za-z_$][\w$]*)/i)?.[0];
    if(!token)throw Error('Unsupported value');i+=token.length;
    ws();
    if(![',','}',']',undefined].includes(source[i])) {
      let depth=0;
      while(i<source.length) {
        const c=source[i];
        if((c===','||c==='}'||c===']')&&depth===0)break;
        if(c==='"'||c==="'"){string();continue;}
        if('([{'.includes(c))depth++;
        if(')]}'.includes(c))depth--;
        i++;
      }
      return null; // Dynamic expression retained in source archive, never executed.
    }
    if(/^!/.test(token))return token.replace(/\s/g,'')==='!0';
    if(token==='true'||token==='false')return token==='true';
    if(token==='null')return null;
    return Number.isFinite(Number(token))?Number(token):null; // Symbolic value: unresolved, never eval.
  }
  return read();
}
async function main(){
  fs.mkdirSync(path.join(root,'sources'),{recursive:true});
  const base='https://tutien2d.online/';
  async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`${r.status} ${url}`);return r.text();}
  const html=await get(base+'?choi');
  const urls=[...html.matchAll(/src="([^" ]+\.js[^" ]*)"/g)].map(m=>m[1])
    .filter(url=>/^src\/(systems|world|entities)\/|^src\/core\/config\.js|^src\/ui\/encyclopedia\.js/.test(url));
  const manifest=[],maps=new Map(),unresolved=[];
  for(const relative of urls){
    try{
      const source=await get(new URL(relative,base));
      const filename=relative.split('?')[0].replaceAll('/','__');
      fs.writeFileSync(path.join(root,'sources',filename),source);
      manifest.push({url:new URL(relative,base).href,file:filename,bytes:Buffer.byteLength(source),sha256:crypto.createHash('sha256').update(source).digest('hex')});
      for(const match of source.matchAll(/\{id:["']([^"']+)["']/g)){
        try{const data=literal(source,match.index);if(data.width&&data.height&&Array.isArray(data.portals))maps.set(data.id,data);}
        catch{if(/\/map/.test(relative))unresolved.push({source:filename,id:match[1],reason:'Dynamic expression requires dedicated static extraction'});}
      }
      console.log(`Downloaded ${relative}`);
    }catch(error){manifest.push({url:relative,error:error.message});}
  }
  const result={crawledAt:new Date().toISOString(),scope:'Public client modules, not private server data',
    sources:manifest,maps:[...maps.values()],unresolved};
  fs.writeFileSync(path.join(root,'catalog.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({sources:manifest.length,maps:maps.size,unresolved:unresolved.length,output:path.join(root,'catalog.json')}));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={literal};
