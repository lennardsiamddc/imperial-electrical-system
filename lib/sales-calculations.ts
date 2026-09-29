import {enteredAmounts,operationalPolicy} from './operational-pricing';
import {Money,vatBreakdown,type EntryMode,type TaxTreatment,type TaxConfig} from './vat';
export const saleChannels=['Wholesale','Retail','Online'] as const;
export const paymentTerms=['Cash','COD','7 Days','15 Days','30 Days','45 Days','60 Days','90 Days','Custom'] as const;
export function calculateSaleLine(price:string,quantity:string,discount:string,mode:EntryMode,treatment:TaxTreatment,config:TaxConfig){
 const p=new Money(price),q=new Money(quantity),d=new Money(discount);
 if(p.lt(0)||q.lte(0)||d.lt(0)||d.gt(100))throw new Error('Please check the price, quantity and discount.');
 const {exact_subtotal,exact_amount,...amounts}=enteredAmounts(price,quantity,new Money(1).minus(d.div(100)));
 return {...amounts,vat_snapshot:{mode,treatment,policy:operationalPolicy,exact_subtotal,exact_amount,entered:amounts.entered_amount,net:amounts.net_amount,vat:'0.00',gross:amounts.gross_amount,entered_unit_price:p.toFixed(6),quantity:q.toFixed(6),discount_percent:d.toFixed(6),rounding:'DISPLAY_AND_SETTLEMENT_HALF_UP_2',calculation_order:'ENTERED_PRICE_TIMES_QUANTITY_TIMES_DISCOUNT',discount_rules:d.isZero()?[]:[{type:'percentage',percent:d.toFixed(6)}]}};
}
export function saleTotals(lines:ReturnType<typeof calculateSaleLine>[]){
 const sum=(key:keyof typeof lines[number])=>lines.reduce((n,l)=>{const snap=l.vat_snapshot as unknown as Record<string,any>;const exact=snap?.policy===operationalPolicy?(key==='subtotal'?snap.exact_subtotal:['entered_amount','net_amount','gross_amount'].includes(key)?snap.exact_amount:key==='discount_amount'?new Money(snap.exact_subtotal).minus(snap.exact_amount).toFixed():undefined):undefined;return n.plus(String(exact??l[key]));},new Money(0)).toFixed(2);
 return {subtotal:sum('subtotal'),discount_total:sum('discount_amount'),entered_total:sum('entered_amount'),net_total:sum('net_amount'),vat_total:sum('vat_amount'),gross_total:sum('gross_amount')};
}
export function dueDate(date:string,terms:string,custom=''){
 if(terms==='Custom'){if(!/^\d{4}-\d{2}-\d{2}$/.test(custom)||Number.isNaN(Date.parse(custom))||new Date(custom).toISOString().slice(0,10)!==custom)throw new Error('Please select a valid custom due date.');return custom;}
 const manila=new Date(new Date(date).getTime()+8*3600000).toISOString().slice(0,10),d=new Date(manila+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+(parseInt(terms)||0));return d.toISOString().slice(0,10);
}
