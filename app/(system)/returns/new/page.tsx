import Link from 'next/link';
import {requireUser} from '@/lib/auth';
import {allows} from '@/lib/permissions';
import {getSale} from '@/lib/sales-read';
import ReturnEntry from '@/components/return-entry';
export default async function Page({searchParams}:{searchParams:Promise<{sale?:string;kind?:string}>}){const actor=await requireUser(),s=await searchParams;if(!allows(actor,'returns.create')||(s.kind==='Cancellation'&&!allows(actor,'sales.cancel')))return <h1>Access restricted</h1>;if(!s.sale)return <p>Open a Posted Sale to create a linked Return.</p>;const sale=await getSale(actor,s.sale);if(sale.status!=='Posted'||sale.activity==='Cancelled / Reversed')return <p>Choose an eligible Posted Sale.</p>;const kind=s.kind==='Cancellation'?'Cancellation':'Return';return <><Link href={'/sales/'+sale.id}>← {sale.number}</Link><h1>{kind} request</h1><p>{sale.number} · {sale.customer_snapshot.name}</p><ReturnEntry sale={JSON.parse(JSON.stringify(sale))} kind={kind}/></>;}
