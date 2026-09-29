import {redirect} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {allows,permissionKeys} from '@/lib/permissions';
import {commercialOptions} from '@/lib/commercial-read';
import {salesLookup} from '@/lib/sales-read';
import type {TaxConfig} from '@/lib/vat';
import CommercialEntry from '@/components/commercial-entry';
export default async function Page({searchParams}:{searchParams:Promise<{kind?:string}>}){const actor=await requireUser();if((await searchParams).kind!=='SO')redirect('/quotations');if(!allows(actor,'orders.create')||!allows(actor,'commercial.prices'))return <h1>Access restricted</h1>;return <><h1>New Sales Order</h1><p>No inventory is deducted until goods are released.</p><CommercialEntry employee={{id:actor.id,name:actor.name}} kind="SO" options={await commercialOptions(actor)} config={JSON.parse(JSON.stringify(await salesLookup(actor,'tax'))) as TaxConfig} permissions={permissionKeys.filter(p=>allows(actor,p))}/></>;}
