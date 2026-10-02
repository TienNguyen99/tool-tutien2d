const root=document.querySelector('#clones'),status=document.querySelector('#status');
document.querySelector('#launch').onclick=async()=>{
  const button=document.querySelector('#launch');button.disabled=true;
  try{const response=await fetch('/api/clones/launch',{method:'POST',signal:AbortSignal.timeout(20000)});
    const result=await response.json();if(!response.ok)throw Error(result.error);
    status.textContent=`Đã yêu cầu mở ${result.launched} Chrome. ${result.message}`;
  }catch(error){status.textContent=`Không mở được: ${error.message}`;}finally{button.disabled=false;}
};
const accounts=document.querySelector('#accounts');
accounts.addEventListener('submit',event=>event.preventDefault());
for(let i=1;i<=5;i++){
  const group=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=`Tài khoản ${i}`;group.append(legend);
  for(const [field,label,type]of[['username','Tài khoản','text'],['password','Mật khẩu','password']]){
    const wrapper=document.createElement('label');wrapper.textContent=label;
    const input=document.createElement('input');input.id=`account-${i}-${field}`;input.type=type;
    input.autocomplete=field==='password'?'new-password':'off';input.spellcheck=false;
    wrapper.append(input);group.append(wrapper);
  }
  const reveal=document.createElement('button');reveal.type='button';reveal.textContent='Hiện mật khẩu';
  reveal.setAttribute('aria-pressed','false');
  reveal.onclick=()=>{const input=group.querySelector('input[type="password"],input[data-secret]');
    input.dataset.secret='true';const shown=input.type==='password';input.type=shown?'text':'password';
    reveal.textContent=shown?'Ẩn mật khẩu':'Hiện mật khẩu';reveal.setAttribute('aria-pressed',String(shown));};
  group.append(reveal);accounts.append(group);
}
document.querySelector('#clearAccounts').onclick=()=>{
  accounts.reset();accounts.querySelectorAll('[data-secret]').forEach(input=>input.type='password');
  accounts.querySelectorAll('button').forEach(button=>{button.textContent='Hiện mật khẩu';button.setAttribute('aria-pressed','false');});
};
document.querySelector('#saveAccounts').onclick=async()=>{
  const button=document.querySelector('#saveAccounts'),feedback=document.querySelector('#accountStatus');
  const rows=[];
  for(let i=1;i<=5;i++){
    const username=document.querySelector(`#account-${i}-username`).value.trim(),password=document.querySelector(`#account-${i}-password`).value;
    if(username||password)rows.push({username,password});
  }
  button.disabled=true;feedback.textContent='Đang mã hóa và lưu…';
  try{
    const response=await fetch('/api/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accounts:rows}),signal:AbortSignal.timeout(15000)});
    if(response.status===404)throw Error('Cần khởi động lại server để có API lưu tài khoản');
    const result=await response.json();if(!response.ok)throw Error(result.error||'Lưu thất bại');
    accounts.querySelectorAll('input[type="password"],input[data-secret]').forEach(input=>input.value='');
    feedback.textContent=`Đã lưu ${result.count} tài khoản được mã hóa trên server.`;
  }catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}
};
const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
async function command(id,command){try{
  const r=await fetch('/api/clones/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,command})});
  if(!r.ok)throw Error(`HTTP ${r.status}`);const data=await r.json();status.textContent=`Đã xếp lệnh ${command} cho ${data.queued} phiên`;
}catch(e){status.textContent=e.message;}}
document.querySelector('#farm').onclick=()=>command('all','farm');document.querySelector('#stop').onclick=()=>command('all','stop');
let busy=false;
async function refresh(){if(busy)return;busy=true;try{
  const r=await fetch('/api/clones',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error(`HTTP ${r.status}`);
  const rows=await r.json(),fragment=document.createDocumentFragment();
  for(let i=0;i<5;i++){
    const s=rows[i],article=node('article','');article.append(node('h2',s?`${s.data.name||'Chưa đăng nhập'} · ${s.online?'Online':'Mất kết nối'}`:`Clone ${i+1} · chưa kết nối`));
    if(s){article.append(node('p',`${s.data.realm||'—'} · ${s.data.map||'—'} · HP ${s.data.hp||'—'}`),node('p',`Mục tiêu: ${s.data.target||'—'} · Mode: ${s.data.mode||'off'}`),node('p',`Quái hạ: ${s.data.session?.kills||0} · Đạo Hạnh/giờ: ${s.data.session?.xpPerHour??'—'}`));
      for(const [label,action]of[['Farm','farm'],['Dừng','stop']]){const b=node('button',label);b.disabled=!s.online;b.onclick=()=>command(s.id,action);article.append(b);}}
    fragment.append(article);
  }root.replaceChildren(fragment);
}catch(e){status.textContent=`Không kết nối server: ${e.message}`;}finally{busy=false;}}
setInterval(refresh,2000);void refresh();
