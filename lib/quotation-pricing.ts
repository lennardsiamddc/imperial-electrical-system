import {Money} from './vat';
import type {Row} from './sales-common';
export const quotationPriceLists=['None','Retail','Contractor'] as const;
export type QuotationPriceList=typeof quotationPriceLists[number];
export function canonicalQuotationUom(value:string){const u=value.trim().toUpperCase();return u==='PC'?'PCS':['M','METERS'].includes(u)?'METER':u;}
// Quotation-only master lookup. No COGS, FIFO, acquisition cost or tax input.
export function quotationPrice(product:Row,uom:string,list:QuotationPriceList){const chosen=canonicalQuotationUom(uom);if(!quotationUoms.includes(chosen as typeof quotationUoms[number]))return '';const unit=chosen==='METER'?'METER':canonicalQuotationUom(product.primary_uom)==='METER'?['PCS','BOX','ROLL'].find(u=>product.pricing_rules?.[u]||product.selling_prices?.[u])||'PCS':canonicalQuotationUom(product.primary_uom);const rule=product.pricing_rules?.[unit];let value;
 if(list==='None')value=rule?.base??(unit===canonicalQuotationUom(product.primary_uom)?product.base_price:undefined);
 else value=product.selling_prices?.[unit]?.[list]??(unit===canonicalQuotationUom(product.primary_uom)?product[list==='Retail'?'retail_price':'contractor_price']:unit==='METER'&&list==='Retail'?product.meter_price:undefined);
 return value===undefined||value===null?'':new Money(String(value)).toFixed(6);
}
export const quotationUoms=['PCS','BOX','ROLL','METER'] as const;
export function quotationUnits(product:Row){return quotationUoms.map(u=>{const uom=canonicalQuotationUom(u);return {uom,price:quotationPrice(product,uom,'None'),vat_mode:'VAT Exclusive',tax_treatment:'VATable',prices:Object.fromEntries(quotationPriceLists.map(list=>[list,quotationPrice(product,uom,list)]))};});}
export function repriceQuotationRows(rows:Row[],list:QuotationPriceList){return rows.map(l=>{const unit=l.unit_defaults.find((u:Row)=>canonicalQuotationUom(u.uom)===canonicalQuotationUom(l.uom));return {...l,...(l.family_id&&unit?{product_id:unit.product_id,sku:unit.sku,product_name:unit.product_name}:{}),price:unit?.prices?.[list]??'',manual_price_override:false};});}
export function quotationProductForList(product:Row,list:QuotationPriceList){return {...product,unit_defaults:product.unit_defaults.map((u:Row)=>({...u,price:u.prices?.[list]??''}))};}
