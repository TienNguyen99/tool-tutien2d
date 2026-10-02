const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFile,spawn}=require('node:child_process');
const tickets=new Map();
const root=path.resolve(__dirname,'..');
function accounts(){return new Promise((resolve,reject)=>{
  const record=JSON.parse(fs.readFileSync(path.join(root,'data/private/accounts.json'),'utf8'));
  const child=execFile('powershell.exe',['-NoProfile','-NonInteractive','-Command',
    'Add-Type -AssemblyName System.Security; $payload=[Console]::In.ReadToEnd(); [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($payload),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))'],
    {windowsHide:true,timeout:10000},(error,stdout)=>{if(error)return reject(Error('Không giải mã được tài khoản'));try{resolve(JSON.parse(stdout))}catch{reject(Error('Dữ liệu tài khoản không hợp lệ'))}});
  child.stdin.end(record.encrypted);
});}
module.exports=async function(req,res,pathname){
  const reply=(code,data)=>res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(data));
  if(pathname==='/api/clones/login-ticket'){
    if(req.method!=='POST'||(req.headers.origin!=='https://tutien2d.online'&&!/^chrome-extension:\/\/[a-p]{32}$/.test(req.headers.origin||''))){reply(403,{error:'Forbidden'});return;}
    let body='';req.on('data',c=>{body+=c;if(body.length>2048)req.destroy()});req.on('end',()=>{
      try{const {token}=JSON.parse(body),entry=tickets.get(token);tickets.delete(token);
        if(!entry||entry.expires<Date.now()){reply(410,{error:'Ticket expired'});return;}reply(200,entry.account);
      }catch{reply(400,{error:'Invalid ticket'})}
    });return;
  }
  if(req.method!=='POST'||req.headers.origin!==`http://127.0.0.1:${req.socket.localPort}`){reply(403,{error:'Forbidden'});return;}
  try{
    const candidates=[process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA]
      .filter(Boolean).map(p=>path.join(p,'Google/Chrome/Application/chrome.exe'));
    const chrome=candidates.find(p=>fs.existsSync(p));if(!chrome)throw Error('Không tìm thấy Chrome');
    const rows=await accounts();
    for(let i=0;i<rows.length;i++){
      const token=crypto.randomBytes(32).toString('hex');tickets.set(token,{account:rows[i],expires:Date.now()+300000});
      const profile=path.join(root,'data/private/chrome',`clone-${i+1}`);fs.mkdirSync(profile,{recursive:true});
      // User explicitly requested visible Chrome windows, not hidden processes.
      await new Promise((resolve,reject)=>{
        const child=spawn(chrome,[`--user-data-dir=${profile}`,'--profile-directory=Default',
          '--no-first-run','--no-default-browser-check','--new-window',
          `https://tutien2d.online/?choi#tienlo-login=${token}`],{detached:true,stdio:'ignore',windowsHide:false});
        child.once('error',error=>{tickets.delete(token);reject(Error(`Chrome không khởi động: ${error.code||'unknown'}`));});
        child.once('spawn',()=>{child.unref();resolve();});
      });
    }
    reply(200,{launched:rows.length,message:'Đã gửi yêu cầu mở Chrome hiển thị. Lần đầu vào chrome://extensions, bật Developer mode và Load unpacked thư mục extension của tool. Vé đăng nhập hết hạn sau 5 phút.'});
  }catch(error){reply(400,{error:error.message})}
};
