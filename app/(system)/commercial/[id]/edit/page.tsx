import {quotationProductOptions} from '@/lib/quotation-product-options';
import {redirect} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {allows,permissionKeys,type Permission} from '@/lib/permissions';
import {getCommercial} from '@/lib/commercial-read';
import {commercialOptions} from '@/lib/commercial-read';
import CommercialEntry from '@/components/commercial-entry';
export default async function Page({params}:{params:Promise<{id:string}>}){const actor=await requireUser(),doc=await getCommercial(actor,(await params).id);if(doc.kind==='Q')redirect('/quotations?id='+doc.id);if(!['Q','SO'].includes(doc.kind)||doc.status!=='Draft'||doc.source_id||!allows(actor,(doc.kind==='Q'?'quotations.edit':'orders.edit') as Permission)||!allows(actor,'commercial.prices'))return <h1>Access restricted</h1>;doc.lines=await quotationProductOptions(actor,doc.lines);return <><h1>Edit {doc.number}</h1><CommercialEntry kind={doc.kind} initial={JSON.parse(JSON.stringify(doc))} options={await commercialOptions(actor)} config={doc.tax_config} permissions={permissionKeys.filter(p=>allows(actor,p))}/></>;}
