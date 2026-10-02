const assert=require('node:assert/strict');
const {literal}=require('../tools/crawl-game.cjs');
assert.deepEqual(literal('{id:"map",portals:[{toMap:"next",tx:2,ty:3}],"quoted":!0}',0),
  {id:'map',portals:[{toMap:'next',tx:2,ty:3}],quoted:true});
assert.deepEqual(literal('{id:"map",dynamic:dangerous.call(),portals:[]}',0),
  {id:'map',dynamic:null,portals:[]});
console.log('Static crawler regressions passed');
