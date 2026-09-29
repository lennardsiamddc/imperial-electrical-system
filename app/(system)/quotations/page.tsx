import {quotationPricingOptions} from '@/lib/quotation-pricing-read';
import Link from 'next/link';
import {requireUser} from '@/lib/auth';
import {allows,permissionKeys} from '@/lib/permissions';
import {getCommercial,commercialOptions} from '@/lib/commercial-read';
import {salesLookup} from '@/lib/sales-read';
import {quotationDefaults} from '@/lib/quotation-defaults';
import QuotationWorkspace from '@/components/quotation-workspace';
import CommercialControls from '@/components/commercial-controls';
import type {TaxConfig} from '@/lib/vat';
export default async function Page({searchParams}:{searchParams:Promise<{id?:string}>}){
 const actor=await requireUser(),id=(await searchParams).id;
 if(!allows(actor,'quotations.read')||!allows(actor,'commercial.prices')||!allows(actor,'sales.discounts'))return <><h1>Quotation workspace access restricted</h1><Link href="/quotations/history">Open / History</Link></>;
 if(!id&&!allows(actor,'quotations.create'))return <><h1>Open a saved quotation</h1><Link href="/quotations/history">Open / History</Link></>;
 const doc=id?await getCommercial(actor,id):undefined;if(doc&&doc.kind!=='Q')return <h1>Quotation not found</h1>;
 if(doc&&allows(actor,'products.read'))doc.lines=await quotationPricingOptions(actor,doc.lines);
 const permissions=permissionKeys.filter(p=>allows(actor,p));
 return <QuotationWorkspace key={doc?doc.id+':'+doc.version:'new'} initial={doc?JSON.parse(JSON.stringify(doc)):undefined} employee={{id:actor.id,name:actor.name}} defaults={!doc?await quotationDefaults(actor):undefined} config={JSON.parse(JSON.stringify(doc?.tax_config||await salesLookup(actor,'tax'))) as TaxConfig} permissions={permissions} controls={doc?<><CommercialControls doc={JSON.parse(JSON.stringify(doc))} permissions={permissions} options={await commercialOptions(actor)}/>{doc.related?.length>1&&<div className="panel"><h2>Related documents</h2>{doc.related.filter((r:{id:string})=>r.id!==doc.id).map((r:{id:string;number:string;status:string})=><p key={r.id}><Link href={'/commercial/'+r.id}>{r.number}</Link> · {r.status}</p>)}</div>}</>:undefined}/>;
}
