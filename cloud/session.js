(() => {
  const deviceKey='leon-project-device-key-v1',accessKey='leon-project-access-v1';
  const isAdminPage=/\/quest-line(?:\.html)?\/?$/.test(location.pathname),adminKey='leon-project-admin-v1';let admin=sessionStorage.getItem(adminKey)||'';
  let token=localStorage.getItem(deviceKey),access=sessionStorage.getItem(accessKey)||'';
  if(!/^[a-f0-9]{64}$/.test(token||'')){token=[...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');localStorage.setItem(deviceKey,token);}
  const original=window.fetch.bind(window);let unlock;
  const ready=window.__leonReady=new Promise(resolve=>unlock=resolve);
  window.fetch=async(input,options={})=>{
    const url=new URL(input instanceof Request?input.url:String(input),location.href);
    if(url.origin===location.origin&&url.pathname.startsWith('/api/')){
      await ready;const headers=new Headers(input instanceof Request?input.headers:undefined);
      new Headers(options.headers).forEach((v,k)=>headers.set(k,v));headers.set('Authorization','Bearer '+token);headers.set('X-Leon-Access',access);if(isAdminPage)headers.set('X-Leon-Admin',admin);
      const response=await original(input,{...options,headers});if(response.status===401||(isAdminPage&&response.status===403)){sessionStorage.removeItem(accessKey);sessionStorage.removeItem(adminKey);location.reload();}return response;
    }return original(input,options);
  };
  window.addEventListener('message',event=>{if(!isAdminPage&&access&&event.origin==='https://tutien2d.online'&&event.data?.type==='TIENLO_LIVE_V3')event.source?.postMessage({type:'TIENLO_CLOUD_SESSION',token,access},event.origin);});
  document.addEventListener('DOMContentLoaded',()=>{
    const overlay=document.createElement('div');overlay.className='leon-gate';overlay.innerHTML='<form><h1>Tiên Lộ</h1><p>Nhập key để kết nối Tiên Lộ.</p><label>Key truy cập<input name="key" type="password" autocomplete="off" required maxlength="100" autofocus></label><button>Kết nối</button><p role="status"></p></form>';document.body.append(overlay);
    if(isAdminPage){overlay.querySelector('h1').textContent='Quản trị Tiên Lộ';overlay.querySelector('p').textContent='Nhập key admin để xem log từ mọi người dùng.';overlay.querySelector('label').firstChild.textContent='Key admin';}
    const open=()=>{overlay.remove();unlock();};
    if(access&&parseInt(access.slice(0,8),16)>Date.now()/1000&&(!isAdminPage||(admin&&parseInt(admin.slice(0,8),16)>Date.now()/1000))){open();return;}
    access='';overlay.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const button=overlay.querySelector('button'),status=overlay.querySelector('[role=status]');button.disabled=true;
      try{const response=await original(isAdminPage?'/api/admin/auth':'/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:overlay.querySelector('input').value})});const result=await response.json();if(!response.ok)throw Error(result.error||'Không kết nối được');if(isAdminPage){admin=result.adminToken;sessionStorage.setItem(adminKey,admin);}access=result.token;sessionStorage.setItem(accessKey,access);open();}catch(error){status.textContent=error.message;}finally{button.disabled=false;}
    });
  });
})();
