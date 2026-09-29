import {resolveSession} from './sessions';
import {stockBalances,movementHistory} from './inventory';
import {getMaster} from './masters';
import {ZodError} from 'zod';
// Read-only HTTP boundary: cookies are resolved server-side; caller-supplied roles are never used.
export async function inventoryResponse(request:Request){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 try{
  const token=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('imperial_session='))?.slice('imperial_session='.length);
  const actor=token?await resolveSession(token):null;
  if(!actor)return Response.json({error:'Authentication required'},{status:401,headers});
  const s=new URL(request.url).searchParams;
  const filter={q:s.get('q')||'',product:s.get('product')||'',low:s.get('low')||'',status:s.get('status')||'',page:Number(s.get('page')||1)};
  const mode=s.get('view')||'balances';
  const data=mode==='history'?await movementHistory(actor,filter):mode==='product'?await getMaster(actor,'products',filter.product):mode==='balances'?await stockBalances(actor,filter):null;
  if(!data)return Response.json({error:'Not found'},{status:404,headers});
  return Response.json({data},{headers});
 }catch(e){
  if(e instanceof ZodError)return Response.json({error:'Invalid request'},{status:400,headers});
  if(e instanceof Error&&e.message.includes('permission'))return Response.json({error:'Access restricted'},{status:403,headers});
  return Response.json({error:'Unable to load inventory'},{status:500,headers});
 }
}
