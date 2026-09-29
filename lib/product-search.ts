import {resolveSession} from './sessions';
import {listMaster} from './masters';
export async function productSearchResponse(request:Request){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 try{
  const token=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('imperial_session='))?.slice('imperial_session='.length);
  const actor=token?await resolveSession(token):null;
  if(!actor)return Response.json({error:'Please sign in again.'},{status:401,headers});
  const s=new URL(request.url).searchParams,q=(s.get('q')||'').trim().slice(0,100);
  const rows=await listMaster(actor,'products',q,s.get('active')==='true'?'true':'',1);
  // Search results deliberately carry only identity fields, never financial snapshots.
  return Response.json({data:rows.slice(0,20).map(p=>({id:p.id,name:p.name,sku:p.sku,brand:p.brand,active:p.active})),more:rows.length>20},{headers});
 }catch(e){return Response.json({error:e instanceof Error&&e.message.includes('permission')?'Product access is restricted.':'Unable to search products. Please try again.'},{status:e instanceof Error&&e.message.includes('permission')?403:500,headers});}
}
