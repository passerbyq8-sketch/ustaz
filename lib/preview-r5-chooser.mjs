import {openSync,readSync} from 'node:fs';
import {inflateSync} from 'node:zlib';

let archive;
function article(id,archivePath){
  archive ??= openSync(archivePath,'r');
  const offsets=Buffer.alloc(8);
  if(!/^F\d{5}$/.test(id) || readSync(archive,offsets,0,8,4*Number(id.slice(1)))!==8) throw Error('ARTICLE_INDEX');
  const begin=offsets.readUInt32LE(0),length=offsets.readUInt32LE(4)-begin;
  if(length<=0||length>4000000)throw Error('ARTICLE_LENGTH');
  const data=Buffer.alloc(length);
  if(readSync(archive,data,0,length,begin)!==length)throw Error('ARTICLE_READ');
  return inflateSync(data).toString('utf8');
}

const fold=s=>s.normalize('NFKD').replace(/\p{M}|\u0640/gu,'').replace(/[أإآٱ]/gu,'ا').replace(/ى/gu,'ي').replace(/ة/gu,'ه');
function forms(s){
  let x=fold(s).replace(/^[وفبكل](?=ال)/u,'').replace(/^(?:ال|لل)(?=..)/u,'');
  const v=new Set([x]);
  if(x.length>=5&&/^[وفب]/u.test(x)) v.add(x.slice(1));
  for(const y of [...v]){
    const z=y.replace(/(?:هما|تين|تين|تان|ين|ون|ات|ها|هم|ان|ه|ا)$/u,'');
    if(z.length>=3)v.add(z);
  }
  for(const y of [...v]){
    if(y.length>=5&&/^(?:است|مت|يت|تت|م)/u.test(y))v.add(y.replace(/^(?:است|مت|يت|تت|م)/u,''));
    if(y.length===3&&/[اوي]/u.test(y[1]))v.add(y[0]+'~'+y[2]);
  }
  return [...v].filter(v=>v.length>=2);
}
function sentences(text){
  const result=[];
  const rx=/[.!؟?!](?=\s|$)|:(?=\s*\n)|\n\s*\n|\n(?=\s*\d+\s*[-–])/gu;
  let start=0;
  function add(end){
    while(start<end&&/\s/u.test(text[start]))start++;
    while(end>start&&/\s/u.test(text[end-1]))end--;
    while(end-start>600){
      let cut=text.lastIndexOf(' ',start+520);
      if(cut<=start)cut=start+520;
      result.push({start,end:cut}); start=cut;while(start<end&&/\s/u.test(text[start]))start++;
    }
    if(end>start)result.push({start,end});
  }
  for(const m of text.matchAll(rx)){add(m.index+m[0].trimEnd().length);start=m.index+m[0].length;}
  add(text.length);return result;
}
function pick(text,scored,limit){
  const chosen=[];let remaining=limit;
  for(const c of scored){
    const n=c.end-c.start;
    if(n<=remaining-(chosen.length?2:0)){if(chosen.length)remaining-=2;chosen.push(c);remaining-=n;}
  }
  chosen.sort((a,b)=>a.start-b.start);
  return {text:chosen.map(s=>text.slice(s.start,s.end)).join('\n\n'),ranges:chosen.map(({start,end})=>[start,end])};
}
export function choose({id,question,plan,method,archivePath,issueTerms}){
  const text=article(id,archivePath);const parts=sentences(text);if(!parts.length)return {judge:{text:'',ranges:[]},writer:{text:'',ranges:[]}};
  const query=method==='literal'?issueTerms(question):[...issueTerms(question),...issueTerms(plan||'')];
  const terms=new Set(query.map(fold)),keys=new Set([...terms].flatMap(forms));
  const count=new Map();let section=0,heading='';
  for(const p of parts){
    const raw=text.slice(p.start,p.end);if(/^\d+\s*[-–]/u.test(raw))section++;
    p.section=section;
    const matches=new Set();
    let hits=0;
    for(const m of raw.matchAll(/\p{L}[\p{L}\p{M}]*/gu)){
      if(method==='literal'){
        const v=fold(m[0]);if(terms.has(v)){matches.add(v);hits++;}
      }else for(const k of forms(m[0])) if(keys.has(k))matches.add(k);
    }
    p.matches=matches;p.hits=hits;
    for(const k of matches)count.set(k,1+(count.get(k)||0));
    if(raw.endsWith(':'))heading=raw;
    p.heading=heading;
  }
  const sections=new Map();
  for(const p of parts){
    let score=0;
    for(const k of p.matches)score+=Math.log(1+(parts.length+1)/(count.get(k)+1));
    p.score=method==='literal'?(p.hits+2*p.matches.size)/Math.sqrt(Math.max(1,(p.end-p.start)/160)):
        score/Math.pow(Math.max(0.7,(p.end-p.start)/200),0.24);
    const peers=sections.get(p.section)||[];peers.push(p);sections.set(p.section,peers);
  }
  if(method!=='literal'){
    for(const peers of sections.values()){
      const order=peers.slice().sort((a,b)=>b.score-a.score);
      const score=(order[0]?.score||0)+0.5*(order[1]?.score||0)+0.25*(order[2]?.score||0);
      const base=peers.map(p=>p.score);
      for(const [i,p] of peers.entries()){
        const heading=issueTerms(p.heading).flatMap(forms);
        const headingScore=new Set(heading.filter(k=>keys.has(k))).size;
        p.score+=score*0.50+headingScore*1.2+(base[i-1]||0)*0.16+(base[i+1]||0)*0.09;
      }
    }
  }
  if(method==='references'){
    const counts=new Map(),ids=new Map(),support=new Map();
    const schoolPattern=/(?:حنفي|حنفيه|حنابل|حنبلي|مالكي|شافعي|جمهور)/gu;
    const asksSchools=/مذاهب|المذهب|الائمه|المذاهب/u.test(fold(question));
    for(const [sid,peers] of sections){
      const label=/^\s*(\d+)\s*[-–]/u.exec(text.slice(peers[0].start,peers[0].end));
      if(label&&!ids.has(label[1]))ids.set(label[1],sid);
      const schoolLabels=new Set();
      for(const p of peers){
        const snippet=fold(text.slice(p.start,p.end));p.schools=[...snippet.matchAll(schoolPattern)].map(m=>m[0]);for(const k of p.schools)schoolLabels.add(k);
        for(const m of snippet.matchAll(/[(]\s*(?:ر\s*[:.]?\s*)?ف\s*(\d+)\s*[)]/gu))counts.set(m[1],(counts.get(m[1])||0)+p.score);
      }
      const top=peers.slice().sort((a,b)=>b.score-a.score);
      support.set(sid,top[0].score+(top[1]?.score||0)*0.25+(asksSchools?Math.min(4,schoolLabels.size)*4:0));
    }
    for(const [n,v] of counts){
      const target=ids.get(n);
      if(target!==undefined)support.set(target,support.get(target)+Math.min(v*0.60,46));
    }
    const order=[...sections.keys()].sort((a,b)=>support.get(b)-support.get(a));
    const winner=order[0];const peers=sections.get(winner);
    for(const p of parts){
      const base=p.score;
      p.score=(p.section===winner?500:p.section===order[1]?160:0)+base;
      if(p.section===winner&&asksSchools&&p.schools.length)p.score+=25+6*Math.min(3,new Set(p.schools).size);
      if(p.section===winner&&text.slice(p.start,p.end).endsWith(':'))p.score-=6;
    }
  }
  const ranked=parts.sort((a,b)=>b.score-a.score||a.start-b.start);
  const judge=pick(text,ranked,900);
  const used=new Set(judge.ranges.map(r=>r[0]));
  const writer=pick(text,[...ranked.filter(p=>used.has(p.start)),...ranked.filter(p=>!used.has(p.start))],3500);
  return {judge,writer};
}
