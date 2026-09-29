import {normalizeDiscount} from './quotation-calculations';
import type {Row} from './sales-common';
export function blankQuotationRow(id:string):Row{return {id,product_id:'',product_name:'',sku:'',quantity:'1',price:'',discount:'',vat_mode:'',tax_treatment:'VATable',uom:'',unit_defaults:[]};}
export function selectQuotationProduct(rows:Row[],id:string,product:Row){return rows.map(row=>{if(row.id!==id)return row;const defaults=product.unit_defaults.find((u:Row)=>u.uom===row.uom);return {...row,family_id:product.family_id, family_name:product.family_id?product.name:undefined,product_id:product.family_id?(defaults?.product_id||''):product.id,product_name:product.name,sku:defaults?.sku||product.sku,uom:defaults?row.uom:'',family_version:defaults?.family_version,available:product.available,stock_uom:product.secondary_uom||product.primary_uom,unit_defaults:product.unit_defaults,price:defaults?.price??'',manual_price_override:false,vat_mode:defaults?.vat_mode||'VAT Exclusive',tax_treatment:defaults?.tax_treatment||'VATable'};});}
export function removeQuotationRow(rows:Row[],id:string){return rows.filter(row=>row.id!==id);}
export function clearQuotationForm(dirty:boolean,confirmDiscard:()=>boolean,navigate:(url:string)=>void){if(dirty&&!confirmDiscard())return false;navigate('/quotations');return true;}
export function priceListRows(rows:Row[],list:'Retail'|'Contractor'){return rows.map(l=>{const unit=l.unit_defaults.find((u:Row)=>u.uom===l.uom);return {...l,price:unit?.prices?.[list]??'',price_list:list};});}
export function productForPriceList(product:Row,list:'Retail'|'Contractor'){return {...product,unit_defaults:product.unit_defaults.map((u:Row)=>({...u,price:u.prices?.[list]??(list==='Retail'?u.price:'')}))};}

// Presentation only: calculation/storage retain the existing zero-discount semantics.
export function quotationDiscountDisplay(value:string){if(!value.trim())return '';const normalized=normalizeDiscount(value);return normalized==='0%'?'':normalized;}
