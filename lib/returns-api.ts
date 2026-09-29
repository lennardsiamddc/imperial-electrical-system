import {hasValidRequestOrigin} from './request-origin';
import {resolveSession} from './sessions';
import {createReturn,changeReturn,getReturn,listReturns,cancelDraftSale} from './returns';
import {saleError} from './sales-common';
export async function returnsResponse(request:Request){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 try{
  const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('imperial_session='))?.slice(17);
  const actor=token?await resolveSession(token):null;
  if(!actor)return Response.json({error:'Authentication required'},{status:401,headers});
  if(request.method==='GET'){
   const p=new URL(request.url).searchParams;
   return Response.json({data:p.get('id')?await getReturn(actor,p.get('id')!):await listReturns(actor,{q:p.get('q')||'',status:p.get('status')||'',page:Number(p.get('page')||1),platform:p.get('platform')||'',from:p.get('from')||'',to:p.get('to')||''})},{headers});
  }
  if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers});
  if(!hasValidRequestOrigin(request))return Response.json({error:'Invalid request origin'},{status:403,headers});
  const body=await request.json();
  if(!body||typeof body!=='object'||Array.isArray(body)||!['create','change','cancel-draft'].includes(body.operation)||Object.keys(body).some(k=>!['operation','data'].includes(k)))return Response.json({error:'Invalid request'},{status:400,headers});
  return Response.json({id:body.operation==='create'?await createReturn(actor,body.data):body.operation==='cancel-draft'?await cancelDraftSale(actor,body.data):await changeReturn(actor,body.data)},{headers});
 }catch(e){return Response.json({error:saleError(e)},{status:e instanceof Error&&e.message.includes('permission')?403:400,headers});}
}
