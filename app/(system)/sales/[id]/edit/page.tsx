import {quotationProductOptions} from '@/lib/quotation-product-options';
import {requireUser} from '@/lib/auth';
import {allows,permissionKeys} from '@/lib/permissions';
import {salesOptions} from '@/lib/sales-options';
import {salesLookup,getSale} from '@/lib/sales-read';
import type {TaxConfig} from '@/lib/vat';
import SaleEntry from '@/components/sale-entry';
export default async function Page({params}:{params:Promise<{id:string}>}){const actor=await requireUser();if(!allows(actor,'sales.edit')||!allows(actor,'sales.prices'))return <h1>Access restricted</h1>;const sale=await getSale(actor,(await params).id);if(sale.status!=='Draft')return <h1>Only Draft Sales can be edited</h1>;const options=await salesOptions(actor),config=await salesLookup(actor,'tax');sale.lines=await quotationProductOptions(actor,sale.lines);return <><h1>Edit {sale.number}</h1><SaleEntry initial={JSON.parse(JSON.stringify(sale))} options={options} config={JSON.parse(JSON.stringify(config)) as TaxConfig} permissions={permissionKeys.filter(p=>allows(actor,p))}/></>;}
