const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../extension/hook.js'), 'utf8');
const blocked = new Set(['3,1', '3,2', '3,3', '3,4']);
const map = {
  width: 8, height: 8,
  isBlockedTile(x, y) { return x < 0 || y < 0 || x >= 8 || y >= 8 || blocked.has(`${x},${y}`); },
  rectBlocked(l, t, r, b) {
    for (let y = Math.floor(t / 32); y <= Math.floor((b - .001) / 32); y++)
      for (let x = Math.floor(l / 32); x <= Math.floor((r - .001) / 32); x++)
        if (this.isBlockedTile(x, y)) return true;
    return false;
  }
};
// Deterministic grid search fixture, same tx/ty contract as the game's A*.
function find(grid, sx, sy, ex, ey) {
  if (grid.isBlockedTile(ex, ey)) return null;
  const queue = [[{tx:sx, ty:sy}]], seen = new Set([`${sx},${sy}`]);
  while (queue.length) {
    const path = queue.shift(), p = path.at(-1);
    if (p.tx === ex && p.ty === ey) return path.slice(1);
    for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const tx=p.tx+dx, ty=p.ty+dy, key=`${tx},${ty}`;
      if (!seen.has(key) && !grid.isBlockedTile(tx,ty)) {
        seen.add(key); queue.push([...path,{tx,ty}]);
      }
    }
  }
  return null;
}
const context=vm.createContext({window:{PNTT:{Pathfinder:{find},CONFIG:{TILE:32,PLAYER:{HITBOX_W:18,HITBOX_H:24}}}}});
vm.runInContext(source.slice(source.indexOf('  function safePathRoute('),source.indexOf('  function routeToInteractable(')),context);
const start={x:48,y:112}, end={x:176,y:112};
const route=context.safePathRoute(map,start.x,start.y,end.x,end.y);
assert.ok(route.length > 1, 'Wall requires a detour');
let previous=start;
for (const point of route) {
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  const n=Math.ceil(Math.hypot(point.x-previous.x,point.y-previous.y));
  for(let i=0;i<=n;i++) {
    const x=previous.x+(point.x-previous.x)*i/n, y=previous.y+(point.y-previous.y)*i/n;
    assert.equal(map.rectBlocked(x-9,y-24,x+9,y),false,'Every segment must clear player hitbox');
  }
  previous=point;
}
assert.equal(context.safePathRoute(map,48,112,112,112).length,0,'Blocked destination must not snap across wall');
assert.equal(context.safePathRoute(map,48,112,-20,112).length,0,'Never route outside map');
for (let y=0;y<8;y++) blocked.add(`3,${y}`);
assert.equal(context.safePathRoute(map,48,112,176,112).length,0,'Disconnected areas must return no route');
assert.equal(source.includes('P.Pathfinder?.route?.'),false,'All automation routes must use footprint-aware pathfinding');
assert.ok(context.routeDistance(start,[{x:49,y:112},{x:50,y:112}]) < context.routeDistance(start,[{x:200,y:112}]),'Distance is not waypoint count');
console.log('Collision-aware pathfinding regressions passed');

const flyMap = {...map, rectFlyBlocked(l,t,r,b) { return l < 0 || t < 0 || r > 256 || b > 256; }};
assert.ok(context.safePathRoute(flyMap,48,112,176,112,true).length,'Flying crosses ground wall using native flight collision');
assert.equal(context.safePathRoute(flyMap,48,112,176,112,false).length,0,'Ground movement still respects wall');
flyMap.rectFlyBlocked = () => true;
assert.equal(context.safePathRoute(flyMap,48,112,176,112,true).length,0,'Flight obstacles are never bypassed');
