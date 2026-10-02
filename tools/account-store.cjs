const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');
const file=path.join(__dirname,'../data/private/accounts.json');
function protect(value){return new Promise((resolve,reject)=>{
  const child=execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',
    'Add-Type -AssemblyName System.Security; $payload=[Console]::In.ReadToEnd(); $bytes=[Text.Encoding]::UTF8.GetBytes($payload); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))'],
    {windowsHide:true,timeout:10000},(error,stdout)=>error?reject(Error('Không mã hóa được mật khẩu bằng Windows')):resolve(stdout.trim()));
  child.stdin.end(value);
});}
module.exports=async function(req,res){
  const reply=(code,data)=>res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(data));
  if(req.headers.origin!==`http://127.0.0.1:${req.socket.localPort}`){reply(403,{error:'Forbidden origin'});return;}
  if(req.method!=='POST'){reply(405,{error:'Method not allowed'});return;}
  let body='';req.on('data',chunk=>{body+=chunk;if(Buffer.byteLength(body)>16384)req.destroy();});
  req.on('end',async()=>{
    try{
      const {accounts}=JSON.parse(body);
      if(!Array.isArray(accounts)||accounts.length>5||!accounts.length)throw Error('Nhập từ 1 đến 5 tài khoản');
      for(const row of accounts)if(typeof row.username!=='string'||!row.username.trim()||row.username.length>100
        ||typeof row.password!=='string'||!row.password||row.password.length>1000)throw Error('Thiếu tài khoản hoặc mật khẩu');
      if(new Set(accounts.map(row=>row.username.trim().toLowerCase())).size!==accounts.length)throw Error('Tài khoản bị trùng');
      const encrypted=await protect(JSON.stringify(accounts.map(row=>({username:row.username.trim(),password:row.password}))));
      fs.mkdirSync(path.dirname(file),{recursive:true});
      const record={protection:'Windows DPAPI CurrentUser',savedAt:new Date().toISOString(),count:accounts.length,encrypted};
      await fs.promises.writeFile(file+'.tmp',JSON.stringify(record));await fs.promises.rename(file+'.tmp',file);
      reply(200,{saved:true,count:accounts.length});
    }catch(error){reply(400,{error:error.message});}
  });
};
