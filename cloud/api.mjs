const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const fold=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
const stageOf=row=>Number.isInteger(row.quest?.stage)?row.quest.stage:(()=>{try{const key=JSON.parse(row.key);return key[0]==='daily-v3'?key[3]:key[1];}catch{return null;}})();
async function body(request){
  if(Number(request.headers.get('content-length'))>65536)throw Error('Payload too large');
  const text=await request.text();if(new TextEncoder().encode(text).length>65536)throw Error('Payload too large');return JSON.parse(text);
}
async function owner(request){
  const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if(!token)return null;
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))].map(value=>value.toString(16).padStart(2,'0')).join('');
}
async function rows(DB,tenant){
  const result=await DB.prepare('SELECT payload FROM events WHERE tenant = ? ORDER BY created_at DESC LIMIT 2000').bind(tenant).all();
  return (result.results||[]).reverse().flatMap(row=>{try{return [JSON.parse(row.payload)];}catch{return [];}});
}
export function createApi({maps=[],quests=[],notes=[],version='1.3.67',accessKeyHash,signingSecret,adminOnlyQuestLine=false,adminKeyHash}={}){
  const attempts=new Map();
  const hex=bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
  const digest=async value=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
  const sign=async value=>{const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(signingSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value))).slice(0,32);};
  const valid=async token=>/^[a-f0-9]{64}$/.test(token||'')&&parseInt(token.slice(0,8),16)>Date.now()/1000&&await sign(token.slice(0,32))===token.slice(32);
  return async function handle(request,env){
    const url=new URL(request.url),path=url.pathname;
    if(path==='/api/admin/auth'){
      if(request.method!=='POST')return json({error:'Method not allowed'},405);
      if(!adminKeyHash)return json({error:'Chưa cấu hình key admin'},503);
      const ip='admin:'+(request.headers.get('CF-Connecting-IP')||'unknown'),minute=Math.floor(Date.now()/60000);
      if(attempts.size>10000)attempts.clear();
      const recent=attempts.get(ip),count=recent?.minute===minute?recent.count+1:1;attempts.set(ip,{minute,count});
      if(count>8)return json({error:'Thử quá nhiều lần. Chờ một phút rồi thử lại.'},429);
      try{const input=await body(request);if(typeof input.key!=='string'||await digest(input.key)!==adminKeyHash)return json({error:'Key admin không đúng'},401);
        const prefix=Math.floor(Date.now()/1000+3600).toString(16).padStart(8,'0')+hex(crypto.getRandomValues(new Uint8Array(12)));
        return json({token:prefix+await sign(prefix),adminToken:prefix+await sign('admin:'+prefix)});
      }catch{return json({error:'Yêu cầu không hợp lệ'},400);}
    }
    if(accessKeyHash&&path==='/api/auth'){
      if(request.method!=='POST')return json({error:'Method not allowed'},405);
      const ip=request.headers.get('CF-Connecting-IP')||'unknown',minute=Math.floor(Date.now()/60000);
      if(attempts.size>10000)attempts.clear();
      const recent=attempts.get(ip),count=recent?.minute===minute?recent.count+1:1;attempts.set(ip,{minute,count});
      if(count>8)return json({error:'Thử quá nhiều lần. Chờ một phút rồi thử lại.'},429);
      try{const input=await body(request);if(typeof input.key!=='string'||await digest(input.key)!==accessKeyHash)return json({error:'Key không đúng'},401);
        const prefix=Math.floor(Date.now()/1000+86400).toString(16).padStart(8,'0')+hex(crypto.getRandomValues(new Uint8Array(12)));
        return json({token:prefix+await sign(prefix)});
      }catch{return json({error:'Yêu cầu không hợp lệ'},400);}
    }
    if(accessKeyHash){const token=request.headers.get('X-Leon-Access');if(!await valid(token))return json({error:'Nhập key để kết nối',locked:true},401);}
    let isAdmin=false;
    if(adminOnlyQuestLine&&path==='/api/quest-line'){
      const token=request.headers.get('X-Leon-Admin');
      isAdmin=!!adminKeyHash&&/^[a-f0-9]{64}$/.test(token||'')&&parseInt(token.slice(0,8),16)>Date.now()/1000&&await sign('admin:'+token.slice(0,32))===token.slice(32);
      if(!isAdmin)return json({error:'Quest line chỉ dành cho admin'},403);
    }
    if(path==='/api/package-info')return json({app:'leon-project',version});
    if(path==='/api/patch-notes')return json({notes});
    if(path==='/api/accounts'||path.startsWith('/api/clones/launch')||path.startsWith('/api/clones/login-ticket'))
      return json({error:'Bản cloud không lưu mật khẩu game hoặc mở trình duyệt clone. Hãy tự đăng nhập trong tab game.'},501);
    const tenant=await owner(request);if(!tenant)return json({error:'Mở dashboard leon-project và kết nối Leon trước.'},401);
    if(!env.DB)return json({error:'Chưa cấu hình D1 cho leon-project.'},503);
    try{
      if(path==='/api/choice-memory'&&request.method==='GET')return json([...maps.map(map=>({map})),...(await rows(env.DB,tenant)).filter(row=>row.reason==='choice_result'||row.reason?.startsWith('world_map:'))]);
      if(path==='/api/quest-failures'&&request.method==='POST'){
        const entry=await body(request);
        if(!['success','fail'].includes(entry.outcome)||typeof entry.at!=='string'||!Number.isFinite(Date.parse(entry.at))||typeof entry.reason!=='string'||typeof entry.dialog!=='string')return json({error:'Invalid record'},400);
        const id=`${entry.at}:${entry.reason}`;
        await env.DB.prepare('INSERT OR IGNORE INTO events (tenant,id,payload,created_at) VALUES (?,?,?,?)').bind(tenant,id,JSON.stringify(entry),entry.at).run();
        return json({saved:true,id});
      }
      if(path==='/api/quest-line'&&request.method==='GET'){
        const logs=isAdmin?(await env.DB.prepare('SELECT tenant,payload FROM events ORDER BY created_at DESC LIMIT 2000').bind().all()).results.reverse().flatMap(row=>{try{return [{...JSON.parse(row.payload),device:row.tenant.slice(0,12)}];}catch{return [];}}):await rows(env.DB,tenant),character=url.searchParams.get('character')||'';
        const selected=logs.filter(row=>!character||row.character===character);
        const fixesRows=await env.DB.prepare('SELECT stage,payload FROM fixes WHERE tenant = ?').bind(isAdmin?'admin-global':tenant).all();
        return json({quests:quests.map(q=>{const events=selected.filter(row=>stageOf(row)===q.stage),failures=events.filter(row=>row.outcome==='fail');
          return {...q,events:events.slice(-20),observed:events.filter(row=>row.reason==='quest_observed').at(-1),failCount:failures.length,lastFailure:failures.at(-1)};}),
          fixes:Object.fromEntries((fixesRows.results||[]).map(row=>[row.stage,JSON.parse(row.payload)])),
          recentFailures:isAdmin?selected.filter(row=>row.outcome==='fail').slice(-100).reverse():undefined,
          characters:[...new Set(logs.map(row=>row.character).filter(Boolean))],sourceUpdatedAt:null,note:isAdmin?'Admin · Log tập trung từ mọi người dùng · 2.000 sự kiện gần nhất':'Dữ liệu riêng cho trình duyệt này. Xóa dữ liệu trình duyệt sẽ mất khóa truy cập.'});
      }
      if(path==='/api/quest-line'&&request.method==='POST'){
        const input=await body(request);
        if(!Number.isInteger(input.stage)||!quests.some(q=>q.stage===input.stage)||!['todo','fixed','verified'].includes(input.status)||typeof input.note!=='string')return json({error:'Invalid fix'},400);
        const fix={status:input.status,note:input.note.slice(0,1000),at:new Date().toISOString()};
        await env.DB.prepare('INSERT INTO fixes (tenant,stage,payload) VALUES (?,?,?) ON CONFLICT(tenant,stage) DO UPDATE SET payload=excluded.payload').bind(isAdmin?'admin-global':tenant,input.stage,JSON.stringify(fix)).run();
        return json({saved:true});
      }
      if(path==='/api/ai/plan'&&request.method==='POST'){
        const input=await body(request);
        if(typeof input.key!=='string'||!Array.isArray(input.options)||input.options.length>40||input.options.some(label=>typeof label!=='string'||label.length>300))return json({error:'Invalid situation'},400);
        const memory=(await rows(env.DB,tenant)).filter(row=>row.key===input.key&&row.reason==='choice_result');
        const values=new Map(memory.map(row=>[row.label,row]));
        const blocked=label=>/thieu|xoa|vut|pha huy|huy nhiem vu|do sat|^(lui buoc|quay lai|dong|de sau|✕|×)$/.test(fold(label));
        const chosen=[...values].reverse().find(([label,row])=>row.outcome==='success'&&row.value>=0&&!blocked(label)&&input.options.includes(label));
        if(chosen)return json({source:'memory',decision:{action:'select_dialog_option',optionIndex:input.options.indexOf(chosen[0]),label:chosen[0],confidence:1,reason:'Lựa chọn đã thành công của bạn'}});
        return json({source:'fallback',reason:'Bản cloud dùng planner và bộ nhớ; chưa cấu hình dịch vụ AI.'});
      }
      if(path==='/api/clones/heartbeat'&&request.method==='POST')return json({command:null});
      if(path==='/api/game-updates')return json({notes,checkedAt:null,note:'Lịch sử phát hành tool; chưa crawl cập nhật game tự động.'});
      return json({error:'Not found'},404);
    }catch(error){return json({error:error.message==='Payload too large'?'Payload too large':'Không xử lý được yêu cầu'},error.message==='Payload too large'?413:400);}
  };
}
