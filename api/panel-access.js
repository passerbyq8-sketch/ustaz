import { resolveActorState } from '../lib/articles/roles.js';
import { resolvePanelViewer,setPanelViewer } from '../lib/panel-access.js';
import { applyCorsOrigin,checkAuthLimit } from '../lib/ratelimit.js';
import { clientAddress } from '../lib/attempts.js';
import { requireReauthentication } from '../lib/auth/reauth.js';
import { sendProofFailure } from '../lib/auth/proof.js';
export default async function handler(req,res){
  applyCorsOrigin(req,res);res.setHeader('Cache-Control','private, no-store');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({ok:false});
  if(!(await checkAuthLimit(clientAddress(req,'unknown'))).ok)return res.status(429).json({ok:false});
  const owner=await resolveActorState(req);if(owner.state==='unknown')return res.status(503).json({ok:false});
  const isOwner=owner.actor?.role==='owner',body=req.body||{};
  if(body.action==='self'){
    if(isOwner)return res.status(200).json({ok:true,role:'owner'});
    const viewer=await resolvePanelViewer(req);return res.status(viewer.state==='live'?200:viewer.state==='unknown'?503:401).json(viewer.state==='live'?{ok:true,role:'viewer'}:{ok:false});
  }
  if(!isOwner)return res.status(401).json({ok:false});
  if(!['grant','revoke'].includes(body.action))return res.status(400).json({ok:false});
  const proved=await requireReauthentication(body,'roles-'+body.action,{accountKey:body.accountKey,sections:['panel:view-stats']});
  if(!proved.ok)return sendProofFailure(res,proved);
  const out=await setPanelViewer(body.accountKey,body.action==='grant',owner.actor);
  return res.status(out.ok?200:out.error==='panel-target'?400:503).json(out);
}
