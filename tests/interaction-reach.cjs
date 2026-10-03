const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../extension/hook.js'),'utf8');
const obj={x:300,y:200,r:220},player={x:0,y:184};
const scene={map:{interactables:[]}};
const context=vm.createContext({window:{PNTT:{CONFIG:{TILE:32},Targeting:{propReach:o=>o.r+24}}},
  safe:(fn,fallback)=>{try{return fn()??fallback}catch{return fallback}},
  safePathRoute:(_m,_sx,_sy,x,y)=>[{x,y}],routeDistance:(p,r)=>Math.hypot(r.at(-1).x-p.x,r.at(-1).y-p.y)});
vm.runInContext(source.slice(source.indexOf('  function routeToInteractable('),source.indexOf('  function mapRoute(')),context);
for(const kind of ['water','fishing','tree']){
  obj.id=kind;const result=context.routeToInteractable(scene,player,obj,'prop:'+kind);
  assert.equal(result.reach,48);assert.equal(result.centerY,184);
  assert.ok(Math.hypot(result.route.at(-1).x-obj.x,result.route.at(-1).y-result.centerY)<=48);
  assert.ok(result.route.at(-1).x>250,'Must actually approach, not stop at wide selection radius');
}
scene.map.interactables=[obj];assert.equal(context.routeToInteractable(scene,player,obj,'scn:water').centerY,200);
context.safePathRoute=()=>[{x:0,y:0}];assert.equal(context.routeToInteractable(scene,player,obj).route.length,0,'Reject endpoint outside interaction range');
context.safePathRoute=()=>[];assert.equal(context.routeToInteractable(scene,player,obj).route.length,0,'Never bypass collision');
console.log('Water, fishing, tree approach geometry and blocked endpoint regressions passed');

context.safePathRoute=(_m,_sx,_sy,x,y)=>Math.hypot(x-obj.x,y-184)>47?[{x,y}]:[];
scene.map.interactables=[];
assert.ok(context.routeToInteractable(scene,player,obj,'prop:branch').route.length,'Search outer interaction boundary when inner ring is obstructed');

obj.r=48;scene.map.interactables=[obj];
context.safePathRoute=(_m,_sx,_sy,x,y)=>Math.hypot(x-obj.x,y-obj.y)>60?[{x,y}]:[];
const pond=context.routeToInteractable(scene,player,obj,'scn:ho_bich_thuy');
assert.equal(pond.reach,68,'Pond uses native 72px interaction radius with a small margin');
assert.ok(pond.route.length,'Reach the bank without forcing player into water');
