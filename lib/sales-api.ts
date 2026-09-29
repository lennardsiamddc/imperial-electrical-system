import {hasValidRequestOrigin} from './request-origin';
import {resolveSession} from './sessions';
import {saveSale,postSale} from './sales';
import {getSale,listSales,salesLookup,saleDocumentData} from './sales-read';
import {changeSaleDocument} from './sales-documents';
import {salesOptions,saveSalesOption,saveReturnPolicy,returnPolicies} from './sales-options';
import {saleError} from './sales-common';
export async function salesResponse(request:Request){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 try{
  const token=request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith('imperial_session='))?.slice(17),actor=token?await resolveSession(token):null;
  if(!actor)return Response.json({error:'Authentication required'},{status:401,headers});
  if(request.method==='GET'){
   const p=new URL(request.url).searchParams;
   const data=p.has('policies')?await returnPolicies(actor):p.get('document')?await saleDocumentData(actor,p.get('document')!):p.get('lookup')?await salesLookup(actor,p.get('lookup')!,p.get('q')||''):p.has('options')?await salesOptions(actor,p.get('options')==='all'):p.get('id')?await getSale(actor,p.get('id')!):await listSales(actor,Object.fromEntries([...p.entries()].map(([key,value])=>[key,key==='page'?Number(value):value])));
   return Response.json({data},{headers});
  }
  if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers});
  if(!hasValidRequestOrigin(request))return Response.json({error:'Invalid request origin'},{status:403,headers});
  const body=await request.json();
  if(!body||typeof body!=='object'||Array.isArray(body)||!['save','post','document','option','policy'].includes(body.operation)||Object.keys(body).some(k=>!['operation','data'].includes(k)))return Response.json({error:'Invalid request'},{status:400,headers});
  const id=body.operation==='save'?await saveSale(actor,body.data):body.operation==='post'?await postSale(actor,body.data):body.operation==='document'?await changeSaleDocument(actor,body.data):body.operation==='policy'?await saveReturnPolicy(actor,body.data):await saveSalesOption(actor,body.data);
  return Response.json({id},{headers});
 }catch(e){return Response.json({error:saleError(e)},{status:e instanceof Error&&(e.message.includes('permission')||e.message.includes('Only Owner/Admin'))?403:400,headers});}
}
