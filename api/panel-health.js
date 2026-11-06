import { Redis } from '@upstash/redis';
import { resolveActorState } from '../lib/articles/roles.js';
import { applyCorsOrigin,checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { readPanelHealth,saveDailyLimit,acknowledgeAlert } from '../lib/panel-health.js';
const store=new Redis({url:process.env.KV_REST_API_URL,token:process.env.KV_REST_API_TOKEN});
export default async function handler(req,res){
  applyCorsOrigin(req,res);res.setHeader('Cache-Control','private, no-store');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({ok:false});
  if(!(await checkAuthLimit(clientAddress(req,'unknown'))).ok)return res.status(429).json({ok:false});
  const state=await resolveActorState(req);if(state.state==='unknown')return res.status(503).json({ok:false});
  if(state.actor?.role!=='owner')return res.status(401).json({ok:false});
  try{
    const body=req.body||{};
    if(body.action==='limit'){const ok=await saveDailyLimit(store,body.usd);return res.status(ok?200:400).json({ok});}
    if(body.action==='ack'){const ok=await acknowledgeAlert(store,body.id);return res.status(ok?200:400).json({ok});}
    if(body.action!=='read')return res.status(400).json({ok:false});
    return res.status(200).json(await readPanelHealth(store));
  }catch{return res.status(503).json({ok:false});}
}
