'use strict';
const fs=require('fs'), path=require('path'), {pathToFileURL}=require('url');
exports.run=async function(group) {
  const at=process.argv.indexOf('--root');
  const root=at>0?path.resolve(process.argv[at+1]):path.join(__dirname,'..');
  const load=rel=>import(pathToFileURL(path.join(root,rel)).href);
  const data=JSON.parse(fs.readFileSync(path.join(root,'guards/fixtures/d3c-recorded.json'),'utf8'));
  for(const r of data.rows) for(const h of r.hits) h.fullText=data.atomTexts?.[h.atom] || '';
  globalThis.fetch=async()=>{throw Error('D3C gates forbid network');};
  const [tk,lock,loop,ask,material]=await Promise.all(['lib/takhrij.js','lib/takhrij-lock.js','lib/free-brain/loop.js','api/ask.js','lib/reader-card-material.js'].map(load));
  let checks=0, failures=0;
  const ok=(name,pass,detail='')=>{checks++;if(!pass)failures++;console.log(`${pass?'PASS':'FAIL'} ${group} ${name}${pass?'':' '+detail}`);};
  const get=id=>data.rows.find(r=>r.file.includes(id));
  const rowsOf=r=>r.materials.map(m=>({...m,recordId:m.id,bookTitle:m.book,subjectId:m.subject,
    part:m.volume,publisher:m.kind==='encyclopedia'?'الموسوعة الفقهية الكويتية':undefined,
    locatorSpan:{volume:m.volume,pageStart:m.page,pageEnd:m.pageEnd},writerText:m.writerText||m.text,fullText:m.fullText||m.text}));
  const lookupFor=r=>async(matns,options={})=>matns.map(matn=>{
    const hits=r.hits.filter(h=>h.fullText&&(!options.bookIds?.length||options.bookIds.includes(h.book)));
    return {matn,atoms:hits.map(h=>h.fullText),subjectIds:hits.map(h=>h.book)};
  });
  if(group==='C1') {
    for(const r of data.rows) {
      const cited=rowsOf(r).filter(m=>r.cited.includes(m.ref));
      const selected=material.locatedBookRows(cited,3,r.question);
      const cards=loop.pickBookCards(cited,3,ask.buildBookTag,{locations:true,question:r.question});
      ok(r.file+' each card has one recorded location',cards.every(c=>selected.some(m=>c.tag.includes(`ref="${m.locator}"`))) || cards.length===0);
      for(const row of selected.filter(row=>row.writerText)) {
        const card=ask.buildBookTag(row), text=Buffer.from(/matn="([^"]*)"/.exec(card.tag)?.[1]||'','base64').toString('utf8');
        ok(r.file+' writer material '+row.ref,text===row.writerText&&!card.tag.includes('cut="1"'));
      }
    }
    for(const id of ['230416','230606']) {
      const r=get(id), cited=rowsOf(r).filter(m=>r.cited.includes(m.ref));
      const remaining=loop.pickEncyclopediaCards(cited,3,ask.buildBookTag,{locations:true});
      ok(id+' pageless duplicate removed',remaining.length===0,`remaining=${remaining.length}; recovered=${cited.map(x=>x.text.length)}`);
    }
    const q41=get('083714'), selected=material.locatedBookRows(rowsOf(q41).filter(m=>q41.cited.includes(m.ref)),3,q41.question);
    for(const id of ['FC-003532','FC-003623','FC-003660','FC-003727']) ok('Q41 '+id+' survives cap',selected.some(row=>row.subjectId===id));
    const q38=get('081412');
    ok('Q38 reference 1 survives markup change',loop.citationSurvival(q38.draft,1,q38.text).keep);
    const q21=get('070810'), row=rowsOf(q21).find(m=>q21.cited.includes(m.ref));
    ok('Q21 rejected sole source remains accessible',!!row && loop.pickReaderCards([row],3,ask.buildSourceTag).length===1
      && !fs.readFileSync(path.join(root,'api/ask.js'),'utf8').includes('row === rejectedCardRow ? null'));
  }
  if(group==='C2') {
    for(const id of ['075955','083714']) {
      const r=get(id), found=tk.findTargets(r.text).targets;
      const grades=found.map((target,i)=>tk.statedGradeNear(r.text,target,i?found[i-1].end:0,i+1<found.length?found[i+1].leadStart:-1));
      ok(id+' jayyid grade recognized',grades.some(g=>/جيد/.test(g)),JSON.stringify(grades));
    }
    const q15=get('000050');
    ok('Q15 measured candidates stay identified',q15.hits.length===124 && q15.hits.filter(h=>h.fullText).length===14);
    ok('Q15 mixed wording is never promoted by shared head and tail',q15.hits.filter(h=>h.fullText).every(h=>!tk.atomCarriesMatnAttached(h.fullText,q15.targets[0].target.matn)));
    const q16=get('000336'), matn=q16.targets[0].target.matn, atom=q16.hits.find(h=>h.fullText&&tk.atomCarriesMatnAttached(h.fullText,matn)).fullText;
    const bare=tk.bareArabic(matn), ws=bare.split(' ');ws[2]='و'+ws[2];
    ok('T3 one attached letter matches recorded atom',tk.atomCarriesMatnAttached(atom,ws.join(' ')));
    ws[3]='ب'+ws[3];ok('T3 two changes cannot match',!tk.atomCarriesMatnAttached(atom,ws.join(' ')));
    for(const r of data.rows) {
      const pass=await tk.applyTakhrij(r.text,{env:{TAKHRIJ_V1:'on',FULL_ANSWER_V1:'on'},question:r.question,lookup:lookupFor(r)});
      ok(r.file+' no incomplete-answer phrase',!pass.text.includes('هذا الجواب لم يكتمل'));
      if(r.file.includes('081412')) {
        const duplicate=tk.findTargets(r.text).duplicates[0];
        ok('Q38 announced duplicate keeps its words',pass.text.includes('«'+duplicate.matn+'»'));
      }
      if(/000336|001120/.test(r.file)) {
        const sources=pass.entries.flatMap(e=>[...(e.proseProof||[]).map(book=>({proseProof:{book,matn:e.matn}})),
          ...(e.authenticityProof?[{authenticityProof:e.authenticityProof}]:[])]);
        const sealed=lock.lockTakhrij(pass.text,sources,{bracketAfterQuote:true});
        const head=r.text.split('\n')[0];
        ok(r.file+' confirmed authenticity sentence survives',sealed.text.includes(head),JSON.stringify(sealed.droppedSentences));
      }
      if(r.file.includes('000645')) {
        const originalHead=r.text.split('\n')[0], grade=originalHead.slice(0,originalHead.indexOf(' متّفقٌ عليه'));
        const variants=[
          ['Q18',r.text],
          ['Q18 shaykhan',r.text.replace(' متّفقٌ عليه، رواه البخاريُّ ومسلمٌ في صحيحيهما','، أخرجه الشيخان')],
          ['Q18 named joint credit',r.text.replace(' متّفقٌ عليه','')],
        ];
        for(const [name,text] of variants) {
          const candidate=text===r.text?pass:await tk.applyTakhrij(text,{env:{TAKHRIJ_V1:'on',FULL_ANSWER_V1:'on'},question:r.question,lookup:lookupFor(r)});
          // The same duplicate-head step that the production API runs before sealing.
          const head=candidate.gradingHead, prefix=head+'\n\n';
          const delivered=head && candidate.text.startsWith(prefix) && tk.headRestatedBy(head,candidate.text.slice(prefix.length))
            ? candidate.text.slice(prefix.length) : candidate.text;
          const sealed=lock.lockTakhrij(delivered,candidate.entries.filter(e=>e.authenticityProof).map(e=>({authenticityProof:e.authenticityProof})),{bracketAfterQuote:true});
          ok(name+' grade clause stays verbatim after folding',tk.foldArabic(sealed.text.split('\n')[0])===tk.foldArabic(grade),sealed.text.slice(0,160));
          ok(name+' joint credit clauses leave no words behind',!/متفق عليه|اخرجه الشيخان|رواه البخاري ومسلم|في صحيحيهما|من حديث ابن عمر/u.test(tk.foldArabic(sealed.text)),sealed.text.slice(0,220));
          const sourced=candidate.entries.filter(e=>e.sourced);
          ok(name+' confirmed collector stays only in the library parenthesis',sourced.length===1 && sourced[0].parenthetical==='البخاري'
            && sealed.text.includes('«'+sourced[0].matn+'» (البخاري)') && (sealed.text.match(/البخاري/gu)||[]).length===1);
          ok(name+' complete grade and T4 frame have no gap',sealed.text.startsWith(grade+'.\nقال رسول الله ﷺ: «'),sealed.text.slice(0,160));
        }
      }
    }
    const source=rowsOf(get('224754'))[0];
    ok('C2c seal reads full material',material.fullSourceMaterial(source)===source.fullText && fs.readFileSync(path.join(root,'api/ask.js'),'utf8').includes('passage: fullSourceMaterial(row)'));
    const q1=get('224754'), full=material.fullSourceMaterial(source);
    const sealWith=passage=>lock.lockTakhrij(q1.text,[{passage}],{bracketAfterQuote:true});
    ok('Q1 full source retains the narrative attribution',sealWith(full).text.includes('منها ما رواه جابر'));
    ok('Q1 excerpt cannot certify the later narrative attribution',!sealWith(full.slice(0,1200)).text.includes('منها ما رواه جابر'));
    ok('Q1 a different narrator cannot certify the attribution',!sealWith(full.replace(/جَابِرٌ/gu,'زيد')).text.includes('منها ما رواه جابر'));
  }
  if(group==='C3') {
    for(const id of ['000050','000645','001120']) {
      const r=get(id), pass=await tk.applyTakhrij(r.text,{env:{TAKHRIJ_V1:'on',FULL_ANSWER_V1:'on'},lookup:lookupFor(r)});
      ok(id+' required frame precedes the matn',/(?:نص الحديث|قال رسول الله ﷺ): «/u.test(pass.text),pass.text.slice(0,250));
      if(id==='000050') ok('Q15 narrator speech has neutral frame',pass.text.includes('نص الحديث: «'+r.targets[0].target.matn+'»'));
      if(id==='001120') ok('Q20 proven speech has direct frame',pass.text.includes('قال رسول الله ﷺ: «'+r.targets[0].target.matn+'»'));
    }
    const literal='قال الشيخ: «'+get('001120').targets[0].target.matn+'»';
    const untouched=await tk.applyTakhrij(literal,{env:{TAKHRIJ_V1:'on',FULL_ANSWER_V1:'on'},lookup:async()=>{throw Error('T2 must not look up a scholar quotation');}});
    ok('T2 verbatim scholar quotation unchanged',untouched.text===literal);
  }
  console.log(`D3C ${group}: ${checks-failures}/${checks} PASS`);
  process.exitCode=failures?1:0;
};
