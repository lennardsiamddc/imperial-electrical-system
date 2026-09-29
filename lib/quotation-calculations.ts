import {enteredAmounts,operationalPolicy} from './operational-pricing';
import {z} from 'zod';
import {Money,vatBreakdown,entryModes,taxTreatments,type EntryMode,type TaxTreatment,type TaxConfig} from './vat';
import {calculateSaleLine,saleTotals} from './sales-calculations';
import type {Row} from './sales-common';
const decimal=z.string().regex(/^\d{1,16}(\.\d{1,6})?$/,'Enter a non-negative amount with up to six decimals.');
export const feeSchema=z.object({id:z.uuid(),description:z.string().trim().min(1).max(200),amount:decimal,vat_mode:z.enum(entryModes).default('VAT Exclusive'),tax_treatment:z.enum(taxTreatments).default('VATable')}).strict();
export function normalizeDiscount(input:string){
 const value=input.replace(/\s/g,'');if(!value)return '0%';
 if(!/^[+-]?\d{1,3}(?:\.\d{1,6})?%?(?:[+-]\d{1,3}(?:\.\d{1,6})?%?){0,9}$/.test(value))throw new Error('Use adjustments such as -25, +30 or -25-5-3.');
 const parts=[...value.matchAll(/([+-]?)(\d+(?:\.\d+)?)%?/g)];return parts.map(([,sign,amount])=>{const n=new Money(amount);if(sign==='-'&&n.gt(100))throw new Error('A reduction cannot exceed 100%.');return n.isZero()&&parts.length===1?'0%':(sign==='-'?'-':'+')+n.toFixed()+'%';}).join('');
}
export function savedDiscount(line:Row){const expression=String(line.vat_snapshot?.discount_expression??line.discount_percent??'0');return normalizeDiscount(line.vat_snapshot?.adjustment_version===2?expression:expression.startsWith('-')?expression:'-'+expression);}
export function discountRules(expression:string,version=1){
 const normalized=normalizeDiscount(version===2||/[+%]/.test(expression)?expression:expression.startsWith('-')?expression:'-'+expression);
 return [...normalized.matchAll(/([+-]?)(\d+(?:\.\d+)?)%/g)].map(([,sign,amount])=>({type:'percentage',percent:new Money(amount).mul(sign==='+'?-1:1).toFixed(6)}));
}
export function quotationLine(price:string,quantity:string,expression:string,mode:EntryMode,treatment:TaxTreatment,config:TaxConfig,version=1){
 const rules=discountRules(expression,version),factor=rules.reduce((v,r)=>v.mul(new Money(1).minus(new Money(r.percent).div(100))),new Money(1));
 const p=new Money(price),q=new Money(quantity);if(p.lt(0)||q.lte(0))throw new Error('Check the price and quantity.');
 const {exact_subtotal,exact_amount,...amounts}=enteredAmounts(price,quantity,factor),effective=new Money(1).minus(factor).mul(100);
 const percent=Money.max(0,effective).toFixed(6),signed=version===2||/[+%]/.test(expression);
 return {...amounts,discount_percent:percent,discount_rules:rules,vat_snapshot:{policy:operationalPolicy,exact_subtotal,exact_amount,entered:amounts.entered_amount,net:amounts.net_amount,vat:'0.00',gross:amounts.gross_amount,entered_unit_price:p.toFixed(6),quantity:q.toFixed(6),discount_percent:percent,effective_adjustment_percent:effective.negated().toFixed(),rounding:'DISPLAY_AND_SETTLEMENT_HALF_UP_2',calculation_order:'ENTERED_PRICE_TIMES_QUANTITY_TIMES_CASCADING_FACTORS',discount_expression:signed?normalizeDiscount(expression):expression,adjustment_version:signed?2:1,discount_rules:rules}};
}
export function calculateFees(input:z.infer<typeof feeSchema>[],config:TaxConfig){
 if(new Set(input.map(f=>f.id)).size!==input.length)throw new Error('Duplicate fee identifier.');
 return input.map(f=>({...f,...calculateSaleLine(f.amount,'1','0',f.vat_mode,f.tax_treatment,config)}));
}
export function documentTotals(lines:Row[],fees:Row[]){return saleTotals([...lines,...fees] as ReturnType<typeof calculateSaleLine>[]);}
// Weight each line by its frozen payable value; all-zero orders use equal line shares.
// Fractional quantities stay within their own line/UOM; unlike units are never summed.
export function allocateFees(fees:Row[],originals:Row[],prior:Record<string,string>,selected:Row[]){
 const total=originals.reduce((n,l)=>n.plus(l.gross_amount),new Money(0));
 const progress=(after:boolean)=>originals.reduce((n,l)=>{
  const qty=new Money(prior[l.id]||0).plus(after?selected.filter(s=>s.source_line_id===l.id).reduce<InstanceType<typeof Money>>((q,s)=>q.plus(s.quantity),new Money(0)):0);
  if(qty.gt(l.quantity))throw new Error('Fee allocation exceeds remaining quantity.');
  return n.plus(qty.div(l.quantity).mul(total.isZero()?1:l.gross_amount));
 },new Money(0)).div(total.isZero()?originals.length:total);
 const before=progress(false),after=progress(true);
 return fees.map(f=>{const r:Row={...f,allocation:{method:'CUMULATIVE_ORDER_VALUE_NET_VAT_HALF_UP_2',before:before.toFixed(),after:after.toFixed()}};
 for(const k of ['net_amount','vat_amount'])r[k]=new Money(f[k]).mul(after).toDecimalPlaces(2).minus(new Money(f[k]).mul(before).toDecimalPlaces(2)).toFixed(2);
 r.gross_amount=new Money(r.net_amount).plus(r.vat_amount).toFixed(2);r.entered_amount=f.vat_mode==='VAT Inclusive'?r.gross_amount:r.net_amount;r.subtotal=r.entered_amount;r.discount_amount='0.00';
 r.vat_snapshot={...f.vat_snapshot,...(f.vat_snapshot?.policy===operationalPolicy?{exact_amount:r.gross_amount,exact_subtotal:r.subtotal}:{}),entered:r.entered_amount,net:r.net_amount,vat:r.vat_amount,gross:r.gross_amount,allocation:r.allocation};return r;});
}

// Settle cumulative exact document values, so partial invoices conserve the original
// rounded header even when several sub-cent line fractions accumulate to a centavo.
export function allocatedDocumentTotals(originals:Row[],prior:Record<string,string>,selected:Row[],fees:Row[]){
 if(!originals.every(l=>l.vat_snapshot?.policy===operationalPolicy))return documentTotals(selected,fees);
 const cumulative=(key:'exact_subtotal'|'exact_amount',after:boolean)=>originals.reduce((sum,l)=>{
  const quantity=new Money(prior[l.id]||0).plus(after?selected.filter(s=>s.source_line_id===l.id).reduce<InstanceType<typeof Money>>((q,s)=>q.plus(s.quantity),new Money(0)):0);
  return sum.plus(new Money(l.vat_snapshot[key]).mul(quantity).div(l.quantity));
 },new Money(0)).toDecimalPlaces(2);
 const subtotal=cumulative('exact_subtotal',true).minus(cumulative('exact_subtotal',false));
 const amount=cumulative('exact_amount',true).minus(cumulative('exact_amount',false));
 const fee=documentTotals([],fees);
 return {subtotal:subtotal.plus(fee.subtotal).toFixed(2),discount_total:subtotal.minus(amount).plus(fee.discount_total).toFixed(2),entered_total:amount.plus(fee.entered_total).toFixed(2),net_total:amount.plus(fee.net_total).toFixed(2),vat_total:fee.vat_total,gross_total:amount.plus(fee.gross_total).toFixed(2)};
}
