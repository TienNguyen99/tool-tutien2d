const sessions=new Map();
const ONLINE_GRACE_MS=30000;
const SESSION_EXPIRY_MS=120000;
module.exports=function(request,response,pathname){
  if(!pathname.startsWith('/api/clones'))return false;
  const reply=(code,data)=>response.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(data));
  if(request.method==='GET'&&pathname==='/api/clones'){
    reply(200,[...sessions.values()].map(s=>({id:s.id,data:s.data,lastSeen:s.lastSeen,online:Date.now()-s.lastSeen<ONLINE_GRACE_MS})));return true;
  }
  if(request.method!=='POST'){reply(405,{error:'Method not allowed'});return true;}
  if(!['https://tutien2d.online',`http://127.0.0.1:${request.socket.localPort}`].includes(request.headers.origin)
    && !/^chrome-extension:\/\/[a-p]{32}$/.test(request.headers.origin||'')){
    reply(403,{error:'Forbidden origin'});return true;
  }
  let body='';request.on('data',chunk=>{body+=chunk;if(Buffer.byteLength(body)>65536)request.destroy();});
  request.on('end',()=>{
    try{
      const input=JSON.parse(body);
      if(pathname==='/api/clones/heartbeat'){
        if(typeof input.id!=='string'||!/^[\w-]{1,80}$/.test(input.id)||!input.data||typeof input.data!=='object')throw Error('Invalid session');
        for(const [id,session] of sessions)
          if(Date.now()-session.lastSeen>SESSION_EXPIRY_MS)sessions.delete(id);
        if(!sessions.has(input.id)&&sessions.size>=5){reply(409,{error:'Maximum five active sessions'});return;}
        const session=sessions.get(input.id)||{id:input.id,command:null};
        session.data=input.data;session.lastSeen=Date.now();sessions.set(input.id,session);
        const command=session.command;session.command=null;reply(200,{command});
      }else if(pathname==='/api/clones/command'){
        if(request.headers.origin!==`http://127.0.0.1:${request.socket.localPort}`){reply(403,{error:'Manager only'});return;}
        if(!['farm','stop'].includes(input.command))throw Error('Invalid command');
        const targets=input.id==='all'?[...sessions.values()].filter(s=>Date.now()-s.lastSeen<ONLINE_GRACE_MS):[sessions.get(input.id)].filter(Boolean);
        for(const s of targets)s.command=input.command;
        reply(200,{queued:targets.length});
      }else reply(404,{error:'Not found'});
    }catch{reply(400,{error:'Invalid request'});}
  });return true;
};
