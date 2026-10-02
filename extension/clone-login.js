(() => {
  const token=new URLSearchParams(location.hash.slice(1)).get('tienlo-login');
  if(!token)return;
  let credentials=null;
  async function login(){
    try{
      credentials=await window.__tienloLocalRequest('login',{token});history.replaceState(null,'',location.pathname+location.search);
      let attempts=0;
      const timer=setInterval(()=>{
        const name=document.querySelector('#auth-name'),pass=document.querySelector('#auth-pass'),submit=document.querySelector('#auth-submit');
        if(++attempts>60){clearInterval(timer);credentials=null;return;}
        if(!name||!pass||!submit||!name.getClientRects().length)return;
        name.value=credentials.username;pass.value=credentials.password;
        for(const input of [name,pass]){input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
        credentials=null;clearInterval(timer);
        const terms=document.querySelector('#auth-terms');
        if(terms&&!terms.checked){submit.title='Đã điền tài khoản. Bạn cần tự xác nhận điều khoản rồi đăng nhập.';return;}
        if(!submit.disabled)submit.click();
      },500);
    }catch(error){console.warn('Tiên Lộ đăng nhập:',error.message);credentials=null;}
  }
  void login();
})();
