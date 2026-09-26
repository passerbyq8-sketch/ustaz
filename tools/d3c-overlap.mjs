import fs from 'node:fs';
import { normalizeArabic } from '../lib/route-classify.js';
const rows=JSON.parse(fs.readFileSync('guards/fixtures/d3c-recorded.json','utf8')).rows;
const words=s=>normalizeArabic(s).replace(/[^\p{L}\p{N}]+/gu,' ').trim().split(' ');
for(const id of ['230416','230606']) {
  const r=rows.find(r=>r.file.includes(id)), local=r.materials.find(m=>m.kind==='encyclopedia');
  const a=words(local.text);
  for(const m of r.materials.filter(m=>m.kind==='lib_book'&&m.text)) {
    const b=words(m.text); let best=[];
    for(let i=0;i<a.length;i++) for(let j=0;j<b.length;j++) {
      let k=0;while(a[i+k]&&a[i+k]===b[j+k])k++;
      if(k>best.length)best=a.slice(i,i+k);
    }
    console.log(JSON.stringify({id,ref:m.ref,words:best.length,chars:best.join(' ').length,run:best.join(' ').slice(0,200)}));
  }
}
