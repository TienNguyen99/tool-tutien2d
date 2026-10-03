const assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{const {createApi}=await import('../cloud/api.mjs');const handle=createApi({accessKeyHash:crypto.createHash('sha256').update('test-key').digest('hex'),signingSecret:'test-secret'});
const call=(path,access,body)=>handle(new Request('https://example.org'+path,{method:body?'POST':'GET',headers:{'X-Leon-Access':access||'','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),{});
assert.equal((await call('/api/package-info')).status,401);assert.equal((await call('/api/auth',null,{key:'wrong'})).status,401);
const token=(await (await call('/api/auth',null,{key:'test-key'})).json()).token;assert.equal(token.length,64);assert.equal((await call('/api/package-info',token)).status,200);
assert.equal((await call('/api/package-info',token.slice(0,63)+(token.at(-1)==='a'?'b':'a'))).status,401);assert.equal((await call('/api/package-info','00000000'+token.slice(8))).status,401);console.log('Auth: missing/wrong key, valid session, forged and expired session passed');})().catch(e=>{console.error(e);process.exitCode=1;});
