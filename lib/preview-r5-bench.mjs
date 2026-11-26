import {brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {choose} from './preview-r5-chooser.mjs';
import {issueTerms} from './question-terms.js';
const input=process.env.EZIK_BRAINC_R5_PASSAGES;
if(input && process.env.VERCEL_ENV==='preview' && process.env.VERCEL_GIT_COMMIT_REF==='side/brainc-20261126'){
 const packet=JSON.parse(brotliDecompressSync(Buffer.from(input,'base64')));
 if(packet.head===process.env.VERCEL_GIT_COMMIT_SHA){
  const archivePath=fileURLToPath(new URL('./data/fiqh-articles.bin',import.meta.url));
  for(const method of ['literal','section','references']){
   const times=[];const digest=createHash('sha256');
   for(const row of packet.entries){
    const start=performance.now();const selected=choose({...row,method,issueTerms,archivePath});
    times.push(Number((performance.now()-start).toFixed(3)));
    digest.update(JSON.stringify(selected));
   }
   console.log('R5BENCH '+JSON.stringify({method,times,digest:digest.digest('hex')}));
  }
 }
}
