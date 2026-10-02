const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {catalog,aggregate,stageOf}=require('../tools/quest-line.cjs');
const fixture=catalog('{name:"Giai đoạn 1 — Test",hint:"Hái cây"},{name:"Giai đoạn 2 — Hai",hint:"Câu cá"}');
assert.equal(fixture.length,2);assert.equal(fixture[0].hint,'Hái cây');
const rows=[{quest:{stage:1,objectives:['0/5']},character:'a',reason:'quest_observed',outcome:'success'},
 {quest:{stage:1},character:'a',reason:'quest_stuck',outcome:'fail',analysis:'too far'},
 {key:JSON.stringify(['v2',2,'step']),character:'b',reason:'choice_result',outcome:'fail'}];
const all=aggregate(fixture,rows);assert.equal(all[0].failCount,1);assert.equal(all[1].failCount,1);
const a=aggregate(fixture,rows,'a');assert.equal(a[1].failCount,0);assert.ok(a[0].observed);
assert.equal(stageOf({key:'bad'}),null);
const file=path.join(__dirname,'../data/crawl/sources/src__systems__quest.js');
if(fs.existsSync(file)){const quests=catalog(fs.readFileSync(file,'utf8'));assert.ok(quests.length>=30);console.log(`Static quest catalog: ${quests.length} stages`);}
console.log('Quest catalog, character isolation and fail aggregation passed');
