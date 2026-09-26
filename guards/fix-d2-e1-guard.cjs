'use strict';
const fs=require('fs'), path=require('path');
const {pathToFileURL}=require('url');
const rootAt=process.argv.indexOf('--root');
const ROOT=rootAt<0?path.join(__dirname,'..'):process.argv[rootAt+1];
const fixtureAt=process.argv.indexOf('--fixtures');
const fixturePath=fixtureAt<0?path.join(__dirname,'fixtures/fix-d2-replay.json'):process.argv[fixtureAt+1];
const fixtures=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
let checks=0,failed=0;
function ok(name,pass){checks++;if(!pass)failed++;console.log((pass?'PASS ':'FAIL ')+name);}
(async()=>{
 const RR=await import(pathToFileURL(path.join(ROOT,'lib/ruling-review.js')));
 const turn=fixtures.owners.find(f=>f.id.endsWith('3ddb4fcd'));
 let calls=0;
 const replay=await RR.reviewRulings({text:turn.text,rows:turn.rows,ask:async()=>{calls++;return turn.raw;}});
 // D3B F4 (2026-09-26): the owner turn's first sentence is the writer's own «لم أقفْ على نصٍّ لمذهبِ
 // الحنفية…» disclosure; it is still asked but never struck (it is moved whole into the one line), so the
 // struck count is 1, not 2. The three recovered supports are unchanged.
 ok('E1 owner 3 recorded provider: three holder-checked verbatim claims recovered',calls===1&&replay.record.supported===3&&replay.record.notFound===1&&replay.record.disclosures===1);
 for(const f of fixtures.siblings){
  const rows=[f.row]; const text=f.claim;
  const raw=JSON.stringify({claims:[{id:1,verdict:'supported',row:2,quote:f.quote}]});
  const out=await RR.reviewRulings({text,rows,ask:async()=>raw});
  ok('E1 sibling '+f.id+': paragraph number recovered by verbatim quote',out.text===text&&out.record.supported===1);
  const token=JSON.stringify({claims:[{id:1,verdict:'supported',row:'ROW_'+f.row.ref,quote:f.quote}]});
  const named=await RR.reviewRulings({text,rows,ask:async()=>token});
  ok('E1 sibling '+f.id+': namespaced row token resolves',named.record.supported===1);
  ok('E1 sibling '+f.id+': prompt has distinct row token',RR.rulingReviewPrompt(rows,RR.claimSentences(text)).includes('ROW_'+f.row.ref));
  const falseQuote=JSON.stringify({claims:[{id:1,verdict:'supported',row:2,quote:f.quote+' كلام لم يكتبه المصدر'}]});
  const bad=await RR.reviewRulings({text,rows,ask:async()=>falseQuote});
  ok('E1 sibling '+f.id+': nonverbatim quote stays rejected',bad.record.supported===0&&bad.record.notFound===1);
  const wrong=await RR.reviewRulings({text,rows:[...rows,{ref:2,text:'هذا نص آخر لا يحمل قول الفقيه المذكور'}],ask:async()=>raw});
  ok('E1 sibling '+f.id+': an existing wrong row is not silently changed',wrong.record.supported===0);
 }
 console.log('E1 '+(checks-failed)+'/'+checks);process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
