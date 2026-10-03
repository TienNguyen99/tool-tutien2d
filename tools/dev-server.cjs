const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
// Debug the same generated UI that is uploaded to Pages, not a second layout.
require('node:child_process').execFileSync(process.execPath,[path.join(root,'scripts/build-cloud.cjs')],{cwd:root,stdio:'pipe'});
const uiRoot=path.join(root,'dist','leon-project');
const port = Number.parseInt(process.argv[2] || "8765", 10);
const logDir = process.env.TIENLO_LOG_DIR || path.join(root, 'data', 'logs');
const failureFile = path.join(logDir, 'quest-failures.jsonl');
fs.mkdirSync(logDir, { recursive: true });
const savedIds = new Set();
if (fs.existsSync(failureFile)) {
  for (const line of fs.readFileSync(failureFile, 'utf8').split('\n')) {
    try { savedIds.add(JSON.parse(line).id); } catch {}
  }
}
let writes = Promise.resolve();

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
};

const aiHandler = require('./ai-planner.cjs').createHandler({port,logDir,failureFile});
const questLineHandler = require('./quest-line.cjs').handler({root,logDir,failureFile,port});
const server = http.createServer((request, response) => {
  const requestPath = new URL(request.url, "http://127.0.0.1").pathname;
  if(requestPath==='/assets/js/cloud-session.js'){
    // Local APIs use the local log store. Cloud authentication remains enforced
    // by the production worker; this shim is only served by the loopback server.
    response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'}).end('window.__leonReady=Promise.resolve();');return;
  }
  if(requestPath==='/api/package-info' && request.method==='GET'){
    const version=JSON.parse(fs.readFileSync(path.join(root,'extension/manifest.json'),'utf8')).version;
    response.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({app:'tienlo-companion',version}));return;
  }
  if(requestPath==='/api/quest-line') { questLineHandler(request,response); return; }
  if(requestPath==='/api/ai/plan') { aiHandler(request,response); return; }
  if(requestPath==='/api/accounts'){
    void require('./account-store.cjs')(request,response);return;
  }
  if (requestPath.startsWith('/api/clones')) {
    if (request.headers.origin === 'https://tutien2d.online') {
      response.setHeader('Access-Control-Allow-Origin','https://tutien2d.online');
      response.setHeader('Vary','Origin');
      response.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
      response.setHeader('Access-Control-Allow-Headers','Content-Type');
      response.setHeader('Access-Control-Allow-Private-Network','true');
    }
    if(request.method==='OPTIONS'){response.writeHead(204).end();return;}
    if(['/api/clones/launch','/api/clones/login-ticket'].includes(requestPath)){
      void require('./clone-launcher.cjs')(request,response,requestPath);return;
    }
    if(require('./clone-manager.cjs')(request,response,requestPath))return;
  }
  if (requestPath === '/api/game-updates' && request.method === 'GET') {
    require('./game-updates.cjs').check().then(data=>{
      response.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(data));
    }).catch(error=>response.writeHead(502).end(error.message));
    return;
  }
  if (requestPath === '/api/patch-notes' && request.method === 'GET') {
    try {
      const notes = JSON.parse(fs.readFileSync(path.join(root, 'patch-notes.json'), 'utf8'));
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify({ notes }));
    } catch { response.writeHead(500).end('Patch notes unavailable'); }
    return;
  }
  if (requestPath === '/api/choice-memory' && request.method === 'GET') {
    const rows = fs.existsSync(failureFile) ? fs.readFileSync(failureFile, 'utf8').split('\n').flatMap(line => {
      try { const row = JSON.parse(line); return row.reason === 'choice_result' || row.reason?.startsWith('world_map:') ? [row] : []; } catch { return []; }
    }).slice(-2000) : [];
    const catalogPath = path.join(root, 'data', 'crawl', 'catalog.json');
    const catalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, 'utf8')) : { maps: [] };
    const crawled = (catalog.maps || []).map(map => ({ map }));
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify([...crawled, ...rows]));
    return;
  }
  if (requestPath === '/api/quest-failures' && request.method === 'POST') {
    if (request.headers.origin !== `http://127.0.0.1:${port}`
        && !/^chrome-extension:\/\/[a-p]{32}$/.test(request.headers.origin || '')) {
      response.writeHead(403).end('Forbidden origin');
      return;
    }
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > 65536) request.destroy();
    });
    request.on('end', () => {
      let entry;
      try {
        entry = JSON.parse(body);
        if (!['fail', 'success'].includes(entry.outcome) || typeof entry.at !== 'string' ||
            typeof entry.reason !== 'string' || typeof entry.dialog !== 'string') throw new Error('Invalid record');
        entry.id = `${entry.at}:${entry.reason}`;
      } catch {
        response.writeHead(400).end('Invalid failure record');
        return;
      }
      writes = writes.then(async () => {
        if (!savedIds.has(entry.id)) {
          await fs.promises.appendFile(failureFile, JSON.stringify(entry) + '\n', 'utf8');
          savedIds.add(entry.id);
        }
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ saved: true, id: entry.id }));
      }).catch(() => { response.writeHead(500).end('Could not save log'); });
    });
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method) || /^\/(data|\.git)(\/|$)/.test(requestPath)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  let relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  if(['setup','quest-line','patch-notes'].includes(relativePath))relativePath+='.html';
  const sharedUI=relativePath.startsWith('assets/') || ['index.html','setup.html','quest-line.html','patch-notes.html','patch-notes.json'].includes(relativePath);
  const staticRoot=sharedUI?uiRoot:root;
  const filePath = path.resolve(staticRoot, relativePath);

  if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(response);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Tien Lo Tro Thu: http://127.0.0.1:${port}/index.html`);
});

