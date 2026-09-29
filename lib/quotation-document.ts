import {quotationDiscountDisplay} from './quotation-form';
import {formatQuantity} from './quantity-display';
import {savedDiscount} from './quotation-calculations';
import {getCommercial} from './commercial-read';
import {transaction} from './db';
import {freshActor} from './masters';
import {need,type Row} from './sales-common';
import type {Actor} from './permissions';
import {Money} from './vat';
export {formatPesos as currency,formatPesos as unitCurrency} from './currency-display';
// Whitelist: the customer renderer never receives a full database row.
export async function quotationDocument(actor:Actor,id:string){
 actor=await transaction(db=>freshActor(db,actor.id));need(actor,'quotations.read');need(actor,'commercial.prices');need(actor,'sales.discounts');
 const q=await getCommercial(actor,id);if(q.kind!=='Q')throw new Error('Quotation not found.');
 const pickLine=(l:Row)=>({description:String(l.product_name),quantity:formatQuantity(l.quantity),uom:String(l.uom),price:String(l.entered_price),mode:String(l.vat_mode),treatment:String(l.tax_treatment),discount:quotationDiscountDisplay(savedDiscount(l)),amount:String(l.gross_amount)});
 const fees=(q.fees||[]).map((f:Row)=>({description:String(f.description),entered:String(f.amount),mode:String(f.vat_mode),treatment:String(f.tax_treatment),amount:String(f.gross_amount)}));
 const feeTotal=fees.reduce((n:InstanceType<typeof Money>,f:{amount:string})=>n.plus(f.amount),new Money(0));
 return {number:String(q.number),status:String(q.status),company:String(q.company),customer:String(q.customer_snapshot.name),address:String(q.customer_snapshot.billing_address||''),contact:q.customer_snapshot.quotation_contact??[q.customer_snapshot.contact_person,q.customer_snapshot.phone,q.customer_snapshot.email].filter(Boolean).join(' · '),agent:String(q.salesperson_snapshot?.name||''),date:new Date(q.occurred_at).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'}),terms:q.terms==='Custom'?String(q.custom_terms):String(q.terms),validity:q.validity?new Date(q.validity).toISOString().slice(0,10):'',notes:String(q.notes),disclaimer:String(q.quotation_snapshot?.disclaimer||''),lines:q.lines.map(pickLine),fees,feeTotal:feeTotal.toFixed(2),salesTotal:new Money(q.gross_total).minus(feeTotal).toFixed(2),net:String(q.net_total),vat:String(q.vat_total),total:String(q.gross_total)};
}
export type QuotationDocument=Awaited<ReturnType<typeof quotationDocument>>;
export function quotationFilename(number:string){return 'Imperial_Quotation_'+number.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80)+'.pdf';}
