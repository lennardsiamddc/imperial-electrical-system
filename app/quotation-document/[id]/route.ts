import {quotationPDFResponse} from '@/lib/quotation-api';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){return quotationPDFResponse(request,(await params).id);}
