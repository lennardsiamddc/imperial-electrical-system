import {Money} from './vat';
export const operationalPolicy='ENTERED_AMOUNTS_NO_VAT_V1';
export const operationalConfig={standard_rate:'0',version:1,effective_at:'2026-01-01T00:00:00Z'};
export type PriceList='Retail'|'Contractor';
export function enteredAmounts(price:string,quantity:string,factor:InstanceType<typeof Money>){
 const p=new Money(price),q=new Money(quantity);if(!p.isFinite()||!q.isFinite()||p.lt(0)||q.lte(0)||factor.lt(0))throw new Error('Check price, quantity and adjustment.');
 const subtotal=p.mul(q),amount=subtotal.mul(factor);
 return {entered_price:p.toFixed(6),subtotal:subtotal.toFixed(2),discount_amount:subtotal.minus(amount).toFixed(2),entered_amount:amount.toFixed(2),net_amount:amount.toFixed(2),vat_amount:'0.00',gross_amount:amount.toFixed(2),exact_subtotal:subtotal.toFixed(),exact_amount:amount.toFixed()};
}
