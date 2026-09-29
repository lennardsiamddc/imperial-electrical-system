import {requireUser} from '@/lib/auth';
import {allows,permissionKeys} from '@/lib/permissions';
import {salesOptions} from '@/lib/sales-options';
import {salesLookup} from '@/lib/sales-read';
import type {TaxConfig} from '@/lib/vat';
import SaleEntry from '@/components/sale-entry';
export default async function Page(){const actor=await requireUser();if(!allows(actor,'sales.create')||!allows(actor,'sales.prices'))return <h1>Access restricted</h1>;const options=await salesOptions(actor),config=await salesLookup(actor,'tax');return <><div className="page-head"><div><h1>New Sale</h1><p>One Sale for all products. Save a Draft, review, then post.</p></div></div><SaleEntry options={options} config={JSON.parse(JSON.stringify(config)) as TaxConfig} permissions={permissionKeys.filter(p=>allows(actor,p))}/></>;}
