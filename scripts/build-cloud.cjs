const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),output=path.resolve(root,'dist/leon-project'),version=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8')).version;
const origin=process.env.LEON_ORIGIN||'https://leon-project.pages.dev';
const parsed=new URL(origin);if(parsed.protocol!=='https:'||parsed.origin!==origin)throw Error('LEON_ORIGIN must be an HTTPS origin');
if(output!==path.join(root,'dist','leon-project'))throw Error('Unsafe build output');
// This exact, generated output directory is the only directory replaced.
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
for(const dir of ['assets','extension'])fs.cpSync(path.join(root,dir),path.join(output,dir),{recursive:true});
for(const file of ['index.html','quest-line.html','patch-notes.html','patch-notes.json']){
  let source=fs.readFileSync(path.join(root,file),'utf8').replaceAll('Tiên Lộ Trợ Thủ','Tiên Lộ').replaceAll('Quest line · Tiên Lộ','Quest line · Tiên Lộ');
  if(file.endsWith('.html'))source=source.replace('</head>','<link rel="stylesheet" href="assets/css/cloud-compact.css"></head>');
  if(file.endsWith('.html'))source=source.replace(/<script type="module"/,'<script src="assets/js/cloud-session.js"></script><script type="module"');
  source=source.replace('>Quest line</a>','>Admin</a>');
  source=source.replace('<div class="auto-state">','<p class="log-sharing-note">Log lỗi và tên nhân vật được gửi về database Cloudflare để admin kiểm tra.</p><div class="auto-state">');
  source=source.replace(/<a[^>]*href="clones.html"[^>]*>[\s\S]*?<\/a>/g,'<a class="chip install-link" href="setup.html">Cài extension</a>');
  fs.writeFileSync(path.join(output,file),source);
}
fs.copyFileSync(path.join(root,'cloud/session.js'),path.join(output,'assets/js/cloud-session.js'));
fs.copyFileSync(path.join(root,'cloud/setup.html'),path.join(output,'setup.html'));
fs.copyFileSync(path.join(root,'cloud/compact.css'),path.join(output,'assets/css/cloud-compact.css'));
const appFile=path.join(output,'assets/js/app.js');fs.writeFileSync(appFile,'await window.__leonReady;\n'+fs.readFileSync(appFile,'utf8').replace("  rail.append(document.querySelector('.safety-settings'),document.querySelector('#sessionCharacter').closest('.card'));","  rail.append(document.querySelector('.safety-settings'),document.querySelector('#sessionCharacter').closest('.card')); const more=document.createElement('details');more.innerHTML='<summary>Cài đặt & thống kê</summary>';more.append(...rail.children);rail.append(more);"));
fs.cpSync(path.join(root,'cloud/vendor'),path.join(output,'assets/vendor'),{recursive:true});
const icons=Object.fromEntries(fs.readdirSync(path.join(root,'cloud/vendor/icons')).filter(n=>n.endsWith('.svg')).map(n=>[n.slice(0,-4),fs.readFileSync(path.join(root,'cloud/vendor/icons',n),'utf8')]));
fs.writeFileSync(path.join(output,'assets/js/cloud-ui.js'),'const leonIcons='+JSON.stringify(icons)+';\n'+fs.readFileSync(path.join(root,'cloud/ui.js'),'utf8'));
for(const page of ['index.html','setup.html','quest-line.html','patch-notes.html']){const file=path.join(output,page);fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('</body>','<script type="module" src="assets/js/cloud-ui.js"></script></body>'));}
const questFile=path.join(output,'assets/js/quest-line.js');let questSource=fs.readFileSync(questFile,'utf8');questSource=questSource.replace("  const root=$('#quests');root.replaceChildren();", "  const root=$('#quests');root.replaceChildren(); if(data.recentFailures){const section=node('article','');section.append(node('h2','Lỗi gần đây · mọi nhiệm vụ'));const detail=node('details','');detail.append(node('summary',data.recentFailures.length+' lỗi gần nhất'),node('pre',JSON.stringify(data.recentFailures,null,2)));section.append(detail);root.append(section);}").replace(' · cần restart server mới','');fs.writeFileSync(questFile,'await window.__leonReady;\n'+questSource);
const configFile=path.join(output,'assets/js/config.js');
fs.writeFileSync(configFile,fs.readFileSync(configFile,'utf8').replace(/EXPECTED_HOOK_VERSION = '[^']+'/,`EXPECTED_HOOK_VERSION = '${version}'`).replace('aiPlanner: true','aiPlanner: false'));
const hookFile=path.join(output,'extension/hook.js');
let hook=fs.readFileSync(hookFile,'utf8').replace(/HOOK_VERSION = '[^']+'/,`HOOK_VERSION = '${version}'`).replaceAll('http://127.0.0.1:8765',origin);
hook=hook.replace('  function onMessage(event) {',`  function onMessage(event) {
    if(event.origin===HELPER_ORIGIN && event.data?.type==='TIENLO_CLOUD_SESSION' && /^[a-f0-9]{64}$/.test(event.data.token||'')){
      window.__leonSessionToken=event.data.token;window.__leonAccessToken=event.data.access;return;
    }`);
fs.writeFileSync(hookFile,hook);
const clientFile=path.join(output,'extension/local-client.js');
fs.writeFileSync(clientFile,fs.readFileSync(clientFile,'utf8').replace('window.__tienloLocalRequest=(operation,payload)=>new Promise',`window.__tienloLocalRequest=(operation,payload)=>new Promise`).replace('id,operation,payload},location.origin)', 'id,operation,payload:{...payload,_sessionToken:window.__leonSessionToken,_accessToken:window.__leonAccessToken}},location.origin)'));
fs.appendFileSync(clientFile,`\nconst leonLocalRequest=window.__tienloLocalRequest;\nwindow.__tienloLocalRequest=(operation,payload)=>operation==='heartbeat'?Promise.resolve({command:null}):leonLocalRequest(operation,payload);\n`);
const bgFile=path.join(output,'extension/background.js');
let bg=fs.readFileSync(bgFile,'utf8').replaceAll('http://127.0.0.1:8765',origin);
bg=bg.replace('    delete payload.image;',`    const sessionToken=payload._sessionToken;delete payload._sessionToken;
    const accessToken=payload._accessToken;delete payload._accessToken;
    if(!/^[a-f0-9]{64}$/.test(sessionToken||''))throw Error('Mở dashboard leon-project và kết nối trước');
    delete payload.image;`);
bg=bg.replace("try{payload.image=await captureDialog(sender,payload.region);}\n      catch(error){visionFallback=String(error.message||error);}","visionFallback='Cloud dùng hội thoại bằng chữ';");
bg=bg.replace("'Content-Type':'application/json'","'Content-Type':'application/json','Authorization':'Bearer '+sessionToken,'X-Leon-Access':accessToken||''");
fs.writeFileSync(bgFile,bg);
const manifest=JSON.parse(fs.readFileSync(path.join(output,'extension/manifest.json'),'utf8'));
manifest.name='Tiên Lộ';manifest.description='Kết nối game với bảng điều khiển Tiên Lộ';manifest.version=version;manifest.host_permissions=[origin+'/*'];
manifest.content_scripts.forEach(row=>row.js=row.js.filter(file=>file!=='clone-login.js'));
fs.writeFileSync(path.join(output,'extension/manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(output,'extension/CAI-DAT.txt'),`leon-project cloud ${version}\nGiai nen extension. Chrome/Edge > Extensions > Developer mode > Load unpacked > chon thu muc extension.\nMo game, tu dang nhap, bam Tro Thu de ket noi ${origin}.\nKhong can server BAT. Sau khi cap nhat extension, reload extension va tab game.\n`);
const {catalog}=require('../tools/quest-line.cjs');
const publicData={version,adminOnlyQuestLine:true,adminKeyHash:"5cad4e7fdf45d6d7263531d6956270593e53d998bcbe45198d607d9846d0e6d9",accessKeyHash:"b34d569b417786a6393a4e41695287a3727a85996d141ef71a9a1e8d7e10b74d",signingSecret:"8e9d626b0b8cf4078daf8fdaae2b5fd9a4672b2c99ea061591e1005b304a83d2",maps:JSON.parse(fs.readFileSync(path.join(root,'data/crawl/catalog.json'),'utf8')).maps,
  quests:catalog(fs.readFileSync(path.join(root,'data/crawl/sources/src__systems__quest.js'),'utf8')),
  notes:JSON.parse(fs.readFileSync(path.join(root,'patch-notes.json'),'utf8'))};
const api=fs.readFileSync(path.join(root,'cloud/api.mjs'),'utf8').replace('export function createApi','function createApi');
fs.writeFileSync(path.join(output,'_worker.js'),api+`\nconst handle=createApi(${JSON.stringify(publicData)});\nexport default {async fetch(request,env){if(new URL(request.url).pathname.startsWith('/api/'))return handle(request,env);return env.ASSETS.fetch(request);}};\n`);
fs.writeFileSync(path.join(output,'_routes.json'),JSON.stringify({version:1,include:['/api/*'],exclude:[]}));
fs.writeFileSync(path.join(output,'_headers'),'/assets/*\n  X-Content-Type-Options: nosniff\n/api/*\n  Cache-Control: no-store\n');
for(const dir of ['assets/js','extension'])for(const name of fs.readdirSync(path.join(output,dir))){if(!name.endsWith('.js'))continue;const file=path.join(output,dir,name);fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll('Trợ Thủ','Tiên Lộ').replaceAll('trợ thủ','Tiên Lộ').replaceAll('Trợ thủ','Tiên Lộ'));}
for(const name of ['index.html','setup.html','quest-line.html','patch-notes.html']){const file=path.join(output,name);fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll('Trợ Thủ','Tiên Lộ').replaceAll('trợ thủ','Tiên Lộ').replaceAll('Trợ thủ','Tiên Lộ'));}
console.log(output);
