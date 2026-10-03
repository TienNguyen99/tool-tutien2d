const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../data/crawl/sources/src__entities__player.js'),'utf8');
const start=source.indexOf('i.tickMeditate=function('),end=source.indexOf(',i.stepMult=',start);
assert.ok(start>=0&&end>start);
const ctx=vm.createContext({i:{},a:{MEDITATE:{EXP_PER_SEC:1}},
  e:{meditateMult:()=>1,Player:{addExp:(p,x)=>{p.exp+=x}}}});
vm.runInContext(source.slice(start,end),ctx);
const player={exp:462,mpMax:0,hpMax:0,bpMax:0,bpRegenDelay:0,meditateBonusExp:false,expMinuteTimer:60,expMinuteGained:0};
for(let n=0;n<30;n++)ctx.i.tickMeditate(player,1);
assert.equal(player.exp,462,'Ordinary Q meditation does not award XP');
player.meditateBonusExp=true;
for(let n=0;n<30;n++)ctx.i.tickMeditate(player,1);
assert.equal(player.exp,492,'Stone bonus meditation awards XP with actual game tick function');
console.log('Actual game meditation function: Q leaves XP unchanged; stone bonus increases XP');
