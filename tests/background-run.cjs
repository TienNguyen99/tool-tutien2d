const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let next=1,clock=0;const frames=new Map(),timers=new Map(),listeners={};
const window={requestAnimationFrame:fn=>{const id=next++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)};
const document={hidden:false,addEventListener:(name,fn)=>listeners[name]=fn};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../extension/background-run.js'),'utf8'),{
  window,document,performance:{now:()=>clock},setTimeout:fn=>{const id=next++;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
function tick(){const rows=[...timers.entries()];timers.clear();clock+=100;rows.forEach(([id,fn])=>fn());}
let count=0;const id=window.requestAnimationFrame(()=>count++);
assert.equal(timers.size,0,'Disabled mode uses native rAF only');
window.__tienloBackgroundRun.set(true);assert.equal(timers.size,0,'Visible tab never uses fallback');
document.hidden=true;listeners.visibilitychange();assert.equal(timers.size,1);
const oldNative=[...frames.values()][0];tick();assert.equal(count,1);assert.equal(frames.size,0);
oldNative(clock);assert.equal(count,1,'Native/fallback race invokes callback once');
const canceled=window.requestAnimationFrame(()=>count++);window.cancelAnimationFrame(canceled);tick();assert.equal(count,1);
window.requestAnimationFrame(()=>{count++;window.requestAnimationFrame(()=>count++);});tick();assert.equal(count,2,'Next frame waits for a separate tick');
window.__tienloBackgroundRun.set(false);assert.equal(timers.size,0);tick();assert.equal(count,2);
document.hidden=false;listeners.visibilitychange();for(const callback of [...frames.values()])callback(clock);assert.equal(count,3);
console.log('Hidden frame continuation, race, cancellation, foreground and disable regressions passed');
