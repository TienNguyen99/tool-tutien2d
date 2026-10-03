const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createMemoryReader}=require('../tools/ai-planner.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tienlo-memory-'));
const file=path.join(dir,'memory.jsonl');
try {
  const read=createMemoryReader(file);
  assert.deepEqual(read(),[]);
  fs.writeFileSync(file,JSON.stringify({label:'First',outcome:'success'})+'\n');
  const first=read();
  assert.strictEqual(read(),first,'Unchanged file reuses parsed rows');
  fs.appendFileSync(file,'invalid\n'+JSON.stringify({label:'First',outcome:'fail'})+'\n');
  assert.equal(read().at(-1).outcome,'fail','New feedback immediately invalidates cache');
  fs.writeFileSync(file,'');
  assert.deepEqual(read(),[],'Truncated log clears old successes');
  fs.unlinkSync(file);
  assert.deepEqual(read(),[]);
  console.log('AI memory cache reuse, feedback and truncation passed');
} finally {
  fs.rmSync(dir,{recursive:true,force:true});
}
