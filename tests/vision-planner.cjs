const assert=require('node:assert/strict'),{createPlanner,validateImage,sanitize}=require('../tools/ai-planner.cjs');
(async()=>{
 const image=Buffer.from([255,216,255,224,0,0]).toString('base64');let body;
 const input={key:'test',quest:'Luyện đan',options:['Luyện đúng đan','Lui Bước'],image};
 const result=await createPlanner({visionModel:'vision-test',fetchImpl:async(_url,request)=>{
   body=JSON.parse(request.body);return {ok:true,json:async()=>({message:{content:JSON.stringify({action:'select_dialog_option',optionIndex:0,confidence:.8,reason:'Ảnh và quest khớp'})}})};
 }})(input);
 assert.equal(result.source,'llm');assert.equal(body.model,'vision-test');assert.equal(body.messages[1].images[0],image);
 assert.equal(sanitize(input).image,undefined,'Raw images never enter log situation');
 assert.equal((await createPlanner({visionModel:''})(input)).source,'fallback');
 assert.throws(()=>validateImage('not an image'));assert.throws(()=>validateImage('a'.repeat(1800001)));
 console.log('Vision payload, validation, log privacy and missing-model fallback passed');
})().catch(error=>{console.error(error);process.exitCode=1});
